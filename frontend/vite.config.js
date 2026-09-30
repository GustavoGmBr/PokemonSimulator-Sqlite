import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { workspaceId } from '../scripts/game-identity.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
      }
    },
    server: {
      host: true,
      allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'],
      port: 5185,
      strictPort: true,
      headers: { 'X-Pokemon-Workspace': workspaceId },
      proxy: Object.fromEntries(
        ['/api', '/assets'].map((prefix) => [
          prefix,
          {
            target: env.API_PROXY_TARGET || 'http://127.0.0.1:3435',
            changeOrigin: true
          }
        ])
      ),
    },
  };
});
