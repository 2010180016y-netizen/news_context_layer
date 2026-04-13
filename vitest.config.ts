import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@news-context/shared-types': fileURLToPath(
        new URL('./packages/shared-types/dist/index.js', import.meta.url)
      ),
      '@news-context/jobs': fileURLToPath(
        new URL('./apps/jobs/src/index.ts', import.meta.url)
      ),
      '@news-context/scoring': fileURLToPath(
        new URL('./packages/scoring/src/index.ts', import.meta.url)
      )
    }
  },
  test: {
    include: ['apps/**/tests/**/*.test.ts', 'packages/**/tests/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false
  }
});
