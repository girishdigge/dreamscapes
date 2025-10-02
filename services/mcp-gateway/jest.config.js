// jest.config.js
// Jest configuration for comprehensive testing

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.spec.js'],

  // Coverage configuration
  collectCoverage: false, // Enable via CLI when needed
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  collectCoverageFrom: [
    'services/**/*.js',
    'providers/**/*.js',
    'engine/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**',
    '!**/examples/**',
    '!**/docs/**',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module resolution
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Test timeout
  testTimeout: 30000, // 30 seconds default

  // Verbose output
  verbose: true,

  // Error handling
  bail: false, // Continue running tests after failures

  // Parallel execution
  maxWorkers: '50%', // Use 50% of available CPU cores

  // Transform configuration (if needed for ES modules)
  transform: {},

  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'node'],

  // Global variables
  globals: {
    'process.env.NODE_ENV': 'test',
  },

  // Test result processor
  reporters: ['default'],

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Error on deprecated features
  errorOnDeprecated: true,

  // Detect open handles
  detectOpenHandles: true,
  forceExit: true,

  // Test name pattern (can be overridden via CLI)
  testNamePattern: undefined,

  // Watch mode configuration
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/logs/',
  ],

  // Custom test sequencer for performance tests
  testSequencer: '<rootDir>/tests/testSequencer.js',
};
