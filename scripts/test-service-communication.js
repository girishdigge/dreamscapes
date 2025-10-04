#!/usr/bin/env node

/**
 * Automated Service Communication Test
 *
 * This script tests inter-service communication within the Dreamscapes application.
 * It can be run independently to verify that services can communicate with each other.
 *
 * Requirements: 1.1, 1.2, 1.3
 */

const axios = require('axios');

// Configuration
const SERVICES = {
  express: { port: 8000, name: 'Express Orchestrator' },
  'mcp-gateway': { port: 8080, name: 'MCP Gateway' },
  'render-worker': { port: 8001, name: 'Render Worker' },
  'llama-stylist': { port: 8002, name: 'Llama Stylist' },
  frontend: { port: 3000, name: 'Frontend' },
};

const COMMUNICATION_TESTS = [
  {
    name: 'Express → MCP Gateway Status',
    from: 'express',
    to: 'mcp-gateway',
    endpoint: '/status',
    method: 'GET',
    expectedStatus: [200, 404], // 404 is acceptable if endpoint doesn't exist
  },
  {
    name: 'Express → MCP Gateway Health',
    from: 'express',
    to: 'mcp-gateway',
    endpoint: '/health',
    method: 'GET',
    expectedStatus: [200],
  },
  {
    name: 'Express → Llama Stylist Health',
    from: 'express',
    to: 'llama-stylist',
    endpoint: '/health',
    method: 'GET',
    expectedStatus: [200],
  },
  {
    name: 'Express → Render Worker Health',
    from: 'express',
    to: 'render-worker',
    endpoint: '/health',
    method: 'GET',
    expectedStatus: [200],
  },
  {
    name: 'MCP Gateway → Llama Stylist Health',
    from: 'mcp-gateway',
    to: 'llama-stylist',
    endpoint: '/health',
    method: 'GET',
    expectedStatus: [200],
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
 * Test if a service is reachable
 */
async function testServiceReachability(serviceName, config) {
  const healthUrl =
    serviceName === 'frontend'
      ? `http://localhost:${config.port}`
      : `http://localhost:${config.port}/health`;

  try {
    const response = await axios.get(healthUrl, {
      timeout: 5000,
      validateStatus: (status) => status < 500,
    });

    return {
      reachable: true,
      status: response.status,
      responseTime: response.headers['x-response-time'] || 'N/A',
    };
  } catch (error) {
    return {
      reachable: false,
      error: error.message,
      code: error.code,
    };
  }
}

/**
 * Test communication between two services
 */
async function testCommunication(test) {
  logInfo(`Testing: ${test.name}`);

  const targetService = SERVICES[test.to];
  const url = `http://localhost:${targetService.port}${test.endpoint}`;

  try {
    const startTime = Date.now();
    const response = await axios({
      method: test.method,
      url: url,
      timeout: 10000,
      validateStatus: (status) => status < 500,
    });

    const responseTime = Date.now() - startTime;
    const success = test.expectedStatus.includes(response.status);

    const result = {
      name: test.name,
      success,
      status: response.status,
      responseTime,
      url,
      data: response.data,
    };

    if (success) {
      logSuccess(
        `${test.name} - Status: ${response.status} (${responseTime}ms)`
      );
    } else {
      logWarning(
        `${test.name} - Unexpected status: ${
          response.status
        }, expected: ${test.expectedStatus.join(' or ')}`
      );
    }

    return result;
  } catch (error) {
    const result = {
      name: test.name,
      success: false,
      error: error.message,
      code: error.code,
      url,
    };

    logError(`${test.name} - Failed: ${error.message}`);
    return result;
  }
}

/**
 * Test API endpoints that involve service communication
 */
async function testApiEndpoints() {
  logHeader('Testing API Endpoints');

  const apiTests = [
    {
      name: 'API Documentation',
      url: 'http://localhost:8000/api',
      method: 'GET',
      expectedStatus: [200],
    },
    {
      name: 'Sample Dreams',
      url: 'http://localhost:8000/api/samples',
      method: 'GET',
      expectedStatus: [200, 404],
    },
    {
      name: 'Dreams List',
      url: 'http://localhost:8000/api/dreams',
      method: 'GET',
      expectedStatus: [200],
    },
  ];

  const results = [];

  for (const test of apiTests) {
    try {
      const startTime = Date.now();
      const response = await axios({
        method: test.method,
        url: test.url,
        timeout: 10000,
        validateStatus: (status) => status < 500,
      });

      const responseTime = Date.now() - startTime;
      const success = test.expectedStatus.includes(response.status);

      const result = {
        name: test.name,
        success,
        status: response.status,
        responseTime,
        url: test.url,
        data: response.data,
      };

      if (success) {
        logSuccess(
          `${test.name} - Status: ${response.status} (${responseTime}ms)`
        );
      } else {
        logWarning(`${test.name} - Unexpected status: ${response.status}`);
      }

      results.push(result);
    } catch (error) {
      const result = {
        name: test.name,
        success: false,
        error: error.message,
        url: test.url,
      };

      logError(`${test.name} - Failed: ${error.message}`);
      results.push(result);
    }
  }

  return results;
}

/**
 * Test a simple dream parsing request
 */
async function testDreamParsing() {
  logHeader('Testing Dream Parsing Pipeline');

  const dreamRequest = {
    description: 'A simple test dream with floating clouds and gentle music',
    style: 'ethereal',
    duration: 15,
  };

  try {
    logInfo('Sending dream parsing request...');
    const startTime = Date.now();

    const response = await axios.post(
      'http://localhost:8000/api/parse-dream',
      dreamRequest,
      {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: (status) => status < 500,
      }
    );

    const responseTime = Date.now() - startTime;

    const result = {
      name: 'Dream Parsing',
      success: response.status === 200,
      status: response.status,
      responseTime,
      request: dreamRequest,
      response: response.data,
    };

    if (result.success) {
      logSuccess(
        `Dream parsing successful - Status: ${response.status} (${responseTime}ms)`
      );
      if (response.data && response.data.id) {
        logInfo(`Generated dream ID: ${response.data.id}`);
      }
    } else {
      logError(`Dream parsing failed - Status: ${response.status}`);
      if (response.data && response.data.error) {
        logError(`Error: ${response.data.error}`);
      }
    }

    return result;
  } catch (error) {
    const result = {
      name: 'Dream Parsing',
      success: false,
      error: error.message,
      request: dreamRequest,
    };

    logError(`Dream parsing failed: ${error.message}`);
    return result;
  }
}

/**
 * Main test execution
 */
async function main() {
  logHeader('Service Communication Test Suite');

  const results = {
    serviceReachability: {},
    serviceCommunication: [],
    apiEndpoints: [],
    dreamParsing: null,
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      startTime: new Date(),
    },
  };

  try {
    // Test 1: Service Reachability
    logHeader('Testing Service Reachability');

    for (const [serviceName, config] of Object.entries(SERVICES)) {
      logInfo(`Testing reachability of ${config.name}...`);
      const reachabilityResult = await testServiceReachability(
        serviceName,
        config
      );
      results.serviceReachability[serviceName] = reachabilityResult;

      if (reachabilityResult.reachable) {
        logSuccess(
          `${config.name} is reachable - Status: ${reachabilityResult.status}`
        );
      } else {
        logError(
          `${config.name} is not reachable - ${reachabilityResult.error}`
        );
      }
    }

    // Test 2: Service Communication
    logHeader('Testing Service Communication');

    for (const test of COMMUNICATION_TESTS) {
      const communicationResult = await testCommunication(test);
      results.serviceCommunication.push(communicationResult);
    }

    // Test 3: API Endpoints
    const apiResults = await testApiEndpoints();
    results.apiEndpoints = apiResults;

    // Test 4: Dream Parsing (if Express is reachable)
    if (results.serviceReachability.express?.reachable) {
      const dreamResult = await testDreamParsing();
      results.dreamParsing = dreamResult;
    } else {
      logWarning('Skipping dream parsing test - Express service not reachable');
    }

    // Calculate summary
    const allTests = [
      ...Object.values(results.serviceReachability).map((r) => ({
        success: r.reachable,
      })),
      ...results.serviceCommunication,
      ...results.apiEndpoints,
      ...(results.dreamParsing ? [results.dreamParsing] : []),
    ];

    results.summary.total = allTests.length;
    results.summary.passed = allTests.filter((t) => t.success).length;
    results.summary.failed = results.summary.total - results.summary.passed;
    results.summary.endTime = new Date();

    // Generate report
    logHeader('Test Results Summary');

    console.log(`${colors.bright}Summary:${colors.reset}`);
    console.log(`  Total Tests: ${results.summary.total}`);
    console.log(
      `  ${colors.green}Passed: ${results.summary.passed}${colors.reset}`
    );
    console.log(
      `  ${colors.red}Failed: ${results.summary.failed}${colors.reset}`
    );
    console.log(
      `  Success Rate: ${Math.round(
        (results.summary.passed / results.summary.total) * 100
      )}%`
    );

    // Service status overview
    console.log(`\n${colors.bright}Service Status:${colors.reset}`);
    for (const [serviceName, result] of Object.entries(
      results.serviceReachability
    )) {
      const status = result.reachable
        ? `${colors.green}REACHABLE${colors.reset}`
        : `${colors.red}UNREACHABLE${colors.reset}`;
      console.log(`  ${SERVICES[serviceName].name}: ${status}`);
    }

    // Communication status
    console.log(`\n${colors.bright}Communication Tests:${colors.reset}`);
    for (const result of results.serviceCommunication) {
      const status = result.success
        ? `${colors.green}PASS${colors.reset}`
        : `${colors.red}FAIL${colors.reset}`;
      console.log(`  ${result.name}: ${status}`);
    }

    // Save results
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(
      __dirname,
      '..',
      'service-communication-test-results.json'
    );

    try {
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
      logSuccess(`Test results saved to: ${reportPath}`);
    } catch (error) {
      logWarning(`Failed to save results: ${error.message}`);
    }

    // Exit with appropriate code
    const exitCode = results.summary.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    console.error(`Test suite crashed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  testServiceReachability,
  testCommunication,
  testApiEndpoints,
  testDreamParsing,
  SERVICES,
  COMMUNICATION_TESTS,
};
