import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Typography,
  message,
} from 'antd';
import { CloudUploadOutlined, RobotOutlined, SaveOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { workflowApi } from '../services/api/workflow';
import { useWorkflowSelectionStore } from '../stores';
import { defaultPublishConfig, PublishConfigValues } from '../utils/publishConfig';

const { Paragraph, Text, Title } = Typography;

export default function PublishSettings() {
  const [form] = Form.useForm<PublishConfigValues>();
  const dashboardDraft = useWorkflowSelectionStore((state) => state.dashboardDraft);
  const publishDraft = useWorkflowSelectionStore((state) => state.publishDraft);
  const setPublishDraft = useWorkflowSelectionStore((state) => state.setPublishDraft);
  const [isGenerating, setIsGenerating] = useState(false);

  const initialValues = useMemo(
    () => ({ ...defaultPublishConfig, ...dashboardDraft?.publish, ...publishDraft }),
    [dashboardDraft?.publish, publishDraft]
  );

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);

  const persistValues = (values: PublishConfigValues) => {
    setPublishDraft({ ...defaultPublishConfig, ...values });
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    persistValues(values);
    message.success('发布设置已保存');
  };

  const handleGenerate = async () => {
    const values = form.getFieldsValue();
    setIsGenerating(true);
    try {
      const result = (await workflowApi.generatePublishCaption({
        command: dashboardDraft?.command,
        tag: dashboardDraft?.collection?.tag,
        syncArticle: values.syncArticle,
      })).data.data;
      const nextValues = {
        ...values,
        title: result.title,
        description: result.description,
        dynamic: result.dynamic,
        tagText: result.tags.join(', '),
        articleTitle: result.articleTitle,
        articleBody: result.articleBody,
      };
      form.setFieldsValue(nextValues);
      persistValues(nextValues);
      message.success(`已生成发布文案${result.provider ? ` (${result.provider})` : ''}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space direction="vertical" size={4}>
          <Title level={3} style={{ margin: 0 }}>平台发布设置</Title>
          <Text type="secondary">集中配置 B站发布包、简介、动态和同步专栏草稿。任务启动时会读取这里保存的配置。</Text>
        </Space>

        <Alert
          type="info"
          showIcon
          message="当前为发布包生成流程"
          description="系统会输出 bilibili-publish.json、简介文本和可选专栏草稿；真实上传仍需要后续接入 B站登录与投稿客户端。"
        />

        <Card
          title={<Space><CloudUploadOutlined />B站视频发布</Space>}
          extra={
            <Space>
              <Button icon={<RobotOutlined />} loading={isGenerating} onClick={handleGenerate}>
                AI 生成发布文案
              </Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                保存设置
              </Button>
            </Space>
          }
          style={{ borderRadius: 8 }}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={initialValues}
            onValuesChange={(_, values) => persistValues(values)}
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="投稿标题" name="title" style={{ marginBottom: 12 }}>
                  <Input placeholder="留空则使用任务标题" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="标签" name="tagText" style={{ marginBottom: 12 }}>
                  <Input placeholder="多个标签用逗号或换行分隔" />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="分区" name="category" style={{ marginBottom: 12 }}>
                  <Input placeholder="例如 动画/MAD·AMV" />
                </Form.Item>
              </Col>
              <Col xs={12} md={4}>
                <Form.Item name="original" valuePropName="checked" label="原创" style={{ marginBottom: 12 }}>
                  <Checkbox>标记原创</Checkbox>
                </Form.Item>
              </Col>
              <Col xs={12} md={4}>
                <Form.Item name="aigc" valuePropName="checked" label="AIGC" style={{ marginBottom: 12 }}>
                  <Checkbox>标记 AIGC</Checkbox>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="syncArticle" valuePropName="checked" label="专栏同步" style={{ marginBottom: 12 }}>
                  <Checkbox>同时生成专栏草稿</Checkbox>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="动态文案" name="dynamic" style={{ marginBottom: 12 }}>
                  <Input.TextArea rows={4} placeholder="发布动态/分享文案" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="视频简介" name="description" style={{ marginBottom: 12 }}>
                  <Input.TextArea rows={4} placeholder="留空则自动生成来源清单简介" />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left">同步专栏</Divider>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="专栏标题" name="articleTitle" style={{ marginBottom: 12 }}>
                  <Input placeholder="同步专栏开启时使用" />
                </Form.Item>
              </Col>
              <Col xs={24} md={16}>
                <Form.Item label="专栏正文 Markdown" name="articleBody" style={{ marginBottom: 12 }}>
                  <Input.TextArea rows={8} placeholder="留空则按来源清单自动生成" />
                </Form.Item>
              </Col>
            </Row>
          </Form>

          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            当前设置会持久保存到本地工作台状态；生成任务时自动写入发布包，便于后续人工或自动投稿。
          </Paragraph>
        </Card>
      </Space>
    </div>
  );
}
