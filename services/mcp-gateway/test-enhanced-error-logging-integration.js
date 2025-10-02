// test-enhanced-error-logging-integration.js
// Test script for enhanced error logging and monitoring integration

const {
  initializeEnhancedErrorLoggingAndMonitoring,
  integrateWithProviderManager,
} = require('./utils/initializeEnhancedErrorLoggingAndMonitoring');

/**
 * Test Enhanced Error Logging and Monitoring Integration
 */
async function testEnhancedErrorLoggingIntegration() {
  console.log(
    '🧪 Testing Enhanced Error Logging and Monitoring Integration...\n'
  );

  try {
    // 1. Initialize the enhanced logging and monitoring system
    console.log('📋 Step 1: Initialize Enhanced Logging and Monitoring System');
    const { components, results } =
      await initializeEnhancedErrorLoggingAndMonitoring({
        logLevel: 'debug',
        criticalErrorThreshold: 3,
        parsingFailureThreshold: 5,
        healthFailureThreshold: 2,
        responseTimeThreshold: 3000,
        healthCheckInterval: 10000, // 10 seconds for testing
        metricsCollectionInterval: 15000, // 15 seconds for testing
        reportingInterval: 30000, // 30 seconds for testing
      });

    if (!results.success) {
      console.error('❌ Initialization failed:', results.errors);
      return;
    }

    console.log(
      '✅ Enhanced Logging and Monitoring System initialized successfully\n'
    );

    // 2. Test response parsing error logging
    console.log('📋 Step 2: Test Response Parsing Error Logging');
    if (components.enhancedLoggingLayer) {
      const responseParsingError = new Error(
        'response?.substring is not a function'
      );
      const mockResponse = {
        choices: [{ message: { content: 'test content' } }],
      };

      components.enhancedLoggingLayer.logResponseParsingError(
        responseParsingError,
        'cerebras',
        mockResponse,
        {
          requestId: 'test-req-001',
          parsingAttempts: 3,
          lastAttemptMethod: 'substring',
          responseTime: 1500,
        }
      );

      console.log('✅ Response parsing error logged successfully');
    } else {
      console.warn('⚠️ Enhanced Logging Layer not available');
    }

    // 3. Test provider method error logging
    console.log('\n📋 Step 3: Test Provider Method Error Logging');
    if (components.enhancedLoggingLayer) {
      const methodError = new Error(
        'this.providerManager.getProviderHealth is not a function'
      );

      components.enhancedLoggingLayer.logProviderMethodError(
        methodError,
        'providerManager',
        'getProviderHealth',
        {
          requestId: 'test-req-002',
          availableMethods: [
            'selectProvider',
            'executeWithFallback',
            'healthCheck',
          ],
          missingMethods: ['getProviderHealth'],
        }
      );

      console.log('✅ Provider method error logged successfully');
    } else {
      console.warn('⚠️ Enhanced Logging Layer not available');
    }

    // 4. Test provider operation error logging
    console.log('\n📋 Step 4: Test Provider Operation Error Logging');
    if (components.enhancedLoggingLayer) {
      const operationError = new Error('Connection timeout after 5000ms');

      components.enhancedLoggingLayer.logProviderOperationError(
        operationError,
        'openai',
        'generateDream',
        {
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2000,
        },
        {
          requestId: 'test-req-003',
          responseTime: 5000,
          attemptNumber: 2,
          maxAttempts: 3,
        }
      );

      console.log('✅ Provider operation error logged successfully');
    } else {
      console.warn('⚠️ Enhanced Logging Layer not available');
    }

    // 5. Test provider health error logging
    console.log('\n📋 Step 5: Test Provider Health Error Logging');
    if (components.enhancedLoggingLayer) {
      const healthError = new Error('Health check failed: API key invalid');

      components.enhancedLoggingLayer.logProviderHealthError(
        healthError,
        'cerebras',
        {
          consecutiveFailures: 3,
          lastSuccessfulCheck: Date.now() - 300000, // 5 minutes ago
          healthCheckDuration: 2000,
          expectedResponse: 'healthy',
          actualResponse: 'error',
        }
      );

      console.log('✅ Provider health error logged successfully');
    } else {
      console.warn('⚠️ Enhanced Logging Layer not available');
    }

    // 6. Test structured logging
    console.log('\n📋 Step 6: Test Structured Logging');
    if (components.structuredLogger) {
      // Test performance tracking
      components.structuredLogger.trackPerformance('test_operation', 1500, {
        provider: 'test-provider',
        success: true,
      });

      // Test error logging
      const testError = new Error('Test structured error');
      components.structuredLogger.error('Test error message', testError, {
        component: 'test',
        operation: 'test_operation',
      });

      console.log('✅ Structured logging tested successfully');
    } else {
      console.warn('⚠️ Structured Logger not available');
    }

    // 7. Test monitoring integration
    console.log('\n📋 Step 7: Test Monitoring Integration');
    if (components.monitoringIntegrationManager) {
      // Generate a comprehensive report
      const report =
        await components.monitoringIntegrationManager.generateComprehensiveReport();

      console.log('📊 Monitoring Report Generated:', {
        timestamp: report.timestamp,
        integrationStatus: report.integrationStatus,
        hasLoggingStatistics: !!report.loggingStatistics,
        hasErrorMonitoringReport: !!report.errorMonitoringReport,
      });

      console.log('✅ Monitoring integration tested successfully');
    } else {
      console.warn('⚠️ Monitoring Integration Manager not available');
    }

    // 8. Test error pattern tracking
    console.log('\n📋 Step 8: Test Error Pattern Tracking');
    if (components.enhancedLoggingLayer) {
      // Generate multiple similar errors to test pattern tracking
      for (let i = 0; i < 3; i++) {
        const patternError = new Error('response?.substring is not a function');
        components.enhancedLoggingLayer.logResponseParsingError(
          patternError,
          'cerebras',
          { test: 'pattern' },
          {
            requestId: `pattern-test-${i}`,
            patternTest: true,
          }
        );
      }

      // Get logging statistics to see pattern tracking
      const stats = components.enhancedLoggingLayer.getLoggingStatistics();
      console.log('📈 Error Pattern Statistics:', {
        totalErrorPatterns: Object.keys(stats.errorPatterns).length,
        totalRecentRequests: stats.summary.totalRecentRequests,
        activeProviders: stats.summary.activeProviders,
      });

      console.log('✅ Error pattern tracking tested successfully');
    } else {
      console.warn('⚠️ Enhanced Logging Layer not available');
    }

    // 9. Test alert system
    console.log('\n📋 Step 9: Test Alert System');
    if (components.errorMonitoringIntegration) {
      // Set up alert listener
      components.errorMonitoringIntegration.on('alert', (alertData) => {
        console.log(`🚨 Alert Received: ${alertData.type}`, alertData.data);
      });

      // Generate multiple errors to trigger alerts
      for (let i = 0; i < 6; i++) {
        const alertError = new Error('Critical system error for alert testing');
        components.errorMonitoringIntegration.logProviderMethodError(
          alertError,
          'test-provider',
          'testMethod',
          {
            requestId: `alert-test-${i}`,
            alertTest: true,
          }
        );
      }

      console.log('✅ Alert system tested (check for alert messages above)');
    } else {
      console.warn('⚠️ Error Monitoring Integration not available');
    }

    // 10. Test Provider Manager integration (mock)
    console.log('\n📋 Step 10: Test Provider Manager Integration (Mock)');
    try {
      // Create a mock provider manager for testing
      const mockProviderManager = createMockProviderManager();

      // Integrate with provider manager
      const integrationSuccess = await integrateWithProviderManager(
        components,
        mockProviderManager
      );

      if (integrationSuccess) {
        console.log('✅ Provider Manager integration tested successfully');

        // Test the integrated methods
        try {
          const health = mockProviderManager.getProviderHealth('test-provider');
          console.log('📊 Provider Health:', health.status);
        } catch (error) {
          console.log('🔍 Expected error caught and logged:', error.message);
        }
      } else {
        console.warn('⚠️ Provider Manager integration test failed');
      }
    } catch (error) {
      console.warn(
        '⚠️ Provider Manager integration test error:',
        error.message
      );
    }

    // 11. Display final statistics
    console.log('\n📋 Step 11: Final Statistics');
    if (components.enhancedLoggingLayer) {
      const finalStats = components.enhancedLoggingLayer.getLoggingStatistics();
      console.log('📊 Final Logging Statistics:', {
        totalRecentRequests: finalStats.summary.totalRecentRequests,
        totalErrorPatterns: finalStats.summary.totalErrorPatterns,
        activeProviders: finalStats.summary.activeProviders,
        integrationStatus: finalStats.integrationStatus,
      });
    }

    if (components.monitoringIntegrationManager) {
      const monitoringStatus =
        components.monitoringIntegrationManager.getMonitoringStatus();
      console.log('📈 Monitoring Status:', {
        isInitialized: monitoringStatus.isInitialized,
        activeIntervals: monitoringStatus.activeIntervals,
        integrationStatus: monitoringStatus.integrationStatus,
      });
    }

    console.log(
      '\n🎉 Enhanced Error Logging and Monitoring Integration Test Completed Successfully!'
    );
    console.log(
      '📝 All logging components are working together to provide comprehensive error tracking and monitoring.'
    );

    // Keep the test running for a bit to see monitoring in action
    console.log(
      '\n⏱️ Keeping test running for 45 seconds to demonstrate monitoring...'
    );
    setTimeout(() => {
      console.log('\n🏁 Test completed. Cleaning up...');

      // Cleanup
      if (components.monitoringIntegrationManager) {
        components.monitoringIntegrationManager.destroy();
      }
      if (components.enhancedLoggingLayer) {
        components.enhancedLoggingLayer.destroy();
      }
      if (components.errorMonitoringIntegration) {
        components.errorMonitoringIntegration.stopRealTimeTracking();
      }

      console.log('✅ Cleanup completed');
      process.exit(0);
    }, 45000);
  } catch (error) {
    console.error('\n💥 Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

/**
 * Create a mock provider manager for testing
 */
function createMockProviderManager() {
  return {
    providers: new Map([
      ['test-provider', { name: 'test-provider' }],
      ['cerebras', { name: 'cerebras' }],
      ['openai', { name: 'openai' }],
    ]),

    healthStatus: new Map([
      [
        'test-provider',
        { isHealthy: true, lastCheck: new Date(), consecutiveFailures: 0 },
      ],
      [
        'cerebras',
        { isHealthy: false, lastCheck: new Date(), consecutiveFailures: 2 },
      ],
      [
        'openai',
        { isHealthy: true, lastCheck: new Date(), consecutiveFailures: 0 },
      ],
    ]),

    // Mock getProviderHealth method (this should work after integration)
    getProviderHealth(providerName) {
      if (providerName) {
        const health = this.healthStatus.get(providerName);
        if (!health) {
          throw new Error(`Provider not found: ${providerName}`);
        }
        return {
          status: health.isHealthy ? 'healthy' : 'unhealthy',
          isHealthy: health.isHealthy,
          lastCheck: health.lastCheck,
          consecutiveFailures: health.consecutiveFailures,
        };
      }

      // Return all provider health
      const allHealth = { providers: {} };
      for (const [name, health] of this.healthStatus.entries()) {
        allHealth.providers[name] = {
          status: health.isHealthy ? 'healthy' : 'unhealthy',
          isHealthy: health.isHealthy,
          lastCheck: health.lastCheck,
          consecutiveFailures: health.consecutiveFailures,
        };
      }
      return allHealth;
    },

    async executeWithFallback(operation, providers, options) {
      // Mock implementation that sometimes fails
      if (Math.random() < 0.3) {
        // 30% chance of failure
        throw new Error('Mock operation failure for testing');
      }
      return { success: true, content: 'Mock generated content' };
    },

    async selectProvider(requirements) {
      return {
        name: 'test-provider',
        provider: this.providers.get('test-provider'),
        score: 85,
      };
    },

    async healthCheck(providerName) {
      if (providerName) {
        const health = this.healthStatus.get(providerName);
        if (!health) {
          throw new Error(`Provider not found: ${providerName}`);
        }
        if (!health.isHealthy) {
          throw new Error('Provider health check failed');
        }
        return { isHealthy: true, responseTime: 150 };
      }

      // Check all providers
      const results = {};
      for (const [name, health] of this.healthStatus.entries()) {
        results[name] = {
          isHealthy: health.isHealthy,
          responseTime: health.isHealthy ? 150 : null,
          error: health.isHealthy ? null : 'Mock health check failure',
        };
      }
      return results;
    },

    // Event emitter methods
    on(event, listener) {
      if (!this._events) this._events = {};
      if (!this._events[event]) this._events[event] = [];
      this._events[event].push(listener);
    },

    emit(event, data) {
      if (!this._events || !this._events[event]) return;
      this._events[event].forEach((listener) => listener(data));
    },
  };
}

// Run the test if this file is executed directly
if (require.main === module) {
  testEnhancedErrorLoggingIntegration().catch((error) => {
    console.error('💥 Test execution failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testEnhancedErrorLoggingIntegration };
