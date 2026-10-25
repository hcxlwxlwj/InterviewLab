import { defineConfig } from 'tsup';
export default defineConfig({
  entry: { api: 'src/entrypoints/api.ts', worker: 'src/entrypoints/worker.ts' },
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  noExternal: ['@interviewlab/core'],
});
