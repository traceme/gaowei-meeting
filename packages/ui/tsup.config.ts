import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  tsconfig: './tsconfig.json',
  outDir: 'dist',
  external: ['react', 'react-dom'],
  platform: 'browser',
  keepNames: true,
  bundle: true,
  treeshake: true,
});
