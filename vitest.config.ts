import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/game/**', 'src/engine/**'],
      exclude: [
        'src/engine/renderer.ts',
        'src/engine/loop.ts',
        'src/engine/runtime.ts',
        '**/*.d.ts',
      ],
      thresholds: { lines: 80 },
      reporter: ['text-summary', 'html'],
    },
  },
});
