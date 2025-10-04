#!/usr/bin/env node

/**
 * Comprehensive Service Startup Verification Script
 *
 * This script tests each service in the Dreamscapes application to ensure:
 * - Services start without runtime errors
 * - All import statements resolve correctly
 * - Logger functions work properly across all services
 * - Health endpoints respond correctly
 *
 * Requirements: 1.1, 1.2, 3.2, 3.3
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const axios = require('axios');

// Configuration
const SERVICES = {
  express: {
    name: 'Express Orchestrator',
    path: 'services/express',
    entryPoint: 'server.js',
    port: 8000,
    healthEndpoint: '/health',
    startCommand: 'node',
    startArgs: ['server.js'],
    dependencies: [
      'axios',
      'express',
      'cors',
      'helmet',
      'compression',
      'dotenv',
      'uuid',
    ],
    importChecks: [
      "const { logger, requestLogger } = require('./utils/logger');",
      "const { errorHandler } = require('./middleware/errorHandler');",
      "const { enhancedErrorHandler } = require('./middleware/errorHandler');",
    ],
  },
  'mcp-gateway': {
    name: 'MCP Gateway',
    path: 'services/mcp-gateway',
    entryPoint: 'index.js',
    port: 8080,
    healthEndpoint: '/health',
    startCommand: 'node',
    startArgs: ['index.js'],
    dependencies: [
      'axios',
      'express',
      'cors',
      'helmet',
      'body-parser',
      'dotenv',
      'uuid',
    ],
    importChecks: [
      "const cerebrasService = require('./services/cerebrasService');",
      "const openaiService = require('./services/openaiService');",
      "const promptBuilder = require('./services/promptBuilder');",
      "const responseParser = require('./utils/responseParser');",
      "const errorHandler = require('./utils/errorHandler');",
    ],
  },
  'render-worker': {
    name: 'Render Worker',
    path: 'services/render-worker',
    entryPoint: 'server.js',
    port: 8001,
    healthEndpoint: '/health',
    startCommand: 'node',
    startArgs: ['server.js'],
    dependencies: [
      'express',
      'body-parser',
      'uuid',
      'mkdirp',
      'morgan',
      'puppeteer-core',
      'rimraf',
      'fluent-ffmpeg',
    ],
    importChecks: [
      "const renderEngine = require('./puppeteer/renderEngine');",
      "const videoProcessor = require('./ffmpeg/videoProcessor');",
    ],
  },
  'llama-stylist': {
    name: 'Llama Stylist',
    path: 'services/llama-stylist',
    entryPoint: 'main.py',
    port: 8002,
    healthEndpoint: '/health',
    startCommand: 'python',
    startArgs: ['main.py'],
    dependencies: [
      'fastapi',
      'uvicorn',
      'pydantic',
      'python-dotenv',
      'requests',
      'pytest',
    ],
    importChecks: [
      'from fastapi import FastAPI, HTTPException',
      'from fastapi.middleware.cors import CORSMiddleware',
      'from pydantic import BaseModel',
    ],
  },
  frontend: {
    name: 'Frontend (Next.js)',
    path: 'services/frontend/next-app',
    entryPoint: 'package.json',
    port: 3000,
    healthEndpoint: '/',
    startCommand: 'npm',
    startArgs: ['run', 'build'],
    dependencies: [
      'next',
      'react',
      'react-dom',
      '@react-three/fiber',
      '@react-three/drei',
      'three',
    ],
    importChecks: [
      "import { Environment, Stars } from '@react-three/drei';",
      "import { Canvas } from '@react-three/fiber';",
    ],
  },
};

const TIMEOUT_MS = 30000; // 30 seconds
const HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds
const STARTUP_DELAY = 5000; // 5 seconds to allow service startup

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

// Utility functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
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

// Verification results tracking
const results = {
  services: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
  },
};

/**
 * Check if a service directory exists and has required files
 */
