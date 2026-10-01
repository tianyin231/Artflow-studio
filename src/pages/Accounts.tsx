/**
 * Accounts & Connections — Pixiv host login, token import, accounts, proxy test.
 * Replaces password automation. Tokens are never displayed in full.
 */
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  List,
  Space,
  Steps,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  LogoutOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import { api } from '../services/api';

const { Title, Text, Paragraph } = Typography;

type Account = { userId: string; name?: string; isDefault: boolean };

function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 8) return '****';
  return `${token.slice(0, 2)}****${token.slice(-4)}`;
}

export default function Accounts() {
  const [form] = Form.useForm();
  const [callbackForm] = Form.useForm();
  const [step, setStep] = useState(0);
  const [authorizeUrl, setAuthorizeUrl] = useState('');
  const [loginId, setLoginId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [proxyResults, setProxyResults] = useState<
    { target: string; ok: boolean; latencyMs?: number; error?: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [importedPreview, setImportedPreview] = useState('');

  const refreshAccounts = async () => {
    try {
      const res = await api.listAccounts();
      setAccounts(res.data?.data ?? []);
    } catch {
      setAccounts([]);
    }
  };

  useEffect(() => {
    void refreshAccounts();
  }, []);

  const handleStartLogin = async () => {
    setLoading(true);
    try {
      const res = await api.loginStart();
      const data = res.data?.data;
      if (data?.authorizeUrl) {
        setAuthorizeUrl(data.authorizeUrl);
        setLoginId(data.loginId);
        setStep(1);
        window.open(data.authorizeUrl, '_blank', 'noopener,noreferrer');
        message.success('已打开授权链接，请在浏览器完成登录后粘贴回调 URL');
      } else {
        message.error('未能获取授权链接');
      }
    } catch (e) {
      message.error('登录启动失败');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (values: { callback: string }) => {
    setLoading(true);
    try {
      await api.loginComplete(loginId, values.callback);
      setStep(2);
      message.success('登录完成');
      await refreshAccounts();
    } catch {
      message.error('回调无效或会话已过期');
    } finally {
      setLoading(false);
    }
  };

  const handleImportToken = async (values: { refreshToken: string }) => {
    setLoading(true);
    try {
      await api.importToken(values.refreshToken.trim());
      setImportedPreview(maskToken(values.refreshToken.trim()));
      message.success('token 已导入');
      form.resetFields(['refreshToken']);
      await refreshAccounts();
    } catch {
      message.error('导入失败');
    } finally {
      setLoading(false);
    }
  };

  const handleProxyTest = async () => {
    setLoading(true);
    try {
      const res = await api.proxyTest();
      setProxyResults(res.data?.data?.results ?? []);
    } catch {
      setProxyResults([{ target: 'proxy', ok: false, error: 'request failed' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="accounts-page" style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <Title level={2} data-testid="accounts-title">
        <ApiOutlined /> 账号与连接
      </Title>
      <Paragraph type="secondary">
        不再使用账号密码自动化。支持「浏览器授权 + 粘贴回调 URL」与「粘贴 refresh_token」两种方式。
        Token 仅保存在本地，界面只显示脱敏预览。
      </Paragraph>

      <Card title="Pixiv 登录" data-testid="pixiv-login-card">
        <Steps
          current={step}
          items={[{ title: '打开授权' }, { title: '粘贴回调' }, { title: '完成' }]}
          data-testid="login-steps"
        />
        <Divider />
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button
            type="primary"
            icon={<LinkOutlined />}
            loading={loading}
            onClick={handleStartLogin}
            data-testid="btn-open-auth"
          >
            打开 Pixiv 登录
          </Button>
          {authorizeUrl && (
            <Alert
              type="info"
              showIcon
              message="授权链接已生成"
              description={
                <Paragraph copyable={{ text: authorizeUrl }} data-testid="authorize-url">
                  {authorizeUrl.slice(0, 80)}…
                </Paragraph>
              }
            />
          )}
          <Form form={callbackForm} layout="vertical" onFinish={handleComplete}>
            <Form.Item
              label="粘贴回调 URL 或 code"
              name="callback"
              rules={[{ required: true, message: '请粘贴回调 URL' }]}
            >
              <Input.TextArea
                rows={2}
                placeholder="pixiv://account/login?code=… 或 https://…callback?code=…"
                data-testid="input-callback"
              />
            </Form.Item>
            <Button htmlType="submit" loading={loading} data-testid="btn-complete-login">
              完成登录
            </Button>
          </Form>
        </Space>
      </Card>

      <Card title="粘贴 refresh_token" style={{ marginTop: 16 }} data-testid="import-token-card">
        <Form form={form} layout="vertical" onFinish={handleImportToken}>
          <Form.Item
            label="refresh_token"
            name="refreshToken"
            rules={[{ required: true, message: '请粘贴 token' }]}
          >
            <Input.Password placeholder="仅保存在本地，界面不会完整显示" data-testid="input-refresh-token" />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading} data-testid="btn-import-token">
              导入 Token
            </Button>
            {importedPreview && (
              <Text type="success" data-testid="token-preview">
                已导入：{importedPreview}
              </Text>
            )}
          </Space>
        </Form>
      </Card>

      <Card title="账号列表" style={{ marginTop: 16 }} data-testid="accounts-list-card">
        <List
          dataSource={accounts}
          locale={{ emptyText: '暂无账号' }}
          data-testid="accounts-list"
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="use"
                  size="small"
                  icon={<UserSwitchOutlined />}
                  onClick={async () => {
                    await api.useAccount(item.userId);
                    message.success(`已切换 ${item.name || item.userId}`);
                    await refreshAccounts();
                  }}
                  data-testid={`btn-use-${item.userId}`}
                >
                  切换
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span data-testid={`account-${item.userId}`}>{item.name || item.userId}</span>
                    {item.isDefault && <Tag color="gold">默认</Tag>}
                  </Space>
                }
                description={`UID ${item.userId}`}
              />
            </List.Item>
          )}
        />
      </Card>

      <Card title="代理连通性测试" style={{ marginTop: 16 }} data-testid="proxy-card">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button icon={<ApiOutlined />} loading={loading} onClick={handleProxyTest} data-testid="btn-proxy-test">
            测试代理
          </Button>
          <List
            dataSource={proxyResults}
            data-testid="proxy-results"
            locale={{ emptyText: '尚未测试' }}
            renderItem={(r) => (
              <List.Item>
                <Space>
                  {r.ok ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : (
                    <LogoutOutlined style={{ color: '#ff4d4f' }} />
                  )}
                  <Text>{r.target}</Text>
                  <Text type="secondary">{r.ok ? `${r.latencyMs ?? '-'}ms` : r.error || 'failed'}</Text>
                </Space>
              </List.Item>
            )}
          />
        </Space>
      </Card>

      <Card title="安全提示" style={{ marginTop: 16 }}>
        <ul>
          <li>日志与接口响应中的 token 会被脱敏。</li>
          <li>请勿把 refresh_token 提交到 git 或发到聊天工具。</li>
          <li>如需登出，请在本机执行 `pixiv auth remove` 或清空配置。</li>
        </ul>
      </Card>
    </div>
  );
}
