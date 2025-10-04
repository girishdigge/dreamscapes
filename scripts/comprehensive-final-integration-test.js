#!/usr/bin/env node

/**
 * Comprehensive Final Integration Testing and Validation
 *
 * This script implements task 12.2: Final integration testing and validation
 *
 * Requirements tested:
 * - 1.1: High-quality dream video generation that accurately reflects descriptions
 * - 1.4: Clear correlation between input and output
 * - 10.4: Load testing and stress testing to ensure system stability
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// Enhanced test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:8000',
  mcpGatewayUrl: 'http://localhost:8080',
  frontendUrl: 'http://localhost:3000',
  timeout: 120000, // 2 minutes for AI generation
  loadTestConcurrency: 15, // Increased concurrency
  loadTestDuration: 90000, // 1.5 minutes
  stressTestConcurrency: 25, // High stress test
  stressTestDuration: 60000, // 1 minute stress
  qualityThreshold: 0.75, // Minimum quality score (75%)
  responseTimeThreshold: 60000, // Maximum response time in ms
  successRateThreshold: 90, // Minimum success rate (90%)
  aiUsageThreshold: 80, // Minimum AI usage rate (80%)
  maxRetries: 3,
  retryDelay: 2000,
};

// Comprehensive test scenarios for quality validation
const QUALITY_TEST_SCENARIOS = [
  {
    name: 'Complex Spaceship Dream (Requirement 1.1)',
    text: 'I dreamed of a spaceship orbiting Earth while cosmic storms raged in the background',
    expectedElements: [
      'spaceship',
      'earth',
      'orbit',
      'cosmic',
      'storm',
      'space',
    ],
    style: 'cyberpunk',
    minStructures: 2,
    minEntities: 1,
    priority: 'high',
  },
  {
    name: 'Ethereal Library Dream',
    text: 'I dreamed of walking through a library where books flew like birds and words fell like rain',
    expectedElements: ['library', 'books', 'birds', 'words', 'rain', 'walking'],
    style: 'ethereal',
    minStructures: 3,
    minEntities: 2,
    priority: 'high',
  },
  {
    name: 'Surreal Garden Dream',
    text: 'I dreamed of a garden where flowers sang melodies and trees danced to the rhythm',
    expectedElements: [
      'garden',
      'flowers',
      'melodies',
      'trees',
      'dance',
      'rhythm',
    ],
    style: 'surreal',
    minStructures: 2,
    minEntities: 3,
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
 * Wait for services to be ready with enhanced health checks
 */
