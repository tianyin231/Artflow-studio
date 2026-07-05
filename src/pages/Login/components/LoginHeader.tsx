import { Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

/**
 * Login page header component
 */
export function LoginHeader() {
  const { t } = useTranslation();

  return (
    <div className="login-header">
      <div className="login-brand-mark" aria-hidden="true">
        <RobotOutlined />
      </div>
      <Title level={2} className="login-title">
        PixivFlow
      </Title>
      <Text type="secondary" className="login-subtitle">
        {t('login.subtitle')}
      </Text>
    </div>
  );
}
