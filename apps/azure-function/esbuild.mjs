import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/index.js',
  format: 'esm',
  // @azure/functions must stay in node_modules (runtime resolves it).
  // @azure/functions-core is injected by the Azure Functions runtime host.
  // keytar and identity-cache-persistence are OS-keychain libs (Windows/macOS only).
  external: ['@azure/functions', '@azure/functions-core', 'keytar', '@azure/identity-cache-persistence'],
  mainFields: ['module', 'main'],
  sourcemap: false,
  // CJS packages bundled into ESM need require() for Node.js built-ins (net, fs, …).
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
});

console.log('Bundle complete: dist/index.js');
