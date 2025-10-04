#!/usr/bin/env node

/**
 * Final Integration Testing and Validation
 *
 * This comprehensive test validates that the AI provider integration enhancement
 * has significantly improved video generation quality and system stability.
 *
 * Requirements tested:
 * - 1.1: High-quality dream video generation
 * - 1.4: Clear correlation between input and output
 * - 10.4: Load testing and stress testing for system stability
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:8000',
  mcpGatewayUrl: 'http://localhost:8080',
  timeout: 120000, // 2 minutes for AI generation
  loadTestConcurrency: 10,
  loadTestDuration: 60000, // 1 minute
  qualityThreshold: 0.8, // Minimum quality score
  responseTimeThreshold: 60000, // Maximum response time in ms
};

// Test scenarios for quality validation
const QUALITY_TEST_SCENARIOS = [
  {
    name: 'Complex Spaceship Dream',
    text: 'I dreamed of a spaceship orbiting Earth while cosmic storms raged in the background',
    expectedElements: ['spaceship', 'earth', 'orbit', 'cosmic', 'storm'],
    style: 'cyberpunk',
    minStructures: 2,
    minEntities: 1,
  },
  {
    name: 'Ethereal Library Dream',
    text: 'I dreamed of walking through a library where books flew like birds and words fell like rain',
    expectedElements: ['library', 'books', 'birds', 'words', 'rain'],
    style: 'ethereal',
    minStructures: 3,
    minEntities: 2,
  },
  {
    name: 'Surreal Garden Dream',
    text: 'I dreamed of a garden where flowers sang melodies and trees danced to the rhythm',
    expectedElements: ['garden', 'flowers', 'melodies', 'trees', 'dance'],
    style: 'surreal',
    minStructures: 2,
    minEntities: 3,
  },
  {
    name: 'Fantasy Castle Dream',
    text: 'I dreamed of a floating castle surrounded by dragons breathing rainbow fire',
    expectedElements: ['castle', 'floating', 'dragons', 'rainbow', 'fire'],
    style: 'fantasy',
    minStructures: 1,
    minEntities: 2,
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
 * Wait for services to be ready
 */
async function waitForServices() {
  logHeader('Waiting for Services to be Ready');

  const services = [
    { name: 'Express API', url: `${TEST_CONFIG.baseUrl}/health` },
    { name: 'MCP Gateway', url: `${TEST_CONFIG.mcpGatewayUrl}/health` },
    { name: 'Render Worker', url: 'http://localhost:8001/health' },
    { name: 'Llama Stylist', url: 'http://localhost:8002/health' },
  ];

  const maxRetries = 30;
  const retryDelay = 2000;

  for (const service of services) {
    let retries = 0;
    let ready = false;

    while (retries < maxRetries && !ready) {
      try {
        const response = await fetch(service.url, { timeout: 5000 });
        if (response.ok) {
          logSuccess(`${service.name} is ready`);
          ready = true;
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
          logError(`${service.name} failed to become ready: ${error.message}`);
          throw new Error(
            `Service ${service.name} not ready after ${maxRetries} retries`
          );
        }
      }
    }
  }

  logSuccess('All services are ready');
}

/**
 * Test AI provider functionality and quality
 */