async function waitForServices() {
  logHeader('Comprehensive Service Health Check');

  const services = [
    {
      name: 'Express API',
      url: `${TEST_CONFIG.baseUrl}/health`,
      critical: true,
    },
    {
      name: 'MCP Gateway',
      url: `${TEST_CONFIG.mcpGatewayUrl}/health`,
      critical: true,
    },
    { name: 'Frontend', url: `${TEST_CONFIG.frontendUrl}`, critical: true },
    {
      name: 'Render Worker',
      url: 'http://localhost:8001/health',
      critical: false,
    },
    {
      name: 'Llama Stylist',
      url: 'http://localhost:8002/health',
      critical: false,
    },
  ];

  const maxRetries = 30;
  const retryDelay = 3000;
  const healthResults = {};

  for (const service of services) {
    let retries = 0;
    let ready = false;
    let lastError = null;

    logInfo(`Checking ${service.name}...`);

    while (retries < maxRetries && !ready) {
      try {
        const startTime = Date.now();
        const response = await fetch(service.url, {
          timeout: 8000,
          headers: { 'User-Agent': 'Dreamscapes-Integration-Test' },
        });
        const responseTime = Date.now() - startTime;

        if (response.ok) {
          logSuccess(`${service.name} is ready (${responseTime}ms)`);
          ready = true;
          healthResults[service.name] = {
            status: 'healthy',
            responseTime,
            retries,
          };
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        lastError = error.message;
        retries++;

        if (retries < maxRetries) {
          logInfo(
            `${service.name} not ready (attempt ${retries}/${maxRetries}), retrying...`
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          const message = `${service.name} failed to become ready: ${lastError}`;
          if (service.critical) {
            logError(message);
            throw new Error(
              `Critical service ${service.name} not ready after ${maxRetries} retries`
            );
          } else {
            logWarning(message);
            healthResults[service.name] = {
              status: 'unhealthy',
              error: lastError,
              retries,
            };
          }
        }
      }
    }
  }

  logSuccess('Service health check completed');
  return healthResults;
}

/**
 * Test AI provider functionality and quality (Requirement 1.1, 1.4)
 */
async function testAIProviderQuality() {
  logHeader('AI Provider Quality and Functionality Testing');

  const results = [];
  let totalProcessingTime = 0;
  let aiGeneratedCount = 0;

  for (const scenario of QUALITY_TEST_SCENARIOS) {
    logInfo(`Testing scenario: ${scenario.name}`);

    const startTime = Date.now();
    let attempt = 0;
    let success = false;
    let lastError = null;

    // Retry logic for critical scenarios
    const maxAttempts =
      scenario.priority === 'high' ? TEST_CONFIG.maxRetries : 1;

    while (attempt < maxAttempts && !success) {
      attempt++;

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
        totalProcessingTime += processingTime;

        if (!result.success) {
          throw new Error(result.error || 'Unknown error');
        }

        // Enhanced validation
        const dream = result.data;
        const validationResults = {
          hasAISource: dream.source !== 'safe_fallback',
          hasTitle: !!dream.title && dream.title.length > 0,
          hasDescription: !!dream.description && dream.description.length > 0,
          hasStructures:
            Array.isArray(dream.structures) &&
            dream.structures.length >= scenario.minStructures,
          hasEntities:
            Array.isArray(dream.entities) &&
            dream.entities.length >= scenario.minEntities,
          hasEnvironment:
            !!dream.environment && typeof dream.environment === 'object',
          hasCinematography:
            !!dream.cinematography && typeof dream.cinematography === 'object',
          hasRender: !!dream.render && typeof dream.render === 'object',
          responseTimeOk: processingTime <= TEST_CONFIG.responseTimeThreshold,
        };

        // Enhanced content quality check
        const dreamContent = JSON.stringify(dream).toLowerCase();
        const contentMatches = scenario.expectedElements.filter((element) =>
          dreamContent.includes(element.toLowerCase())
        );
        const contentQuality =
          contentMatches.length / scenario.expectedElements.length;

        validationResults.contentQuality =
          contentQuality >= TEST_CONFIG.qualityThreshold;
        validationResults.contentScore = contentQuality;

        // Check for correlation between input and output (Requirement 1.4)
        const inputWords = scenario.text.toLowerCase().split(/\s+/);
        const outputText = (
          dream.title +
          ' ' +
          dream.description
        ).toLowerCase();
        const correlationMatches = inputWords.filter(
          (word) => word.length > 3 && outputText.includes(word)
        );
        const correlationScore =
          correlationMatches.length /
          inputWords.filter((w) => w.length > 3).length;

        validationResults.hasCorrelation = correlationScore >= 0.3; // At least 30% correlation
        validationResults.correlationScore = correlationScore;

        const allValidationsPassed = Object.values(validationResults).every(
          (v) => (typeof v === 'boolean' ? v : true)
        );

        if (allValidationsPassed) {
          logSuccess(`${scenario.name}: All validations passed`);
          logInfo(`  Source: ${dream.source}`);
          logInfo(`  Processing time: ${processingTime}ms`);
          logInfo(`  Content quality: ${(contentQuality * 100).toFixed(1)}%`);
          logInfo(
            `  Input-output correlation: ${(correlationScore * 100).toFixed(
              1
            )}%`
          );
          logInfo(`  Structures: ${dream.structures?.length || 0}`);
          logInfo(`  Entities: ${dream.entities?.length || 0}`);

          if (dream.source !== 'safe_fallback') {
            aiGeneratedCount++;
          }

          success = true;
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
          attempts: attempt,
        });
      } catch (error) {
        lastError = error.message;
        const processingTime = Date.now() - startTime;

        if (attempt < maxAttempts) {
          logWarning(
            `${scenario.name} attempt ${attempt} failed: ${error.message}, retrying...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, TEST_CONFIG.retryDelay)
          );
        } else {
          logError(
            `${scenario.name} failed after ${attempt} attempts: ${error.message}`
          );
          results.push({
            scenario: scenario.name,
            success: false,
            error: error.message,
            processingTime,
            attempts: attempt,
          });
        }
      }
    }
  }

  // Calculate quality metrics
  const successfulTests = results.filter((r) => r.success);
  const avgProcessingTime = totalProcessingTime / results.length;
  const aiUsageRate = (aiGeneratedCount / successfulTests.length) * 100;

  logInfo(`Quality Test Summary:`);
  logInfo(`  Total scenarios: ${results.length}`);
  logInfo(`  Successful: ${successfulTests.length}`);
  logInfo(`  AI-generated: ${aiGeneratedCount} (${aiUsageRate.toFixed(1)}%)`);
  logInfo(`  Average processing time: ${avgProcessingTime.toFixed(0)}ms`);

  return {
    results,
    summary: {
      total: results.length,
      successful: successfulTests.length,
      aiGenerated: aiGeneratedCount,
      avgProcessingTime,
      aiUsageRate,
    },
  };
} /**
 
* Perform comprehensive load testing (Requirement 10.4)
 */
async function performLoadTesting() {
  logHeader('Comprehensive Load Testing and Stress Testing');

  const loadTestScenarios = [
    'I dreamed of a peaceful meadow with butterflies',
    'I dreamed of a stormy ocean with lightning',
    'I dreamed of a mountain peak covered in snow',
    'I dreamed of a desert oasis with palm trees',
    'I dreamed of a forest clearing with sunlight',
  ];

  const results = {
    loadTest: null,
    stressTest: null,
  };

  // Load Test
  logInfo(
    `Starting load test: ${
      TEST_CONFIG.loadTestConcurrency
    } concurrent requests for ${TEST_CONFIG.loadTestDuration / 1000}s`
  );
  results.loadTest = await runLoadTest(
    TEST_CONFIG.loadTestConcurrency,
    TEST_CONFIG.loadTestDuration,
    'Load Test',
    loadTestScenarios
  );

  // Brief pause between tests
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Stress Test
  logInfo(
    `Starting stress test: ${
      TEST_CONFIG.stressTestConcurrency
    } concurrent requests for ${TEST_CONFIG.stressTestDuration / 1000}s`
  );
  results.stressTest = await runLoadTest(
    TEST_CONFIG.stressTestConcurrency,
    TEST_CONFIG.stressTestDuration,
    'Stress Test',
    loadTestScenarios
  );

  // Analyze combined results
  const combinedStats = {
    totalRequests:
      results.loadTest.stats.totalRequests +
      results.stressTest.stats.totalRequests,
    successfulRequests:
      results.loadTest.stats.successfulRequests +
      results.stressTest.stats.successfulRequests,
    aiRequests:
      results.loadTest.stats.aiRequests + results.stressTest.stats.aiRequests,
  };

  const overallSuccessRate =
    (combinedStats.successfulRequests / combinedStats.totalRequests) * 100;
  const overallAiUsageRate =
    (combinedStats.aiRequests / combinedStats.successfulRequests) * 100;

  logInfo(`Combined Load/Stress Test Results:`);
  logInfo(`  Total Requests: ${combinedStats.totalRequests}`);
  logInfo(`  Overall Success Rate: ${overallSuccessRate.toFixed(1)}%`);
  logInfo(`  Overall AI Usage Rate: ${overallAiUsageRate.toFixed(1)}%`);

  const overallPassed =
    results.loadTest.passed &&
    results.stressTest.passed &&
    overallSuccessRate >= TEST_CONFIG.successRateThreshold;

  return {
    passed: overallPassed,
    loadTest: results.loadTest,
    stressTest: results.stressTest,
    combined: {
      stats: combinedStats,
      successRate: overallSuccessRate,
      aiUsageRate: overallAiUsageRate,
    },
  };
}

/**
 * Run individual load test
 */
async function runLoadTest(concurrency, duration, testName, scenarios) {
  const startTime = Date.now();
  const results = [];
  let activeRequests = 0;
  let completedRequests = 0;
  let requestId = 0;

  const makeRequest = async (id) => {
    activeRequests++;
    const requestStart = Date.now();
    const dreamText = scenarios[id % scenarios.length];

    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/parse-dream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${dreamText} - ${testName.toLowerCase()} ${id}`,
        }),
        timeout: TEST_CONFIG.timeout,
      });

      const result = await response.json();
      const requestTime = Date.now() - requestStart;

      results.push({
        requestId: id,
        success: result.success,
        responseTime: requestTime,
        source: result.data?.source,
        timestamp: Date.now(),
      });

      completedRequests++;
      activeRequests--;

      if (completedRequests % 20 === 0) {
        logInfo(
          `${testName}: Completed ${completedRequests} requests, ${activeRequests} active`
        );
      }
    } catch (error) {
      const requestTime = Date.now() - requestStart;
      results.push({
        requestId: id,
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
  const requestInterval = setInterval(() => {
    if (Date.now() - startTime < duration) {
      for (
        let i = 0;
        i < Math.min(concurrency, concurrency * 2 - activeRequests);
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
  logInfo(`${testName}: Waiting for remaining requests to complete...`);
  await Promise.all(requestPromises);

  const totalTime = Date.now() - startTime;

  // Analyze results
  const successfulRequests = results.filter((r) => r.success);
  const failedRequests = results.filter((r) => !r.success);
  const aiRequests = successfulRequests.filter(
    (r) => r.source !== 'safe_fallback'
  );

  const avgResponseTime =
    successfulRequests.length > 0
      ? successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) /
        successfulRequests.length
      : 0;
  const maxResponseTime =
    results.length > 0 ? Math.max(...results.map((r) => r.responseTime)) : 0;
  const minResponseTime =
    results.length > 0 ? Math.min(...results.map((r) => r.responseTime)) : 0;

  const requestsPerSecond = (completedRequests / (totalTime / 1000)).toFixed(2);
  const successRate =
    completedRequests > 0
      ? (successfulRequests.length / completedRequests) * 100
      : 0;
  const aiUsageRate =
    successfulRequests.length > 0
      ? (aiRequests.length / successfulRequests.length) * 100
      : 0;

  logInfo(`${testName} Results:`);
  logInfo(`  Total Requests: ${completedRequests}`);
  logInfo(
    `  Successful: ${successfulRequests.length} (${successRate.toFixed(1)}%)`
  );
  logInfo(`  Failed: ${failedRequests.length}`);
  logInfo(
    `  AI Generation: ${aiRequests.length} (${aiUsageRate.toFixed(
      1
    )}% of successful)`
  );
  logInfo(`  Requests/Second: ${requestsPerSecond}`);
  logInfo(`  Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
  logInfo(`  Min Response Time: ${minResponseTime}ms`);
  logInfo(`  Max Response Time: ${maxResponseTime}ms`);

  // Determine if test passed
  const testPassed =
    successRate >= TEST_CONFIG.successRateThreshold &&
    avgResponseTime <= TEST_CONFIG.responseTimeThreshold &&
    aiUsageRate >= TEST_CONFIG.aiUsageThreshold;

  if (testPassed) {
    logSuccess(`${testName} passed all criteria`);
  } else {
    logWarning(`${testName} did not meet all criteria`);
    if (successRate < TEST_CONFIG.successRateThreshold) {
      logWarning(
        `  Success rate ${successRate.toFixed(1)}% below threshold ${
          TEST_CONFIG.successRateThreshold
        }%`
      );
    }
    if (avgResponseTime > TEST_CONFIG.responseTimeThreshold) {
      logWarning(
        `  Avg response time ${avgResponseTime.toFixed(0)}ms above threshold ${
          TEST_CONFIG.responseTimeThreshold
        }ms`
      );
    }
    if (aiUsageRate < TEST_CONFIG.aiUsageThreshold) {
      logWarning(
        `  AI usage rate ${aiUsageRate.toFixed(1)}% below threshold ${
          TEST_CONFIG.aiUsageThreshold
        }%`
      );
    }
  }

  return {
    passed: testPassed,
    stats: {
      totalRequests: completedRequests,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      aiRequests: aiRequests.length,
      successRate: parseFloat(successRate.toFixed(1)),
      aiUsageRate: parseFloat(aiUsageRate.toFixed(1)),
      requestsPerSecond: parseFloat(requestsPerSecond),
      avgResponseTime: parseFloat(avgResponseTime.toFixed(0)),
      maxResponseTime,
      minResponseTime,
      duration: totalTime,
    },
  };
}

/**
 * Validate video generation quality improvement (Requirements 1.1, 1.4)
 */
async function validateVideoGenerationQuality(qualityResults) {
  logHeader('Video Generation Quality Improvement Validation');

  const successfulTests = qualityResults.results.filter((r) => r.success);
  const aiGeneratedTests = successfulTests.filter(
    (r) => r.dream && r.dream.source !== 'safe_fallback'
  );

  if (aiGeneratedTests.length === 0) {
    logError('No AI-generated dreams to validate quality');
    return { passed: false, reason: 'No AI-generated content' };
  }

  logInfo(`Analyzing ${aiGeneratedTests.length} AI-generated dreams...`);

  let qualityMetrics = {
    avgContentScore: 0,
    avgCorrelationScore: 0,
    avgStructureCount: 0,
    avgEntityCount: 0,
    avgProcessingTime: 0,
    cinematographyPresent: 0,
    renderConfigPresent: 0,
    highQualityCount: 0,
  };

  aiGeneratedTests.forEach((test) => {
    const validations = test.validations;
    qualityMetrics.avgContentScore += validations.contentScore || 0;
    qualityMetrics.avgCorrelationScore += validations.correlationScore || 0;
    qualityMetrics.avgStructureCount += test.dream.structures?.length || 0;
    qualityMetrics.avgEntityCount += test.dream.entities?.length || 0;
    qualityMetrics.avgProcessingTime += test.processingTime || 0;
    qualityMetrics.cinematographyPresent += test.dream.cinematography ? 1 : 0;
    qualityMetrics.renderConfigPresent += test.dream.render ? 1 : 0;

    // High quality = good content score AND good correlation
    if (
      (validations.contentScore || 0) >= 0.8 &&
      (validations.correlationScore || 0) >= 0.4
    ) {
      qualityMetrics.highQualityCount++;
    }
  });

  const testCount = aiGeneratedTests.length;
  qualityMetrics.avgContentScore /= testCount;
  qualityMetrics.avgCorrelationScore /= testCount;
  qualityMetrics.avgStructureCount /= testCount;
  qualityMetrics.avgEntityCount /= testCount;
  qualityMetrics.avgProcessingTime /= testCount;
  qualityMetrics.cinematographyPresent =
    (qualityMetrics.cinematographyPresent / testCount) * 100;
  qualityMetrics.renderConfigPresent =
    (qualityMetrics.renderConfigPresent / testCount) * 100;
  qualityMetrics.highQualityRate =
    (qualityMetrics.highQualityCount / testCount) * 100;

  logInfo('Video Generation Quality Metrics:');
  logInfo(
    `  Average Content Relevance: ${(
      qualityMetrics.avgContentScore * 100
    ).toFixed(1)}%`
  );
  logInfo(
    `  Average Input-Output Correlation: ${(
      qualityMetrics.avgCorrelationScore * 100
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
  logInfo(
    `  High Quality Dreams: ${qualityMetrics.highQualityRate.toFixed(1)}%`
  );

  // Enhanced quality improvement criteria
  const qualityImproved =
    qualityMetrics.avgContentScore >= TEST_CONFIG.qualityThreshold && // High content relevance
    qualityMetrics.avgCorrelationScore >= 0.3 && // Good input-output correlation (Requirement 1.4)
    qualityMetrics.avgStructureCount >= 1.5 && // Rich 3D structure
    qualityMetrics.avgEntityCount >= 1.0 && // Adequate entities
    qualityMetrics.avgProcessingTime <= TEST_CONFIG.responseTimeThreshold && // Reasonable speed
    qualityMetrics.cinematographyPresent >= 85 && // Cinematography data
    qualityMetrics.renderConfigPresent >= 85 && // Render configuration
    qualityMetrics.highQualityRate >= 60; // At least 60% high quality dreams

  if (qualityImproved) {
    logSuccess(
      '✅ Video generation quality has significantly improved (Requirements 1.1, 1.4 met)'
    );
  } else {
    logWarning('⚠️  Video generation quality improvement not fully validated');

    // Detailed failure analysis
    if (qualityMetrics.avgContentScore < TEST_CONFIG.qualityThreshold) {
      logWarning(
        `  Content relevance ${(qualityMetrics.avgContentScore * 100).toFixed(
          1
        )}% below threshold ${TEST_CONFIG.qualityThreshold * 100}%`
      );
    }
    if (qualityMetrics.avgCorrelationScore < 0.3) {
      logWarning(
        `  Input-output correlation ${(
          qualityMetrics.avgCorrelationScore * 100
        ).toFixed(1)}% below 30% (Requirement 1.4)`
      );
    }
    if (qualityMetrics.highQualityRate < 60) {
      logWarning(
        `  High quality rate ${qualityMetrics.highQualityRate.toFixed(
          1
        )}% below 60%`
      );
    }
  }

  return {
    passed: qualityImproved,
    metrics: qualityMetrics,
    testCount,
  };
}
