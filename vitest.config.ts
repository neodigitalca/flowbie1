import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'wordpress-plugins/neo-pulse-app/tests/**/*.test.mjs',
      'wordpress-plugins/neo-pulse-wp/tests/**/*.test.mjs',
      'scripts/research/browser-automation/__tests__/**/*.test.mjs',
      'scripts/template-client-migrate/__tests__/**/*.test.ts',
      'scripts/edmonton-internal-links/__tests__/**/*.test.ts',
      'scripts/firstrank-teardown/__tests__/**/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
