import React from 'react';
import { Card, Form, Input, Button, Space, Typography, Divider, Tabs, Radio } from 'antd';
import { FolderOpenOutlined, GlobalOutlined, SettingOutlined, BgColorsOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import MirrorSettings from './MirrorSettings';

const { Title, Text } = Typography;

const SettingsPage: React.FC = () => {
    const { state, selectNvmPath } = useApp();
    const { theme, setTheme } = useTheme();

    const generalSettings = (
        <div style={{ maxWidth: 600 }}>
            <Form layout="vertical">
                <Form.Item label="nvm-windows 安装路径">
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            value={state.config?.nvmPath || ''}
                            readOnly
                            placeholder="未配置"
                        />
                        <Button
                            icon={<FolderOpenOutlined />}
                            onClick={selectNvmPath}
                        >
                            选择
                        </Button>
                    </Space.Compact>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        nvm-windows 的安装根目录
                    </Text>
                </Form.Item>

                <Form.Item label="Node.js 符号链接路径">
                    <Input
                        value={state.config?.nvmSymlink || ''}
                        readOnly
                        placeholder="未配置"
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        当前激活的 Node.js 版本的符号链接路径
                    </Text>
                </Form.Item>

                <Form.Item label="最后更新时间">
                    <Input
                        value={state.config?.lastUpdated ? new Date(state.config.lastUpdated).toLocaleString() : ''}
                        readOnly
                        placeholder="未配置"
                    />
                </Form.Item>
            </Form>

            <Divider />

            <Space direction="vertical" style={{ width: '100%' }}>
                <Title level={5}>关于</Title>
                <Text>nvm-windows GUI v1.0.0</Text>
                <Text type="secondary">
                    一个为 nvm-windows 提供图形化界面的桌面应用程序
                </Text>
            </Space>
        </div>
    );

    const themeSettings = (
        <div style={{ maxWidth: 600 }}>
            <Form layout="vertical">
                <Form.Item label="主题模式">
                    <Radio.Group
                        value={theme}
                        onChange={(e) => setTheme(e.target.value as ThemeMode)}
                    >
                        <Space direction="horizontal" size="large">
                            <Radio value="light">浅色模式</Radio>
                            <Radio value="dark">深色模式</Radio>
                        </Space>
                    </Radio.Group>
                </Form.Item>
            </Form>
        </div>
    );

    const tabItems = [
        {
            key: 'general',
            label: (
                <span>
                    <SettingOutlined />
                    常规设置
                </span>
            ),
            children: generalSettings
        },
        {
            key: 'mirror',
            label: (
                <span>
                    <GlobalOutlined />
                    镜像源
                </span>
            ),
            children: <MirrorSettings />
        },
        {
            key: 'theme',
            label: (
                <span>
                    <BgColorsOutlined />
                    外观
                </span>
            ),
            children: themeSettings
        }
    ];

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <Card>
                <Title level={3}>设置</Title>
                <Tabs items={tabItems} />
            </Card>
        </div>
    );
};

export default SettingsPage;
