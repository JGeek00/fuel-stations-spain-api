import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/__tests__/**',
        'src/migrations/**',
        'src/bootstrap.ts',
        'src/server.ts',
        'src/config/',
        'src/migrations/',
        'src/models',
        'src/dto',
        'src/mapper',
        'src/routes',
      ],
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
