// Test script for Cerebras streaming functionality
// Run with: node services/mcp-gateway/tests/cerebras-streaming-test.js

const cerebrasService = require('../services/cerebrasService');

async function testStreamingFunctionality() {
  console.log('🧪 Testing Cerebras Streaming Functionality...\n');

  try {
    // Test 1: Basic streaming connection test
    console.log('1. Testing streaming connection...');
    const connectionTest = await cerebrasService.testStreamingConnection();

    if (connectionTest.success) {
      console.log('✅ Streaming connection successful');
      console.log(`   Response time: ${connectionTest.responseTime}ms`);
      console.log(`   Chunks received: ${connectionTest.chunkCount}`);
      console.log(`   Content length: ${connectionTest.contentLength}`);
    } else {
      console.log('❌ Streaming connection failed:', connectionTest.error);
      return;
    }

    // Test 2: Stream with callbacks
    console.log('\n2. Testing streaming with callbacks...');
    let chunkCount = 0;
    let totalContent = '';

    const result = await cerebrasService.generateDreamStream(
      'Describe a peaceful garden with flowing water',
      { maxTokens: 100, temperature: 0.7 },
      // onChunk callback
      async (chunkData) => {
        chunkCount++;
        totalContent += chunkData.content;
        console.log(`   📦 Chunk ${chunkCount}: "${chunkData.content}"`);
      },
      // onComplete callback
      async (completeData) => {
        console.log('✅ Stream completed successfully');
        console.log(`   Total chunks: ${completeData.chunkCount}`);
        console.log(`   Processing time: ${completeData.processingTime}ms`);
        console.log(`   Finish reason: ${completeData.finishReason}`);
      },
      // onError callback
      async (errorData) => {
        console.log('❌ Stream error:', errorData.message);
      }
    );

    // Test 3: Stream with timeout
    console.log('\n3. Testing streaming with timeout...');
    const timeoutResult = await cerebrasService.generateDreamStreamWithTimeout(
      'A brief description of a sunset',
      { maxTokens: 50, timeout: 15000 }
    );

    console.log('✅ Timeout streaming test completed');
    console.log(`   Content length: ${timeoutResult.content.length}`);
    console.log(`   Chunks: ${timeoutResult.totalChunks}`);

    // Test 4: Error handling
    console.log('\n4. Testing error handling...');
    try {
      await cerebrasService.generateDreamStreamWithTimeout(
        'Test prompt',
        { maxTokens: 10, timeout: 1 } // Very short timeout to trigger error
      );
    } catch (error) {
      const errorInfo = cerebrasService.handleStreamingError(error, {
        test: 'timeout',
      });
      console.log('✅ Error handling working correctly');
      console.log(`   Error type: ${errorInfo.type}`);
      console.log(`   Recoverable: ${errorInfo.recoverable}`);
      console.log(`   Suggestion: ${errorInfo.suggestion}`);
    }

    console.log('\n🎉 All streaming tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testStreamingFunctionality().catch(console.error);
}

module.exports = { testStreamingFunctionality };
