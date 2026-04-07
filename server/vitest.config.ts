import path from 'node:path';

import { defineConfig } from 'vitest/config';

const moduleDir = import.meta.dirname;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(moduleDir, './src'),
    },
    // Allow `.js` import specifiers in `.ts` files (NodeNext convention)
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
});
