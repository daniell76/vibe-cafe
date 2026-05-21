import { defineConfig } from 'vitest/config';
import path from 'path';

// Module-level env vars referenced by lib/vertex-ai.ts must be present before
// the test runner imports the module under test.
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'test-project';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
