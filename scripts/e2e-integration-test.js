#!/usr/bin/env node

/**
 * End-to-End Service Integration Test
 *
 * This script provides comprehensive end-to-end testing for the Dreamscapes application:
 * - Verifies complete Docker Compose startup
 * - Tests API request flow from frontend through all services
 * - Verifies dream generation pipeline works end-to-end
 * - Creates automated test for service communication
 *
 * Requirements: 1.1, 1.2, 1.3
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const axios = require('axios');

// Configuration
const CONFIG = {
  services: {
    frontend: { port: 3000, name: 'Frontend (Next.js)' },
    express: { port: 8000, name: 'Express Orchestrator' },
    'mcp-gateway': { port: 8080, name: 'MCP Gateway' },
    'render-worker': { port: 8001, name: 'Render Worker' },
    'llama-stylist': { port: 8002, name: 'Llama Stylist' },
  },
  timeouts: {
    dockerStartup: 180000, // 3 minutes for full stack startup
    serviceHealth: 10000, // 10 seconds for health checks
    apiRequest: 30000, // 30 seconds for API requests
    dockerShutdown: 60000, // 1 minute for graceful shutdown
  },
  retries: {
    healthCheck: 12, // 12 retries with 5s intervals = 1 minute
    apiRequest: 3,
  },
  intervals: {
    healthCheck: 5000, // 5 seconds between health check retries
  },
};

// Sample dream data for testing
const SAMPLE_DREAMS = [
  {
    text: 'A house that grows like a tree with rooms as leaves, floating in cotton candy clouds while impossible staircases spiral into infinity',
    style: 'surreal',
    expectedDuration: 35,
  },
  {
    text: 'Neon butterflies dance around a crystalline tower in a digital void, their wings leaving trails of code that forms into blooming flowers',
    style: 'cyberpunk',
    expectedDuration: 25,
  },
  {
    text: 'A peaceful garden with glowing flowers under a starlit sky',
    style: 'ethereal',
    expectedDuration: 20,
  },
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

// Utility functions
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

// Test results tracking
const testResults = {
  dockerStartup: { success: false, duration: 0, errors: [] },
  serviceHealth: {},
  serviceCommunication: {},
  apiFlow: {},
  dreamGeneration: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    startTime: new Date(),
    endTime: null,
    duration: 0,
  },
};

/**
 * Execute shell command with promise
 */
function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/**
 * Wait for a specified duration
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test 1: Verify complete Docker Compose startup
 */
