// services/mcp-gateway/verify-optimization.js
// Simple verification script for Cerebras connection pooling and optimization

const {
  getConnectionPoolStats,
  getBatcherStats,
  getPerformanceMetrics,
  healthCheck,
  updateRetryConfig,
  connectionPool,
  requestBatcher,
} = require('./services/cerebrasService');

async function verifyOptimizationFeatures() {
  console.log('🔍 Verifying Cerebras Optimization Features...\n');

  let allTestsPassed = true;

  try {
    // Test 1: Connection Pool Initialization
    console.log('1. Testing connection pool initialization...');
    const poolStats = await getConnectionPoolStats();

    if (poolStats && typeof poolStats.maxConnections === 'number') {
      console.log(
        `   ✅ Connection pool initialized with ${poolStats.maxConnections} max connections`
      );
    } else {
      console.log('   ❌ Connection pool not properly initialized');
      allTestsPassed = false;
    }

    // Test 2: Request Batcher Initialization
    console.log('2. Testing request batcher initialization...');
    const batcherStats = await getBatcherStats();

    if (batcherStats && typeof batcherStats.batchSize === 'number') {
      console.log(
        `   ✅ Request batcher initialized with batch size ${batcherStats.batchSize}`
      );
    } else {
      console.log('   ❌ Request batcher not properly initialized');
      allTestsPassed = false;
    }

    // Test 3: Performance Metrics
    console.log('3. Testing performance metrics collection...');
    const metrics = await getPerformanceMetrics();

    if (metrics && metrics.connectionPool && metrics.requestBatcher) {
      console.log('   ✅ Performance metrics collection working');
      console.log(
        `   📊 Memory usage: ${(
          metrics.memoryUsage.heapUsed /
          1024 /
          1024
        ).toFixed(2)} MB`
      );
    } else {
      console.log('   ❌ Performance metrics not working properly');
      allTestsPassed = false;
    }

    // Test 4: Retry Configuration
    console.log('4. Testing retry configuration management...');
    const originalConfig = connectionPool.retryConfig;

    const testConfig = {
      maxAttempts: 5,
      baseDelay: 2000,
    };

    const configResult = await updateRetryConfig(testConfig);

    if (configResult.success && configResult.config.maxAttempts === 5) {
      console.log('   ✅ Retry configuration management working');

      // Restore original config
      await updateRetryConfig(originalConfig);
    } else {
      console.log('   ❌ Retry configuration management not working');
      allTestsPassed = false;
    }

    // Test 5: Health Check System
    console.log('5. Testing health check system...');
    const health = await healthCheck();

    if (health && typeof health.success === 'boolean') {
      console.log(
        `   ✅ Health check system working (status: ${
          health.success ? 'healthy' : 'unhealthy'
        })`
      );
    } else {
      console.log('   ❌ Health check system not working properly');
      allTestsPassed = false;
    }

    // Test 6: Connection Pool Methods
    console.log('6. Testing connection pool methods...');

    const hasRequiredMethods = [
      'executeRequest',
      'getStats',
      'resetStats',
      'cleanup',
    ].every((method) => typeof connectionPool[method] === 'function');

    if (hasRequiredMethods) {
      console.log('   ✅ Connection pool has all required methods');
    } else {
      console.log('   ❌ Connection pool missing required methods');
      allTestsPassed = false;
    }

    // Test 7: Request Batcher Methods
    console.log('7. Testing request batcher methods...');

    const batcherHasRequiredMethods = ['addRequest', 'getStats'].every(
      (method) => typeof requestBatcher[method] === 'function'
    );

    if (batcherHasRequiredMethods) {
      console.log('   ✅ Request batcher has all required methods');
    } else {
      console.log('   ❌ Request batcher missing required methods');
      allTestsPassed = false;
    }

    // Test 8: Error Classification
    console.log('8. Testing error classification...');

    const authError = new Error('Authentication failed');
    const networkError = new Error('Network timeout');

    console.log(
      `   Debug: connectionPool has _isNonRetryableError method: ${typeof connectionPool._isNonRetryableError}`
    );
    console.log(`   Debug: authError message: "${authError.message}"`);
    console.log(`   Debug: networkError message: "${networkError.message}"`);

    const authNonRetryable = connectionPool._isNonRetryableError(authError);
    const networkNonRetryable =
      connectionPool._isNonRetryableError(networkError);

    console.log(
      `   Debug: auth error non-retryable: ${authNonRetryable} (type: ${typeof authNonRetryable})`
    );
    console.log(
      `   Debug: network error non-retryable: ${networkNonRetryable} (type: ${typeof networkNonRetryable})`
    );

    if (authNonRetryable === true && networkNonRetryable === false) {
      console.log('   ✅ Error classification working correctly');
    } else {
      console.log('   ❌ Error classification not working properly');
      allTestsPassed = false;
    }

    // Test 9: Statistics Tracking
    console.log('9. Testing statistics tracking...');

    const initialStats = connectionPool.getStats();

    // Simulate a response time update
    connectionPool.connectionStats.successfulRequests = 1;
    connectionPool._updateAverageResponseTime(1000);

    const updatedStats = connectionPool.getStats();

    if (updatedStats.averageResponseTime === 1000) {
      console.log('   ✅ Statistics tracking working correctly');
    } else {
      console.log('   ❌ Statistics tracking not working properly');
      allTestsPassed = false;
    }

    // Test 10: Configuration Values
    console.log('10. Testing configuration values...');

    const config = require('./config/cerebras');

    if (
      config.optimization &&
      config.optimization.connectionPooling &&
      config.optimization.requestBatching
    ) {
      console.log('   ✅ Optimization configuration properly loaded');
      console.log(
        `   📋 Max connections: ${config.optimization.maxConcurrentRequests}`
      );
      console.log(`   📋 Retry attempts: ${config.optimization.retryAttempts}`);
      console.log(
        `   📋 Batch size: ${config.optimization.requestBatching.batchSize}`
      );
    } else {
      console.log('   ❌ Optimization configuration not properly loaded');
      allTestsPassed = false;
    }

    // Summary
    console.log('\n📋 Verification Summary:');
    console.log(
      `   Tests passed: ${allTestsPassed ? 'All ✅' : 'Some failed ❌'}`
    );

    if (allTestsPassed) {
      console.log('   🎉 All optimization features are working correctly!');
      console.log('\n✨ Available optimization features:');
      console.log('   • Connection pooling with configurable limits');
      console.log('   • Request batching for improved throughput');
      console.log('   • Exponential backoff retry logic');
      console.log('   • Comprehensive performance monitoring');
      console.log('   • Intelligent error classification');
      console.log('   • Health check system');
      console.log('   • Dynamic configuration management');
    } else {
      console.log(
        '   ⚠️  Some optimization features may not be working correctly.'
      );
      console.log('   Please check the error messages above for details.');
    }

    return allTestsPassed;
  } catch (error) {
    console.error('❌ Verification failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run verification if this file is executed directly
if (require.main === module) {
  verifyOptimizationFeatures()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Verification script failed:', error);
      process.exit(1);
    });
}

module.exports = {
  verifyOptimizationFeatures,
};
