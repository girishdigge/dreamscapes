// utils/RequestQueue.js
// Request queuing system for better resource management

const EventEmitter = require('events');

/**
 * Request Queue Manager
 * Handles request queuing, rate limiting, and resource management
 */
class RequestQueue extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      maxConcurrentRequests: config.maxConcurrentRequests || 10,
      maxQueueSize: config.maxQueueSize || 100,
      requestTimeout: config.requestTimeout || 30000,
      priorityLevels: config.priorityLevels || [
        'low',
        'normal',
        'high',
        'critical',
      ],
      enablePriorityQueuing: config.enablePriorityQueuing !== false,
      enableAdaptiveThrottling: config.enableAdaptiveThrottling !== false,
      ...config,
    };

    // Queue management
    this.queues = new Map(); // priority -> queue array
    this.activeRequests = new Map(); // requestId -> request info
    this.requestHistory = [];
    this.maxHistorySize = 1000;

    // Rate limiting
    this.rateLimiter = new Map(); // provider -> rate limit data
    this.globalRateLimit = {
      requests: 0,
      windowStart: Date.now(),
      windowSize: 60000, // 1 minute
      maxRequests: config.globalMaxRequestsPerMinute || 200,
    };

    // Performance tracking
    this.metrics = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      queuedRequests: 0,
      avgWaitTime: 0,
      avgProcessingTime: 0,
      totalWaitTime: 0,
      totalProcessingTime: 0,
      peakQueueSize: 0,
      currentQueueSize: 0,
    };

    // Initialize priority queues
    this.initializePriorityQueues();

    // Start queue processing
    this.startQueueProcessor();

    console.log('RequestQueue initialized with config:', this.config);
  }

  /**
   * Initialize priority queues
   * @private
   */
  initializePriorityQueues() {
    if (this.config.enablePriorityQueuing) {
      this.config.priorityLevels.forEach((level) => {
        this.queues.set(level, []);
      });
    } else {
      this.queues.set('default', []);
    }
  }

  /**
   * Add request to queue
   * @param {Function} operation - Operation to execute
   * @param {Object} options - Request options
   * @returns {Promise} Request promise
   */
  async enqueue(operation, options = {}) {
    const requestId = this.generateRequestId();
    const priority = this.validatePriority(options.priority || 'normal');
    const provider = options.provider || 'default';
    const timeout = options.timeout || this.config.requestTimeout;

    // Check global rate limit
    if (!this.checkGlobalRateLimit()) {
      throw new Error('Global rate limit exceeded');
    }

    // Check provider-specific rate limit
    if (!this.checkProviderRateLimit(provider, options.rateLimitConfig)) {
      throw new Error(`Rate limit exceeded for provider: ${provider}`);
    }

    // Check queue capacity
    const totalQueueSize = this.getTotalQueueSize();
    if (totalQueueSize >= this.config.maxQueueSize) {
      throw new Error('Request queue is full');
    }

    // Create request object
    const request = {
      id: requestId,
      operation,
      options,
      priority,
      provider,
      timeout,
      queuedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      promise: null,
      resolve: null,
      reject: null,
      timeoutHandle: null,
      metadata: {
        retryCount: 0,
        originalPriority: priority,
        ...options.metadata,
      },
    };

    // Create promise for the request
    request.promise = new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });

    // Set timeout
    request.timeoutHandle = setTimeout(() => {
      this.handleRequestTimeout(request);
    }, timeout);

    // Add to appropriate queue
    const queue = this.queues.get(priority) || this.queues.get('default');
    queue.push(request);

    // Update metrics
    this.metrics.totalRequests++;
    this.metrics.queuedRequests++;
    this.updateQueueMetrics();

    console.log(
      `Request queued: ${requestId} (priority: ${priority}, provider: ${provider})`
    );
    this.emit('requestQueued', {
      requestId,
      priority,
      provider,
      queueSize: totalQueueSize + 1,
    });

    return request.promise;
  }

  /**
   * Process queued requests
   * @private
   */
  async processQueue() {
    // Check if we can process more requests
    if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
      return;
    }

    // Get next request based on priority
    const request = this.getNextRequest();
    if (!request) {
      return;
    }

    // Move request to active
    this.activeRequests.set(request.id, request);
    request.startedAt = Date.now();

    // Update metrics
    this.metrics.queuedRequests--;
    const waitTime = request.startedAt - request.queuedAt;
    this.metrics.totalWaitTime += waitTime;
    this.metrics.avgWaitTime =
      this.metrics.totalWaitTime / this.metrics.totalRequests;

    console.log(`Processing request: ${request.id} (waited: ${waitTime}ms)`);
    this.emit('requestStarted', {
      requestId: request.id,
      waitTime,
      activeRequests: this.activeRequests.size,
    });

    try {
      // Execute the operation
      const result = await request.operation();

      // Request completed successfully
      this.handleRequestSuccess(request, result);
    } catch (error) {
      // Request failed
      this.handleRequestFailure(request, error);
    }
  }

  /**
   * Handle successful request completion
   * @private
   */
  handleRequestSuccess(request, result) {
    request.completedAt = Date.now();
    const processingTime = request.completedAt - request.startedAt;

    // Clear timeout
    if (request.timeoutHandle) {
      clearTimeout(request.timeoutHandle);
    }

    // Update metrics
    this.metrics.completedRequests++;
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.avgProcessingTime =
      this.metrics.totalProcessingTime / this.metrics.completedRequests;

    // Add to history
    this.addToHistory(request, 'success', processingTime);

    // Remove from active requests
    this.activeRequests.delete(request.id);

    // Update rate limiter
    this.updateRateLimit(request.provider);

    console.log(
      `Request completed: ${request.id} (processing: ${processingTime}ms)`
    );
    this.emit('requestCompleted', {
      requestId: request.id,
      processingTime,
      activeRequests: this.activeRequests.size,
    });

    // Resolve the promise
    request.resolve(result);

    // Process next request
    setImmediate(() => this.processQueue());
  }

  /**
   * Handle failed request
   * @private
   */
  handleRequestFailure(request, error) {
    request.completedAt = Date.now();
    const processingTime = request.completedAt - request.startedAt;

    // Clear timeout
    if (request.timeoutHandle) {
      clearTimeout(request.timeoutHandle);
    }

    // Update metrics
    this.metrics.failedRequests++;

    // Add to history
    this.addToHistory(request, 'failure', processingTime, error.message);

    // Remove from active requests
    this.activeRequests.delete(request.id);

    console.error(
      `Request failed: ${request.id} (processing: ${processingTime}ms):`,
      error.message
    );
    this.emit('requestFailed', {
      requestId: request.id,
      error: error.message,
      processingTime,
      activeRequests: this.activeRequests.size,
    });

    // Reject the promise
    request.reject(error);

    // Process next request
    setImmediate(() => this.processQueue());
  }

  /**
   * Handle request timeout
   * @private
   */
  handleRequestTimeout(request) {
    if (!this.activeRequests.has(request.id)) {
      // Request not active, might be in queue
      this.removeFromQueue(request);
    } else {
      // Request is active, mark as timed out
      this.activeRequests.delete(request.id);
    }

    // Update metrics
    this.metrics.timeoutRequests++;
    this.metrics.failedRequests++;

    // Add to history
    this.addToHistory(request, 'timeout', Date.now() - request.startedAt);

    console.warn(`Request timed out: ${request.id}`);
    this.emit('requestTimeout', { requestId: request.id });

    // Reject the promise
    request.reject(new Error(`Request timed out after ${request.timeout}ms`));

    // Process next request
    setImmediate(() => this.processQueue());
  }

  /**
   * Get next request from queues based on priority
   * @private
   */
  getNextRequest() {
    if (this.config.enablePriorityQueuing) {
      // Process by priority order (reverse to get highest priority first)
      for (let i = this.config.priorityLevels.length - 1; i >= 0; i--) {
        const priority = this.config.priorityLevels[i];
        const queue = this.queues.get(priority);
        if (queue && queue.length > 0) {
          return queue.shift();
        }
      }
    } else {
      const queue = this.queues.get('default');
      if (queue && queue.length > 0) {
        return queue.shift();
      }
    }

    return null;
  }

  /**
   * Remove request from queue
   * @private
   */
  removeFromQueue(request) {
    const queue =
      this.queues.get(request.priority) || this.queues.get('default');
    const index = queue.findIndex((r) => r.id === request.id);
    if (index !== -1) {
      queue.splice(index, 1);
      this.metrics.queuedRequests--;
    }
  }

  /**
   * Check global rate limit
   * @private
   */
  checkGlobalRateLimit() {
    const now = Date.now();

    // Reset window if needed
    if (
      now - this.globalRateLimit.windowStart >=
      this.globalRateLimit.windowSize
    ) {
      this.globalRateLimit.requests = 0;
      this.globalRateLimit.windowStart = now;
    }

    // Check if under limit
    if (this.globalRateLimit.requests >= this.globalRateLimit.maxRequests) {
      return false;
    }

    this.globalRateLimit.requests++;
    return true;
  }

  /**
   * Check provider-specific rate limit
   * @private
   */
  checkProviderRateLimit(provider, rateLimitConfig = {}) {
    if (!this.rateLimiter.has(provider)) {
      this.rateLimiter.set(provider, {
        requests: 0,
        windowStart: Date.now(),
        windowSize: rateLimitConfig.windowSize || 60000,
        maxRequests: rateLimitConfig.maxRequests || 100,
      });
    }

    const limit = this.rateLimiter.get(provider);
    const now = Date.now();

    // Reset window if needed
    if (now - limit.windowStart >= limit.windowSize) {
      limit.requests = 0;
      limit.windowStart = now;
    }

    // Check if under limit
    if (limit.requests >= limit.maxRequests) {
      return false;
    }

    limit.requests++;
    return true;
  }

  /**
   * Update rate limit tracking
   * @private
   */
  updateRateLimit(provider) {
    // Rate limit is already updated in checkProviderRateLimit
    // This method can be used for additional tracking if needed
  }

  /**
   * Get total queue size across all priorities
   * @private
   */
  getTotalQueueSize() {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Update queue metrics
   * @private
   */
  updateQueueMetrics() {
    const currentSize = this.getTotalQueueSize();
    this.metrics.currentQueueSize = currentSize;
    if (currentSize > this.metrics.peakQueueSize) {
      this.metrics.peakQueueSize = currentSize;
    }
  }

  /**
   * Add request to history
   * @private
   */
  addToHistory(request, status, processingTime, error = null) {
    const historyEntry = {
      id: request.id,
      provider: request.provider,
      priority: request.priority,
      status,
      queuedAt: request.queuedAt,
      startedAt: request.startedAt,
      completedAt: request.completedAt,
      waitTime: request.startedAt - request.queuedAt,
      processingTime,
      error,
      timestamp: Date.now(),
    };

    this.requestHistory.push(historyEntry);

    // Trim history if too large
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.shift();
    }
  }

  /**
   * Validate priority level
   * @private
   */
  validatePriority(priority) {
    if (this.config.enablePriorityQueuing) {
      return this.config.priorityLevels.includes(priority)
        ? priority
        : 'normal';
    }
    return 'default';
  }

  /**
   * Generate unique request ID
   * @private
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start queue processor
   * @private
   */
  startQueueProcessor() {
    // Process queue every 10ms
    this.processorInterval = setInterval(() => {
      this.processQueue();
    }, 10);

    console.log('Queue processor started');
  }

  /**
   * Stop queue processor
   */
  stopQueueProcessor() {
    if (this.processorInterval) {
      clearInterval(this.processorInterval);
      this.processorInterval = null;
      console.log('Queue processor stopped');
    }
  }

  /**
   * Get queue status
   * @returns {Object} Queue status information
   */
  getStatus() {
    return {
      config: this.config,
      metrics: { ...this.metrics },
      queues: Object.fromEntries(
        Array.from(this.queues.entries()).map(([priority, queue]) => [
          priority,
          {
            size: queue.length,
            requests: queue.map((r) => ({ id: r.id, queuedAt: r.queuedAt })),
          },
        ])
      ),
      activeRequests: Array.from(this.activeRequests.values()).map((r) => ({
        id: r.id,
        provider: r.provider,
        priority: r.priority,
        startedAt: r.startedAt,
        runningTime: Date.now() - r.startedAt,
      })),
      rateLimits: Object.fromEntries(this.rateLimiter.entries()),
      globalRateLimit: { ...this.globalRateLimit },
    };
  }

  /**
   * Get performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueUtilization:
        this.metrics.currentQueueSize / this.config.maxQueueSize,
      concurrencyUtilization:
        this.activeRequests.size / this.config.maxConcurrentRequests,
      successRate:
        this.metrics.totalRequests > 0
          ? this.metrics.completedRequests / this.metrics.totalRequests
          : 0,
      failureRate:
        this.metrics.totalRequests > 0
          ? this.metrics.failedRequests / this.metrics.totalRequests
          : 0,
      timeoutRate:
        this.metrics.totalRequests > 0
          ? this.metrics.timeoutRequests / this.metrics.totalRequests
          : 0,
    };
  }

  /**
   * Clear all queues and active requests
   */
  clear() {
    // Clear all queues
    for (const queue of this.queues.values()) {
      queue.forEach((request) => {
        if (request.timeoutHandle) {
          clearTimeout(request.timeoutHandle);
        }
        // Only reject if the request hasn't been resolved/rejected already
        if (request.reject && typeof request.reject === 'function') {
          try {
            request.reject(new Error('Queue cleared'));
          } catch (error) {
            // Ignore errors from already resolved/rejected promises
          }
        }
      });
      queue.length = 0;
    }

    // Clear active requests
    for (const request of this.activeRequests.values()) {
      if (request.timeoutHandle) {
        clearTimeout(request.timeoutHandle);
      }
      // Only reject if the request hasn't been resolved/rejected already
      if (request.reject && typeof request.reject === 'function') {
        try {
          request.reject(new Error('Queue cleared'));
        } catch (error) {
          // Ignore errors from already resolved/rejected promises
        }
      }
    }
    this.activeRequests.clear();

    // Reset metrics
    this.metrics.queuedRequests = 0;
    this.metrics.currentQueueSize = 0;

    console.log('Request queue cleared');
    this.emit('queueCleared');
  }

  /**
   * Shutdown the queue system
   */
  shutdown() {
    this.stopQueueProcessor();
    this.clear();
    console.log('RequestQueue shutdown complete');
  }
}

module.exports = RequestQueue;
