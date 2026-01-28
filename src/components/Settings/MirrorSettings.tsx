import React, { useState, useEffect } from 'react';
import { Card, Space, Typography, Button, Input, Radio, Tag, Progress, message, Spin, Divider } from 'antd';
import { GlobalOutlined, RocketOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';

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
            message.error('加载镜像信息失败');
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
                    message.success('已切换镜像源');
                    setCurrentMirror(presets.find(p => p.id === presetId)?.nodeUrl || null);
                }
            } catch (error) {
                message.error('切换失败');
            }
        }
    };

    const handleCustomSave = async () => {
        if (!customNodeUrl) {
            message.warning('请输入 Node.js 镜像地址');
            return;
        }
        try {
            const result = await window.tauriAPI.setCustomMirror(customNodeUrl, customNpmUrl);
            if (result.success) {
                message.success('自定义镜像保存成功');
                setCurrentMirror(customNodeUrl);
            }
        } catch (error) {
            message.error('保存失败');
        }
    };

    const testSpeed = async () => {
        try {
            setTestingSpeed(true);
            const results = await window.tauriAPI.testAllMirrorSpeed();
            setSpeedResults(results);
            message.success('测速完成');
        } catch (error) {
            message.error('测速失败');
        } finally {
            setTestingSpeed(false);
        }
    };

    const showCustom = selectedPreset === 'custom';

    return (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card
                title={
                    <Space>
                        <GlobalOutlined />
                        <span>镜像源设置</span>
                    </Space>
                }
                extra={
                    <Button
                        type="link"
                        icon={<RocketOutlined />}
                        onClick={testSpeed}
                        loading={testingSpeed}
                    >
                        一键测速
                    </Button>
                }
            >
                <Spin spinning={loading}>
                    <Radio.Group
                        onChange={handlePresetChange}
                        value={selectedPreset}
                        style={{ width: '100%' }}
                    >
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            {presets.map(preset => {
                                const speedResult = speedResults.find(r => r.mirrorId === preset.id);
                                return (
                                    <Radio
                                        key={preset.id}
                                        value={preset.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            padding: '12px',
                                            border: '1px solid #d9d9d9',
                                            borderRadius: 6,
                                            background: selectedPreset === preset.id ? '#e6f7ff' : 'transparent',
                                            borderColor: selectedPreset === preset.id ? '#1890ff' : '#d9d9d9'
                                        }}
                                    >
                                        <Space direction="vertical" size={0}>
                                            <Space>
                                                <Text strong>{preset.name}</Text>
                                                {currentMirror === preset.nodeUrl && (
                                                    <Tag color="green" icon={<CheckOutlined />}>当前生效</Tag>
                                                )}
                                                {speedResult && (
                                                    speedResult.success ? (
                                                        <Text
                                                            style={{ fontSize: 12, marginLeft: 8 }}
                                                            type={speedResult.latency < 200 ? 'success' : speedResult.latency < 500 ? 'warning' : 'danger'}
                                                        >
                                                            {speedResult.latency}ms
                                                        </Text>
                                                    ) : (
                                                        <Tag color="red" borderless style={{ fontSize: 11 }}>超时</Tag>
                                                    )
                                                )}
                                            </Space>
                                            <Text type="secondary" style={{ fontSize: 12 }}>{preset.nodeUrl}</Text>
                                        </Space>
                                    </Radio>
                                );
                            })}

                            <Radio
                                value="custom"
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    padding: '12px',
                                    border: '1px solid #d9d9d9',
                                    borderRadius: 6,
                                    background: selectedPreset === 'custom' ? '#e6f7ff' : 'transparent',
                                    borderColor: selectedPreset === 'custom' ? '#1890ff' : '#d9d9d9'
                                }}
                            >
                                <Space>
                                    <EditOutlined />
                                    <Text strong>自定义镜像源</Text>
                                </Space>
                            </Radio>
                        </Space>
                    </Radio.Group>

                    {showCustom && (
                        <div style={{ marginTop: 16, padding: 16, background: '#fafafa', borderRadius: 6 }}>
                            <Space direction="vertical" style={{ width: '100%' }}>
                                <div>
                                    <Text>Node.js 镜像地址：</Text>
                                    <Input
                                        value={customNodeUrl}
                                        onChange={(e) => setCustomNodeUrl(e.target.value)}
                                        placeholder="https://example.com/node/"
                                        style={{ marginTop: 4 }}
                                    />
                                </div>
                                <div>
                                    <Text>npm 镜像地址（可选）：</Text>
                                    <Input
                                        value={customNpmUrl}
                                        onChange={(e) => setCustomNpmUrl(e.target.value)}
                                        placeholder="https://example.com/npm/"
                                        style={{ marginTop: 4 }}
                                    />
                                </div>
                                <Button type="primary" onClick={handleCustomSave}>保存自定义镜像</Button>
                            </Space>
                        </div>
                    )}
                </Spin>
            </Card>

            {testingSpeed && (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <Spin size="small" tip="测速中..." />
                </div>
            )}
        </Space>
    );
};

export default MirrorSettings;
