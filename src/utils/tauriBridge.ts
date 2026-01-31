import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { TauriAPI } from '../types/tauri';

const tauriBridge: TauriAPI = {
    // 版本管理
    getInstalledVersions: () => invoke('get_installed_versions'),
    getActiveVersion: () => invoke('get_active_version'),
    getVersionSize: (path: string) => invoke('get_version_size', { path }),
    getAvailableVersionsDetailed: () => invoke('get_available_versions'),
    getMajorVersions: async () => {
        const versions: any[] = await invoke('get_available_versions');
        const majorMap = new Map();

        // 按版本号从高到低排序，确保第一个遇到的是该主版本的最新版
        const sorted = [...versions].sort((a, b) => {
            const cleanA = a.version.startsWith('v') ? a.version.substring(1) : a.version;
            const cleanB = b.version.startsWith('v') ? b.version.substring(1) : b.version;
            const vA = cleanA.split('.').map(Number);
            const vB = cleanB.split('.').map(Number);
            for (let i = 0; i < 3; i++) {
                if ((vA[i] || 0) !== (vB[i] || 0)) return (vB[i] || 0) - (vA[i] || 0);
            }
            return 0;
        });

        sorted.forEach(v => {
            const cleanVersion = v.version.startsWith('v') ? v.version.substring(1) : v.version;
            const majorStr = cleanVersion.split('.')[0];
            const majorNum = parseInt(majorStr);

            if (!isNaN(majorNum) && !majorMap.has(majorNum)) {
                majorMap.set(majorNum, {
                    major: majorNum,
                    latest: v.version,
                    lts: v.lts && v.lts !== false,
                    ltsName: typeof v.lts === 'string' ? v.lts : undefined,
                    releaseDate: v.date
                });
            }
        });

        // 只返回最近的几个大版本 (14+)
        return Array.from(majorMap.values()).filter((m: any) => m.major >= 14);
    },
    switchVersion: async (version: string) => {
        try {
            const success = await invoke('switch_version', { version });
            return { success: !!success, message: success ? '切换成功' : '切换失败' };
        } catch (e: any) {
            return { success: false, message: e.toString() };
        }
    },
    installVersion: async (version: string) => {
        try {
            const success = await invoke('install_version', { version });
            return { success: !!success, message: success ? '安装成功' : '安装失败' };
        } catch (e: any) {
            return { success: false, message: e.toString() };
        }
    },
    uninstallVersion: async (version: string) => {
        try {
            const success = await invoke('uninstall_version', { version });
            return { success: !!success, message: success ? '卸载成功' : '卸载失败' };
        } catch (e: any) {
            return { success: false, message: e.toString() };
        }
    },
    onInstallProgress: (callback: (progress: number, status: string) => void) => {
        listen('install:progress', (event: any) => {
            const { progress, status } = event.payload;
            callback(progress, status);
        });
    },
    getTotalSize: () => invoke('get_total_size'),

    // 依赖管理
    getGlobalPackages: () => invoke('get_global_packages'),
    checkOutdatedPackages: () => invoke('check_outdated_packages'),
    installGlobalPackage: async (name: string) => {
        try {
            const success = await invoke('install_global_package', { name });
            return { success: !!success, message: success ? '安装成功' : '安装失败' };
        } catch (e: any) {
            return { success: false, message: e.toString() };
        }
    },
    uninstallGlobalPackage: async (name: string) => {
        try {
            const success = await invoke('uninstall_global_package', { name });
            return { success: !!success, message: success ? '卸载成功' : '卸载失败' };
        } catch (e: any) {
            return { success: false, message: e.toString() };
        }
    },
    updateGlobalPackage: async (name: string) => {
        try {
            const success = await invoke('update_global_package', { name });
            return { success: !!success, message: success ? '更新成功' : '更新失败' };
        } catch (e: any) {
            return { success: false, message: e.toString() };
        }
    },
    searchPackages: (query: string, page?: number, size?: number) => invoke('search_packages', { query, page, size }),

    // 配置与系统
    getConfig: () => invoke('get_config'),
    setNvmPath: async (path: string) => {
        const config: any = await invoke('get_config');
        config.nvmPath = path;
        return invoke('set_config', { newConfig: config });
    },
    validatePath: (path: string) => invoke('validate_path', { path }),
    selectDirectory: () => invoke('select_directory'),

    // 镜像设置
    getMirrorPresets: () => invoke('get_mirror_presets'),
    getCurrentMirror: () => invoke('get_current_mirror'),
    getArch: () => invoke('get_arch'),
    switchMirrorPreset: async (presetId: string) => {
        const config: any = await invoke('get_config');
        const presets: any[] = await invoke('get_mirror_presets');
        const preset = presets.find(p => p.id === presetId);
        if (preset) {
            config.nodeMirror = preset.nodeUrl;
            config.npmMirror = preset.npmUrl;
            await invoke('set_config', { newConfig: config });
            return { success: true, message: '切换成功' };
        }
        return { success: false, message: '未找到预设' };
    },
    setCustomMirror: async (nodeUrl: string, npmUrl: string) => {
        const config: any = await invoke('get_config');
        config.nodeMirror = nodeUrl;
        config.npmMirror = npmUrl;
        await invoke('set_config', { newConfig: config });
        return { success: true, message: '设置成功' };
    },
    testAllMirrorSpeed: () => invoke('test_all_mirror_speed'),
    setArch: (arch: '32' | '64') => invoke('set_arch', { arch }),
    refreshTray: () => invoke('refresh_tray'),
};

// 注入全局对象
if (typeof window !== 'undefined') {
    try {
        Object.defineProperty(window, 'tauriAPI', {
            value: tauriBridge,
            writable: false,
            configurable: true
        });
    } catch (e) {
        console.error('Failed to inject tauriAPI:', e);
        (window as any).tauriAPI = tauriBridge;
    }
}
