// utils/CacheServiceWrapper.js
// Enhanced cache service wrapper with circuit breaker pattern and automatic fallback

const { CacheCircuitBreaker } = require('./CircuitBreaker');
const { MockRedisClient } = require('../tests/mocks/MockRedisClient');
const {
  CacheErrorHandler,
  CACHE_ERROR_TYPES,
  ERROR_SEVERITY,
} = require('./CacheErrorHandler');
const { logger } = require('./Logger');

/**
 * CacheServiceWrapper - Wraps cache operations with circuit breaker pattern
 *
 * Features:
 * - Automatic fallback to MockRedisClient on Redis failures
 * - Circuit breaker pattern for connection failure handling
 * - Configurable timeout and retry mechanisms
 * - Comprehensive error handling and recovery
 */
class CacheServiceWrapper {
  constructor(options = {}) {
    this.options = {
      // Redis connection options
      redisUrl: options.redisUrl || process.env.REDIS_URL,
      connectionTimeout: options.connectionTimeout || 2000, // 2 seconds max for tests
      operationTimeout: options.operationTimeout || 1000, // 1 second max for tests

      // Circuit breaker options
      circuitBreakerEnabled: options.circuitBreakerEnabled !== false,
      failureThreshold: options.failureThreshold || 3,
      resetTimeout: options.resetTimeout || 10000,

      // Fallback options
      enableMockFallback: options.enableMockFallback !== false,
      mockClientConfig: options.mockClientConfig || {},

      // Retry options
      maxRetries: options.maxRetries || 2,
      retryDelay: options.retryDelay || 1000,

      ...options,
    };

    // Redis client (will be set during initialization)
    this.redisClient = null;
    this.mockClient = null;
    this.usingFallback = false;

    // Circuit breaker for Redis operations
    this.circuitBreaker = new CacheCircuitBreaker({
      name: 'RedisCache',
      failureThreshold: this.options.failureThreshold,
      resetTimeout: this.options.resetTimeout,
      operationTimeout: this.options.operationTimeout,
      fallback: this._createFallbackOperation.bind(this),
    });

    // Enhanced error handler
    this.errorHandler = new CacheErrorHandler({
      maxRetries: this.options.maxRetries,
      retryDelay: this.options.retryDelay,
      fallbackClient: null, // Will be set after mock client initialization
      circuitBreaker: this.circuitBreaker,
      enableErrorReporting: this.options.enableErrorReporting !== false,
      defaultRecoveryStrategy: 'FALLBACK',
    });

    // Statistics
    this.stats = {
      redisOperations: 0,
      mockOperations: 0,
      circuitBreakerActivations: 0,
      fallbackActivations: 0,
      connectionFailures: 0,
      operationFailures: 0,
      lastConnectionAttempt: null,
      lastSuccessfulOperation: null,
    };

    logger.debug('CacheServiceWrapper initialized', {
      config: this.options,
    });
  }

  /**
   * Initialize the cache service wrapper
   */
  async initialize() {
    try {
      await this._initializeRedisClient();

      if (this.options.enableMockFallback) {
        await this._initializeMockClient();

        // Set fallback client in error handler
        this.errorHandler.options.fallbackClient = this.mockClient;
      }

      logger.info('CacheServiceWrapper initialized successfully', {
        redisConnected: this.redisClient !== null,
        mockFallbackEnabled: this.mockClient !== null,
        errorHandlerConfigured: this.errorHandler !== null,
      });
    } catch (error) {
      logger.error('Failed to initialize CacheServiceWrapper', {
        error: error.message,
      });

      if (this.options.enableMockFallback) {
        logger.info('Falling back to mock client only');
        await this._initializeMockClient();
        this.usingFallback = true;
      } else {
        throw error;
      }
    }
  }

