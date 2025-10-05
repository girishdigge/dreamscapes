module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!jest.config.js',
  ],
  // Mock static assets and styles
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Mock uuid to avoid ES module issues
    '^uuid$': '<rootDir>/tests/__mocks__/uuid.js',
  },
  // Setup files
  setupFilesAfterEnv: [],
  // Verbose output
  verbose: true,
  // Timeout for tests
  testTimeout: 10000,
};
