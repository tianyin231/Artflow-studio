import { Form, Input, Button, Alert } from 'antd';
import { LoginOutlined, ReloadOutlined, KeyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface LoginFormProps {
  loginMode: 'interactive' | 'token';
  isLoggingIn: boolean;
  isLoggingInWithToken: boolean;
  onLogin: (values?: { refreshToken?: string }) => void;
  onCheckStatus?: () => void;
}

/**
 * Login form component
 */
export function LoginForm({ 
  loginMode, 
  isLoggingIn, 
  isLoggingInWithToken,
  onLogin,
  onCheckStatus,
}: LoginFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isLoading = isLoggingIn || isLoggingInWithToken;

  const handleSubmit = () => {
    if (loginMode === 'token') {
      form.validateFields(['refreshToken']).then(() => {
        const values = form.getFieldsValue();
        onLogin(values);
      }).catch(() => {
        // Validation failed
      });
    } else {
      onLogin();
    }
  };

  return (
    <Form
      form={form}
      name="login"
      onFinish={handleSubmit}
      layout="vertical"
      size="large"
      autoComplete="off"
    >
      {loginMode === 'token' && (
        <Form.Item
          name="refreshToken"
          label={
            <span className="login-field-label">
              <KeyOutlined style={{ marginRight: 8 }} /> Refresh Token
            </span>
          }
          rules={[
            { required: true, message: '请输入 refreshToken' },
            { min: 10, message: 'refreshToken 格式不正确' },
          ]}
        >
          <Input.TextArea
            placeholder="粘贴您的 refreshToken"
            autoSize={{ minRows: 3, maxRows: 6 }}
            className="login-token-input"
            disabled={isLoading}
          />
        </Form.Item>
      )}

      <Form.Item style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          htmlType="button"
          block
          icon={<LoginOutlined />}
          loading={isLoading}
          disabled={isLoading}
          size="large"
          onClick={handleSubmit}
          className="login-submit-button"
        >
          {isLoading ? t('login.loggingIn') : t('login.loginButton')}
        </Button>
      </Form.Item>

      {isLoading && (
        <Alert
          className="login-progress-alert"
          message={
            <span style={{ fontWeight: 600 }}>
              {t('login.processing')}
            </span>
          }
          description={
            <div className="login-alert-description">
              {loginMode === 'interactive' ? (
                <div>
                  <div>
                    {t('login.processingInteractiveDesc')}
                  </div>
                  {onCheckStatus && (
                    <div className="login-check-status">
                      <div>
                        <strong>提示：</strong>如果您已经在浏览器中完成登录，请点击下方按钮检查登录状态。
                      </div>
                      <Button
                        type="primary"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={onCheckStatus}
                        className="login-check-status-button"
                      >
                        检查登录状态
                      </Button>
                    </div>
                  )}
                </div>
              ) : loginMode === 'token' ? (
                <div>
                  正在保存 refreshToken 到配置文件...
                </div>
              ) : null}
            </div>
          }
          type="info"
          showIcon
        />
      )}
    </Form>
  );
}
