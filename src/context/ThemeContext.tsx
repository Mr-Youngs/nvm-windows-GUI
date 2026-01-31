import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    theme: ThemeMode;
    isDark: boolean;
    setTheme: (theme: ThemeMode) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'nvm-gui-theme';

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeMode>('light');
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
        if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
            setThemeState(savedTheme);
        } else {
            setThemeState('light');
        }
    }, []);

    useEffect(() => {
        setIsDark(theme === 'dark');
    }, [theme]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    const setTheme = (newTheme: ThemeMode) => {
        setThemeState(newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    };

    const toggleTheme = () => {
        setTheme(isDark ? 'light' : 'dark');
    };

    return (
        <ThemeContext.Provider value={{ theme, isDark, setTheme, toggleTheme }}>
            <ConfigProvider
                theme={{
                    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                    token: {
                        // Premium Blue Primary Color
                        colorPrimary: '#0984e3',
                        colorSuccess: '#00b894',
                        colorWarning: '#fdcb6e',
                        colorError: '#ff7675',
                        colorInfo: '#74b9ff',

                        // Refined Radius
                        borderRadius: 10,
                        borderRadiusLG: 14,

                        // Typography
                        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    },
                    components: {
                        Card: {
                            colorBgContainer: isDark ? 'rgba(45, 45, 45, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                        },
                        Layout: {
                            colorBgHeader: 'transparent',
                            colorBgBody: 'transparent',
                        },
                        Button: {
                            borderRadius: 8,
                            controlHeight: 36,
                            fontWeight: 500,
                        },
                        Menu: {
                            itemHeight: 44,
                            itemBorderRadius: 8,
                            activeBarBorderWidth: 0,
                        }
                    },
                }}
            >
                {children}
            </ConfigProvider>
        </ThemeContext.Provider>
    );
};

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
