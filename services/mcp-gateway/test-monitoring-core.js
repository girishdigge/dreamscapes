// test-monitoring-core.js
// Test core monitoring functionality without web dashboard

const express = require('express');
const MonitoringMiddleware = require('./middleware/monitoringMiddleware');
const MockProviderManager = require('./monitoring/MockProviderManager');

/**
 * Test core monitoring functionality
 */
async function testCoreMonitoring() {
  console.log('🚀 Starting Core Monitoring Test...\n');

  try {
    // Create Express app
    const app = express();
    app.use(express.json());

    // Create mock provider manager
    const mockProviderManager = new MockProviderManager();

    // Configure monitoring middleware (disable web dashboard)
    const monitoringConfig = {
      enableRequestTracking: true,
      enablePerformanceTracking: true,
      enableErrorTracking: true,
      enableHealthEndpoints: true,
      enableMetricsEndpoints: true,

      monitoring: {
        enableMetrics: true,
        enableAlerting: true,
        enableHealthMonitoring: true,
        enableDashboard: false, // Disable web dashboard for this test

        metrics: {
          collectionInterval: 5000, // 5 seconds for testing
          aggregationInterval: 15000, // 15 seconds for testing
        },

        alerting: {
          thresholds: {
            errorRate: 0.05, // 5% error rate threshold
            responseTime: 3000, // 3 second response time threshold
            consecutiveFailures: 2,
          },
          notifications: {
            console: true,
            email: false,
            slack: false,
          },
        },

        health: {
          healthCheckInterval: 10000, // 10 seconds for testing
          detailedCheckInterval: 30000, // 30 seconds for testing
        },
      },

      logging: {
        level: 'info',
        enableConsole: true,
        enableFile: true,
        enablePerformanceLogging: true,
        enableRequestLogging: true,
        performanceThreshold: 1000, // 1 second
      },
    };

    // Initialize monitoring middleware
    const monitoringMiddleware = new MonitoringMiddleware(monitoringConfig);

    // Setup monitoring with dependencies
    await monitoringMiddleware.setup(app, {
      providerManager: mockProviderManager,
    });

    // Add test routes
    setupTestRoutes(app, mockProviderManager);

    // Start server
    const PORT = 3000;
    const server = app.listen(PORT, () => {
      console.log(`✅ Test server started on port ${PORT}`);
      console.log(
        `🔍 Health endpoint: http://localhost:${PORT}/monitoring/health`
      );
      console.log(
        `📈 Metrics endpoint: http://localhost:${PORT}/monitoring/metrics`
      );
      console.log(
        `🚨 Alerts endpoint: http://localhost:${PORT}/monitoring/alerts\n`
      );
    });

    // Start provider simulation
    mockProviderManager.startSimulation();

    // Run test scenarios
    await runTestScenarios(PORT);

    // Wait a bit to see monitoring in action
    console.log('⏳ Waiting 30 seconds to observe monitoring system...');
    await sleep(30000);

    // Get final monitoring report
    console.log('\n📊 Final Monitoring Report:');
    const finalReport = await makeRequest(
      `http://localhost:${PORT}/monitoring/metrics`
    );
    console.log(
      '- Total providers monitored:',
      Object.keys(finalReport.data?.metrics?.providers || {}).length
    );
    console.log(
      '- Active alerts:',
      finalReport.data?.alerts?.active?.length || 0
    );
    console.log(
      '- Performance stats available:',
      !!finalReport.data?.logging?.performance
    );

    // Cleanup
    console.log('\n🛑 Shutting down...');
    mockProviderManager.stopSimulation();
    server.close();
    await monitoringMiddleware.destroy();

    console.log('✅ Core monitoring test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Setup test routes
 */
function setupTestRoutes(app, mockProviderManager) {
  // Test route that simulates AI requests
  app.post('/test/ai-request', async (req, res) => {
    const {
      provider = 'cerebras',
      operation = 'generateDream',
      simulateError = false,
    } = req.body;

    // Start AI request tracking
    const aiRequestId = app.aiTracking.startAIRequest(provider, operation, {
      model: 'llama-4-maverick-17b',
      temperature: 0.6,
      maxTokens: 1000,
      prompt: 'Test prompt',
    });

    // Start monitoring request tracking
    const monitoringRequestId = app.aiTracking.recordRequestStart(provider, {
      operation,
      model: 'llama-4-maverick-17b',
      inputTokens: 50,
    });

    try {
      // Simulate processing delay
      await sleep(Math.random() * 2000 + 500);

      if (simulateError) {
        // Simulate provider failure
        mockProviderManager.simulateFailure(provider, 'timeout');

        const error = new Error('Simulated AI request failure');

        // End tracking with error
        app.aiTracking.endAIRequest(aiRequestId, {
          success: false,
          error: error.message,
        });

        app.aiTracking.recordRequestEnd(monitoringRequestId, {
          success: false,
          error: error.message,
        });

        return res.status(500).json({
          success: false,
          error: error.message,
          provider,
          operation,
        });
      }

      // Simulate success
      mockProviderManager.simulateSuccess(provider);

      const response = {
        success: true,
        data: { message: 'AI request completed successfully' },
        provider,
        operation,
      };

      // End tracking with success
      app.aiTracking.endAIRequest(aiRequestId, {
        success: true,
        response: JSON.stringify(response),
        tokens: 150,
      });

      app.aiTracking.recordRequestEnd(monitoringRequestId, {
        success: true,
        tokens: { output: 100, total: 150 },
      });

      res.json(response);
    } catch (error) {
      // End tracking with error
      app.aiTracking.endAIRequest(aiRequestId, {
        success: false,
        error: error.message,
      });

      app.aiTracking.recordRequestEnd(monitoringRequestId, {
        success: false,
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: error.message,
        provider,
        operation,
      });
    }
  });

  // Test route for performance testing
  app.get('/test/slow-endpoint', async (req, res) => {
    const delay = parseInt(req.query.delay) || 2000;
    await sleep(delay);

    res.json({
      success: true,
      message: `Slow endpoint completed after ${delay}ms`,
      timestamp: new Date().toISOString(),
    });
  });

  console.log('✅ Test routes setup completed');
}

/**
 * Run automated test scenarios
 */
async function runTestScenarios(port) {
  console.log('🧪 Running automated test scenarios...\n');

  const baseUrl = `http://localhost:${port}`;

  try {
    // Test 1: Successful AI requests
    console.log('📝 Test 1: Successful AI requests');
    for (let i = 0; i < 3; i++) {
      await makeRequest(`${baseUrl}/test/ai-request`, 'POST', {
        provider: 'cerebras',
        operation: 'generateDream',
      });
      await sleep(1000);
    }
    console.log('✅ Test 1 completed\n');

    // Test 2: Failed AI requests (should trigger alerts)
    console.log('📝 Test 2: Failed AI requests');
    for (let i = 0; i < 2; i++) {
      try {
        await makeRequest(`${baseUrl}/test/ai-request`, 'POST', {
          provider: 'openai',
          operation: 'generateDream',
          simulateError: true,
        });
      } catch (error) {
        // Expected to fail
      }
      await sleep(1000);
    }
    console.log('✅ Test 2 completed\n');

    // Test 3: Slow requests (should trigger performance alerts)
    console.log('📝 Test 3: Slow requests');
    await makeRequest(`${baseUrl}/test/slow-endpoint?delay=4000`, 'GET');
    console.log('✅ Test 3 completed\n');

    // Test 4: Check monitoring endpoints
    console.log('📝 Test 4: Monitoring endpoints');

    const healthResponse = await makeRequest(
      `${baseUrl}/monitoring/health`,
      'GET'
    );
    console.log('Health status:', healthResponse.status);

    const metricsResponse = await makeRequest(
      `${baseUrl}/monitoring/metrics`,
      'GET'
    );
    console.log('Metrics available:', !!metricsResponse.data);

    const alertsResponse = await makeRequest(
      `${baseUrl}/monitoring/alerts`,
      'GET'
    );
    console.log('Active alerts:', alertsResponse.data?.active?.length || 0);

    console.log('✅ Test 4 completed\n');

    console.log('🎉 All automated tests completed successfully!\n');
  } catch (error) {
    console.error('❌ Test scenario failed:', error.message);
  }
}

/**
 * Make HTTP request
 */
async function makeRequest(url, method = 'GET', body = null) {
  const fetch = require('node-fetch');

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Request failed: ${method} ${url}`, error.message);
    throw error;
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCoreMonitoring().catch(console.error);
}

module.exports = { testCoreMonitoring };
