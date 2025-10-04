// jest.performance.config.js
// Master performance-optimized Jest configuration

const baseConfig = require('./jest.config.js');
const os = require('os');

// Performance optimization configuration
module.exports = {
  ...baseConfig,

  // Performance-optimized settings
  testTimeout: 10000, // Reduced from 30s to 10s
  maxWorkers: Math.min(Math.floor(os.cpus().length * 0.75), 6), // Optimal worker count

  // Enhanced setup files for performance
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js',
    '<rootDir>/tests/configs/performanceSetup.js',
    '<rootDir>/tests/configs/parallelSetup.js',
    '<rootDir>/tests/configs/resourceSetup.js',
    '<rootDir>/tests/configs/monitoringSetup.js',
  ],

  // Performance-optimized test patterns
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/quality/**/*.test.js',
    '**/tests/monitoring/**/*.test.js',
  ],

  // Exclude slow tests by default
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/tests/performance/', // Run separately
    '<rootDir>/tests/**/*.slow.test.js',
    '<rootDir>/tests/**/*.e2e.test.js',
  ],

  // Performance-optimized sequencer
  testSequencer: '<rootDir>/tests/configs/performanceSequencer.js',

  // Enhanced reporters for performance monitoring
  reporters: [
    'default',
    [
      '<rootDir>/tests/utils/performanceReporter.js',
      {
        outputFile:
          '<rootDir>/tests/.performance-cache/performance-results.json',
        enableCaching: true,
      },
    ],
    [
      '<rootDir>/tests/utils/parallelReporter.js',
      {
        outputFile: '<rootDir>/tests/.performance-cache/parallel-results.json',
      },
    ],
  ],

  // Optimized cache settings
  cache: true,
  cacheDirectory: '<rootDir>/tests/.jest-cache-performance',

  // Memory and resource optimization
  workerIdleMemoryLimit: '512MB',
  logHeapUsage: false,
  detectOpenHandles: false, // Handled by cleanup manager
  forceExit: true,

  // Coverage disabled for performance (enable separately if needed)
  collectCoverage: false,

  // Performance-focused globals
  globals: {
    'process.env.NODE_ENV': 'test',
    'process.env.PERFORMANCE_MODE': 'true',
    'process.env.PARALLEL_MODE': 'true',
    'process.env.FAST_MODE': 'true',
    'process.env.ENABLE_MONITORING': 'true',
  },

  // Optimized module resolution
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Transform optimization
  transform: {},

  // Error handling
  bail: false, // Continue running to get full performance picture
  verbose: false, // Reduce output for performance
  silent: false, // Keep error output

  // Watch mode optimization
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/logs/',
    '<rootDir>/tests/.performance-cache/',
    '<rootDir>/tests/.jest-cache-performance/',
    '<rootDir>/tests/.temp/',
  ],
};
