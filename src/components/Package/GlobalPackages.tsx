import React, { useEffect, useState, useRef } from 'react';
import {
    Card,
    Table,
    Button,
    Space,
    Input,
    Modal,
    Tag,
    message,
    Spin,
    Empty,
    Typography,
    Tooltip,
    Badge,
    List,
    Popconfirm,
    Divider,
    Pagination
} from 'antd';
import {
    PlusOutlined,
    ReloadOutlined,
    DeleteOutlined,
    SyncOutlined,
    SearchOutlined,
    WarningOutlined,
    ExclamationCircleOutlined,
    DownloadOutlined,
    GlobalOutlined,
    LoadingOutlined,
    UserOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const { Search } = Input;
const { Text, Title } = Typography;

interface Package {
    name: string;
    version: string;
    path: string;
}

interface OutdatedPackage {
    name: string;
    current: string;
    wanted: string;
    latest: string;
}

interface NpmSearchResult {
    name: string;
    version: string;
    description: string;
    keywords: string[];
    author: string;
    downloads: number;
    lastUpdated: string;
}

const GlobalPackages: React.FC = () => {
    const { theme } = useTheme();
    const { state } = useApp();
    const { t } = useLanguage();
    const [packages, setPackages] = useState<Package[]>([]);
    const [outdatedPackages, setOutdatedPackages] = useState<OutdatedPackage[]>([]);
    const [searchResults, setSearchResults] = useState<NpmSearchResult[]>([]);
    const [searchTotal, setSearchTotal] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [installing, setInstalling] = useState<string | null>(null);
    const [uninstalling, setUninstalling] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const [installModalVisible, setInstallModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (state.config?.nvmPath) {
            loadPackages();
        }
    }, [state.config]);

    const loadPackages = async () => {
        try {
            setLoading(true);
            const [pkgs, outdated] = await Promise.all([
                window.tauriAPI.getGlobalPackages(),
                window.tauriAPI.checkOutdatedPackages()
            ]);
            setPackages(pkgs);
            setOutdatedPackages(outdated);
        } catch (error) {
            message.error(t('packages.messages.loadError'));
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (query: string, page: number = 1, size: number = 10) => {
        if (!query.trim()) {
            setSearchResults([]);
            setSearchTotal(0);
            return;
        }

        scrollRef.current?.scrollTo(0, 0);

        try {
            setSearchLoading(true);
            setCurrentPage(page);
            setPageSize(size);
            const data = await window.tauriAPI.searchPackages(query, page, size);
            setSearchResults(data.results || []);
            setSearchTotal(data.total || 0);
        } catch (error) {
            message.error(t('packages.messages.searchError'));
        } finally {
            setSearchLoading(false);
        }
    };

    const handleInstall = async (packageName: string) => {
        try {
            setInstalling(packageName);
            const result = await window.tauriAPI.installGlobalPackage(packageName);
            if (result.success) {
                message.success(t('packages.messages.installSuccess', { name: packageName }));
                await loadPackages();
                setInstallModalVisible(false);
            } else {
                message.error(result.message);
            }
        } catch (error) {
            message.error(t('packages.messages.installError'));
        } finally {
            setInstalling(null);
        }
    };

    const handleUninstall = async (packageName: string) => {
        try {
            setUninstalling(packageName);
            const result = await window.tauriAPI.uninstallGlobalPackage(packageName);
            if (result.success) {
                message.success(t('packages.messages.uninstallSuccess', { name: packageName }));
                await loadPackages();
            } else {
                message.error(result.message);
            }
        } catch (error) {
            message.error(t('packages.messages.uninstallError'));
        } finally {
            setUninstalling(null);
        }
    };

    const handleUpdate = async (packageName: string) => {
        try {
            setUpdating(packageName);
            const result = await window.tauriAPI.updateGlobalPackage(packageName);
            if (result.success) {
                message.success(t('packages.messages.updateSuccess', { name: packageName }));
                await loadPackages();
            } else {
                message.error(result.message);
            }
        } catch (error) {
            message.error(t('packages.messages.updateError'));
        } finally {
            setUpdating(null);
        }
    };

    const handleUpdateAll = async () => {
        if (outdatedPackages.length === 0) {
            message.info(t('packages.messages.upToDate'));
            return;
        }

        Modal.confirm({
            title: t('packages.messages.updateAllConfirm'),
            icon: <ExclamationCircleOutlined />,
            content: t('packages.messages.updateAllContent', { count: outdatedPackages.length }),
            centered: true,
            onOk: async () => {
                for (const pkg of outdatedPackages) {
                    await handleUpdate(pkg.name);
                }
            }
        });
    };

    const getOutdatedInfo = (name: string): OutdatedPackage | undefined => {
        return outdatedPackages.find(p => p.name === name);
    };

    if (!state.config?.nvmPath) {
        return (
            <Card>
                <Empty description={t('packages.messages.configureNvm')} />
            </Card>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Card
                className="glass-card bg-deco-container"
                title={
                    <Space size={10}>
                        <GlobalOutlined style={{ color: 'var(--color-blue-primary)' }} />
                        <span style={{ fontWeight: 700 }}>{t('packages.title')}</span>
                        {outdatedPackages.length > 0 && (
                            <Tag color="warning" bordered={false} style={{ borderRadius: 4, fontWeight: 600 }}>
                                {t('packages.updatesAvailable', { count: outdatedPackages.length })}
                            </Tag>
                        )}
                    </Space>
                }
                extra={
                    <Space size={8}>
                        {outdatedPackages.length > 0 && (
                            <Tooltip title={t('packages.updateAll')}>
                                <Button
                                    icon={<SyncOutlined />}
                                    onClick={handleUpdateAll}
                                />
                            </Tooltip>
                        )}
                        <Tooltip title={t('common.refresh')}>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={loadPackages}
                                loading={loading}
                            />
                        </Tooltip>
                        <Tooltip title={t('packages.tooltips.install')}>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setInstallModalVisible(true)}
                                style={{ background: 'var(--color-blue-primary)' }}
                            />
                        </Tooltip>
                    </Space>
                }
            >
                <div className="bg-deco-text" style={{ fontSize: 100 }}>NPM</div>
                <Spin spinning={loading}>
                    {packages.length === 0 ? (
                        <Empty
                            description={t('packages.noPackages')}
                            style={{ padding: '40px 0' }}
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {packages.map((pkg) => {
                                const outdated = getOutdatedInfo(pkg.name);
                                return (
                                    <div
                                        key={pkg.name}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '14px 18px',
                                            borderRadius: 12,
                                            background: outdated
                                                ? (theme === 'dark' ? 'rgba(253, 203, 110, 0.15)' : 'var(--color-yellow-light)')
                                                : 'rgba(255,255,255,0.3)',
                                            border: outdated ? '1px solid rgba(253, 203, 110, 0.3)' : '1px solid rgba(0,0,0,0.03)',
                                            transition: 'all 0.3s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                            {/* Column 1: Package Name */}
                                            <div style={{ width: 180, flexShrink: 0 }}>
                                                <Text style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>{pkg.name}</Text>
                                            </div>

                                            {/* Column 2: Version Tag */}
                                            <div style={{ width: 100, flexShrink: 0 }}>
                                                <Tag bordered={false} style={{ borderRadius: 6, fontWeight: 600, margin: 0 }}>v{pkg.version}</Tag>
                                            </div>

                                            {/* Column 3: Update Status */}
                                            <div style={{ flex: 1 }}>
                                                {outdated && (
                                                    <Tooltip title={t('packages.messages.updateAvailable')}>
                                                        <Tag color="orange" bordered={false} icon={<SyncOutlined spin />} style={{ borderRadius: 6, fontWeight: 600 }}>{t('packages.updateAvailable')}</Tag>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>

                                        <Space size={8}>
                                            {outdated && (
                                                <Tooltip title={t('common.apply')}>
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={<SyncOutlined spin={updating === pkg.name} />}
                                                        onClick={() => handleUpdate(pkg.name)}
                                                        loading={updating === pkg.name}
                                                        style={{ color: 'var(--color-yellow-primary)', background: 'transparent' }}
                                                    />
                                                </Tooltip>
                                            )}
                                            <Popconfirm
                                                title={t('packages.messages.uninstallConfirm', { name: pkg.name })}
                                                onConfirm={() => handleUninstall(pkg.name)}
                                                okText={t('common.yes')}
                                                cancelText={t('common.no')}
                                            >
                                                <Tooltip title={t('common.uninstall')}>
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        danger
                                                        icon={<DeleteOutlined />}
                                                        loading={uninstalling === pkg.name}
                                                        style={{ background: 'transparent', border: 'none' }}
                                                    />
                                                </Tooltip>
                                            </Popconfirm>
                                        </Space>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Spin>
            </Card>

            <Modal
                title={
                    <Space size={8}>
                        <SearchOutlined style={{ color: 'var(--color-blue-primary)' }} />
                        <span style={{ fontWeight: 700 }}>{t('packages.installOnline')}</span>
                    </Space>
                }
                open={installModalVisible}
                onCancel={() => setInstallModalVisible(false)}
                footer={null}
                width={650}
                centered
                styles={{ body: { padding: '20px 24px', height: 550, display: 'flex', flexDirection: 'column' } }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
                    <Search
                        placeholder={t('packages.searchTip')}
                        enterButton={
                            <Button
                                type="primary"
                                icon={searchLoading ? <LoadingOutlined /> : <SearchOutlined />}
                                style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                            />
                        }
                        size="large"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onSearch={(value) => handleSearch(value, 1, pageSize)}
                    />

                    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
                        <Spin spinning={searchLoading}>
                            {searchResults.length === 0 ? (
                                <Empty
                                    description={searchQuery ? t('packages.resultEmpty') : t('packages.resultPrompt')}
                                    style={{ padding: '60px 0' }}
                                />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {searchResults.map((item) => (
                                        <div
                                            key={item.name}
                                            style={{
                                                padding: '16px',
                                                borderRadius: 12,
                                                background: 'rgba(0,0,0,0.02)',
                                                border: '1px solid var(--border-subtle)',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <Space size={10}>
                                                    <Text style={{ fontSize: 16, fontWeight: 700 }}>{item.name}</Text>
                                                    <Tag bordered={false} style={{ borderRadius: 4 }}>v{item.version}</Tag>
                                                </Space>
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    icon={<DownloadOutlined />}
                                                    onClick={() => handleInstall(item.name)}
                                                    loading={installing === item.name}
                                                    style={{ background: 'var(--color-blue-primary)', borderRadius: 6 }}
                                                >
                                                    {t('common.install')}
                                                </Button>
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--text-sec)', marginBottom: 12, lineHeight: 1.5 }}>
                                                {item.description || t('common.noDescription')}
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-sec)', opacity: 0.8 }}>
                                                <Tooltip title={t('common.author')}>
                                                    <Space size={4}>
                                                        <UserOutlined />
                                                        <span style={{ fontWeight: 500 }}>{item.author || t('common.unknown')}</span>
                                                    </Space>
                                                </Tooltip>
                                                <Tooltip title={t('common.downloads')}>
                                                    <Space size={4}>
                                                        <DownloadOutlined />
                                                        <span style={{ fontWeight: 500 }}>{typeof item.downloads === 'number' && !isNaN(item.downloads) ? item.downloads.toLocaleString() : '-'}</span>
                                                    </Space>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Spin>
                    </div>

                    <div style={{ flexShrink: 0, paddingTop: 8, borderTop: '1px solid var(--border-subtle)', textAlign: 'right', overflow: 'hidden' }}>
                        <Pagination
                            size="small"
                            current={currentPage}
                            pageSize={pageSize}
                            total={searchTotal}
                            onChange={(page: number, size: number) => handleSearch(searchQuery, page, size)}
                            showSizeChanger={false}
                            showLessItems
                            style={{ whiteSpace: 'nowrap', flexWrap: 'nowrap' }}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default GlobalPackages;
