import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'edge-runtime',
    include: ['tests/**/*.spec.ts'],
    server: { deps: { inline: ['convex-test'] } },
  },
});
