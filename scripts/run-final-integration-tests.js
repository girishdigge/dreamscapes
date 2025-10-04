#!/usr/bin/env node

/**
 * Final Integration Test Runner
 *
 * This script orchestrates comprehensive end-to-end testing to validate
 * that the AI provider integration enhancement meets all requirements.
 *
 * Test Coverage:
 * - Service health and availability
 * - AI provider quality and functionality
 * - Load testing and stress testing
 * - Video generation quality validation
 * - System stability under load
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// Test configuration
const TEST_CONFIG = {
  dockerComposeFile: '../docker-compose.yml',
  testTimeout: 600000, // 10 minutes total timeout
  serviceStartupTimeout: 180000, // 3 minutes for services to start
  cleanupTimeout: 60000, // 1 minute for cleanup
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
  ];

  for (const check of checks) {
    try {
      const result = await execCommand(check.command, { timeout: 5000 });
      logSuccess(`${check.name} is available`);
      logInfo(`  ${result.stdout.trim()}`);
    } catch (error) {
      logError(`${check.name} is not available`);
      throw new Error(`Missing prerequisite: ${check.name}`);
    }
  }

  // Check if docker-compose.yml exists
  const dockerComposePath = path.join(__dirname, TEST_CONFIG.dockerComposeFile);
  if (!fs.existsSync(dockerComposePath)) {
    throw new Error(`docker-compose.yml not found at ${dockerComposePath}`);
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
    logInfo('Stopping containers...');
    await execCommand('docker-compose down --remove-orphans', {
      timeout: TEST_CONFIG.cleanupTimeout,
      cwd: path.join(__dirname, '..'),
    });

    logInfo('Removing unused containers and networks...');
    await execCommand('docker system prune -f', { timeout: 30000 });

    logSuccess('Cleanup completed');
  } catch (error) {
    logWarning(`Cleanup had issues: ${error.message}`);
  }
}

/**
 * Start services
 */
async function startServices() {
  logHeader('Starting Dreamscapes Services');

  try {
    logInfo('Building and starting services...');

    // Start services in background
    const startCommand = 'docker-compose up -d --build';
    await execCommand(startCommand, {
      timeout: TEST_CONFIG.serviceStartupTimeout,
      cwd: path.join(__dirname, '..'),
    });

    logSuccess('Services started successfully');

    // Wait a bit for services to fully initialize
    logInfo('Waiting for services to initialize...');
    await new Promise((resolve) => setTimeout(resolve, 30000));

    return true;
  } catch (error) {
    logError(`Failed to start services: ${error.message}`);
    throw error;
  }
}

/**
 * Check service health
 */
