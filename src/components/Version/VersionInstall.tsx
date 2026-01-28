import React, { useState, useEffect, useRef } from 'react';
import {
    Input,
    Modal,
    Tabs,
    List,
    Button,
    Tag,
    Space,
    Empty,
    Spin,
    Progress,
    message,
    Pagination,
    Badge
} from 'antd';
import { DownloadOutlined, StarOutlined, ClockCircleOutlined, SearchOutlined } from '@ant-design/icons';

import { useApp } from '../../context/AppContext';

interface AvailableVersion {
    version: string;
    date: string;
    files: string[];
    lts: string | boolean;
    npm?: string;
}

interface MajorVersionInfo {
    major: number;
    latest: string;
    lts?: boolean;
    ltsName?: string;
    releaseDate?: string;
}

interface VersionInstallProps {
    visible: boolean;
    onClose: () => void;
}

const VersionInstall: React.FC<VersionInstallProps> = ({ visible, onClose }) => {
    const { loadVersions } = useApp();
    const [allVersions, setAllVersions] = useState<AvailableVersion[]>([]);
    const [majorVersions, setMajorVersions] = useState<MajorVersionInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [installProgress, setInstallProgress] = useState(0);
    const [installStatus, setInstallStatus] = useState('');
    const [activeTab, setActiveTab] = useState('major');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(10);
    const [showLtsOnly, setShowLtsOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const allVersionsScrollRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        if (visible) {
            loadAvailableVersions();
            // 监听安装进度
            window.tauriAPI.onInstallProgress((progress, status) => {
                setInstallProgress(progress);
                setInstallStatus(status);
            });
        } else {
            // 关闭弹窗时重置状态
            setInstalling(false);
            setInstallProgress(0);
            setInstallStatus('');
        }
    }, [visible]);

    const loadAvailableVersions = async () => {
        try {
            setLoading(true);
            const [all, majors] = await Promise.all([
                window.tauriAPI.getAvailableVersionsDetailed(),
                window.tauriAPI.getMajorVersions()
            ]);
            setAllVersions(all);
            setMajorVersions(majors);
        } catch (error) {
            message.error('获取版本列表失败');
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async (version: string) => {
        try {
            setInstalling(true);
            setInstallProgress(0);
            setInstallStatus('准备下载...');
            const result = await window.tauriAPI.installVersion(version);
            if (result.success) {
                message.success(`Node.js ${version} 安装成功`);
                await loadVersions();
                onClose();
            } else {
                message.error(result.message);
                setInstalling(false);
            }
        } catch (error) {
            message.error('安装过程中发生错误');
            setInstalling(false);
        }
    };

    const getVersionTag = (version: AvailableVersion) => {
        if (version.lts) {
            return <Tag color="green">LTS {typeof version.lts === 'string' ? version.lts : ''}</Tag>;
        }
        const major = parseInt(version.version.startsWith('v') ? version.version.substring(1).split('.')[0] : version.version.split('.')[0]);
        if (major % 2 !== 0) {
            return <Tag color="orange">Current</Tag>;
        }
        return null;
    };

    const renderMajorVersions = () => {
        if (loading) return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin tip="加载推荐版本..." /></div>;
        if (majorVersions.length === 0) return <Empty description="暂无推荐版本" />;

        return (
            <List
                dataSource={majorVersions}
                renderItem={(item) => (
                    <List.Item
                        actions={[
                            <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                onClick={() => handleInstall(item.latest)}
                            >
                                安装 {item.latest}
                            </Button>
                        ]}
                    >
                        <List.Item.Meta
                            avatar={item.lts ? <StarOutlined style={{ color: '#fadb14', fontSize: 20 }} /> : <ClockCircleOutlined style={{ color: '#1890ff', fontSize: 20 }} />}
                            title={
                                <Space>
                                    <span style={{ fontSize: 16, fontWeight: 'bold' }}>Node.js {item.major}.x</span>
                                    {item.lts && <Tag color="green">长期支持版 (LTS {item.ltsName || ''})</Tag>}
                                </Space>
                            }
                            description={`最新稳定版: ${item.latest} ${item.releaseDate ? `(${new Date(item.releaseDate).toLocaleDateString()})` : ''}`}
                        />
                    </List.Item>
                )}
            />
        );
    };

    const renderAllVersions = () => {
        if (loading) return <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin tip="加载所有版本..." /></div>;

        const filteredVersions = allVersions.filter(v => {
            const matchesSearch = v.version.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesLts = showLtsOnly ? v.lts : true;
            return matchesSearch && matchesLts;
        });

        const paginatedVersions = filteredVersions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        return (
            <>
                <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                        <Input
                            placeholder="搜索版本 (如: 20)..."
                            prefix={<SearchOutlined />}
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            style={{ width: 200 }}
                            allowClear
                        />
                        <Button
                            type={showLtsOnly ? 'primary' : 'default'}
                            onClick={() => { setShowLtsOnly(!showLtsOnly); setCurrentPage(1); }}
                        >
                            只看 LTS
                        </Button>
                    </Space>
                    <span style={{ color: '#999' }}>共 {filteredVersions.length} 个版本</span>
                </Space>


                <List
                    dataSource={paginatedVersions}
                    renderItem={(version) => (
                        <List.Item
                            actions={[
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={() => handleInstall(version.version)}
                                >
                                    安装
                                </Button>
                            ]}
                        >
                            <List.Item.Meta
                                title={
                                    <Space>
                                        <span>Node.js {version.version}</span>
                                        {getVersionTag(version)}
                                    </Space>
                                }
                                description={
                                    <Space split={<span style={{ color: '#d9d9d9' }}>|</span>}>
                                        <span>发布: {new Date(version.date).toLocaleDateString()}</span>
                                        {version.npm && <span>npm: {version.npm}</span>}
                                    </Space>
                                }
                            />
                        </List.Item>
                    )}
                />
            </>
        );
    };


    return (
        <Modal
            title="安装 Node.js 版本"
            open={visible}
            onCancel={onClose}
            footer={null}
            width={800}
            styles={{ body: { height: 500, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingTop: 16 } }}
        >
            {installing ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Space direction="vertical" style={{ width: '80%' }} size="large">
                        <Progress percent={installProgress} status="active" />
                        <div style={{ textAlign: 'center', fontSize: 14 }}>{installStatus}</div>
                    </Space>
                </div>
            ) : (
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    style={{ height: '100%' }}
                    items={[
                        {
                            key: 'major',
                            label: '推荐版本',
                            children: (
                                <div style={{ height: 430, overflowY: 'auto', padding: '8px 8px 16px' }}>
                                    {renderMajorVersions()}
                                </div>
                            )
                        },
                        {
                            key: 'all',
                            label: '所有版本',
                            children: (
                                <div style={{ display: 'flex', flexDirection: 'column', height: 430 }}>
                                    <div
                                        ref={allVersionsScrollRef}
                                        style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 16px', minHeight: 0 }}
                                    >
                                        {renderAllVersions()}
                                    </div>
                                    {allVersions.length > 0 && (
                                        <div style={{ padding: '8px 0', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
                                            <Pagination
                                                size="small"
                                                current={currentPage}
                                                pageSize={pageSize}
                                                total={allVersions.filter(v => {
                                                    const matchesSearch = v.version.toLowerCase().includes(searchQuery.toLowerCase());
                                                    const matchesLts = showLtsOnly ? v.lts : true;
                                                    return matchesSearch && matchesLts;
                                                }).length}
                                                onChange={(page) => {
                                                    setCurrentPage(page);
                                                    allVersionsScrollRef.current?.scrollTo(0, 0);
                                                }}
                                                showTotal={(total: number) => `共 ${total} 个版本`}
                                                style={{ textAlign: 'right' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        }
                    ]}
                />
            )}
        </Modal>
    );
};

export default VersionInstall;
