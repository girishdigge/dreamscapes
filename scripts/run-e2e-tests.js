#!/usr/bin/env node

/**
 * End-to-End Test Runner
 *
 * This script provides a comprehensive test runner for the Dreamscapes E2E integration tests.
 * It handles test execution, error recovery, and provides detailed reporting.
 *
 * Usage:
 *   node run-e2e-tests.js [options]
 *
 * Options:
 *   --skip-build    Skip Docker image rebuilding
 *   --quick         Run quick tests only (skip dream generation)
 *   --cleanup-only  Only run cleanup (stop containers)
 *   --verbose       Enable verbose logging
 *   --timeout=N     Set custom timeout in seconds (default: 300)
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  skipBuild: args.includes('--skip-build'),
  quick: args.includes('--quick'),
  cleanupOnly: args.includes('--cleanup-only'),
  verbose: args.includes('--verbose'),
  timeout:
    parseInt(args.find((arg) => arg.startsWith('--timeout='))?.split('=')[1]) ||
    300,
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

function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logHeader(message) {
  log(`\n${colors.bright}${colors.cyan}=== ${message} ===${colors.reset}`);
}

/**
 * Execute shell command with promise and timeout
 */
function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || 30000;

    const child = exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timeout after ${timeout}ms: ${command}`));
    }, timeout);

    child.on('exit', () => {
      clearTimeout(timeoutId);
    });
  });
}

/**
 * Check prerequisites
 */
async function checkPrerequisites() {
  logHeader('Checking Prerequisites');

  const checks = [
    { name: 'Docker', command: 'docker --version' },
    { name: 'Docker Compose', command: 'docker-compose --version' },
    { name: 'Node.js', command: 'node --version' },
    { name: 'NPM', command: 'npm --version' },
  ];

  for (const check of checks) {
    try {
      const result = await execCommand(check.command, { timeout: 5000 });
      logSuccess(`${check.name} is available`);
      if (options.verbose) {
        logInfo(`  ${result.stdout.trim()}`);
      }
    } catch (error) {
      logError(`${check.name} is not available or not working`);
      throw new Error(`Missing prerequisite: ${check.name}`);
    }
  }

  // Check if we're in the right directory
  const dockerComposePath = path.join(
    process.cwd(),
    '..',
    'docker-compose.yml'
  );
  if (!fs.existsSync(dockerComposePath)) {
    throw new Error(
      'docker-compose.yml not found. Please run this script from the scripts directory.'
    );
  }

  logSuccess('All prerequisites met');
}

/**
 * Install test dependencies
 */
async function installDependencies() {
  logHeader('Installing Test Dependencies');

  try {
    logInfo('Installing NPM dependencies...');
    await execCommand('npm install', {
      timeout: 60000,
      cwd: __dirname,
    });
    logSuccess('Dependencies installed successfully');
  } catch (error) {
    logError(`Failed to install dependencies: ${error.message}`);
    throw error;
  }
}

/**
 * Cleanup existing containers
 */
async function cleanup() {
  logHeader('Cleaning Up Existing Containers');

  try {
    logInfo('Stopping any running containers...');
    await execCommand('docker-compose down --remove-orphans', {
      timeout: 60000,
      cwd: path.join(__dirname, '..'),
    });
    logSuccess('Cleanup completed');
  } catch (error) {
    logWarning(`Cleanup had issues (this is usually fine): ${error.message}`);
  }

  // Also clean up any dangling containers
  try {
    logInfo('Removing dangling containers...');
    await execCommand('docker container prune -f', { timeout: 30000 });
    logSuccess('Dangling containers removed');
  } catch (error) {
    logWarning(`Container cleanup had issues: ${error.message}`);
  }
}

/**
 * Run the main E2E test
 */
async function runE2ETest() {
  logHeader('Running End-to-End Integration Test');

  return new Promise((resolve, reject) => {
    const testScript = path.join(__dirname, 'e2e-integration-test.js');

    logInfo(`Starting E2E test with timeout of ${options.timeout} seconds...`);

    const testProcess = spawn('node', [testScript], {
      stdio: 'inherit',
      cwd: __dirname,
    });

    // Set overall timeout
    const timeoutId = setTimeout(() => {
      logError(`Test timeout after ${options.timeout} seconds`);
      testProcess.kill('SIGTERM');
      reject(new Error('Test timeout'));
    }, options.timeout * 1000);

    testProcess.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code === 0) {
        logSuccess('E2E test completed successfully');
        resolve({ success: true, exitCode: code });
      } else {
        logError(`E2E test failed with exit code ${code}`);
        resolve({ success: false, exitCode: code });
      }
    });

    testProcess.on('error', (error) => {
      clearTimeout(timeoutId);
      logError(`Test process error: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Generate summary report
 */