async function checkServiceHealth() {
  logHeader('Checking Service Health');

  const services = [
    { name: 'Express API', url: 'http://localhost:8000/health' },
    { name: 'MCP Gateway', url: 'http://localhost:8080/health' },
    { name: 'Render Worker', url: 'http://localhost:8001/health' },
    { name: 'Llama Stylist', url: 'http://localhost:8002/health' },
    { name: 'Frontend', url: 'http://localhost:3000' },
  ];

  const fetch = require('node-fetch');
  const maxRetries = 30;
  const retryDelay = 5000;

  for (const service of services) {
    let retries = 0;
    let healthy = false;

    while (retries < maxRetries && !healthy) {
      try {
        const response = await fetch(service.url, { timeout: 10000 });
        if (response.ok) {
          logSuccess(`${service.name} is healthy`);
          healthy = true;
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        retries++;
        if (retries < maxRetries) {
          logInfo(
            `${service.name} not ready, retrying... (${retries}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          logError(`${service.name} failed health check: ${error.message}`);
          throw new Error(`Service ${service.name} is not healthy`);
        }
      }
    }
  }

  logSuccess('All services are healthy');
}

/**
 * Run MCP Gateway comprehensive tests
 */
async function runMCPGatewayTests() {
  logHeader('Running MCP Gateway Comprehensive Tests');

  try {
    const testCommand = 'npm run test:all';
    const result = await execCommand(testCommand, {
      timeout: 300000, // 5 minutes
      cwd: path.join(__dirname, '..', 'services', 'mcp-gateway'),
    });

    logSuccess('MCP Gateway tests completed successfully');
    return true;
  } catch (error) {
    logError(`MCP Gateway tests failed: ${error.message}`);
    return false;
  }
}

/**
 * Run final integration validation
 */
async function runFinalIntegrationValidation() {
  logHeader('Running Final Integration Validation');

  return new Promise((resolve, reject) => {
    const testScript = path.join(__dirname, 'final-integration-validation.js');

    logInfo('Starting comprehensive final integration tests...');

    const testProcess = spawn('node', [testScript], {
      stdio: 'inherit',
      cwd: __dirname,
    });

    const timeoutId = setTimeout(() => {
      logError('Final integration tests timed out');
      testProcess.kill('SIGTERM');
      reject(new Error('Test timeout'));
    }, TEST_CONFIG.testTimeout);

    testProcess.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code === 0) {
        logSuccess('Final integration validation completed successfully');
        resolve(true);
      } else {
        logError(`Final integration validation failed with exit code ${code}`);
        resolve(false);
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
 * Run existing E2E tests for comparison
 */
async function runExistingE2ETests() {
  logHeader('Running Existing E2E Tests for Comparison');

  try {
    const testScript = path.join(__dirname, 'test-complete-workflow.js');

    const testProcess = spawn('node', [testScript], {
      stdio: 'inherit',
      cwd: __dirname,
    });

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        logWarning('E2E tests timed out');
        testProcess.kill('SIGTERM');
        resolve(false);
      }, 120000); // 2 minutes

      testProcess.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code === 0) {
          logSuccess('Existing E2E tests passed');
          resolve(true);
        } else {
          logWarning('Existing E2E tests had issues');
          resolve(false);
        }
      });

      testProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        logWarning(`E2E test error: ${error.message}`);
        resolve(false);
      });
    });
  } catch (error) {
    logWarning(`Could not run existing E2E tests: ${error.message}`);
    return false;
  }
}

/**
 * Generate final test summary
 */
function generateFinalSummary(results) {
  logHeader('Final Integration Test Summary');

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter((r) => r === true).length;
  const failedTests = totalTests - passedTests;

  console.log(`${colors.bright}Test Results Summary:${colors.reset}`);
  console.log(`  Total Test Suites: ${totalTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${failedTests}`);
  console.log(
    `  Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`
  );

  console.log(`\n${colors.bright}Individual Results:${colors.reset}`);
  Object.entries(results).forEach(([testName, passed]) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    const color = passed ? colors.green : colors.red;
    console.log(`  ${color}${testName}: ${status}${colors.reset}`);
  });

  // Check if reports were generated
  const reportFiles = [
    '../final-integration-test-results.json',
    '../final-integration-test-report.html',
  ];

  console.log(`\n${colors.bright}Generated Reports:${colors.reset}`);
  reportFiles.forEach((reportFile) => {
    const fullPath = path.join(__dirname, reportFile);
    if (fs.existsSync(fullPath)) {
      logSuccess(`Report available: ${path.resolve(fullPath)}`);
    }
  });

  const overallSuccess = failedTests === 0;

  if (overallSuccess) {
    console.log(
      `\n${colors.bright}${colors.green}🎉 FINAL INTEGRATION TESTS PASSED!${colors.reset}`
    );
    console.log(
      `${colors.green}✅ AI Provider Integration Enhancement is successful${colors.reset}`
    );
    console.log(
      `${colors.green}✅ Video generation quality has significantly improved${colors.reset}`
    );
    console.log(
      `${colors.green}✅ System stability validated under load${colors.reset}`
    );
    console.log(
      `${colors.green}✅ All requirements have been met${colors.reset}`
    );
  } else {
    console.log(
      `\n${colors.bright}${colors.red}❌ SOME FINAL INTEGRATION TESTS FAILED${colors.reset}`
    );
    console.log(
      `${colors.yellow}⚠️  Review the test results and reports for details${colors.reset}`
    );
    console.log(
      `${colors.yellow}⚠️  Some requirements may not be fully met${colors.reset}`
    );
  }

  return overallSuccess;
}

/**
 * Main execution function
 */
async function main() {
  logHeader('🧪 Dreamscapes Final Integration Test Runner');

  const args = process.argv.slice(2);
  const skipBuild = args.includes('--skip-build');
  const skipCleanup = args.includes('--skip-cleanup');
  const skipMCPTests = args.includes('--skip-mcp-tests');

  console.log(`${colors.bright}Configuration:${colors.reset}`);
  console.log(`  Skip Build: ${skipBuild}`);
  console.log(`  Skip Cleanup: ${skipCleanup}`);
  console.log(`  Skip MCP Tests: ${skipMCPTests}`);

  const results = {};
  let servicesStarted = false;

  try {
    // Check prerequisites
    await checkPrerequisites();

    // Install dependencies
    await installDependencies();

    // Cleanup existing containers
    if (!skipCleanup) {
      await cleanup();
    }

    // Start services
    if (!skipBuild) {
      await startServices();
      servicesStarted = true;

      // Check service health
      await checkServiceHealth();
    }

    // Run MCP Gateway comprehensive tests
    if (!skipMCPTests) {
      results.mcpGatewayTests = await runMCPGatewayTests();
    }

    // Run existing E2E tests for comparison
    results.existingE2ETests = await runExistingE2ETests();

    // Run final integration validation (main test)
    results.finalIntegrationValidation = await runFinalIntegrationValidation();

    // Generate final summary
    const overallSuccess = generateFinalSummary(results);

    process.exit(overallSuccess ? 0 : 1);
  } catch (error) {
    logError(`Test runner failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Always try to cleanup if we started services
    if (servicesStarted && !skipCleanup) {
      try {
        logInfo('Performing final cleanup...');
        await cleanup();
      } catch (cleanupError) {
        logWarning(`Final cleanup failed: ${cleanupError.message}`);
      }
    }
  }
}

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

// Show help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🧪 Dreamscapes Final Integration Test Runner

This script runs comprehensive final integration tests to validate that the
AI provider integration enhancement meets all requirements.

Usage: node run-final-integration-tests.js [options]

Options:
  --skip-build        Skip Docker image rebuilding and service startup
  --skip-cleanup      Skip cleanup of existing containers
  --skip-mcp-tests    Skip MCP Gateway comprehensive tests
  --help, -h          Show this help message

Test Coverage:
  ✅ Service health and availability
  ✅ AI provider quality and functionality  
  ✅ Load testing and stress testing
  ✅ Video generation quality validation
  ✅ System stability under load
  ✅ Requirements validation (1.1, 1.4, 10.4)

Reports Generated:
  📄 final-integration-test-results.json
  📄 final-integration-test-report.html

Examples:
  node run-final-integration-tests.js                    # Full test suite
  node run-final-integration-tests.js --skip-build      # Skip service startup
  node run-final-integration-tests.js --skip-mcp-tests  # Skip MCP tests
`);
  process.exit(0);
}

// Run main function
if (require.main === module) {
  main().catch((error) => {
    logError(`Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  main,
  checkPrerequisites,
  startServices,
  checkServiceHealth,
  runFinalIntegrationValidation,
};
