import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

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
        'src/express.ts',
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
  plugins: [
    tsconfigPaths(),
  ]
});
