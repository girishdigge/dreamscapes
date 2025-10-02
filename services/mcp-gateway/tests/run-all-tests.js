#!/usr/bin/env node
// tests/run-all-tests.js
// Comprehensive test runner for all test suites

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const testConfig = {
  unit: {
    name: 'Unit Tests',
    pattern: 'tests/unit/**/*.test.js',
    timeout: 30000,
    parallel: true,
  },
  integration: {
    name: 'Integration Tests',
    pattern: 'tests/integration/**/*.test.js',
    timeout: 60000,
    parallel: false,
  },
  performance: {
    name: 'Performance Tests',
    pattern: 'tests/performance/**/*.test.js',
    timeout: 120000,
    parallel: false,
  },
  quality: {
    name: 'Quality Assurance Tests',
    pattern: 'tests/quality/**/*.test.js',
    timeout: 90000,
    parallel: false,
  },
  monitoring: {
    name: 'Monitoring Tests',
    pattern: 'tests/monitoring/**/*.test.js',
    timeout: 60000,
    parallel: false,
  },
  existing: {
    name: 'Existing Tests',
    pattern: 'tests/*.test.js',
    timeout: 60000,
    parallel: true,
  },
};

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

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'reset') {
  console.log(colorize(message, color));
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSubsection(title) {
  console.log('\n' + '-'.repeat(40));
  log(title, 'yellow');
  console.log('-'.repeat(40));
}

// Check if Jest is available
function checkJestAvailability() {
  try {
    execSync('npx jest --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    log('Jest is not available. Installing...', 'yellow');
    try {
      execSync('npm install --save-dev jest', { stdio: 'inherit' });
      return true;
    } catch (installError) {
      log(
        'Failed to install Jest. Please install manually: npm install --save-dev jest',
        'red'
      );
      return false;
    }
  }
}

// Run a specific test suite
async function runTestSuite(suiteName, config) {
  logSubsection(`Running ${config.name}`);

  const jestArgs = [
    '--testPathPatterns',
    config.pattern,
    '--testTimeout',
    config.timeout.toString(),
    '--verbose',
    '--colors',
  ];

  if (config.parallel) {
    jestArgs.push('--maxWorkers=4');
  } else {
    jestArgs.push('--runInBand');
  }

  // Add coverage for unit tests
  if (suiteName === 'unit') {
    jestArgs.push('--coverage', '--coverageDirectory=coverage/unit');
  }

  const command = `npx jest ${jestArgs.join(' ')}`;
  const startTime = Date.now();

  try {
    log(`Command: ${command}`, 'blue');

    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    const duration = Date.now() - startTime;
    log(`✅ ${config.name} completed successfully in ${duration}ms`, 'green');

    return { success: true, duration, suite: suiteName };
  } catch (error) {
    const duration = Date.now() - startTime;
    log(`❌ ${config.name} failed after ${duration}ms`, 'red');

    return { success: false, duration, suite: suiteName, error: error.message };
  }
}

// Check if test files exist
function checkTestFiles() {
  logSubsection('Checking Test Files');

  const testFiles = [];

  Object.entries(testConfig).forEach(([suiteName, config]) => {
    let testDir;

    if (suiteName === 'existing') {
      // For existing tests, look in the tests root directory
      testDir = path.join(process.cwd(), 'tests');
    } else {
      // For categorized tests, look in subdirectories
      testDir = path.join(process.cwd(), 'tests', suiteName);
    }

    if (fs.existsSync(testDir)) {
      let files = [];

      if (suiteName === 'existing') {
        // Get files directly in tests directory
        files = fs
          .readdirSync(testDir)
          .filter(
            (file) =>
              file.endsWith('.test.js') &&
              !fs.statSync(path.join(testDir, file)).isDirectory()
          )
          .map((file) => path.join(testDir, file));
      } else {
        // Get files recursively in subdirectory
        try {
          const getAllFiles = (dir, fileList = []) => {
            const files = fs.readdirSync(dir);
            files.forEach((file) => {
              const filePath = path.join(dir, file);
              if (fs.statSync(filePath).isDirectory()) {
                getAllFiles(filePath, fileList);
              } else if (file.endsWith('.test.js')) {
                fileList.push(filePath);
              }
            });
            return fileList;
          };

          files = getAllFiles(testDir);
        } catch (error) {
          files = [];
        }
      }

      testFiles.push(...files);
      log(`📁 ${suiteName}: ${files.length} test files found`, 'blue');

      if (files.length > 0) {
        files.forEach((file) => {
          const relativePath = path.relative(process.cwd(), file);
          log(`   - ${relativePath}`, 'blue');
        });
      }
    } else {
      log(`📁 ${suiteName}: Directory not found (${testDir})`, 'yellow');
    }
  });

  log(`\n📊 Total test files found: ${testFiles.length}`, 'cyan');
  return testFiles.length > 0;
}

// Generate test report
function generateReport(results) {
  logSection('Test Execution Report');

  const totalDuration = results.reduce(
    (sum, result) => sum + result.duration,
    0
  );
  const successfulSuites = results.filter((r) => r.success);
  const failedSuites = results.filter((r) => !r.success);

  log(`📊 Test Summary:`, 'bright');
  log(`   Total Suites: ${results.length}`, 'blue');
  log(`   Successful: ${successfulSuites.length}`, 'green');
  log(
    `   Failed: ${failedSuites.length}`,
    failedSuites.length > 0 ? 'red' : 'green'
  );
  log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`, 'blue');

  if (successfulSuites.length > 0) {
    log(`\n✅ Successful Suites:`, 'green');
    successfulSuites.forEach((result) => {
      log(
        `   ${result.suite}: ${(result.duration / 1000).toFixed(2)}s`,
        'green'
      );
    });
  }

  if (failedSuites.length > 0) {
    log(`\n❌ Failed Suites:`, 'red');
    failedSuites.forEach((result) => {
      log(`   ${result.suite}: ${result.error}`, 'red');
    });
  }

  // Performance analysis
  log(`\n⚡ Performance Analysis:`, 'yellow');
  results.forEach((result) => {
    const speed =
      result.duration < 30000
        ? 'Fast'
        : result.duration < 60000
        ? 'Medium'
        : 'Slow';
    const speedColor =
      speed === 'Fast' ? 'green' : speed === 'Medium' ? 'yellow' : 'red';
    log(
      `   ${result.suite}: ${(result.duration / 1000).toFixed(2)}s (${speed})`,
      speedColor
    );
  });

  return failedSuites.length === 0;
}

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  const specificSuite = args[0];
  const skipExisting = args.includes('--skip-existing');
  const skipPerformance = args.includes('--skip-performance');
  const onlyUnit = args.includes('--unit-only');
  const onlyIntegration = args.includes('--integration-only');

  logSection('🧪 Dreamscapes MCP Gateway - Comprehensive Test Suite');

  log('Test Configuration:', 'bright');
  log(`  Node Version: ${process.version}`, 'blue');
  log(`  Working Directory: ${process.cwd()}`, 'blue');
  log(`  Arguments: ${args.join(' ') || 'none'}`, 'blue');

  // Check Jest availability
  if (!checkJestAvailability()) {
    process.exit(1);
  }

  // Check test files
  if (!checkTestFiles()) {
    log('No test files found. Exiting.', 'red');
    process.exit(1);
  }

  // Determine which suites to run
  let suitesToRun = Object.keys(testConfig);

  if (specificSuite) {
    if (testConfig[specificSuite]) {
      suitesToRun = [specificSuite];
      log(`Running specific suite: ${specificSuite}`, 'yellow');
    } else {
      log(`Unknown test suite: ${specificSuite}`, 'red');
      log(`Available suites: ${Object.keys(testConfig).join(', ')}`, 'blue');
      process.exit(1);
    }
  } else {
    if (skipExisting) {
      suitesToRun = suitesToRun.filter((suite) => suite !== 'existing');
    }
    if (skipPerformance) {
      suitesToRun = suitesToRun.filter((suite) => suite !== 'performance');
    }
    if (onlyUnit) {
      suitesToRun = ['unit'];
    }
    if (onlyIntegration) {
      suitesToRun = ['integration'];
    }
  }

  log(`\nSuites to run: ${suitesToRun.join(', ')}`, 'cyan');

  // Run test suites
  const results = [];
  const startTime = Date.now();

  for (const suiteName of suitesToRun) {
    const config = testConfig[suiteName];
    const result = await runTestSuite(suiteName, config);
    results.push(result);

    // Stop on first failure if running all suites
    if (
      !result.success &&
      !specificSuite &&
      !args.includes('--continue-on-failure')
    ) {
      log(
        '\n⚠️  Stopping execution due to test failure. Use --continue-on-failure to continue.',
        'yellow'
      );
      break;
    }
  }

  const totalTime = Date.now() - startTime;

  // Generate report
  const allPassed = generateReport(results);

  log(
    `\n🏁 Test execution completed in ${(totalTime / 1000).toFixed(2)}s`,
    'bright'
  );

  if (allPassed) {
    log('🎉 All tests passed!', 'green');
    process.exit(0);
  } else {
    log('💥 Some tests failed!', 'red');
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log(`\n💥 Uncaught Exception: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`\n💥 Unhandled Rejection at: ${promise}, reason: ${reason}`, 'red');
  process.exit(1);
});

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🧪 Dreamscapes MCP Gateway Test Runner

Usage: node tests/run-all-tests.js [suite] [options]

Suites:
  unit          Run unit tests only
  integration   Run integration tests only
  performance   Run performance tests only
  quality       Run quality assurance tests only
  monitoring    Run monitoring tests only
  existing      Run existing tests only

Options:
  --unit-only              Run only unit tests
  --integration-only       Run only integration tests
  --skip-existing         Skip existing tests
  --skip-performance      Skip performance tests
  --continue-on-failure   Continue running tests even if some fail
  --help, -h              Show this help message

Examples:
  node tests/run-all-tests.js                    # Run all tests
  node tests/run-all-tests.js unit              # Run unit tests only
  node tests/run-all-tests.js --unit-only       # Run unit tests only
  node tests/run-all-tests.js --skip-performance # Run all except performance tests
`);
  process.exit(0);
}

// Run main function
main().catch((error) => {
  log(`\n💥 Fatal Error: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});
