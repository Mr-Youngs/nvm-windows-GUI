import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Input, Button, Space, Typography, Divider, Tabs, Segmented } from 'antd';
import {
    FolderOpenOutlined,
    GlobalOutlined,
    SettingOutlined,
    BgColorsOutlined,
    InfoCircleOutlined,
    SunOutlined,
    MoonOutlined
} from '@ant-design/icons';
import { useApp } from '../../context/AppContext';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import MirrorSettings from './MirrorSettings';

const { Title, Text } = Typography;

const SettingsPage: React.FC = () => {
    const { state, selectNvmPath } = useApp();
    const { theme, setTheme } = useTheme();
    const { t } = useLanguage();

    const generalSettings = (
        <div style={{ maxWidth: 600 }}>
            <Form layout="vertical">
                <Form.Item label={t('settings.nvmPath')}>
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            value={state.config?.nvmPath || ''}
                            readOnly
                            placeholder={t('settings.selectPathTip')}
                            style={{ background: 'rgba(0,0,0,0.02)' }}
                        />
                        <Button
                            icon={<FolderOpenOutlined />}
                            onClick={selectNvmPath}
                        >
                            {t('common.select')}
                        </Button>
                    </Space.Compact>
                </Form.Item>

                <Form.Item label={t('settings.nvmSymlink')}>
                    <Input
                        value={state.config?.nvmSymlink || ''}
                        readOnly
                        style={{ background: 'rgba(0,0,0,0.02)' }}
                    />
                </Form.Item>
            </Form>

            <Divider dashed />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t('settings.appVersion')}</Text>
                    <div style={{ fontWeight: 600 }}>v1.0.0 Stable</div>
                </div>
                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{t('settings.lastUpdated')}</Text>
                    <div style={{ fontWeight: 600 }}>
                        {state.config?.lastUpdated ? new Date(state.config.lastUpdated).toLocaleDateString() : t('settings.neverSynced')}
                    </div>
                </div>
            </div>
        </div>
    );

    const themeSettings = (
        <div style={{ maxWidth: 500 }}>
            <Title level={5} style={{ marginBottom: 20 }}>{t('settings.theme.title')}</Title>
            <Segmented
                block
                size="large"
                value={theme}
                onChange={(value) => setTheme(value as ThemeMode)}
                options={[
                    {
                        label: (
                            <div style={{ padding: 8 }}>
                                <SunOutlined />
                                <div style={{ fontSize: 12 }}>{t('settings.theme.lightDesc')}</div>
                            </div>
                        ),
                        value: 'light',
                    },
                    {
                        label: (
                            <div style={{ padding: 8 }}>
                                <MoonOutlined />
                                <div style={{ fontSize: 12 }}>{t('settings.theme.darkDesc')}</div>
                            </div>
                        ),
                        value: 'dark',
                    },
                ]}
            />
            <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--primary-bg)', borderRadius: 8 }}>
                <InfoCircleOutlined style={{ color: 'var(--primary)' }} />
                <Text type="secondary" style={{ fontSize: 13 }}>{t('settings.theme.tip')}</Text>
            </div>
        </div>
    );

    const tabItems = [
        {
            key: 'general',
            label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <SettingOutlined />
                    {t('settings.tabs.general')}
                </span>
            ),
            children: generalSettings
        },
        {
            key: 'mirror',
            label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GlobalOutlined />
                    {t('settings.tabs.mirror')}
                </span>
            ),
            children: <MirrorSettings />
        },
        {
            key: 'theme',
            label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BgColorsOutlined />
                    {t('settings.tabs.theme')}
                </span>
            ),
            children: themeSettings
        }
    ];

    return (
        <Card className="glass-card">
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <SettingOutlined style={{ fontSize: 24, color: 'var(--color-blue-primary)' }} />
                <Title level={4} style={{ margin: 0, fontWeight: 700 }}>{t('settings.title')}</Title>
            </div>
            <Tabs
                items={tabItems}
                tabBarGutter={32}
                style={{ marginTop: -8 }}
            />
        </Card>
    );
};

export default SettingsPage;
