#!/usr/bin/env node

// tests/integration/run-integration-tests.js
// Test runner for provider interaction integration tests

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const INTEGRATION_TEST_DIR = __dirname;
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Test configuration
const TEST_CONFIG = {
  timeout: 30000, // 30 seconds per test
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1, // Run tests sequentially to avoid conflicts
};

// Test files to run
const TEST_FILES = [
  'provider-interactions.test.js',
  'error-recovery-scenarios.test.js',
  'end-to-end-workflow.test.js',
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(message, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSubHeader(message) {
  log('\n' + '-'.repeat(40), 'blue');
  log(message, 'blue');
  log('-'.repeat(40), 'blue');
}

async function checkPrerequisites() {
  logHeader('Checking Prerequisites');

  // Check if Jest is available
  try {
    const jestPath = path.resolve(PROJECT_ROOT, 'node_modules/.bin/jest');
    if (!fs.existsSync(jestPath)) {
      throw new Error('Jest not found in node_modules');
    }
    log('✓ Jest found', 'green');
  } catch (error) {
    log('✗ Jest not available: ' + error.message, 'red');
    return false;
  }

  // Check if test files exist
  for (const testFile of TEST_FILES) {
    const testPath = path.resolve(INTEGRATION_TEST_DIR, testFile);
    if (!fs.existsSync(testPath)) {
      log(`✗ Test file not found: ${testFile}`, 'red');
      return false;
    }
    log(`✓ Test file found: ${testFile}`, 'green');
  }

  // Check if mock providers exist
  const mockProvidersPath = path.resolve(
    INTEGRATION_TEST_DIR,
    '../mocks/MockProviders.js'
  );
  if (!fs.existsSync(mockProvidersPath)) {
    log('✗ Mock providers not found', 'red');
    return false;
  }
  log('✓ Mock providers found', 'green');

  return true;
}

function runJestTest(testFile, options = {}) {
  return new Promise((resolve, reject) => {
    const jestPath = path.resolve(PROJECT_ROOT, 'node_modules/.bin/jest');
    const testPath = path.resolve(INTEGRATION_TEST_DIR, testFile);

    const args = [
      testPath,
      '--testTimeout=' + (options.timeout || TEST_CONFIG.timeout),
      '--maxWorkers=' + (options.maxWorkers || TEST_CONFIG.maxWorkers),
      '--detectOpenHandles',
      '--forceExit',
    ];

    if (options.verbose || TEST_CONFIG.verbose) {
      args.push('--verbose');
    }

    if (options.coverage) {
      args.push('--coverage');
    }

    log(`Running: ${jestPath} ${args.join(' ')}`, 'cyan');

    const child = spawn(jestPath, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, code });
      } else {
        resolve({ success: false, code });
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function runAllTests(options = {}) {
  logHeader('Running Provider Interaction Integration Tests');

  const results = {
    total: TEST_FILES.length,
    passed: 0,
    failed: 0,
    details: [],
  };

  for (const testFile of TEST_FILES) {
    logSubHeader(`Running ${testFile}`);

    const startTime = Date.now();

    try {
      const result = await runJestTest(testFile, options);
      const duration = Date.now() - startTime;

      if (result.success) {
        log(`✓ ${testFile} passed (${duration}ms)`, 'green');
        results.passed++;
      } else {
        log(`✗ ${testFile} failed (${duration}ms)`, 'red');
        results.failed++;
      }

      results.details.push({
        file: testFile,
        success: result.success,
        duration,
        code: result.code,
      });
    } catch (error) {
      log(`✗ ${testFile} error: ${error.message}`, 'red');
      results.failed++;
      results.details.push({
        file: testFile,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

function printSummary(results) {
  logHeader('Test Results Summary');

  log(`Total tests: ${results.total}`, 'bright');
  log(`Passed: ${results.passed}`, results.passed > 0 ? 'green' : 'reset');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'reset');

  if (results.details.length > 0) {
    logSubHeader('Detailed Results');

    results.details.forEach((detail) => {
      const status = detail.success ? '✓' : '✗';
      const color = detail.success ? 'green' : 'red';
      const duration = detail.duration ? ` (${detail.duration}ms)` : '';
      const error = detail.error ? ` - ${detail.error}` : '';

      log(`${status} ${detail.file}${duration}${error}`, color);
    });
  }

  const successRate =
    results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
  log(`\nSuccess rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');

  return results.failed === 0;
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    coverage: args.includes('--coverage'),
    timeout:
      parseInt(
        args.find((arg) => arg.startsWith('--timeout='))?.split('=')[1]
      ) || TEST_CONFIG.timeout,
    maxWorkers:
      parseInt(
        args.find((arg) => arg.startsWith('--maxWorkers='))?.split('=')[1]
      ) || TEST_CONFIG.maxWorkers,
  };

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    log('Provider Interaction Integration Test Runner', 'bright');
    log('\nUsage: node run-integration-tests.js [options]');
    log('\nOptions:');
    log('  --verbose, -v     Verbose output');
    log('  --coverage        Generate coverage report');
    log('  --timeout=<ms>    Test timeout in milliseconds (default: 30000)');
    log('  --maxWorkers=<n>  Maximum number of worker processes (default: 1)');
    log('  --help, -h        Show this help message');
    return;
  }

  try {
    // Check prerequisites
    const prerequisitesOk = await checkPrerequisites();
    if (!prerequisitesOk) {
      log('\nPrerequisites check failed. Please fix the issues above.', 'red');
      process.exit(1);
    }

    // Run tests
    const results = await runAllTests(options);

    // Print summary
    const success = printSummary(results);

    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  } catch (error) {
    log(`\nFatal error: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`\nUncaught exception: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`\nUnhandled rejection at: ${promise}, reason: ${reason}`, 'red');
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runAllTests,
  runJestTest,
  checkPrerequisites,
  TEST_FILES,
  TEST_CONFIG,
};
