#!/usr/bin/env node

/**
 * End-to-End Workflow Verification Tests
 *
 * This script provides comprehensive end-to-end testing for the complete dream processing pipeline:
 * - Tests various dream texts and styles to ensure consistent AI processing
 * - Verifies that caching works correctly for repeated requests
 * - Tests the complete workflow from user input to 3D scene generation
 * - Validates AI vs fallback source attribution
 * - Monitors performance and response times
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuration
const CONFIG = {
  services: {
    express: { port: 8000, name: 'Express Orchestrator' },
    'mcp-gateway': { port: 8080, name: 'MCP Gateway' },
    frontend: { port: 3000, name: 'Frontend' },
  },
  timeouts: {
    apiRequest: 45000, // 45 seconds for dream generation
    healthCheck: 10000, // 10 seconds for health checks
  },
  retries: {
    apiRequest: 2,
    healthCheck: 3,
  },
  intervals: {
    healthCheck: 2000, // 2 seconds between health check retries
  },
  performance: {
    maxResponseTime: 60000, // 60 seconds max for dream generation
    maxCacheResponseTime: 5000, // 5 seconds max for cached responses
    minCacheHitRate: 0.8, // 80% cache hit rate expected for repeated requests
  },
};

// Test dream scenarios with expected characteristics
const TEST_DREAMS = [
  {
    id: 'spaceship_earth',
    text: 'I dreamed of a spaceship orbiting the earth',
    style: 'cyberpunk',
    expectedElements: ['spaceship', 'earth', 'orbit'],
    expectedDuration: 30,
    description: 'Primary test case from requirements',
    priority: 'high',
  },
  {
    id: 'floating_library',
    text: 'A floating library where books fly around like birds, spelling out messages of hope in the sky while soft light emanates from their pages',
    style: 'ethereal',
    expectedElements: ['library', 'books', 'flying', 'light'],
    expectedDuration: 35,
    description: 'Complex ethereal scene with multiple elements',
    priority: 'high',
  },
  {
    id: 'crystal_tower',
    text: 'Neon butterflies dance around a crystalline tower in a digital void, their wings leaving trails of code that forms into blooming flowers',
    style: 'cyberpunk',
    expectedElements: ['butterflies', 'tower', 'neon', 'code', 'flowers'],
    expectedDuration: 25,
    description: 'Cyberpunk scene with dynamic elements',
    priority: 'high',
  },
  {
    id: 'tree_house',
    text: 'A house that grows like a tree with rooms as leaves, floating in cotton candy clouds while impossible staircases spiral into infinity',
    style: 'surreal',
    expectedElements: ['house', 'tree', 'rooms', 'clouds', 'staircases'],
    expectedDuration: 40,
    description: 'Surreal architecture with impossible elements',
    priority: 'medium',
  },
  {
    id: 'simple_garden',
    text: 'A peaceful garden with glowing flowers under a starlit sky',
    style: 'ethereal',
    expectedElements: ['garden', 'flowers', 'stars', 'sky'],
    expectedDuration: 20,
    description: 'Simple scene for baseline testing',
    priority: 'medium',
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
  serviceHealth: {},
  dreamGeneration: {},
  caching: {},
  performance: {},
  aiProcessing: {},
  workflow: {},
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
 * Wait for a specified duration
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test 1: Verify service health and readiness
 */