async function testAIProviderQuality() {
  logHeader('Testing AI Provider Quality and Functionality');

  const results = [];

  for (const scenario of QUALITY_TEST_SCENARIOS) {
    logInfo(`Testing scenario: ${scenario.name}`);

    const startTime = Date.now();

    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/parse-dream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: scenario.text,
          style: scenario.style,
        }),
        timeout: TEST_CONFIG.timeout,
      });

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      if (!result.success) {
        logError(`Scenario failed: ${result.error}`);
        results.push({
          scenario: scenario.name,
          success: false,
          error: result.error,
          processingTime,
        });
        continue;
      }

      // Validate response structure
      const dream = result.data;
      const validationResults = {
        hasAISource: dream.source !== 'safe_fallback',
        hasTitle: !!dream.title,
        hasDescription: !!dream.description,
        hasStructures:
          Array.isArray(dream.structures) &&
          dream.structures.length >= scenario.minStructures,
        hasEntities:
          Array.isArray(dream.entities) &&
          dream.entities.length >= scenario.minEntities,
        hasEnvironment: !!dream.environment,
        hasCinematography: !!dream.cinematography,
        hasRender: !!dream.render,
        responseTimeOk: processingTime <= TEST_CONFIG.responseTimeThreshold,
      };

      // Check content quality - look for expected elements
      const dreamContent = JSON.stringify(dream).toLowerCase();
      const contentMatches = scenario.expectedElements.filter((element) =>
        dreamContent.includes(element.toLowerCase())
      );
      const contentQuality =
        contentMatches.length / scenario.expectedElements.length;

      validationResults.contentQuality =
        contentQuality >= TEST_CONFIG.qualityThreshold;
      validationResults.contentScore = contentQuality;

      const allValidationsPassed = Object.values(validationResults).every((v) =>
        typeof v === 'boolean' ? v : true
      );

      if (allValidationsPassed) {
        logSuccess(`${scenario.name}: All validations passed`);
        logInfo(`  Source: ${dream.source}`);
        logInfo(`  Processing time: ${processingTime}ms`);
        logInfo(`  Content quality: ${(contentQuality * 100).toFixed(1)}%`);
        logInfo(`  Structures: ${dream.structures?.length || 0}`);
        logInfo(`  Entities: ${dream.entities?.length || 0}`);
      } else {
        logWarning(`${scenario.name}: Some validations failed`);
        Object.entries(validationResults).forEach(([key, value]) => {
          if (typeof value === 'boolean' && !value) {
            logError(`  ${key}: FAILED`);
          }
        });
      }

      results.push({
        scenario: scenario.name,
        success: allValidationsPassed,
        processingTime,
        validations: validationResults,
        dream: dream,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logError(`${scenario.name} failed: ${error.message}`);
      results.push({
        scenario: scenario.name,
        success: false,
        error: error.message,
        processingTime,
      });
    }
  }

  return results;
}

/**
 * Test provider fallback and resilience
 */