  /**
   * Initialize Redis client with timeout and error handling
   */
  async _initializeRedisClient() {
    if (!this.options.redisUrl) {
      logger.info('No Redis URL provided, skipping Redis initialization');
      return;
    }

    this.stats.lastConnectionAttempt = Date.now();

    try {
      // Dynamic import of redis to handle cases where it might not be available
      const redis = require('redis');

      this.redisClient = redis.createClient({
        url: this.options.redisUrl,
        socket: {
          connectTimeout: this.options.connectionTimeout,
          commandTimeout: this.options.operationTimeout,
        },
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.warn('Redis connection refused');
            return undefined; // Don't retry
          }
          if (options.total_retry_time > this.options.connectionTimeout) {
            return new Error('Retry time exhausted');
          }
          if (options.attempt > this.options.maxRetries) {
            return undefined;
          }
          return Math.min(options.attempt * this.options.retryDelay, 3000);
        },
      });

      // Set up error handlers
      this.redisClient.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.stats.connectionFailures++;
        this._handleRedisError(err);
      });

      this.redisClient.on('connect', () => {
        logger.info('Connected to Redis cache');
        this.usingFallback = false;
      });

      this.redisClient.on('disconnect', () => {
        logger.warn('Disconnected from Redis cache');
        this.usingFallback = true;
      });

      // Connect with timeout
      await Promise.race([
        this.redisClient.connect(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Redis connection timeout')),
            this.options.connectionTimeout
          )
        ),
      ]);

      // Test the connection
      await this._testRedisConnection();
    } catch (error) {
      logger.warn('Failed to initialize Redis client', {
        error: error.message,
      });

      this.redisClient = null;
      this.stats.connectionFailures++;
      throw error;
    }
  }

  /**
   * Initialize mock Redis client for fallback
   */
  async _initializeMockClient() {
    try {
      this.mockClient = new MockRedisClient({
        ...this.options.mockClientConfig,
        // Configure for test environment
        responseTimeRange: { min: 1, max: 5 },
        maxMemoryUsage: 50 * 1024 * 1024, // 50MB
      });

      await this.mockClient.connect();

      logger.debug('Mock Redis client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize mock client', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Test Redis connection with a simple operation
   */
  async _testRedisConnection() {
    if (!this.redisClient) {
      throw new Error('Redis client not initialized');
    }

    await Promise.race([
      this.redisClient.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timeout')), 2000)
      ),
    ]);
  }

  /**
   * Handle Redis errors and determine if fallback should be used
   */
  _handleRedisError(error) {
    // Connection-related errors should trigger fallback
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.message.includes('timeout')
    ) {
      if (this.options.enableMockFallback && this.mockClient) {
        logger.info('Switching to mock client due to Redis error');
        this.usingFallback = true;
        this.stats.fallbackActivations++;
      }
    }
  }

  /**
   * Create fallback operation for circuit breaker
   */
  _createFallbackOperation(operationName) {
    return async (...args) => {
      if (!this.mockClient) {
        throw new Error('No fallback client available');
      }

      logger.debug('Executing fallback operation', {
        operation: operationName,
        args: args.length,
      });

      this.stats.mockOperations++;

      // Map operation to mock client method
      if (typeof this.mockClient[operationName] === 'function') {
        return await this.mockClient[operationName](...args);
      }

      throw new Error(`Fallback operation not supported: ${operationName}`);
    };
  }

  /**
   * Execute cache operation with circuit breaker protection
   */
  async _executeWithCircuitBreaker(operationName, ...args) {
    if (!this.options.circuitBreakerEnabled) {
      return await this._executeDirectly(operationName, ...args);
    }

    try {
      return await this.circuitBreaker.execute(async () => {
        return await this._executeDirectly(operationName, ...args);
      });
    } catch (error) {
      // Use enhanced error handler for recovery
      try {
        const recoveryResult = await this.errorHandler.handleError(
          error,
          operationName,
          args[0], // First argument is usually the key
          {
            circuitBreakerState: this.circuitBreaker.getStatus().state,
            usingFallback: this.usingFallback,
          }
        );

        // If error handler returns fallback instruction
        if (recoveryResult && recoveryResult.useFallback && this.mockClient) {
          this.stats.fallbackActivations++;
          return await this.mockClient[operationName](...args);
        }

        // If error handler returns a direct result (graceful degradation)
        if (recoveryResult !== undefined && !recoveryResult.useFallback) {
          return recoveryResult;
        }

        throw error;
      } catch (handlerError) {
        // If error handler also fails, try direct fallback as last resort
        if (this.mockClient && this.options.enableMockFallback) {
          logger.warn('Error handler failed, using direct fallback', {
            operation: operationName,
            originalError: error.message,
            handlerError: handlerError.message,
          });

          this.stats.fallbackActivations++;
          return await this.mockClient[operationName](...args);
        }

        throw handlerError;
      }
    }
  }

  /**
   * Execute operation directly on Redis client
   */
  async _executeDirectly(operationName, ...args) {
    if (!this.redisClient || this.usingFallback) {
      if (this.mockClient) {
        this.stats.mockOperations++;
        return await this.mockClient[operationName](...args);
      }
      throw new Error('No Redis client available and no fallback configured');
    }

    this.stats.redisOperations++;
    this.stats.lastSuccessfulOperation = Date.now();

    return await this.redisClient[operationName](...args);
  }

  /**
   * Cache Operation Methods
   */
  async get(key) {
    return await this._executeWithCircuitBreaker('get', key);
  }

  async set(key, value, options = {}) {
    return await this._executeWithCircuitBreaker('set', key, value, options);
  }

  async setEx(key, seconds, value) {
    return await this._executeWithCircuitBreaker('setEx', key, seconds, value);
  }

  async del(key) {
    return await this._executeWithCircuitBreaker('del', key);
  }

  async exists(key) {
    return await this._executeWithCircuitBreaker('exists', key);
  }

  async expire(key, seconds) {
    return await this._executeWithCircuitBreaker('expire', key, seconds);
  }

  async ttl(key) {
    return await this._executeWithCircuitBreaker('ttl', key);
  }

  async ping() {
    return await this._executeWithCircuitBreaker('ping');
  }

  async flushAll() {
    return await this._executeWithCircuitBreaker('flushAll');
  }

  async keys(pattern) {
    return await this._executeWithCircuitBreaker('keys', pattern);
  }

  /**
   * Utility Methods
   */
  isConnected() {
    return (
      (this.redisClient && this.redisClient.isReady()) ||
      (this.mockClient && this.mockClient.isReady())
    );
  }

  isUsingFallback() {
    return this.usingFallback || !this.redisClient;
  }

  getCircuitBreakerStatus() {
    return this.circuitBreaker.getStatus();
  }

  getStats() {
    return {
      ...this.stats,
      connected: this.isConnected(),
      usingFallback: this.isUsingFallback(),
      circuitBreaker: this.getCircuitBreakerStatus(),
      errorHandler: this.errorHandler ? this.errorHandler.getStats() : null,
      redisClientStatus: this.redisClient ? 'connected' : 'disconnected',
      mockClientStatus: this.mockClient ? 'available' : 'unavailable',
    };
  }

  /**
   * Force fallback mode (for testing)
   */
  forceFallbackMode(enable = true) {
    this.usingFallback = enable;

    if (enable) {
      logger.debug('Forced fallback mode enabled');
    } else {
      logger.debug('Forced fallback mode disabled');
    }
  }

  /**
   * Reset circuit breaker and statistics
   */
  reset() {
    this.circuitBreaker.reset();
    this.stats = {
      redisOperations: 0,
      mockOperations: 0,
      circuitBreakerActivations: 0,
      fallbackActivations: 0,
      connectionFailures: 0,
      operationFailures: 0,
      lastConnectionAttempt: null,
      lastSuccessfulOperation: null,
    };

    logger.info('CacheServiceWrapper reset completed');
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.redisClient) {
        await this.redisClient.disconnect();
        this.redisClient = null;
      }

      if (this.mockClient) {
        await this.mockClient.disconnect();
        this.mockClient = null;
      }

      logger.info('CacheServiceWrapper cleanup completed');
    } catch (error) {
      logger.error('Error during CacheServiceWrapper cleanup', {
        error: error.message,
      });
    }
  }
}

module.exports = {
  CacheServiceWrapper,
};
