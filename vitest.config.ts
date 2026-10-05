import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/game/**', 'src/engine/**'],
      // DOM glue only; everything pure (sim, rasterizer, loop) is measured.
      exclude: ['src/engine/blit.ts', 'src/engine/runtime.ts', 'src/engine/api.ts', '**/*.d.ts'],
      thresholds: { lines: 80 },
      reporter: ['text-summary', 'html'],
    },
  },
});
