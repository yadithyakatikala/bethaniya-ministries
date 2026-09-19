import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    // TEST-ONLY. Vite refuses to read files outside the project root, and
    // src/features/daily-verses/__tests__/votdSelection.test.ts
    // deliberately reads the MOBILE package's golden vectors so the two
    // copies of the Verse-of-the-Day algorithm cannot drift apart. This
    // widening applies to the test server only -- `npm run build` is
    // unaffected, and no application code imports across packages.
    server: { fs: { allow: ['..'] } },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: true,
      // Day 15: "test coverage report" -- only collected when `npm run
      // test:coverage` passes --coverage (the default `npm test` stays
      // fast/uninstrumented for everyday use). text+html for local
      // reading, json-summary so a future CI step could read a number
      // back out without re-parsing the text report.
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'json-summary'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/**/__tests__/**',
          'src/test/**',
          'src/main.tsx',
          'src/vite-env.d.ts',
        ],
      },
    },
  })
);
