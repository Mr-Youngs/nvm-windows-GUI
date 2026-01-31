import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLanguage } from './LanguageContext';

interface Config {
    nvmPath: string;
    nvmSymlink: string;
    lastUpdated: string;
    closeAction: 'ask' | 'quit' | 'hide';
}

interface NodeVersion {
    version: string;
    path: string;
    isActive: boolean;
    installedDate: string;
    size?: number;
}

interface Package {
    name: string;
    version: string;
    path: string;
}

interface AppState {
    config: Config | null;
    versions: NodeVersion[];
    activeVersion: string | null;
    globalPackages: Package[];
    loading: boolean;
    currentView: 'versions' | 'packages' | 'settings';
    error: string | null;
}

interface AppContextType {
    state: AppState;
    loadConfig: () => Promise<void>;
    loadVersions: () => Promise<void>;
    loadGlobalPackages: () => Promise<void>;
    switchVersion: (version: string) => Promise<boolean>;
    installVersion: (version: string) => Promise<boolean>;
    uninstallVersion: (version: string) => Promise<boolean>;
    setCurrentView: (view: 'versions' | 'packages' | 'settings') => void;
    setError: (error: string | null) => void;
    selectNvmPath: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { t } = useLanguage();
    const [state, setState] = useState<AppState>({
        config: null,
        versions: [],
        activeVersion: null,
        globalPackages: [],
        loading: false,
        currentView: 'versions',
        error: null
    });

    const setLoading = (loading: boolean) => {
        setState(prev => ({ ...prev, loading }));
    };

    const setError = (error: string | null) => {
        setState(prev => ({ ...prev, error }));
    };

    const loadConfig = async () => {
        try {
            const config = await window.tauriAPI.getConfig();
            setState(prev => ({ ...prev, config }));
        } catch (error) {
            setError(error instanceof Error ? error.message : t('settings.mirror.messages.loadError'));
        }
    };

    const loadVersions = async () => {
        try {
            setLoading(true);
            const versions = await window.tauriAPI.getInstalledVersions();
            const activeVersion = await window.tauriAPI.getActiveVersion();
            setState(prev => ({ ...prev, versions, activeVersion }));
        } catch (error) {
            setError(error instanceof Error ? error.message : t('versionList.messages.loadError'));
        } finally {
            setLoading(false);
        }
    };

    const loadGlobalPackages = async () => {
        try {
            setLoading(true);
            const globalPackages = await window.tauriAPI.getGlobalPackages();
            setState(prev => ({ ...prev, globalPackages }));
        } catch (error) {
            setError(error instanceof Error ? error.message : t('packages.messages.loadError'));
        } finally {
            setLoading(false);
        }
    };

    const switchVersion = async (version: string): Promise<boolean> => {
        try {
            setLoading(true);
            const result = await window.tauriAPI.switchVersion(version);
            if (result.success) {
                await loadVersions();
                await loadGlobalPackages(); // 切换版本后刷新全局包
                await window.tauriAPI.refreshTray();
                return true;
            } else {
                setError(result.message);
                return false;
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : t('versionList.messages.switchError'));
            return false;
        } finally {
            setLoading(false);
        }
    };

    const installVersion = async (version: string): Promise<boolean> => {
        try {
            setLoading(true);
            const result = await window.tauriAPI.installVersion(version);
            if (result.success) {
                await loadVersions();
                await window.tauriAPI.refreshTray();
                return true;
            } else {
                setError(result.message);
                return false;
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : t('versionList.messages.installError'));
            return false;
        } finally {
            setLoading(false);
        }
    };

    const uninstallVersion = async (version: string): Promise<boolean> => {
        try {
            setLoading(true);
            const result = await window.tauriAPI.uninstallVersion(version);
            if (result.success) {
                await loadVersions();
                await window.tauriAPI.refreshTray();
                return true;
            } else {
                setError(result.message);
                return false;
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : t('versionList.messages.switchError'));
            return false;
        } finally {
            setLoading(false);
        }
    };

    const setCurrentView = (view: 'versions' | 'packages' | 'settings') => {
        setState(prev => ({ ...prev, currentView: view }));
    };

    const selectNvmPath = async () => {
        try {
            const path = await window.tauriAPI.selectDirectory();
            if (path) {
                const validation = await window.tauriAPI.validatePath(path);
                if (validation.valid) {
                    const success = await window.tauriAPI.setNvmPath(path);
                    if (success) {
                        await loadVersions();
                    }
                } else {
                    setError(validation.error || t('settings.mirror.messages.loadError'));
                }
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : t('settings.mirror.messages.saveError'));
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const contextValue: AppContextType = {
        state,
        loadConfig,
        loadVersions,
        loadGlobalPackages,
        switchVersion,
        installVersion,
        uninstallVersion,
        setCurrentView,
        setError,
        selectNvmPath
    };

    return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within AppProvider');
    }
    return context;
};
