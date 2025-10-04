// services/mcp-gateway/config/cerebras.js
// Enhanced config for Cerebras provider with official SDK support

module.exports = {
  apiKey: process.env.CEREBRAS_API_KEY || null,
  apiUrl:
    process.env.CEREBRAS_API_URL ||
    'https://api.cerebras.ai/v1/chat/completions',
  model: process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
  defaults: {
    temperature: 0.6,
    maxTokens: 32768,
    topP: 0.9,
    n: 1,
    timeoutMs: 30000,
    stream: false,
  },
  streaming: {
    enabled: process.env.CEREBRAS_STREAMING_ENABLED === 'true' || true,
    chunkSize: 1024,
    timeout: 60000,
  },
  optimization: {
    maxConcurrentRequests: parseInt(process.env.CEREBRAS_MAX_CONCURRENT) || 5,
    requestQueueSize: parseInt(process.env.CEREBRAS_QUEUE_SIZE) || 100,
    retryAttempts: parseInt(process.env.CEREBRAS_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.CEREBRAS_RETRY_DELAY) || 1000,
    connectionPooling: {
      enabled: process.env.CEREBRAS_CONNECTION_POOLING !== 'false',
      maxConnections: parseInt(process.env.CEREBRAS_MAX_CONNECTIONS) || 10,
      connectionTimeout:
        parseInt(process.env.CEREBRAS_CONNECTION_TIMEOUT) || 30000,
      idleTimeout: parseInt(process.env.CEREBRAS_IDLE_TIMEOUT) || 60000,
    },
    requestBatching: {
      enabled: process.env.CEREBRAS_BATCHING_ENABLED !== 'false',
      batchSize: parseInt(process.env.CEREBRAS_BATCH_SIZE) || 3,
      batchTimeout: parseInt(process.env.CEREBRAS_BATCH_TIMEOUT) || 500,
      maxBatchConcurrency:
        parseInt(process.env.CEREBRAS_BATCH_CONCURRENCY) || 2,
    },
    retryStrategy: {
      exponentialBackoff: process.env.CEREBRAS_EXPONENTIAL_BACKOFF !== 'false',
      backoffMultiplier:
        parseFloat(process.env.CEREBRAS_BACKOFF_MULTIPLIER) || 2,
      maxRetryDelay: parseInt(process.env.CEREBRAS_MAX_RETRY_DELAY) || 30000,
      jitterEnabled: process.env.CEREBRAS_JITTER_ENABLED !== 'false',
    },
  },
};
