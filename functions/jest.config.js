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
};
