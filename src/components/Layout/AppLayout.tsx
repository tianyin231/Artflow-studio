import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import { LayoutHeader, LayoutSider } from './components';
import { useLayoutAuth } from './hooks';

const { Content } = Layout;

/**
 * Main application layout component
 */
export default function AppLayout() {
  const {
    isAuthenticated,
    isLoggingOut,
    isRefreshingToken,
    handleLogin,
    handleLogout,
    handleRefreshToken,
  } = useLayoutAuth();

  return (
    <Layout className="paf-shell">
      <div className="paf-topbar">
        <LayoutHeader
          isAuthenticated={isAuthenticated}
          isLoggingOut={isLoggingOut}
          isRefreshingToken={isRefreshingToken}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onRefreshToken={handleRefreshToken}
        />
        <LayoutSider />
      </div>
      <Layout className="paf-main">
        <Content
          className="paf-content"
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
