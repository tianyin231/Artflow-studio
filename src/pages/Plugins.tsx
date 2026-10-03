import { useState } from 'react';
import { Card, List, Switch, Tag, Typography, Alert, Space, message } from 'antd';
import { ApiOutlined, CloudUploadOutlined, FolderOutlined } from '@ant-design/icons';
import { isRecord, readLocalJson, writeLocalJson } from '../utils/localStorage';

const { Title, Paragraph } = Typography;

const PLUGINS = [
  {
    id: 'publisher-webdav',
    name: 'WebDAV 发布',
    type: 'publisher',
    permissions: ['network: dav.example.com', 'fs: exports/'],
    enabled: true,
    description: '将发布包上传到 WebDAV',
  },
  {
    id: 'publisher-s3',
    name: 'S3 兼容发布',
    type: 'publisher',
    permissions: ['network: s3.example.com'],
    enabled: false,
    description: 'S3 签名 v4 上传',
  },
  {
    id: 'source-local-folder',
    name: '本地文件夹素材源',
    type: 'source',
    permissions: ['fs: ~/Pictures'],
    enabled: true,
    description: '替代 Pixiv 的本地/RSS 素材源',
  },
];

const STORAGE_KEY = 'artflow-plugin-preferences-v1';

function isPreferences(value: unknown): value is Record<string, boolean> {
  return isRecord(value) && Object.values(value).every((enabled) => typeof enabled === 'boolean');
}

export default function Plugins() {
  const [plugins, setPlugins] = useState(() => {
    const preferences = readLocalJson(STORAGE_KEY, {} as Record<string, boolean>, isPreferences);
    return PLUGINS.map((plugin) => ({
      ...plugin,
      enabled: preferences[plugin.id] ?? plugin.enabled,
    }));
  });

  const setEnabled = (id: string, enabled: boolean) => {
    const next = plugins.map((plugin) => (plugin.id === id ? { ...plugin, enabled } : plugin));
    if (
      !writeLocalJson(
        STORAGE_KEY,
        Object.fromEntries(next.map((plugin) => [plugin.id, plugin.enabled]))
      )
    ) {
      message.error('无法保存插件偏好，请检查浏览器存储权限或空间');
      return;
    }
    setPlugins(next);
  };
  return (
    <div data-testid="plugins-page" style={{ padding: 24 }}>
      <Title level={2}>
        <ApiOutlined /> 插件
      </Title>
      <Paragraph type="secondary">Publisher / Source 扩展示例与本地启用偏好</Paragraph>
      <Alert
        type="info"
        showIcon
        message="本地插件预览"
        description="权限列表为示例声明。启用偏好仅保存在此浏览器，插件执行服务尚未接入。"
        style={{ marginBottom: 16 }}
      />
      <List
        dataSource={plugins}
        renderItem={(p) => (
          <Card
            key={p.id}
            data-testid={`plugin-${p.id}`}
            style={{ marginBottom: 12 }}
            title={
              <Space>
                {p.type === 'publisher' ? <CloudUploadOutlined /> : <FolderOutlined />}
                {p.name}
                <Tag>{p.type}</Tag>
              </Space>
            }
            extra={
              <Switch
                checked={p.enabled}
                aria-label={`${p.name} 启用偏好`}
                data-testid={`toggle-${p.id}`}
                onChange={(v) => setEnabled(p.id, v)}
              />
            }
          >
            <Paragraph>{p.description}</Paragraph>
            <Space wrap>
              {p.permissions.map((perm) => (
                <Tag key={perm} color="geekblue">
                  {perm}
                </Tag>
              ))}
            </Space>
          </Card>
        )}
      />
    </div>
  );
}
