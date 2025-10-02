// test-monitoring-integration.js
// Integration test for enhanced monitoring and health check endpoints

const axios = require('axios');
const { spawn } = require('child_process');

const BASE_URL = process.env.MCP_GATEWAY_URL || 'http://localhost:8080';
const TEST_TIMEOUT = 30000; // 30 seconds

/**
 * Comprehensive integration test for monitoring system
 */
async function runMonitoringIntegrationTest() {
  console.log('🚀 Starting Monitoring Integration Test');
  console.log('======================================');

  const testResults = {
    startTime: new Date(),
    tests: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    },
  };

  // Test 1: Basic service availability
  await runTest(testResults, 'Service Availability', async () => {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });

    if (response.status !== 200 && response.status !== 206) {
      throw new Error(`Expected status 200 or 206, got ${response.status}`);
    }

    if (!response.data.service || !response.data.timestamp) {
      throw new Error('Missing required health check fields');
    }

    return {
      status: response.status,
      service: response.data.service,
      uptime: response.data.uptime,
    };
  });

  // Test 2: ProviderManager integration
  await runTest(testResults, 'ProviderManager Integration', async () => {
    const response = await axios.get(`${BASE_URL}/health/detailed`, {
      timeout: 10000,
    });

    if (!response.data.providers) {
      throw new Error('Provider data not available in detailed health check');
    }

    if (!response.data.summary) {
      throw new Error('Provider summary not available');
    }

    const hasProviderManagerMethods =
      response.data.monitoring &&
      (response.data.monitoring.healthMonitorActive !== undefined ||
        response.data.monitoring.metricsCollectorActive !== undefined);

    if (!hasProviderManagerMethods) {
      throw new Error('ProviderManager monitoring methods not detected');
    }

    return {
      totalProviders: response.data.summary.total,
      healthyProviders: response.data.summary.healthy,
      monitoringActive: response.data.monitoring,
    };
  });

  // Test 3: Response processing metrics
  await runTest(testResults, 'Response Processing Metrics', async () => {
    const response = await axios.get(`${BASE_URL}/health/response-processing`, {
      timeout: 10000,
    });

    if (!response.data.processing) {
      throw new Error('Response processing metrics not available');
    }

    const requiredFields = [
      'totalRequests',
      'successfulParsing',
      'failedParsing',
      'parsingSuccessRate',
    ];
    for (const field of requiredFields) {
      if (response.data.processing[field] === undefined) {
        throw new Error(`Missing required processing field: ${field}`);
      }
    }

    return {
      totalRequests: response.data.processing.totalRequests,
      parsingSuccessRate: response.data.processing.parsingSuccessRate,
      averageProcessingTime: response.data.processing.averageProcessingTime,
    };
  });

  // Test 4: Alert system functionality
  await runTest(testResults, 'Alert System Functionality', async () => {
    const response = await axios.get(`${BASE_URL}/health/parsing-alerts`, {
      timeout: 10000,
    });

    if (!response.data.alerts) {
      throw new Error('Alert data not available');
    }

    if (!response.data.summary) {
      throw new Error('Alert summary not available');
    }

    if (!response.data.thresholds) {
      throw new Error('Alert thresholds not configured');
    }

    return {
      totalAlerts: response.data.summary.total,
      criticalAlerts: response.data.summary.critical,
      warningAlerts: response.data.summary.warning,
      thresholds: response.data.thresholds,
    };
  });

  // Test 5: Monitoring dashboard
  await runTest(testResults, 'Monitoring Dashboard', async () => {
    const response = await axios.get(`${BASE_URL}/monitoring/dashboard`, {
      timeout: 15000,
    });

    if (!response.data.system) {
      throw new Error('System information not available in dashboard');
    }

    if (!response.data.providers) {
      throw new Error('Provider information not available in dashboard');
    }

    if (!response.data.metrics) {
      throw new Error('Metrics information not available in dashboard');
    }

    return {
      systemUptime: response.data.system.uptime,
      totalProviders: response.data.providers.summary?.total || 0,
      totalRequests: response.data.metrics.requests?.total || 0,
      monitoringActive: response.data.monitoring,
    };
  });

  // Test 6: Real-time metrics
  await runTest(testResults, 'Real-time Metrics', async () => {
    const response = await axios.get(`${BASE_URL}/monitoring/realtime`, {
      timeout: 10000,
    });

    if (!response.data.providers && !response.data.summary) {
      throw new Error('Real-time metrics data not available');
    }

    return {
      activeRequests: response.data.summary?.activeRequests || 0,
      requestsInLastMinute: response.data.summary?.requestsInLastMinute || 0,
      providersTracked: Object.keys(response.data.providers || {}).length,
    };
  });

  // Test 7: Performance analytics
  await runTest(testResults, 'Performance Analytics', async () => {
    const response = await axios.get(
      `${BASE_URL}/monitoring/performance?timeRange=1h`,
      { timeout: 15000 }
    );

    if (!response.data.summary) {
      throw new Error('Performance summary not available');
    }

    if (!response.data.analysis) {
      throw new Error('Performance analysis not available');
    }

    return {
      totalRequests: response.data.summary.totalRequests,
      averageResponseTime: response.data.summary.averageResponseTime,
      successRate: response.data.summary.successRate,
      performanceScore: response.data.summary.performanceScore,
      recommendations: response.data.analysis.recommendations?.length || 0,
    };
  });

  // Test 8: Provider status endpoint
  await runTest(testResults, 'Provider Status Endpoint', async () => {
    const response = await axios.get(`${BASE_URL}/providers/status`, {
      timeout: 10000,
    });

    if (!response.data.success) {
      throw new Error('Provider status request failed');
    }

    if (!response.data.data) {
      throw new Error('Provider status data not available');
    }

    return {
      totalProviders: response.data.data.summary?.totalProviders || 0,
      healthyProviders: response.data.data.summary?.healthyProviders || 0,
      availableProviders: response.data.data.availableProviders?.length || 0,
    };
  });

  // Test 9: Provider metrics endpoint
  await runTest(testResults, 'Provider Metrics Endpoint', async () => {
    const response = await axios.get(`${BASE_URL}/providers/metrics`, {
      timeout: 10000,
    });

    if (!response.data.success) {
      throw new Error('Provider metrics request failed');
    }

    if (!response.data.data) {
      throw new Error('Provider metrics data not available');
    }

    return {
      metricsAvailable: Object.keys(response.data.data).length > 0,
      providersWithMetrics: Object.keys(response.data.data).length,
    };
  });

  // Test 10: Live health check functionality
  await runTest(testResults, 'Live Health Check', async () => {
    const response = await axios.post(
      `${BASE_URL}/health/check`,
      {},
      { timeout: 15000 }
    );

    if (!response.data.results) {
      throw new Error('Live health check results not available');
    }

    if (!response.data.summary) {
      throw new Error('Live health check summary not available');
    }

    return {
      totalChecked: response.data.summary.total,
      healthyProviders: response.data.summary.healthy,
      unhealthyProviders: response.data.summary.unhealthy,
      errors: response.data.summary.errors,
    };
  });

  // Test 11: Enhanced status endpoint
  await runTest(testResults, 'Enhanced Status Endpoint', async () => {
    const response = await axios.get(`${BASE_URL}/status`, { timeout: 15000 });

    if (!response.data.services) {
      throw new Error('Service status information not available');
    }

    if (!response.data.providerManager) {
      throw new Error('ProviderManager status not available');
    }

    if (!response.data.system) {
      throw new Error('System information not available');
    }

    return {
      overallStatus: response.data.overallStatus,
      servicesChecked: Object.keys(response.data.services).length,
      providerManagerInitialized: response.data.providerManager.initialized,
      systemUptime: response.data.system.uptime,
    };
  });

  // Test 12: Error handling and edge cases
  await runTest(testResults, 'Error Handling', async () => {
    // Test non-existent provider
    try {
      await axios.get(`${BASE_URL}/health/provider/nonexistent`, {
        timeout: 5000,
      });
      throw new Error('Expected 404 for non-existent provider');
    } catch (error) {
      if (error.response?.status !== 404) {
        throw new Error(
          `Expected 404, got ${error.response?.status || 'network error'}`
        );
      }
    }

    // Test invalid alert parameters
    const alertResponse = await axios.get(
      `${BASE_URL}/monitoring/alerts?severity=invalid`,
      { timeout: 5000 }
    );
    if (!alertResponse.data.alerts) {
      throw new Error(
        'Alert endpoint should handle invalid parameters gracefully'
      );
    }

    return {
      errorHandlingWorking: true,
      gracefulDegradation: true,
    };
  });

  // Calculate final results
  testResults.endTime = new Date();
  testResults.duration = testResults.endTime - testResults.startTime;

  // Print summary
  console.log('\n📊 Integration Test Summary');
  console.log('===========================');
  console.log(`Total Tests: ${testResults.summary.total}`);
  console.log(`✅ Passed: ${testResults.summary.passed}`);
  console.log(`❌ Failed: ${testResults.summary.failed}`);
  console.log(`⏭️  Skipped: ${testResults.summary.skipped}`);
  console.log(`⏱️  Duration: ${Math.round(testResults.duration / 1000)}s`);

  if (testResults.summary.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter((test) => test.status === 'failed')
      .forEach((test) => {
        console.log(`   - ${test.name}: ${test.error}`);
      });
  }

  // Print detailed results
  console.log('\n📋 Detailed Test Results');
  console.log('========================');
  console.table(
    testResults.tests.map((test) => ({
      Test: test.name,
      Status:
        test.status === 'passed'
          ? '✅'
          : test.status === 'failed'
          ? '❌'
          : '⏭️',
      Duration: `${test.duration}ms`,
      Result: test.result
        ? JSON.stringify(test.result).substring(0, 50) + '...'
        : 'N/A',
    }))
  );

  return testResults;
}

