import React, { useState, useEffect } from 'react';
import { Button, Typography, Space, Card, Progress, Spin, Input, Alert, Divider } from 'antd';
import {
    FolderOpenOutlined,
    CheckCircleOutlined,
    RocketOutlined,
    InfoCircleOutlined,
    DownloadOutlined,
    LoadingOutlined,
    WarningOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import logoImage from '../../assets/logo.png';

const { Title, Paragraph, Text } = Typography;

type InstallStep = 'detecting' | 'not-installed' | 'installing' | 'success' | 'error';

const ConfigWizard: React.FC = () => {
    const { state, selectNvmPath, loadConfig } = useApp();
    const { t } = useLanguage();

    const [step, setStep] = useState<InstallStep>('detecting');
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [defaultPaths, setDefaultPaths] = useState<{
        nvmHome: string;
        nvmSymlink: string;
        globalPrefix: string;
    } | null>(null);
    const [customNvmPath, setCustomNvmPath] = useState('');
    const [customSymlinkPath, setCustomSymlinkPath] = useState('');

    useEffect(() => {
        checkInstallation();
    }, []);

    useEffect(() => {
        // 监听安装进度事件
        window.tauriAPI.onNvmInstallProgress((prog, status) => {
            setProgress(prog);
            setStatusText(status);
        });
    }, []);

    const checkInstallation = async () => {
        try {
            setStep('detecting');
            const status = await window.tauriAPI.checkNvmInstallation();

            if (status.installed && status.nvmHome) {
                // 已安装，直接加载配置
                await loadConfig();
            } else {
                // 未安装，获取默认路径
                const paths = await window.tauriAPI.getDefaultPaths();
                setDefaultPaths(paths);
                setCustomNvmPath(paths.nvmHome);
                setCustomSymlinkPath(paths.nvmSymlink);
                setStep('not-installed');
            }
        } catch (error) {
            console.error('检测安装状态失败:', error);
            // 如果检测失败，仍然显示安装选项
            try {
                const paths = await window.tauriAPI.getDefaultPaths();
                setDefaultPaths(paths);
                setCustomNvmPath(paths.nvmHome);
                setCustomSymlinkPath(paths.nvmSymlink);
            } catch { }
            setStep('not-installed');
        }
    };

    const handleAutoInstall = async () => {
        try {
            setStep('installing');
            setProgress(0);
            setStatusText(t('wizard.downloading'));

            const result = await window.tauriAPI.downloadAndInstallNvm(
                customNvmPath,
                customSymlinkPath
            );

            if (result.success) {
                setStep('success');
                // 等待一下让用户看到成功消息
                setTimeout(async () => {
                    await loadConfig();
                    // 强制通知 AppContent 更新，虽然 loadConfig 应该已经做了
                    // 但在某些竞态条件下，显式改变 step 可能也有助于清理本地状态
                }, 1500);
            } else {
                setErrorMessage(result.message);
                setStep('error');
            }
        } catch (error: any) {
            setErrorMessage(error.toString());
            setStep('error');
        }
    };

    const selectCustomPath = async (type: 'nvm' | 'symlink') => {
        const path = await window.tauriAPI.selectDirectory();
        if (path) {
            if (type === 'nvm') {
                setCustomNvmPath(path);
            } else {
                setCustomSymlinkPath(path);
            }
        }
    };


    // 检测中
    if (step === 'detecting') {
        return (
            <Card className="glass-card" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 48, color: 'var(--color-blue-primary)' }} spin />} />
                <Title level={4} style={{ marginTop: 24, marginBottom: 8 }}>
                    {t('wizard.detectStatus')}
                </Title>
            </Card>
        );
    }

    // 安装中
    if (step === 'installing') {
        return (
            <Card className="glass-card" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
                <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: 'var(--gradient-mint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    color: 'white'
                }}>
                    <DownloadOutlined style={{ fontSize: 32 }} />
                </div>
                <Title level={4} style={{ marginBottom: 8 }}>
                    {t('wizard.downloading')}
                </Title>
                <Progress
                    percent={progress}
                    status="active"
                    strokeColor={{
                        '0%': '#00b894',
                        '100%': '#00cec9',
                    }}
                    style={{ marginBottom: 16 }}
                />
                <Text type="secondary">{statusText}</Text>
            </Card>
        );
    }

    // 安装成功
    if (step === 'success') {
        return (
            <Card className="glass-card" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
                <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #00b894 0%, #00cec9 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    color: 'white'
                }}>
                    <CheckCircleOutlined style={{ fontSize: 32 }} />
                </div>
                <Title level={4} style={{ marginBottom: 8, color: '#00b894' }}>
                    {t('wizard.installSuccess')}
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                    {t('wizard.installSuccessDesc')}
                </Paragraph>
                <Alert
                    type="info"
                    icon={<InfoCircleOutlined />}
                    message={t('wizard.restartTerminal')}
                    style={{ textAlign: 'left' }}
                />
            </Card>
        );
    }

    // 安装失败
    if (step === 'error') {
        return (
            <Card className="glass-card" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
                <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: 'var(--color-blue-primary)',
                    opacity: 0.1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    color: 'var(--color-blue-primary)'
                }}>
                    <WarningOutlined style={{ fontSize: 32 }} />
                </div>
                <Title level={4} style={{ marginBottom: 8, color: '#d63031' }}>
                    {t('wizard.installError')}
                </Title>
                <Alert
                    type="error"
                    message={errorMessage}
                    style={{ marginBottom: 24, textAlign: 'left' }}
                />
                <Space>
                    <Button onClick={() => setStep('not-installed')}>
                        {t('common.back')}
                    </Button>
                    <Button type="primary" onClick={handleAutoInstall}>
                        {t('common.refresh')}
                    </Button>
                </Space>
            </Card>
        );
    }

    // 未安装 - 显示安装选项
    return (
        <Card className="glass-card" style={{ maxWidth: 550, margin: '0 auto', padding: '12px 12px' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{
                    width: 80,
                    height: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    boxShadow: '0 12px 40px -4px rgba(9, 132, 227, 0.3), 0 12px 40px -4px rgba(0, 184, 148, 0.3)',
                    borderRadius: '50%',
                    overflow: 'hidden'
                }}>
                    <img src={logoImage} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <Title level={3} style={{ marginBottom: 8, color: 'var(--primary-mint)' }}>
                    {t('wizard.welcome.title')}
                </Title>
                <Text type="secondary">
                    {t('wizard.welcome.desc')}
                </Text>
            </div>

            {/* 检测到未安装 */}
            <Alert
                type="warning"
                icon={<WarningOutlined />}
                message={t('wizard.notInstalled')}
                description={t('wizard.notInstalledDesc')}
                style={{ marginBottom: 24 }}
            />

            {/* 安装路径设置 */}
            <div style={{
                background: 'var(--primary-bg)',
                padding: 20,
                borderRadius: 10,
                marginBottom: 24,
                border: '1px solid var(--glass-border)'
            }}>
                <Title level={5} style={{ marginBottom: 16 }}>
                    {t('wizard.selectInstallDir')}
                </Title>

                <div style={{ marginBottom: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                        NVM 安装目录
                    </Text>
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            value={customNvmPath}
                            onChange={e => setCustomNvmPath(e.target.value)}
                            placeholder={defaultPaths?.nvmHome}
                        />
                        <Button icon={<FolderOpenOutlined />} onClick={() => selectCustomPath('nvm')} />
                    </Space.Compact>
                </div>

                <div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                        Node.js 符号链接目录
                    </Text>
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            value={customSymlinkPath}
                            onChange={e => setCustomSymlinkPath(e.target.value)}
                            placeholder={defaultPaths?.nvmSymlink}
                        />
                        <Button icon={<FolderOpenOutlined />} onClick={() => selectCustomPath('symlink')} />
                    </Space.Compact>
                </div>
            </div>

            <Button
                type="primary"
                size="large"
                block
                icon={<DownloadOutlined />}
                onClick={handleAutoInstall}
                style={{ height: 48, fontSize: 15, marginBottom: 16 }}
            >
                {t('wizard.installAuto')}
            </Button>

            <Divider plain style={{ margin: '16px 0', color: 'var(--text-muted)' }}>
                或者
            </Divider>

            <Button
                size="large"
                block
                icon={<FolderOpenOutlined />}
                onClick={selectNvmPath}
                style={{ height: 44, fontSize: 14 }}
            >
                {t('wizard.installManual')}
            </Button>
        </Card >
    );
};

export default ConfigWizard;
