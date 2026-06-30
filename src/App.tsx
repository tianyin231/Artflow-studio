import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AppRoutes } from './AppRoutes';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#D4AF37',
          colorLink: '#8E7322',
          colorBgLayout: '#FAFAFA',
          colorBorder: '#EBEBEB',
          borderRadius: 8,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        },
      }}
    >
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
