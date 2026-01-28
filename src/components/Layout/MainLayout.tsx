import { Layout, Menu, Alert, theme, Button, Drawer } from 'antd';
import { AppstoreOutlined, FolderOutlined, SettingOutlined, MenuOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';

const { Header, Content } = Layout;
const { useToken } = theme;

interface MainLayoutProps {
    children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { state, setCurrentView, setError } = useApp();
    const { token } = useToken();
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // 监听窗口大小以判断移动端
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const menuItems = [
        {
            key: 'versions',
            icon: <AppstoreOutlined />,
            label: '版本管理'
        },
        {
            key: 'packages',
            icon: <FolderOutlined />,
            label: '全局包管理'
        },
        {
            key: 'settings',
            icon: <SettingOutlined />,
            label: '设置'
        }
    ];

    const handleMenuClick = (e: { key: string }) => {
        setCurrentView(e.key as 'versions' | 'packages' | 'settings');
        if (isMobile) {
            setDrawerVisible(false);
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
            <Header style={{
                background: token.colorBgContainer,
                padding: '0 20px',
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                width: '100%'
            }}>
                <div style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: token.colorPrimary,
                    whiteSpace: 'nowrap',
                    marginRight: 20
                }}>
                    nvm GUI
                </div>

                {isMobile ? (
                    <>
                        <Button
                            type="text"
                            icon={<MenuOutlined />}
                            onClick={() => setDrawerVisible(true)}
                            style={{ fontSize: '16px' }}
                        />
                        <Drawer
                            title="菜单"
                            placement="right"
                            onClose={() => setDrawerVisible(false)}
                            open={drawerVisible}
                            styles={{ body: { padding: 0 } }}
                        >
                            <Menu
                                mode="inline"
                                selectedKeys={[state.currentView]}
                                items={menuItems}
                                onClick={handleMenuClick}
                                style={{ border: 'none' }}
                            />
                        </Drawer>
                    </>
                ) : (
                    <Menu
                        mode="horizontal"
                        selectedKeys={[state.currentView]}
                        items={menuItems}
                        onClick={handleMenuClick}
                        style={{
                            border: 'none',
                            flex: 1,
                            justifyContent: 'flex-end',
                            background: 'transparent'
                        }}
                    />
                )}
            </Header>
            <Content style={{
                padding: isMobile ? '12px' : '24px',
                minHeight: 'calc(100vh - 64px)',
                background: token.colorBgLayout
            }}>
                {state.error && (
                    <Alert
                        message="错误"
                        description={state.error}
                        type="error"
                        closable
                        onClose={() => setError(null)}
                        style={{ marginBottom: 16 }}
                    />
                )}
                <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                    {children}
                </div>
            </Content>
        </Layout>
    );
};

export default MainLayout;
