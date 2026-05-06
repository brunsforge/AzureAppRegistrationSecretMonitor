import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/aarm.js',
  external: ['keytar'],
  banner: { js: '#!/usr/bin/env node' },
  format: 'cjs',
});
