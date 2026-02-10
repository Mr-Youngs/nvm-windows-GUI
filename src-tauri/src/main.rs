#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use chrono::{DateTime, Local};
use futures::future::join_all;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri::menu::{Menu, MenuItem, Submenu, CheckMenuItem};
use std::collections::HashMap;
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
use winreg::enums::*;
use winreg::RegKey;
use zip::ZipArchive;
use tokio::sync::broadcast;
use tokio::process::Command as AsyncCommand;
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(windows)]
extern "system" {
    fn NtSuspendProcess(process_handle: windows_sys::Win32::Foundation::HANDLE) -> i32;
    fn NtResumeProcess(process_handle: windows_sys::Win32::Foundation::HANDLE) -> i32;
}



// --- 数据结构定义 ---

struct TaskInfo {
    cancel_tx: broadcast::Sender<()>,
    pause_flag: Arc<AtomicBool>,
    pid: Arc<Mutex<Option<u32>>>,
}

struct DownloadState {
    tasks: Mutex<HashMap<String, TaskInfo>>,
}

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
    #[serde(rename = "globalPrefix")]
    pub global_prefix: Option<String>, // 共享全局包路径
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
    #[serde(rename = "registryUrl")]
    pub registry_url: String,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CacheEntry {
    pub data: serde_json::Value,
    pub timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NvmSharedConfig {
    pub enabled: bool,
    #[serde(rename = "prefixPath")]
    pub prefix_path: Option<String>,
    #[serde(rename = "pathConfigured")]
    pub path_configured: bool,
    #[serde(rename = "packageCount")]
    pub package_count: u32,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct NvmInstallStatus {
    pub installed: bool,
    #[serde(rename = "nvmHome")]
    pub nvm_home: Option<String>,
    #[serde(rename = "nvmSymlink")]
    pub nvm_symlink: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GithubRelease {
    pub tag_name: String,
    pub name: String,
    pub assets: Vec<GithubAsset>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GithubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}


// --- 预设数据获取 ---

fn get_all_mirror_presets() -> Vec<MirrorPreset> {
    vec![
        MirrorPreset {
            id: "official".to_string(),
            name: "官方源".to_string(),
            node_url: "https://nodejs.org/dist/".to_string(),
            npm_url: "https://github.com/npm/cli/archive/".to_string(),
            registry_url: "https://registry.npmjs.org/".to_string(),
            description: "Node.js 官方源，国外服务器，速度较慢".to_string(),
        },
        MirrorPreset {
            id: "taobao".to_string(),
            name: "淘宝镜像".to_string(),
            node_url: "https://npmmirror.com/mirrors/node/".to_string(),
            npm_url: "https://npmmirror.com/mirrors/npm/".to_string(),
            registry_url: "https://registry.npmmirror.com".to_string(),
            description: "淘宝 npmmirror，国内推荐，速度快".to_string(),
        },
        MirrorPreset {
            id: "huawei".to_string(),
            name: "华为云镜像".to_string(),
            node_url: "https://repo.huaweicloud.com/nodejs/".to_string(),
            npm_url: "https://repo.huaweicloud.com/npm/".to_string(),
            registry_url: "https://repo.huaweicloud.com/repository/npm/".to_string(),
            description: "华为云镜像，国内备选".to_string(),
        },
        MirrorPreset {
            id: "tsinghua".to_string(),
            name: "清华大学镜像".to_string(),
            node_url: "https://mirrors.tuna.tsinghua.edu.cn/nodejs-release/".to_string(),
            npm_url: "https://mirrors.tuna.tsinghua.edu.cn/npm/".to_string(),
            registry_url: "https://mirrors.tuna.tsinghua.edu.cn/npm/".to_string(),
            description: "清华大学开源镜像站".to_string(),
        },
    ]
}

fn get_registry_for_npm(npm_mirror: &str) -> Option<String> {
    if npm_mirror.is_empty() {
        return None;
    }
    
    let presets = get_all_mirror_presets();
    let matched = presets.iter().find(|p| {
        p.npm_url == npm_mirror || 
        npm_mirror.contains(p.id.as_str())
    });
    
    match matched {
        Some(p) => Some(p.registry_url.clone()),
        None => {
            // 如果是自定义或者是官方默认
            if npm_mirror.contains("registry.npmjs.org") || npm_mirror.contains("registry.npmmirror.com") {
                Some(npm_mirror.to_string())
            } else {
                None // 不确定时不强制传 --registry，让 npm 使用自带配置
            }
        }
    }
}

// --- 进程序列化与控制 ---

#[cfg(windows)]
fn get_all_process_children(parent_pid: u32) -> Vec<u32> {
    use windows_sys::Win32::System::Diagnostics::ToolHelp::*;
    use std::collections::VecDeque;

    let mut all_children = Vec::new();
    let mut parents = VecDeque::new();
    parents.push_back(parent_pid);

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot != -1 {
            while let Some(current_parent) = parents.pop_front() {
                let mut entry: PROCESSENTRY32W = std::mem::zeroed();
                entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
                
                if Process32FirstW(snapshot, &mut entry) != 0 {
                    loop {
                        if entry.th32ParentProcessID == current_parent {
                            if !all_children.contains(&entry.th32ProcessID) {
                                all_children.push(entry.th32ProcessID);
                                parents.push_back(entry.th32ProcessID);
                            }
                        }
                        if Process32NextW(snapshot, &mut entry) == 0 {
                            break;
                        }
                    }
                }
            }
            windows_sys::Win32::Foundation::CloseHandle(snapshot);
        }
    }
    all_children
}

#[cfg(windows)]
fn suspend_process_tree(pid: u32) -> Result<(), String> {
    use windows_sys::Win32::System::Threading::*;
    use windows_sys::Win32::Foundation::CloseHandle;

    let pids = {
        let mut list = get_all_process_children(pid);
        list.insert(0, pid); // 先停父进程
        list
    };

    for p in pids {
        unsafe {
            let handle = OpenProcess(PROCESS_SUSPEND_RESUME, 0, p);
            if handle != 0 {
                NtSuspendProcess(handle);
                CloseHandle(handle);
            }
        }
    }
    Ok(())
}

#[cfg(windows)]
fn resume_process_tree(pid: u32) -> Result<(), String> {
    use windows_sys::Win32::System::Threading::*;
    use windows_sys::Win32::Foundation::CloseHandle;

    let pids = {
        let mut list = get_all_process_children(pid);
        list.push(pid); // 最后恢复父进程
        list
    };

    for p in pids {
        unsafe {
            let handle = OpenProcess(PROCESS_SUSPEND_RESUME, 0, p);
            if handle != 0 {
                NtResumeProcess(handle);
                CloseHandle(handle);
            }
        }
    }
    Ok(())
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
        global_prefix: None,
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
                "global_prefix" => config.global_prefix = if value.is_empty() { None } else { Some(value) },
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

fn get_cache_path() -> Result<PathBuf, String> {
    let settings_path = get_settings_path()?;
    Ok(settings_path.parent().unwrap().join("cache.json"))
}

async fn get_from_cache(key: &str) -> Option<serde_json::Value> {
    let cache_path = get_cache_path().ok()?;
    if !cache_path.exists() {
        return None;
    }

    let content = fs::read_to_string(&cache_path).ok()?;
    let cache: HashMap<String, CacheEntry> = serde_json::from_str(&content).unwrap_or_default();

    if let Some(entry) = cache.get(key) {
        let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
        // 24 小时 = 86400 秒
        if now - entry.timestamp < 86400 {
            return Some(entry.data.clone());
        }
    }
    None
}

async fn save_to_cache(key: &str, data: serde_json::Value) {
    if let Ok(cache_path) = get_cache_path() {
        let mut cache: HashMap<String, CacheEntry> = fs::read_to_string(&cache_path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
            .unwrap_or_default();

        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
        cache.insert(key.to_string(), CacheEntry {
            data,
            timestamp: now,
        });

        if let Ok(content) = serde_json::to_string_pretty(&cache) {
            let _ = fs::write(cache_path, content);
        }
    }
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportData {
    pub config: NvmConfig,
    #[serde(rename = "installedVersions")]
    pub installed_versions: Vec<String>,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    #[serde(rename = "appVersion")]
    pub app_version: String,
}

#[tauri::command]
async fn export_config() -> Result<String, String> {
    let config = internal_get_config().await?;
    
    // 获取已安装版本列表
    let nvm_path = Path::new(&config.nvm_path);
    let mut installed_versions = Vec::new();
    
    if nvm_path.exists() {
        if let Ok(entries) = fs::read_dir(nvm_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let name = entry.file_name().into_string().unwrap_or_default();
                    if name.starts_with('v') && name.split('.').count() >= 3 {
                        let node_exe = path.join("node.exe");
                        if node_exe.exists() {
                            installed_versions.push(name);
                        }
                    }
                }
            }
        }
    }
    
    let export_data = ExportData {
        config,
        installed_versions,
        exported_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    };
    
    serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("序列化失败: {}", e))
}

#[tauri::command]
async fn import_config(json_data: String) -> Result<bool, String> {
    let export_data: ExportData = serde_json::from_str(&json_data)
        .map_err(|e| format!("解析失败: {}", e))?;
    
    // 验证路径是否存在
    let nvm_path = Path::new(&export_data.config.nvm_path);
    if !nvm_path.exists() {
        return Err(format!("NVM 路径不存在: {}", export_data.config.nvm_path));
    }
    
    // 保存配置
    let settings_path = get_settings_path()?;
    let mut content = String::new();
    
    content.push_str(&format!("root: {}\n", export_data.config.nvm_path));
    content.push_str(&format!("path: {}\n", export_data.config.nvm_symlink));
    
    if !export_data.config.node_mirror.is_empty() {
        content.push_str(&format!("node_mirror: {}\n", export_data.config.node_mirror));
    }
    if !export_data.config.npm_mirror.is_empty() {
        content.push_str(&format!("npm_mirror: {}\n", export_data.config.npm_mirror));
    }
    if !export_data.config.arch.is_empty() {
        content.push_str(&format!("arch: {}\n", export_data.config.arch));
    }
    if !export_data.config.close_action.is_empty() {
        content.push_str(&format!("close_action: {}\n", export_data.config.close_action));
    }
    if let Some(ref prefix) = export_data.config.global_prefix {
        content.push_str(&format!("global_prefix: {}\n", prefix));
    }
    
    fs::write(&settings_path, content)
        .map_err(|e| format!("写入配置失败: {}", e))?;
    
    Ok(true)
}

#[tauri::command]
async fn save_config_to_file(file_path: String) -> Result<bool, String> {
    let config = internal_get_config().await?;
    
    // 获取已安装版本列表
    let nvm_path = Path::new(&config.nvm_path);
    let mut installed_versions = Vec::new();
    
    if nvm_path.exists() {
        if let Ok(entries) = fs::read_dir(nvm_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let name = entry.file_name().into_string().unwrap_or_default();
                    if name.starts_with('v') && name.split('.').count() >= 3 {
                        let node_exe = path.join("node.exe");
                        if node_exe.exists() {
                            installed_versions.push(name);
                        }
                    }
                }
            }
        }
    }
    
    let export_data = ExportData {
        config,
        installed_versions,
        exported_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    };
    
    let json = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("序列化失败: {}", e))?;
    
    fs::write(&file_path, json)
        .map_err(|e| format!("写入文件失败: {}", e))?;
    
    Ok(true)
}

