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
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

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
    const { state } = useApp();
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
            message.error('加载全局包列表失败');
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
            const data = await window.tauriAPI.searchPackages(query);
            setSearchResults(data.results || []);
            setSearchTotal(data.total || 0);
        } catch (error) {
            message.error('搜索失败');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleInstall = async (packageName: string) => {
        try {
            setInstalling(packageName);
            const result = await window.tauriAPI.installGlobalPackage(packageName);
            if (result.success) {
                message.success(`已安装 ${packageName}`);
                await loadPackages();
                setInstallModalVisible(false);
            } else {
                message.error(result.message);
            }
        } catch (error) {
            message.error('安装失败');
        } finally {
            setInstalling(null);
        }
    };

    const handleUninstall = async (packageName: string) => {
        try {
            setUninstalling(packageName);
            const result = await window.tauriAPI.uninstallGlobalPackage(packageName);
            if (result.success) {
                message.success(`已卸载 ${packageName}`);
                await loadPackages();
            } else {
                message.error(result.message);
            }
        } catch (error) {
            message.error('卸载失败');
        } finally {
            setUninstalling(null);
        }
    };

    const handleUpdate = async (packageName: string) => {
        try {
            setUpdating(packageName);
            const result = await window.tauriAPI.updateGlobalPackage(packageName);
            if (result.success) {
                message.success(`已更新 ${packageName}`);
                await loadPackages();
            } else {
                message.error(result.message);
            }
        } catch (error) {
            message.error('更新失败');
        } finally {
            setUpdating(null);
        }
    };

    const handleUpdateAll = async () => {
        if (outdatedPackages.length === 0) {
            message.info('所有包都是最新版本');
            return;
        }

        Modal.confirm({
            title: '确认更新所有过时包',
            icon: <ExclamationCircleOutlined />,
            content: `将更新 ${outdatedPackages.length} 个包到最新版本，是否继续？`,
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

    const columns = [
        {
            title: '包名',
            dataIndex: 'name',
            key: 'name',
            render: (name: string) => {
                const outdated = getOutdatedInfo(name);
                return (
                    <Space>
                        <Text strong>{name}</Text>
                        {outdated && (
                            <Tooltip title={`可更新到 ${outdated.latest}`}>
                                <Badge status="warning" />
                            </Tooltip>
                        )}
                    </Space>
                );
            }
        },
        {
            title: '当前版本',
            dataIndex: 'version',
            key: 'version',
            width: 120,
            render: (version: string, record: Package) => {
                const outdated = getOutdatedInfo(record.name);
                return (
                    <Space>
                        <Tag>{version}</Tag>
                        {outdated && (
                            <Tooltip title={`最新: ${outdated.latest}`}>
                                <Tag color="orange" icon={<WarningOutlined />}>
                                    有更新
                                </Tag>
                            </Tooltip>
                        )}
                    </Space>
                );
            }
        },
        {
            title: '操作',
            key: 'action',
            width: 200,
            render: (_: any, record: Package) => {
                const outdated = getOutdatedInfo(record.name);
                return (
                    <Space>
                        {outdated && (
                            <Button
                                type="link"
                                size="small"
                                icon={<SyncOutlined spin={updating === record.name} />}
                                onClick={() => handleUpdate(record.name)}
                                loading={updating === record.name}
                            >
                                更新
                            </Button>
                        )}
                        <Popconfirm
                            title={`确定要卸载 ${record.name} 吗？`}
                            onConfirm={() => handleUninstall(record.name)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button
                                type="link"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                loading={uninstalling === record.name}
                            >
                                卸载
                            </Button>
                        </Popconfirm>
                    </Space>
                );
            }
        }
    ];

    if (!state.config?.nvmPath) {
        return (
            <Card>
                <Empty description="请先配置 nvm-windows 路径" />
            </Card>
        );
    }

    return (
        <>
            <Card
                title={
                    <Space>
                        <span>全局安装的包</span>
                        {outdatedPackages.length > 0 && (
                            <Badge count={outdatedPackages.length} style={{ backgroundColor: '#faad14' }}>
                                <Tag color="orange">可更新</Tag>
                            </Badge>
                        )}
                    </Space>
                }
                extra={
                    <Space>
                        {outdatedPackages.length > 0 && (
                            <Button
                                icon={<SyncOutlined />}
                                onClick={handleUpdateAll}
                            >
                                全部更新
                            </Button>
                        )}
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={loadPackages}
                            loading={loading}
                        >
                            刷新
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setInstallModalVisible(true)}
                        >
                            安装
                        </Button>
                    </Space>
                }
            >
                <Spin spinning={loading}>
                    {packages.length === 0 ? (
                        <Empty description="未安装任何全局包" />
                    ) : (
                        <Table
                            dataSource={packages}
                            columns={columns}
                            rowKey="name"
                            size="small"
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: true }}
                        />
                    )}
                </Spin>
            </Card>

            <Modal
                title="安装全局包"
                open={installModalVisible}
                onCancel={() => setInstallModalVisible(false)}
                footer={null}
                width={800}
                styles={{
                    body: {
                        height: 500,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                        paddingTop: 16
                    }
                }}
            >
                <Search
                    placeholder="搜索 npm 包..."
                    enterButton={<SearchOutlined />}
                    size="large"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onSearch={(value) => handleSearch(value, 1, pageSize)}
                    loading={searchLoading}
                />

                <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    <Spin spinning={searchLoading}>
                        {searchResults.length === 0 ? (
                            searchQuery ? (
                                <Empty description="未找到匹配的包" />
                            ) : (
                                <Empty description="输入包名搜索 npm 包" />
                            )
                        ) : (
                            <List
                                dataSource={searchResults}
                                renderItem={(item) => (
                                    <List.Item
                                        actions={[
                                            <Button
                                                type="primary"
                                                size="small"
                                                onClick={() => handleInstall(item.name)}
                                                loading={installing === item.name}
                                            >
                                                安装
                                            </Button>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={
                                                <Space>
                                                    <Text strong>{item.name}</Text>
                                                    <Tag>{item.version}</Tag>
                                                </Space>
                                            }
                                            description={
                                                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                                    <Text type="secondary" style={{ fontSize: 13 }}>
                                                        {item.description || '无描述'}
                                                    </Text>
                                                    <Space split={<Divider type="vertical" />} wrap style={{ fontSize: 12 }}>
                                                        {item.author && <Text type="secondary">作者: {item.author}</Text>}
                                                        <Text type="secondary">
                                                            下载量: {item.downloads >= 10000
                                                                ? `${(item.downloads / 10000).toFixed(1)} 万`
                                                                : item.downloads.toLocaleString()}
                                                        </Text>
                                                        {item.lastUpdated && (
                                                            <Text type="secondary">
                                                                最后更新: {new Date(item.lastUpdated).toLocaleDateString()}
                                                            </Text>
                                                        )}
                                                    </Space>
                                                </Space>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        )}
                    </Spin>
                </div>

                {searchResults.length > 0 && (
                    <div style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0' }}>
                        <Pagination
                            size="small"
                            current={currentPage}
                            pageSize={pageSize}
                            total={searchTotal}
                            onChange={(page: number, size: number) => handleSearch(searchQuery, page, size)}
                            showSizeChanger
                            showTotal={(total: number) => `共 ${total} 条结果`}
                        />
                    </div>
                )}
            </Modal>
        </>
    );
};

export default GlobalPackages;
