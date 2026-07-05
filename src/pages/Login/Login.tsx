import { useEffect } from 'react';
import { Space, Spin, Divider, Typography, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLoginFlow } from './hooks';
import {
  LoginCard,
  LoginHeader,
  LoginFeatures,
  LoginSteps,
  LoginModeSelector,
  LoginForm,
} from './components';

const { Paragraph } = Typography;

/**
 * Login page component
 * Simplified version that uses useLoginFlow hook for all login logic
 */
export default function Login() {
  const { t } = useTranslation();
  const {
    loginMode,
    loginStep,
    isLoggingIn,
    isLoggingInWithToken,
    authStatusLoading,
    authStatus,
    isAuthenticated,
    setLoginMode,
    handleLogin,
    handleCheckStatus,
    navigate,
  } = useLoginFlow();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (!authStatusLoading && isAuthenticated(authStatus)) {
      navigate('/dashboard', { replace: true });
    }
  }, [authStatusLoading, authStatus, navigate, isAuthenticated]);

  // Show loading while checking auth status
  if (authStatusLoading) {
    return (
      <div className="login-auth-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <LoginCard>
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <LoginHeader />

        <Button type="link" onClick={() => navigate('/dashboard', { replace: true })}>
          返回主界面
        </Button>

        {(isLoggingIn || isLoggingInWithToken) && (
          <LoginSteps current={loginStep} />
        )}

        {!isLoggingIn && !isLoggingInWithToken && (
          <LoginFeatures />
        )}

        <Divider className="login-divider" />

        <LoginModeSelector
          value={loginMode}
          onChange={setLoginMode}
          onResetFields={() => {
            const form = document.querySelector('form[name="login"]') as HTMLFormElement;
            if (form) {
              form.reset();
            }
          }}
        />

        <LoginForm
          loginMode={loginMode}
          isLoggingIn={isLoggingIn}
          isLoggingInWithToken={isLoggingInWithToken}
          onLogin={handleLogin}
          onCheckStatus={handleCheckStatus}
        />

        <Divider className="login-divider" />

        <div style={{ textAlign: 'center' }}>
          <Paragraph 
            type="secondary" 
            className="login-note"
          >
            {t('login.note')}
          </Paragraph>
        </div>
      </Space>
    </LoginCard>
  );
}
