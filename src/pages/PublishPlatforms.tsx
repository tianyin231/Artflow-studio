/**
 * Publish Platforms — list registered publishers, dry-run, auth status.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { CloudUploadOutlined, ExperimentOutlined, FileTextOutlined } from '@ant-design/icons';
import { api } from '../services/api';

const { Title, Paragraph, Text } = Typography;

export interface PublisherInfo {
  id: string;
  displayName: string;
  enabled: boolean;
  experimental?: boolean;
  manualOnly?: boolean;
  auth: string;
  notes?: string;
  state?: string;
}

const PLATFORM_NOTES: Record<string, string> = {
  'local-export': '完全可行，是手动发布平台的兜底。生成本地发布包目录。',
  bilibili: '需要开放平台开发者资质；access_token 通过 OAuth 获取并定期刷新。',
  'wallpaper-engine-package': '生成 WE 视频壁纸项目目录，可导入 WE 编辑器。完全离线。',
  'steam-workshop': '实验性：steamcmd 上传仅用于测试；优先用 WE 编辑器导入 local 包。',
  youtube: '可行。未审核 API 项目上传视频会被锁定 private；注意日配额。',
  douyin: '仅企业/机构主体网站应用可申请，个人主体不支持；默认关闭。',
  xiaohongshu: '无公开发布 API，仅导出发布包后人工上传。',
  telegram: 'Bot API sendVideo，≤50MB，适合真实可测通道。',
  'discord-webhook': 'Webhook multipart 上传，约 25MB 以内。',
};

export default function PublishPlatforms() {
  const [rows, setRows] = useState<PublisherInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listPublishers?.();
      const list = (res?.data?.data ?? []) as PublisherInfo[];
      setRows(list);
    } catch {
      // fallback catalog when API not yet mounted
      setRows(
        Object.entries(PLATFORM_NOTES).map(([id, notes]) => ({
          id,
          displayName: id,
          enabled: id === 'local-export' || id === 'wallpaper-engine-package',
          experimental: id === 'steam-workshop' || id === 'douyin',
          manualOnly: id === 'xiaohongshu',
          auth: 'none',
          notes,
          state: 'not_configured',
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleDryRun = async (id: string) => {
    setBusyId(id);
    try {
      const res = await api.dryRunPublish?.(id);
      const status = res?.data?.data?.status ?? 'dry_run';
      message.success(`${id} dry-run: ${status}`);
    } catch {
      message.warning(`${id} dry-run 请求失败（可能未配置）`);
    } finally {
      setBusyId('');
    }
  };

  const columns = useMemo(
    () => [
      {
        title: '平台',
        dataIndex: 'id',
        key: 'id',
        render: (_: unknown, row: PublisherInfo) => (
          <Space data-testid={`platform-${row.id}`}>
            <CloudUploadOutlined />
            <span>{row.displayName || row.id}</span>
            {row.experimental && <Tag color="orange">实验性</Tag>}
            {row.manualOnly && <Tag color="blue">仅导出</Tag>}
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'state',
        key: 'state',
        render: (state: string, row: PublisherInfo) => (
          <Space>
            <Badge status={row.enabled ? 'success' : 'default'} />
            <Text>{state || (row.enabled ? 'ok' : 'not_configured')}</Text>
          </Space>
        ),
      },
      {
        title: '可行性 / 限制',
        dataIndex: 'notes',
        key: 'notes',
        render: (notes: string) => <Text type="secondary">{notes}</Text>,
      },
      {
        title: '操作',
        key: 'actions',
        render: (_: unknown, row: PublisherInfo) => (
          <Button
            size="small"
            loading={busyId === row.id}
            onClick={() => handleDryRun(row.id)}
            data-testid={`btn-dryrun-${row.id}`}
          >
            dryRun
          </Button>
        ),
      },
    ],
    [busyId]
  );

  return (
    <div data-testid="publish-platforms-page" style={{ padding: 24 }}>
      <Title level={2}>
        <FileTextOutlined /> 发布平台
      </Title>
      <Paragraph type="secondary">
        默认仅启用 local-export 与 wallpaper-engine-package。其他平台需手动启用；fixture
        模式下全部指向 mock。实验性 / 仅导出平台带标签。
      </Paragraph>
      <Alert
        type="info"
        showIcon
        icon={<ExperimentOutlined />}
        message="小红书 / 抖音 / Steam Workshop 说明"
        description="小红书无公开 API 仅导出；抖音需企业资质；Steam Workshop 为实验性，优先用 WE 编辑器导入 local 包。"
        style={{ marginBottom: 16 }}
      />
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={columns as never}
          pagination={false}
          data-testid="publishers-table"
        />
      </Card>
      <Button style={{ marginTop: 16 }} onClick={() => void load()}>刷新状态</Button>
    </div>
  );
}