/**
 * Run a single test with error handling and timing
 */
async function runTest(testResults, testName, testFunction) {
  console.log(`\n🧪 Running: ${testName}`);

  const test = {
    name: testName,
    startTime: Date.now(),
    endTime: null,
    duration: 0,
    status: 'running',
    result: null,
    error: null,
  };

  testResults.tests.push(test);
  testResults.summary.total++;

  try {
    const result = await Promise.race([
      testFunction(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout')), TEST_TIMEOUT)
      ),
    ]);

    test.endTime = Date.now();
    test.duration = test.endTime - test.startTime;
    test.status = 'passed';
    test.result = result;
    testResults.summary.passed++;

    console.log(`   ✅ Passed (${test.duration}ms)`);
    if (result && typeof result === 'object') {
      Object.entries(result).forEach(([key, value]) => {
        console.log(`      ${key}: ${value}`);
      });
    }
  } catch (error) {
    test.endTime = Date.now();
    test.duration = test.endTime - test.startTime;
    test.status = 'failed';
    test.error = error.message;
    testResults.summary.failed++;

    console.log(`   ❌ Failed (${test.duration}ms): ${error.message}`);
  }
}

/**
 * Generate a test report
 */
function generateTestReport(testResults) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: testResults.summary,
    duration: testResults.duration,
    tests: testResults.tests,
    environment: {
      baseUrl: BASE_URL,
      nodeVersion: process.version,
      platform: process.platform,
    },
    recommendations: [],
  };

  // Generate recommendations based on test results
  if (testResults.summary.failed > 0) {
    report.recommendations.push(
      'Review failed tests and fix underlying issues'
    );
  }

  const avgDuration =
    testResults.tests.reduce((sum, test) => sum + test.duration, 0) /
    testResults.tests.length;
  if (avgDuration > 5000) {
    report.recommendations.push('Consider optimizing endpoint response times');
  }

  return report;
}

// Run tests if this script is executed directly
if (require.main === module) {
  (async () => {
    try {
      const results = await runMonitoringIntegrationTest();
      const report = generateTestReport(results);

      // Save report to file
      const fs = require('fs');
      const reportPath = 'monitoring-integration-test-report.json';
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Test report saved to: ${reportPath}`);

      // Exit with appropriate code
      process.exit(results.summary.failed > 0 ? 1 : 0);
    } catch (error) {
      console.error('❌ Integration test execution failed:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  runMonitoringIntegrationTest,
  generateTestReport,
};
