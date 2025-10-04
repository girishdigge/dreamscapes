/**
 * Jest Configuration for Shared Module Tests
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'schemas/**/*.js',
    'validators/**/*.js',
    'utils/**/*.js',
    'repair/**/*.js',
    '!**/__tests__/**',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 30000,
  maxWorkers: 1, // Run tests serially to avoid port conflicts
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
};
