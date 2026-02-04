import React, { useState, useEffect } from 'react';
import { Card, Switch, Input, Button, Space, Typography, Alert, Tooltip, Spin, message, Tag } from 'antd';
import {
    FolderOpenOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    InfoCircleOutlined,
    ReloadOutlined,
    GlobalOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../context/LanguageContext';

const { Text, Title } = Typography;

interface SharedGlobalConfig {
    enabled: boolean;
    prefixPath: string | null;
    pathConfigured: boolean;
    packageCount: number;
}

const GlobalPackageSettings: React.FC = () => {
    const { t } = useLanguage();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [config, setConfig] = useState<SharedGlobalConfig | null>(null);
    const [defaultPaths, setDefaultPaths] = useState<{ globalPrefix: string } | null>(null);
    const [customPath, setCustomPath] = useState('');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const [sharedConfig, paths] = await Promise.all([
                window.tauriAPI.getSharedPackagesConfig(),
                window.tauriAPI.getDefaultPaths()
            ]);
            setConfig(sharedConfig);
            setDefaultPaths(paths);
            setCustomPath(sharedConfig.prefixPath || paths.globalPrefix);
        } catch (error) {
            console.error('加载配置失败:', error);
            message.error(t('globalPackages.messages.setError'));
        } finally {
            setLoading(false);
        }
    };

    const handleEnableShared = async () => {
        if (!customPath) {
            message.warning(t('globalPackages.selectPath'));
            return;
        }

        try {
            setSaving(true);
            const result = await window.tauriAPI.setGlobalPrefix(customPath);
            if (result.success) {
                message.success(t('globalPackages.messages.setSuccess'));
                await loadConfig();
            } else {
                message.error(result.message || t('globalPackages.messages.setError'));
            }
        } catch (error: any) {
            message.error(error.toString());
        } finally {
            setSaving(false);
        }
    };

    const handleAddToPath = async () => {
        if (!config?.prefixPath) return;

        try {
            setSaving(true);
            const result = await window.tauriAPI.addToUserPath(config.prefixPath);
            if (result.success) {
                message.success(t('globalPackages.messages.pathAddSuccess'));
                await loadConfig();
            } else {
                message.error(result.message || t('globalPackages.messages.pathAddError'));
            }
        } catch (error: any) {
            message.error(error.toString());
        } finally {
            setSaving(false);
        }
    };

    const selectPath = async () => {
        const path = await window.tauriAPI.selectDirectory();
        if (path) {
            setCustomPath(path);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 600 }}>
            {/* 功能说明 */}
            <Alert
                type="info"
                icon={<InfoCircleOutlined />}
                message={t('globalPackages.enableShared')}
                description={t('globalPackages.enableSharedDesc')}
                style={{ marginBottom: 24 }}
            />

            {/* 当前状态卡片 */}
            {config?.enabled && (
                <Card
                    size="small"
                    style={{ marginBottom: 24, background: 'var(--primary-bg)' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Space>
                            <GlobalOutlined style={{ fontSize: 20, color: 'var(--primary-mint)' }} />
                            <div>
                                <Text strong>{t('globalPackages.currentStatus')}</Text>
                                <div>
                                    <Tag color="green">{t('globalPackages.enabled')}</Tag>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {t('globalPackages.packageCount').replace('{count}', String(config.packageCount || 0))}
                                    </Text>
                                </div>
                            </div>
                        </Space>
                        <Button
                            size="small"
                            icon={<ReloadOutlined />}
                            onClick={loadConfig}
                        >
                            {t('common.refresh')}
                        </Button>
                    </div>
                </Card>
            )}

            {/* 路径设置 */}
            <Card
                title={t('globalPackages.sharedPath')}
                size="small"
                style={{ marginBottom: 24 }}
            >
                <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                    <Input
                        value={customPath}
                        onChange={e => setCustomPath(e.target.value)}
                        placeholder={defaultPaths?.globalPrefix}
                        disabled={saving}
                    />
                    <Button
                        icon={<FolderOpenOutlined />}
                        onClick={selectPath}
                        disabled={saving}
                    />
                </Space.Compact>

                {defaultPaths && customPath === defaultPaths.globalPrefix && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        <CheckCircleOutlined style={{ marginRight: 4, color: 'var(--primary-mint)' }} />
                        {t('globalPackages.defaultPathHint')}
                    </Text>
                )}

                <Button
                    type="primary"
                    block
                    loading={saving}
                    onClick={handleEnableShared}
                    style={{ marginTop: 16 }}
                    disabled={!customPath || (config?.enabled && config?.prefixPath === customPath)}
                >
                    {config?.enabled ? t('common.save') : t('globalPackages.enable')}
                </Button>
            </Card>

            {/* PATH 状态 */}
            {config?.enabled && config?.prefixPath && (
                <Card
                    title={t('globalPackages.pathStatus')}
                    size="small"
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: config.pathConfigured ? 0 : 16
                    }}>
                        <Space>
                            {config.pathConfigured ? (
                                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                            ) : (
                                <WarningOutlined style={{ color: '#faad14', fontSize: 18 }} />
                            )}
                            <Text>
                                {config.pathConfigured
                                    ? t('globalPackages.pathConfigured')
                                    : t('globalPackages.pathNotConfigured')
                                }
                            </Text>
                        </Space>

                        {!config.pathConfigured && (
                            <Button
                                type="primary"
                                size="small"
                                loading={saving}
                                onClick={handleAddToPath}
                            >
                                {t('globalPackages.addToPath')}
                            </Button>
                        )}
                    </div>

                    {!config.pathConfigured && (
                        <Alert
                            type="warning"
                            message={t('globalPackages.pathAddDesc')}
                            style={{ fontSize: 12 }}
                        />
                    )}
                </Card>
            )}
        </div>
    );
};

export default GlobalPackageSettings;
