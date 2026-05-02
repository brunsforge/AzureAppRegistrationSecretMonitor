import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Long timeouts — real Graph calls + browser login can take time
    testTimeout:    60_000,
    hookTimeout:   120_000,
    // Run test FILES sequentially so only one browser window opens
    sequence: { concurrent: false },
    // Run tests inside each file sequentially too
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
