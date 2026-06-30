import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  List,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import { ApiOutlined, FileImageOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useCreateWorkflowTask, useWorkflowTasks } from '../hooks/useWorkflow';
import { useWorkflowSelectionStore } from '../stores';
import { WorkflowPixivOverrides } from '../services/api/types';

const { Text, Title } = Typography;

const defaultValues = {
  command: '按采集配置抓取 Pixiv 素材并生成审核任务',
  useLocalAssets: false,
  tag: '鸣潮',
  limit: 10,
  minBookmarks: 500,
  sort: 'popular_desc' as const,
  searchTarget: 'partial_match_for_tags' as const,
  dateRange: [dayjs().subtract(7, 'day'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs],
  tagWhitelistText: '',
  tagBlacklistText: 'R-18, AI生成',
};

function splitTags(value?: string): string[] {
  return (value ?? '')
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function PixivCollection() {
  const [form] = Form.useForm<typeof defaultValues>();
  const selectedTaskId = useWorkflowSelectionStore((state) => state.selectedTaskId);
  const setSelectedTaskId = useWorkflowSelectionStore((state) => state.setSelectedTaskId);
  const createTask = useCreateWorkflowTask();
  const { tasks } = useWorkflowTasks();

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const pixivOverrides: WorkflowPixivOverrides = {
      tag: values.tag,
      limit: values.limit,
      minBookmarks: values.minBookmarks,
      sort: values.sort,
      searchTarget: values.searchTarget,
      startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
      tagWhitelist: splitTags(values.tagWhitelistText),
      tagBlacklist: splitTags(values.tagBlacklistText),
    };
    const task = await createTask.mutateAsync({
      command: values.command,
      dryRunDownload: values.useLocalAssets,
      pixivOverrides,
    });
    setSelectedTaskId(task.id);
    message.success(values.useLocalAssets ? '已创建本地素材任务' : '已创建 Pixiv 采集任务');
  };

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];

  return (
    <Space direction="vertical" size={18} style={{ width: '100%' }}>
      <Card variant="outlined" styles={{ body: { padding: 20 } }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              素材采集
            </Title>
            <Text type="secondary">集中控制 Pixiv 抓取数量、时间范围、排序、收藏阈值和 tag 黑白名单。</Text>
          </Col>
          <Col>
            <Tag color="gold" icon={<ApiOutlined />}>PixivFlow</Tag>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card title="采集参数">
            <Form form={form} layout="vertical" initialValues={defaultValues}>
              <Form.Item label="任务指令" name="command" rules={[{ required: true, message: '请输入任务指令' }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item label="目标标签" name="tag" rules={[{ required: true, message: '请输入 Pixiv 标签' }]}>
                    <Input placeholder="鸣潮 / イラスト" />
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="抓取数量" name="limit" rules={[{ required: true }]}>
                    <InputNumber min={1} max={200} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="收藏阈值" name="minBookmarks">
                    <InputNumber min={0} max={1000000} step={100} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="时间范围" name="dateRange">
                    <DatePicker.RangePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="热度排序" name="sort">
                    <Select
                      options={[
                        { label: '热门优先', value: 'popular_desc' },
                        { label: '最新优先', value: 'date_desc' },
                        { label: '最早优先', value: 'date_asc' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item label="搜索方式" name="searchTarget">
                    <Select
                      options={[
                        { label: '标签部分匹配', value: 'partial_match_for_tags' },
                        { label: '标签精确匹配', value: 'exact_match_for_tags' },
                        { label: '标题/简介匹配', value: 'title_and_caption' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="useLocalAssets" valuePropName="checked" label="执行方式">
                    <Checkbox>只使用本地素材，不请求 Pixiv</Checkbox>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Tag 白名单" name="tagWhitelistText">
                    <Input.TextArea rows={3} placeholder="多个用逗号或换行分隔，留空表示不限" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Tag 黑名单" name="tagBlacklistText">
                    <Input.TextArea rows={3} placeholder="R-18, AI生成" />
                  </Form.Item>
                </Col>
              </Row>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={createTask.isPending}
                onClick={handleSubmit}
              >
                开始采集并进入工作流
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card title="当前任务">
              {selectedTask ? (
                <Row gutter={[12, 12]}>
                  <Col span={12}>
                    <Statistic title="状态" value={selectedTask.status} />
                  </Col>
                  <Col span={12}>
                    <Statistic title="素材" value={selectedTask.assets.length} prefix={<FileImageOutlined />} />
                  </Col>
                  <Col span={24}>
                    <Text type="secondary">{selectedTask.plan?.title ?? selectedTask.command}</Text>
                  </Col>
                </Row>
              ) : (
                <Text type="secondary">暂无任务</Text>
              )}
            </Card>
            <Card title="最近采集任务">
              <List
                size="small"
                dataSource={tasks.slice(0, 6)}
                renderItem={(task) => (
                  <List.Item onClick={() => setSelectedTaskId(task.id)} style={{ cursor: 'pointer' }}>
                    <List.Item.Meta
                      title={<Text strong>{task.plan?.pixivTarget.tag ?? task.command}</Text>}
                      description={`${task.status} · ${task.assets.length} 张素材`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        </Col>
      </Row>
    </Space>
  );
}
