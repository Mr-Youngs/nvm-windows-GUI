#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use chrono::{DateTime, Local};
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::time::SystemTime;
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri::menu::{Menu, MenuItem, Submenu, CheckMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};

// --- 数据结构定义 ---

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NvmConfig {
    #[serde(rename = "nvmPath")]
    pub nvm_path: String,
    #[serde(rename = "nvmSymlink")]
    pub nvm_symlink: String,
    #[serde(rename = "nodeMirror")]
    pub node_mirror: String,
    #[serde(rename = "npmMirror")]
    pub npm_mirror: String,
    pub arch: String,
    #[serde(rename = "lastUpdated")]
    pub last_updated: Option<String>,
    #[serde(rename = "closeAction")]
    pub close_action: String, // "ask", "quit", "hide"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NodeVersion {
    pub version: String,
    pub path: String,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(rename = "installedDate")]
    pub installed_date: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AvailableVersion {
    pub version: String,
    pub date: String,
    pub files: Vec<String>,
    pub npm: Option<String>,
    pub lts: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MirrorPreset {
    pub id: String,
    pub name: String,
    #[serde(rename = "nodeUrl")]
    pub node_url: String,
    #[serde(rename = "npmUrl")]
    pub npm_url: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SpeedTestResult {
    #[serde(rename = "mirrorId")]
    pub mirror_id: String,
    pub latency: i64,
    pub success: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Package {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OutdatedPackage {
    pub name: String,
    pub current: String,
    pub wanted: String,
    pub latest: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchedPackage {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub keywords: Option<Vec<String>>,
    pub author: Option<String>,
    pub downloads: u64,
    #[serde(rename = "lastUpdated")]
    pub last_updated: Option<String>,
}

// --- 预设数据获取 ---

fn get_all_mirror_presets() -> Vec<MirrorPreset> {
    vec![
        MirrorPreset {
            id: "official".to_string(),
            name: "官方源".to_string(),
            node_url: "https://nodejs.org/dist/".to_string(),
            npm_url: "https://github.com/npm/cli/archive/".to_string(),
            description: "Node.js 官方源，国外服务器，速度较慢".to_string(),
        },
        MirrorPreset {
            id: "taobao".to_string(),
            name: "淘宝镜像".to_string(),
            node_url: "https://npmmirror.com/mirrors/node/".to_string(),
            npm_url: "https://npmmirror.com/mirrors/npm/".to_string(),
            description: "淘宝 npmmirror，国内推荐，速度快".to_string(),
        },
        MirrorPreset {
            id: "huawei".to_string(),
            name: "华为云镜像".to_string(),
            node_url: "https://repo.huaweicloud.com/nodejs/".to_string(),
            npm_url: "https://repo.huaweicloud.com/npm/".to_string(),
            description: "华为云镜像，国内备选".to_string(),
        },
        MirrorPreset {
            id: "tsinghua".to_string(),
            name: "清华大学镜像".to_string(),
            node_url: "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/".to_string(),
            npm_url: "https://mirrors.tuna.tsinghua.edu.cn/npm/".to_string(),
            description: "清华大学开源镜像站".to_string(),
        },
    ]
}

// --- 辅助函数 ---

fn get_settings_path() -> Result<PathBuf, String> {
    let nvm_home = env::var("NVM_HOME").map_err(|_| "未找到 NVM_HOME 环境变量".to_string())?;
    Ok(PathBuf::from(nvm_home).join("settings.txt"))
}

fn parse_nvm_settings(content: &str) -> NvmConfig {
    let mut config = NvmConfig {
        nvm_path: String::new(),
        nvm_symlink: String::new(),
        node_mirror: "https://nodejs.org/dist/".to_string(),
        npm_mirror: String::new(),
        arch: "64".to_string(),
        last_updated: None,
        close_action: "ask".to_string(),
    };

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let parts: Vec<&str> = trimmed.splitn(2, ':').collect();
        if parts.len() == 2 {
            let key = parts[0].trim().to_lowercase();
            let value = parts[1].trim().to_string();
            match key.as_str() {
                "root" => config.nvm_path = value,
                "path" => config.nvm_symlink = value,
                "node_mirror" => config.node_mirror = value,
                "npm_mirror" => config.npm_mirror = value,
                "arch" => config.arch = value,
                "close_action" => config.close_action = value,
                _ => {}
            }
        }
    }
    config
}

async fn internal_get_config() -> Result<NvmConfig, String> {
    let path = get_settings_path()?;
    if !path.exists() {
        return Err("nvm settings.txt 不存在".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut config = parse_nvm_settings(&content);
    
    // 获取文件的最后修改时间作为更新时间
    if let Ok(metadata) = fs::metadata(&path) {
        if let Ok(modified) = metadata.modified() {
            let dt: DateTime<Local> = modified.into();
            config.last_updated = Some(dt.format("%Y-%m-%d %H:%M:%S").to_string());
        }
    }
    
    Ok(config)
}

fn get_current_node_version(symlink_path: &str) -> Option<String> {
    let path = Path::new(symlink_path);
    if let Ok(target) = fs::read_link(path) {
        if let Some(name) = target.file_name() {
            let name_str = name.to_string_lossy();
            if let Some(version) = name_str.strip_prefix('v') {
                return Some(version.to_string());
            }
        }
    }
    None
}

fn get_dir_size(path: &Path) -> u64 {
    fs::read_dir(path)
        .map(|entries| {
            entries
                .flatten()
                .map(|entry| {
                    let metadata = entry.metadata().ok();
                    if let Some(md) = metadata {
                        if md.is_dir() {
                            get_dir_size(&entry.path())
                        } else {
                            md.len()
                        }
                    } else {
                        0
                    }
                })
                .sum()
        })
        .unwrap_or(0)
}

fn create_silent_command(cmd: &str) -> Command {
    let mut command = Command::new(cmd);
    #[cfg(windows)]
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    command
}

// --- Tauri 指令 ---

#[tauri::command]
async fn get_config() -> Result<NvmConfig, String> {
    internal_get_config().await
}

#[tauri::command]
async fn get_installed_versions() -> Result<Vec<NodeVersion>, String> {
    let config = internal_get_config().await?;
    let nvm_path = Path::new(&config.nvm_path);
    if !nvm_path.exists() {
        return Err("NVM 根目录不存在".to_string());
    }

    let mut versions = Vec::new();
    let current_node = get_current_node_version(&config.nvm_symlink);

    if let Ok(entries) = fs::read_dir(nvm_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = entry.file_name().into_string().unwrap_or_default();
                if name.starts_with('v') && name.split('.').count() >= 3 {
                    let version = name[1..].to_string();
                    let metadata = entry.metadata().ok();
                    let installed_date = metadata
                        .and_then(|m| m.created().ok())
                        .map(|t| {
                            let dt: DateTime<Local> = t.into();
                            dt.format("%Y-%m-%d %H:%M:%S").to_string()
                        })
                        .unwrap_or_else(|| "未知".to_string());

                    versions.push(NodeVersion {
                        version: version.clone(),
                        path: path.to_string_lossy().to_string(),
                        is_active: current_node.as_ref() == Some(&version),
                        installed_date,
                        size: get_dir_size(&path), 
                    });
                }
            }
        }
    }
    versions.sort_by(|a, b| b.version.cmp(&a.version));
    Ok(versions)
}

#[tauri::command]
async fn get_version_size(path: String) -> Result<u64, String> {
    let p = Path::new(&path);
    if p.exists() {
        Ok(get_dir_size(p))
    } else {
        Err("路径不存在".to_string())
    }
}

#[tauri::command]
async fn get_active_version() -> Result<Option<String>, String> {
    let config = internal_get_config().await?;
    Ok(get_current_node_version(&config.nvm_symlink))
}

#[tauri::command]
async fn switch_version(version: String) -> Result<bool, String> {
    let output = create_silent_command("nvm")
        .args(["use", &version])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(true)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
async fn get_available_versions() -> Result<Vec<AvailableVersion>, String> {
    let config = internal_get_config().await?;
    let url = format!("{}index.json", config.node_mirror);
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let versions = response
        .json::<Vec<AvailableVersion>>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(versions)
}

#[tauri::command]
async fn install_version(window: WebviewWindow, version: String) -> Result<bool, String> {
    let _ = window.emit(
        "install:progress",
        serde_json::json!({ "progress": 5, "status": format!("正在初始化安装 Node.js {}...", version) }),
    );

    // 获取当前架构配置
    let config = internal_get_config().await.unwrap_or_else(|_| NvmConfig {
        nvm_path: String::new(),
        nvm_symlink: String::new(),
        node_mirror: String::new(),
        npm_mirror: String::new(),
        arch: "64".to_string(),
        last_updated: None,
        close_action: "ask".to_string(),
    });

    let mut child = create_silent_command("nvm")
        .args(["install", &version, &config.arch])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 nvm 失败: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let window_handle = window.clone();
    
    let log_accumulator = Arc::new(Mutex::new(String::new()));
    let log_acc_clone = log_accumulator.clone();

    // 在单独的线程中读取输出并发送事件
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                let trimmed = l.trim();
                if !trimmed.is_empty() {
                    // 汇总日志
                    if let Ok(mut logs) = log_acc_clone.lock() {
                        logs.push_str(&l);
                        logs.push('\n');
                    }

                    // 简单的进度识别逻辑
                    let progress = if trimmed.contains('%') {
                        trimmed.split('%').next()
                            .and_then(|s| s.split_whitespace().last())
                            .and_then(|s| s.parse::<i32>().ok())
                            .unwrap_or(50)
                    } else if trimmed.contains("Complete") || trimmed.contains("Installation complete") {
                        100
                    } else {
                        30
                    };

                    let _ = window_handle.emit(
                        "install:progress",
                        serde_json::json!({ "progress": progress, "status": trimmed }),
                    );
                }
            }
        }
        
        // 处理 stderr
        let err_reader = BufReader::new(stderr);
        for line in err_reader.lines() {
            if let Ok(l) = line {
                if let Ok(mut logs) = log_acc_clone.lock() {
                    logs.push_str("ERR: ");
                    logs.push_str(&l);
                    logs.push('\n');
                }
            }
        }
    });

    let status = child.wait().map_err(|e| e.to_string())?;

    if status.success() {
        let _ = window.emit(
            "install:progress",
            serde_json::json!({ "progress": 100, "status": "安装完成" }),
        );
        Ok(true)
    } else {
        let final_logs = log_accumulator.lock().map(|l| l.clone()).unwrap_or_default();
        let error_msg = if final_logs.trim().is_empty() {
            "安装失败。请检查网络连接（如是否需要代理）或尝试切换镜像源。".to_string()
        } else {
            final_logs.trim().to_string()
        };
        Err(error_msg)
    }
}

#[tauri::command]
async fn uninstall_version(version: String) -> Result<bool, String> {
    let output = create_silent_command("nvm")
        .args(["uninstall", &version])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(output.status.success())
}

#[tauri::command]
async fn get_global_packages() -> Result<Vec<Package>, String> {
    let output = create_silent_command("npm.cmd")
        .args(["list", "-g", "--depth=0", "--json"])
        .output()
        .map_err(|e| e.to_string())?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().is_empty() {
        return Ok(Vec::new());
    }

    let val: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({}));
    let mut packages = Vec::new();

    if let Some(deps) = val.get("dependencies").and_then(|d| d.as_object()) {
        for (name, info) in deps {
            if let Some(version) = info.get("version").and_then(|v| v.as_str()) {
                packages.push(Package {
                    name: name.clone(),
                    version: version.to_string(),
                });
            }
        }
    }

    Ok(packages)
}

