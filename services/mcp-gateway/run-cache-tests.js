#!/usr/bin/env node

// run-cache-tests.js
// Script to run cache tests with timeout optimizations

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CACHE_TEST_CONFIG = path.join(__dirname, 'tests', 'cache-jest.config.js');
const TIMEOUT_REPORT_PATH = path.join(
  __dirname,
  'tests',
  'cache-timeout-report.json'
);

console.log('🧪 Running Cache Tests with Timeout Optimizations');
console.log('================================================');

// Clean up previous reports
if (fs.existsSync(TIMEOUT_REPORT_PATH)) {
  fs.unlinkSync(TIMEOUT_REPORT_PATH);
}

// Jest command with cache-specific configuration
const jestArgs = [
  '--config',
  CACHE_TEST_CONFIG,
  '--runInBand', // Run tests serially to avoid resource conflicts
  '--detectOpenHandles',
  '--forceExit',
  '--verbose',
  '--no-cache', // Disable Jest cache for clean runs
];

// Add pattern if specified
if (process.argv[2]) {
  jestArgs.push('--testNamePattern', process.argv[2]);
}

// Add coverage if requested
if (process.argv.includes('--coverage')) {
  jestArgs.push('--coverage');
}

// Add watch mode if requested
if (process.argv.includes('--watch')) {
  jestArgs.push('--watch');
}

console.log('Running Jest with args:', jestArgs.join(' '));

const startTime = Date.now();

const jestProcess = spawn('npx', ['jest', ...jestArgs], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    CACHE_TEST_MODE: 'true',
    REDIS_URL: '', // Force fallback to mock
    VERBOSE_TESTS: process.argv.includes('--verbose') ? 'true' : 'false',
  },
});

jestProcess.on('close', (code) => {
  const duration = Date.now() - startTime;

  console.log('\n📊 Test Execution Summary');
  console.log('=========================');
  console.log(`Total execution time: ${(duration / 1000).toFixed(2)}s`);
  console.log(`Exit code: ${code}`);

  // Check for timeout report
  if (fs.existsSync(TIMEOUT_REPORT_PATH)) {
    try {
      const report = JSON.parse(fs.readFileSync(TIMEOUT_REPORT_PATH, 'utf8'));

      if (report.summary.totalTimeouts > 0) {
        console.log(`❌ Tests with timeouts: ${report.summary.totalTimeouts}`);
      }

      if (report.summary.totalSlowTests > 0) {
        console.log(`⚠️  Slow tests: ${report.summary.totalSlowTests}`);
      }

      if (
        report.summary.totalTimeouts === 0 &&
        report.summary.totalSlowTests === 0
      ) {
        console.log('✅ All tests completed within acceptable time limits');
      }
    } catch (error) {
      console.warn('Failed to read timeout report:', error.message);
    }
  }

  // Performance assessment
  if (duration > 60000) {
    // More than 1 minute
    console.log('⚠️  Test suite took longer than expected');
    console.log(
      '💡 Consider optimizing test configuration or splitting test suites'
    );
  } else if (duration < 30000) {
    // Less than 30 seconds
    console.log('✅ Test suite completed efficiently');
  }

  process.exit(code);
});

jestProcess.on('error', (error) => {
  console.error('Failed to start Jest:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test execution interrupted');
  jestProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test execution terminated');
  jestProcess.kill('SIGTERM');
});
