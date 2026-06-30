import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { CommandPreset, useCommandPresets } from '../hooks/useCommandPresets';

const { Text, Title } = Typography;

export default function CommandPresets() {
  const navigate = useNavigate();
  const [form] = Form.useForm<Omit<CommandPreset, 'id' | 'createdAt' | 'updatedAt'>>();
  const [search, setSearch] = useState('');
  const {
    presets,
    categories,
    addPresetAsync,
    deletePresetAsync,
    resetPresetsAsync,
    isAdding,
    isResetting,
  } = useCommandPresets();

  const filteredPresets = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return presets;
    return presets.filter((preset) =>
      `${preset.name} ${preset.command} ${preset.category}`.toLowerCase().includes(keyword)
    );
  }, [presets, search]);

  const handleAdd = async (values: Omit<CommandPreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    await addPresetAsync(values);
    form.resetFields();
    message.success('命令预设已保存');
  };

  const handleDelete = async (id: string) => {
    await deletePresetAsync(id);
    message.success('命令预设已删除');
  };

  const handleReset = async () => {
    await resetPresetsAsync();
    message.success('默认预设已恢复');
  };

  const handleCopy = async (command: string) => {
    await navigator.clipboard.writeText(command);
    message.success('命令已复制');
  };

  const handleUse = async (command: string) => {
    await navigator.clipboard.writeText(command);
    message.success('命令已复制，可在视频生成页直接粘贴使用');
    navigate('/video');
  };

  return (
    <Space direction="vertical" size={18} style={{ width: '100%' }}>
      <Card variant="outlined" styles={{ body: { padding: 20 } }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              命令预设
            </Title>
            <Text type="secondary">记录高频自然语言命令，复用主题、阈值、视频风格和发布意图。</Text>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} loading={isResetting} onClick={handleReset}>
              恢复默认
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card title="新增预设" style={{ height: '100%' }}>
            <Form layout="vertical" form={form} onFinish={handleAdd}>
              <Form.Item
                label="预设名称"
                name="name"
                rules={[{ required: true, message: '请输入预设名称' }]}
              >
                <Input placeholder="例如：原神高收藏竖屏" />
              </Form.Item>
              <Form.Item
                label="分类"
                name="category"
                initialValue="视频生成"
                rules={[{ required: true, message: '请输入分类' }]}
              >
                <Input placeholder="视频生成 / 素材收集 / 发布" />
              </Form.Item>
              <Form.Item
                label="命令"
                name="command"
                rules={[{ required: true, message: '请输入命令' }]}
              >
                <Input.TextArea
                  rows={5}
                  placeholder="例如：本周原神 插画 收藏数3000+ 竖屏视频 柔和转场"
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={isAdding} block>
                保存预设
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Card
            title="预设库"
            extra={
              <Input.Search
                allowClear
                placeholder="搜索名称、分类或命令"
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: 260 }}
              />
            }
          >
            <Space wrap style={{ marginBottom: 12 }}>
              {categories.map((category) => (
                <Tag key={category} color="gold">
                  {category}
                </Tag>
              ))}
            </Space>
            <Table
              rowKey="id"
              size="small"
              dataSource={filteredPresets}
              pagination={{ pageSize: 6 }}
              columns={[
                {
                  title: '名称',
                  dataIndex: 'name',
                  width: 180,
                  render: (value: string, record) => (
                    <Space direction="vertical" size={0}>
                      <Text strong>{value}</Text>
                      <Tag style={{ width: 'fit-content' }}>{record.category}</Tag>
                    </Space>
                  ),
                },
                {
                  title: '命令',
                  dataIndex: 'command',
                  render: (value: string) => (
                    <Text style={{ whiteSpace: 'normal' }}>{value}</Text>
                  ),
                },
                {
                  title: '操作',
                  width: 210,
                  render: (_, record) => (
                    <Space wrap>
                      <Button size="small" icon={<SendOutlined />} onClick={() => handleUse(record.command)}>
                        使用
                      </Button>
                      <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record.command)}>
                        复制
                      </Button>
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record.id)}
                      >
                        删除
                      </Button>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
