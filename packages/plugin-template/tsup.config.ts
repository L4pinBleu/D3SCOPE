import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // The plugin only uses the public API; core is not bundled into it.
  external: ['@d3scope/core', '@d3scope/core/plugin'],
});
