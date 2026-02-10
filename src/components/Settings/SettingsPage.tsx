import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Input, Button, Space, Typography, Divider, Tabs, Segmented, Tag, message } from 'antd';
import {
    FolderOpenOutlined,
    GlobalOutlined,
    SettingOutlined,
    BgColorsOutlined,
    InfoCircleOutlined,
    SunOutlined,
    MoonOutlined,
    AppstoreOutlined,
    CloudSyncOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import MirrorSettings from './MirrorSettings';
import GlobalPackageSettings from './GlobalPackageSettings';

const { Title, Text } = Typography;

const SettingsPage: React.FC = () => {
    const { state, selectNvmPath } = useApp();
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<{
        hasUpdate: boolean;
        currentVersion: string;
        latestVersion: string;
        releaseUrl: string;
    } | null>(null);

    const handleCheckUpdate = async () => {
        try {
            setCheckingUpdate(true);
            const info = await window.tauriAPI.checkForUpdates();
            setUpdateInfo(info);
            if (!info.hasUpdate) {
                message.success(t('settings.update.noUpdate'));
            }
        } catch (error) {
            message.error(t('settings.update.checkFailed'));
        } finally {
            setCheckingUpdate(false);
        }
    };

    const generalSettings = (
        <div style={{ maxWidth: 600 }}>
            <Form layout="vertical">
                <Form.Item label={t('settings.nvmPath')}>
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            value={state.config?.nvmPath || ''}
                            readOnly
                            placeholder={t('settings.selectPathTip')}
                            style={{ background: 'rgba(0,0,0,0.02)' }}
                        />
                        <Button
                            icon={<FolderOpenOutlined />}
                            onClick={selectNvmPath}
                        >
                            {t('common.select')}
                        </Button>
                    </Space.Compact>
                </Form.Item>

                <Form.Item label={t('settings.nvmSymlink')}>
                    <Input
                        value={state.config?.nvmSymlink || ''}
                        readOnly
                        style={{ background: 'rgba(0,0,0,0.02)' }}
                    />
                </Form.Item>
            </Form>

            <Divider dashed />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t('settings.appVersion')}</Text>
                    <div style={{ fontWeight: 600 }}>v{updateInfo?.currentVersion || '0.3.0'}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t('settings.lastUpdated')}</Text>
                    <div style={{ fontWeight: 600 }}>
                        {state.config?.lastUpdated ? new Date(state.config.lastUpdated).toLocaleDateString() : t('settings.neverSynced')}
                    </div>
                </div>
            </div>

            <Divider dashed />

            {/* Update Check Section */}
            <div style={{
                padding: 16,
                borderRadius: 10,
                background: updateInfo?.hasUpdate ? 'rgba(250, 173, 20, 0.1)' : 'rgba(0,0,0,0.02)',
                border: updateInfo?.hasUpdate ? '1px solid rgba(250, 173, 20, 0.3)' : '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <Space>
                    {updateInfo?.hasUpdate ? (
                        <ExclamationCircleOutlined style={{ fontSize: 20, color: '#faad14' }} />
                    ) : (
                        <CloudSyncOutlined style={{ fontSize: 20, color: 'var(--color-blue-primary)' }} />
                    )}
                    <div>
                        <Text strong>{t('settings.update.title')}</Text>
                        {updateInfo && (
                            <div style={{ fontSize: 12, color: 'var(--text-sec)' }}>
                                {updateInfo.hasUpdate ? (
                                    <Space>
                                        <span>{t('settings.update.latestVersion')}: v{updateInfo.latestVersion}</span>
                                        <Tag color="warning" bordered={false}>{t('settings.update.hasUpdate')}</Tag>
                                    </Space>
                                ) : (
                                    <Space>
                                        <CheckCircleOutlined style={{ color: 'var(--color-green-primary)' }} />
                                        <span>{t('settings.update.noUpdate')}</span>
                                    </Space>
                                )}
                            </div>
                        )}
                    </div>
                </Space>
                <Space>
                    {updateInfo?.hasUpdate && (
                        <Button
                            type="primary"
                            onClick={() => window.open(updateInfo.releaseUrl, '_blank')}
                        >
                            {t('settings.update.download')}
                        </Button>
                    )}
                    <Button
                        icon={<CloudSyncOutlined />}
                        loading={checkingUpdate}
                        onClick={handleCheckUpdate}
                    >
                        {checkingUpdate ? t('settings.update.checking') : t('settings.update.title')}
                    </Button>
                </Space>
            </div>

            <Divider dashed />

            {/* Import/Export Section */}
            <div style={{
                padding: 16,
                borderRadius: 10,
                background: 'rgba(0,0,0,0.02)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <Space>
                    <SettingOutlined style={{ fontSize: 20, color: 'var(--color-blue-primary)' }} />
                    <div>
                        <Text strong>{t('settings.importExport.title')}</Text>
                        <div style={{ fontSize: 12, color: 'var(--text-sec)' }}>
                            {t('settings.importExport.export')} / {t('settings.importExport.import')}
                        </div>
                    </div>
                </Space>
                <Space>
                    <Button
                        onClick={async () => {
                            try {
                                const { save } = await import('@tauri-apps/plugin-dialog');
                                const filePath = await save({
                                    filters: [{
                                        name: 'JSON',
                                        extensions: ['json']
                                    }],
                                    defaultPath: `nvm-gui-config-${new Date().toISOString().split('T')[0]}.json`
                                });
                                if (filePath) {
                                    await window.tauriAPI.saveConfigToFile(filePath);
                                    message.success(t('settings.importExport.exportSuccess'));
                                }
                            } catch {
                                message.error(t('settings.importExport.exportFailed'));
                            }
                        }}
                    >
                        {t('settings.importExport.export')}
                    </Button>
                    <Button
                        onClick={async () => {
                            try {
                                const { open } = await import('@tauri-apps/plugin-dialog');
                                const filePath = await open({
                                    filters: [{
                                        name: 'JSON',
                                        extensions: ['json']
                                    }],
                                    multiple: false
                                });
                                if (filePath && typeof filePath === 'string') {
                                    const content = await window.tauriAPI.loadConfigFromFile(filePath);
                                    await window.tauriAPI.importConfig(content);
                                    message.success(t('settings.importExport.importSuccess'));
                                }
                            } catch {
                                message.error(t('settings.importExport.importFailed'));
                            }
                        }}
                    >
                        {t('settings.importExport.import')}
                    </Button>
                </Space>
            </div>
        </div>
    );


    const tabItems = [
        {
            key: 'general',
            label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <SettingOutlined />
                    {t('settings.tabs.general')}
                </span>
            ),
            children: generalSettings
        },
        {
            key: 'mirror',
            label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GlobalOutlined />
                    {t('settings.tabs.mirror')}
                </span>
            ),
            children: <MirrorSettings />
        },
        {
            key: 'globalPackages',
            label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AppstoreOutlined />
                    {t('globalPackages.title')}
                </span>
            ),
            children: <GlobalPackageSettings />
        }
    ];

    return (
        <Card className="glass-card">
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <SettingOutlined style={{ fontSize: 24, color: 'var(--color-blue-primary)' }} />
                <Title level={4} style={{ margin: 0, fontWeight: 700 }}>{t('settings.title')}</Title>
            </div>
            <Tabs
                items={tabItems}
                tabBarGutter={32}
                style={{ marginTop: -8 }}
            />
        </Card>
    );
};

export default SettingsPage;
