import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  tsconfig: '../../tsconfig.json',
  outDir: 'dist',
  external: ['express', 'axios', 'multer', 'cors', 'form-data'],
  platform: 'node',
  keepNames: true,
  bundle: true,
});
