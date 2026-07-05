import { Form, Radio, Alert } from 'antd';
import { SafetyOutlined, KeyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface LoginModeSelectorProps {
  value: 'interactive' | 'token';
  onChange: (mode: 'interactive' | 'token') => void;
  onResetFields: () => void;
}

/**
 * Login mode selector component
 */
export function LoginModeSelector({ value, onChange, onResetFields }: LoginModeSelectorProps) {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        label={
          <span className="login-field-label">
            {t('login.loginMode')}
          </span>
        }
        className="login-mode-field"
      >
        <Radio.Group
          className="login-mode-selector"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setTimeout(() => {
              onResetFields();
            }, 0);
          }}
          buttonStyle="solid"
        >
          <Radio.Button value="interactive">
            <SafetyOutlined /> {t('login.loginModeInteractive')}
          </Radio.Button>
          <Radio.Button value="token">
            <KeyOutlined /> Token 登录
          </Radio.Button>
        </Radio.Group>
      </Form.Item>

      {value === 'interactive' && (
        <Alert
          className="login-mode-alert"
          message={
            <span style={{ fontWeight: 600 }}>
              {t('login.loginModeInteractive')}
            </span>
          }
          description={
            <div className="login-alert-description">
              <div>{t('login.loginModeInteractiveDesc')}</div>
              <div className="login-inline-note">
                {t('login.browserWindowNote')}
              </div>
            </div>
          }
          type="info"
          showIcon
        />
      )}

      {value === 'token' && (
        <Alert
          className="login-mode-alert"
          message={
            <span style={{ fontWeight: 600 }}>
              Token 登录
            </span>
          }
          description={
            <div className="login-alert-description">
              <div>
                如果您已经有 Pixiv 的 refreshToken，可以直接粘贴保存。
              </div>
              <div className="login-inline-note login-inline-note-success">
                <strong>提示：</strong>refreshToken 可以从浏览器开发者工具中获取，或从其他已登录的配置文件中复制。
              </div>
            </div>
          }
          type="success"
          showIcon
        />
      )}
    </>
  );
}
