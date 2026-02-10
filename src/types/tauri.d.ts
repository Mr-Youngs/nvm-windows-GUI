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
    onInstallProgress: (callback: (data: { version: string, progress: number, status: string, finished?: boolean, error?: string, isPaused?: boolean }) => void) => Promise<any>;
    pauseDownload: (version: string) => Promise<boolean>;
    resumeDownload: (version: string) => Promise<boolean>;
    cancelDownload: (version: string) => Promise<boolean>;
    getTotalSize: () => Promise<number>;

    // 依赖管理
    getGlobalPackages: () => Promise<any[]>;
    checkOutdatedPackages: () => Promise<any[]>;
    installGlobalPackage: (name: string, version?: string) => Promise<{ success: boolean; message: string }>;
    uninstallGlobalPackage: (name: string) => Promise<{ success: boolean; message: string }>;
    updateGlobalPackage: (name: string) => Promise<{ success: boolean; message: string }>;
    searchPackages: (query: string, page?: number, size?: number) => Promise<any>;
    getPackageVersions: (packageName: string) => Promise<{
        name: string;
        description: string;
        distTags: Record<string, string>;
        versions: Array<{ version: string; deprecated: boolean; publishedAt: string | null }>;
        totalVersions: number;
    }>;

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

    // NVM 安装相关
    checkNvmInstallation: () => Promise<{
        installed: boolean;
        nvmHome: string | null;
        nvmSymlink: string | null;
        version: string | null;
    }>;
    getNvmLatestRelease: () => Promise<{
        tag_name: string;
        name: string;
        assets: Array<{ name: string; browser_download_url: string; size: number }>;
    }>;
    downloadAndInstallNvm: (targetDir: string, symlinkDir: string) => Promise<{ success: boolean; message: string }>;
    getDefaultPaths: () => Promise<{ nvmHome: string; nvmSymlink: string; globalPrefix: string }>;
    onNvmInstallProgress: (callback: (progress: number, status: string) => void) => void;

    // 共享全局包相关
    getGlobalPrefix: () => Promise<string | null>;
    setGlobalPrefix: (path: string) => Promise<{ success: boolean; message: string }>;
    getSharedPackagesConfig: () => Promise<{
        enabled: boolean;
        prefixPath: string | null;
        pathConfigured: boolean;
        packageCount: number;
    }>;
    checkPathContains: (path: string) => Promise<boolean>;
    addToUserPath: (path: string) => Promise<{ success: boolean; message: string }>;

    // 更新检查
    checkForUpdates: () => Promise<{
        hasUpdate: boolean;
        currentVersion: string;
        latestVersion: string;
        releaseUrl: string;
        releaseNotes: string;
        publishedAt: string;
    }>;

    // 导入导出
    exportConfig: () => Promise<string>;
    importConfig: (jsonData: string) => Promise<boolean>;
    saveConfigToFile: (filePath: string) => Promise<boolean>;
    loadConfigFromFile: (filePath: string) => Promise<string>;

    // .nvmrc 支持
    readNvmrc: (dirPath: string) => Promise<{
        version: string;
        source: string;
        path: string;
    } | null>;
}

declare global {
    interface Window {
        tauriAPI: TauriAPI;
    }
}
