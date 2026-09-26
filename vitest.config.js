import { defineConfig } from 'vitest/config';

// Vitest searches upward for its configuration. This file keeps a checkout inside another repository on its own tests.
export default defineConfig({
  test: { include: ['test/**/*.test.js'] },
});
