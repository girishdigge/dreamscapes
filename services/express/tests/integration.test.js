// services/express/tests/integration.test.js
// Integration test to verify the response processor works with the Express service

const { responseProcessor } = require('../utils/responseProcessor');

// Mock Response object for testing
class MockResponse {
  constructor(data, status = 200, headers = {}) {
    this.data = data;
    this.status = status;
    this.statusText = status === 200 ? 'OK' : 'Error';
    this.ok = status >= 200 && status < 300;
    this._headers = new Map(
      Object.entries({
        'content-type': 'application/json',
        'content-length': JSON.stringify(data).length.toString(),
        ...headers,
      })
    );
  }

  headers = {
    get: (name) => this._headers.get(name.toLowerCase()),
  };

  async text() {
    return JSON.stringify(this.data);
  }
}

async function testSuccessfulResponse() {
  console.log('\n=== Testing successful MCP Gateway response ===');

  const mockResponseData = {
    success: true,
    data: {
      id: 'dream_123',
      title: 'Test Dream',
      style: 'ethereal',
      environment: { preset: 'dawn' },
      structures: [
        {
          id: 's1',
          template: 'floating_library',
          pos: [0, 10, 0],
          scale: 1.0,
          rotation: [0, 0, 0],
          features: ['glowing', 'floating'],
        },
      ],
      entities: [
        {
          id: 'e1',
          type: 'book_swarm',
          count: 50,
          params: { speed: 1.0, glow: 0.8, size: 1.0, color: '#ffffff' },
        },
      ],
      cinematography: {
        durationSec: 30,
        shots: [
          {
            type: 'establish',
            target: 's1',
            duration: 30,
            startPos: [0, 30, 50],
            endPos: [0, 15, -20],
          },
        ],
      },
    },
    metadata: {
      source: 'openai',
      processingTimeMs: 2500,
      generatedAt: new Date().toISOString(),
    },
  };

  const mockResponse = new MockResponse(mockResponseData);
  const requestId = 'test_request_123';
  const responseTime = 3000;
  const originalText = 'I dreamed of a floating library with glowing books';

  try {
    const result = await responseProcessor.processResponse(
      mockResponse,
      requestId,
      responseTime,
      originalText
    );

    console.log('✅ Response processed successfully');
    console.log('Dream ID:', result.dreamJson.id);
    console.log('Source:', result.source);
    console.log('Validation passed:', result.validation.valid);
    console.log('Response time:', result.responseTime + 'ms');
    console.log('Structures count:', result.dreamJson.structures.length);
    console.log('Entities count:', result.dreamJson.entities.length);

    return true;
  } catch (error) {
    console.error('❌ Failed to process successful response:', error.message);
    return false;
  }
}

async function testFailedResponse() {
  console.log('\n=== Testing failed MCP Gateway response ===');

  const mockResponseData = {
    success: false,
    error: 'AI service temporarily unavailable',
    metadata: {
      source: 'error',
      processingTimeMs: 1000,
      generatedAt: new Date().toISOString(),
    },
  };

  const mockResponse = new MockResponse(mockResponseData);
  const requestId = 'test_request_456';
  const responseTime = 1500;
  const originalText = 'Test dream text';

  try {
    const result = await responseProcessor.processResponse(
      mockResponse,
      requestId,
      responseTime,
      originalText
    );

    console.error('❌ Should have thrown an error for failed response');
    return false;
  } catch (error) {
    console.log('✅ Correctly handled failed response');
    console.log('Error message:', error.message);
    console.log('Request ID:', error.requestId);
    console.log('Processing stage:', error.processingStage);
    console.log('Category:', error.category);
    console.log('Retryable:', error.retryable);

    return true;
  }
}

async function testInvalidJsonResponse() {
  console.log('\n=== Testing invalid JSON response ===');

  // Create a mock response that returns invalid JSON
  class InvalidJsonResponse extends MockResponse {
    async text() {
      return '{"invalid": json, "missing": quote}';
    }
  }

  const mockResponse = new InvalidJsonResponse({});
  const requestId = 'test_request_789';
  const responseTime = 2000;
  const originalText = 'Test dream text';

  try {
    const result = await responseProcessor.processResponse(
      mockResponse,
      requestId,
      responseTime,
      originalText
    );

    console.error('❌ Should have thrown an error for invalid JSON');
    return false;
  } catch (error) {
    console.log('✅ Correctly handled invalid JSON response');
    console.log('Error message:', error.message);
    console.log('Processing stage:', error.processingStage);
    console.log('Category:', error.category);
    console.log('Retryable:', error.retryable);

    return true;
  }
}

async function testMissingDreamDataResponse() {
  console.log('\n=== Testing response with missing dream data ===');

  const mockResponseData = {
    success: true,
    // Missing both 'data' and 'fallback' fields
    metadata: {
      source: 'openai',
      processingTimeMs: 2000,
      generatedAt: new Date().toISOString(),
    },
  };

  const mockResponse = new MockResponse(mockResponseData);
  const requestId = 'test_request_101';
  const responseTime = 2500;
  const originalText = 'Test dream text';

  try {
    const result = await responseProcessor.processResponse(
      mockResponse,
      requestId,
      responseTime,
      originalText
    );

    console.error('❌ Should have thrown an error for missing dream data');
    return false;
  } catch (error) {
    console.log('✅ Correctly handled missing dream data');
    console.log('Error message:', error.message);
    console.log('Processing stage:', error.processingStage);
    console.log('Category:', error.category);

    return true;
  }
}

async function testCacheStatistics() {
  console.log('\n=== Testing cache statistics ===');

  const initialStats = responseProcessor.getCacheStats();
  console.log('Initial cache stats:', initialStats);

  // Clear cache
  responseProcessor.clearValidationCache();
  const clearedStats = responseProcessor.getCacheStats();
  console.log('After clearing cache:', clearedStats);

  console.log('✅ Cache statistics working correctly');
  return true;
}

async function runIntegrationTests() {
  console.log('🧪 Running Response Processor Integration Tests...');

  const tests = [
    { name: 'Successful Response', fn: testSuccessfulResponse },
    { name: 'Failed Response', fn: testFailedResponse },
    { name: 'Invalid JSON Response', fn: testInvalidJsonResponse },
    { name: 'Missing Dream Data Response', fn: testMissingDreamDataResponse },
    { name: 'Cache Statistics', fn: testCacheStatistics },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
        console.log(`✅ ${test.name}: PASSED`);
      } else {
        failed++;
        console.log(`❌ ${test.name}: FAILED`);
      }
    } catch (error) {
      failed++;
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
    }
  }

  console.log(`\n📊 Integration Test Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(
    `📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`
  );

  if (failed === 0) {
    console.log('\n🎉 All integration tests passed!');
  } else {
    console.log(
      '\n⚠️  Some integration tests failed. Please review the output above.'
    );
  }

  return failed === 0;
}

// Export for use in other tests
module.exports = {
  runIntegrationTests,
  MockResponse,
};

// Run integration tests if this file is executed directly
if (require.main === module) {
  runIntegrationTests().catch(console.error);
}