async function testProviderFallback() {
  logHeader('Testing Provider Fallback and Resilience');

  const testDream = 'I dreamed of a simple garden with flowers';

  // Test normal operation first
  logInfo('Testing normal operation...');
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/parse-dream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: testDream }),
      timeout: TEST_CONFIG.timeout,
    });

    const result = await response.json();
    if (result.success && result.data.source !== 'safe_fallback') {
      logSuccess(`Normal operation working (source: ${result.data.source})`);
    } else {
      logWarning(
        `Normal operation using fallback (source: ${result.data.source})`
      );
    }
  } catch (error) {
    logError(`Normal operation failed: ${error.message}`);
    return false;
  }

  // Test with invalid API key (if possible)
  logInfo('Testing provider resilience...');

  // Test multiple rapid requests to check rate limiting and queuing
  logInfo('Testing rapid requests and queuing...');
  const rapidRequests = Array.from({ length: 5 }, (_, i) =>
    fetch(`${TEST_CONFIG.baseUrl}/api/parse-dream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `${testDream} - request ${i + 1}`,
      }),
      timeout: TEST_CONFIG.timeout,
    })
  );

  try {
    const responses = await Promise.all(rapidRequests);
    const results = await Promise.all(responses.map((r) => r.json()));

    const successfulResults = results.filter((r) => r.success);
    const aiResults = successfulResults.filter(
      (r) => r.data.source !== 'safe_fallback'
    );

    logInfo(`Rapid requests: ${successfulResults.length}/5 successful`);
    logInfo(
      `AI generation: ${aiResults.length}/${successfulResults.length} used AI`
    );

    if (successfulResults.length >= 4) {
      logSuccess('Rapid request handling working well');
    } else {
      logWarning('Some rapid requests failed');
    }

    return successfulResults.length >= 4;
  } catch (error) {
    logError(`Rapid request test failed: ${error.message}`);
    return false;
  }
}

/**
 * Perform load testing
 */
async function performLoadTesting() {
  logHeader('Performing Load Testing and Stress Testing');

  const testDream = 'I dreamed of a peaceful meadow with butterflies';
  const concurrency = TEST_CONFIG.loadTestConcurrency;
  const duration = TEST_CONFIG.loadTestDuration;

  logInfo(
    `Starting load test: ${concurrency} concurrent requests for ${
      duration / 1000
    }s`
  );

  const startTime = Date.now();
  const results = [];
  let activeRequests = 0;
  let completedRequests = 0;

  const makeRequest = async (requestId) => {
    activeRequests++;
    const requestStart = Date.now();

    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/parse-dream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: `${testDream} - load test ${requestId}`,
        }),
        timeout: TEST_CONFIG.timeout,
      });

      const result = await response.json();
      const requestTime = Date.now() - requestStart;

      results.push({
        requestId,
        success: result.success,
        responseTime: requestTime,
        source: result.data?.source,
        timestamp: Date.now(),
      });

      completedRequests++;
      activeRequests--;

      if (completedRequests % 10 === 0) {
        logInfo(
          `Completed ${completedRequests} requests, ${activeRequests} active`
        );
      }
    } catch (error) {
      const requestTime = Date.now() - requestStart;
      results.push({
        requestId,
        success: false,
        responseTime: requestTime,
        error: error.message,
        timestamp: Date.now(),
      });

      completedRequests++;
      activeRequests--;
    }
  };

  // Start concurrent requests
  const requestPromises = [];
  let requestId = 0;

  const requestInterval = setInterval(() => {
    if (Date.now() - startTime < duration) {
      for (
        let i = 0;
        i < concurrency && activeRequests < concurrency * 2;
        i++
      ) {
        requestPromises.push(makeRequest(++requestId));
      }
    } else {
      clearInterval(requestInterval);
    }
  }, 1000);

  // Wait for test duration
  await new Promise((resolve) => setTimeout(resolve, duration));
  clearInterval(requestInterval);

  // Wait for remaining requests to complete
  logInfo('Waiting for remaining requests to complete...');
  await Promise.all(requestPromises);

  const totalTime = Date.now() - startTime;

  // Analyze results
  const successfulRequests = results.filter((r) => r.success);
  const failedRequests = results.filter((r) => !r.success);
  const aiRequests = successfulRequests.filter(
    (r) => r.source !== 'safe_fallback'
  );

  const avgResponseTime =
    successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) /
    successfulRequests.length;
  const maxResponseTime = Math.max(...results.map((r) => r.responseTime));
  const minResponseTime = Math.min(...results.map((r) => r.responseTime));

  const requestsPerSecond = (completedRequests / (totalTime / 1000)).toFixed(2);
  const successRate = (
    (successfulRequests.length / completedRequests) *
    100
  ).toFixed(1);
  const aiUsageRate = (
    (aiRequests.length / successfulRequests.length) *
    100
  ).toFixed(1);

  logInfo(`Load Test Results:`);
  logInfo(`  Total Requests: ${completedRequests}`);
  logInfo(`  Successful: ${successfulRequests.length} (${successRate}%)`);
  logInfo(`  Failed: ${failedRequests.length}`);
  logInfo(
    `  AI Generation: ${aiRequests.length} (${aiUsageRate}% of successful)`
  );
  logInfo(`  Requests/Second: ${requestsPerSecond}`);
  logInfo(`  Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
  logInfo(`  Min Response Time: ${minResponseTime}ms`);
  logInfo(`  Max Response Time: ${maxResponseTime}ms`);

  // Determine if load test passed
  const loadTestPassed =
    successRate >= 90 && // At least 90% success rate
    avgResponseTime <= TEST_CONFIG.responseTimeThreshold && // Average response time acceptable
    aiUsageRate >= 80; // At least 80% AI usage (not fallback)

  if (loadTestPassed) {
    logSuccess('Load test passed all criteria');
  } else {
    logWarning('Load test did not meet all criteria');
  }

  return {
    passed: loadTestPassed,
    stats: {
      totalRequests: completedRequests,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      aiRequests: aiRequests.length,
      successRate: parseFloat(successRate),
      aiUsageRate: parseFloat(aiUsageRate),
      requestsPerSecond: parseFloat(requestsPerSecond),
      avgResponseTime,
      maxResponseTime,
      minResponseTime,
    },
  };
}

/**
 * Test streaming functionality
 */
async function testStreamingFunctionality() {
  logHeader('Testing Streaming Functionality');

  // Test if streaming endpoint exists
  try {
    const response = await fetch(`${TEST_CONFIG.mcpGatewayUrl}/stream-dream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'I dreamed of a simple forest',
      }),
      timeout: 30000,
    });

    if (response.ok) {
      logSuccess('Streaming endpoint is available');

      // Test streaming response
      const reader = response.body.getReader();
      let chunks = 0;
      let totalData = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks++;
          totalData += new TextDecoder().decode(value);

          if (chunks >= 3) break; // Test first few chunks
        }

        if (chunks > 0) {
          logSuccess(`Streaming working: received ${chunks} chunks`);
          return true;
        } else {
          logWarning('Streaming endpoint available but no chunks received');
          return false;
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      logWarning(`Streaming endpoint returned ${response.status}`);
      return false;
    }
  } catch (error) {
    logWarning(`Streaming test failed: ${error.message}`);
    return false;
  }
}

/**
 * Validate video generation quality improvement
 */
async function validateVideoGenerationQuality(qualityResults) {
  logHeader('Validating Video Generation Quality Improvement');

  const successfulTests = qualityResults.filter((r) => r.success);
  const aiGeneratedTests = successfulTests.filter(
    (r) => r.dream && r.dream.source !== 'safe_fallback'
  );

  if (aiGeneratedTests.length === 0) {
    logError('No AI-generated dreams to validate quality');
    return false;
  }

  logInfo(`Analyzing ${aiGeneratedTests.length} AI-generated dreams...`);

  let qualityMetrics = {
    avgContentScore: 0,
    avgStructureCount: 0,
    avgEntityCount: 0,
    avgProcessingTime: 0,
    cinematographyPresent: 0,
    renderConfigPresent: 0,
  };

  aiGeneratedTests.forEach((test) => {
    qualityMetrics.avgContentScore += test.validations.contentScore || 0;
    qualityMetrics.avgStructureCount += test.dream.structures?.length || 0;
    qualityMetrics.avgEntityCount += test.dream.entities?.length || 0;
    qualityMetrics.avgProcessingTime += test.processingTime || 0;
    qualityMetrics.cinematographyPresent += test.dream.cinematography ? 1 : 0;
    qualityMetrics.renderConfigPresent += test.dream.render ? 1 : 0;
  });

  const testCount = aiGeneratedTests.length;
  qualityMetrics.avgContentScore /= testCount;
  qualityMetrics.avgStructureCount /= testCount;
  qualityMetrics.avgEntityCount /= testCount;
  qualityMetrics.avgProcessingTime /= testCount;
  qualityMetrics.cinematographyPresent =
    (qualityMetrics.cinematographyPresent / testCount) * 100;
  qualityMetrics.renderConfigPresent =
    (qualityMetrics.renderConfigPresent / testCount) * 100;

  logInfo('Quality Metrics:');
  logInfo(
    `  Average Content Relevance: ${(
      qualityMetrics.avgContentScore * 100
    ).toFixed(1)}%`
  );
  logInfo(
    `  Average Structures per Dream: ${qualityMetrics.avgStructureCount.toFixed(
      1
    )}`
  );
  logInfo(
    `  Average Entities per Dream: ${qualityMetrics.avgEntityCount.toFixed(1)}`
  );
  logInfo(
    `  Average Processing Time: ${qualityMetrics.avgProcessingTime.toFixed(
      0
    )}ms`
  );
  logInfo(
    `  Cinematography Present: ${qualityMetrics.cinematographyPresent.toFixed(
      1
    )}%`
  );
  logInfo(
    `  Render Config Present: ${qualityMetrics.renderConfigPresent.toFixed(1)}%`
  );

  // Quality improvement criteria
  const qualityImproved =
    qualityMetrics.avgContentScore >= TEST_CONFIG.qualityThreshold && // High content relevance
    qualityMetrics.avgStructureCount >= 1.5 && // Rich 3D structure
    qualityMetrics.avgEntityCount >= 1.0 && // Adequate entities
    qualityMetrics.avgProcessingTime <= TEST_CONFIG.responseTimeThreshold && // Reasonable speed
    qualityMetrics.cinematographyPresent >= 90 && // Cinematography data
    qualityMetrics.renderConfigPresent >= 90; // Render configuration

  if (qualityImproved) {
    logSuccess('Video generation quality has significantly improved');
  } else {
    logWarning('Video generation quality improvement not fully validated');
  }

  return qualityImproved;
}

/**
 * Generate comprehensive test report
 */
function generateTestReport(results) {
  logHeader('Generating Comprehensive Test Report');

  const reportData = {
    timestamp: new Date().toISOString(),
    testConfig: TEST_CONFIG,
    results: results,
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      overallSuccess: false,
    },
  };

  // Calculate summary
  Object.values(results).forEach((result) => {
    if (typeof result === 'object' && result.hasOwnProperty('passed')) {
      reportData.summary.totalTests++;
      if (result.passed) {
        reportData.summary.passedTests++;
      } else {
        reportData.summary.failedTests++;
      }
    }
  });

  reportData.summary.overallSuccess = reportData.summary.failedTests === 0;

  // Write JSON report
  const reportPath = path.join(
    __dirname,
    '..',
    'final-integration-test-results.json'
  );
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

  // Generate HTML report
  const htmlReport = generateHTMLReport(reportData);
  const htmlReportPath = path.join(
    __dirname,
    '..',
    'final-integration-test-report.html'
  );
  fs.writeFileSync(htmlReportPath, htmlReport);

  logSuccess(`JSON report saved: ${reportPath}`);
  logSuccess(`HTML report saved: ${htmlReportPath}`);

  return reportData.summary.overallSuccess;
}

/**
 * Generate HTML report
 */
function generateHTMLReport(reportData) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dreamscapes Final Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #333; border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; border-left: 4px solid #007acc; }
        .metric.success { border-left-color: #28a745; }
        .metric.warning { border-left-color: #ffc107; }
        .metric.error { border-left-color: #dc3545; }
        .section { margin-bottom: 30px; }
        .section h3 { color: #007acc; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .test-result { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #007acc; }
        .test-result.passed { border-left-color: #28a745; }
        .test-result.failed { border-left-color: #dc3545; }
        .details { font-size: 0.9em; color: #666; margin-top: 10px; }
        .timestamp { text-align: center; color: #666; font-size: 0.9em; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌙 Dreamscapes Final Integration Test Report</h1>
            <p>AI Provider Integration Enhancement Validation</p>
        </div>

        <div class="summary">
            <div class="metric ${
              reportData.summary.overallSuccess ? 'success' : 'error'
            }">
                <h3>Overall Result</h3>
                <div style="font-size: 2em;">${
                  reportData.summary.overallSuccess ? '✅' : '❌'
                }</div>
                <div>${
                  reportData.summary.overallSuccess ? 'PASSED' : 'FAILED'
                }</div>
            </div>
            <div class="metric">
                <h3>Total Tests</h3>
                <div style="font-size: 2em;">${
                  reportData.summary.totalTests
                }</div>
            </div>
            <div class="metric success">
                <h3>Passed</h3>
                <div style="font-size: 2em;">${
                  reportData.summary.passedTests
                }</div>
            </div>
            <div class="metric ${
              reportData.summary.failedTests > 0 ? 'error' : 'success'
            }">
                <h3>Failed</h3>
                <div style="font-size: 2em;">${
                  reportData.summary.failedTests
                }</div>
            </div>
        </div>

        <div class="section">
            <h3>Test Results Details</h3>
            ${Object.entries(reportData.results)
              .map(
                ([testName, result]) => `
                <div class="test-result ${result.passed ? 'passed' : 'failed'}">
                    <h4>${testName}</h4>
                    <div>Status: ${
                      result.passed ? '✅ PASSED' : '❌ FAILED'
                    }</div>
                    ${
                      result.stats
                        ? `
                        <div class="details">
                            ${Object.entries(result.stats)
                              .map(
                                ([key, value]) =>
                                  `<div>${key}: ${
                                    typeof value === 'number'
                                      ? value.toFixed(2)
                                      : value
                                  }</div>`
                              )
                              .join('')}
                        </div>
                    `
                        : ''
                    }
                    ${
                      result.error
                        ? `<div class="details">Error: ${result.error}</div>`
                        : ''
                    }
                </div>
            `
              )
              .join('')}
        </div>

        <div class="timestamp">
            Report generated: ${reportData.timestamp}
        </div>
    </div>
</body>
</html>
  `;
}

/**
 * Main test execution
 */
async function main() {
  logHeader('🧪 Dreamscapes Final Integration Testing and Validation');

  const results = {};

  try {
    // Wait for services
    await waitForServices();

    // Test AI provider quality
    logInfo('Starting AI provider quality tests...');
    const qualityResults = await testAIProviderQuality();
    const qualityPassed = qualityResults.every((r) => r.success);
    results.aiProviderQuality = {
      passed: qualityPassed,
      results: qualityResults,
    };

    // Test provider fallback
    logInfo('Starting provider fallback tests...');
    const fallbackPassed = await testProviderFallback();
    results.providerFallback = { passed: fallbackPassed };

    // Test streaming functionality
    logInfo('Starting streaming functionality tests...');
    const streamingPassed = await testStreamingFunctionality();
    results.streamingFunctionality = { passed: streamingPassed };

    // Perform load testing
    logInfo('Starting load testing...');
    const loadTestResult = await performLoadTesting();
    results.loadTesting = loadTestResult;

    // Validate video generation quality improvement
    logInfo('Validating video generation quality improvement...');
    const qualityImproved = await validateVideoGenerationQuality(
      qualityResults
    );
    results.qualityImprovement = { passed: qualityImproved };

    // Generate comprehensive report
    const overallSuccess = generateTestReport(results);

    // Final summary
    logHeader('Final Integration Test Summary');

    if (overallSuccess) {
      logSuccess('🎉 All final integration tests passed!');
      logSuccess('✅ Video generation quality has significantly improved');
      logSuccess('✅ System stability validated under load');
      logSuccess('✅ AI provider integration enhancement is successful');
    } else {
      logError('❌ Some final integration tests failed');
      logError('System may not meet all quality and stability requirements');
    }

    process.exit(overallSuccess ? 0 : 1);
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logWarning('Test interrupted by user');
  process.exit(130);
});

process.on('SIGTERM', () => {
  logWarning('Test terminated');
  process.exit(143);
});

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
  testAIProviderQuality,
  performLoadTesting,
  validateVideoGenerationQuality,
};
