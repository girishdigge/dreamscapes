// services/mcp-gateway/services/cerebrasService.js
// Enhanced Cerebras service using official SDK with streaming support, connection pooling, and request optimization

const { Cerebras } = require('@cerebras/cerebras_cloud_sdk');
const axios = require('axios');
const config = require('../config/cerebras');

// Connection pool and request optimization
class CerebrasConnectionPool {
  constructor(options = {}) {
    this.maxConnections =
      options.maxConnections || config.optimization.maxConcurrentRequests;
    this.requestQueue = [];
    this.activeConnections = 0;
    this.clients = new Map();
    this.connectionStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      queuedRequests: 0,
    };
    this.retryConfig = {
      maxAttempts: config.optimization.retryAttempts,
      baseDelay: config.optimization.retryDelay,
      maxDelay: 30000,
      backoffMultiplier: 2,
    };
  }

  // Get or create a client instance
  getClient(clientId = 'default') {
    if (!this.clients.has(clientId)) {
      if (!config.apiKey) {
        throw new Error('Cerebras API key not configured');
      }

      const client = new Cerebras({
        apiKey: config.apiKey,
        timeout: config.defaults.timeoutMs,
      });

      this.clients.set(clientId, client);
    }

    return this.clients.get(clientId);
  }

  // Execute request with connection pooling
  async executeRequest(requestFn, options = {}) {
    return new Promise((resolve, reject) => {
      const request = {
        fn: requestFn,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
      };

      if (this.activeConnections < this.maxConnections) {
        this._processRequest(request);
      } else {
        this.requestQueue.push(request);
        this.connectionStats.queuedRequests++;
      }
    });
  }

  // Process individual request with retry logic
  async _processRequest(request) {
    this.activeConnections++;
    this.connectionStats.totalRequests++;
    const startTime = Date.now();

    try {
      const result = await this._executeWithRetry(request);

      // Update stats
      const responseTime = Date.now() - startTime;
      this.connectionStats.successfulRequests++;
      this._updateAverageResponseTime(responseTime);

      request.resolve(result);
    } catch (error) {
      this.connectionStats.failedRequests++;
      request.reject(error);
    } finally {
      this.activeConnections--;
      this._processNextInQueue();
    }
  }

  // Execute request with exponential backoff retry
  async _executeWithRetry(request) {
    let lastError;

    for (let attempt = 0; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(
            this.retryConfig.baseDelay *
              Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
            this.retryConfig.maxDelay
          );
          await this._sleep(delay);
        }

        const client = this.getClient(request.options.clientId);
        return await request.fn(client);
      } catch (error) {
        lastError = error;

        // Don't retry on authentication or client errors
        if (this._isNonRetryableError(error)) {
          break;
        }

        // Don't retry on last attempt
        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }

        console.warn(
          `Cerebras request attempt ${attempt + 1} failed: ${error.message}`
        );
      }
    }

    throw new Error(
      `Cerebras request failed after ${
        this.retryConfig.maxAttempts + 1
      } attempts: ${lastError.message}`
    );
  }

  // Check if error should not be retried
  _isNonRetryableError(error) {
    if (!error || !error.message) {
      return false;
    }

    const message = error.message.toLowerCase();

    // Check for authentication errors
    if (message.includes('authentication')) return true;
    if (message.includes('unauthorized')) return true;
    if (message.includes('invalid api key')) return true;
    if (message.includes('bad request')) return true;

    // Check for HTTP client errors (except rate limiting)
    if (
      error.status &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 429
    ) {
      return true;
    }

    // All other errors are retryable
    return false;
  }

  // Process next request in queue
  _processNextInQueue() {
    if (
      this.requestQueue.length > 0 &&
      this.activeConnections < this.maxConnections
    ) {
      const nextRequest = this.requestQueue.shift();
      this.connectionStats.queuedRequests--;
      this._processRequest(nextRequest);
    }
  }

  // Update average response time
  _updateAverageResponseTime(responseTime) {
    const totalRequests = this.connectionStats.successfulRequests;
    const currentAverage = this.connectionStats.averageResponseTime;
    this.connectionStats.averageResponseTime =
      (currentAverage * (totalRequests - 1) + responseTime) / totalRequests;
  }

  // Sleep utility for retry delays
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Get connection pool statistics
  getStats() {
    return {
      ...this.connectionStats,
      activeConnections: this.activeConnections,
      queueLength: this.requestQueue.length,
      maxConnections: this.maxConnections,
      clientCount: this.clients.size,
    };
  }

  // Reset statistics
  resetStats() {
    this.connectionStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      queuedRequests: 0,
    };
  }

  // Cleanup connections
  cleanup() {
    this.clients.clear();
    this.requestQueue = [];
    this.activeConnections = 0;
  }
}