#[tauri::command]
async fn search_packages(query: String) -> Result<serde_json::Value, String> {
    let url = format!(
        "https://registry.npmjs.org/-/v1/search?text={}&size=20",
        query
    );
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let objects = json.get("objects").and_then(|o| o.as_array());
    let total = json.get("total").and_then(|t| t.as_u64()).unwrap_or(0);
    
    if objects.is_none() {
        return Ok(serde_json::json!({ "results": [], "total": 0 }));
    }

    // 第一步：初步解析包名
    let mut temp_results = Vec::new();
    for obj in objects.unwrap() {
        if let Some(pkg) = obj.get("package") {
            let name = pkg.get("name").and_then(|n| n.as_str()).unwrap_or_default().to_string();
            temp_results.push((name, pkg.clone(), obj.clone()));
        }
    }

    // 第二步：并行抓取下载量
    let futures: Vec<_> = temp_results.iter().map(|(name, _, _)| {
        let client = client.clone();
        let name = name.clone();
        async move {
            let dl_url = format!("https://api.npmjs.org/downloads/point/last-month/{}", name);
            let res = client.get(dl_url).send().await;
            if let Ok(resp) = res {
                if let Ok(dl_json) = resp.json::<serde_json::Value>().await {
                    return dl_json.get("downloads").and_then(|d| d.as_u64()).unwrap_or(0);
                }
            }
            0
        }
    }).collect();

    let download_counts = join_all(futures).await;

    // 第三步：组装最终结果
    let mut results = Vec::new();
    for (i, (name, pkg, obj)) in temp_results.into_iter().enumerate() {
        results.push(SearchedPackage {
            name,
            version: pkg.get("version").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            description: pkg.get("description").and_then(|d| d.as_str()).map(|s| s.to_string()),
            keywords: pkg.get("keywords").and_then(|k| k.as_array()).map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()),
            author: pkg.get("publisher").and_then(|p| p.get("username")).and_then(|u| u.as_str()).map(|s| s.to_string()),
            downloads: download_counts[i],
            last_updated: pkg.get("date").and_then(|d| d.as_str()).map(|s| s.to_string()),
        });
    }

    Ok(serde_json::json!({
        "results": results,
        "total": total
    }))
}

