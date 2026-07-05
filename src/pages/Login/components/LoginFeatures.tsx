import { Space, Typography } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * Login features showcase component
 */
export function LoginFeatures() {
  return (
    <div className="login-features">
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <div className="login-feature-item">
          <CheckCircleOutlined />
          <Text>安全的 OAuth 认证流程</Text>
        </div>
        <div className="login-feature-item">
          <CheckCircleOutlined />
          <Text>自动保存登录凭证</Text>
        </div>
        <div className="login-feature-item">
          <CheckCircleOutlined />
          <Text>支持多种登录方式</Text>
        </div>
      </Space>
    </div>
  );
}
