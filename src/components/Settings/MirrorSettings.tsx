import React, { useState, useEffect } from 'react';
import { Card, Space, Typography, Button, Input, Radio, Tag, Progress, message, Spin, Divider, Tooltip } from 'antd';
import { GlobalOutlined, RocketOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const { Text, Title } = Typography;

interface MirrorPreset {
    id: string;
    name: string;
    nodeUrl: string;
    npmUrl: string;
}

interface SpeedResult {
    mirrorId: string;
    latency: number;
    success: boolean;
}

const MirrorSettings: React.FC = () => {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const [presets, setPresets] = useState<MirrorPreset[]>([]);
    const [currentMirror, setCurrentMirror] = useState<string | null>(null);
    const [selectedPreset, setSelectedPreset] = useState<string>('');
    const [customNodeUrl, setCustomNodeUrl] = useState('');
    const [customNpmUrl, setCustomNpmUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [testingSpeed, setTestingSpeed] = useState(false);
    const [speedResults, setSpeedResults] = useState<SpeedResult[]>([]);

    useEffect(() => {
        loadMirrorInfo();
    }, []);

    const loadMirrorInfo = async () => {
        try {
            setLoading(true);
            const [presetList, currentInfo] = await Promise.all([
                window.tauriAPI.getMirrorPresets(),
                window.tauriAPI.getCurrentMirror()
            ]);
            setPresets(presetList);
            const nodeUrl = currentInfo.nodeUrl;
            setCurrentMirror(nodeUrl);

            // 识别当前预设
            const activePreset = presetList.find((p: MirrorPreset) => p.nodeUrl === nodeUrl);
            if (activePreset) {
                setSelectedPreset(activePreset.id);
            } else if (nodeUrl && nodeUrl !== 'https://nodejs.org/dist/') {
                setSelectedPreset('custom');
                setCustomNodeUrl(nodeUrl);
                setCustomNpmUrl(currentInfo.npmUrl || '');
            }
        } catch (error) {
            message.error(t('settings.mirror.messages.loadError'));
        } finally {
            setLoading(false);
        }
    };

    const handlePresetChange = async (e: any) => {
        const presetId = e.target.value;
        setSelectedPreset(presetId);
        if (presetId !== 'custom') {
            try {
                const result = await window.tauriAPI.switchMirrorPreset(presetId);
                if (result.success) {
                    message.success(t('settings.mirror.messages.switchSuccess'));
                    setCurrentMirror(presets.find(p => p.id === presetId)?.nodeUrl || null);
                }
            } catch (error) {
                message.error(t('settings.mirror.messages.switchError'));
            }
        }
    };

    const handleCustomSave = async () => {
        try {
            const result = await window.tauriAPI.setCustomMirror(customNodeUrl, customNpmUrl);
            if (result.success) {
                message.success(t('settings.mirror.messages.saveSuccess'));
                setCurrentMirror(customNodeUrl);
            }
        } catch (error) {
            message.error(t('settings.mirror.messages.saveError'));
        }
    };

    const testSpeed = async () => {
        try {
            setTestingSpeed(true);
            const results = await window.tauriAPI.testAllMirrorSpeed();
            setSpeedResults(results);
            message.success(t('settings.mirror.messages.testSuccess'));
        } catch (error) {
            message.error(t('settings.mirror.messages.testError'));
        } finally {
            setTestingSpeed(false);
        }
    };

    const showCustom = selectedPreset === 'custom';

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card
                className="glass-card bg-deco-container"
                title={
                    <Space size={10}>
                        <GlobalOutlined style={{ color: 'var(--color-blue-primary)' }} />
                        <span style={{ fontWeight: 700 }}>{t('settings.mirror.title')}</span>
                    </Space>
                }
                extra={
                    <Tooltip title={t('settings.mirror.speedTest')}>
                        <Button
                            type="primary"
                            icon={<RocketOutlined />}
                            onClick={testSpeed}
                            loading={testingSpeed}
                            style={{ background: 'var(--color-green-primary)', borderRadius: 8 }}
                        />
                    </Tooltip>
                }
            >
                <div className="bg-deco-text">SPEED</div>
                <Spin spinning={loading}>
                    <Radio.Group
                        onChange={handlePresetChange}
                        value={selectedPreset}
                        style={{ width: '100%' }}
                    >
                        <Space direction="vertical" style={{ width: '100%' }} size="small">
                            {presets.map(preset => {
                                const speedResult = speedResults.find(r => r.mirrorId === preset.id);
                                const isActive = selectedPreset === preset.id;
                                const isUsed = currentMirror === preset.nodeUrl;
                                return (
                                    <Radio
                                        key={preset.id}
                                        value={preset.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '12px 16px',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 12,
                                            background: isActive
                                                ? (theme === 'dark' ? 'rgba(116, 185, 255, 0.15)' : 'var(--color-blue-light)')
                                                : 'rgba(0,0,0,0.01)',
                                            borderColor: isActive ? 'var(--color-blue-primary)' : 'var(--border-subtle)',
                                            transition: 'all 0.3s',
                                            width: '100%'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginLeft: 8 }}>
                                            <Space direction="vertical" size={0}>
                                                <Space>
                                                    <Text style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>{preset.name}</Text>
                                                    {isUsed && (
                                                        <Tooltip title={t('settings.mirror.currentlyActive')}>
                                                            <CheckOutlined style={{ color: 'var(--color-blue-primary)', fontWeight: 'bold' }} />
                                                        </Tooltip>
                                                    )}
                                                </Space>
                                                <Text type="secondary" style={{ fontSize: 12, opacity: 0.6 }}>{preset.nodeUrl}</Text>
                                            </Space>
                                            {speedResult && (
                                                speedResult.success ? (
                                                    <Text
                                                        style={{ fontSize: 13, fontWeight: 600 }}
                                                        type={speedResult.latency < 200 ? 'success' : speedResult.latency < 500 ? 'warning' : 'danger'}
                                                    >
                                                        {speedResult.latency}ms
                                                    </Text>
                                                ) : (
                                                    <Tag color="red" bordered={false} style={{ fontSize: 11, borderRadius: 4 }}>{t('settings.mirror.timeout')}</Tag>
                                                )
                                            )}
                                        </div>
                                    </Radio>
                                );
                            })}

                            <Radio
                                value="custom"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 12,
                                    background: selectedPreset === 'custom'
                                        ? (theme === 'dark' ? 'rgba(116, 185, 255, 0.15)' : 'var(--color-blue-light)')
                                        : 'rgba(0,0,0,0.01)',
                                    borderColor: selectedPreset === 'custom' ? 'var(--color-blue-primary)' : 'var(--border-subtle)',
                                    transition: 'all 0.3s',
                                    width: '100%'
                                }}
                            >
                                <Space style={{ marginLeft: 8 }}>
                                    <EditOutlined style={{ color: selectedPreset === 'custom' ? 'var(--color-blue-primary)' : 'inherit' }} />
                                    <Text style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>{t('settings.mirror.custom')}</Text>
                                </Space>
                            </Radio>
                        </Space>
                    </Radio.Group>

                    {showCustom && (
                        <div style={{ marginTop: 16, padding: 16, background: 'rgba(0,0,0,0.02)', borderRadius: 12, border: '1px dashed var(--border-subtle)' }}>
                            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                <Input
                                    value={customNodeUrl}
                                    onChange={(e) => setCustomNodeUrl(e.target.value)}
                                    placeholder={t('settings.mirror.placeholderNode')}
                                    addonBefore={<GlobalOutlined />}
                                />
                                <Input
                                    value={customNpmUrl}
                                    onChange={(e) => setCustomNpmUrl(e.target.value)}
                                    placeholder={t('settings.mirror.placeholderNpm')}
                                    addonBefore={<GlobalOutlined />}
                                />
                                <Button type="primary" size="large" onClick={handleCustomSave} style={{ width: '100%', background: 'var(--color-blue-primary)', borderRadius: 10 }}>{t('settings.mirror.save')}</Button>
                            </Space>
                        </div>
                    )}
                </Spin>
            </Card>

            {testingSpeed && (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <Spin size="small" tip={t('settings.mirror.testing')} />
                </div>
            )}
        </Space>
    );
};

export default MirrorSettings;
