// vitest.config.ts - 增强配置                                                                                      │
│  import { defineConfig } from 'vitest/config';                                                                       │
│  import { resolve } from 'path';                                                                                     │
│                                                                                                                      │
│  export default defineConfig({                                                                                       │
│    test: {                                                                                                           │
│      globals: true,                                                                                                  │
│      environment: 'jsdom',                                                                                           │
│      setupFiles: ['./test/setup.ts'],                                                                                │
│      coverage: {                                                                                                     │
│        provider: 'v8',                                                                                               │
│        reporter: ['text', 'json', 'html'],                                                                           │
│        exclude: [                                                                                                    │
│          'node_modules/',                                                                                            │
│          'test/',                                                                                                    │
│          '**/*.d.ts',                                                                                                │
│          '**/*.config.*',                                                                                            │
│          '**/dist/**',                                                                                               │
│        ],                                                                                                            │
│        thresholds: {                                                                                                 │
│          global: {                                                                                                   │
│            branches: 80,                                                                                             │
│            functions: 80,                                                                                            │
│            lines: 80,                                                                                                │
│            statements: 80,                                                                                           │
│          },                                                                                                          │
│        },                                                                                                            │
│      },                                                                                                              │
│      testTimeout: 10000,                                                                                             │
│      hookTimeout: 10000,                                                                                             │
│    },                                                                                                                │
│    resolve: {                                                                                                        │
│      alias: {                                                                                                        │
│        '@': resolve(__dirname, './src'),                                                                             │
│        '@test': resolve(__dirname, './test'),                                                                        │
│      },                                                                                                              │
│    },                                                                                                                │
│  });   