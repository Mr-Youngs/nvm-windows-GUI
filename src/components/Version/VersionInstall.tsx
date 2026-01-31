import React, { useState, useEffect, useRef } from 'react';
import {
    Input,
    Modal,
    Tabs,
    Button,
    Tag,
    Space,
    Empty,
    Spin,
    Progress,
    message,
    Pagination,
    Typography
} from 'antd';
import {
    DownloadOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    SearchOutlined,
    GlobalOutlined
} from '@ant-design/icons';

import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const { Text } = Typography;

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
    const { theme } = useTheme();
    const { t } = useLanguage();
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
        } else {
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
            message.error(t('install.messages.syncError'));
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async (version: string) => {
        try {
            setInstalling(true);
            setInstallProgress(0);
            setInstallStatus(t('install.messages.connecting'));

            // 模拟进度动画：让进度条缓慢递增，提升用户体验
            let simulatedProgress = 0;
            const progressInterval = setInterval(() => {
                simulatedProgress += Math.random() * 3 + 1; // 每次增加1-4%
                if (simulatedProgress > 85) {
                    simulatedProgress = 85; // 最多到85%，留余地给真实完成
                }
                setInstallProgress(Math.floor(simulatedProgress));
            }, 500); // 每500ms更新一次

            const result = await window.tauriAPI.installVersion(version);

            // 停止模拟进度
            clearInterval(progressInterval);

            if (result.success) {
                // 快速完成到100%
                setInstallProgress(100);
                setInstallStatus(t('install.messages.completed'));
                await new Promise(resolve => setTimeout(resolve, 500)); // 短暂停留显示100%
                message.success(t('install.success', { version }));
                await loadVersions();
                onClose();
            } else {
                message.error(result.message);
                setInstalling(false);
            }
        } catch (error) {
            message.error(t('install.messages.networkError'));
            setInstalling(false);
        }
    };

    const getVersionTag = (version: AvailableVersion) => {
        if (version.lts) {
            return <Tag color="green" bordered={false} style={{ borderRadius: 4, fontWeight: 600, fontSize: 11 }}>LTS {typeof version.lts === 'string' ? version.lts : ''}</Tag>;
        }
        const majorStr = version.version.startsWith('v') ? version.version.substring(1).split('.')[0] : version.version.split('.')[0];
        const major = parseInt(majorStr);
        // Only show CURRENT for recent odd versions to keep it clean
        if (major % 2 !== 0 && major >= 21) {
            return <Tag color="blue" bordered={false} style={{ borderRadius: 4, fontWeight: 600, fontSize: 11 }}>{t('common.current')}</Tag>;
        }
        return null;
    };

    const renderMajorVersions = () => {
        if (loading) return <div style={{ textAlign: 'center', padding: '60px 0' }}><Spin size="large" tip={t('install.messages.syncing')} /></div>;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {majorVersions.map((item) => (
                    <div
                        key={item.major}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderRadius: 10,
                            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)'
                        }}
                    >
                        <Space size={12}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: item.lts
                                    ? (theme === 'dark' ? 'rgba(0, 184, 148, 0.1)' : 'var(--color-green-light)')
                                    : (theme === 'dark' ? 'rgba(116, 185, 255, 0.1)' : 'var(--color-blue-light)'),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: item.lts ? 'var(--color-green-primary)' : 'var(--color-blue-primary)'
                            }}>
                                {item.lts ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Node.js {item.major}.x</span>
                                    {item.lts && <Tag color="green" bordered={false} style={{ borderRadius: 4, fontWeight: 600, fontSize: 11 }}>{t('common.recommended')}</Tag>}
                                </div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    Latest: {item.latest}
                                </Text>
                            </div>
                        </Space>
                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={() => handleInstall(item.latest)}
                            ghost
                            style={{ borderRadius: 8 }}
                        >
                            {t('common.install')}
                        </Button>
                    </div>
                ))}
            </div>
        );
    };

    const renderAllVersions = () => {
        const filteredVersions = allVersions.filter(v => {
            const matchesSearch = v.version.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesLts = showLtsOnly ? v.lts : true;
            return matchesSearch && matchesLts;
        });

        const paginatedVersions = filteredVersions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: 400 }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    padding: '0 4px'
                }}>
                    <Input
                        placeholder={t('install.searchPlaceholder')}
                        prefix={<SearchOutlined style={{ color: 'var(--text-sec)', opacity: 0.5 }} />}
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        style={{ width: 160 }}
                        size="small"
                        allowClear
                    />
                    <Space size={12}>
                        <span style={{ fontSize: 12, color: 'var(--text-sec)', opacity: 0.7 }}>{t('summary.totalItems', { count: filteredVersions.length })}</span>
                        <Button
                            type={showLtsOnly ? 'primary' : 'default'}
                            size="small"
                            onClick={() => { setShowLtsOnly(!showLtsOnly); setCurrentPage(1); }}
                            style={{ borderRadius: 6 }}
                        >
                            {t('install.ltsOnly')}
                        </Button>
                    </Space>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {paginatedVersions.map((version) => (
                        <div
                            key={version.version}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 16px',
                                borderRadius: 10,
                                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0,0,0,0.01)',
                                border: '1px solid var(--border-subtle)',
                                marginBottom: 4,
                                transition: 'all 0.2s'
                            }}
                            className="version-install-item"
                        >
                            <div style={{ flex: '0 0 100px' }}>
                                <Text strong style={{ fontSize: 15, color: 'var(--text-main)' }}>v{version.version.replace(/^v/, '')}</Text>
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                {getVersionTag(version)}
                            </div>
                            <div style={{ flex: '0 0 100px', textAlign: 'right' }}>
                                <Button
                                    type="text"
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={() => handleInstall(version.version)}
                                    style={{ color: 'var(--color-blue-primary)', fontWeight: 600 }}
                                >
                                    {t('common.install')}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };


    return (
        <Modal
            title={
                <Space size={8}>
                    <GlobalOutlined style={{ color: 'var(--color-blue-primary)' }} />
                    <span style={{ fontWeight: 700 }}>{t('install.title')}</span>
                </Space>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            width={600}
            centered
        >
            {installing ? (
                <div style={{
                    padding: '40px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 20
                }}>
                    <Progress type="circle" percent={installProgress} strokeColor="var(--color-blue-primary)" width={120} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, color: 'var(--text-main)' }}>{t('install.deploying')}</div>
                        <Text type="secondary">{installStatus}</Text>
                    </div>
                </div>
            ) : (
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'major',
                            label: t('install.recommended'),
                            children: (
                                <div style={{ minHeight: 400 }}>{renderMajorVersions()}</div>
                            )
                        },
                        {
                            key: 'all',
                            label: t('install.allVersions'),
                            children: (
                                <div style={{ minHeight: 400 }}>
                                    {renderAllVersions()}
                                    <div style={{ marginTop: 12, textAlign: 'right' }}>
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
                                            showSizeChanger={false}
                                        />
                                    </div>
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
