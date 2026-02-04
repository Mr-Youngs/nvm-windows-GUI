import React from 'react';
import { Modal, Spin, Typography, Space } from 'antd';
import { useTheme } from '../../context/ThemeContext';

const { Text } = Typography;

interface StyledModalProps {
    title: string | React.ReactNode;
    icon?: React.ReactNode;
    open: boolean;
    onCancel: () => void;
    width?: number;
    height?: number | string;
    loading?: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
    styles?: any;
    centered?: boolean;
    destroyOnClose?: boolean;
}

const StyledModal: React.FC<StyledModalProps> = ({
    title,
    icon,
    open,
    onCancel,
    width = 600,
    height = 450,
    loading = false,
    children,
    footer = null,
    styles = {},
    centered = true,
    destroyOnClose = true
}) => {
    const { theme } = useTheme();

    return (
        <Modal
            title={
                <Space size={8}>
                    {icon && <span style={{ color: 'var(--color-blue-primary)', display: 'flex' }}>{icon}</span>}
                    <Text strong style={{ fontSize: 16 }}>{title}</Text>
                </Space>
            }
            open={open}
            onCancel={onCancel}
            footer={footer}
            width={width}
            centered={centered}
            destroyOnClose={destroyOnClose}
            styles={{
                ...styles,
                content: {
                    background: 'var(--bg-glass-modal)',
                    backdropFilter: 'blur(24px) saturate(190%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(190%)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-glass)',
                    padding: 0,
                    overflow: 'hidden',
                    ...styles.content
                },
                header: {
                    background: 'transparent',
                    borderBottom: '1px solid var(--border-glass)',
                    padding: '16px 24px',
                    marginBottom: 0,
                    ...styles.header
                },
                body: {
                    padding: 0,
                    overflow: 'hidden',
                    background: 'transparent',
                    ...styles.body
                }
            }}
        >
            <div style={{ height, overflow: 'hidden', position: 'relative' }}>
                <Spin spinning={loading} style={{ height: '100%', width: '100%' }}>
                    <div style={{
                        height,
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: 'auto',
                        overflowX: 'hidden'
                    }}>
                        {children}
                    </div>
                </Spin>
            </div>
        </Modal>
    );
};

export default StyledModal;
