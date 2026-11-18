import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    pool: 'forks',
    fileParallelism: false,
    env: { NODE_ENV: 'test', JOBS_IN_PROCESS: 'false', SEED_ON_EMPTY: 'false' },
  },
});
