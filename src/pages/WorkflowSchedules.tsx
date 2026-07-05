import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  useDeleteWorkflowSchedule,
  useRunWorkflowScheduleNow,
  useSaveWorkflowSchedule,
  useSetWorkflowScheduleEnabled,
  useWorkflowSchedules,
} from '../hooks/useWorkflow';
import { WorkflowSchedule } from '../services/api/types';

const { Text, Title } = Typography;

interface ScheduleFormValues {
  name: string;
  enabled: boolean;
  cron: string;
  timezone?: string;
  command: string;
  dryRunDownload?: boolean;
  syncArticle?: boolean;
}

const defaultValues: ScheduleFormValues = {
  name: '',
  enabled: true,
  cron: '0 3 * * *',
  timezone: 'Asia/Shanghai',
  command: '',
  dryRunDownload: false,
  syncArticle: true,
};

export default function WorkflowSchedules() {
  const [form] = Form.useForm<ScheduleFormValues>();
  const { schedules, isLoading } = useWorkflowSchedules();
  const saveSchedule = useSaveWorkflowSchedule();
  const setEnabled = useSetWorkflowScheduleEnabled();
  const runNow = useRunWorkflowScheduleNow();
  const deleteSchedule = useDeleteWorkflowSchedule();
  const [editing, setEditing] = useState<WorkflowSchedule | null>(null);
  const [open, setOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue(defaultValues);
    setOpen(true);
  };

  const openEdit = (schedule: WorkflowSchedule) => {
    setEditing(schedule);
    form.setFieldsValue({
      name: schedule.name,
      enabled: schedule.enabled,
      cron: schedule.cron,
      timezone: schedule.timezone || 'Asia/Shanghai',
      command: schedule.command,
      dryRunDownload: Boolean(schedule.payload?.dryRunDownload),
      syncArticle: schedule.payload?.publishOverrides?.syncArticle ?? true,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      await saveSchedule.mutateAsync({
        id: editing?.id,
        name: values.name.trim(),
        enabled: values.enabled,
        cron: values.cron.trim(),
        timezone: values.timezone?.trim() || undefined,
        command: values.command.trim(),
        payload: {
          dryRunDownload: Boolean(values.dryRunDownload),
          publishOverrides: {
            syncArticle: values.syncArticle ?? true,
          },
        },
      });
      message.success(editing ? '定时任务已更新' : '定时任务已创建');
      setOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    }
  };

  const columns = useMemo(
    () => [
      {
        title: '任务',
        dataIndex: 'name',
        render: (_: string, record: WorkflowSchedule) => (
          <Space direction="vertical" size={2}>
            <Text strong>{record.name}</Text>
            <Text type="secondary" ellipsis style={{ maxWidth: 520 }}>{record.command}</Text>
          </Space>
        ),
      },
      {
        title: '计划',
        dataIndex: 'cron',
        width: 180,
        render: (_: string, record: WorkflowSchedule) => (
          <Space direction="vertical" size={2}>
            <Text code>{record.cron}</Text>
            <Text type="secondary">{record.timezone || '系统时区'}</Text>
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        width: 110,
        render: (_: boolean, record: WorkflowSchedule) => (
          <Switch
            checked={record.enabled}
            loading={setEnabled.isPending}
            onChange={(enabled) => setEnabled.mutate({ id: record.id, enabled })}
          />
        ),
      },
      {
        title: '最近运行',
        dataIndex: 'lastStatus',
        width: 180,
        render: (_: string, record: WorkflowSchedule) => (
          <Space direction="vertical" size={2}>
            <Tag color={record.lastStatus === 'success' ? 'success' : record.lastStatus === 'failed' ? 'error' : record.lastStatus === 'running' ? 'processing' : 'default'}>
              {record.lastStatus || '未运行'}
            </Tag>
            {record.lastRunAt && <Text type="secondary">{record.lastRunAt}</Text>}
          </Space>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        width: 220,
        render: (_: unknown, record: WorkflowSchedule) => (
          <div className="paf-table-actions">
            <Button className="paf-compact-button" size="small" icon={<PlayCircleOutlined />} loading={runNow.isPending} onClick={() => runNow.mutate(record.id)}>
              立即运行
            </Button>
            <Button className="paf-compact-button" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Popconfirm title="删除这个定时任务？" onConfirm={() => deleteSchedule.mutate(record)}>
              <Button className="paf-compact-button" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </div>
        ),
      },
    ],
    [deleteSchedule, runNow, setEnabled]
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card variant="outlined" styles={{ body: { padding: 20 } }}>
        <div className="paf-page-toolbar">
          <Space className="paf-page-toolbar-main" size={12}>
            <ClockCircleOutlined style={{ fontSize: 24, color: '#D4AF37' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>工作流定时任务</Title>
              <Text type="secondary">按自然语言指令定时生成视频和 B站发布包，定时任务不会真实发布视频。</Text>
            </div>
          </Space>
          <div className="paf-page-toolbar-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建定时任务
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={schedules}
          columns={columns}
          tableLayout="fixed"
          pagination={{ pageSize: 8 }}
        />
      </Card>

      <Modal
        title={editing ? '编辑定时任务' : '新建定时任务'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
        confirmLoading={saveSchedule.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={defaultValues}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：每日鸣潮竖屏视频" />
          </Form.Item>
          <Form.Item label="自然语言指令" name="command" rules={[{ required: true, message: '请输入指令' }]}>
            <Input.TextArea rows={4} placeholder="例如：每天找最近一周鸣潮高收藏图，生成 60 秒 9:16 舒缓视频，同步生成 B站专栏" />
          </Form.Item>
          <Form.Item label="Cron 表达式" name="cron" rules={[{ required: true, message: '请输入 Cron 表达式' }]}>
            <Input placeholder="0 3 * * *" />
          </Form.Item>
          <Form.Item label="时区" name="timezone">
            <Input placeholder="Asia/Shanghai" />
          </Form.Item>
          <Space size={24}>
            <Form.Item label="启用" name="enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="使用本地素材" name="dryRunDownload" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="同步专栏" name="syncArticle" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
}