#[tauri::command]
async fn install_global_package(name: String) -> Result<bool, String> {
    let output = create_silent_command("npm.cmd")
        .args(["install", "-g", &name])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(output.status.success())
}

#[tauri::command]
async fn uninstall_global_package(name: String) -> Result<bool, String> {
    let output = create_silent_command("npm.cmd")
        .args(["uninstall", "-g", &name])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(output.status.success())
}

#[tauri::command]
async fn update_global_package(name: String) -> Result<bool, String> {
    let output = create_silent_command("npm.cmd")
        .args(["update", "-g", &name])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(output.status.success())
}

#[tauri::command]
async fn check_outdated_packages() -> Result<Vec<OutdatedPackage>, String> {
    // npm outdated 如果有更新，会以退出码 1 结束，这在 Command 中会被视为错误
    let output = create_silent_command("npm.cmd")
        .args(["outdated", "-g", "--json"])
        .output();

    let output = match output {
        Ok(out) => out,
        Err(e) => return Err(e.to_string()),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().is_empty() {
        return Ok(Vec::new());
    }

    let val: serde_json::Value = serde_json::from_str(&stdout).unwrap_or(serde_json::json!({}));
    let mut outdated = Vec::new();

    if let Some(obj) = val.as_object() {
        for (name, info) in obj {
            outdated.push(OutdatedPackage {
                name: name.clone(),
                current: info.get("current").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                wanted: info.get("wanted").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
                latest: info.get("latest").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            });
        }
    }

    Ok(outdated)
}

#[tauri::command]
async fn get_mirror_presets() -> Result<Vec<MirrorPreset>, String> {
    Ok(get_all_mirror_presets())
}

#[tauri::command]
async fn get_current_mirror() -> Result<serde_json::Value, String> {
    let config = internal_get_config().await?;
    let node_url = if config.node_mirror.is_empty() {
        "https://nodejs.org/dist/".to_string()
    } else {
        config.node_mirror.clone()
    };

    let presets = get_all_mirror_presets();
    let matched = presets.iter().find(|p| {
        p.node_url == node_url || node_url.contains(p.node_url.replace("https://", "").split('/').next().unwrap_or(""))
    });

    Ok(serde_json::json!({
        "preset": matched,
        "custom": matched.is_none() && !config.node_mirror.is_empty(),
        "nodeUrl": node_url,
        "npmUrl": config.npm_mirror
    }))
}

#[tauri::command]
async fn test_all_mirror_speed() -> Result<Vec<SpeedTestResult>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let presets = get_all_mirror_presets();
    let futures: Vec<_> = presets
        .into_iter()
        .map(|preset| {
            let client = client.clone();
            async move {
                let start = SystemTime::now();
                let res = client.head(&preset.node_url).send().await;
                let latency = start.elapsed().map(|d| d.as_millis() as i64).unwrap_or(-1);
                SpeedTestResult {
                    mirror_id: preset.id,
                    latency,
                    success: res.is_ok(),
                }
            }
        })
        .collect();

    let mut results = join_all(futures).await;
    results.sort_by(|a, b| {
        if !a.success { return std::cmp::Ordering::Greater; }
        if !b.success { return std::cmp::Ordering::Less; }
        a.latency.cmp(&b.latency)
    });
    Ok(results)
}

