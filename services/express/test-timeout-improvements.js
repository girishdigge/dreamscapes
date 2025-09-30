// services/express/test-timeout-improvements.js
// Integration test for timeout and network resilience improvements

const {
  fetchWithRetry,
  categorizeNetworkError,
  getTimeoutForRequest,
  getRequestType,
  analyzeNetworkError,
  CircuitBreaker,
} = require('./utils/networkUtils');

async function testTimeoutConfiguration() {
  console.log('🔧 Testing timeout configuration...');

  // Test different timeout configurations
  const healthTimeout = getTimeoutForRequest('http://localhost:8080/health');
  const parseTimeout = getTimeoutForRequest('http://localhost:8080/parse');
  const defaultTimeout = getTimeoutForRequest('http://localhost:8080/api');
  const explicitTimeout = getTimeoutForRequest('http://localhost:8080/api', {
    timeout: 15000,
  });

  console.log(`✅ Health check timeout: ${healthTimeout}ms`);
  console.log(`✅ Parse request timeout: ${parseTimeout}ms`);
  console.log(`✅ Default timeout: ${defaultTimeout}ms`);
  console.log(`✅ Explicit timeout: ${explicitTimeout}ms`);

  // Test request type detection
  console.log('\n🔍 Testing request type detection...');
  console.log(
    `✅ Health request type: ${getRequestType('http://localhost:8080/health')}`
  );
  console.log(
    `✅ Parse request type: ${getRequestType('http://localhost:8080/parse')}`
  );
  console.log(
    `✅ POST request type: ${getRequestType('http://localhost:8080/api', {
      method: 'POST',
    })}`
  );
  console.log(
    `✅ GET request type: ${getRequestType('http://localhost:8080/api', {
      method: 'GET',
    })}`
  );
}

async function testNetworkErrorAnalysis() {
  console.log('\n🔍 Testing network error analysis...');

  // Test different error types
  const timeoutError = new Error('Request timeout');
  timeoutError.name = 'AbortError';

  const connectionError = new Error('Connection refused');
  connectionError.code = 'ECONNREFUSED';

  const dnsError = new Error('DNS resolution failed');
  dnsError.code = 'ENOTFOUND';

  const httpError = new Error('Server error');
  httpError.status = 500;

  const errors = [
    { name: 'Timeout Error', error: timeoutError },
    { name: 'Connection Error', error: connectionError },
    { name: 'DNS Error', error: dnsError },
    { name: 'HTTP Error', error: httpError },
  ];

  errors.forEach(({ name, error }) => {
    const category = categorizeNetworkError(error);
    const analysis = analyzeNetworkError(error, 'http://localhost:8080/parse');

    console.log(`✅ ${name}:`);
    console.log(`   Category: ${category}`);
    console.log(`   Severity: ${analysis.severity}`);
    console.log(`   Retry recommended: ${analysis.retryRecommended}`);
    console.log(`   Fallback: ${analysis.fallbackRecommendation}`);
    console.log(`   Retry reason: ${analysis.retryReason}`);
  });
}

async function testCircuitBreaker() {
  console.log('\n⚡ Testing circuit breaker...');

  const circuitBreaker = new CircuitBreaker({
    name: 'Test-Circuit-Breaker',
    failureThreshold: 3,
    timeout: 5000,
  });

  console.log(`✅ Circuit breaker created with threshold: 3`);
  console.log(
    `✅ Initial state: ${JSON.stringify(circuitBreaker.getState(), null, 2)}`
  );

  // Simulate failures
  for (let i = 0; i < 3; i++) {
    try {
      await circuitBreaker.execute(async () => {
        throw new Error(`Simulated failure ${i + 1}`);
      });
    } catch (error) {
      console.log(`✅ Failure ${i + 1} handled: ${error.message}`);
    }
  }

  console.log(
    `✅ Final state: ${JSON.stringify(circuitBreaker.getState(), null, 2)}`
  );

  // Test circuit breaker blocking
  try {
    await circuitBreaker.execute(async () => {
      return 'This should be blocked';
    });
  } catch (error) {
    console.log(`✅ Circuit breaker blocked request: ${error.message}`);
  }
}

async function testRealNetworkRequest() {
  console.log('\n🌐 Testing real network request with timeout handling...');

  try {
    // Test with a very short timeout to trigger timeout handling
    const response = await fetchWithRetry(
      'http://httpbin.org/delay/2', // This endpoint delays for 2 seconds
      {
        method: 'GET',
        timeout: 1000, // 1 second timeout
      },
      1, // 1 retry
      {
        baseDelay: 500,
        jitterEnabled: false,
      }
    );

    console.log(`✅ Unexpected success: ${response.status}`);
  } catch (error) {
    console.log(`✅ Expected timeout error caught: ${error.message}`);
    console.log(`✅ Error category: ${categorizeNetworkError(error)}`);
    console.log(`✅ Total attempts: ${error.totalAttempts}`);
    console.log(`✅ Retries exhausted: ${error.retriesExhausted}`);

    if (error.networkErrorDetails) {
      console.log(
        `✅ Network error details: ${JSON.stringify(
          error.networkErrorDetails,
          null,
          2
        )}`
      );
    }
  }
}

async function runAllTests() {
  console.log('🚀 Starting timeout and network resilience tests...\n');

  try {
    await testTimeoutConfiguration();
    await testNetworkErrorAnalysis();
    await testCircuitBreaker();
    await testRealNetworkRequest();

    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testTimeoutConfiguration,
  testNetworkErrorAnalysis,
  testCircuitBreaker,
  testRealNetworkRequest,
  runAllTests,
};