#[tauri::command]
async fn load_config_from_file(file_path: String) -> Result<String, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    Ok(content)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NvmrcInfo {
    pub version: String,
    pub source: String, // ".nvmrc" or ".node-version"
    pub path: String,
}

#[tauri::command]
async fn read_nvmrc(dir_path: String) -> Result<Option<NvmrcInfo>, String> {
    let dir = Path::new(&dir_path);
    
    // 检查 .nvmrc 文件
    let nvmrc_path = dir.join(".nvmrc");
    if nvmrc_path.exists() {
        let content = fs::read_to_string(&nvmrc_path)
            .map_err(|e| format!("读取 .nvmrc 失败: {}", e))?;
        let version = content.trim().to_string();
        if !version.is_empty() {
            return Ok(Some(NvmrcInfo {
                version,
                source: ".nvmrc".to_string(),
                path: nvmrc_path.to_string_lossy().to_string(),
            }));
        }
    }
    
    // 检查 .node-version 文件 (作为备选)
    let node_version_path = dir.join(".node-version");
    if node_version_path.exists() {
        let content = fs::read_to_string(&node_version_path)
            .map_err(|e| format!("读取 .node-version 失败: {}", e))?;
        let version = content.trim().to_string();
        if !version.is_empty() {
            return Ok(Some(NvmrcInfo {
                version,
                source: ".node-version".to_string(),
                path: node_version_path.to_string_lossy().to_string(),
            }));
        }
    }
    
    Ok(None)
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
                    // Check if node.exe exists to confirm it's not a partial download
                    let node_exe = path.join("node.exe");
                    if !node_exe.exists() {
                        continue;
                    }

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

// 自动应用 npm registry 配置
async fn apply_npm_registry() -> Result<(), String> {
    let config = internal_get_config().await?;
    
    // 使用 get_registry_for_npm 获取正确的 registry URL
    let registry_url = get_registry_for_npm(&config.npm_mirror)
        .unwrap_or_else(|| "https://registry.npmjs.org/".to_string());
    
    // 执行 npm config set registry
    let output = create_silent_command("npm.cmd")
        .args(["config", "set", "registry", &registry_url])
        .output();
    
    if let Err(e) = output {
        // 忽略错误，因为可能在没有 node 时执行
        eprintln!("Warning: Failed to set npm registry: {}", e);
    }
    
    Ok(())
}

#[tauri::command]
async fn switch_version(version: String) -> Result<bool, String> {
    let output = create_silent_command("nvm")
        .args(["use", &version])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        // 切换成功后自动应用 npm registry
        let _ = apply_npm_registry().await;
        Ok(true)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
async fn get_available_versions() -> Result<Vec<AvailableVersion>, String> {
    let cache_key = "node_available_versions";
    if let Some(cached) = get_from_cache(cache_key).await {
        if let Ok(versions) = serde_json::from_value::<Vec<AvailableVersion>>(cached) {
            return Ok(versions);
        }
    }

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

    if let Ok(json_val) = serde_json::to_value(&versions) {
        save_to_cache(cache_key, json_val).await;
    }

    Ok(versions)
}

#[tauri::command]
async fn install_version(
    window: WebviewWindow,
    state: tauri::State<'_, DownloadState>,
    version: String,
) -> Result<bool, String> {
    let version = if version.starts_with('v') { version } else { format!("v{}", version) };
    
    // 检查是否已经在下载
    {
        let tasks = state.tasks.lock().unwrap();
        if tasks.contains_key(&version) {
            return Err(format!("版本 {} 正在下载中", version));
        }
    }

    let (cancel_tx, _) = broadcast::channel(1);
    let pause_flag = Arc::new(AtomicBool::new(false));
    
    {
        let mut tasks = state.tasks.lock().unwrap();
        tasks.insert(version.clone(), TaskInfo {
            cancel_tx: cancel_tx.clone(),
            pause_flag: pause_flag.clone(),
            pid: Arc::new(Mutex::new(None)),
        });
    }

    let app_handle = window.app_handle().clone();
    let version_clone = version.clone();

    tauri::async_runtime::spawn(async move {
        let result = perform_download(window.clone(), version_clone.clone(), pause_flag, cancel_tx.subscribe()).await;
        
        // 清理任务
        {
            let state = app_handle.state::<DownloadState>();
            let mut tasks = state.tasks.lock().unwrap();
            tasks.remove(&version_clone);
        }

        match result {
            Ok(_) => {
                let _ = window.emit("install:progress", serde_json::json!({ 
                    "version": version_clone, 
                    "progress": 100, 
                    "status": "安装完成",
                    "finished": true 
                }));
            }
            Err(e) => {
                let _ = window.emit("install:progress", serde_json::json!({ 
                    "version": version_clone, 
                    "progress": 0, 
                    "status": format!("错误: {}", e),
                    "error": e 
                }));
            }
        }
    });

    Ok(true)
}

#[tauri::command]
async fn pause_download(window: WebviewWindow, state: tauri::State<'_, DownloadState>, version: String) -> Result<bool, String> {
    let tasks = state.tasks.lock().unwrap();
    // 找到匹配的任务标识
    let matched_id = if tasks.contains_key(&version) {
        Some(version.clone())
    } else if !version.starts_with('v') {
        let v_prefixed = format!("v{}", version);
        if tasks.contains_key(&v_prefixed) {
            Some(v_prefixed)
        } else {
            None
        }
    } else {
        None
    };

    if let Some(id) = matched_id {
        let task = tasks.get(&id).unwrap();
        task.pause_flag.store(true, Ordering::SeqCst);
        
        let pid = *task.pid.lock().unwrap();
        if let Some(p) = pid {
            #[cfg(windows)]
            let _ = suspend_process_tree(p);
            
            // 务必使用 Map 中的 id 发送事件，确保前端能匹配
            let _ = window.emit("install:progress", serde_json::json!({
                "version": id,
                "status": "已暂停",
                "isPaused": true
            }));
        }
        
        Ok(true)
    } else {
        Err(format!("未找到任务: {}", version))
    }
}

#[tauri::command]
async fn resume_download(window: WebviewWindow, state: tauri::State<'_, DownloadState>, version: String) -> Result<bool, String> {
    let tasks = state.tasks.lock().unwrap();
    let matched_id = if tasks.contains_key(&version) {
        Some(version.clone())
    } else if !version.starts_with('v') {
        let v_prefixed = format!("v{}", version);
        if tasks.contains_key(&v_prefixed) {
            Some(v_prefixed)
        } else {
            None
        }
    } else {
        None
    };

    if let Some(id) = matched_id {
        let task = tasks.get(&id).unwrap();
        task.pause_flag.store(false, Ordering::SeqCst);
        
        let pid = *task.pid.lock().unwrap();
        if let Some(p) = pid {
            #[cfg(windows)]
            let _ = resume_process_tree(p);

            let _ = window.emit("install:progress", serde_json::json!({
                "version": id,
                "status": "正在安装...",
                "isPaused": false
            }));
        }
        
        Ok(true)
    } else {
        Err(format!("未找到任务: {}", version))
    }
}

#[tauri::command]
async fn cancel_download(state: tauri::State<'_, DownloadState>, version: String) -> Result<bool, String> {
    let tasks = state.tasks.lock().unwrap();
    let task = tasks.get(&version).or_else(|| {
        if !version.starts_with('v') {
            tasks.get(&format!("v{}", version))
        } else {
            None
        }
    });

    if let Some(task) = task {
        let _ = task.cancel_tx.send(());
        Ok(true)
    } else {
        Err(format!("未找到任务: {}", version))
    }
}

async fn perform_download(
    window: WebviewWindow,
    version: String,
    pause_flag: Arc<AtomicBool>,
    mut cancel_rx: broadcast::Receiver<()>,
) -> Result<(), String> {
    let config = internal_get_config().await?;
    let arch = if config.arch == "64" { "x64" } else { "x86" };
    
    // 构造下载 URL
    // 例如: https://npmmirror.com/mirrors/node/v20.0.0/node-v20.0.0-win-x64.zip
    let base_mirror = config.node_mirror.trim_end_matches('/');
    let url = format!("{}/{}/node-{}-win-{}.zip", base_mirror, version, version, arch);
    
    // 目标路径
    let nvm_path = PathBuf::from(&config.nvm_path);
    let install_dir = nvm_path.join(&version);
    fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;
    
    let zip_path = install_dir.join("node.zip");
    let part_path = install_dir.join("node.zip.part");

    // 开始下载 node.zip
    let download_result = download_file_with_resume(
        &window, 
        &version, 
        &url, 
        &part_path, 
        &zip_path, 
        pause_flag, 
        &mut cancel_rx,
        "正在下载 Node.js 完整包"
    ).await;

    if let Err(e) = download_result {
        // 如果失败或取消，清理空目录
        let _ = cleanup_if_empty(&install_dir);
        return Err(e);
    }

    // 解压 Zip
    let _ = window.emit("install:progress", serde_json::json!({ 
        "version": version, 
        "progress": 99, 
        "status": "正在解压并配置环境..."
    }));

    let root_folder = format!("node-{}-win-{}", version, arch);
    let extract_result = extract_and_flatten_zip(&zip_path, &install_dir, &root_folder);
    
    // 如果解压失败，清理
    if let Err(e) = extract_result {
        let _ = cleanup_if_empty(&install_dir);
        return Err(e);
    }

    // 删除清理 zip 文件
    let _ = fs::remove_file(zip_path);
    
    // 安装完成后自动应用 npm registry 配置
    let _ = apply_npm_registry().await;
    
    Ok(())
}

fn cleanup_if_empty(path: &Path) -> std::io::Result<()> {
    if path.exists() && path.is_dir() {
        let entries = fs::read_dir(path)?;
        if entries.count() == 0 {
            fs::remove_dir(path)?;
        }
    }
    Ok(())
}
// TODO: 下载 npm (这是后续优化点，目前先完成核心逻辑)
//为了保证兼容性，我们在下载完 node.zip 后，已经包含了 npm。

fn extract_and_flatten_zip(zip_path: &Path, extract_to: &Path, _root_folder_name: &str) -> Result<(), String> {
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => {
                let components: Vec<_> = path.components().collect();
                if components.len() <= 1 {
                    continue;
                }
                let relative_path: PathBuf = components.iter().skip(1).collect();
                extract_to.join(relative_path)
            }
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

async fn download_file_with_resume(
    window: &WebviewWindow,
    version: &str,
    url: &str,
    part_path: &PathBuf,
    target_path: &PathBuf,
    pause_flag: Arc<AtomicBool>,
    cancel_rx: &mut broadcast::Receiver<()>,
    base_status: &str,
) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    
    let mut downloaded = if part_path.exists() {
        fs::metadata(part_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let mut response = client.get(url);
    if downloaded > 0 {
        response = response.header(reqwest::header::RANGE, format!("bytes={}-", downloaded));
    }
    
    let res = response.send().await.map_err(|e| e.to_string())?;
    let total_size = res.content_length().unwrap_or(0) + downloaded;

    if res.status() == reqwest::StatusCode::PARTIAL_CONTENT || (downloaded == 0 && res.status().is_success()) {
        let mut stream = res.bytes_stream();
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(part_path)
            .map_err(|e| e.to_string())?;

        while let Some(chunk_result) = stream.next().await {
            // 检查是否取消
            if cancel_rx.try_recv().is_ok() {
                drop(file);
                let _ = fs::remove_file(part_path);
                return Err("下载已取消".to_string());
            }

            // 检查是否暂停
            while pause_flag.load(Ordering::SeqCst) {
                let _ = window.emit("install:progress", serde_json::json!({ 
                    "version": version, 
                    "progress": (downloaded as f64 / total_size as f64 * 100.0) as u32, 
                    "status": "已暂停",
                    "isPaused": true
                }));
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                // 暂停期间也可以取消
                if cancel_rx.try_recv().is_ok() {
                    drop(file);
                    let _ = fs::remove_file(part_path);
                    return Err("下载已取消".to_string());
                }
            }

            let chunk = chunk_result.map_err(|e| e.to_string())?;
            file.write_all(&chunk).map_err(|e| e.to_string())?;
            downloaded += chunk.len() as u64;

            let progress = (downloaded as f64 / total_size as f64 * 100.0) as u32;
            let _ = window.emit("install:progress", serde_json::json!({ 
                "version": version, 
                "progress": progress, 
                "status": base_status
            }));
        }
        
        drop(file);
        fs::rename(part_path, target_path).map_err(|e| e.to_string())?;
    } else if res.status() == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
        // 已经下载完成或文件已改变，重命名即可
        if part_path.exists() {
            fs::rename(part_path, target_path).map_err(|e| e.to_string())?;
        }
    } else {
        return Err(format!("下载失败: HTTP {}", res.status()));
    }

    Ok(())
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
    // 获取配置以检查是否有全局共享路径
    let config = internal_get_config().await.ok();
    let prefix = config.as_ref().and_then(|c| c.global_prefix.clone());
    
    // 如果设置了 prefix 且目录不存在项目 node_modules，说明还没有安装任何全局包
    if let Some(ref p) = prefix {
        let node_modules = PathBuf::from(p).join("node_modules");
        if !node_modules.exists() {
            return Ok(Vec::new());
        }
    }

    let mut cmd = create_silent_command("npm.cmd");
    cmd.args(["list", "-g", "--depth=0", "--json"]);

    // 如果配置了全局 prefix，显式传递给 npm，确保实时跟随配置
    if let Some(ref p) = prefix {
        cmd.args(["--prefix", p]);
    }

    let output = cmd.output()
        .map_err(|e| format!("无法运行 npm 命令: {}. 请确保已执行 `nvm use` 并正确安装 Node.js。", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    
    if !output.status.success() {
        if stdout.trim().is_empty() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("npm 命令执行失败: {}", stderr));
        }
        // 如果虽然失败但有 stdout，可能仍包含部分 JSON，继续处理
    }

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
async fn search_packages(query: String, page: Option<u32>, size: Option<u32>) -> Result<serde_json::Value, String> {
    let page = page.unwrap_or(1);
    let size = size.unwrap_or(10);
    let cache_key = format!("search:{}:{}:{}", query, page, size);
    
    if let Some(cached) = get_from_cache(&cache_key).await {
        return Ok(cached);
    }

    let registry_base = {
        let config = internal_get_config().await.ok();
        let npm_mirror = config.as_ref().map(|c| c.npm_mirror.as_str()).unwrap_or("");
        get_registry_for_npm(npm_mirror).unwrap_or_else(|| "https://registry.npmjs.org/".to_string())
    };

    let from = (page - 1) * size;
    let url = format!(
        "{}-/v1/search?text={}&size={}&from={}",
        if registry_base.ends_with('/') { registry_base } else { format!("{}/", registry_base) },
        query, size, from
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
        let result = serde_json::json!({ "results": [], "total": 0 });
        save_to_cache(&cache_key, result.clone()).await;
        return Ok(result);
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
    for (i, (name, pkg, _obj)) in temp_results.into_iter().enumerate() {
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

    let final_result = serde_json::json!({
        "results": results,
        "total": total
    });

    save_to_cache(&cache_key, final_result.clone()).await;

    Ok(final_result)
}

#[tauri::command]
async fn get_package_versions(package_name: String) -> Result<serde_json::Value, String> {
    let cache_key = format!("pkg_versions:{}", package_name);
    if let Some(cached) = get_from_cache(&cache_key).await {
        return Ok(cached);
    }

    let registry_base = {
        let config = internal_get_config().await.ok();
        let npm_mirror = config.as_ref().map(|c| c.npm_mirror.as_str()).unwrap_or("");
        get_registry_for_npm(npm_mirror).unwrap_or_else(|| "https://registry.npmjs.org/".to_string())
    };

    // 从 npm registry 获取包的所有版本
    let url = format!(
        "{}{}", 
        if registry_base.ends_with('/') { registry_base } else { format!("{}/", registry_base) },
        package_name
    );
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| e.to_string())?;
    
    // 获取版本列表
    let versions = json.get("versions")
        .and_then(|v| v.as_object())
        .map(|obj| {
            let mut version_list: Vec<serde_json::Value> = obj.keys()
                .map(|v| {
                    let version_info = obj.get(v).unwrap();
                    serde_json::json!({
                        "version": v,
                        "deprecated": version_info.get("deprecated").is_some(),
                        "publishedAt": json.get("time")
                            .and_then(|t| t.get(v))
                            .and_then(|d| d.as_str())
                    })
                })
                .collect();
            // 按版本号倒序排列（最新的在前）
            version_list.reverse();
            version_list
        })
        .unwrap_or_default();
    
    // 获取 dist-tags（latest, next 等）
    let dist_tags = json.get("dist-tags").cloned().unwrap_or(serde_json::json!({}));
    
    // 获取包的描述等基本信息
    let description = json.get("description")
        .and_then(|d| d.as_str())
        .unwrap_or_default();
    
    let result = serde_json::json!({
        "name": package_name,
        "description": description,
        "distTags": dist_tags,
        "versions": versions,
        "totalVersions": versions.len()
    });

    save_to_cache(&cache_key, result.clone()).await;
    
    Ok(result)
}

#[tauri::command]
async fn install_global_package(
    window: WebviewWindow,
    state: tauri::State<'_, DownloadState>,
    name: String, 
    version: Option<String>
) -> Result<bool, String> {
    let package_spec = if let Some(ref v) = version {
        format!("{}@{}", name, v)
    } else {
        name.clone()
    };
    
    let install_id = package_spec.clone();
    
    // 检查是否已经在安装
    {
        let tasks = state.tasks.lock().unwrap();
        if tasks.contains_key(&install_id) {
            return Err(format!("包 {} 正在安装中", install_id));
        }
    }

    let (cancel_tx, _) = broadcast::channel(1);
    let pause_flag = Arc::new(AtomicBool::new(false));
    let pid_ref = Arc::new(Mutex::new(None));

    {
        let mut tasks = state.tasks.lock().unwrap();
        tasks.insert(install_id.clone(), TaskInfo {
            cancel_tx: cancel_tx.clone(),
            pause_flag: pause_flag.clone(),
            pid: pid_ref.clone(),
        });
    }

    let app_handle = window.app_handle().clone();
    let install_id_clone = install_id.clone();
    let mut cancel_rx = cancel_tx.subscribe();

    tauri::async_runtime::spawn(async move {
        // 发送开始事件
        let _ = window.emit("install:progress", serde_json::json!({
            "version": install_id_clone,
            "progress": 10,
            "status": format!("正在安装 {}...", install_id_clone)
        }));

        let config_res = internal_get_config().await;
        if let Err(e) = config_res {
            let _ = window.emit("install:progress", serde_json::json!({
                "version": install_id_clone,
                "error": e
            }));
            return;
        }
        let config = config_res.unwrap();

        let mut cmd = AsyncCommand::new("npm.cmd");
        cmd.args(["install", "-g", &package_spec]);
        
        // 自动识别正确的 registry
        if let Some(r) = get_registry_for_npm(&config.npm_mirror) {
            cmd.args(["--registry", &r]);
        }
        
        // 在 Windows 上隐藏窗口
        #[cfg(windows)]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let child = cmd.spawn();
        
        if let Ok(mut child) = child {
            let pid = child.id();
            if let Some(p) = pid {
                *pid_ref.lock().unwrap() = Some(p);
            }

            // 监听进程结束或取消信号
            tokio::select! {
                status = child.wait() => {
                    let success = status.map(|s| s.success()).unwrap_or(false);
                    if success {
                        let _ = window.emit("install:progress", serde_json::json!({
                            "version": install_id_clone,
                            "progress": 100,
                            "status": "安装完成",
                            "finished": true
                        }));
                    } else {
                        let _ = window.emit("install:progress", serde_json::json!({
                            "version": install_id_clone,
                            "error": "安装失败"
                        }));
                    }
                }
                _ = cancel_rx.recv() => {
                    let _ = child.kill().await;
                    // 同时清理子进程树
                    if let Some(p) = pid {
                        #[cfg(windows)]
                        {
                            use windows_sys::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};
                            use windows_sys::Win32::Foundation::CloseHandle;
                            let pids = get_all_process_children(p);
                            for child_p in pids {
                                unsafe {
                                    let handle = OpenProcess(PROCESS_TERMINATE, 0, child_p);
                                    if handle != 0 {
                                        TerminateProcess(handle, 1);
                                        CloseHandle(handle);
                                    }
                                }
                            }
                        }
                    }
                    let _ = window.emit("install:progress", serde_json::json!({
                        "version": install_id_clone,
                        "status": "已取消",
                        "finished": true
                    }));
                }
            }
        } else {
            let _ = window.emit("install:progress", serde_json::json!({
                "version": install_id_clone,
                "error": "无法启动安装程序"
            }));
        }

        // 清理任务
        {
            let state = app_handle.state::<DownloadState>();
            let mut tasks = state.tasks.lock().unwrap();
            tasks.remove(&install_id_clone);
        }
    });

    Ok(true)
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
    let config = internal_get_config().await?;
    let mut cmd = create_silent_command("npm.cmd");
    cmd.args(["update", "-g", &name]);
    
    if let Some(r) = get_registry_for_npm(&config.npm_mirror) {
        cmd.args(["--registry", &r]);
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    Ok(output.status.success())
}

#[tauri::command]
async fn check_outdated_packages() -> Result<Vec<OutdatedPackage>, String> {
    // 获取配置以检查是否有全局共享路径
    let config = internal_get_config().await.ok();
    let prefix = config.as_ref().and_then(|c| c.global_prefix.clone());
    
    // 如果设置了 prefix 且目录不存在项目 node_modules，说明还没有安装任何全局包，自然没有过时的
    if let Some(ref p) = prefix {
        let node_modules = PathBuf::from(p).join("node_modules");
        if !node_modules.exists() {
            return Ok(Vec::new());
        }
    }

    // npm outdated 如果有更新，会以退出码 1 结束，这在 Command 中会被视为错误
    let mut cmd = create_silent_command("npm.cmd");
    cmd.args(["outdated", "-g", "--json"]);

    // 如果配置了全局 prefix，显式传递给 npm，确保实时跟随配置
    if let Some(ref p) = prefix {
        cmd.args(["--prefix", p]);
    }

    if let Some(ref config) = config {
        if let Some(r) = get_registry_for_npm(&config.npm_mirror) {
            cmd.args(["--registry", &r]);
        }
    }

    let output = cmd.output()
        .map_err(|e| format!("无法运行 npm 命令: {}. 请确保已执行 `nvm use` 并正确安装 Node.js。", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // 注意：npm outdated 有更新时会返回非 0 状态码
    if stdout.trim().is_empty() {
        if !output.status.success() {
             let stderr = String::from_utf8_lossy(&output.stderr);
             if !stderr.trim().is_empty() {
                 return Err(format!("npm 命令执行失败: {}", stderr));
             }
        }
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
    let mut content = format!(
        "root: {}\npath: {}\nnode_mirror: {}\nnpm_mirror: {}\narch: {}\nclose_action: {}\n",
        new_config.nvm_path,
        new_config.nvm_symlink,
        new_config.node_mirror,
        new_config.npm_mirror,
        new_config.arch,
        new_config.close_action
    );
    if let Some(ref prefix) = new_config.global_prefix {
        content.push_str(&format!("global_prefix: {}\n", prefix));
    }
    fs::write(path, content).map_err(|e| e.to_string())?;
    
    // 立即应用 npm registry 设置
    let _ = apply_npm_registry().await;
    
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

// --- NVM 安装检测与自动安装 ---

#[tauri::command]
async fn check_nvm_installation() -> Result<NvmInstallStatus, String> {
    // 检查 NVM_HOME 环境变量
    let nvm_home = env::var("NVM_HOME").ok();
    let nvm_symlink = env::var("NVM_SYMLINK").ok();
    
    // 检查 settings.txt 是否存在
    let installed = if let Some(ref home) = nvm_home {
        let settings_path = Path::new(home).join("settings.txt");
        settings_path.exists()
    } else {
        false
    };
    
    // 尝试获取 nvm 版本
    let version = if installed {
        let output = create_silent_command("nvm")
            .arg("version")
            .output()
            .ok();
        output.and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout).ok().map(|s| s.trim().to_string())
            } else {
                None
            }
        })
    } else {
        None
    };
    
    Ok(NvmInstallStatus {
        installed,
        nvm_home,
        nvm_symlink,
        version,
    })
}

#[tauri::command]
async fn get_nvm_latest_release() -> Result<GithubRelease, String> {
    let cache_key = "nvm_latest_release";
    if let Some(cached) = get_from_cache(cache_key).await {
        if let Ok(release) = serde_json::from_value::<GithubRelease>(cached) {
            return Ok(release);
        }
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    
    let response = client
        .get("https://api.github.com/repos/coreybutler/nvm-windows/releases/latest")
        .header("User-Agent", "nvm-windows-gui")
        .send()
        .await
        .map_err(|e| format!("请求 GitHub API 失败: {}", e))?;
    
    let release: GithubRelease = response
        .json()
        .await
        .map_err(|e| format!("解析 GitHub 响应失败: {}", e))?;
    
    if let Ok(json_val) = serde_json::to_value(&release) {
        save_to_cache(cache_key, json_val).await;
    }

    Ok(release)
}

#[tauri::command]
async fn download_and_install_nvm(
    window: WebviewWindow,
    target_dir: String,
    symlink_dir: String,
) -> Result<bool, String> {
    // 获取最新版本信息
    let _ = window.emit("nvm:install:progress", serde_json::json!({
        "progress": 5,
        "status": "正在获取最新版本信息..."
    }));
    
    let release = get_nvm_latest_release().await.map_err(|e| format!("获取版本失败: {}", e))?;
    let asset = release.assets
        .iter()
        .find(|a| a.name.contains("noinstall") && a.name.ends_with(".zip"))
        .ok_or("未找到 nvm-noinstall.zip 下载文件")?;
    
    // 创建目标目录
    fs::create_dir_all(&target_dir).map_err(|e| format!("创建目录失败: {}", e))?;
    // NVM_SYMLINK 目录不能提前创建为真实目录，否则 nvm use 会失败
    // nvm-windows 会在切换版本时自动创建该符号链接
    // 如果该路径已经是真实文件夹，尝试清理它（如果它是空的）
    let symlink_path = Path::new(&symlink_dir);
    if symlink_path.exists() && symlink_path.is_dir() && !symlink_path.is_symlink() {
        if let Ok(entries) = fs::read_dir(symlink_path) {
            if entries.count() == 0 {
                let _ = fs::remove_dir(symlink_path);
            }
        }
    }

    // 代理列表 (加速 GitHub 下载)
    let proxy_prefixes = vec![
        "https://ghp.ci/",
        "https://gh-proxy.com/",
        "https://mirror.ghproxy.com/",
        "https://ghproxy.net/",
    ];

    let mut response = None;
    let mut last_error = String::new();

    // 尝试所有加速代理
    for (i, prefix) in proxy_prefixes.iter().enumerate() {
        let download_url = format!("{}{}", prefix, asset.browser_download_url);
        
        let _ = window.emit("nvm:install:progress", serde_json::json!({
            "progress": 10 + (i * 2) as u32,
            "status": format!("正在重试加速代理 {}/{} ...", i + 1, proxy_prefixes.len())
        }));

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60)) // 单次尝试超时缩短
            .http1_only() // 强制使用 HTTP/1.1，提高国内复杂网络下的 SSL 握手成功率
            .build()
            .map_err(|e: reqwest::Error| e.to_string())?;

        match client
            .get(&download_url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .send()
            .await 
        {
            Ok(res) if res.status().is_success() => {
                response = Some(res);
                break;
            }
            Ok(res) => {
                last_error = format!("代理 {} 返回错误码: {}", prefix, res.status());
            }
            Err(e) => {
                last_error = format!("代理 {} 连接失败: {}", prefix, e);
            }
        }
    }

    let response = response.ok_or_else(|| format!("所有加速代理均失效，最后一次错误: {}", last_error))?;
    
    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    
    // 保存到临时文件
    let temp_path = PathBuf::from(&target_dir).join("nvm-noinstall.zip");
    let mut file = File::create(&temp_path).map_err(|e| format!("创建临时文件失败: {}", e))?;
    
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载错误: {}", e))?;
        file.write_all(&chunk).map_err(|e| format!("写入文件失败: {}", e))?;
        downloaded += chunk.len() as u64;
        
        let progress = if total_size > 0 {
            10 + (downloaded as f64 / total_size as f64 * 50.0) as u32
        } else {
            10 + (downloaded.min(5000000) as f64 / 5000000.0 * 50.0) as u32 // 兜底处理：假设 5MB
        };
        
        let status_percent = if total_size > 0 {
            format!("{}%", (downloaded as f64 / total_size as f64 * 100.0) as u32)
        } else {
            format!("{:.2} MB", downloaded as f64 / 1024.0 / 1024.0)
        };

        let _ = window.emit("nvm:install:progress", serde_json::json!({
            "progress": progress,
            "status": format!("正在下载... {}", status_percent)
        }));
    }
    drop(file);
    
    let _ = window.emit("nvm:install:progress", serde_json::json!({
        "progress": 65,
        "status": "正在解压文件..."
    }));
    
    // 解压文件
    let zip_file = File::open(&temp_path).map_err(|e| format!("打开 zip 文件失败: {}", e))?;
    let mut archive = ZipArchive::new(zip_file).map_err(|e| format!("读取 zip 文件失败: {}", e))?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("解压失败: {}", e))?;
        let outpath = PathBuf::from(&target_dir).join(file.name());
        
        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).ok();
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).ok();
            }
            let mut outfile = File::create(&outpath).map_err(|e| format!("创建文件失败: {}", e))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| format!("写入失败: {}", e))?;
        }
    }
    
    // 删除临时 zip 文件
    fs::remove_file(&temp_path).ok();
    
    let _ = window.emit("nvm:install:progress", serde_json::json!({
        "progress": 80,
        "status": "正在创建配置文件..."
    }));
    
    // 创建 settings.txt
    let settings_content = format!(
        "root: {}\npath: {}\narch: 64\nnode_mirror: https://npmmirror.com/mirrors/node/\nnpm_mirror: https://npmmirror.com/mirrors/npm/\n",
        target_dir, symlink_dir
    );
    let settings_path = PathBuf::from(&target_dir).join("settings.txt");
    fs::write(&settings_path, settings_content).map_err(|e| format!("创建配置文件失败: {}", e))?;
    
    let _ = window.emit("nvm:install:progress", serde_json::json!({
        "progress": 90,
        "status": "正在配置环境变量..."
    }));
    
    // 设置环境变量
    setup_user_environment(&target_dir, &symlink_dir)?;
    
    // 更新当前进程的环境变量，确保后续 nvm 命令可用
    env::set_var("NVM_HOME", &target_dir);
    env::set_var("NVM_SYMLINK", &symlink_dir);
    if let Ok(current_path) = env::var("Path") {
        let mut paths: Vec<String> = env::split_paths(&current_path).map(|p| p.to_string_lossy().to_string()).collect();
        if !paths.iter().any(|p| p.eq_ignore_ascii_case(&target_dir)) {
            paths.push(target_dir.clone());
        }
        if !paths.iter().any(|p| p.eq_ignore_ascii_case(&symlink_dir)) {
            paths.push(symlink_dir.clone());
        }
        if let Ok(new_path) = env::join_paths(paths) {
            env::set_var("Path", new_path);
        }
    }
    
    let _ = window.emit("nvm:install:progress", serde_json::json!({
        "progress": 100,
        "status": "安装完成"
    }));
    
    Ok(true)
}

