import { useState } from 'react';
import { Card, List, Switch, Tag, Typography, Alert, Space } from 'antd';
import { ApiOutlined, CloudUploadOutlined, FolderOutlined } from '@ant-design/icons';

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

export default function Plugins() {
  const [plugins, setPlugins] = useState(PLUGINS);
  return (
    <div data-testid="plugins-page" style={{ padding: 24 }}>
      <Title level={2}>
        <ApiOutlined /> 插件
      </Title>
      <Paragraph type="secondary">第三方 Publisher / Source 扩展，独立子进程运行</Paragraph>
      <Alert
        type="info"
        showIcon
        message="网络白名单"
        description="插件只能访问 manifest.permissions.network 声明的域名；未声明域名会被拒绝。"
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
                data-testid={`toggle-${p.id}`}
                onChange={(v) =>
                  setPlugins((prev) => prev.map((x) => (x.id === p.id ? { ...x, enabled: v } : x)))
                }
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
