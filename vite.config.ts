import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import net from 'net';

// https://vitejs.dev/config/
const DEV_API_PORT = process.env.VITE_DEV_API_PORT || 3000;
const DEV_API_HOST = process.env.VITE_DEV_API_HOST || 'localhost';

let apiReadyCache = false;
let apiReadyCheckedAt = 0;
let apiStartingLogged = false;

function checkApiReady(): Promise<boolean> {
  const now = Date.now();
  if (now - apiReadyCheckedAt < 800) {
    return Promise.resolve(apiReadyCache);
  }
  apiReadyCheckedAt = now;

  return new Promise((resolve) => {
    const socket = net.createConnection(Number(DEV_API_PORT), DEV_API_HOST);
    socket.setTimeout(500);
    socket.once('connect', () => {
      apiReadyCache = true;
      if (apiStartingLogged) {
        console.warn(`[Vite] 后端 API 已连接：http://${DEV_API_HOST}:${DEV_API_PORT}`);
      }
      apiStartingLogged = false;
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      apiReadyCache = false;
      resolve(false);
    });
    socket.once('timeout', () => {
      apiReadyCache = false;
      socket.destroy();
      resolve(false);
    });
  });
}

function devApiReadyGate(): Plugin {
  return {
    name: 'dev-api-ready-gate',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          next();
          return;
        }

        if (await checkApiReady()) {
          next();
          return;
        }

        if (!apiStartingLogged) {
          apiStartingLogged = true;
          console.warn(`[Vite] 后端 API 尚未就绪，已临时拦截 /api 请求。等待 http://${DEV_API_HOST}:${DEV_API_PORT}`);
        }
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '后端 API 正在启动，请稍后重试' }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApiReadyGate()],
  define: {
    'globalThis.__VITE_ENV__': JSON.stringify({
      VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || '',
      VITE_USE_EMBEDDED_BACKEND: process.env.VITE_USE_EMBEDDED_BACKEND || '',
    }),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://${DEV_API_HOST}:${DEV_API_PORT}`,
        changeOrigin: true,
      },
      '/socket.io': {
        target: `http://${DEV_API_HOST}:${DEV_API_PORT}`,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Split large UI vendors so no single chunk exceeds 500KB
          if (id.includes('node_modules/rc-select') || id.includes('node_modules/rc-tree') || id.includes('node_modules/rc-table') || id.includes('node_modules/rc-picker')) {
            return 'antd-rc-heavy';
          }
          if (id.includes('node_modules/rc-')) {
            return 'antd-rc';
          }
          if (id.includes('node_modules/@ant-design')) {
            return 'antd-icons';
          }
          if (id.includes('node_modules/antd/')) {
            // Split antd internals further so no chunk exceeds 500KB
            const m = id.match(/node_modules\/antd\/(?:es|lib)\/([^/]+)/);
            if (m) {
              const group = m[1];
              if (['table', 'tree', 'select', 'date-picker', 'form', 'modal', 'menu', 'tree-select'].includes(group)) {
                return `antd-${group}`;
              }
              return 'antd-core';
            }
            return 'antd-core';
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router') || id.includes('node_modules/scheduler')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@tanstack') || id.includes('node_modules/axios') || id.includes('node_modules/zustand')) {
            return 'query-vendor';
          }
          if (id.includes('node_modules/dayjs') || id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'utils-vendor';
          }
          return 'vendor';
        },
      },
    },
  },
  // 支持 Capacitor
  base: './',
});
