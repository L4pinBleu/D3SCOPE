import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: [
      'src/index.ts',
      'src/plugin/index.ts',
      'src/element/index.ts',
      'src/animation/index.ts',
      'src/animation/motion.ts',
    ],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    // motion is an optional peer: never bundle it.
    external: ['motion'],
  },
  {
    // Script-tag build (PLAN.md §4, mode 3): one file, sets window.D3SCOPE.
    entry: { d3scope: 'src/global-entry.ts' },
    format: ['iife'],
    dts: false,
    sourcemap: true,
    clean: false,
    minify: true,
    target: 'es2020',
  },
]);
