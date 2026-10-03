/**
 * Publish Platforms — list registered publishers, dry-run, auth status.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { PublisherDryRunResult, PublisherInfo } from '../services/api/publishers';

const { Title, Paragraph, Text } = Typography;

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
  const [error, setError] = useState('');
  const [dryRunResult, setDryRunResult] = useState<(PublisherDryRunResult & { publisherId: string }) | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.listPublishers();
      if (!Array.isArray(res.data?.data)) throw new Error('发布平台响应无效');
      setRows(res.data.data.map((row) => ({ ...row, notes: row.notes || PLATFORM_NOTES[row.id] })));
      setError('');
    } catch (error) {
      setRows([]);
      setError(error instanceof Error ? error.message : '加载发布平台失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleDryRun = useCallback(async (id: string) => {
    setBusyId(id);
    setDryRunResult(null);
    try {
      const res = await api.dryRunPublish(id);
      const result = res.data?.data;
      if (!result?.status) throw new Error('dry-run 响应无效');
      setDryRunResult({ ...result, publisherId: id });
      if (result.status === 'dry_run') {
        message.success(`${id} dry-run: ${result.message || result.status}`);
      } else if (result.status === 'failed') {
        message.error(`${id} dry-run: ${result.message || result.status}`);
      } else {
        message.warning(`${id} dry-run: ${result.message || result.status}`);
      }
    } catch (error) {
      const details = error instanceof Error ? error.message : 'dry-run 请求失败';
      setDryRunResult({ publisherId: id, status: 'failed', message: details });
      message.error(details);
    } finally {
      setBusyId('');
    }
  }, []);

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
            <Badge status={state === 'ok' ? 'success' : state === 'error' ? 'error' : state === 'expired' ? 'warning' : 'default'} />
            <Text>{state || '未获取状态'}</Text>
            <Tag>{row.enabled ? '已启用' : '未启用'}</Tag>
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
            disabled={loading || Boolean(busyId)}
            onClick={() => handleDryRun(row.id)}
            data-testid={`btn-dryrun-${row.id}`}
          >
            dryRun
          </Button>
        ),
      },
    ],
    [busyId, loading, handleDryRun]
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
      {error && (
        <Alert type="error" showIcon message={error} data-testid="publishers-error" style={{ marginBottom: 16 }} />
      )}
      {dryRunResult && (
        <Alert
          type={dryRunResult.status === 'dry_run' ? 'success' : dryRunResult.status === 'failed' ? 'error' : 'warning'}
          showIcon
          message={`${dryRunResult.publisherId} dry-run: ${dryRunResult.status}`}
          description={dryRunResult.message}
          data-testid="dry-run-result"
          style={{ marginBottom: 16 }}
        />
      )}
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
