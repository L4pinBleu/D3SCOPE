import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // The core is loaded at runtime, never bundled into the plugin.
  external: ['@d3scope/core', '@d3scope/core/plugin'],
});