// Request batching system
class RequestBatcher {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 5;
    this.batchTimeout = options.batchTimeout || 1000;
    this.pendingRequests = [];
    this.batchTimer = null;
  }

  // Add request to batch
  async addRequest(requestData) {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({
        ...requestData,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Process batch if it's full
      if (this.pendingRequests.length >= this.batchSize) {
        this._processBatch();
      } else if (!this.batchTimer) {
        // Set timer for partial batch
        this.batchTimer = setTimeout(() => {
          this._processBatch();
        }, this.batchTimeout);
      }
    });
  }

  // Process current batch
  async _processBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.pendingRequests.length === 0) {
      return;
    }

    const batch = this.pendingRequests.splice(0);

    try {
      // Process requests concurrently within the batch
      const results = await Promise.allSettled(
        batch.map(async (request) => {
          try {
            const result = await connectionPool.executeRequest(
              request.requestFn,
              request.options
            );
            request.resolve(result);
            return { success: true, result };
          } catch (error) {
            request.reject(error);
            return { success: false, error };
          }
        })
      );

      console.log(
        `Processed batch of ${batch.length} requests: ${
          results.filter((r) => r.value?.success).length
        } successful`
      );
    } catch (error) {
      // Reject all requests in batch on critical error
      batch.forEach((request) => request.reject(error));
    }
  }

  // Get batch statistics
  getStats() {
    return {
      pendingRequests: this.pendingRequests.length,
      batchSize: this.batchSize,
      batchTimeout: this.batchTimeout,
      hasActiveBatch: !!this.batchTimer,
    };
  }
}

// Global instances
const connectionPool = new CerebrasConnectionPool();
const requestBatcher = new RequestBatcher({
  batchSize: 3,
  batchTimeout: 500,
});

// Initialize Cerebras client (legacy compatibility)
let cerebrasClient = null;

function initializeCerebrasClient() {
  return connectionPool.getClient('default');
}

async function callCerebras(prompt, options = {}) {
  const requestFn = async (client) => {
    const chatParams = {
      model: options.model || config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? config.defaults.temperature,
      max_completion_tokens: options.maxTokens ?? config.defaults.maxTokens,
      top_p: options.topP ?? config.defaults.topP,
      stream: options.stream ?? config.defaults.stream,
    };

    const response = await client.chat.completions.create(chatParams);

    // Return in consistent format
    return {
      choices: response.choices,
      usage: response.usage,
      model: response.model,
      id: response.id,
      created: response.created,
    };
  };

  try {
    // Use connection pool for optimized request handling
    return await connectionPool.executeRequest(requestFn, {
      clientId: options.clientId || 'default',
      priority: options.priority || 'normal',
    });
  } catch (error) {
    throw new Error(`Cerebras API call failed: ${error.message}`);
  }
}