fn setup_user_environment(nvm_home: &str, nvm_symlink: &str) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let env_key = hkcu
        .open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)
        .map_err(|e| format!("打开注册表失败: {}", e))?;
    
    // 设置 NVM_HOME
    env_key.set_value("NVM_HOME", &nvm_home)
        .map_err(|e| format!("设置 NVM_HOME 失败: {}", e))?;
    
    // 设置 NVM_SYMLINK
    env_key.set_value("NVM_SYMLINK", &nvm_symlink)
        .map_err(|e| format!("设置 NVM_SYMLINK 失败: {}", e))?;
    
    // 更新 PATH
    let current_path: String = env_key.get_value("Path").unwrap_or_default();
    let mut paths: Vec<&str> = current_path.split(';').collect();
    
    // 添加 NVM_HOME 和 NVM_SYMLINK 到 PATH (如果不存在)
    if !paths.iter().any(|p| p.eq_ignore_ascii_case(nvm_home)) {
        paths.push(nvm_home);
    }
    if !paths.iter().any(|p| p.eq_ignore_ascii_case(nvm_symlink)) {
        paths.push(nvm_symlink);
    }
    
    let new_path = paths.join(";");
    env_key.set_value("Path", &new_path)
        .map_err(|e| format!("设置 PATH 失败: {}", e))?;
    
    // 通知系统环境变量已更改
    #[cfg(windows)]
    unsafe {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE};
        
        let param: Vec<u16> = OsStr::new("Environment").encode_wide().chain(Some(0)).collect();
        SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            0,
            param.as_ptr() as isize,
            SMTO_ABORTIFHUNG,
            5000,
            std::ptr::null_mut(),
        );
    }
    
    Ok(())
}

