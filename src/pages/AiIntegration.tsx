import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  DollarOutlined,
  FieldTimeOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useAiIntegrationSettings } from '../hooks/useAiIntegrationSettings';
import { AiBalanceResult, AiConnectionTestResult, AiIntegrationSettings, AiModelInfo } from '../services/api/types';

const { Text, Title } = Typography;

const defaultConfig: AiIntegrationSettings = {
  provider: 'local-rules',
  model: 'local-rule-planner',
  baseUrl: '',
  apiKey: '',
  planningMode: 'rules-first',
};

export default function AiIntegration() {
  const [form] = Form.useForm<AiIntegrationSettings>();
  const {
    settings,
    saveSettingsAsync,
    isSaving,
    fetchModelsAsync,
    isFetchingModels,
    testConnectionAsync,
    isTestingConnection,
    queryBalanceAsync,
    isQueryingBalance,
  } = useAiIntegrationSettings();
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [testResult, setTestResult] = useState<AiConnectionTestResult | null>(null);
  const [balanceResult, setBalanceResult] = useState<AiBalanceResult | null>(null);
  const config = settings ?? defaultConfig;

  useEffect(() => {
    form.setFieldsValue(config);
  }, [config, form]);

  const watchedProvider = Form.useWatch('provider', form) ?? config.provider;
  const watchedModel = Form.useWatch('model', form) ?? config.model;
  const watchedApiKey = Form.useWatch('apiKey', form) ?? config.apiKey;
  const providerReady = watchedProvider === 'local-rules' || Boolean(watchedApiKey || watchedProvider === 'ollama');
  const isExternalProvider = watchedProvider !== 'local-rules';
  const providerOptions = useMemo(
    () => [
      { label: '本地规则规划器', value: 'local-rules' },
      { label: 'OpenAI Compatible', value: 'openai' },
      { label: 'Anthropic Claude', value: 'anthropic' },
      { label: 'Ollama 本地模型', value: 'ollama' },
    ],
    []
  );
  const modelOptions = useMemo(() => {
    const remoteModels = models.map((model) => ({ label: model.name || model.id, value: model.id }));
    if (watchedModel && !remoteModels.some((model) => model.value === watchedModel)) {
      remoteModels.unshift({ label: watchedModel, value: watchedModel });
    }
    return remoteModels;
  }, [models, watchedModel]);

  const handleSave = async (values: AiIntegrationSettings) => {
    try {
      await saveSettingsAsync(values);
      message.success('AI 接入配置已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    }
  };

  const readFormSettings = async (): Promise<AiIntegrationSettings> => {
    const values = await form.validateFields();
    return { ...defaultConfig, ...values };
  };

  const handleFetchModels = async () => {
    try {
      const values = await readFormSettings();
      const nextModels = await fetchModelsAsync(values);
      setModels(nextModels);
      const firstModel = nextModels[0];
      if (firstModel && !nextModels.some((model) => model.id === values.model)) {
        form.setFieldValue('model', firstModel.id);
      }
      message.success(nextModels.length > 0 ? `已获取 ${nextModels.length} 个模型` : '没有获取到模型');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '获取模型失败');
    }
  };

  const handleTestConnection = async () => {
    try {
      const values = await readFormSettings();
      const result = await testConnectionAsync(values);
      setTestResult(result);
      message.success(result.message || '连接测试通过');
    } catch (error) {
      setTestResult({ ok: false, message: error instanceof Error ? error.message : '连接测试失败' });
      message.error(error instanceof Error ? error.message : '连接测试失败');
    }
  };

  const handleQueryBalance = async () => {
    try {
      const values = await readFormSettings();
      const result = await queryBalanceAsync(values);
      setBalanceResult(result);
      message[result.supported ? 'success' : 'warning'](result.supported ? '余额信息已返回' : result.message || '该 Provider 不支持余额查询');
    } catch (error) {
      setBalanceResult({ supported: false, message: error instanceof Error ? error.message : '余额查询失败' });
      message.error(error instanceof Error ? error.message : '余额查询失败');
    }
  };

  return (
    <Space direction="vertical" size={18} style={{ width: '100%' }}>
      <Card variant="outlined" styles={{ body: { padding: 20 } }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              AI 接入
            </Title>
            <Text type="secondary">管理后续 AI planner 的接入参数，并保留当前本地规则规划器作为稳定 fallback。</Text>
          </Col>
          <Col>
            <Tag color={providerReady ? 'success' : 'warning'} icon={providerReady ? <CheckCircleOutlined /> : <ApiOutlined />}>
              {providerReady ? '配置可用' : '等待密钥'}
            </Tag>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={9}>
          <Card title="接入状态" style={{ height: '100%' }}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Row gutter={12}>
                <Col span={12}>
                  <Statistic title="当前 Provider" value={watchedProvider} prefix={<RobotOutlined />} />
                </Col>
                <Col span={12}>
                  <Statistic title="规划模式" value={config.planningMode} prefix={<CloudServerOutlined />} />
                </Col>
              </Row>
              <Alert
                showIcon
                type={isExternalProvider ? 'success' : 'info'}
                message={isExternalProvider ? 'Provider 已接入，可用于模型探测和连通性验证' : '当前使用本地规则规划器'}
                description={
                  isExternalProvider
                    ? '当前工作流计划仍保留规则规划器兜底；AI 优先模式会作为后续 Planner 扩展入口。'
                    : '本地规则规划器已经能生成 Pixiv 目标、视频参数和 B站 dry-run 发布计划。'
                }
              />
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="当前模型">{watchedModel || '未选择'}</Descriptions.Item>
                <Descriptions.Item label="模型数量">{models.length || '未获取'}</Descriptions.Item>
                <Descriptions.Item label="密钥状态">{watchedApiKey ? '已填写' : '未填写'}</Descriptions.Item>
              </Descriptions>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={15}>
          <Card title="Provider 配置">
            <Form layout="vertical" form={form} initialValues={config} onFinish={handleSave}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Provider" name="provider" rules={[{ required: true }]}>
                    <Select options={providerOptions} onChange={() => setModels([])} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="模型" name="model" rules={[{ required: true, message: '请选择或输入模型名称' }]}>
                    <AutoComplete
                      allowClear
                      options={modelOptions}
                      placeholder="先获取模型，或手动输入模型名"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Base URL" name="baseUrl">
                <Input placeholder="https://api.openai.com/v1 或 http://localhost:11434" />
              </Form.Item>

              <Form.Item label="API Key" name="apiKey">
                <Input.Password placeholder="后续接后端时再用于服务端调用" />
              </Form.Item>

              <Form.Item label="规划模式" name="planningMode">
                <Radio.Group>
                  <Radio.Button value="rules-first">规则优先</Radio.Button>
                  <Radio.Button value="ai-first">AI 优先</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Space wrap>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isSaving}>
                  保存配置
                </Button>
                <Button icon={<ReloadOutlined />} loading={isFetchingModels} onClick={handleFetchModels}>
                  获取模型
                </Button>
                <Button icon={<FieldTimeOutlined />} loading={isTestingConnection} onClick={handleTestConnection}>
                  测速
                </Button>
                <Button icon={<DollarOutlined />} loading={isQueryingBalance} onClick={handleQueryBalance}>
                  查询余额
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="连接测速" style={{ height: '100%' }}>
            {testResult ? (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Tag color={testResult.ok ? 'success' : 'error'}>
                  {testResult.ok ? '可用' : '失败'}
                </Tag>
                <Statistic title="延迟" value={testResult.latencyMs ?? 0} suffix="ms" />
                {testResult.message && <Text type="secondary">{testResult.message}</Text>}
              </Space>
            ) : (
              <Text type="secondary">点击“测速”后显示连接状态和延迟。</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="余额/用量" style={{ height: '100%' }}>
            {balanceResult ? (
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Tag color={balanceResult.supported ? 'success' : 'warning'}>
                  {balanceResult.supported ? '已返回' : '不可用'}
                </Tag>
                {balanceResult.endpoint && <Text code>{balanceResult.endpoint}</Text>}
                {balanceResult.message && <Text type="secondary">{balanceResult.message}</Text>}
                {balanceResult.raw !== undefined && (
                  <Input.TextArea
                    readOnly
                    autoSize={{ minRows: 4, maxRows: 8 }}
                    value={JSON.stringify(balanceResult.raw, null, 2)}
                  />
                )}
              </Space>
            ) : (
              <Text type="secondary">参考 CC Switch 的余额面板思路，优先尝试兼容供应商的余额/用量接口；不支持时会明确返回原因。</Text>
            )}
          </Card>
        </Col>
      </Row>

      <Card title="后续接入点">
        <Row gutter={[16, 16]}>
          {[
            ['Planner', '把自然语言命令扩展为 Pixiv 搜索条件、筛选阈值、视频参数和发布元数据。'],
            ['Image Prompt', '根据作品主题生成补充图片或封面图提示词。'],
            ['Caption', '为 B站发布生成标题、简介、标签和 AIGC/转载声明。'],
          ].map(([title, description]) => (
            <Col xs={24} md={8} key={title}>
              <Card size="small" style={{ height: '100%' }}>
                <Space direction="vertical" size={8}>
                  <Text strong>{title}</Text>
                  <Text type="secondary">{description}</Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </Space>
  );
}