async function callCerebrasStream(prompt, options = {}) {
  const requestFn = async (client) => {
    const chatParams = {
      model: options.model || config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? config.defaults.temperature,
      max_completion_tokens: options.maxTokens ?? config.defaults.maxTokens,
      top_p: options.topP ?? config.defaults.topP,
      stream: true,
    };

    return await client.chat.completions.create(chatParams);
  };

  try {
    // Use connection pool for streaming requests
    return await connectionPool.executeRequest(requestFn, {
      clientId: options.clientId || 'streaming',
      priority: options.priority || 'high', // Streaming gets higher priority
    });
  } catch (error) {
    throw new Error(`Cerebras streaming call failed: ${error.message}`);
  }
}

// Enhanced streaming with proper response handling and error management
async function generateDreamStream(
  prompt,
  options = {},
  onChunk = null,
  onComplete = null,
  onError = null
) {
  const requestFn = async (client) => {
    const chatParams = {
      model: options.model || config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? config.defaults.temperature,
      max_completion_tokens: options.maxTokens ?? config.defaults.maxTokens,
      top_p: options.topP ?? config.defaults.topP,
      stream: true,
    };

    return await client.chat.completions.create(chatParams);
  };

  try {
    // Use connection pool for streaming with high priority
    const stream = await connectionPool.executeRequest(requestFn, {
      clientId: options.clientId || 'streaming',
      priority: 'high',
    });

    let fullContent = '';
    let chunkCount = 0;
    const startTime = Date.now();

    try {
      for await (const chunk of stream) {
        chunkCount++;

        // Handle streaming chunk
        if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
          const delta = chunk.choices[0].delta;

          if (delta.content) {
            fullContent += delta.content;

            // Call chunk callback if provided
            if (onChunk && typeof onChunk === 'function') {
              try {
                await onChunk({
                  content: delta.content,
                  fullContent: fullContent,
                  chunkIndex: chunkCount,
                  timestamp: Date.now(),
                  isComplete: false,
                });
              } catch (callbackError) {
                console.warn(
                  'Stream chunk callback error:',
                  callbackError.message
                );
              }
            }
          }

          // Check if stream is complete
          if (chunk.choices[0].finish_reason) {
            const processingTime = Date.now() - startTime;

            const completeResponse = {
              content: fullContent,
              finishReason: chunk.choices[0].finish_reason,
              chunkCount: chunkCount,
              processingTime: processingTime,
              usage: chunk.usage || null,
              model: chunk.model || chatParams.model,
              isComplete: true,
            };

            // Call completion callback if provided
            if (onComplete && typeof onComplete === 'function') {
              try {
                await onComplete(completeResponse);
              } catch (callbackError) {
                console.warn(
                  'Stream completion callback error:',
                  callbackError.message
                );
              }
            }

            return completeResponse;
          }
        }
      }
    } catch (streamError) {
      const errorInfo = {
        error: streamError,
        message: streamError.message,
        chunkCount: chunkCount,
        partialContent: fullContent,
        processingTime: Date.now() - startTime,
      };

      // Call error callback if provided
      if (onError && typeof onError === 'function') {
        try {
          await onError(errorInfo);
        } catch (callbackError) {
          console.warn('Stream error callback error:', callbackError.message);
        }
      }

      throw new Error(`Stream processing failed: ${streamError.message}`);
    }
  } catch (error) {
    const errorInfo = {
      error: error,
      message: error.message,
      stage: 'initialization',
    };

    // Call error callback if provided
    if (onError && typeof onError === 'function') {
      try {
        await onError(errorInfo);
      } catch (callbackError) {
        console.warn(
          'Stream initialization error callback error:',
          callbackError.message
        );
      }
    }

    throw new Error(
      `Cerebras streaming initialization failed: ${error.message}`
    );
  }
}

// Stream processing utility for handling partial responses
class StreamProcessor {
  constructor(options = {}) {
    this.buffer = '';
    this.chunks = [];
    this.startTime = Date.now();
    this.timeout = options.timeout || config.streaming.timeout;
    this.chunkSize = options.chunkSize || config.streaming.chunkSize;
    this.onProgress = options.onProgress || null;
    this.onError = options.onError || null;
  }

