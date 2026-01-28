import React from 'react';
import { Card, Button, Typography, Space, Alert } from 'antd';
import { FolderOpenOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useApp } from '../../context/AppContext';

const { Title, Paragraph } = Typography;

const ConfigWizard: React.FC = () => {
    const { state, selectNvmPath } = useApp();

    if (state.config && state.config.nvmPath) {
        return (
            <Card style={{ maxWidth: 600, margin: '0 auto' }}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div style={{ textAlign: 'center' }}>
                        <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
                    </div>
                    <Title level={3} style={{ textAlign: 'center' }}>配置完成</Title>
                    <Alert
                        message="nvm-windows 路径已配置"
                        description={`当前路径: ${state.config.nvmPath}`}
                        type="success"
                        showIcon
                    />
                </Space>
            </Card>
        );
    }

    return (
        <Card style={{ maxWidth: 600, margin: '0 auto' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Title level={3} style={{ textAlign: 'center' }}>欢迎使用 nvm-windows GUI</Title>

                <Alert
                    message="需要配置 nvm-windows 路径"
                    description="首次使用需要指定 nvm-windows 的安装目录。"
                    type="info"
                    showIcon
                />

                <Paragraph>
                    请选择 nvm-windows 的安装目录。通常位于：
                </Paragraph>
                <ul>
                    <li><code>C:\Users\[用户名]\AppData\Roaming\nvm</code></li>
                    <li>或您自定义的安装路径</li>
                </ul>

                <Button
                    type="primary"
                    size="large"
                    icon={<FolderOpenOutlined />}
                    onClick={selectNvmPath}
                    block
                >
                    选择安装目录
                </Button>
            </Space>
        </Card>
    );
};

export default ConfigWizard;
