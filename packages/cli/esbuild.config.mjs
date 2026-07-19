import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/aarm.mjs',
  external: ['keytar'],
  format: 'esm',
  // ESM output needs a real require() for external native modules (keytar).
  // esbuild preserves the entry shebang on line 1; this banner is injected after it.
  banner: {
    js: "import { createRequire as __createRequire } from 'module';\nconst require = __createRequire(import.meta.url);",
  },
});
