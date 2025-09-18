import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    exclude: [
      'src/test/**',     // VS Code integration tests (run with `npm run test:int`)
      'out/**',          // compiled output; avoid double-running compiled tests
      'node_modules/**',
    ],
    environment: 'node',
  },
});
