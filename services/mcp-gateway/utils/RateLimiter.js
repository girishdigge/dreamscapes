// utils/RateLimiter.js
// Advanced rate limiting system with adaptive throttling

const EventEmitter = require('events');

/**
 * Advanced Rate Limiter
 * Implements sophisticated rate limiting with adaptive throttling and provider-specific limits
 */
class RateLimiter extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Global rate limits
      globalRequestsPerMinute: config.globalRequestsPerMinute || 200,
      globalTokensPerMinute: config.globalTokensPerMinute || 100000,
      globalConcurrentRequests: config.globalConcurrentRequests || 20,

      // Provider-specific defaults
      defaultProviderLimits: {
        requestsPerMinute: config.defaultRequestsPerMinute || 60,
        tokensPerMinute: config.defaultTokensPerMinute || 40000,
        concurrentRequests: config.defaultConcurrentRequests || 5,
        burstLimit: config.defaultBurstLimit || 10,
        burstWindow: config.defaultBurstWindow || 10000, // 10 seconds
      },

      // Adaptive throttling
      enableAdaptiveThrottling: config.enableAdaptiveThrottling !== false,
      adaptiveThrottlingThreshold: config.adaptiveThrottlingThreshold || 0.8, // 80% of limit
      throttlingBackoffMultiplier: config.throttlingBackoffMultiplier || 1.5,
      throttlingRecoveryRate: config.throttlingRecoveryRate || 0.1, // 10% recovery per interval

      // Window settings
      windowSize: config.windowSize || 60000, // 1 minute
      cleanupInterval: config.cleanupInterval || 30000, // 30 seconds

      // Monitoring
      enableMetrics: config.enableMetrics !== false,
      enableLogging: config.enableLogging !== false,

      ...config,
    };

    // Rate limiting state
    this.globalState = {
      requests: 0,
      tokens: 0,
      concurrent: 0,
      windowStart: Date.now(),
      throttled: false,
      throttleMultiplier: 1.0,
    };

    // Provider-specific state
    this.providerStates = new Map();

    // Request tracking
    this.requestHistory = [];
    this.activeRequests = new Map();

    // Metrics
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      throttledRequests: 0,
      averageWaitTime: 0,
      totalWaitTime: 0,
      providerMetrics: new Map(),
    };

    // Cleanup interval
    this.cleanupInterval = null;

    this.startCleanup();
    console.log('RateLimiter initialized with config:', this.config);
  }

  /**
   * Check if request is allowed
   * @param {string} provider - Provider name
   * @param {Object} requestInfo - Request information
   * @returns {Object} Rate limit result
   */
  async checkRateLimit(provider, requestInfo = {}) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Update metrics
      this.metrics.totalRequests++;

      // Check global limits first
      const globalCheck = this.checkGlobalLimits(requestInfo);
      if (!globalCheck.allowed) {
        this.metrics.blockedRequests++;
        return {
          allowed: false,
          reason: 'global_limit_exceeded',
          details: globalCheck.details,
          waitTime: globalCheck.waitTime || 0,
          requestId,
        };
      }

      // Check provider-specific limits
      const providerCheck = this.checkProviderLimits(provider, requestInfo);
      if (!providerCheck.allowed) {
        this.metrics.blockedRequests++;
        this.updateProviderMetrics(provider, 'blocked');
        return {
          allowed: false,
          reason: 'provider_limit_exceeded',
          details: providerCheck.details,
          waitTime: providerCheck.waitTime || 0,
          requestId,
          provider,
        };
      }

      // Check adaptive throttling
      const throttleCheck = this.checkAdaptiveThrottling(provider, requestInfo);
      if (throttleCheck.shouldThrottle) {
        this.metrics.throttledRequests++;
        this.updateProviderMetrics(provider, 'throttled');
        return {
          allowed: false,
          reason: 'adaptive_throttling',
          details: throttleCheck.details,
          waitTime: throttleCheck.waitTime || 0,
          requestId,
          provider,
        };
      }

      // Request is allowed - update counters
      this.updateCounters(provider, requestInfo);
      this.metrics.allowedRequests++;
      this.updateProviderMetrics(provider, 'allowed');

      // Track active request
      this.activeRequests.set(requestId, {
        provider,
        startTime,
        requestInfo,
      });

      const processingTime = Date.now() - startTime;
      this.metrics.totalWaitTime += processingTime;
      this.metrics.averageWaitTime =
        this.metrics.totalWaitTime / this.metrics.totalRequests;

      return {
        allowed: true,
        requestId,
        provider,
        processingTime,
        limits: this.getCurrentLimits(provider),
      };
    } catch (error) {
      console.error('Error in rate limit check:', error);
      this.emit('rateLimitError', { error, provider, requestInfo });

      // Fail open - allow request but log error
      return {
        allowed: true,
        requestId,
        provider,
        error: error.message,
        failOpen: true,
      };
    }
  }

  /**
   * Mark request as completed
   * @param {string} requestId - Request ID
   * @param {Object} completionInfo - Completion information
   */
  completeRequest(requestId, completionInfo = {}) {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      return;
    }

    const duration = Date.now() - request.startTime;

    // Update global concurrent counter
    this.globalState.concurrent = Math.max(0, this.globalState.concurrent - 1);

    // Update provider concurrent counter
    const providerState = this.providerStates.get(request.provider);
    if (providerState) {
      providerState.concurrent = Math.max(0, providerState.concurrent - 1);
    }

    // Add to history
    this.requestHistory.push({
      requestId,
      provider: request.provider,
      startTime: request.startTime,
      endTime: Date.now(),
      duration,
      success: completionInfo.success !== false,
      tokens: completionInfo.tokens || 0,
    });

    // Trim history
    if (this.requestHistory.length > 1000) {
      this.requestHistory.shift();
    }

    // Remove from active requests
    this.activeRequests.delete(requestId);

    // Update provider metrics
    this.updateProviderMetrics(request.provider, 'completed', {
      duration,
      success: completionInfo.success !== false,
      tokens: completionInfo.tokens || 0,
    });

    // Check if we can reduce throttling
    if (this.config.enableAdaptiveThrottling) {
      this.updateAdaptiveThrottling(request.provider, completionInfo);
    }
  }

  /**
   * Check global rate limits
   * @private
   */
  checkGlobalLimits(requestInfo) {
    const now = Date.now();

    // Reset window if needed
    if (now - this.globalState.windowStart >= this.config.windowSize) {
      this.globalState.requests = 0;
      this.globalState.tokens = 0;
      this.globalState.windowStart = now;
    }

    // Check concurrent requests
    if (this.globalState.concurrent >= this.config.globalConcurrentRequests) {
      return {
        allowed: false,
        details: {
          type: 'concurrent_limit',
          current: this.globalState.concurrent,
          limit: this.config.globalConcurrentRequests,
        },
        waitTime: this.estimateWaitTime('global', 'concurrent'),
      };
    }

    // Check requests per minute
    if (this.globalState.requests >= this.config.globalRequestsPerMinute) {
      return {
        allowed: false,
        details: {
          type: 'requests_per_minute',
          current: this.globalState.requests,
          limit: this.config.globalRequestsPerMinute,
          windowStart: this.globalState.windowStart,
        },
        waitTime: this.estimateWaitTime('global', 'requests'),
      };
    }

    // Check tokens per minute
    const estimatedTokens = requestInfo.estimatedTokens || 1000; // Default estimate
    if (
      this.globalState.tokens + estimatedTokens >
      this.config.globalTokensPerMinute
    ) {
      return {
        allowed: false,
        details: {
          type: 'tokens_per_minute',
          current: this.globalState.tokens,
          estimated: estimatedTokens,
          limit: this.config.globalTokensPerMinute,
        },
        waitTime: this.estimateWaitTime('global', 'tokens'),
      };
    }

    return { allowed: true };
  }

  /**
   * Check provider-specific rate limits
   * @private
   */
  checkProviderLimits(provider, requestInfo) {
    const providerState = this.getProviderState(provider);
    const now = Date.now();

    // Reset window if needed
    if (now - providerState.windowStart >= this.config.windowSize) {
      providerState.requests = 0;
      providerState.tokens = 0;
      providerState.windowStart = now;
    }

    // Check concurrent requests
    if (providerState.concurrent >= providerState.limits.concurrentRequests) {
      return {
        allowed: false,
        details: {
          type: 'provider_concurrent_limit',
          provider,
          current: providerState.concurrent,
          limit: providerState.limits.concurrentRequests,
        },
        waitTime: this.estimateWaitTime(provider, 'concurrent'),
      };
    }

    // Check requests per minute
    if (providerState.requests >= providerState.limits.requestsPerMinute) {
      return {
        allowed: false,
        details: {
          type: 'provider_requests_per_minute',
          provider,
          current: providerState.requests,
          limit: providerState.limits.requestsPerMinute,
        },
        waitTime: this.estimateWaitTime(provider, 'requests'),
      };
    }

    // Check tokens per minute
    const estimatedTokens = requestInfo.estimatedTokens || 1000;
    if (
      providerState.tokens + estimatedTokens >
      providerState.limits.tokensPerMinute
    ) {
      return {
        allowed: false,
        details: {
          type: 'provider_tokens_per_minute',
          provider,
          current: providerState.tokens,
          estimated: estimatedTokens,
          limit: providerState.limits.tokensPerMinute,
        },
        waitTime: this.estimateWaitTime(provider, 'tokens'),
      };
    }

    // Check burst limits
    const burstCheck = this.checkBurstLimits(providerState, requestInfo);
    if (!burstCheck.allowed) {
      return burstCheck;
    }

    return { allowed: true };
  }

  /**
   * Check burst limits
   * @private
   */
  checkBurstLimits(providerState, requestInfo) {
    const now = Date.now();
    const burstWindow = providerState.limits.burstWindow;

    // Clean old burst requests
    providerState.burstRequests = providerState.burstRequests.filter(
      (timestamp) => now - timestamp < burstWindow
    );

    // Check burst limit
    if (providerState.burstRequests.length >= providerState.limits.burstLimit) {
      return {
        allowed: false,
        details: {
          type: 'burst_limit',
          current: providerState.burstRequests.length,
          limit: providerState.limits.burstLimit,
          window: burstWindow,
        },
        waitTime:
          burstWindow - (now - Math.min(...providerState.burstRequests)),
      };
    }

    return { allowed: true };
  }

  /**
   * Check adaptive throttling
   * @private
   */
  checkAdaptiveThrottling(provider, requestInfo) {
    if (!this.config.enableAdaptiveThrottling) {
      return { shouldThrottle: false };
    }

    const providerState = this.getProviderState(provider);

    // Check if provider is under stress
    const utilizationRate = this.calculateUtilizationRate(provider);
    const shouldThrottle =
      utilizationRate > this.config.adaptiveThrottlingThreshold;

    if (shouldThrottle) {
      const throttleDelay = this.calculateThrottleDelay(
        provider,
        utilizationRate
      );

      return {
        shouldThrottle: true,
        details: {
          type: 'adaptive_throttling',
          provider,
          utilizationRate,
          throttleDelay,
          threshold: this.config.adaptiveThrottlingThreshold,
        },
        waitTime: throttleDelay,
      };
    }

    return { shouldThrottle: false };
  }

  /**
   * Calculate utilization rate for a provider
   * @private
   */
  calculateUtilizationRate(provider) {
    const providerState = this.getProviderState(provider);
    const limits = providerState.limits;

    const requestUtilization =
      providerState.requests / limits.requestsPerMinute;
    const tokenUtilization = providerState.tokens / limits.tokensPerMinute;
    const concurrentUtilization =
      providerState.concurrent / limits.concurrentRequests;

    return Math.max(
      requestUtilization,
      tokenUtilization,
      concurrentUtilization
    );
  }

  /**
   * Calculate throttle delay
   * @private
   */
  calculateThrottleDelay(provider, utilizationRate) {
    const baseDelay = 1000; // 1 second base delay
    const utilizationMultiplier = Math.pow(utilizationRate, 2);
    const throttleMultiplier = this.globalState.throttleMultiplier;

    return Math.min(
      30000,
      baseDelay * utilizationMultiplier * throttleMultiplier
    );
  }

  /**
   * Update counters after allowing a request
   * @private
   */
  updateCounters(provider, requestInfo) {
    const estimatedTokens = requestInfo.estimatedTokens || 1000;

    // Update global counters
    this.globalState.requests++;
    this.globalState.tokens += estimatedTokens;
    this.globalState.concurrent++;

    // Update provider counters
    const providerState = this.getProviderState(provider);
    providerState.requests++;
    providerState.tokens += estimatedTokens;
    providerState.concurrent++;
    providerState.burstRequests.push(Date.now());
  }

  /**
   * Get or create provider state
   * @private
   */
  getProviderState(provider) {
    if (!this.providerStates.has(provider)) {
      this.providerStates.set(provider, {
        requests: 0,
        tokens: 0,
        concurrent: 0,
        windowStart: Date.now(),
        burstRequests: [],
        limits: { ...this.config.defaultProviderLimits },
        throttled: false,
        throttleMultiplier: 1.0,
      });
    }
    return this.providerStates.get(provider);
  }

  /**
   * Update provider-specific metrics
   * @private
   */
  updateProviderMetrics(provider, action, details = {}) {
    if (!this.metrics.providerMetrics.has(provider)) {
      this.metrics.providerMetrics.set(provider, {
        allowed: 0,
        blocked: 0,
        throttled: 0,
        completed: 0,
        totalDuration: 0,
        averageDuration: 0,
        totalTokens: 0,
      });
    }

    const metrics = this.metrics.providerMetrics.get(provider);
    metrics[action]++;

    if (action === 'completed' && details.duration) {
      metrics.totalDuration += details.duration;
      metrics.averageDuration = metrics.totalDuration / metrics.completed;

      if (details.tokens) {
        metrics.totalTokens += details.tokens;
      }
    }
  }

  /**
   * Update adaptive throttling based on completion
   * @private
   */
  updateAdaptiveThrottling(provider, completionInfo) {
    const providerState = this.getProviderState(provider);

    if (completionInfo.success) {
      // Reduce throttling on success
      this.globalState.throttleMultiplier = Math.max(
        1.0,
        this.globalState.throttleMultiplier - this.config.throttlingRecoveryRate
      );
      providerState.throttleMultiplier = Math.max(
        1.0,
        providerState.throttleMultiplier - this.config.throttlingRecoveryRate
      );
    } else {
      // Increase throttling on failure
      this.globalState.throttleMultiplier = Math.min(
        5.0,
        this.globalState.throttleMultiplier *
          this.config.throttlingBackoffMultiplier
      );
      providerState.throttleMultiplier = Math.min(
        5.0,
        providerState.throttleMultiplier *
          this.config.throttlingBackoffMultiplier
      );
    }
  }

  /**
   * Estimate wait time for rate limit
   * @private
   */
  estimateWaitTime(provider, limitType) {
    if (provider === 'global') {
      const timeUntilReset =
        this.config.windowSize - (Date.now() - this.globalState.windowStart);
      return Math.max(0, timeUntilReset);
    }

    const providerState = this.getProviderState(provider);

    switch (limitType) {
      case 'concurrent':
        // Estimate based on average request duration
        const avgDuration = this.getAverageRequestDuration(provider);
        return avgDuration * 0.5; // Conservative estimate

      case 'requests':
      case 'tokens':
        const timeUntilReset =
          this.config.windowSize - (Date.now() - providerState.windowStart);
        return Math.max(0, timeUntilReset);

      default:
        return 1000; // Default 1 second
    }
  }

  /**
   * Get average request duration for a provider
   * @private
   */
  getAverageRequestDuration(provider) {
    const recentRequests = this.requestHistory
      .filter((req) => req.provider === provider && req.endTime)
      .slice(-10); // Last 10 requests

    if (recentRequests.length === 0) {
      return 5000; // Default 5 seconds
    }

    const totalDuration = recentRequests.reduce(
      (sum, req) => sum + req.duration,
      0
    );
    return totalDuration / recentRequests.length;
  }

  /**
   * Set provider-specific limits
   * @param {string} provider - Provider name
   * @param {Object} limits - Provider limits
   */
  setProviderLimits(provider, limits) {
    const providerState = this.getProviderState(provider);
    providerState.limits = { ...providerState.limits, ...limits };

    console.log(
      `Updated limits for provider ${provider}:`,
      providerState.limits
    );
    this.emit('providerLimitsUpdated', {
      provider,
      limits: providerState.limits,
    });
  }

  /**
   * Get current limits for a provider
   * @param {string} provider - Provider name
   * @returns {Object} Current limits
   */
  getCurrentLimits(provider) {
    const providerState = this.getProviderState(provider);
    return {
      global: {
        requestsPerMinute: this.config.globalRequestsPerMinute,
        tokensPerMinute: this.config.globalTokensPerMinute,
        concurrentRequests: this.config.globalConcurrentRequests,
        current: {
          requests: this.globalState.requests,
          tokens: this.globalState.tokens,
          concurrent: this.globalState.concurrent,
        },
      },
      provider: {
        ...providerState.limits,
        current: {
          requests: providerState.requests,
          tokens: providerState.tokens,
          concurrent: providerState.concurrent,
        },
      },
    };
  }

  /**
   * Get rate limiter status
   * @returns {Object} Current status
   */
  getStatus() {
    return {
      global: {
        ...this.globalState,
        windowTimeRemaining:
          this.config.windowSize - (Date.now() - this.globalState.windowStart),
      },
      providers: Object.fromEntries(
        Array.from(this.providerStates.entries()).map(([provider, state]) => [
          provider,
          {
            ...state,
            windowTimeRemaining:
              this.config.windowSize - (Date.now() - state.windowStart),
            burstRequestCount: state.burstRequests.length,
          },
        ])
      ),
      metrics: {
        ...this.metrics,
        providerMetrics: Object.fromEntries(this.metrics.providerMetrics),
      },
      activeRequests: this.activeRequests.size,
    };
  }

  /**
   * Generate unique request ID
   * @private
   */
  generateRequestId() {
    return `rl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start cleanup interval
   * @private
   */
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Cleanup old data
   * @private
   */
  cleanup() {
    const now = Date.now();

    // Clean up old request history
    this.requestHistory = this.requestHistory.filter(
      (req) => now - req.endTime < this.config.windowSize * 2
    );

    // Clean up burst requests for all providers
    for (const [provider, state] of this.providerStates.entries()) {
      state.burstRequests = state.burstRequests.filter(
        (timestamp) => now - timestamp < state.limits.burstWindow
      );
    }
  }

  /**
   * Reset all rate limiting state
   */
  reset() {
    this.globalState = {
      requests: 0,
      tokens: 0,
      concurrent: 0,
      windowStart: Date.now(),
      throttled: false,
      throttleMultiplier: 1.0,
    };

    this.providerStates.clear();
    this.requestHistory.length = 0;
    this.activeRequests.clear();

    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      throttledRequests: 0,
      averageWaitTime: 0,
      totalWaitTime: 0,
      providerMetrics: new Map(),
    };

    console.log('Rate limiter state reset');
    this.emit('reset');
  }

  /**
   * Shutdown rate limiter
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.reset();
    console.log('RateLimiter shutdown complete');
  }
}

module.exports = RateLimiter;