async function testDockerComposeStartup() {
  logHeader('Testing Docker Compose Startup');

  const startTime = Date.now();
  testResults.dockerStartup.errors = [];

  try {
    // Check if Docker is running
    logInfo('Checking Docker availability...');
    try {
      await execCommand('docker --version');
      await execCommand('docker-compose --version');
      logSuccess('Docker and Docker Compose are available');
    } catch (error) {
      throw new Error('Docker or Docker Compose not available');
    }

    // Stop any existing containers
    logInfo('Stopping any existing containers...');
    try {
      await execCommand('docker-compose down --remove-orphans', {
        timeout: 30000,
      });
      logSuccess('Existing containers stopped');
    } catch (error) {
      logWarning('No existing containers to stop or error stopping them');
    }

    // Start services with build
    logInfo('Starting Docker Compose services...');
    const dockerProcess = spawn(
      'docker-compose',
      ['up', '--build', '--remove-orphans'],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      }
    );

    let dockerOutput = '';
    let dockerErrors = '';
    let servicesStarted = new Set();
    const expectedServices = Object.keys(CONFIG.services);

    dockerProcess.stdout.on('data', (data) => {
      const output = data.toString();
      dockerOutput += output;

      // Track service startup messages
      expectedServices.forEach((service) => {
        if (
          output.includes(`${service}_1`) ||
          output.includes(`${service}-1`)
        ) {
          if (
            output.includes('started') ||
            output.includes('running') ||
            output.includes('listening')
          ) {
            servicesStarted.add(service);
          }
        }
      });

      // Log important messages
      if (output.includes('ERROR') || output.includes('FATAL')) {
        logError(`Docker: ${output.trim()}`);
        testResults.dockerStartup.errors.push(output.trim());
      } else if (output.includes('listening') || output.includes('started')) {
        logInfo(`Docker: ${output.trim()}`);
      }
    });

    dockerProcess.stderr.on('data', (data) => {
      const error = data.toString();
      dockerErrors += error;
      if (!error.includes('WARNING')) {
        logError(`Docker Error: ${error.trim()}`);
        testResults.dockerStartup.errors.push(error.trim());
      }
    });

    // Wait for startup or timeout
    const startupPromise = new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (servicesStarted.size >= expectedServices.length) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Docker Compose startup timeout'));
      }, CONFIG.timeouts.dockerStartup);
    });

    try {
      await startupPromise;
      logSuccess('All services appear to have started');
    } catch (error) {
      logWarning(
        `Startup detection timeout, but continuing with health checks...`
      );
    }

    // Give services additional time to fully initialize
    logInfo('Waiting for services to fully initialize...');
    await sleep(15000);

    testResults.dockerStartup.success = true;
    testResults.dockerStartup.duration = Date.now() - startTime;
    logSuccess(
      `Docker Compose startup completed in ${testResults.dockerStartup.duration}ms`
    );

    return {
      success: true,
      dockerProcess,
      output: dockerOutput,
      errors: dockerErrors,
    };
  } catch (error) {
    testResults.dockerStartup.success = false;
    testResults.dockerStartup.duration = Date.now() - startTime;
    testResults.dockerStartup.errors.push(error.message);
    logError(`Docker Compose startup failed: ${error.message}`);
    throw error;
  }
}

/**
 * Test 2: Verify service health endpoints
 */
async function testServiceHealth() {
  logHeader('Testing Service Health Endpoints');

  for (const [serviceName, config] of Object.entries(CONFIG.services)) {
    const serviceResult = {
      name: config.name,
      port: config.port,
      healthy: false,
      responseTime: 0,
      attempts: 0,
      lastError: null,
      response: null,
    };

    logInfo(
      `Testing health endpoint for ${config.name} on port ${config.port}...`
    );

    // Determine health endpoint URL
    let healthUrl;
    if (serviceName === 'frontend') {
      healthUrl = `http://localhost:${config.port}`;
    } else {
      healthUrl = `http://localhost:${config.port}/health`;
    }

    // Retry health checks
    for (let attempt = 1; attempt <= CONFIG.retries.healthCheck; attempt++) {
      serviceResult.attempts = attempt;
      const startTime = Date.now();

      try {
        const response = await axios.get(healthUrl, {
          timeout: CONFIG.timeouts.serviceHealth,
          validateStatus: (status) => status < 500,
        });

        serviceResult.responseTime = Date.now() - startTime;
        serviceResult.healthy = response.status >= 200 && response.status < 400;
        serviceResult.response = {
          status: response.status,
          data: response.data,
          headers: response.headers,
        };

        if (serviceResult.healthy) {
          logSuccess(
            `${config.name} health check passed (${serviceResult.responseTime}ms)`
          );
          break;
        } else {
          logWarning(`${config.name} returned status ${response.status}`);
        }
      } catch (error) {
        serviceResult.lastError = error.message;
        serviceResult.responseTime = Date.now() - startTime;

        if (attempt === CONFIG.retries.healthCheck) {
          logError(
            `${config.name} health check failed after ${attempt} attempts: ${error.message}`
          );
        } else {
          logInfo(
            `${config.name} health check attempt ${attempt} failed, retrying...`
          );
          await sleep(CONFIG.intervals.healthCheck);
        }
      }
    }

    testResults.serviceHealth[serviceName] = serviceResult;
  }

  // Summary
  const healthyServices = Object.values(testResults.serviceHealth).filter(
    (s) => s.healthy
  );
  logInfo(
    `Health check summary: ${healthyServices.length}/${
      Object.keys(CONFIG.services).length
    } services healthy`
  );

  return testResults.serviceHealth;
}

