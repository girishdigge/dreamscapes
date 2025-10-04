// test-monitoring-system.js
// Test script for the enhanced monitoring and alerting system

const express = require('express');
const MonitoringMiddleware = require('./middleware/monitoringMiddleware');
const MockProviderManager = require('./monitoring/MockProviderManager');

/**
 * Test the monitoring system implementation
 */
async function testMonitoringSystem() {
  console.log('🚀 Starting Monitoring System Test...\n');

  try {
    // Create Express app
    const app = express();
    app.use(express.json());

    // Create mock provider manager
    const mockProviderManager = new MockProviderManager();

    // Configure monitoring middleware
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
        enableDashboard: true,

        metrics: {
          collectionInterval: 10000, // 10 seconds for testing
          aggregationInterval: 30000, // 30 seconds for testing
        },

        alerting: {
          thresholds: {
            errorRate: 0.05, // 5% error rate threshold
            responseTime: 5000, // 5 second response time threshold
            consecutiveFailures: 3,
          },
          notifications: {
            console: true,
            email: false,
            slack: false,
          },
        },

        health: {
          healthCheckInterval: 15000, // 15 seconds for testing
          detailedCheckInterval: 60000, // 1 minute for testing
        },

        dashboard: {
          enableWebInterface: true,
          webPort: 3001,
          updateInterval: 5000, // 5 seconds for testing
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
      console.log(`📊 Monitoring dashboard available at http://localhost:3001`);
      console.log(
        `🔍 Health endpoint: http://localhost:${PORT}/monitoring/health`
      );
      console.log(
        `📈 Metrics endpoint: http://localhost:${PORT}/monitoring/metrics`
      );
      console.log(
        `🚨 Alerts endpoint: http://localhost:${PORT}/monitoring/alerts`
      );
      console.log(
        `📋 Dashboard endpoint: http://localhost:${PORT}/monitoring/dashboard\n`
      );
    });

    // Start provider simulation
    mockProviderManager.startSimulation();

    // Run test scenarios
    await runTestScenarios(PORT);

    // Keep server running for manual testing
    console.log('🔄 Server running... Press Ctrl+C to stop');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');

      mockProviderManager.stopSimulation();
      server.close();
      await monitoringMiddleware.destroy();

      console.log('✅ Shutdown complete');
      process.exit(0);
    });
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
      model: 'cerebras',
      temperature: 0.6,
      maxTokens: 1000,
      prompt: 'Test prompt',
    });

    // Start monitoring request tracking
    const monitoringRequestId = app.aiTracking.recordRequestStart(provider, {
      operation,
      model: 'cerebras',
      inputTokens: 50,
    });

    try {
      // Simulate processing delay
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 3000 + 500)
      );

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
    await new Promise((resolve) => setTimeout(resolve, delay));

    res.json({
      success: true,
      message: `Slow endpoint completed after ${delay}ms`,
      timestamp: new Date().toISOString(),
    });
  });

  // Test route that always errors
  app.get('/test/error-endpoint', (req, res) => {
    throw new Error('Intentional test error');
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
    for (let i = 0; i < 5; i++) {
      await makeRequest(`${baseUrl}/test/ai-request`, 'POST', {
        provider: 'cerebras',
        operation: 'generateDream',
      });
      await sleep(500);
    }
    console.log('✅ Test 1 completed\n');

    // Test 2: Failed AI requests (should trigger alerts)
    console.log('📝 Test 2: Failed AI requests');
    for (let i = 0; i < 3; i++) {
      await makeRequest(`${baseUrl}/test/ai-request`, 'POST', {
        provider: 'openai',
        operation: 'generateDream',
        simulateError: true,
      });
      await sleep(500);
    }
    console.log('✅ Test 2 completed\n');

    // Test 3: Slow requests (should trigger performance alerts)
    console.log('📝 Test 3: Slow requests');
    await makeRequest(`${baseUrl}/test/slow-endpoint?delay=6000`, 'GET');
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
  testMonitoringSystem().catch(console.error);
}

module.exports = { testMonitoringSystem };
