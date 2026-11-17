import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    // Used by `vitest run --coverage` in npm run check: scripts/constraints.mjs reads the lcov (CONSTRAINTS.md).
    coverage: { provider: 'v8', include: ['src/**'], reporter: ['lcov', 'text-summary'], reportsDirectory: 'coverage' },
  },
});
