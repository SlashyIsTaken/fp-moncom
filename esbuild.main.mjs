import { build } from 'esbuild';

// Bundle main process + preload, marking 'electron' as external
// so Electron's built-in module is used at runtime instead of the npm package.
await build({
  entryPoints: [
    'src/main/index.ts',
    'src/main/preload.ts',
  ],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outdir: 'dist/main',
  external: ['electron'],
  format: 'cjs',
  sourcemap: true,
});

console.log('Main process built successfully.');