// --- 共享全局包目录 ---

#[tauri::command]
async fn get_global_prefix() -> Result<Option<String>, String> {
    let output = create_silent_command("npm.cmd")
        .args(["config", "get", "prefix"])
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        let prefix = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if prefix.is_empty() || prefix == "undefined" {
            Ok(None)
        } else {
            Ok(Some(prefix))
        }
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn set_global_prefix(path: String, migrate_packages: bool) -> Result<bool, String> {
    // 获取当前的 prefix（如果有）
    let old_prefix = get_global_prefix().await.ok().flatten();
    
    // 获取用户 .npmrc 路径
    let user_profile = env::var("USERPROFILE")
        .map_err(|_| "无法获取 USERPROFILE 环境变量".to_string())?;
    let npmrc_path = PathBuf::from(&user_profile).join(".npmrc");
    
    // 读取现有 .npmrc 内容
    let existing_content = fs::read_to_string(&npmrc_path).unwrap_or_default();
    
    // 解析并更新 prefix 设置
    let mut lines: Vec<String> = existing_content
        .lines()
        .filter(|line| !line.trim().starts_with("prefix=") && !line.trim().starts_with("prefix ="))
        .map(|s| s.to_string())
        .collect();
    
    // 添加新的 prefix 设置
    lines.push(format!("prefix={}", path));
    
    // 写回 .npmrc
    let new_content = lines.join("\n");
    fs::write(&npmrc_path, new_content)
        .map_err(|e| format!("写入 .npmrc 失败: {}", e))?;
    
    // 创建新目录
    fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
    
    // 迁移全局包（如果需要且旧路径存在）
    if migrate_packages {
        if let Some(ref old_path) = old_prefix {
            if old_path != &path && Path::new(old_path).exists() {
                // 迁移 node_modules 目录
                let old_modules = PathBuf::from(old_path).join("node_modules");
                let new_modules = PathBuf::from(&path).join("node_modules");
                if old_modules.exists() && !new_modules.exists() {
                    if let Err(_e) = fs::rename(&old_modules, &new_modules) {
                        // 如果 rename 失败（跨盘符），尝试复制
                        let _ = copy_dir_all(&old_modules, &new_modules);
                        let _ = fs::remove_dir_all(&old_modules);
                    }
                }
                
                // 迁移可执行文件（.cmd, .ps1 等）
                if let Ok(entries) = fs::read_dir(old_path) {
                    for entry in entries.flatten() {
                        let file_path = entry.path();
                        if file_path.is_file() {
                            if let Some(name) = file_path.file_name() {
                                let dest = PathBuf::from(&path).join(name);
                                if !dest.exists() {
                                    let _ = fs::rename(&file_path, &dest).or_else(|_| {
                                        fs::copy(&file_path, &dest).map(|_| ())
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 更新 PATH 环境变量（移除旧路径，添加新路径）
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(env_key) = hkcu.open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE) {
        let current_path: String = env_key.get_value("Path").unwrap_or_default();
        let mut paths: Vec<String> = current_path
            .split(';')
            .filter(|p| !p.is_empty())
            .map(|s| s.to_string())
            .collect();
        
        // 移除旧的 prefix 路径
        if let Some(ref old_path) = old_prefix {
            paths.retain(|p| !p.eq_ignore_ascii_case(old_path));
        }
        
        // 添加新路径（如果不存在）
        if !paths.iter().any(|p| p.eq_ignore_ascii_case(&path)) {
            paths.push(path.clone());
        }
        
        let new_path_env = paths.join(";");
        let _ = env_key.set_value("Path", &new_path_env);
        
        // 广播环境变量更改通知
        #[cfg(windows)]
        unsafe {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE};
            
            let param: Vec<u16> = OsStr::new("Environment").encode_wide().chain(Some(0)).collect();
            SendMessageTimeoutW(
                HWND_BROADCAST,
                WM_SETTINGCHANGE,
                0,
                param.as_ptr() as isize,
                SMTO_ABORTIFHUNG,
                5000,
                std::ptr::null_mut(),
            );
        }
    }
    
    // 更新 settings.txt
    let mut config = internal_get_config().await?;
    config.global_prefix = Some(path);
    set_config(config).await?;
    
    Ok(true)
}

// 递归复制目录
fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn get_shared_packages_config() -> Result<NvmSharedConfig, String> {
    let config = internal_get_config().await.ok();
    let prefix_path = config.as_ref().and_then(|c| c.global_prefix.clone());
    
    // 获取实际的 npm prefix
    let actual_prefix = get_global_prefix().await.ok().flatten();
    
    // 检查是否启用了共享模式
    let enabled = prefix_path.is_some() && actual_prefix == prefix_path;
    
    // 检查 PATH 是否包含共享目录
    let path_configured = if let Some(ref prefix) = prefix_path {
        check_path_contains_internal(prefix)
    } else {
        false
    };
    
    // 获取全局包数量
    let package_count = if enabled {
        let packages = get_global_packages().await.unwrap_or_default();
        packages.len() as u32
    } else {
        0
    };
    
    Ok(NvmSharedConfig {
        enabled,
        prefix_path,
        path_configured,
        package_count,
    })
}

fn check_path_contains_internal(target_path: &str) -> bool {
    if let Ok(path_env) = env::var("PATH") {
        path_env.split(';')
            .any(|p| p.eq_ignore_ascii_case(target_path))
    } else {
        false
    }
}

#[tauri::command]
async fn check_path_contains(path: String) -> Result<bool, String> {
    Ok(check_path_contains_internal(&path))
}

#[tauri::command]
async fn add_to_user_path(path: String) -> Result<bool, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let env_key = hkcu
        .open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)
        .map_err(|e| format!("打开注册表失败: {}", e))?;
    
    let current_path: String = env_key.get_value("Path").unwrap_or_default();
    let mut paths: Vec<&str> = current_path.split(';').collect();
    
    if !paths.iter().any(|p| p.eq_ignore_ascii_case(&path)) {
        paths.push(&path);
        let new_path = paths.join(";");
        env_key.set_value("Path", &new_path)
            .map_err(|e| format!("设置 PATH 失败: {}", e))?;
        
        // 广播环境变量更改通知
        #[cfg(windows)]
        unsafe {
            use std::ffi::OsStr;
            use std::os::windows::ffi::OsStrExt;
            use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE};
            
            let param: Vec<u16> = OsStr::new("Environment").encode_wide().chain(Some(0)).collect();
            SendMessageTimeoutW(
                HWND_BROADCAST,
                WM_SETTINGCHANGE,
                0,
                param.as_ptr() as isize,
                SMTO_ABORTIFHUNG,
                5000,
                std::ptr::null_mut(),
            );
        }
    }
    
    Ok(true)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInfo {
    #[serde(rename = "hasUpdate")]
    pub has_update: bool,
    #[serde(rename = "currentVersion")]
    pub current_version: String,
    #[serde(rename = "latestVersion")]
    pub latest_version: String,
    #[serde(rename = "releaseUrl")]
    pub release_url: String,
    #[serde(rename = "releaseNotes")]
    pub release_notes: String,
    #[serde(rename = "publishedAt")]
    pub published_at: String,
}

#[tauri::command]
async fn check_for_updates() -> Result<UpdateInfo, String> {
    let client = reqwest::Client::builder()
        .user_agent("nvm-windows-gui")
        .build()
        .map_err(|e| e.to_string())?;
    
    // 获取当前版本
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    
    // 查询 GitHub API
    let response = client
        .get("https://api.github.com/repos/Mr-Youngs/nvm-windows-GUI/releases/latest")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }
    
    let release: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    
    let latest_version = release["tag_name"]
        .as_str()
        .unwrap_or("0.0.0")
        .trim_start_matches('v')
        .to_string();
    
    let release_url = release["html_url"]
        .as_str()
        .unwrap_or("")
        .to_string();
    
    let release_notes = release["body"]
        .as_str()
        .unwrap_or("")
        .to_string();
    
    let published_at = release["published_at"]
        .as_str()
        .unwrap_or("")
        .to_string();
    
    // 比较版本
    let has_update = compare_versions(&current_version, &latest_version);
    
    Ok(UpdateInfo {
        has_update,
        current_version,
        latest_version,
        release_url,
        release_notes,
        published_at,
    })
}

fn compare_versions(current: &str, latest: &str) -> bool {
    let parse_version = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|s| s.parse().ok())
            .collect()
    };
    
    let current_parts = parse_version(current);
    let latest_parts = parse_version(latest);
    
    for i in 0..3 {
        let c = current_parts.get(i).copied().unwrap_or(0);
        let l = latest_parts.get(i).copied().unwrap_or(0);
        if l > c {
            return true;
        }
        if l < c {
            return false;
        }
    }
    false
}

#[tauri::command]
fn get_default_paths() -> serde_json::Value {
    let appdata = env::var("APPDATA").unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Roaming".to_string());
    serde_json::json!({
        "nvmHome": format!("{}\\nvm", appdata),
        "nvmSymlink": format!("{}\\nodejs", appdata),
        "globalPrefix": format!("{}\\npm-global", appdata)
    })
}

// --- 托盘菜单增强 ---

fn build_tray_menu<R: Runtime>(app: &AppHandle<R>) -> Result<Menu<R>, String> {
    let menu = Menu::with_id(app, "tray_menu").map_err(|e| e.to_string())?;
    
    // 获取当前版本
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

    // 显示当前版本状态
    let version_label = match &current_node {
        Some(v) => format!("Node.js v{}", v),
        None => "未激活版本".to_string(),
    };
    let version_info = MenuItem::with_id(app, "version_info", &version_label, false, None::<&str>).map_err(|e| e.to_string())?;
    menu.append(&version_info).map_err(|e| e.to_string())?;
    
    menu.append(&tauri::menu::PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;

    // 获取已安装版本列表
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

    // 版本切换子菜单
    if !versions.is_empty() {
        let version_submenu = Submenu::with_id(app, "versions_submenu", "切换版本", true).map_err(|e| e.to_string())?;
        for v in versions {
            let is_checked = Some(v.clone()) == current_node;
            let item = CheckMenuItem::with_id(app, format!("switch:{}", v), &format!("v{}", v), true, is_checked, None::<&str>).map_err(|e| e.to_string())?;
            version_submenu.append(&item).map_err(|e| e.to_string())?;
        }
        menu.append(&version_submenu).map_err(|e| e.to_string())?;
    }

    menu.append(&tauri::menu::PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;

    // 窗口控制
    let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>).map_err(|e| e.to_string())?;
    let hide = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>).map_err(|e| e.to_string())?;
    menu.append(&show).map_err(|e| e.to_string())?;
    menu.append(&hide).map_err(|e| e.to_string())?;
    
    menu.append(&tauri::menu::PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    
    // 退出
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>).map_err(|e| e.to_string())?;
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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // 当启动第二个实例时，聚焦到已有窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(DownloadState { tasks: Mutex::new(HashMap::new()) })
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
            refresh_tray,
            // NVM 安装相关
            check_nvm_installation,
            get_nvm_latest_release,
            download_and_install_nvm,
            get_default_paths,
            // 共享全局包相关
            get_global_prefix,
            set_global_prefix,
            get_shared_packages_config,
            check_path_contains,
            add_to_user_path,
            // 包版本查询
            get_package_versions,
            // 下载控制
            pause_download,
            resume_download,
            cancel_download,
            // 更新检查
            check_for_updates,
            // 导入导出
            export_config,
            import_config,
            save_config_to_file,
            load_config_from_file,
            // .nvmrc 支持
            read_nvmrc
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
                                let config_path = get_settings_path().unwrap_or_default();
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