  async processChunk(chunk) {
    try {
      this.chunks.push({
        content: chunk.content || '',
        timestamp: Date.now(),
        index: this.chunks.length,
      });

      this.buffer += chunk.content || '';

      // Call progress callback
      if (this.onProgress && typeof this.onProgress === 'function') {
        await this.onProgress({
          buffer: this.buffer,
          chunkCount: this.chunks.length,
          latestChunk: chunk,
          processingTime: Date.now() - this.startTime,
        });
      }

      return {
        success: true,
        buffer: this.buffer,
        chunkCount: this.chunks.length,
      };
    } catch (error) {
      if (this.onError && typeof this.onError === 'function') {
        await this.onError({
          error: error,
          message: error.message,
          chunk: chunk,
          buffer: this.buffer,
        });
      }
      throw error;
    }
  }

  getResult() {
    return {
      content: this.buffer,
      chunks: this.chunks,
      totalChunks: this.chunks.length,
      processingTime: Date.now() - this.startTime,
      averageChunkSize: this.buffer.length / Math.max(this.chunks.length, 1),
    };
  }

  reset() {
    this.buffer = '';
    this.chunks = [];
    this.startTime = Date.now();
  }
}

// Enhanced streaming with timeout and error recovery
async function generateDreamStreamWithTimeout(prompt, options = {}) {
  const timeout = options.timeout || config.streaming.timeout;
  const processor = new StreamProcessor(options);

  return new Promise(async (resolve, reject) => {
    let timeoutId;
    let streamCompleted = false;

    // Set up timeout
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        if (!streamCompleted) {
          streamCompleted = true;
          const partialResult = processor.getResult();
          reject(
            new Error(
              `Stream timeout after ${timeout}ms. Partial content: ${partialResult.content.substring(
                0,
                200
              )}...`
            )
          );
        }
      }, timeout);
    }

    try {
      const result = await generateDreamStream(
        prompt,
        options,
        // onChunk callback
        async (chunkData) => {
          if (!streamCompleted) {
            await processor.processChunk(chunkData);
          }
        },
        // onComplete callback
        async (completeData) => {
          if (!streamCompleted) {
            streamCompleted = true;
            if (timeoutId) clearTimeout(timeoutId);

            const finalResult = {
              ...completeData,
              ...processor.getResult(),
            };

            resolve(finalResult);
          }
        },
        // onError callback
        async (errorData) => {
          if (!streamCompleted) {
            streamCompleted = true;
            if (timeoutId) clearTimeout(timeoutId);

            const partialResult = processor.getResult();
            reject(
              new Error(
                `${errorData.message}. Partial content available: ${partialResult.content.length} characters`
              )
            );
          }
        }
      );
    } catch (error) {
      if (!streamCompleted) {
        streamCompleted = true;
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      }
    }
  });
}

async function testConnection() {
  if (!config.apiKey) {
    throw new Error('Cerebras API key not configured');
  }

  const requestFn = async (client) => {
    return await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: 'test' }],
      max_completion_tokens: 1,
      temperature: 0.1,
    });
  };

  try {
    const response = await connectionPool.executeRequest(requestFn, {
      clientId: 'test',
      priority: 'high',
    });

    return response && response.choices && response.choices.length > 0;
  } catch (error) {
    throw new Error(`Cerebras connection test failed: ${error.message}`);
  }
}

async function generateDream(prompt, options = {}) {
  const enhancedOptions = {
    ...options,
    model: options.model || config.model,
    temperature: options.temperature ?? config.defaults.temperature,
    maxTokens: options.maxTokens ?? config.defaults.maxTokens,
    topP: options.topP ?? config.defaults.topP,
  };

  // Use streaming if explicitly requested or enabled by default
  if (
    options.stream === true ||
    (options.stream !== false && config.streaming.enabled)
  ) {
    // Use timeout-enabled streaming for better reliability
    return await generateDreamStreamWithTimeout(prompt, enhancedOptions);
  }

  return await callCerebras(prompt, enhancedOptions);
}

