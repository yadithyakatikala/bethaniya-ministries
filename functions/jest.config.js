module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testPathIgnorePatterns: ['/node_modules/', '/lib/'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        // Suppresses a ts-jest warning about Node16 module resolution that
        // doesn't affect correctness here (see ts-jest docs TS151002).
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  // Day 15: "test coverage report" -- only collected by `npm run
  // test:coverage`. Most of this package's tests require
  // FIRESTORE_EMULATOR_HOST and don't run in this environment (see
  // README.md's "Testing status"), so the resulting number reflects only
  // what actually executes here, not the whole package.
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts'],
};
