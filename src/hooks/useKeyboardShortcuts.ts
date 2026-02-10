import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
    onRefresh?: () => void;
    onInstall?: () => void;
    onNavigateVersions?: () => void;
    onNavigatePackages?: () => void;
    onNavigateSettings?: () => void;
}

export const useKeyboardShortcuts = (config: ShortcutConfig) => {
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // 忽略输入框中的按键
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }

        const { ctrlKey, key } = event;

        if (ctrlKey) {
            switch (key.toLowerCase()) {
                case 'r':
                    // Ctrl+R: 刷新
                    event.preventDefault();
                    config.onRefresh?.();
                    break;
                case 'n':
                    // Ctrl+N: 安装新版本
                    event.preventDefault();
                    config.onInstall?.();
                    break;
                case '1':
                    // Ctrl+1: 环境管理
                    event.preventDefault();
                    config.onNavigateVersions?.();
                    break;
                case '2':
                    // Ctrl+2: 全局包管理
                    event.preventDefault();
                    config.onNavigatePackages?.();
                    break;
                case '3':
                    // Ctrl+3: 设置中心
                    event.preventDefault();
                    config.onNavigateSettings?.();
                    break;
            }
        }
    }, [config]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);
};