async function patchDream(prompt, baseJson, options = {}) {
  const contextualPrompt = `${prompt}\n\nBase content to modify:\n${JSON.stringify(
    baseJson,
    null,
    2
  )}`;
  return await callCerebras(contextualPrompt, options);
}

async function enrichStyle(prompt, baseJson, options = {}) {
  const stylePrompt = `Enhance the visual style and details for: ${prompt}\n\nCurrent content:\n${JSON.stringify(
    baseJson,
    null,
    2
  )}`;
  return await callCerebras(stylePrompt, options);
}

async function pingUrl(url) {
  try {
    const response = await axios.get(`${url}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    throw new Error(`Ping failed: ${error.message}`);
  }
}

// Enhanced methods for better integration
async function generateDreamWithContext(prompt, context = {}, options = {}) {
  const contextualPrompt = buildContextualPrompt(prompt, context);
  return await generateDream(contextualPrompt, options);
}

function buildContextualPrompt(prompt, context) {
  let contextualPrompt = prompt;

  if (context.style) {
    contextualPrompt += `\n\nStyle preference: ${context.style}`;
  }

  if (context.previousDreams && context.previousDreams.length > 0) {
    contextualPrompt += `\n\nRelated previous dreams for context:\n${context.previousDreams
      .map((d) => d.title || d.description)
      .join('\n')}`;
  }

  if (context.quality) {
    contextualPrompt += `\n\nTarget quality level: ${context.quality}`;
  }

  return contextualPrompt;
}

async function getModelInfo() {
  return {
    model: config.model,
    maxTokens: config.defaults.maxTokens,
    temperature: config.defaults.temperature,
    topP: config.defaults.topP,
    streamingSupported: config.streaming.enabled,
    streamingTimeout: config.streaming.timeout,
    streamingChunkSize: config.streaming.chunkSize,
  };
}

// Stream connection health check
async function testStreamingConnection() {
  try {
    const testPrompt = 'Test streaming connection';
    const startTime = Date.now();

    const result = await generateDreamStreamWithTimeout(testPrompt, {
      maxTokens: 10,
      temperature: 0.1,
      timeout: 10000,
    });

    const responseTime = Date.now() - startTime;

    return {
      success: true,
      responseTime: responseTime,
      chunkCount: result.chunkCount || 0,
      contentLength: result.content ? result.content.length : 0,
      model: result.model,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      responseTime: null,
    };
  }
}

// Enhanced error handling for streaming connections
function handleStreamingError(error, context = {}) {
  const errorInfo = {
    message: error.message,
    type: 'streaming_error',
    timestamp: Date.now(),
    context: context,
  };

  // Classify error types for better handling
  if (error.message.includes('timeout')) {
    errorInfo.type = 'timeout_error';
    errorInfo.recoverable = true;
    errorInfo.suggestion =
      'Retry with increased timeout or use non-streaming mode';
  } else if (error.message.includes('connection')) {
    errorInfo.type = 'connection_error';
    errorInfo.recoverable = true;
    errorInfo.suggestion = 'Check network connectivity and API status';
  } else if (error.message.includes('rate limit')) {
    errorInfo.type = 'rate_limit_error';
    errorInfo.recoverable = true;
    errorInfo.suggestion = 'Implement exponential backoff and retry';
  } else if (error.message.includes('authentication')) {
    errorInfo.type = 'auth_error';
    errorInfo.recoverable = false;
    errorInfo.suggestion = 'Check API key configuration';
  } else {
    errorInfo.type = 'unknown_error';
    errorInfo.recoverable = false;
    errorInfo.suggestion = 'Review error details and contact support if needed';
  }

  return errorInfo;
}

// Batch processing functions
async function processBatchRequests(requests, options = {}) {
  const batchOptions = {
    batchSize: options.batchSize || 3,
    batchTimeout: options.batchTimeout || 500,
    concurrency: options.concurrency || 2,
  };

  const results = [];
  const errors = [];

  // Process requests in batches
  for (let i = 0; i < requests.length; i += batchOptions.batchSize) {
    const batch = requests.slice(i, i + batchOptions.batchSize);

    try {
      const batchResults = await Promise.allSettled(
        batch.map(async (request, index) => {
          try {
            const result = await requestBatcher.addRequest({
              requestFn: async (client) => {
                return await callCerebras(request.prompt, {
                  ...request.options,
                  clientId: `batch-${i}-${index}`,
                });
              },
              options: {
                clientId: `batch-${i}-${index}`,
                priority: request.priority || 'normal',
              },
            });

            return {
              success: true,
              index: i + index,
              result,
              request: request,
            };
          } catch (error) {
            return {
              success: false,
              index: i + index,
              error: error.message,
              request: request,
            };
          }
        })
      );

      // Collect results and errors
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            results.push(result.value);
          } else {
            errors.push(result.value);
          }
        } else {
          errors.push({
            success: false,
            index: i,
            error: result.reason.message,
            request: batch[0], // Fallback request info
          });
        }
      });

      // Add delay between batches to avoid rate limiting
      if (i + batchOptions.batchSize < requests.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, batchOptions.batchTimeout)
        );
      }
    } catch (error) {
      // Handle batch-level errors
      batch.forEach((request, index) => {
        errors.push({
          success: false,
          index: i + index,
          error: error.message,
          request: request,
        });
      });
    }
  }

  return {
    results: results.sort((a, b) => a.index - b.index),
    errors: errors.sort((a, b) => a.index - b.index),
    totalRequests: requests.length,
    successfulRequests: results.length,
    failedRequests: errors.length,
    successRate: (results.length / requests.length) * 100,
  };
}

// Connection pool management functions
async function getConnectionPoolStats() {
  return connectionPool.getStats();
}

async function resetConnectionPool() {
  connectionPool.resetStats();
  return { success: true, message: 'Connection pool statistics reset' };
}

async function cleanupConnections() {
  connectionPool.cleanup();
  return { success: true, message: 'Connection pool cleaned up' };
}

// Request batching management functions
async function getBatcherStats() {
  return requestBatcher.getStats();
}

// Enhanced timeout and retry configuration
async function updateRetryConfig(newConfig = {}) {
  const currentConfig = connectionPool.retryConfig;

  connectionPool.retryConfig = {
    ...currentConfig,
    ...newConfig,
  };

  return {
    success: true,
    message: 'Retry configuration updated',
    config: connectionPool.retryConfig,
  };
}

// Performance monitoring
async function getPerformanceMetrics() {
  const poolStats = connectionPool.getStats();
  const batcherStats = requestBatcher.getStats();

  return {
    connectionPool: poolStats,
    requestBatcher: batcherStats,
    timestamp: Date.now(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };
}

// Health check with connection pool validation
async function healthCheck() {
  try {
    const connectionTest = await testConnection();
    const streamingTest = await testStreamingConnection();
    const poolStats = connectionPool.getStats();

    return {
      success: true,
      connection: connectionTest,
      streaming: streamingTest.success,
      connectionPool: {
        healthy: poolStats.activeConnections <= poolStats.maxConnections,
        stats: poolStats,
      },
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: Date.now(),
    };
  }
}

module.exports = {
  // Core API functions
  callCerebras,
  callCerebrasStream,
  testConnection,
  generateDream,
  generateDreamWithContext,
  generateDreamStream,
  generateDreamStreamWithTimeout,
  patchDream,
  enrichStyle,
  pingUrl,
  getModelInfo,
  testStreamingConnection,
  handleStreamingError,
  initializeCerebrasClient,
  StreamProcessor,

  // Connection pooling and optimization
  processBatchRequests,
  getConnectionPoolStats,
  resetConnectionPool,
  cleanupConnections,
  getBatcherStats,
  updateRetryConfig,
  getPerformanceMetrics,
  healthCheck,

  // Direct access to pool and batcher (for advanced usage)
  connectionPool,
  requestBatcher,
};
