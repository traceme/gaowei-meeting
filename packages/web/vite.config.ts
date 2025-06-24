import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@gaowei/shared-types': resolve(__dirname, '../shared-types/src'),
      '@gaowei/ui': resolve(__dirname, '../ui/src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
  },
  server: {
    port: 5173,
    proxy: {
      // API路由代理
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 120000, // 2分钟超时，适配长时间的AI处理
      },
      // 静态文件代理（音频文件等）
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 30000, // 30秒超时，适配大文件下载
      },
    },
  },
});