#[tauri::command]
async fn get_arch() -> Result<String, String> {
    let config = internal_get_config().await?;
    Ok(config.arch)
}

#[tauri::command]
async fn set_arch(arch: String) -> Result<bool, String> {
    let mut config = internal_get_config().await?;
    config.arch = arch;
    set_config(config).await
}

#[tauri::command]
async fn set_config(new_config: NvmConfig) -> Result<bool, String> {
    let path = get_settings_path()?;
    let content = format!(
        "root: {}\npath: {}\nnode_mirror: {}\nnpm_mirror: {}\narch: {}\nclose_action: {}\n",
        new_config.nvm_path,
        new_config.nvm_symlink,
        new_config.node_mirror,
        new_config.npm_mirror,
        new_config.arch,
        new_config.close_action
    );
    fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
async fn select_directory(window: WebviewWindow) -> Result<Option<String>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    window.dialog().file().pick_folder(move |folder| {
        let _ = tx.send(folder.map(|f| f.to_string()));
    });
    Ok(rx.recv().unwrap_or(None))
}

#[tauri::command]
async fn get_total_size() -> Result<u64, String> {
    let config = internal_get_config().await?;
    let nvm_path = Path::new(&config.nvm_path);
    if !nvm_path.exists() {
        return Ok(0);
    }

    let mut total = 0;
    if let Ok(entries) = fs::read_dir(nvm_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && entry.file_name().to_string_lossy().starts_with('v') {
                total += get_dir_size(&path);
            }
        }
    }
    Ok(total)
}

