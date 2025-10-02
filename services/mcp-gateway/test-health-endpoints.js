// test-health-endpoints.js
// Test script to verify enhanced health check endpoints

const axios = require('axios');

const BASE_URL = process.env.MCP_GATEWAY_URL || 'http://localhost:8080';

/**
 * Test all health check endpoints
 */
async function testHealthEndpoints() {
  console.log('🔍 Testing Enhanced Health Check Endpoints');
  console.log('==========================================');

  const endpoints = [
    { name: 'Basic Health Check', path: '/health' },
    { name: 'Detailed Health Check', path: '/health/detailed' },
    { name: 'Enhanced Status Check', path: '/status' },
    {
      name: 'Response Processing Metrics',
      path: '/health/response-processing',
    },
    { name: 'Parsing Alerts', path: '/health/parsing-alerts' },
    { name: 'Monitoring Dashboard', path: '/monitoring/dashboard' },
    { name: 'Real-time Metrics', path: '/monitoring/realtime' },
    { name: 'Performance Analytics', path: '/monitoring/performance' },
    { name: 'Alert Management', path: '/monitoring/alerts' },
    { name: 'Provider Status', path: '/providers/status' },
    { name: 'Provider Metrics', path: '/providers/metrics' },
  ];

  const results = [];

  for (const endpoint of endpoints) {
    console.log(`\n📊 Testing: ${endpoint.name}`);
    console.log(`   URL: ${BASE_URL}${endpoint.path}`);

    try {
      const startTime = Date.now();
      const response = await axios.get(`${BASE_URL}${endpoint.path}`, {
        timeout: 10000,
        validateStatus: (status) => status < 500, // Accept 2xx, 3xx, 4xx
      });
      const responseTime = Date.now() - startTime;

      const result = {
        endpoint: endpoint.name,
        path: endpoint.path,
        status: response.status,
        responseTime,
        success: response.status < 400,
        dataSize: JSON.stringify(response.data).length,
        hasProviderData: !!(response.data.providers || response.data.services),
        hasMetrics: !!(response.data.metrics || response.data.summary),
        hasAlerts: !!(response.data.alerts || response.data.alert),
      };

      results.push(result);

      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   ⏱️  Response Time: ${responseTime}ms`);
      console.log(`   📦 Data Size: ${result.dataSize} bytes`);

      // Check for specific data types
      if (result.hasProviderData) {
        console.log(`   🔧 Provider Data: Available`);
      }
      if (result.hasMetrics) {
        console.log(`   📈 Metrics Data: Available`);
      }
      if (result.hasAlerts) {
        console.log(`   🚨 Alert Data: Available`);
      }

      // Log key information from response
      if (response.data.summary) {
        console.log(`   📊 Summary:`, response.data.summary);
      }
      if (response.data.providers && response.data.providers.summary) {
        console.log(`   🔧 Providers:`, response.data.providers.summary);
      }
      if (response.data.system) {
        console.log(
          `   💻 System Uptime: ${Math.round(response.data.system.uptime)}s`
        );
      }
    } catch (error) {
      const result = {
        endpoint: endpoint.name,
        path: endpoint.path,
        status: error.response?.status || 0,
        responseTime: 0,
        success: false,
        error: error.message,
        dataSize: 0,
        hasProviderData: false,
        hasMetrics: false,
        hasAlerts: false,
      };

      results.push(result);

      console.log(`   ❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   📄 Status: ${error.response.status}`);
        console.log(
          `   📝 Response: ${JSON.stringify(error.response.data).substring(
            0,
            200
          )}...`
        );
      }
    }
  }

  // Print summary
  console.log('\n📋 Test Summary');
  console.log('===============');

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const avgResponseTime =
    results
      .filter((r) => r.responseTime > 0)
      .reduce((sum, r) => sum + r.responseTime, 0) / results.length;

  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`⏱️  Average Response Time: ${Math.round(avgResponseTime)}ms`);

  // Detailed results table
  console.log('\n📊 Detailed Results');
  console.log('===================');
  console.table(
    results.map((r) => ({
      Endpoint: r.endpoint,
      Status: r.status,
      'Response Time (ms)': r.responseTime,
      'Data Size (bytes)': r.dataSize,
      'Has Provider Data': r.hasProviderData ? '✅' : '❌',
      'Has Metrics': r.hasMetrics ? '✅' : '❌',
      'Has Alerts': r.hasAlerts ? '✅' : '❌',
      Success: r.success ? '✅' : '❌',
    }))
  );

  // Test specific provider endpoint
  console.log('\n🔧 Testing Provider-Specific Endpoints');
  console.log('======================================');

  try {
    // Get list of providers first
    const providersResponse = await axios.get(`${BASE_URL}/providers/status`);
    const providers = Object.keys(providersResponse.data.data?.providers || {});

    if (providers.length > 0) {
      const testProvider = providers[0];
      console.log(`Testing with provider: ${testProvider}`);

      // Test provider-specific health check
      const providerHealthResponse = await axios.get(
        `${BASE_URL}/health/provider/${testProvider}`
      );
      console.log(`✅ Provider Health Check: ${providerHealthResponse.status}`);
      console.log(
        `   Health Status: ${
          providerHealthResponse.data.health?.status || 'unknown'
        }`
      );

      // Test live health check
      const liveHealthResponse = await axios.post(`${BASE_URL}/health/check`, {
        providers: [testProvider],
      });
      console.log(`✅ Live Health Check: ${liveHealthResponse.status}`);
      console.log(
        `   Results: ${
          Object.keys(liveHealthResponse.data.results || {}).length
        } providers checked`
      );
    } else {
      console.log('⚠️  No providers found for testing');
    }
  } catch (error) {
    console.log(`❌ Provider-specific tests failed: ${error.message}`);
  }

  // Test alert thresholds
  console.log('\n🚨 Testing Alert Functionality');
  console.log('==============================');

  try {
    const alertsResponse = await axios.get(`${BASE_URL}/monitoring/alerts`);
    console.log(`✅ Alerts Endpoint: ${alertsResponse.status}`);
    console.log(`   Total Alerts: ${alertsResponse.data.summary?.total || 0}`);
    console.log(
      `   Critical Alerts: ${alertsResponse.data.summary?.critical || 0}`
    );
    console.log(
      `   Warning Alerts: ${alertsResponse.data.summary?.warning || 0}`
    );

    if (alertsResponse.data.alerts && alertsResponse.data.alerts.length > 0) {
      console.log(`   Recent Alerts:`);
      alertsResponse.data.alerts.slice(0, 3).forEach((alert, index) => {
        console.log(
          `     ${index + 1}. [${alert.type.toUpperCase()}] ${
            alert.provider
          }: ${alert.message}`
        );
      });
    }
  } catch (error) {
    console.log(`❌ Alert tests failed: ${error.message}`);
  }

  console.log('\n🎉 Health Check Endpoint Testing Complete!');

  return {
    totalTests: results.length,
    successful,
    failed,
    avgResponseTime: Math.round(avgResponseTime),
    results,
  };
}

/**
 * Test response processing metrics specifically
 */
async function testResponseProcessingMetrics() {
  console.log('\n🔍 Testing Response Processing Metrics');
  console.log('======================================');

  try {
    const response = await axios.get(`${BASE_URL}/health/response-processing`);
    const data = response.data;

    console.log(`✅ Response Processing Metrics: ${response.status}`);
    console.log(`   Total Requests: ${data.processing?.totalRequests || 0}`);
    console.log(
      `   Successful Parsing: ${data.processing?.successfulParsing || 0}`
    );
    console.log(`   Failed Parsing: ${data.processing?.failedParsing || 0}`);
    console.log(
      `   Parsing Success Rate: ${(
        (data.processing?.parsingSuccessRate || 0) * 100
      ).toFixed(1)}%`
    );
    console.log(
      `   Average Processing Time: ${Math.round(
        data.processing?.averageProcessingTime || 0
      )}ms`
    );

    if (data.errors) {
      console.log(`   Parsing Errors: ${data.errors.parsingErrors || 0}`);
      console.log(`   Timeout Errors: ${data.errors.timeoutErrors || 0}`);
      console.log(`   Format Errors: ${data.errors.formatErrors || 0}`);
      console.log(`   Unknown Errors: ${data.errors.unknownErrors || 0}`);
    }

    if (data.performance) {
      console.log(
        `   Fastest Provider: ${data.performance.fastestProvider || 'N/A'}`
      );
      console.log(
        `   Slowest Provider: ${data.performance.slowestProvider || 'N/A'}`
      );
      console.log(
        `   Most Reliable Provider: ${
          data.performance.mostReliableProvider || 'N/A'
        }`
      );
    }

    if (data.providers) {
      console.log(`   Provider Details:`);
      Object.entries(data.providers).forEach(([provider, metrics]) => {
        console.log(
          `     ${provider}: ${metrics.requests || 0} requests, ${(
            (metrics.successRate || 0) * 100
          ).toFixed(1)}% success`
        );
      });
    }
  } catch (error) {
    console.log(`❌ Response Processing Metrics test failed: ${error.message}`);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  (async () => {
    try {
      const results = await testHealthEndpoints();
      await testResponseProcessingMetrics();

      // Exit with appropriate code
      process.exit(results.failed > 0 ? 1 : 0);
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  testHealthEndpoints,
  testResponseProcessingMetrics,
};
