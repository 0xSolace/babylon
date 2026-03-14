import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  target: 'esnext',
  tsconfig: 'tsconfig.build.json',
  external: ['@elizaos/core'],
});
