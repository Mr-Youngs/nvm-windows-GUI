import React, { useState, useEffect, useRef } from 'react';
import {
    Input,
    Tabs,
    Button,
    Tag,
    Space,
    Empty,
    Progress,
    message,
    Pagination,
    Typography
} from 'antd';
import {
    GlobalOutlined,
    PauseCircleOutlined,
    PlayCircleOutlined,
    CloseCircleOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    SearchOutlined,
    DownloadOutlined
} from '@ant-design/icons';

import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import StyledModal from '../Common/StyledModal';

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
    const { state, loadVersions, pauseDownload, resumeDownload, cancelDownload } = useApp();
    const { theme } = useTheme();
    const { t } = useLanguage();
    const [allVersions, setAllVersions] = useState<AvailableVersion[]>([]);
    const [majorVersions, setMajorVersions] = useState<MajorVersionInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('major');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(10);
    const [showLtsOnly, setShowLtsOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const allVersionsScrollRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        if (visible) {
            loadAvailableVersions();
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
            await window.tauriAPI.installVersion(version);
            message.info(t('install.messages.installStarted', { version }));
        } catch (error) {
            message.error(t('install.messages.installError'));
        }
    };

    const handleClose = () => {
        setSearchQuery('');
        setCurrentPage(1);
        setActiveTab('major');
        onClose();
    };

    const renderVersionControl = (versionStr: string) => {
        // Handle both "v20.0.0" and "20.0.0" formats
        const version = versionStr.startsWith('v') ? versionStr : `v${versionStr}`;
        const download = state.activeDownloads[version];
        const isInstalled = state.versions.some(v => v.version === version || `v${v.version}` === version);

        if (isInstalled) {
            return (
                <Tag color="success" bordered={false} icon={<CheckCircleOutlined />} style={{ borderRadius: 6, padding: '2px 8px' }}>
                    {t('common.installed')}
                </Tag>
            );
        }

        if (download) {
            return (
                <Space size={8}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28 }}>
                        <Progress
                            type="circle"
                            percent={download.progress}
                            size={28}
                            strokeWidth={12}
                            showInfo={false}
                            status={download.isPaused ? 'normal' : 'active'}
                            strokeColor={download.isPaused ? '#bfbfbf' : 'var(--color-blue-primary)'}
                        />
                        <span style={{ fontSize: 9, position: 'absolute', fontWeight: 800, color: 'var(--text-main)' }}>
                            {download.progress}%
                        </span>
                    </div>
                    <Space size={0}>
                        <Button
                            type="text"
                            size="small"
                            icon={download.isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                            onClick={() => download.isPaused ? resumeDownload(version) : pauseDownload(version)}
                            style={{ color: 'var(--color-blue-primary)', padding: '0 4px' }}
                        />
                        <Button
                            type="text"
                            size="small"
                            icon={<CloseCircleOutlined />}
                            onClick={() => cancelDownload(version)}
                            style={{ padding: '0 4px' }}
                            danger
                        />
                    </Space>
                </Space>
            );
        }

        return (
            <Button
                type="text"
                icon={<DownloadOutlined />}
                onClick={() => handleInstall(version)}
                style={{ color: 'var(--color-blue-primary)', fontSize: 20, padding: 0 }}
            />
        );
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
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
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
                        {renderVersionControl(item.latest)}
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
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 20px 0 20px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    padding: '0 4px',
                    flexShrink: 0
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
                            <div style={{ flex: '0 0 100px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end' }}>
                                {renderVersionControl(version.version)}
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: 12, textAlign: 'right', flexShrink: 0, paddingBottom: 16 }}>
                    <Pagination
                        size="small"
                        current={currentPage}
                        pageSize={pageSize}
                        total={filteredVersions.length}
                        onChange={(page) => {
                            setCurrentPage(page);
                            allVersionsScrollRef.current?.scrollTo(0, 0);
                        }}
                        showSizeChanger={false}
                    />
                </div>
            </div>
        );
    };


    return (
        <StyledModal
            title={t('install.title')}
            icon={<GlobalOutlined />}
            open={visible}
            onCancel={handleClose}
            width={600}
            height={500}
            loading={loading}
        >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    style={{ padding: '0 20px' }}
                    items={[
                        {
                            key: 'major',
                            label: t('install.recommended'),
                        },
                        {
                            key: 'all',
                            label: t('install.allVersions'),
                        }
                    ]}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    {activeTab === 'major' ? renderMajorVersions() : renderAllVersions()}
                </div>
            </div>
        </StyledModal>
    );
};

export default VersionInstall;
