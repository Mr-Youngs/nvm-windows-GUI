import React, { useState } from 'react';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import MainLayout from './components/Layout/MainLayout';
import ConfigWizard from './components/Config/ConfigWizard';
import VersionList from './components/Version/VersionList';
import VersionInstall from './components/Version/VersionInstall';

const SettingsPage = React.lazy(() => import('./components/Settings/SettingsPage'));
const GlobalPackages = React.lazy(() => import('./components/Package/GlobalPackages'));

const LoadingFallback: React.FC = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '40px' }}>
        <Spin size="large" tip="加载中..." />
    </div>
);

const AppContent: React.FC = () => {
    const { state } = useApp();
    const { isDark } = useTheme();
    const [installModalVisible, setInstallModalVisible] = useState(false);

    // 如果未配置，显示配置向导
    if (!state.config || !state.config.nvmPath) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: isDark ? '#141414' : '#f0f2f5'
            }}>
                <ConfigWizard />
            </div>
        );
    }

    const renderContent = () => {
        switch (state.currentView) {
            case 'versions':
                return (
                    <>
                        <VersionList />
                        <VersionInstall
                            visible={installModalVisible}
                            onClose={() => setInstallModalVisible(false)}
                        />
                    </>
                );
            case 'packages':
                return (
                    <React.Suspense fallback={<LoadingFallback />}>
                        <GlobalPackages />
                    </React.Suspense>
                );
            case 'settings':
                return (
                    <React.Suspense fallback={<LoadingFallback />}>
                        <SettingsPage />
                    </React.Suspense>
                );
            default:
                return <VersionList />;
        }
    };

    return (
        <MainLayout>
            {renderContent()}
        </MainLayout>
    );
};

const App: React.FC = () => {
    return (
        <ConfigProvider locale={zhCN}>
            <ThemeProvider>
                <AppProvider>
                    <AppContent />
                </AppProvider>
            </ThemeProvider>
        </ConfigProvider>
    );
};

export default App;
