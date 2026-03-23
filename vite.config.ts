import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const uploadProxyTarget = env.VITE_UPLOAD_PROXY_TARGET?.trim();
  const geminiApiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';

  return {
    server: {
      port: Number(env.VITE_DEV_SERVER_PORT || 3000),
      host: env.VITE_DEV_SERVER_HOST || '0.0.0.0',
      proxy: uploadProxyTarget
        ? {
            '/api/upload': {
              target: uploadProxyTarget,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api/, ''),
            },
          }
        : undefined,
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(geminiApiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
