# Cerebras Streaming API Documentation

## Overview

The enhanced Cerebras service now supports real-time streaming responses for progressive dream generation. This allows users to see content being generated in real-time, providing a better user experience and faster perceived response times.

## Key Features

- **Real-time Progressive Generation**: Content streams as it's generated
- **Robust Error Handling**: Comprehensive error classification and recovery
- **Timeout Management**: Configurable timeouts with partial content recovery
- **Callback Support**: Flexible callback system for chunk processing
- **Connection Health Monitoring**: Built-in health checks for streaming connections

## API Methods

### `generateDreamStream(prompt, options, onChunk, onComplete, onError)`

Generates a dream with real-time streaming support and callback handling.

**Parameters:**

- `prompt` (string): The dream description to process
- `options` (object): Configuration options
  - `model` (string): Model to use (default: llama-4-maverick-17b-128e-instruct)
  - `temperature` (number): Creativity level (default: 0.6)
  - `maxTokens` (number): Maximum tokens to generate (default: 32768)
  - `topP` (number): Top-p sampling (default: 0.9)
- `onChunk` (function): Callback for each streaming chunk
- `onComplete` (function): Callback when streaming completes
- `onError` (function): Callback for error handling

**Example:**

```javascript
const result = await cerebrasService.generateDreamStream(
  'A peaceful garden with flowing water',
  { maxTokens: 1000, temperature: 0.7 },
  // onChunk
  async (chunkData) => {
    console.log('New chunk:', chunkData.content);
    console.log('Full content so far:', chunkData.fullContent);
  },
  // onComplete
  async (completeData) => {
    console.log('Stream completed:', completeData.content);
    console.log('Processing time:', completeData.processingTime);
  },
  // onError
  async (errorData) => {
    console.error('Stream error:', errorData.message);
  }
);
```

### `generateDreamStreamWithTimeout(prompt, options)`

Generates a dream with streaming and timeout protection.

**Parameters:**

- `prompt` (string): The dream description to process
- `options` (object): Configuration options including timeout

**Example:**

```javascript
try {
  const result = await cerebrasService.generateDreamStreamWithTimeout(
    'A mystical forest at twilight',
    {
      maxTokens: 2000,
      timeout: 30000, // 30 seconds
      temperature: 0.8,
    }
  );

  console.log('Generated content:', result.content);
  console.log('Total chunks:', result.totalChunks);
  console.log('Processing time:', result.processingTime);
} catch (error) {
  console.error('Generation failed:', error.message);
}
```

### `testStreamingConnection()`

Tests the streaming connection health and performance.

**Returns:**

```javascript
{
  success: boolean,
  responseTime: number,
  chunkCount: number,
  contentLength: number,
  model: string
}
```

**Example:**

```javascript
const health = await cerebrasService.testStreamingConnection();
if (health.success) {
  console.log(`Streaming healthy - ${health.responseTime}ms response time`);
} else {
  console.log('Streaming connection issues detected');
}
```

## StreamProcessor Class

Utility class for handling streaming data processing.

**Constructor Options:**

- `timeout` (number): Processing timeout in milliseconds
- `chunkSize` (number): Expected chunk size for optimization
- `onProgress` (function): Progress callback
- `onError` (function): Error callback

**Example:**

```javascript
const processor = new cerebrasService.StreamProcessor({
  timeout: 60000,
  onProgress: async (progress) => {
    console.log(
      `Progress: ${progress.chunkCount} chunks, ${progress.buffer.length} chars`
    );
  },
});

await processor.processChunk({ content: 'New content chunk' });
const result = processor.getResult();
```

## Error Handling

### Error Types

The streaming system classifies errors into specific types for better handling:

- `timeout_error`: Stream timeout occurred
- `connection_error`: Network or connection issues
- `rate_limit_error`: API rate limits exceeded
- `auth_error`: Authentication problems
- `unknown_error`: Unclassified errors

### Error Recovery

```javascript
try {
  const result = await cerebrasService.generateDreamStream(prompt, options);
} catch (error) {
  const errorInfo = cerebrasService.handleStreamingError(error, {
    context: 'dream_generation',
  });

  console.log('Error type:', errorInfo.type);
  console.log('Recoverable:', errorInfo.recoverable);
  console.log('Suggestion:', errorInfo.suggestion);

  if (errorInfo.recoverable) {
    // Implement retry logic
    setTimeout(() => retryGeneration(), 2000);
  }
}
```

## Configuration

Streaming behavior is controlled through the Cerebras configuration:

```javascript
// config/cerebras.js
module.exports = {
  streaming: {
    enabled: true, // Enable streaming by default
    chunkSize: 1024, // Expected chunk size
    timeout: 60000, // Default timeout (60 seconds)
  },
  optimization: {
    maxConcurrentRequests: 5, // Max concurrent streams
    requestQueueSize: 100, // Request queue size
    retryAttempts: 3, // Retry attempts for failed streams
    retryDelay: 1000, // Delay between retries
  },
};
```

## Integration with Express Routes

### Server-Sent Events (SSE) Example

```javascript
router.post('/dream/stream', async (req, res) => {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  await cerebrasService.generateDreamStream(
    req.body.prompt,
    req.body.options,
    // Send chunks to client
    async (chunkData) => {
      res.write(
        `data: ${JSON.stringify({
          type: 'chunk',
          content: chunkData.content,
        })}\n\n`
      );
    },
    // Send completion
    async (completeData) => {
      res.write(
        `data: ${JSON.stringify({
          type: 'complete',
          data: completeData,
        })}\n\n`
      );
      res.end();
    },
    // Handle errors
    async (errorData) => {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: errorData.message,
        })}\n\n`
      );
      res.end();
    }
  );
});
```

## Performance Considerations

1. **Memory Usage**: Streaming reduces memory footprint by processing chunks incrementally
2. **Response Time**: Users see initial content within seconds instead of waiting for complete generation
3. **Connection Management**: Built-in timeout and error recovery prevents hanging connections
4. **Concurrent Streams**: Configuration limits prevent resource exhaustion

## Best Practices

1. **Always set timeouts** to prevent hanging connections
2. **Implement proper error handling** with user-friendly fallbacks
3. **Use progress indicators** to show streaming status to users
4. **Monitor streaming health** with regular connection tests
5. **Implement retry logic** for recoverable errors
6. **Cache successful results** to avoid redundant streaming requests

## Testing

Run the streaming tests to verify functionality:

```bash
# Test streaming functionality
npm run test:streaming

# Or run directly
node tests/cerebras-streaming-test.js
```

The test suite covers:

- Basic streaming connection
- Callback functionality
- Timeout handling
- Error classification
- Performance metrics
