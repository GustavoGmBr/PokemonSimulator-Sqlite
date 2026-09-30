import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { workspaceId } from '../scripts/game-identity.js';
import { API_PORT, FRONTEND_PORT } from '../scripts/game-ports.js';

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
      host: '127.0.0.1',
      allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'],
      port: FRONTEND_PORT,
      strictPort: true,
      headers: { 'X-Pokemon-Workspace': workspaceId },
      proxy: Object.fromEntries(
        ['/api', '/assets'].map((prefix) => [
          prefix,
          {
            target: process.env.API_PROXY_TARGET || env.API_PROXY_TARGET || `http://127.0.0.1:${API_PORT}`,
            changeOrigin: true
          }
        ])
      ),
    },
  };
});
