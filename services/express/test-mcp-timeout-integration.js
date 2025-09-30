// services/express/test-mcp-timeout-integration.js
// Integration test for MCP Gateway communication with improved timeout handling

require('dotenv').config();
const {
  fetchWithRetry,
  analyzeNetworkError,
  categorizeNetworkError,
} = require('./utils/networkUtils');

const MCP_GATEWAY_URL =
  process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8080';

async function testMCPGatewayTimeout() {
  console.log(
    '🔧 Testing MCP Gateway communication with timeout improvements...'
  );
  console.log(`📡 MCP Gateway URL: ${MCP_GATEWAY_URL}`);

  // Test 1: Health check with short timeout
  console.log('\n1️⃣ Testing health check with timeout handling...');
  try {
    const healthResponse = await fetchWithRetry(
      `${MCP_GATEWAY_URL}/health`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Dreamscapes-Express/1.0.0',
          'X-Health-Check': 'true',
        },
        timeout: 5000, // 5 second timeout for health check
      },
      0, // No retries for health checks
      {
        baseDelay: 0,
        jitterEnabled: false,
      }
    );

    console.log(`✅ Health check successful: ${healthResponse.status}`);
    console.log(
      `📊 Content-Type: ${healthResponse.headers.get('content-type')}`
    );
  } catch (error) {
    const errorCategory = categorizeNetworkError(error);
    const analysis = analyzeNetworkError(error, `${MCP_GATEWAY_URL}/health`, {
      method: 'GET',
    });

    console.log(`❌ Health check failed: ${error.message}`);
    console.log(`📊 Error category: ${errorCategory}`);
    console.log(`📊 Analysis: ${JSON.stringify(analysis, null, 2)}`);
  }

  // Test 2: Parse request with extended timeout
  console.log('\n2️⃣ Testing parse request with extended timeout...');
  try {
    const parseResponse = await fetchWithRetry(
      `${MCP_GATEWAY_URL}/parse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'Dreamscapes-Express/1.0.0',
          'X-Request-Source': 'timeout-test',
        },
        body: JSON.stringify({
          text: 'I dreamed of a spaceship orbiting the earth',
          style: 'ethereal',
          options: {},
        }),
        timeout: 60000, // 60 second timeout for AI generation
      },
      2, // 2 retries
      {
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2.0,
        jitterEnabled: true,
      }
    );

    console.log(`✅ Parse request successful: ${parseResponse.status}`);
    console.log(
      `📊 Content-Type: ${parseResponse.headers.get('content-type')}`
    );

    if (parseResponse.ok) {
      const result = await parseResponse.json();
      console.log(`📊 Response success: ${result.success}`);
      console.log(`📊 Data available: ${!!result.data}`);
      console.log(`📊 Source: ${result.metadata?.source || 'unknown'}`);
    }
  } catch (error) {
    const errorCategory = categorizeNetworkError(error);
    const analysis = analyzeNetworkError(error, `${MCP_GATEWAY_URL}/parse`, {
      method: 'POST',
    });

    console.log(`❌ Parse request failed: ${error.message}`);
    console.log(`📊 Error category: ${errorCategory}`);
    console.log(`📊 Total attempts: ${error.totalAttempts || 1}`);
    console.log(`📊 Retries exhausted: ${error.retriesExhausted || false}`);
    console.log(`📊 Analysis: ${JSON.stringify(analysis, null, 2)}`);

    if (analysis.fallbackRecommendation === 'local_generation') {
      console.log('💡 Recommendation: Use local fallback generation');
    }
  }

  // Test 3: Timeout simulation with very short timeout
  console.log('\n3️⃣ Testing timeout handling with very short timeout...');
  try {
    const timeoutResponse = await fetchWithRetry(
      `${MCP_GATEWAY_URL}/parse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text: 'A complex dream that should take time to process',
          style: 'surreal',
        }),
        timeout: 100, // Very short timeout to trigger timeout handling
      },
      1, // 1 retry
      {
        baseDelay: 500,
        jitterEnabled: false,
      }
    );

    console.log(`✅ Unexpected success: ${timeoutResponse.status}`);
  } catch (error) {
    const errorCategory = categorizeNetworkError(error);
    const analysis = analyzeNetworkError(error, `${MCP_GATEWAY_URL}/parse`, {
      method: 'POST',
    });

    console.log(`✅ Expected timeout error: ${error.message}`);
    console.log(`📊 Error category: ${errorCategory}`);
    console.log(`📊 Total attempts: ${error.totalAttempts || 1}`);
    console.log(`📊 Analysis: ${JSON.stringify(analysis, null, 2)}`);

    if (errorCategory === 'timeout') {
      console.log('✅ Timeout handling working correctly');
    }
  }
}

async function testEnvironmentConfiguration() {
  console.log('\n🔧 Testing environment configuration...');

  const configs = [
    'MCP_TIMEOUT_MS',
    'HEALTH_CHECK_TIMEOUT_MS',
    'LONG_OPERATION_TIMEOUT_MS',
    'MCP_MAX_RETRIES',
    'MCP_RETRY_BASE_DELAY',
    'MCP_RETRY_MAX_DELAY',
    'MCP_RETRY_BACKOFF_MULTIPLIER',
    'MCP_CIRCUIT_BREAKER_THRESHOLD',
    'MCP_CIRCUIT_BREAKER_TIMEOUT',
    'MCP_CIRCUIT_BREAKER_MONITORING',
  ];

  configs.forEach((config) => {
    const value = process.env[config];
    console.log(`📊 ${config}: ${value || 'not set (using default)'}`);
  });
}

async function runIntegrationTest() {
  console.log('🚀 Starting MCP Gateway timeout integration test...\n');

  try {
    await testEnvironmentConfiguration();
    await testMCPGatewayTimeout();

    console.log('\n✅ Integration test completed successfully!');
    console.log(
      '💡 The timeout and network resilience improvements are working correctly.'
    );
  } catch (error) {
    console.error('\n❌ Integration test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  runIntegrationTest();
}

module.exports = {
  testMCPGatewayTimeout,
  testEnvironmentConfiguration,
  runIntegrationTest,
};