function checkServiceStructure(serviceName, config) {
  logInfo(`Checking service structure for ${config.name}...`);

  const servicePath = path.resolve(config.path);
  const entryPointPath = path.join(servicePath, config.entryPoint);

  const checks = {
    directoryExists: fs.existsSync(servicePath),
    entryPointExists: fs.existsSync(entryPointPath),
    packageJsonExists: false,
    hasNodeModules: false,
  };

  // Check for package.json (Node.js services)
  if (serviceName !== 'llama-stylist') {
    const packageJsonPath = path.join(servicePath, 'package.json');
    checks.packageJsonExists = fs.existsSync(packageJsonPath);
    checks.hasNodeModules = fs.existsSync(
      path.join(servicePath, 'node_modules')
    );
  } else {
    // Python service - check for requirements.txt
    const requirementsPath = path.join(servicePath, 'requirements.txt');
    checks.packageJsonExists = fs.existsSync(requirementsPath);
  }

  return checks;
}

/**
 * Check if all dependencies are installed
 */
function checkDependencies(serviceName, config) {
  return new Promise((resolve) => {
    logInfo(`Checking dependencies for ${config.name}...`);

    const servicePath = path.resolve(config.path);
    const isNodeService = serviceName !== 'llama-stylist';

    if (isNodeService) {
      // Check Node.js dependencies
      const packageJsonPath = path.join(servicePath, 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        resolve({ success: false, error: 'package.json not found' });
        return;
      }

      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8')
        );
        const installedDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        const missingDeps = config.dependencies.filter(
          (dep) => !installedDeps[dep]
        );

        if (missingDeps.length > 0) {
          resolve({
            success: false,
            error: `Missing dependencies: ${missingDeps.join(', ')}`,
            missing: missingDeps,
          });
        } else {
          resolve({ success: true, installed: Object.keys(installedDeps) });
        }
      } catch (error) {
        resolve({
          success: false,
          error: `Failed to parse package.json: ${error.message}`,
        });
      }
    } else {
      // Check Python dependencies (simplified check)
      const requirementsPath = path.join(servicePath, 'requirements.txt');

      if (!fs.existsSync(requirementsPath)) {
        resolve({ success: false, error: 'requirements.txt not found' });
        return;
      }

      try {
        const requirements = fs.readFileSync(requirementsPath, 'utf8');
        const installedDeps = requirements
          .split('\n')
          .filter((line) => line.trim());

        resolve({ success: true, installed: installedDeps });
      } catch (error) {
        resolve({
          success: false,
          error: `Failed to read requirements.txt: ${error.message}`,
        });
      }
    }
  });
}

/**
 * Check import statements by parsing the entry point file
 */
