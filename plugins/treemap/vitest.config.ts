import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@d3scope/core/plugin': fileURLToPath(
        new URL('../../packages/core/src/plugin/index.ts', import.meta.url),
      ),
      '@d3scope/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'lcov'],
      // CI blocks below 80% (see PLAN.md §8)
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
