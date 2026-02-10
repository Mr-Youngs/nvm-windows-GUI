import React, { useEffect, useState, useRef } from 'react';
import {
    Card,
    Button,
    Space,
    Input,
    Tag,
    message,
    Spin,
    Empty,
    Typography,
    Tooltip,
    List,
    Popconfirm,
    Pagination,
    Progress
} from 'antd';
import {
    PlusOutlined,
    ReloadOutlined,
    DeleteOutlined,
    SyncOutlined,
    SearchOutlined,
    ExclamationCircleOutlined,
    DownloadOutlined,
    GlobalOutlined,
    LoadingOutlined,
    UserOutlined,
    HistoryOutlined,
    PauseCircleOutlined,
    PlayCircleOutlined,
    CloseCircleOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import StyledModal from '../Common/StyledModal';

const { Search } = Input;
const { Text } = Typography;

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
    const { state, pauseDownload, resumeDownload, cancelDownload } = useApp();
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

    // 版本选择相关状态
    const [versionModalVisible, setVersionModalVisible] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
    const [packageVersions, setPackageVersions] = useState<any[]>([]);
    const [distTags, setDistTags] = useState<Record<string, string>>({});
    const [loadingVersions, setLoadingVersions] = useState(false);

    useEffect(() => {
        if (state.config?.nvmPath) {
            loadPackages();
        }
    }, [state.config, state.globalPackages]);

    const loadPackages = async () => {
        try {
            setLoading(true);
            const [pkgs, outdated] = await Promise.all([
                window.tauriAPI.getGlobalPackages(),
                window.tauriAPI.checkOutdatedPackages()
            ]);
            setPackages(pkgs || []);
            setOutdatedPackages(outdated || []);
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

    // 显示版本选择弹窗
    const handleShowVersions = async (packageName: string) => {
        try {
            setSelectedPackage(packageName);
            setLoadingVersions(true);
            setVersionModalVisible(true);
            const data = await window.tauriAPI.getPackageVersions(packageName);

            // 过滤掉预发布版本 (带有 - 的版本，如 6.0.0-dev)
            const stableVersions = (data.versions || []).filter((v: any) => !v.version.includes('-'));
            setPackageVersions(stableVersions);
            setDistTags(data.distTags || {});
        } catch (error) {
            message.error(t('packages.messages.loadVersionsError'));
        } finally {
            setLoadingVersions(false);
        }
    };

    // 关闭搜索安装弹窗并重置状态
    const handleCloseInstallModal = () => {
        setInstallModalVisible(false);
        setSearchQuery('');
        setSearchResults([]);
        setSearchTotal(0);
        setCurrentPage(1);
    };

    // 关闭版本选择弹窗并重置状态
    const handleCloseVersionModal = () => {
        setVersionModalVisible(false);
        setSelectedPackage(null);
        setPackageVersions([]);
        setDistTags({});
        setLoadingVersions(false);
    };

    const handleInstall = async (packageName: string, version?: string) => {
        const installTarget = version ? `${packageName}@${version}` : packageName;
        try {
            setInstalling(installTarget);
            const result = await window.tauriAPI.installGlobalPackage(packageName, version);
            if (result.success) {
                // 注意：安装是异步的，成功的 Toast 提示已移至 AppContext 的事件监听中统一处理
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

        import('antd').then(({ Modal: AntdModal }) => {
            AntdModal.confirm({
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
        });
    };

    const getOutdatedInfo = (name: string): OutdatedPackage | undefined => {
        return outdatedPackages.find(p => p.name === name);
    };

    const renderVersionControl = (packageName: string, version: string, isBig = false) => {
        const installedPackage = packages.find(p => p.name === packageName);
        const isExactInstalled = installedPackage?.version === version;

        if (isExactInstalled) {
            return (
                <Tag color="success" bordered={false} style={{ borderRadius: 6, fontWeight: 600 }}>
                    {t('common.installed')}
                </Tag>
            );
        }

        const installId = `${packageName}@${version}`;
        const download = state.activeDownloads[installId];

        if (download) {
            return (
                <Space size={8}>
                    {download.progress < 100 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: isBig ? 28 : 20, height: isBig ? 28 : 20 }}>
                                <Progress
                                    type="circle"
                                    percent={download.progress}
                                    size={isBig ? 28 : 20}
                                    strokeWidth={isBig ? 12 : 10}
                                    status="normal"
                                    strokeColor={download.isPaused ? '#bfbfbf' : 'var(--color-blue-primary)'}
                                />
                                {isBig && (
                                    <span style={{ fontSize: 9, position: 'absolute', fontWeight: 800, color: download.isPaused ? '#999' : 'var(--text-main)' }}>
                                        {download.progress}%
                                    </span>
                                )}
                            </div>
                            {isBig && <Text type="secondary" style={{ fontSize: 12 }}>{download.status}</Text>}
                        </div>
                    ) : (
                        download.isPaused ? <PauseCircleOutlined style={{ color: '#bfbfbf' }} /> : <LoadingOutlined style={{ color: 'var(--color-blue-primary)' }} />
                    )}
                    <Space size={0}>
                        <Button
                            type="text"
                            size="small"
                            icon={download.isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                            onClick={() => download.isPaused ? resumeDownload(installId) : pauseDownload(installId)}
                            style={{ color: 'var(--color-blue-primary)', padding: '0 4px' }}
                        />
                        <Button
                            type="text"
                            size="small"
                            icon={<CloseCircleOutlined />}
                            onClick={() => cancelDownload(installId)}
                            style={{ padding: '0 4px' }}
                            danger
                        />
                    </Space>
                </Space>
            );
        }

        return (
            <Button
                type={isBig ? "primary" : "text"}
                size={isBig ? "large" : "small"}
                icon={installedPackage ? <SyncOutlined /> : <DownloadOutlined />}
                loading={installing === installId}
                onClick={() => handleInstall(packageName, version)}
                style={isBig ? { borderRadius: 8, height: 40, padding: '0 20px' } : { borderRadius: 6, color: 'var(--color-blue-primary)' }}
            >
                {isBig && (installedPackage ? t('common.pendingUpdate') : t('common.install'))}
            </Button>
        );
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
                <div className="bg-deco-text top-right" style={{ fontSize: 100 }}>NPM</div>
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

            {/* 搜索安装弹窗 */}
            <StyledModal
                title={t('packages.installOnline')}
                icon={<SearchOutlined />}
                open={installModalVisible}
                onCancel={handleCloseInstallModal}
                width={650}
                height={550}
                loading={searchLoading}
                styles={{ body: { padding: '20px 24px' } }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
                    <Search
                        placeholder={t('packages.searchTip')}
                        enterButton={
                            <Button
                                className="search-append-btn"
                                type="primary"
                                icon={searchLoading ? <LoadingOutlined /> : <SearchOutlined />}
                                style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, height: 40 }}
                            />
                        }
                        size="large"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onSearch={(value) => handleSearch(value, 1, pageSize)}
                        style={{ flexShrink: 0 }}
                    />

                    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
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
                                            <Space size={8}>
                                                <Tooltip title={t('packages.versionModal.selectVersion')}>
                                                    <Button
                                                        size="small"
                                                        icon={<HistoryOutlined />}
                                                        onClick={() => handleShowVersions(item.name)}
                                                        style={{ borderRadius: 6 }}
                                                    />
                                                </Tooltip>
                                                {renderVersionControl(item.name, item.version, false)}
                                            </Space>
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
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, flexShrink: 0 }}>
                        <Pagination
                            size="small"
                            total={searchTotal}
                            current={currentPage}
                            pageSize={pageSize}
                            showSizeChanger={false}
                            showLessItems
                            style={{ whiteSpace: 'nowrap', flexWrap: 'nowrap' }}
                            onChange={(page, size) => handleSearch(searchQuery, page, size)}
                        />
                    </div>
                </div>
            </StyledModal>

            {/* 版本选择弹窗 */}
            <StyledModal
                title={t('packages.versionModal.title', { name: selectedPackage })}
                icon={<HistoryOutlined />}
                open={versionModalVisible}
                onCancel={handleCloseVersionModal}
                width={480}
                height={450}
                loading={loadingVersions}
            >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {!loadingVersions && distTags.latest && (
                        <div style={{ flexShrink: 0, padding: '20px 24px', background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ marginBottom: 4 }}>
                                        <Tag color="blue" bordered={false} style={{ borderRadius: 4, fontWeight: 700 }}>LATEST</Tag>
                                        <Text strong style={{ fontSize: 18 }}>v{distTags.latest}</Text>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>{t('packages.versionModal.latestStable')}</Text>
                                </div>
                                {renderVersionControl(selectedPackage!, distTags.latest, true)}
                            </div>
                        </div>
                    )}

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <div style={{ padding: '16px 24px 8px 24px' }}>
                            <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>{t('packages.versionModal.historyVersions')}</Text>
                        </div>
                        <List
                            size="small"
                            dataSource={packageVersions.filter(v => v.version !== distTags.latest).slice(0, 50)}
                            renderItem={(item: any) => (
                                <List.Item
                                    style={{ padding: '12px 24px', borderBottom: '1px solid rgba(0,0,0,0.03)' }}
                                    actions={[
                                        renderVersionControl(selectedPackage!, item.version)
                                    ]}
                                >
                                    <List.Item.Meta
                                        title={<Text strong>v{item.version}</Text>}
                                        description={item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : null}
                                    />
                                </List.Item>
                            )}
                            locale={{ emptyText: <Empty description={t('packages.versionModal.noOtherVersions')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                        />
                    </div>
                </div>
            </StyledModal>
        </div>
    );
};

export default GlobalPackages;
