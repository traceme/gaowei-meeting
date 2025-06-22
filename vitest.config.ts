/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['packages/**/src/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      'build',
      '.next',
      'coverage'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/dist/**',
        '**/build/**'
      ]
    },
    ui: true,
    open: false
  },
  resolve: {
    alias: {
      '@gaowei/shared-types': path.resolve(__dirname, './packages/shared-types/src'),
      '@gaowei/ui': path.resolve(__dirname, './packages/ui/src'),
      '@': path.resolve(__dirname, './src')
    }
  }
}); 