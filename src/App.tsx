import React, { useState } from 'react';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import enUS from 'antd/es/locale/en_US';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import MainLayout from './components/Layout/MainLayout';
import ConfigWizard from './components/Config/ConfigWizard';
import VersionList from './components/Version/VersionList';
import VersionInstall from './components/Version/VersionInstall';

const SettingsPage = React.lazy(() => import('./components/Settings/SettingsPage'));
const GlobalPackages = React.lazy(() => import('./components/Package/GlobalPackages'));

const LoadingFallback: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '40px' }}>
            <Spin size="large" tip={t('common.loading')} />
        </div>
    );
};

const AppContent: React.FC = () => {
    const { state } = useApp();
    const { isDark } = useTheme();
    const [installModalVisible, setInstallModalVisible] = useState(false);

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
        <>
            <div className="bg-glow-container">
                <div className="bg-glow-orb orb-1"></div>
                <div className="bg-glow-orb orb-2"></div>
                <div className="bg-glow-orb orb-3"></div>
            </div>
            {!state.config || !state.config.nvmPath ? (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                }}>
                    <ConfigWizard />
                </div>
            ) : (
                <MainLayout>
                    {renderContent()}
                </MainLayout>
            )}
        </>
    );
};

const AppWrapper: React.FC = () => {
    const { language } = useLanguage();
    const antLocale = language === 'zh' ? zhCN : enUS;

    return (
        <ConfigProvider locale={antLocale}>
            <ThemeProvider>
                <AppProvider>
                    <AppContent />
                </AppProvider>
            </ThemeProvider>
        </ConfigProvider>
    );
};

const App: React.FC = () => {
    return (
        <LanguageProvider>
            <AppWrapper />
        </LanguageProvider>
    );
};

export default App;
