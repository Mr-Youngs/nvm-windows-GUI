import { Layout, Menu, Alert, Button, Space, Tooltip } from 'antd';
import {
    AppstoreOutlined,
    FolderOutlined,
    SettingOutlined,
    SunOutlined,
    MoonOutlined,
    TranslationOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import logoImage from '../../assets/logo.png';

const { Sider, Content } = Layout;

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { state, setCurrentView, setError } = useApp();
    const { theme, toggleTheme } = useTheme();
    const { language, setLanguage, t } = useLanguage();
    const [collapsed, setCollapsed] = React.useState(false);

    const menuItems = [
        {
            key: 'versions',
            icon: <AppstoreOutlined style={{ fontSize: 18 }} />,
            label: t('sidebar.versions')
        },
        {
            key: 'packages',
            icon: <FolderOutlined style={{ fontSize: 18 }} />,
            label: t('sidebar.packages')
        },
        {
            key: 'settings',
            icon: <SettingOutlined style={{ fontSize: 18 }} />,
            label: t('sidebar.settings')
        }
    ];

    const handleMenuClick = (e: { key: string }) => {
        setCurrentView(e.key as 'versions' | 'packages' | 'settings');
    };

    return (
        <Layout style={{ height: '100vh', background: 'var(--bg-app)' }}>
            <Sider
                collapsible
                collapsed={collapsed}
                onCollapse={(value) => setCollapsed(value)}
                width={200}
                collapsedWidth={80}
                className="glass-sidebar"
                style={{
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    zIndex: 1000
                }}
            >
                <div style={{
                    padding: collapsed ? '24px 0' : '24px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 12,
                    marginBottom: 20,
                    transition: 'all 0.2s'
                }}>
                    <img
                        src={logoImage}
                        alt="NVM GUI"
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            objectFit: 'contain',
                            flexShrink: 0
                        }}
                    />
                    {!collapsed && (
                        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', letterSpacing: -0.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                            NVM GUI
                        </span>
                    )}
                </div>

                <Menu
                    mode="inline"
                    selectedKeys={[state.currentView]}
                    items={menuItems}
                    onClick={handleMenuClick}
                    style={{ padding: collapsed ? '0' : '0 8px', borderRight: 0, background: 'transparent' }}
                />

                <div style={{
                    position: 'absolute',
                    bottom: 80,
                    left: 0,
                    right: 0,
                    padding: collapsed ? '0 12px' : '0 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12
                }}>
                    <Tooltip title={theme === 'light' ? t('settings.theme.switchToDark') : t('settings.theme.switchToLight')} placement="right">
                        <Button
                            type="text"
                            icon={theme === 'light' ? <MoonOutlined style={{ fontSize: 18 }} /> : <SunOutlined style={{ fontSize: 18, color: 'var(--color-yellow-primary)' }} />}
                            onClick={toggleTheme}
                            style={{
                                width: collapsed ? 40 : '100%',
                                height: 40,
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: theme === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
                                color: 'var(--text-sec)',
                                transition: 'all 0.3s'
                            }}
                            className="theme-toggle-btn"
                        >
                            {!collapsed && <span style={{ marginLeft: 8, fontWeight: 600 }}>{theme === 'light' ? t('settings.theme.dark') : t('settings.theme.light')}</span>}
                        </Button>
                    </Tooltip>

                    <Tooltip title={language === 'en' ? t('common.switchToChinese') : t('common.switchToEnglish')} placement="right">
                        <Button
                            type="text"
                            icon={<TranslationOutlined style={{ fontSize: 18, color: 'var(--color-blue-primary)' }} />}
                            onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                            style={{
                                width: collapsed ? 40 : '100%',
                                height: 40,
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(9, 132, 227, 0.05)',
                                color: 'var(--text-sec)',
                                transition: 'all 0.3s'
                            }}
                        >
                            {!collapsed && <span style={{ marginLeft: 8, fontWeight: 600 }}>{language === 'en' ? 'English' : '中文'}</span>}
                        </Button>
                    </Tooltip>

                    {!collapsed && (
                        <div style={{
                            padding: '4px 12px',
                            borderRadius: 8,
                            fontSize: 11,
                            color: 'var(--text-sec)',
                            opacity: 0.5,
                            letterSpacing: 1
                        }}>
                            v1.0.0 STABLE
                        </div>
                    )}
                </div>
            </Sider>

            <Layout style={{
                marginLeft: collapsed ? 80 : 200,
                minHeight: '100vh',
                background: 'transparent',
                transition: 'margin-left 0.2s'
            }}>
                <Content style={{ padding: '32px 40px', height: '100vh', overflowY: 'auto' }}>
                    {state.error && (
                        <Alert
                            message={state.error}
                            type="error"
                            showIcon
                            closable
                            onClose={() => setError(null)}
                            style={{ marginBottom: 24, borderRadius: 12 }}
                        />
                    )}
                    <div style={{ maxWidth: 900, margin: '0 auto' }}>
                        {children}
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default MainLayout;
