import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Row,
  Col,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { ApiOutlined, CloudUploadOutlined, StopOutlined, SendOutlined, EyeOutlined, SaveOutlined } from '@ant-design/icons';
import {
  useBilibiliPublishSettings,
  useCancelPublishJob,
  usePublishJobs,
  useSaveBilibiliPublishSettings,
  useSubmitPublishJob,
  useTestBilibiliPublishSettings,
} from '../hooks/useWorkflow';
import { PublishJob } from '../services/api/types';

const { Paragraph, Text, Title } = Typography;

export default function PublishJobs() {
  const [settingsForm] = Form.useForm();
  const { jobs, isLoading } = usePublishJobs();
  const { settings } = useBilibiliPublishSettings();
  const saveSettings = useSaveBilibiliPublishSettings();
  const testSettings = useTestBilibiliPublishSettings();
  const submitJob = useSubmitPublishJob();
  const cancelJob = useCancelPublishJob();
  const [previewJob, setPreviewJob] = useState<PublishJob | null>(null);

  useEffect(() => {
    if (settings) {
      settingsForm.setFieldsValue(settings);
    }
  }, [settings, settingsForm]);

  const handleSubmit = async (job: PublishJob) => {
    try {
      const updated = await submitJob.mutateAsync(job);
      message[updated.status === 'submitted' ? 'success' : 'warning'](
        updated.status === 'submitted' ? '发布任务已提交' : updated.error || '发布接口未完成配置'
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : '提交失败');
    }
  };

  const handleCancel = async (job: PublishJob) => {
    try {
      await cancelJob.mutateAsync(job);
      message.success('发布任务已取消');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '取消失败');
    }
  };

  const handleSaveSettings = async () => {
    const values = await settingsForm.validateFields();
    try {
      await saveSettings.mutateAsync(values);
      message.success('B站发布凭证已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    }
  };

  const handleTestSettings = async () => {
    try {
      const result = await testSettings.mutateAsync();
      message[result.ok ? 'success' : 'warning'](result.message);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '测试失败');
    }
  };

  const columns = useMemo(
    () => [
      {
        title: '发布任务',
        dataIndex: 'title',
        render: (_: string, record: PublishJob) => (
          <Space direction="vertical" size={2}>
            <Text strong>{record.title}</Text>
            <Text type="secondary">任务 {record.taskId}</Text>
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (value: PublishJob['status']) => (
          <Tag color={value === 'submitted' ? 'success' : value === 'failed' ? 'error' : value === 'cancelled' ? 'default' : 'processing'}>
            {value}
          </Tag>
        ),
      },
      {
        title: '内容',
        key: 'content',
        render: (_: unknown, record: PublishJob) => (
          <Space direction="vertical" size={2}>
            <Text type="secondary">标签：{record.payload.tags?.join(' / ') || '-'}</Text>
            <Text type="secondary">来源：{record.payload.sources?.length ?? 0} 个</Text>
            {record.payload.packagePath && (
              <Paragraph copyable={{ text: record.payload.packagePath }} ellipsis={{ rows: 1 }} style={{ margin: 0 }}>
                {record.payload.packagePath}
              </Paragraph>
            )}
          </Space>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'createdAt',
        width: 190,
        render: (value: string) => <Text type="secondary">{value}</Text>,
      },
      {
        title: '操作',
        key: 'actions',
        width: 260,
        render: (_: unknown, record: PublishJob) => (
          <div className="paf-table-actions">
            <Button className="paf-compact-button" size="small" icon={<EyeOutlined />} onClick={() => setPreviewJob(record)}>
              预览
            </Button>
            <Button
              className="paf-compact-button"
              size="small"
              type="primary"
              icon={<SendOutlined />}
              disabled={!['ready', 'failed'].includes(record.status)}
              loading={submitJob.isPending}
              onClick={() => handleSubmit(record)}
            >
              提交发布
            </Button>
            <Popconfirm title="取消这个发布任务？" onConfirm={() => handleCancel(record)}>
              <Button className="paf-compact-button" size="small" danger icon={<StopOutlined />} disabled={record.status === 'cancelled'}>
                取消
              </Button>
            </Popconfirm>
          </div>
        ),
      },
    ],
    [cancelJob.isPending, submitJob.isPending]
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card variant="outlined" styles={{ body: { padding: 20 } }}>
        <div className="paf-page-toolbar">
          <Space className="paf-page-toolbar-main" size={12}>
            <CloudUploadOutlined style={{ fontSize: 24, color: '#D4AF37' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>发布任务</Title>
              <Text type="secondary">工作流生成发布包后会进入这里，真实提交需要手动触发。</Text>
            </div>
          </Space>
          <Tag className="paf-page-toolbar-actions" color={settings?.configured ? 'success' : 'warning'}>
            {settings?.configured ? 'B站凭证已配置' : 'B站凭证未完整配置'}
          </Tag>
        </div>
      </Card>

      <Card title={<Space><ApiOutlined />B站发布凭证</Space>}>
        <Form form={settingsForm} layout="vertical">
          <Row gutter={[12, 0]} align="bottom">
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="Client ID" name="clientId">
                <Input placeholder="保存后显示 ***" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="Client Secret" name="clientSecret">
                <Input.Password placeholder="保存后显示 ***" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="Access Token" name="accessToken">
                <Input.Password placeholder="保存后显示 ***" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <Form.Item label="Refresh Token" name="refreshToken">
                <Input.Password placeholder="可选，保存后显示 ***" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item>
                <div className="paf-action-group">
                  <Button icon={<SaveOutlined />} loading={saveSettings.isPending} onClick={handleSaveSettings}>
                    保存凭证
                  </Button>
                  <Button loading={testSettings.isPending} onClick={handleTestSettings}>
                    测试配置
                  </Button>
                </div>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={jobs}
          columns={columns}
          tableLayout="fixed"
          pagination={{ pageSize: 8 }}
        />
      </Card>

      <Drawer
        title="发布内容预览"
        open={Boolean(previewJob)}
        onClose={() => setPreviewJob(null)}
        width={760}
      >
        {previewJob && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text strong>{previewJob.payload.title}</Text>
            <Text type="secondary">动态：{previewJob.payload.dynamic}</Text>
            <Text type="secondary">标签：{previewJob.payload.tags?.join(' / ') || '-'}</Text>
            <Input.TextArea readOnly autoSize={{ minRows: 8, maxRows: 16 }} value={previewJob.payload.description} />
            {previewJob.payload.article && (
              <Card size="small" title={previewJob.payload.article.title}>
                <Input.TextArea readOnly autoSize={{ minRows: 8, maxRows: 16 }} value={previewJob.payload.article.body} />
              </Card>
            )}
            {previewJob.result && (
              <Card size="small" title="提交结果">
                <Input.TextArea readOnly autoSize={{ minRows: 4, maxRows: 10 }} value={JSON.stringify(previewJob.result, null, 2)} />
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </Space>
  );
}
