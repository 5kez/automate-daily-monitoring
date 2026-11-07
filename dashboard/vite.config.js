import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const webhookTarget =
    env.VITE_WEBHOOK_PROXY_TARGET ||
    env.VITE_API_WEBHOOK_HOST ||
    'http://localhost';

  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/webhook': {
          target: webhookTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'recharts-vendor': ['recharts'],
            'react-vendor': ['react', 'react-dom'],
            'icons-vendor': ['react-icons/fa']
          }
        }
      },
      chunkSizeWarningLimit: 600
    }
  };
});