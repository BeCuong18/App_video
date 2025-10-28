import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const plugins = [react()];

  if (mode === 'development') {
    const { createAutomationPlugin } = await import('./automation/automationPlugin');
    plugins.push(createAutomationPlugin());
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins,
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