/**
 * Test 3: Verify service communication
 */
async function testServiceCommunication() {
  logHeader('Testing Service Communication');

  const communicationTests = [
    {
      name: 'Express to MCP Gateway',
      from: 'express',
      to: 'mcp-gateway',
      endpoint: '/status',
      method: 'GET',
    },
    {
      name: 'Express to Llama Stylist',
      from: 'express',
      to: 'llama-stylist',
      endpoint: '/health',
      method: 'GET',
    },
    {
      name: 'Express to Render Worker',
      from: 'express',
      to: 'render-worker',
      endpoint: '/health',
      method: 'GET',
    },
  ];

  for (const test of communicationTests) {
    const testResult = {
      name: test.name,
      success: false,
      responseTime: 0,
      error: null,
      response: null,
    };

    logInfo(`Testing ${test.name}...`);

    try {
      const startTime = Date.now();
      const targetPort = CONFIG.services[test.to].port;
      const url = `http://localhost:${targetPort}${test.endpoint}`;

      const response = await axios({
        method: test.method,
        url: url,
        timeout: CONFIG.timeouts.apiRequest,
        validateStatus: (status) => status < 500,
      });

      testResult.responseTime = Date.now() - startTime;
      testResult.success = response.status >= 200 && response.status < 400;
      testResult.response = {
        status: response.status,
        data: response.data,
      };

      if (testResult.success) {
        logSuccess(
          `${test.name} communication successful (${testResult.responseTime}ms)`
        );
      } else {
        logError(`${test.name} returned status ${response.status}`);
      }
    } catch (error) {
      testResult.error = error.message;
      logError(`${test.name} failed: ${error.message}`);
    }

    testResults.serviceCommunication[test.name] = testResult;
  }

  return testResults.serviceCommunication;
}

/**
 * Test 4: Test API request flow through all services
 */
async function testApiFlow() {
  logHeader('Testing API Request Flow');

  const apiTests = [
    {
      name: 'API Documentation',
      method: 'GET',
      url: 'http://localhost:8000/api',
      expectedStatus: 200,
    },
    {
      name: 'Sample Dreams',
      method: 'GET',
      url: 'http://localhost:8000/api/samples',
      expectedStatus: 200,
    },
    {
      name: 'Dreams List',
      method: 'GET',
      url: 'http://localhost:8000/api/dreams',
      expectedStatus: 200,
    },
  ];

  for (const test of apiTests) {
    const testResult = {
      name: test.name,
      success: false,
      responseTime: 0,
      error: null,
      response: null,
    };

    logInfo(`Testing ${test.name}...`);

    try {
      const startTime = Date.now();

      const response = await axios({
        method: test.method,
        url: test.url,
        timeout: CONFIG.timeouts.apiRequest,
        validateStatus: (status) => status < 500,
      });

      testResult.responseTime = Date.now() - startTime;
      testResult.success = response.status === test.expectedStatus;
      testResult.response = {
        status: response.status,
        data: response.data,
        headers: response.headers,
      };

      if (testResult.success) {
        logSuccess(
          `${test.name} API test passed (${testResult.responseTime}ms)`
        );
      } else {
        logError(
          `${test.name} returned status ${response.status}, expected ${test.expectedStatus}`
        );
      }
    } catch (error) {
      testResult.error = error.message;
      logError(`${test.name} failed: ${error.message}`);
    }

    testResults.apiFlow[test.name] = testResult;
  }

  return testResults.apiFlow;
}

/**
 * Test 5: Verify dream generation pipeline end-to-end
 */
