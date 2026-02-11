import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'], // Only test src code, skip .claude/hooks
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/__tests__/**',
        '**/dist/**',
        '**/node_modules/**',
        'src/types/**', // Type definitions don't need coverage
        'src/index.ts', // Entry point, tested via integration
        'src/config/env.ts', // Config, no logic to test
      ],
      // Phase 0: Foundation coverage baseline
      // Target 80%+ coverage will be achieved in Phase 1-6 as features are added
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 68,
        lines: 60
      }
    }
  }
});