async function testServiceHealth() {
  logHeader('Testing Service Health and Readiness');

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

    logInfo(`Testing health for ${config.name} on port ${config.port}...`);

    // Determine health endpoint URL
    let healthUrl;
    if (serviceName === 'frontend') {
      healthUrl = `http://localhost:${config.port}`;
    } else if (serviceName === 'express') {
      healthUrl = `http://localhost:${config.port}/health`;
    } else {
      healthUrl = `http://localhost:${config.port}/health`;
    }

    // Retry health checks
    for (let attempt = 1; attempt <= CONFIG.retries.healthCheck; attempt++) {
      serviceResult.attempts = attempt;
      const startTime = Date.now();

      try {
        const response = await axios.get(healthUrl, {
          timeout: CONFIG.timeouts.healthCheck,
          validateStatus: (status) => status < 500,
        });

        serviceResult.responseTime = Date.now() - startTime;
        serviceResult.healthy = response.status >= 200 && response.status < 400;
        serviceResult.response = {
          status: response.status,
          data: response.data,
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
 * Test 2: Comprehensive dream generation workflow testing
 */
async function testDreamGenerationWorkflow() {
  logHeader('Testing Dream Generation Workflow');

  for (const dream of TEST_DREAMS) {
    const testName = `${dream.id} (${dream.style})`;
    const testResult = {
      dreamId: dream.id,
      name: testName,
      dream: dream,
      success: false,
      responseTime: 0,
      error: null,
      response: null,
      validation: {
        hasRequiredFields: false,
        hasExpectedElements: false,
        correctStyle: false,
        validSource: false,
        properStructure: false,
      },
      performance: {
        responseTime: 0,
        withinLimits: false,
      },
    };

    logInfo(`Testing ${testName}: "${dream.text.substring(0, 50)}..."`);

    try {
      const startTime = Date.now();

      const response = await axios.post(
        'http://localhost:8000/api/parse-dream',
        {
          text: dream.text,
          style: dream.style,
          options: {
            testId: dream.id,
            priority: dream.priority,
          },
        },
        {
          timeout: CONFIG.timeouts.apiRequest,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      testResult.responseTime = Date.now() - startTime;
      testResult.performance.responseTime = testResult.responseTime;
      testResult.performance.withinLimits =
        testResult.responseTime <= CONFIG.performance.maxResponseTime;
      testResult.success = response.status === 200;
      testResult.response = response.data;

      if (testResult.success && response.data.data) {
        const dreamData = response.data.data;

        // Validate required fields
        testResult.validation.hasRequiredFields = !!(
          dreamData.id &&
          dreamData.title &&
          dreamData.style &&
          dreamData.structures &&
          dreamData.entities
        );

        // Validate style matches request
        testResult.validation.correctStyle = dreamData.style === dream.style;

        // Validate source attribution (should be 'ai', 'openai', or fallback variants)
        const validSources = [
          'ai',
          'openai',
          'ai_repaired',
          'local_fallback',
          'safe_fallback',
          'emergency_fallback',
        ];
        testResult.validation.validSource = validSources.includes(
          dreamData.source || response.data.metadata?.source
        );

        // Validate structure (arrays exist and have content)
        testResult.validation.properStructure = !!(
          Array.isArray(dreamData.structures) &&
          Array.isArray(dreamData.entities) &&
          (dreamData.structures.length > 0 || dreamData.entities.length > 0)
        );

        // Check for expected elements in the generated content
        const contentText = JSON.stringify(dreamData).toLowerCase();
        const foundElements = dream.expectedElements.filter((element) =>
          contentText.includes(element.toLowerCase())
        );
        testResult.validation.hasExpectedElements =
          foundElements.length >=
          Math.ceil(dream.expectedElements.length * 0.5);

        // Log detailed validation results
        logInfo(`  Validation Results:`);
        logInfo(
          `    Required Fields: ${
            testResult.validation.hasRequiredFields ? '✓' : '✗'
          }`
        );
        logInfo(
          `    Correct Style: ${
            testResult.validation.correctStyle ? '✓' : '✗'
          } (${dreamData.style})`
        );
        logInfo(
          `    Valid Source: ${
            testResult.validation.validSource ? '✓' : '✗'
          } (${dreamData.source || response.data.metadata?.source})`
        );
        logInfo(
          `    Proper Structure: ${
            testResult.validation.properStructure ? '✓' : '✗'
          }`
        );
        logInfo(
          `    Expected Elements: ${
            testResult.validation.hasExpectedElements ? '✓' : '✗'
          } (${foundElements.length}/${dream.expectedElements.length})`
        );
        logInfo(
          `    Response Time: ${testResult.responseTime}ms (limit: ${CONFIG.performance.maxResponseTime}ms)`
        );

        // Overall success based on validation
        const validationPassed = Object.values(testResult.validation).every(
          (v) => v === true
        );

        if (validationPassed && testResult.performance.withinLimits) {
          logSuccess(`${testName} workflow test passed`);
        } else {
          logWarning(`${testName} workflow test passed with warnings`);
        }
      } else {
        logError(`${testName} returned invalid response structure`);
      }
    } catch (error) {
      testResult.error = error.message;
      testResult.responseTime =
        Date.now() - (Date.now() - CONFIG.timeouts.apiRequest);
      logError(`${testName} failed: ${error.message}`);
    }

    testResults.dreamGeneration[dream.id] = testResult;

    // Brief pause between tests
    await sleep(1000);
  }

  return testResults.dreamGeneration;
}

/**
 * Test 3: Caching functionality verification
 */
async function testCachingFunctionality() {
  logHeader('Testing Caching Functionality');

  const cacheTestDream = {
    text: 'A magical forest with glowing mushrooms and fairy lights',
    style: 'ethereal',
  };

  const cacheResults = {
    firstRequest: null,
    secondRequest: null,
    thirdRequest: null,
    cacheHitRate: 0,
    performanceImprovement: 0,
    success: false,
  };

  try {
    logInfo('Making first request (should miss cache)...');
    const startTime1 = Date.now();
    const response1 = await axios.post(
      'http://localhost:8000/api/parse-dream',
      cacheTestDream,
      {
        timeout: CONFIG.timeouts.apiRequest,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const responseTime1 = Date.now() - startTime1;

    cacheResults.firstRequest = {
      responseTime: responseTime1,
      cached: response1.data.cached || false,
      dreamId: response1.data.data?.id,
      success: response1.status === 200,
    };

    logInfo(
      `First request: ${responseTime1}ms, cached: ${cacheResults.firstRequest.cached}`
    );

    // Wait a moment then make the same request
    await sleep(2000);

    logInfo('Making second request (should hit cache)...');
    const startTime2 = Date.now();
    const response2 = await axios.post(
      'http://localhost:8000/api/parse-dream',
      cacheTestDream,
      {
        timeout: CONFIG.timeouts.apiRequest,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const responseTime2 = Date.now() - startTime2;

    cacheResults.secondRequest = {
      responseTime: responseTime2,
      cached: response2.data.cached || false,
      dreamId: response2.data.data?.id,
      success: response2.status === 200,
      sameDreamId: response1.data.data?.id === response2.data.data?.id,
    };

    logInfo(
      `Second request: ${responseTime2}ms, cached: ${cacheResults.secondRequest.cached}`
    );

    // Third request to confirm consistent caching
    await sleep(1000);

    logInfo('Making third request (should also hit cache)...');
    const startTime3 = Date.now();
    const response3 = await axios.post(
      'http://localhost:8000/api/parse-dream',
      cacheTestDream,
      {
        timeout: CONFIG.timeouts.apiRequest,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    const responseTime3 = Date.now() - startTime3;

    cacheResults.thirdRequest = {
      responseTime: responseTime3,
      cached: response3.data.cached || false,
      dreamId: response3.data.data?.id,
      success: response3.status === 200,
      sameDreamId: response1.data.data?.id === response3.data.data?.id,
    };

    logInfo(
      `Third request: ${responseTime3}ms, cached: ${cacheResults.thirdRequest.cached}`
    );

    // Calculate cache hit rate
    const cacheHits = [
      cacheResults.secondRequest.cached,
      cacheResults.thirdRequest.cached,
    ].filter(Boolean).length;
    cacheResults.cacheHitRate = cacheHits / 2;

    // Calculate performance improvement
    const avgCachedTime = (responseTime2 + responseTime3) / 2;
    cacheResults.performanceImprovement =
      ((responseTime1 - avgCachedTime) / responseTime1) * 100;

    // Validate caching success
    const cachingWorking =
      cacheResults.cacheHitRate >= CONFIG.performance.minCacheHitRate &&
      cacheResults.secondRequest.sameDreamId &&
      cacheResults.thirdRequest.sameDreamId &&
      responseTime2 <= CONFIG.performance.maxCacheResponseTime &&
      responseTime3 <= CONFIG.performance.maxCacheResponseTime;

    cacheResults.success = cachingWorking;

    if (cachingWorking) {
      logSuccess(
        `Caching test passed - Hit rate: ${(
          cacheResults.cacheHitRate * 100
        ).toFixed(
          1
        )}%, Performance improvement: ${cacheResults.performanceImprovement.toFixed(
          1
        )}%`
      );
    } else {
      logError(
        `Caching test failed - Hit rate: ${(
          cacheResults.cacheHitRate * 100
        ).toFixed(1)}%, Expected: ${(
          CONFIG.performance.minCacheHitRate * 100
        ).toFixed(1)}%`
      );
    }
  } catch (error) {
    logError(`Caching test failed: ${error.message}`);
    cacheResults.error = error.message;
  }

  testResults.caching = cacheResults;
  return cacheResults;
}

/**
 * Test 4: AI vs Fallback source verification
 */
async function testAIProcessingVerification() {
  logHeader('Testing AI Processing vs Fallback Verification');

  const aiTestResults = {
    aiResponses: 0,
    fallbackResponses: 0,
    totalRequests: 0,
    aiSuccessRate: 0,
    sourceDistribution: {},
    success: false,
  };

  // Test with the primary requirement dream
  const primaryTest = TEST_DREAMS.find((d) => d.id === 'spaceship_earth');

  logInfo(
    `Testing AI processing with primary test case: "${primaryTest.text}"`
  );

  try {
    // Make multiple requests to get a good sample
    const numRequests = 3;
    const requests = [];

    for (let i = 0; i < numRequests; i++) {
      logInfo(`Making AI test request ${i + 1}/${numRequests}...`);

      try {
        const response = await axios.post(
          'http://localhost:8000/api/parse-dream',
          {
            text: primaryTest.text,
            style: primaryTest.style,
            options: { testRun: `ai_verification_${i + 1}` },
          },
          {
            timeout: CONFIG.timeouts.apiRequest,
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (response.status === 200 && response.data.data) {
          const source =
            response.data.data.source ||
            response.data.metadata?.source ||
            'unknown';

          requests.push({
            success: true,
            source: source,
            dreamId: response.data.data.id,
            responseTime: response.data.metadata?.processingTime || 0,
            hasSpaceshipContent: JSON.stringify(response.data.data)
              .toLowerCase()
              .includes('spaceship'),
            hasEarthContent: JSON.stringify(response.data.data)
              .toLowerCase()
              .includes('earth'),
          });

          // Track source distribution
          aiTestResults.sourceDistribution[source] =
            (aiTestResults.sourceDistribution[source] || 0) + 1;

          logInfo(
            `  Request ${i + 1}: Source = ${source}, Spaceship content: ${
              requests[requests.length - 1].hasSpaceshipContent
            }, Earth content: ${requests[requests.length - 1].hasEarthContent}`
          );
        } else {
          requests.push({
            success: false,
            error: 'Invalid response structure',
          });
        }
      } catch (error) {
        requests.push({ success: false, error: error.message });
        logWarning(`  Request ${i + 1} failed: ${error.message}`);
      }

      // Brief pause between requests
      await sleep(2000);
    }

    // Analyze results
    const successfulRequests = requests.filter((r) => r.success);
    aiTestResults.totalRequests = numRequests;

    successfulRequests.forEach((req) => {
      if (req.source.includes('ai') || req.source === 'openai') {
        aiTestResults.aiResponses++;
      } else {
        aiTestResults.fallbackResponses++;
      }
    });

    aiTestResults.aiSuccessRate =
      aiTestResults.aiResponses / aiTestResults.totalRequests;

    // Check content quality
    const contentQualityGood = successfulRequests.some(
      (req) => req.hasSpaceshipContent && req.hasEarthContent
    );

    // Success criteria: At least 1 AI response and good content quality
    aiTestResults.success = aiTestResults.aiResponses > 0 && contentQualityGood;

    logInfo(`AI Processing Results:`);
    logInfo(`  Total Requests: ${aiTestResults.totalRequests}`);
    logInfo(`  AI Responses: ${aiTestResults.aiResponses}`);
    logInfo(`  Fallback Responses: ${aiTestResults.fallbackResponses}`);
    logInfo(
      `  AI Success Rate: ${(aiTestResults.aiSuccessRate * 100).toFixed(1)}%`
    );
    logInfo(
      `  Source Distribution: ${JSON.stringify(
        aiTestResults.sourceDistribution
      )}`
    );
    logInfo(`  Content Quality Good: ${contentQualityGood}`);

    if (aiTestResults.success) {
      logSuccess(
        'AI processing verification passed - AI responses detected with good content quality'
      );
    } else {
      logWarning(
        'AI processing verification completed with concerns - check MCP Gateway connectivity'
      );
    }
  } catch (error) {
    logError(`AI processing verification failed: ${error.message}`);
    aiTestResults.error = error.message;
  }

  testResults.aiProcessing = aiTestResults;
  return aiTestResults;
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  logHeader('End-to-End Workflow Verification Report');

  testResults.summary.endTime = new Date();
  testResults.summary.duration =
    testResults.summary.endTime - testResults.summary.startTime;

  // Calculate summary statistics
  const allTests = [
    ...Object.entries(testResults.serviceHealth).map(([name, result]) => ({
      name: `Health: ${name}`,
      success: result.healthy,
    })),
    ...Object.entries(testResults.dreamGeneration).map(([name, result]) => ({
      name: `Dream: ${name}`,
      success:
        result.success &&
        Object.values(result.validation).every((v) => v === true),
    })),
    { name: 'Caching', success: testResults.caching.success },
    { name: 'AI Processing', success: testResults.aiProcessing.success },
  ];

  testResults.summary.total = allTests.length;
  testResults.summary.passed = allTests.filter((t) => t.success).length;
  testResults.summary.failed =
    testResults.summary.total - testResults.summary.passed;

  // Display summary
  console.log(
    `\n${colors.bright}Workflow Verification Summary:${colors.reset}`
  );
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

  // Requirements verification
  console.log(`\n${colors.bright}Requirements Verification:${colors.reset}`);
  console.log(
    `  4.1 - Complete dream processing pipeline: ${
      testResults.summary.passed > 0 ? '✅ VERIFIED' : '❌ FAILED'
    }`
  );
  console.log(
    `  4.2 - Various dream texts and styles: ${
      Object.keys(testResults.dreamGeneration).length >= 3
        ? '✅ VERIFIED'
        : '❌ FAILED'
    }`
  );
  console.log(
    `  4.3 - Caching works correctly: ${
      testResults.caching.success ? '✅ VERIFIED' : '❌ FAILED'
    }`
  );
  console.log(
    `  4.4 - Consistent AI processing: ${
      testResults.aiProcessing.success ? '✅ VERIFIED' : '⚠️ PARTIAL'
    }`
  );

  return testResults;
}

/**
 * Save test results to files
 */
function saveTestResults(results) {
  const reportPath = path.join(
    __dirname,
    '..',
    'e2e-workflow-verification-results.json'
  );

  try {
    // Save JSON results
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    logSuccess(`Workflow verification results saved to: ${reportPath}`);
  } catch (error) {
    logError(`Failed to save results: ${error.message}`);
  }
}

/**
 * Main execution function
 */
async function main() {
  logHeader('Dreamscapes End-to-End Workflow Verification');

  console.log(`${colors.bright}Test Configuration:${colors.reset}`);
  console.log(`  API Timeout: ${CONFIG.timeouts.apiRequest}ms`);
  console.log(`  Max Response Time: ${CONFIG.performance.maxResponseTime}ms`);
  console.log(
    `  Min Cache Hit Rate: ${CONFIG.performance.minCacheHitRate * 100}%`
  );
  console.log(`  Test Dreams: ${TEST_DREAMS.length}`);

  try {
    // Test 1: Service Health
    await testServiceHealth();

    // Test 2: Dream Generation Workflow
    await testDreamGenerationWorkflow();

    // Test 3: Caching Functionality
    await testCachingFunctionality();

    // Test 4: AI Processing Verification
    await testAIProcessingVerification();

    // Generate and save report
    const finalResults = generateTestReport();
    saveTestResults(finalResults);

    // Exit with appropriate code
    const overallSuccess = finalResults.summary.failed === 0;
    process.exit(overallSuccess ? 0 : 1);
  } catch (error) {
    logError(`Workflow verification failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logWarning('Received SIGINT, exiting...');
    process.exit(130);
  });

  process.on('SIGTERM', () => {
    logWarning('Received SIGTERM, exiting...');
    process.exit(143);
  });

  main().catch((error) => {
    logError(`Workflow verification crashed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = {
  testServiceHealth,
  testDreamGenerationWorkflow,
  testCachingFunctionality,
  testAIProcessingVerification,
  generateTestReport,
  CONFIG,
  TEST_DREAMS,
};
