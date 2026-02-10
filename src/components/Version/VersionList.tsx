import React, { useState, useEffect } from 'react';
import {
    List,
    Button,
    Tag,
    Space,
    Typography,
    Tooltip,
    Modal,
    Card,
    Row,
    Col,
    Empty,
    Spin,
    Select,
    Switch,
    message,
    Divider
} from 'antd';
import {
    ReloadOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    SwapOutlined,
    HddOutlined,
    SortAscendingOutlined,
    FilterOutlined,
    DatabaseOutlined,
    AppstoreOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { getMajorVersion, compareVersions } from '../../utils/versionUtils';
import VersionInstall from './VersionInstall';

const { Text, Title } = Typography;
const { confirm } = Modal;

interface NodeVersion {
    version: string;
    path: string;
    isActive: boolean;
    installedDate: string;
    size?: number;
}

const VersionList: React.FC = () => {
    const { state, loadVersions, switchVersion, uninstallVersion } = useApp();
    const { t } = useLanguage();
    const [totalSize, setTotalSize] = useState<number>(0);
    const [installModalVisible, setInstallModalVisible] = useState(false);
    const [sortBy, setSortBy] = useState<'version' | 'date' | 'size'>('version');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showLtsOnly, setShowLtsOnly] = useState(false);

    useEffect(() => {
        loadVersions();
        loadTotalSize();
    }, []);

    const loadTotalSize = async () => {
        try {
            const size = await window.tauriAPI.getTotalSize();
            setTotalSize(size);
        } catch (error) {
            // Ignore error
        }
    };

    const handleSwitch = async (version: string) => {
        const success = await switchVersion(version);
        if (success) {
            message.success(t('versionList.messages.switchSuccess', { version }));
        }
    };

    const handleUninstall = (version: string) => {
        confirm({
            title: t('common.confirm'),
            icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
            content: t('versionList.messages.uninstallConfirm', { version }),
            okText: t('common.uninstall'),
            okType: 'danger',
            cancelText: t('common.cancel'),
            centered: true,
            onOk: async () => {
                const success = await uninstallVersion(version);
                if (success) {
                    message.success(t('versionList.messages.uninstallSuccess', { version }));
                    loadTotalSize();
                }
            }
        });
    };

    const formatSize = (bytes?: number): string => {
        if (bytes === undefined || bytes === null) return '-';
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    };

    const getSortedVersions = (): NodeVersion[] => {
        let versions = [...state.versions];

        if (showLtsOnly) {
            versions = versions.filter(v => {
                const major = getMajorVersion(v.version);
                return major % 2 === 0 && major >= 14;
            });
        }

        versions.sort((a, b) => {
            let result = 0;
            switch (sortBy) {
                case 'version':
                    result = -compareVersions(a.version, b.version);
                    break;
                case 'date':
                    result = new Date(a.installedDate).getTime() - new Date(b.installedDate).getTime();
                    break;
                case 'size':
                    result = (a.size || 0) - (b.size || 0);
                    break;
            }
            return sortOrder === 'asc' ? result : -result;
        });

        return versions;
    };

    const isLtsVersion = (version: string): boolean => {
        const major = getMajorVersion(version);
        return major % 2 === 0 && major >= 14;
    };

    const sortedVersions = getSortedVersions();

    return (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
            {/* Minimalist Summary */}
            <Row gutter={16}>
                <Col span={8}>
                    <Card size="small" className="glass-card bg-deco-container" style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="bg-deco-text" style={{ left: '50%', top: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', fontSize: 60 }}>{t('summary.env')}</div>
                        <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--color-blue-primary)', zIndex: 1, textAlign: 'center' }}>{state.versions.length}</div>
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small" className="glass-card bg-deco-container" style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="bg-deco-text" style={{ left: '50%', top: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', fontSize: 60 }}>{t('summary.disk')}</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-green-primary)', zIndex: 1, textAlign: 'center' }}>{formatSize(totalSize).replace(' ', '')}</div>
                    </Card>
                </Col>
                <Col span={8}>
                    <Card size="small" className="glass-card bg-deco-container" style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="bg-deco-text" style={{ left: '50%', top: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', fontSize: 60 }}>{t('summary.run')}</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-yellow-primary)', zIndex: 1, textAlign: 'center' }}>{state.activeVersion?.replace(/^v/, '') || t('common.none')}</div>
                    </Card>
                </Col>
            </Row>

            <Card
                className="glass-card bg-deco-container"
                title={
                    <Space size={10}>
                        <DatabaseOutlined style={{ color: 'var(--color-blue-primary)' }} />
                        <span style={{ fontWeight: 700 }}>{t('versionList.title')}</span>
                    </Space>
                }
                extra={
                    <Space size={8}>
                        <Tooltip title={t('versionList.tooltips.refresh')}>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => { loadVersions(); loadTotalSize(); }}
                                loading={state.loading}
                            />
                        </Tooltip>
                        <Tooltip title={t('versionList.tooltips.install')}>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setInstallModalVisible(true)}
                                style={{ background: 'var(--color-blue-primary)', borderRadius: 8 }}
                            />
                        </Tooltip>
                    </Space>
                }
            >
                <div className="bg-deco-text top-right">NODE</div>
                {/* Control Bar */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 20,
                    padding: '8px 16px',
                    background: 'rgba(0,0,0,0.02)',
                    borderRadius: 10,
                    alignItems: 'center'
                }}>
                    <Space size={16}>
                        <Space size={4}>
                            <SortAscendingOutlined style={{ color: 'var(--text-sec)' }} />
                            <Select
                                value={sortBy}
                                onChange={setSortBy}
                                variant="borderless"
                                size="small"
                                options={[
                                    { value: 'version', label: t('versionList.version') },
                                    { value: 'date', label: t('versionList.date') },
                                    { value: 'size', label: t('versionList.size') }
                                ]}
                            />
                        </Space>
                        <Select
                            value={sortOrder}
                            onChange={setSortOrder}
                            variant="borderless"
                            size="small"
                            options={[
                                { value: 'desc', label: t('versionList.desc') },
                                { value: 'asc', label: t('versionList.asc') }
                            ]}
                        />
                    </Space>
                    <Space size={12}>
                        <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>{t('versionList.ltsOnly')}</span>
                        <Switch
                            checked={showLtsOnly}
                            onChange={setShowLtsOnly}
                            size="small"
                        />
                    </Space>
                </div>

                <Spin spinning={state.loading}>
                    <List
                        dataSource={sortedVersions}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('versionList.noVersions')} /> }}
                        renderItem={(item) => (
                            <List.Item
                                className={`glass-card bg-deco-container ${item.isActive ? 'active-version-item' : ''}`}
                                style={{
                                    padding: '16px 20px',
                                    marginBottom: 10,
                                    transition: 'all 0.3s',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}
                                actions={item.isActive ? [] : [
                                    <Tooltip title={t('versionList.tooltips.apply')}>
                                        <Button
                                            type="text"
                                            icon={<SwapOutlined />}
                                            onClick={() => handleSwitch(item.version)}
                                            size="small"
                                            style={{ color: 'var(--color-blue-primary)', background: 'transparent', border: 'none' }}
                                        />
                                    </Tooltip>,
                                    <Tooltip title={t('versionList.tooltips.delete')}>
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => handleUninstall(item.version)}
                                            size="small"
                                            style={{ background: 'transparent', border: 'none' }}
                                        />
                                    </Tooltip>
                                ]}
                            >
                                {item.isActive && (
                                    <>
                                        <div className="active-pattern-bg" />
                                        <div className="bg-deco-text" style={{ fontSize: 48, right: 10, bottom: -15, opacity: 0.06, color: 'var(--color-green-primary)' }}>{t('common.active')}</div>
                                    </>
                                )}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    width: '100%',
                                    gap: 0,
                                    position: 'relative',
                                    zIndex: 1
                                }}>
                                    {/* Column 1: Version */}
                                    <div style={{ width: 100, flexShrink: 0 }}>
                                        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>
                                            v{item.version.replace(/^v/, '')}
                                        </span>
                                    </div>

                                    {/* Column 2: LTS Tag */}
                                    <div style={{ width: 80, flexShrink: 0 }}>
                                        {isLtsVersion(item.version) ? (
                                            <Tooltip title={t('versionList.tooltips.lts')}>
                                                <Tag color="green" bordered={false} style={{ borderRadius: 4, fontWeight: 600, fontSize: 11, margin: 0 }}>LTS</Tag>
                                            </Tooltip>
                                        ) : (
                                            <div style={{ width: 44 }} />
                                        )}
                                    </div>

                                    {/* Column 3: Installed Date */}
                                    <div style={{ width: 150, flexShrink: 0, color: 'var(--text-sec)', fontSize: 13 }}>
                                        <Space size={6}>
                                            <ReloadOutlined style={{ fontSize: 12, opacity: 0.4 }} />
                                            <span>{new Date(item.installedDate).toLocaleDateString()}</span>
                                        </Space>
                                    </div>

                                    {/* Column 4: Size */}
                                    <div style={{ flex: 1, color: 'var(--text-sec)', fontSize: 13 }}>
                                        <Space size={6}>
                                            <HddOutlined style={{ fontSize: 12, opacity: 0.4 }} />
                                            <span>{formatSize(item.size)}</span>
                                        </Space>
                                    </div>
                                </div>
                            </List.Item>
                        )}
                    />
                </Spin>
            </Card>

            <VersionInstall visible={installModalVisible} onClose={() => setInstallModalVisible(false)} />
        </Space>
    );
};

export default VersionList;
