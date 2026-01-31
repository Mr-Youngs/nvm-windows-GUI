import React from 'react';
import { Button, Typography, Space, Alert, Card } from 'antd';
import {
    FolderOpenOutlined,
    CheckCircleOutlined,
    RocketOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';

const { Title, Paragraph, Text } = Typography;

const ConfigWizard: React.FC = () => {
    const { state, selectNvmPath } = useApp();
    const { t } = useLanguage();

    if (state.config && state.config.nvmPath) {
        return (
            <Card style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
                <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: 'var(--primary-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    color: 'var(--primary-mint)'
                }}>
                    <CheckCircleOutlined style={{ fontSize: 32 }} />
                </div>
                <Title level={4} style={{ marginBottom: 8 }}>{t('wizard.completed.title')}</Title>
                <Paragraph type="secondary" style={{ marginBottom: 24 }}>
                    {t('wizard.completed.desc')}
                </Paragraph>
                <div style={{
                    textAlign: 'left',
                    padding: 16,
                    background: 'rgba(0,0,0,0.02)',
                    borderRadius: 8,
                    border: '1px solid var(--glass-border)'
                }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{t('wizard.currentPath')}</div>
                    <code>{state.config.nvmPath}</code>
                </div>
            </Card>
        );
    }

    return (
        <Card style={{ maxWidth: 500, margin: '0 auto', padding: '12px 12px' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: 'var(--gradient-mint)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    color: 'white',
                    boxShadow: '0 8px 24px rgba(0, 184, 148, 0.2)'
                }}>
                    <RocketOutlined style={{ fontSize: 28 }} />
                </div>
                <Title level={3} style={{ marginBottom: 8, color: 'var(--primary-mint)' }}>
                    {t('wizard.welcome.title')}
                </Title>
                <Text type="secondary">
                    {t('wizard.welcome.desc')}
                </Text>
            </div>

            <div style={{
                background: 'var(--primary-bg)',
                padding: 20,
                borderRadius: 10,
                marginBottom: 32,
                border: '1px solid var(--glass-border)'
            }}>
                <Title level={5} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <InfoCircleOutlined style={{ color: 'var(--primary-mint)' }} />
                    {t('wizard.guide.title')}
                </Title>
                <Paragraph style={{ fontSize: 14, margin: 0 }}>
                    {t('wizard.guide.desc')}
                </Paragraph>
            </div>

            <Button
                type="primary"
                size="large"
                block
                icon={<FolderOpenOutlined />}
                onClick={selectNvmPath}
                style={{ height: 48, fontSize: 15 }}
            >
                {t('wizard.associateBtn')}
            </Button>
        </Card>
    );
};

export default ConfigWizard;