#[tauri::command]
async fn validate_path(path: String) -> Result<serde_json::Value, String> {
    let p = Path::new(&path);
    let valid = p.exists() && p.is_dir();
    Ok(serde_json::json!({ "valid": valid }))
}

// --- 托盘菜单增强 ---

fn build_tray_menu<R: Runtime>(app: &AppHandle<R>) -> Result<Menu<R>, String> {
    let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>).map_err(|e| e.to_string())?;
    let hide = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>).map_err(|e| e.to_string())?;
    let quit = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>).map_err(|e| e.to_string())?;
    
    let menu = Menu::with_id(app, "tray_menu").map_err(|e| e.to_string())?;
    menu.append(&show).map_err(|e| e.to_string())?;
    menu.append(&hide).map_err(|e| e.to_string())?;
    
    // 分割线
    menu.append(&tauri::menu::PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    
    // 版本选择列表
    let current_node = {
        if let Ok(path) = get_settings_path() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                let config = parse_nvm_settings(&content);
                get_current_node_version(&config.nvm_symlink)
            } else {
                None
            }
        } else {
            None
        }
    };

    // 重新获取已安装列表 (使用同步逻辑读取)
    let mut versions = Vec::new();
    if let Ok(path) = get_settings_path() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            let config = parse_nvm_settings(&content);
            let root = Path::new(&config.nvm_path);
            if let Ok(entries) = fs::read_dir(root) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let name = entry.file_name().into_string().unwrap_or_default();
                        if name.starts_with('v') && name.split('.').count() >= 3 {
                            versions.push(name[1..].to_string());
                        }
                    }
                }
            }
        }
    }
    versions.sort_by(|a, b| b.cmp(a));

    if !versions.is_empty() {
        let version_submenu = Submenu::with_id(app, "versions_submenu", "切换 Node 版本", true).map_err(|e| e.to_string())?;
        for v in versions {
            let is_checked = Some(v.clone()) == current_node;
            let item = CheckMenuItem::with_id(app, format!("switch:{}", v), &v, true, is_checked, None::<&str>).map_err(|e| e.to_string())?;
            version_submenu.append(&item).map_err(|e| e.to_string())?;
        }
        menu.append(&version_submenu).map_err(|e| e.to_string())?;
    }

    menu.append(&tauri::menu::PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    menu.append(&quit).map_err(|e| e.to_string())?;

    Ok(menu)
}

