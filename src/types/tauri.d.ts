export interface TauriAPI {
    // 版本管理
    getInstalledVersions: () => Promise<any[]>;
    getActiveVersion: () => Promise<string | null>;
    getVersionSize: (version: string) => Promise<number>;
    getAvailableVersionsDetailed: () => Promise<any[]>;
    getMajorVersions: () => Promise<any[]>;
    switchVersion: (version: string) => Promise<{ success: boolean; message: string }>;
    installVersion: (version: string) => Promise<{ success: boolean; message: string }>;
    uninstallVersion: (version: string) => Promise<{ success: boolean; message: string }>;
    onInstallProgress: (callback: (progress: number, status: string) => void) => void;
    getTotalSize: () => Promise<number>;

    // 依赖管理
    getGlobalPackages: () => Promise<any[]>;
    checkOutdatedPackages: () => Promise<any[]>;
    installGlobalPackage: (name: string) => Promise<{ success: boolean; message: string }>;
    uninstallGlobalPackage: (name: string) => Promise<{ success: boolean; message: string }>;
    updateGlobalPackage: (name: string) => Promise<{ success: boolean; message: string }>;
    searchPackages: (query: string, page?: number, size?: number) => Promise<any>;

    // 配置与系统
    getConfig: () => Promise<any>;
    setNvmPath: (path: string) => Promise<boolean>;
    validatePath: (path: string) => Promise<{ valid: boolean; error?: string }>;
    selectDirectory: () => Promise<string | null>;

    // 镜像设置
    getMirrorPresets: () => Promise<any[]>;
    getCurrentMirror: () => Promise<any>;
    getArch: () => Promise<'32' | '64'>;
    switchMirrorPreset: (presetId: string) => Promise<{ success: boolean; message: string }>;
    setCustomMirror: (nodeUrl: string, npmUrl: string) => Promise<{ success: boolean; message: string }>;
    testAllMirrorSpeed: () => Promise<any[]>;
    setArch: (arch: '32' | '64') => Promise<{ success: boolean; message: string }>;
    refreshTray: () => Promise<void>;
}

declare global {
    interface Window {
        tauriAPI: TauriAPI;
    }
}
