import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import net from 'net';

// https://vitejs.dev/config/
const DEV_API_PORT = process.env.VITE_DEV_API_PORT || 3300;
const DEV_API_HOST = process.env.VITE_DEV_API_HOST || '127.0.0.1';

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
          console.warn(
            `[Vite] backend API not ready yet: http://${DEV_API_HOST}:${DEV_API_PORT}`
          );
        }
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: 'backend API starting' }));
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    devApiReadyGate(),
  ],
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
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5373,
    host: '127.0.0.1',
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
  preview: {
    port: 5373,
    host: '127.0.0.1',
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
    // NOTE(F2-M1): custom manualChunks that split antd creates circular chunk init
    // (createContext / version TDZ) in this rollup graph. Default splitting is the
    // only configuration that renders in production. See BLOCKER-F2-chunk-size.
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'antd', '@ant-design/icons'],
    },
  },
  // Absolute base so SPA routes resolve assets correctly under vite preview
  base: '/',
});