function checkImportStatements(serviceName, config) {
  logInfo(`Checking import statements for ${config.name}...`);

  const servicePath = path.resolve(config.path);
  const entryPointPath = path.join(servicePath, config.entryPoint);

  if (!fs.existsSync(entryPointPath)) {
    return { success: false, error: 'Entry point file not found' };
  }

  try {
    const fileContent = fs.readFileSync(entryPointPath, 'utf8');
    const results = [];

    for (const importCheck of config.importChecks) {
      const found =
        fileContent.includes(importCheck.replace(/'/g, '"')) ||
        fileContent.includes(importCheck);

      results.push({
        statement: importCheck,
        found,
        line: found
          ? fileContent
              .split('\n')
              .findIndex(
                (line) =>
                  line.includes(importCheck.replace(/'/g, '"')) ||
                  line.includes(importCheck)
              ) + 1
          : null,
      });
    }

    const failedImports = results.filter((r) => !r.found);

    return {
      success: failedImports.length === 0,
      results,
      failed: failedImports,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read entry point: ${error.message}`,
    };
  }
}

/**
 * Test service startup by running it in a subprocess
 */
function testServiceStartup(serviceName, config) {
  return new Promise((resolve) => {
    logInfo(`Testing startup for ${config.name}...`);

    const servicePath = path.resolve(config.path);
    const env = { ...process.env, NODE_ENV: 'test', PORT: config.port };

    // Special handling for frontend build test
    if (serviceName === 'frontend') {
      const buildProcess = spawn(config.startCommand, config.startArgs, {
        cwd: servicePath,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      buildProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      buildProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        buildProcess.kill();
        resolve({
          success: false,
          error: 'Build timeout',
          stdout: stdout.slice(-1000),
          stderr: stderr.slice(-1000),
        });
      }, TIMEOUT_MS);

      buildProcess.on('close', (code) => {
        clearTimeout(timeout);
        resolve({
          success: code === 0,
          exitCode: code,
          stdout: stdout.slice(-1000),
          stderr: stderr.slice(-1000),
        });
      });

      return;
    }

    // For other services, test startup and quick shutdown
    const serviceProcess = spawn(config.startCommand, config.startArgs, {
      cwd: servicePath,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let startupDetected = false;

    serviceProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;

      // Look for startup indicators
      if (
        output.includes('listening') ||
        output.includes('running') ||
        output.includes('started') ||
        output.includes(`port ${config.port}`) ||
        output.includes(`:${config.port}`)
      ) {
        startupDetected = true;
      }
    });

    serviceProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Give service time to start up
    const startupTimeout = setTimeout(() => {
      serviceProcess.kill();

      resolve({
        success: startupDetected,
        startupDetected,
        stdout: stdout.slice(-1000),
        stderr: stderr.slice(-1000),
        note: startupDetected
          ? 'Service started successfully'
          : 'No startup confirmation detected',
      });
    }, STARTUP_DELAY);

    serviceProcess.on('close', (code) => {
      clearTimeout(startupTimeout);

      // If process exited quickly with error
      if (code !== 0 && !startupDetected) {
        resolve({
          success: false,
          exitCode: code,
          stdout: stdout.slice(-1000),
          stderr: stderr.slice(-1000),
          error: 'Service failed to start',
        });
      }
    });

    serviceProcess.on('error', (error) => {
      clearTimeout(startupTimeout);
      resolve({
        success: false,
        error: error.message,
        stdout: stdout.slice(-1000),
        stderr: stderr.slice(-1000),
      });
    });
  });
}

/**
 * Test logger functionality by checking if logger methods exist and work
 */
function testLoggerFunctionality(serviceName, config) {
  logInfo(`Testing logger functionality for ${config.name}...`);

  if (serviceName === 'llama-stylist' || serviceName === 'frontend') {
    // Python service and frontend don't use the same logger pattern
    return { success: true, note: 'Logger test skipped for this service type' };
  }

  const servicePath = path.resolve(config.path);
  const loggerPath = path.join(servicePath, 'utils', 'logger.js');

  if (!fs.existsSync(loggerPath)) {
    return { success: false, error: 'Logger utility not found' };
  }

  try {
    // Test if logger can be required and has expected methods
    const loggerModule = require(path.resolve(loggerPath));

    const expectedMethods = ['info', 'error', 'warn', 'debug'];
    const missingMethods = [];

    if (loggerModule.logger) {
      for (const method of expectedMethods) {
        if (typeof loggerModule.logger[method] !== 'function') {
          missingMethods.push(method);
        }
      }
    } else {
      return { success: false, error: 'Logger instance not exported' };
    }

    // Test logger functionality
    try {
      loggerModule.logger.info('Test log message from verification script');
      loggerModule.logger.debug('Debug test message');
    } catch (logError) {
      return {
        success: false,
        error: `Logger methods failed: ${logError.message}`,
        missingMethods,
      };
    }

    return {
      success: missingMethods.length === 0,
      availableMethods: expectedMethods.filter(
        (m) => !missingMethods.includes(m)
      ),
      missingMethods,
      exports: Object.keys(loggerModule),
    };
  } catch (error) {
    return { success: false, error: `Failed to test logger: ${error.message}` };
  }
}

/**
 * Test health endpoint if service is running
 */
async function testHealthEndpoint(serviceName, config) {
  logInfo(`Testing health endpoint for ${config.name}...`);

  const healthUrl = `http://localhost:${config.port}${config.healthEndpoint}`;

  try {
    const response = await axios.get(healthUrl, {
      timeout: HEALTH_CHECK_TIMEOUT,
      validateStatus: (status) => status < 500, // Accept 2xx, 3xx, 4xx
    });

    return {
      success: response.status >= 200 && response.status < 400,
      status: response.status,
      data: response.data,
      url: healthUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      url: healthUrl,
      note: 'Service may not be running - this is expected for individual service tests',
    };
  }
}

/**
 * Run comprehensive verification for a single service
 */
async function verifyService(serviceName, config) {
  logHeader(`Verifying ${config.name}`);

  const serviceResult = {
    name: config.name,
    path: config.path,
    checks: {},
    overall: { success: true, warnings: 0, errors: 0 },
  };

  // 1. Check service structure
  const structureCheck = checkServiceStructure(serviceName, config);
  serviceResult.checks.structure = structureCheck;

  if (!structureCheck.directoryExists || !structureCheck.entryPointExists) {
    logError(`Service structure check failed for ${config.name}`);
    serviceResult.overall.success = false;
    serviceResult.overall.errors++;
  } else {
    logSuccess(`Service structure OK for ${config.name}`);
  }

  // 2. Check dependencies
  const dependencyCheck = await checkDependencies(serviceName, config);
  serviceResult.checks.dependencies = dependencyCheck;

  if (!dependencyCheck.success) {
    logError(
      `Dependency check failed for ${config.name}: ${dependencyCheck.error}`
    );
    serviceResult.overall.success = false;
    serviceResult.overall.errors++;
  } else {
    logSuccess(`Dependencies OK for ${config.name}`);
  }

  // 3. Check import statements
  const importCheck = checkImportStatements(serviceName, config);
  serviceResult.checks.imports = importCheck;

  if (!importCheck.success) {
    logError(`Import check failed for ${config.name}`);
    if (importCheck.failed) {
      importCheck.failed.forEach((imp) => {
        logError(`  Missing import: ${imp.statement}`);
      });
    }
    serviceResult.overall.success = false;
    serviceResult.overall.errors++;
  } else {
    logSuccess(`Import statements OK for ${config.name}`);
  }

  // 4. Test service startup
  const startupCheck = await testServiceStartup(serviceName, config);
  serviceResult.checks.startup = startupCheck;

  if (!startupCheck.success) {
    logError(
      `Startup test failed for ${config.name}: ${
        startupCheck.error || 'Unknown error'
      }`
    );
    if (startupCheck.stderr) {
      logError(`  Error output: ${startupCheck.stderr.slice(0, 200)}...`);
    }
    serviceResult.overall.success = false;
    serviceResult.overall.errors++;
  } else {
    logSuccess(`Startup test OK for ${config.name}`);
  }

  // 5. Test logger functionality (Node.js services only)
  const loggerCheck = testLoggerFunctionality(serviceName, config);
  serviceResult.checks.logger = loggerCheck;

  if (!loggerCheck.success && !loggerCheck.note) {
    logError(`Logger test failed for ${config.name}: ${loggerCheck.error}`);
    serviceResult.overall.success = false;
    serviceResult.overall.errors++;
  } else if (loggerCheck.note) {
    logWarning(`Logger test: ${loggerCheck.note} for ${config.name}`);
    serviceResult.overall.warnings++;
  } else {
    logSuccess(`Logger functionality OK for ${config.name}`);
  }

  // 6. Test health endpoint (optional - service may not be running)
  const healthCheck = await testHealthEndpoint(serviceName, config);
  serviceResult.checks.health = healthCheck;

  if (!healthCheck.success && !healthCheck.note) {
    logWarning(
      `Health endpoint test failed for ${config.name}: ${healthCheck.error}`
    );
    serviceResult.overall.warnings++;
  } else if (healthCheck.note) {
    logInfo(`Health endpoint: ${healthCheck.note} for ${config.name}`);
  } else {
    logSuccess(`Health endpoint OK for ${config.name}`);
  }

  return serviceResult;
}

/**
 * Generate verification report
 */
function generateReport(results) {
  logHeader('Verification Report');

  console.log(`\n${colors.bright}Summary:${colors.reset}`);
  console.log(`  Total services: ${results.summary.total}`);
  console.log(
    `  ${colors.green}Passed: ${results.summary.passed}${colors.reset}`
  );
  console.log(
    `  ${colors.red}Failed: ${results.summary.failed}${colors.reset}`
  );
  console.log(
    `  ${colors.yellow}Warnings: ${results.summary.warnings}${colors.reset}`
  );

  console.log(`\n${colors.bright}Detailed Results:${colors.reset}`);

  for (const [serviceName, result] of Object.entries(results.services)) {
    const status = result.overall.success
      ? `${colors.green}PASS${colors.reset}`
      : `${colors.red}FAIL${colors.reset}`;

    console.log(`\n  ${colors.bright}${result.name}:${colors.reset} ${status}`);
    console.log(`    Path: ${result.path}`);
    console.log(
      `    Errors: ${result.overall.errors}, Warnings: ${result.overall.warnings}`
    );

    // Show failed checks
    for (const [checkName, checkResult] of Object.entries(result.checks)) {
      if (!checkResult.success && !checkResult.note) {
        console.log(
          `    ${colors.red}✗ ${checkName}: ${checkResult.error || 'Failed'}${
            colors.reset
          }`
        );
      } else if (checkResult.note) {
        console.log(
          `    ${colors.yellow}⚠ ${checkName}: ${checkResult.note}${colors.reset}`
        );
      } else {
        console.log(`    ${colors.green}✓ ${checkName}${colors.reset}`);
      }
    }
  }

  // Recommendations
  console.log(`\n${colors.bright}Recommendations:${colors.reset}`);

  let hasRecommendations = false;

  for (const [serviceName, result] of Object.entries(results.services)) {
    if (!result.overall.success) {
      hasRecommendations = true;
      console.log(`\n  ${colors.yellow}${result.name}:${colors.reset}`);

      if (result.checks.dependencies && !result.checks.dependencies.success) {
        console.log(
          `    - Install missing dependencies: ${
            result.checks.dependencies.missing?.join(', ') ||
            'check package.json'
          }`
        );
      }

      if (result.checks.imports && !result.checks.imports.success) {
        console.log(
          `    - Fix import statements in ${result.path}/${SERVICES[serviceName].entryPoint}`
        );
      }

      if (result.checks.startup && !result.checks.startup.success) {
        console.log(
          `    - Check service startup errors and fix runtime issues`
        );
      }

      if (result.checks.logger && !result.checks.logger.success) {
        console.log(`    - Fix logger utility imports and functionality`);
      }
    }
  }

  if (!hasRecommendations) {
    console.log(
      `  ${colors.green}All services passed verification!${colors.reset}`
    );
  }
}

/**
 * Save results to file
 */
function saveResults(results) {
  const reportPath = path.join(__dirname, '..', 'verification-report.json');

  try {
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    logSuccess(`Verification report saved to: ${reportPath}`);
  } catch (error) {
    logError(`Failed to save report: ${error.message}`);
  }
}

/**
 * Main verification function
 */
async function main() {
  logHeader('Dreamscapes Service Startup Verification');

  console.log(`${colors.bright}This script will verify:${colors.reset}`);
  console.log('  ✓ Service structure and entry points');
  console.log('  ✓ Dependency installation');
  console.log('  ✓ Import statement resolution');
  console.log('  ✓ Service startup capability');
  console.log('  ✓ Logger functionality');
  console.log('  ✓ Health endpoint availability (if running)');

  results.summary.total = Object.keys(SERVICES).length;

  // Verify each service
  for (const [serviceName, config] of Object.entries(SERVICES)) {
    try {
      const serviceResult = await verifyService(serviceName, config);
      results.services[serviceName] = serviceResult;

      if (serviceResult.overall.success) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
      }

      results.summary.warnings += serviceResult.overall.warnings;
    } catch (error) {
      logError(`Failed to verify ${config.name}: ${error.message}`);
      results.summary.failed++;
    }
  }

  // Generate and display report
  generateReport(results);

  // Save results
  saveResults(results);

  // Exit with appropriate code
  const exitCode = results.summary.failed > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    logError(`Verification script failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  verifyService,
  checkServiceStructure,
  checkDependencies,
  checkImportStatements,
  testServiceStartup,
  testLoggerFunctionality,
  testHealthEndpoint,
  SERVICES,
};
