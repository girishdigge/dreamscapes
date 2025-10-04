#!/usr/bin/env node

/**
 * Test Runner for Dream Data Consistency Validation Tests
 *
 * Runs comprehensive tests for the validation system with proper setup and reporting
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${colors.bright}${colors.cyan}=== ${message} ===${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

/**
 * Run a command and return a promise
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Check if services are running
 */
async function checkServices() {
  logInfo('Checking if services are running...');

  const axios = require('axios');
  const expressUrl = process.env.EXPRESS_URL || 'http://localhost:8000';

  try {
    await axios.get(`${expressUrl}/health`, { timeout: 5000 });
    logSuccess('Express service is running');
    return true;
  } catch (error) {
    logWarning('Express service is not running');
    logWarning(
      'Integration tests will be skipped. Start services with: docker-compose up'
    );
    return false;
  }
}

/**
 * Install dependencies if needed
 */
async function ensureDependencies() {
  const sharedDir = path.join(__dirname, '..', 'shared');
  const packageJsonPath = path.join(sharedDir, 'package.json');
  const nodeModulesPath = path.join(sharedDir, 'node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    logInfo('Installing test dependencies...');
    try {
      await runCommand('npm', ['install'], { cwd: sharedDir });
      logSuccess('Dependencies installed');
    } catch (error) {
      logError('Failed to install dependencies');
      throw error;
    }
  } else {
    logInfo('Dependencies already installed');
  }
}

/**
 * Run unit tests
 */
async function runUnitTests() {
  logHeader('Running Unit Tests');

  const sharedDir = path.join(__dirname, '..', 'shared');

  try {
    await runCommand('npm', ['run', 'test:unit'], { cwd: sharedDir });
    logSuccess('Unit tests passed');
    return { passed: true, suite: 'unit' };
  } catch (error) {
    logError('Unit tests failed');
    return { passed: false, suite: 'unit', error };
  }
}

/**
 * Run integration tests
 */
async function runIntegrationTests(servicesRunning) {
  if (!servicesRunning) {
    logWarning('Skipping integration tests (services not running)');
    return { passed: true, suite: 'integration', skipped: true };
  }

  logHeader('Running Integration Tests');

  const sharedDir = path.join(__dirname, '..', 'shared');

  try {
    // Run E2E tests
    logInfo('Running E2E dream generation tests...');
    await runCommand('npm', ['run', 'test:e2e'], { cwd: sharedDir });
    logSuccess('E2E tests passed');

    // Run error handling tests
    logInfo('Running error handling and recovery tests...');
    await runCommand('npm', ['run', 'test:error'], { cwd: sharedDir });
    logSuccess('Error handling tests passed');

    return { passed: true, suite: 'integration' };
  } catch (error) {
    logError('Integration tests failed');
    return { passed: false, suite: 'integration', error };
  }
}

/**
 * Generate test report
 */
function generateReport(results) {
  logHeader('Test Summary');

  const totalSuites = results.length;
  const passedSuites = results.filter((r) => r.passed).length;
  const failedSuites = results.filter((r) => !r.passed && !r.skipped).length;
  const skippedSuites = results.filter((r) => r.skipped).length;

  log(`\nTotal Test Suites: ${totalSuites}`);
  log(`${colors.green}Passed: ${passedSuites}${colors.reset}`);
  if (failedSuites > 0) {
    log(`${colors.red}Failed: ${failedSuites}${colors.reset}`);
  }
  if (skippedSuites > 0) {
    log(`${colors.yellow}Skipped: ${skippedSuites}${colors.reset}`);
  }

  results.forEach((result) => {
    const status = result.skipped
      ? `${colors.yellow}SKIPPED${colors.reset}`
      : result.passed
      ? `${colors.green}PASSED${colors.reset}`
      : `${colors.red}FAILED${colors.reset}`;

    log(`\n${result.suite}: ${status}`);
    if (result.error) {
      log(`  Error: ${result.error.message}`, colors.red);
    }
  });

  if (failedSuites === 0) {
    log(`\n${colors.green}${colors.bright}🎉 All tests passed!${colors.reset}`);
  } else {
    log(`\n${colors.red}${colors.bright}❌ Some tests failed${colors.reset}`);
  }

  return failedSuites === 0;
}

/**
 * Main test runner
 */
async function main() {
  logHeader('Dream Data Consistency Validation Test Runner');

  const results = [];

  try {
    // Ensure dependencies are installed
    await ensureDependencies();

    // Check if services are running
    const servicesRunning = await checkServices();

    // Run unit tests
    const unitResults = await runUnitTests();
    results.push(unitResults);

    // Run integration tests if services are available
    const integrationResults = await runIntegrationTests(servicesRunning);
    results.push(integrationResults);

    // Generate report
    const allPassed = generateReport(results);

    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    logError(`Test runner failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
