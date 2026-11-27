import { defineConfig } from 'vitest/config';

const rules = Boolean(process.env.RULES_TESTS);

export default defineConfig({
  test: {
    environment: 'node',
    include: [rules ? 'tests/rules/**/*.test.ts' : 'tests/unit/**/*.test.ts'],
    fileParallelism: !rules,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