function generateSummaryReport(testResult) {
  logHeader('Test Execution Summary');

  const reportPath = path.join(__dirname, '..', 'e2e-test-results.json');
  const htmlReportPath = path.join(__dirname, '..', 'e2e-test-report.html');

  console.log(`${colors.bright}Test Execution Details:${colors.reset}`);
  console.log(`  Exit Code: ${testResult.exitCode}`);
  console.log(`  Success: ${testResult.success ? 'Yes' : 'No'}`);
  console.log(`  Options Used:`);
  console.log(`    Skip Build: ${options.skipBuild}`);
  console.log(`    Quick Mode: ${options.quick}`);
  console.log(`    Verbose: ${options.verbose}`);
  console.log(`    Timeout: ${options.timeout}s`);

  // Check if detailed results are available
  if (fs.existsSync(reportPath)) {
    try {
      const results = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      console.log(`\n${colors.bright}Detailed Results:${colors.reset}`);
      console.log(`  Total Tests: ${results.summary.total}`);
      console.log(`  Passed: ${results.summary.passed}`);
      console.log(`  Failed: ${results.summary.failed}`);
      console.log(
        `  Success Rate: ${Math.round(
          (results.summary.passed / results.summary.total) * 100
        )}%`
      );
      console.log(
        `  Duration: ${Math.round(results.summary.duration / 1000)}s`
      );

      logSuccess(`Detailed JSON report: ${reportPath}`);

      if (fs.existsSync(htmlReportPath)) {
        logSuccess(`HTML report: ${htmlReportPath}`);
      }
    } catch (error) {
      logWarning(`Could not read detailed results: ${error.message}`);
    }
  }

  // Provide next steps
  console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
  if (testResult.success) {
    console.log(
      `  ${colors.green}🎉 All tests passed! Your Dreamscapes application is working correctly.${colors.reset}`
    );
    console.log(`  - You can now use the application with confidence`);
    console.log(
      `  - Consider running these tests regularly during development`
    );
  } else {
    console.log(
      `  ${colors.yellow}⚠️  Some tests failed. Here's what you can do:${colors.reset}`
    );
    console.log(
      `  - Check the detailed reports for specific failure information`
    );
    console.log(`  - Run individual service tests: npm run verify`);
    console.log(`  - Check Docker logs: docker-compose logs [service-name]`);
    console.log(`  - Try running with --verbose for more details`);
  }
}

/**
 * Main execution function
 */
async function main() {
  logHeader('Dreamscapes E2E Test Runner');

  console.log(`${colors.bright}Configuration:${colors.reset}`);
  console.log(`  Skip Build: ${options.skipBuild}`);
  console.log(`  Quick Mode: ${options.quick}`);
  console.log(`  Cleanup Only: ${options.cleanupOnly}`);
  console.log(`  Verbose: ${options.verbose}`);
  console.log(`  Timeout: ${options.timeout}s`);

  let testResult = { success: false, exitCode: 1 };

  try {
    // Always check prerequisites
    await checkPrerequisites();

    // Always install dependencies
    await installDependencies();

    // Always cleanup first
    await cleanup();

    // If cleanup-only mode, exit here
    if (options.cleanupOnly) {
      logSuccess('Cleanup completed. Exiting as requested.');
      process.exit(0);
    }

    // Run the main E2E test
    testResult = await runE2ETest();
  } catch (error) {
    logError(`Test runner failed: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
  } finally {
    // Always try to cleanup
    try {
      await cleanup();
    } catch (cleanupError) {
      logWarning(`Final cleanup failed: ${cleanupError.message}`);
    }

    // Generate summary report
    generateSummaryReport(testResult);

    // Exit with appropriate code
    process.exit(testResult.exitCode);
  }
}

// Handle script execution
if (require.main === module) {
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logWarning('Received SIGINT, cleaning up...');
    try {
      await cleanup();
    } catch (error) {
      logError(`Cleanup during shutdown failed: ${error.message}`);
    }
    process.exit(130);
  });

  process.on('SIGTERM', async () => {
    logWarning('Received SIGTERM, cleaning up...');
    try {
      await cleanup();
    } catch (error) {
      logError(`Cleanup during shutdown failed: ${error.message}`);
    }
    process.exit(143);
  });

  main().catch((error) => {
    logError(`Test runner crashed: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = {
  checkPrerequisites,
  installDependencies,
  cleanup,
  runE2ETest,
  options,
};
