#!/usr/bin/env node

// Test script for service monitoring functionality
// This script tests the new health monitoring and status reporting features

const fetch = require('node-fetch');

const EXPRESS_URL = process.env.EXPRESS_URL || 'http://localhost:8000';

async function testServiceMonitoring() {
  console.log('🔍 Testing Service Monitoring System');
  console.log('=====================================\n');

  const tests = [
    {
      name: 'Basic Health Check',
      endpoint: '/health',
      expectedStatus: 200,
    },
    {
      name: 'Monitoring Status',
      endpoint: '/monitoring/status',
      expectedStatus: [200, 503],
    },
    {
      name: 'Detailed Metrics',
      endpoint: '/monitoring/metrics',
      expectedStatus: 200,
    },
    {
      name: 'Active Alerts',
      endpoint: '/monitoring/alerts',
      expectedStatus: 200,
    },
    {
      name: 'AI Services Status',
      endpoint: '/monitoring/ai-services',
      expectedStatus: 200,
    },
    {
      name: 'Fallback Statistics',
      endpoint: '/monitoring/fallback-stats',
      expectedStatus: 200,
    },
    {
      name: 'Error Patterns',
      endpoint: '/monitoring/error-patterns',
      expectedStatus: 200,
    },
    {
      name: 'MCP Gateway Health',
      endpoint: '/api/mcp-gateway/health',
      expectedStatus: [200, 503],
    },
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}`);
      const response = await fetch(`${EXPRESS_URL}${test.endpoint}`, {
        timeout: 10000,
      });

      const expectedStatuses = Array.isArray(test.expectedStatus)
        ? test.expectedStatus
        : [test.expectedStatus];

      if (expectedStatuses.includes(response.status)) {
        console.log(`✅ ${test.name} - Status: ${response.status}`);

        try {
          const data = await response.json();

          // Log some key information based on endpoint
          if (test.endpoint === '/monitoring/status') {
            console.log(`   Overall Status: ${data.overall}`);
            console.log(`   MCP Gateway: ${data.services?.mcpGateway?.status}`);
            console.log(`   Active Alerts: ${data.alerts?.length || 0}`);
          } else if (test.endpoint === '/monitoring/metrics') {
            console.log(
              `   Total Requests: ${
                data.metrics?.performance?.totalRequests || 0
              }`
            );
            console.log(
              `   MCP Requests: ${data.metrics?.mcpGateway?.totalRequests || 0}`
            );
            console.log(
              `   Fallbacks: ${
                data.metrics?.fallbackUsage?.totalFallbacks || 0
              }`
            );
          } else if (test.endpoint === '/monitoring/alerts') {
            console.log(`   Alert Count: ${data.alertCount}`);
            if (data.alerts && data.alerts.length > 0) {
              data.alerts.forEach((alert) => {
                console.log(
                  `   - ${alert.type.toUpperCase()}: ${alert.message}`
                );
              });
            }
          } else if (test.endpoint === '/monitoring/fallback-stats') {
            console.log(
              `   Fallback Rate: ${data.fallbackSystem?.fallbackRate || 'N/A'}`
            );
            console.log(
              `   Total Fallbacks: ${data.detailedStats?.totalFallbacks || 0}`
            );
          } else if (test.endpoint === '/monitoring/error-patterns') {
            console.log(
              `   Total Errors: ${data.errorPatterns?.totalErrors || 0}`
            );
            console.log(`   Error Rate: ${(data.errorRate * 100).toFixed(1)}%`);
          } else if (test.endpoint === '/mcp-gateway/health') {
            console.log(`   MCP Healthy: ${data.healthy}`);
            console.log(`   Response Time: ${data.responseTime}`);
            console.log(`   Circuit Breaker: ${data.circuitBreaker?.state}`);
          }
        } catch (parseError) {
          console.log(`   (Response parsing failed: ${parseError.message})`);
        }

        passedTests++;
      } else {
        console.log(
          `❌ ${test.name} - Expected: ${test.expectedStatus}, Got: ${response.status}`
        );
      }
    } catch (error) {
      console.log(`❌ ${test.name} - Error: ${error.message}`);
    }

    console.log('');
  }

  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);

  // Test dream processing to generate some metrics
  console.log('\n🎭 Testing Dream Processing (to generate monitoring data)');
  console.log('=========================================================');

  try {
    const dreamResponse = await fetch(`${EXPRESS_URL}/api/parse-dream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'I dreamed of a spaceship orbiting the earth',
        style: 'cyberpunk',
      }),
      timeout: 30000,
    });

    if (dreamResponse.ok) {
      const dreamData = await dreamResponse.json();
      console.log(`✅ Dream processing test completed`);
      console.log(`   Source: ${dreamData.metadata?.source}`);
      console.log(
        `   Processing Time: ${dreamData.metadata?.processingTime}ms`
      );
      console.log(`   Cached: ${dreamData.cached || false}`);
    } else {
      console.log(
        `❌ Dream processing test failed - Status: ${dreamResponse.status}`
      );
    }
  } catch (error) {
    console.log(`❌ Dream processing test error: ${error.message}`);
  }

  // Check monitoring status after dream processing
  console.log('\n📈 Post-Processing Monitoring Status');
  console.log('====================================');

  try {
    const statusResponse = await fetch(`${EXPRESS_URL}/monitoring/status`, {
      timeout: 5000,
    });

    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log(`Overall Status: ${statusData.overall}`);
      console.log(
        `MCP Gateway Status: ${statusData.services?.mcpGateway?.status}`
      );
      console.log(
        `MCP Success Rate: ${statusData.services?.mcpGateway?.successRate}`
      );
      console.log(
        `Fallback Rate: ${statusData.services?.fallbackSystem?.fallbackRate}`
      );
      console.log(
        `Average Processing Time: ${statusData.performance?.averageProcessingTime}`
      );
      console.log(`Error Rate: ${statusData.performance?.errorRate}`);

      if (statusData.alerts && statusData.alerts.length > 0) {
        console.log('\nActive Alerts:');
        statusData.alerts.forEach((alert) => {
          console.log(`- ${alert.type.toUpperCase()}: ${alert.message}`);
        });
      } else {
        console.log('\nNo active alerts');
      }
    }
  } catch (error) {
    console.log(`Error getting post-processing status: ${error.message}`);
  }

  console.log('\n🎯 Service Monitoring Test Complete');

  if (passedTests === totalTests) {
    console.log('✅ All monitoring endpoints are working correctly!');
    process.exit(0);
  } else {
    console.log(
      '❌ Some monitoring endpoints failed. Check the Express service logs.'
    );
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Service Monitoring Test Script

Usage: node test-service-monitoring.js [options]

Options:
  --help, -h     Show this help message
  
Environment Variables:
  EXPRESS_URL    Express service URL (default: http://localhost:8000)

This script tests all the new service monitoring endpoints:
- Basic health checks
- Monitoring status and metrics
- Alert system
- AI service availability
- Fallback usage statistics
- Error pattern analysis
- MCP Gateway health monitoring

The script will also perform a test dream processing request to generate
monitoring data and verify the system is working end-to-end.
`);
  process.exit(0);
}

// Run the tests
testServiceMonitoring().catch((error) => {
  console.error('Test script failed:', error);
  process.exit(1);
});