#[tauri::command]
async fn refresh_tray<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main_tray") {
        let menu = build_tray_menu(&app)?;
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let tray_menu = build_tray_menu(app.handle())?;
            let _tray = TrayIconBuilder::with_id("main_tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .on_menu_event(|app, event| {
                    let id = event.id.as_ref();
                    match id {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        _ if id.starts_with("switch:") => {
                            let version = id.strip_prefix("switch:").unwrap().to_string();
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let _ = switch_version(version).await;
                                // 切换后刷新菜单以更新勾选状态
                                let _ = refresh_tray(app_handle).await;
                            });
                        }
                        _ => {}
                    }
                })
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { 
                        button: MouseButton::Left, 
                        button_state: MouseButtonState::Up, 
                        .. 
                    } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            if is_visible {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            set_config,
            get_installed_versions,
            get_version_size,
            get_active_version,
            get_available_versions,
            get_total_size,
            switch_version,
            install_version,
            uninstall_version,
            get_global_packages,
            search_packages,
            install_global_package,
            uninstall_global_package,
            update_global_package,
            check_outdated_packages,
            get_mirror_presets,
            get_current_mirror,
            test_all_mirror_speed,
            get_arch,
            set_arch,
            select_directory,
            validate_path,
            refresh_tray
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let window_ = window.clone();
                let app_handle = window.app_handle().clone();
                
                // 尝试获取当前配置的关闭行为
                let close_action = {
                    let path = get_settings_path().unwrap_or_default();
                    if path.exists() {
                        let content = fs::read_to_string(&path).unwrap_or_default();
                        let config = parse_nvm_settings(&content);
                        config.close_action
                    } else {
                        "ask".to_string()
                    }
                };

                match close_action.as_str() {
                    "quit" => app_handle.exit(0),
                    "hide" => { let _ = window_.hide(); },
                    _ => {
                        app_handle.dialog()
                            .message("您想将应用最小化到托盘还是直接退出？\n\n[是]：直接退出并记住选择\n[否]：最小化到托盘并记住选择")
                            .title("退出确认")
                            .kind(MessageDialogKind::Info)
                            .buttons(MessageDialogButtons::YesNo)
                            .show(move |result| {
                                let mut config_path = get_settings_path().unwrap_or_default();
                                if config_path.exists() {
                                    let content = fs::read_to_string(&config_path).unwrap_or_default();
                                    let mut config = parse_nvm_settings(&content);
                                    if result {
                                        config.close_action = "quit".to_string();
                                        // 同步保存选择
                                        let updated_content = format!(
                                            "root: {}\npath: {}\nnode_mirror: {}\nnpm_mirror: {}\narch: {}\nclose_action: {}\n",
                                            config.nvm_path, config.nvm_symlink, config.node_mirror, config.npm_mirror, config.arch, config.close_action
                                        );
                                        let _ = fs::write(config_path, updated_content);
                                        app_handle.exit(0);
                                    } else {
                                        config.close_action = "hide".to_string();
                                        // 同步保存选择
                                        let updated_content = format!(
                                            "root: {}\npath: {}\nnode_mirror: {}\nnpm_mirror: {}\narch: {}\nclose_action: {}\n",
                                            config.nvm_path, config.nvm_symlink, config.node_mirror, config.npm_mirror, config.arch, config.close_action
                                        );
                                        let _ = fs::write(config_path, updated_content);
                                        let _ = window_.hide();
                                    }
                                } else {
                                    if result { app_handle.exit(0); } else { let _ = window_.hide(); }
                                }
                            });
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_nvm_settings() {
        let content = "root: C:\\nvm\npath: C:\\nodejs\n# comment\nnode_mirror: https://npmmirror.com/mirrors/node/\n";
        let config = parse_nvm_settings(content);
        assert_eq!(config.nvm_path, "C:\\nvm");
        assert_eq!(config.nvm_symlink, "C:\\nodejs");
        assert_eq!(config.node_mirror, "https://npmmirror.com/mirrors/node/");
        assert_eq!(config.arch, "64"); // Default
    }

    #[test]
    fn test_parse_nvm_settings_with_multiline_and_spaces() {
        let content = "root : D:\\nvm  \n  path  :  D:\\nodejs \narch : 32";
        let config = parse_nvm_settings(content);
        assert_eq!(config.nvm_path, "D:\\nvm");
        assert_eq!(config.nvm_symlink, "D:\\nodejs");
        assert_eq!(config.arch, "32");
    }

    #[test]
    fn test_get_mirror_presets() {
        let presets = get_all_mirror_presets();
        assert!(!presets.is_empty());
        assert_eq!(presets[1].id, "taobao");
    }

    #[test]
    fn test_get_dir_size_nonexistent() {
        let size = get_dir_size(Path::new("C:\\nonexistent_folder_xyz"));
        assert_eq!(size, 0);
    }
}
