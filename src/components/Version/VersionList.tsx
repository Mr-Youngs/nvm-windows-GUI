import React, { useState, useEffect } from 'react';
import {
    List,
    Button,
    Tag,
    Space,
    Typography,
    Tooltip,
    Modal,
    message,
    Card,
    Row,
    Col,
    Statistic,
    Empty,
    Spin,
    Select,
    Switch
} from 'antd';
import {
    ReloadOutlined,
    PlusOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    SwapOutlined,
    HddOutlined,
    SortAscendingOutlined,
    FilterOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import VersionInstall from './VersionInstall';

const { Text } = Typography;
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
            // 忽略错误
        }
    };

    const handleSwitch = async (version: string) => {
        const success = await switchVersion(version);
        if (success) {
            Modal.success({
                title: '切换成功',
                content: `已切换到 Node.js ${version}`
            });
        }
    };

    const handleUninstall = (version: string) => {
        confirm({
            title: '确认卸载',
            content: `确定要卸载 Node.js ${version} 吗？此操作不可恢复。`,
            okText: '确定',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                const success = await uninstallVersion(version);
                if (success) {
                    Modal.success({
                        title: '卸载成功',
                        content: `已卸载 Node.js ${version}`
                    });
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
                const majorStr = v.version.startsWith('v') ? v.version.substring(1).split('.')[0] : v.version.split('.')[0];
                const major = parseInt(majorStr);
                return major % 2 === 0 && major >= 14;
            });
        }

        versions.sort((a, b) => {
            let result = 0;
            switch (sortBy) {
                case 'version':
                    const vA = a.version.startsWith('v') ? a.version.substring(1) : a.version;
                    const vB = b.version.startsWith('v') ? b.version.substring(1) : b.version;
                    const aParts = vA.split('.').map(Number);
                    const bParts = vB.split('.').map(Number);
                    for (let i = 0; i < 3; i++) {
                        if ((aParts[i] || 0) !== (bParts[i] || 0)) {
                            result = (aParts[i] || 0) - (bParts[i] || 0);
                            break;
                        }
                    }
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
        const majorStr = version.startsWith('v') ? version.substring(1).split('.')[0] : version.split('.')[0];
        const major = parseInt(majorStr);
        return major % 2 === 0 && major >= 14;
    };

    if (!state.config?.nvmPath) {
        return (
            <Card>
                <Empty description="请先配置 nvm-windows 路径" />
            </Card>
        );
    }

    const sortedVersions = getSortedVersions();

    return (
        <>
            <Card
                title="已安装版本"
                extra={
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => { loadVersions(); loadTotalSize(); }}
                            loading={state.loading}
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
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={12} md={8}>
                        <Statistic title="已安装版本" value={state.versions.length} suffix="个" />
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                        <Statistic title="总磁盘占用" value={formatSize(totalSize)} prefix={<HddOutlined />} />
                    </Col>
                    <Col xs={24} sm={24} md={8}>
                        <Statistic title="当前版本" value={state.activeVersion || '未选择'} />
                    </Col>
                </Row>

                <Space style={{ marginBottom: 16 }} wrap>
                    <Space>
                        <SortAscendingOutlined />
                        <Text>排序：</Text>
                        <Select
                            value={sortBy}
                            onChange={setSortBy}
                            style={{ width: 100 }}
                            options={[
                                { value: 'version', label: '版本号' },
                                { value: 'date', label: '安装时间' },
                                { value: 'size', label: '磁盘占用' }
                            ]}
                        />
                        <Select
                            value={sortOrder}
                            onChange={setSortOrder}
                            style={{ width: 80 }}
                            options={[
                                { value: 'desc', label: '降序' },
                                { value: 'asc', label: '升序' }
                            ]}
                        />
                    </Space>
                    <Space>
                        <FilterOutlined />
                        <Text>只看 LTS：</Text>
                        <Switch checked={showLtsOnly} onChange={setShowLtsOnly} />
                    </Space>
                </Space>

                <Spin spinning={state.loading}>
                    {sortedVersions.length === 0 ? (
                        <Empty description={showLtsOnly ? "未安装任何 LTS 版本" : "未安装任何 Node.js 版本"} />
                    ) : (
                        <List
                            dataSource={sortedVersions}
                            renderItem={(item: NodeVersion) => (
                                <List.Item
                                    actions={[
                                        item.isActive ? (
                                            <Tag color="success" icon={<CheckCircleOutlined />}>
                                                当前版本
                                            </Tag>
                                        ) : (
                                            <Button
                                                type="link"
                                                icon={<SwapOutlined />}
                                                onClick={() => handleSwitch(item.version)}
                                            >
                                                切换
                                            </Button>
                                        ),
                                        <Button
                                            type="link"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => handleUninstall(item.version)}
                                            disabled={item.isActive}
                                        >
                                            卸载
                                        </Button>
                                    ]}
                                >
                                    <List.Item.Meta
                                        title={
                                            <Space>
                                                <Text strong style={{ fontSize: 16 }}>Node.js {item.version}</Text>
                                                {item.isActive && <Tag color="blue">活动</Tag>}
                                                {isLtsVersion(item.version) && <Tag color="green">LTS</Tag>}
                                            </Space>
                                        }
                                        description={
                                            <Space direction="vertical" size={0}>
                                                <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                                                    <Text type="secondary">安装时间: {new Date(item.installedDate).toLocaleString()}</Text>
                                                    <Tooltip title={item.path}>
                                                        <Text type="secondary"><HddOutlined /> {formatSize(item.size)}</Text>
                                                    </Tooltip>
                                                </Space>
                                            </Space>
                                        }
                                    />
                                </List.Item>
                            )}
                        />
                    )}
                </Spin>
            </Card>
            <VersionInstall visible={installModalVisible} onClose={() => setInstallModalVisible(false)} />
        </>
    );
};

export default VersionList;