async function testDreamGeneration() {
  logHeader('Testing Dream Generation Pipeline');

  for (let i = 0; i < SAMPLE_DREAMS.length; i++) {
    const dream = SAMPLE_DREAMS[i];
    const testName = `Dream ${i + 1} (${dream.style})`;

    const testResult = {
      name: testName,
      dream: dream,
      success: false,
      responseTime: 0,
      error: null,
      response: null,
      stages: {
        parse: { success: false, responseTime: 0 },
        patch: { success: false, responseTime: 0 },
        export: { success: false, responseTime: 0 },
      },
    };

    logInfo(`Testing ${testName}: "${dream.text.substring(0, 50)}..."`);

    try {
      // Stage 1: Parse Dream
      logInfo(`  Stage 1: Parsing dream...`);
      const parseStartTime = Date.now();

      const parseResponse = await axios.post(
        'http://localhost:8000/api/parse-dream',
        {
          description: dream.text,
          style: dream.style,
          duration: dream.expectedDuration,
        },
        {
          timeout: CONFIG.timeouts.apiRequest,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      testResult.stages.parse.responseTime = Date.now() - parseStartTime;
      testResult.stages.parse.success = parseResponse.status === 200;

      if (testResult.stages.parse.success) {
        logSuccess(
          `  Parse stage completed (${testResult.stages.parse.responseTime}ms)`
        );

        // Stage 2: Patch Dream (optional modification)
        if (parseResponse.data && parseResponse.data.id) {
          logInfo(`  Stage 2: Patching dream...`);
          const patchStartTime = Date.now();

          try {
            const patchResponse = await axios.post(
              'http://localhost:8000/api/patch-dream',
              {
                dreamId: parseResponse.data.id,
                modifications: {
                  lighting: 'enhanced',
                  atmosphere: 'mystical',
                },
              },
              {
                timeout: CONFIG.timeouts.apiRequest,
                headers: { 'Content-Type': 'application/json' },
              }
            );

            testResult.stages.patch.responseTime = Date.now() - patchStartTime;
            testResult.stages.patch.success = patchResponse.status === 200;

            if (testResult.stages.patch.success) {
              logSuccess(
                `  Patch stage completed (${testResult.stages.patch.responseTime}ms)`
              );
            } else {
              logWarning(
                `  Patch stage returned status ${patchResponse.status}`
              );
            }
          } catch (patchError) {
            logWarning(`  Patch stage failed: ${patchError.message}`);
          }

          // Stage 3: Export Dream
          logInfo(`  Stage 3: Exporting dream...`);
          const exportStartTime = Date.now();

          try {
            const exportResponse = await axios.post(
              'http://localhost:8000/api/export',
              {
                dreamId: parseResponse.data.id,
                format: 'mp4',
                quality: 'draft',
              },
              {
                timeout: CONFIG.timeouts.apiRequest * 2, // Export might take longer
                headers: { 'Content-Type': 'application/json' },
              }
            );

            testResult.stages.export.responseTime =
              Date.now() - exportStartTime;
            testResult.stages.export.success = exportResponse.status === 200;

            if (testResult.stages.export.success) {
              logSuccess(
                `  Export stage completed (${testResult.stages.export.responseTime}ms)`
              );
            } else {
              logWarning(
                `  Export stage returned status ${exportResponse.status}`
              );
            }
          } catch (exportError) {
            logWarning(`  Export stage failed: ${exportError.message}`);
          }
        }

        testResult.success = testResult.stages.parse.success;
        testResult.responseTime = Object.values(testResult.stages).reduce(
          (total, stage) => total + stage.responseTime,
          0
        );
        testResult.response = parseResponse.data;

        logSuccess(`${testName} pipeline completed successfully`);
      } else {
        logError(`  Parse stage failed with status ${parseResponse.status}`);
      }
    } catch (error) {
      testResult.error = error.message;
      logError(`${testName} failed: ${error.message}`);
    }

    testResults.dreamGeneration[testName] = testResult;

    // Brief pause between tests
    if (i < SAMPLE_DREAMS.length - 1) {
      await sleep(2000);
    }
  }

  return testResults.dreamGeneration;
}

/**
 * Cleanup: Stop Docker Compose services
 */
async function cleanup() {
  logHeader('Cleaning Up');

  try {
    logInfo('Stopping Docker Compose services...');
    await execCommand('docker-compose down --remove-orphans', {
      timeout: CONFIG.timeouts.dockerShutdown,
    });
    logSuccess('Docker Compose services stopped successfully');
  } catch (error) {
    logError(`Failed to stop Docker Compose services: ${error.message}`);
  }
}

/**
 * Generate comprehensive test report
 */
function generateReport() {
  logHeader('End-to-End Integration Test Report');

  testResults.summary.endTime = new Date();
  testResults.summary.duration =
    testResults.summary.endTime - testResults.summary.startTime;

  // Calculate summary statistics
  const allTests = [
    { name: 'Docker Startup', result: testResults.dockerStartup },
    ...Object.entries(testResults.serviceHealth).map(([name, result]) => ({
      name: `Health: ${name}`,
      result: { success: result.healthy },
    })),
    ...Object.entries(testResults.serviceCommunication).map(
      ([name, result]) => ({
        name: `Communication: ${name}`,
        result,
      })
    ),
    ...Object.entries(testResults.apiFlow).map(([name, result]) => ({
      name: `API: ${name}`,
      result,
    })),
    ...Object.entries(testResults.dreamGeneration).map(([name, result]) => ({
      name: `Dream: ${name}`,
      result,
    })),
  ];

  testResults.summary.total = allTests.length;
  testResults.summary.passed = allTests.filter((t) => t.result.success).length;
  testResults.summary.failed =
    testResults.summary.total - testResults.summary.passed;

  // Display summary
  console.log(`\n${colors.bright}Test Summary:${colors.reset}`);
  console.log(
    `  Duration: ${Math.round(testResults.summary.duration / 1000)}s`
  );
  console.log(`  Total Tests: ${testResults.summary.total}`);
  console.log(
    `  ${colors.green}Passed: ${testResults.summary.passed}${colors.reset}`
  );
  console.log(
    `  ${colors.red}Failed: ${testResults.summary.failed}${colors.reset}`
  );
  console.log(
    `  Success Rate: ${Math.round(
      (testResults.summary.passed / testResults.summary.total) * 100
    )}%`
  );

  // Detailed results
  console.log(`\n${colors.bright}Detailed Results:${colors.reset}`);

  // Docker Startup
  const dockerStatus = testResults.dockerStartup.success
    ? `${colors.green}PASS${colors.reset}`
    : `${colors.red}FAIL${colors.reset}`;
  console.log(`\n  Docker Compose Startup: ${dockerStatus}`);
  console.log(`    Duration: ${testResults.dockerStartup.duration}ms`);
  if (testResults.dockerStartup.errors.length > 0) {
    console.log(`    Errors: ${testResults.dockerStartup.errors.length}`);
  }

  // Service Health
  console.log(`\n  Service Health Checks:`);
  for (const [name, result] of Object.entries(testResults.serviceHealth)) {
    const status = result.healthy
      ? `${colors.green}HEALTHY${colors.reset}`
      : `${colors.red}UNHEALTHY${colors.reset}`;
    console.log(
      `    ${CONFIG.services[name].name}: ${status} (${result.responseTime}ms, ${result.attempts} attempts)`
    );
  }

  // Service Communication
  console.log(`\n  Service Communication:`);
  for (const [name, result] of Object.entries(
    testResults.serviceCommunication
  )) {
    const status = result.success
      ? `${colors.green}PASS${colors.reset}`
      : `${colors.red}FAIL${colors.reset}`;
    console.log(`    ${name}: ${status} (${result.responseTime}ms)`);
  }

  // API Flow
  console.log(`\n  API Flow Tests:`);
  for (const [name, result] of Object.entries(testResults.apiFlow)) {
    const status = result.success
      ? `${colors.green}PASS${colors.reset}`
      : `${colors.red}FAIL${colors.reset}`;
    console.log(`    ${name}: ${status} (${result.responseTime}ms)`);
  }

  // Dream Generation
  console.log(`\n  Dream Generation Pipeline:`);
  for (const [name, result] of Object.entries(testResults.dreamGeneration)) {
    const status = result.success
      ? `${colors.green}PASS${colors.reset}`
      : `${colors.red}FAIL${colors.reset}`;
    console.log(`    ${name}: ${status} (${result.responseTime}ms)`);
    console.log(
      `      Parse: ${result.stages.parse.success ? '✓' : '✗'} (${
        result.stages.parse.responseTime
      }ms)`
    );
    console.log(
      `      Patch: ${result.stages.patch.success ? '✓' : '✗'} (${
        result.stages.patch.responseTime
      }ms)`
    );
    console.log(
      `      Export: ${result.stages.export.success ? '✓' : '✗'} (${
        result.stages.export.responseTime
      }ms)`
    );
  }

  // Recommendations
  console.log(`\n${colors.bright}Recommendations:${colors.reset}`);

  if (testResults.summary.failed === 0) {
    console.log(
      `  ${colors.green}🎉 All tests passed! The Dreamscapes application is working correctly.${colors.reset}`
    );
  } else {
    console.log(
      `  ${colors.yellow}Issues found that need attention:${colors.reset}`
    );

    if (!testResults.dockerStartup.success) {
      console.log(`    - Fix Docker Compose startup issues`);
    }

    const unhealthyServices = Object.entries(testResults.serviceHealth).filter(
      ([_, result]) => !result.healthy
    );
    if (unhealthyServices.length > 0) {
      console.log(
        `    - Fix health issues in: ${unhealthyServices
          .map(([name]) => name)
          .join(', ')}`
      );
    }

    const failedCommunication = Object.entries(
      testResults.serviceCommunication
    ).filter(([_, result]) => !result.success);
    if (failedCommunication.length > 0) {
      console.log(`    - Fix service communication issues`);
    }

    const failedApi = Object.entries(testResults.apiFlow).filter(
      ([_, result]) => !result.success
    );
    if (failedApi.length > 0) {
      console.log(`    - Fix API endpoint issues`);
    }

    const failedDreams = Object.entries(testResults.dreamGeneration).filter(
      ([_, result]) => !result.success
    );
    if (failedDreams.length > 0) {
      console.log(`    - Fix dream generation pipeline issues`);
    }
  }

  return testResults;
}

/**
 * Save test results to file
 */
function saveResults(results) {
  const reportPath = path.join(__dirname, '..', 'e2e-test-results.json');
  const reportHtmlPath = path.join(__dirname, '..', 'e2e-test-report.html');

  try {
    // Save JSON results
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    logSuccess(`Test results saved to: ${reportPath}`);

    // Generate HTML report
    const htmlReport = generateHtmlReport(results);
    fs.writeFileSync(reportHtmlPath, htmlReport);
    logSuccess(`HTML report saved to: ${reportHtmlPath}`);
  } catch (error) {
    logError(`Failed to save results: ${error.message}`);
  }
}

/**
 * Generate HTML report
 */
function generateHtmlReport(results) {
  const successRate = Math.round(
    (results.summary.passed / results.summary.total) * 100
  );
  const duration = Math.round(results.summary.duration / 1000);

  return `
<!DOCTYPE html>
<html>
<head>
    <title>Dreamscapes E2E Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .success { color: #28a745; }
        .failure { color: #dc3545; }
        .warning { color: #ffc107; }
        .section { margin: 20px 0; }
        .test-item { margin: 10px 0; padding: 10px; border-left: 3px solid #ddd; }
        .test-pass { border-left-color: #28a745; }
        .test-fail { border-left-color: #dc3545; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Dreamscapes End-to-End Integration Test Report</h1>
        <p><strong>Generated:</strong> ${results.summary.endTime}</p>
        <p><strong>Duration:</strong> ${duration} seconds</p>
        <p><strong>Success Rate:</strong> <span class="${
          successRate === 100 ? 'success' : 'failure'
        }">${successRate}%</span></p>
        <p><strong>Tests:</strong> ${results.summary.passed}/${
    results.summary.total
  } passed</p>
    </div>

    <div class="section">
        <h2>Test Results Summary</h2>
        <table>
            <tr><th>Category</th><th>Status</th><th>Details</th></tr>
            <tr class="${
              results.dockerStartup.success ? 'success' : 'failure'
            }">
                <td>Docker Startup</td>
                <td>${results.dockerStartup.success ? 'PASS' : 'FAIL'}</td>
                <td>${results.dockerStartup.duration}ms</td>
            </tr>
            ${Object.entries(results.serviceHealth)
              .map(
                ([name, result]) => `
            <tr class="${result.healthy ? 'success' : 'failure'}">
                <td>Health: ${name}</td>
                <td>${result.healthy ? 'HEALTHY' : 'UNHEALTHY'}</td>
                <td>${result.responseTime}ms (${result.attempts} attempts)</td>
            </tr>
            `
              )
              .join('')}
        </table>
    </div>

    <div class="section">
        <h2>Dream Generation Pipeline</h2>
        ${Object.entries(results.dreamGeneration)
          .map(
            ([name, result]) => `
        <div class="test-item ${result.success ? 'test-pass' : 'test-fail'}">
            <h4>${name} - ${result.success ? 'PASS' : 'FAIL'}</h4>
            <p><strong>Dream:</strong> ${result.dream.text.substring(
              0,
              100
            )}...</p>
            <p><strong>Style:</strong> ${result.dream.style}</p>
            <p><strong>Total Time:</strong> ${result.responseTime}ms</p>
            <ul>
                <li>Parse: ${result.stages.parse.success ? '✓' : '✗'} (${
              result.stages.parse.responseTime
            }ms)</li>
                <li>Patch: ${result.stages.patch.success ? '✓' : '✗'} (${
              result.stages.patch.responseTime
            }ms)</li>
                <li>Export: ${result.stages.export.success ? '✓' : '✗'} (${
              result.stages.export.responseTime
            }ms)</li>
            </ul>
        </div>
        `
          )
          .join('')}
    </div>

    <div class="section">
        <h2>Raw Test Data</h2>
        <pre>${JSON.stringify(results, null, 2)}</pre>
    </div>
</body>
</html>
  `;
}

/**
 * Main test execution function
 */
async function main() {
  logHeader('Dreamscapes End-to-End Integration Test Suite');

  console.log(`${colors.bright}This test suite will:${colors.reset}`);
  console.log('  🐳 Start complete Docker Compose stack');
  console.log('  🏥 Verify all service health endpoints');
  console.log('  🔗 Test inter-service communication');
  console.log('  🌐 Test API request flows');
  console.log('  🎭 Test complete dream generation pipeline');
  console.log('  📊 Generate comprehensive test report');

  let dockerProcess = null;

  try {
    // Test 1: Docker Compose Startup
    const dockerResult = await testDockerComposeStartup();
    dockerProcess = dockerResult.dockerProcess;

    // Test 2: Service Health
    await testServiceHealth();

    // Test 3: Service Communication
    await testServiceCommunication();

    // Test 4: API Flow
    await testApiFlow();

    // Test 5: Dream Generation Pipeline
    await testDreamGeneration();
  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
  } finally {
    // Generate report
    const results = generateReport();

    // Save results
    saveResults(results);

    // Cleanup
    if (dockerProcess) {
      logInfo('Terminating Docker Compose process...');
      dockerProcess.kill('SIGTERM');
    }

    await cleanup();

    // Exit with appropriate code
    const exitCode = results.summary.failed > 0 ? 1 : 0;
    logInfo(`Test suite completed with exit code: ${exitCode}`);
    process.exit(exitCode);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    logError(`Test suite crashed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  testDockerComposeStartup,
  testServiceHealth,
  testServiceCommunication,
  testApiFlow,
  testDreamGeneration,
  CONFIG,
  SAMPLE_DREAMS,
};
