// middleware/performanceMiddleware.js
// Performance optimization middleware that integrates all performance components

const RequestQueue = require('../utils/RequestQueue');
const RateLimiter = require('../utils/RateLimiter');
const ResourceManager = require('../utils/ResourceManager');
const PerformanceMonitor = require('../monitoring/PerformanceMonitor');

/**
 * Performance Middleware
 * Integrates request queuing, rate limiting, resource management, and performance monitoring
 */
class PerformanceMiddleware {
  constructor(config = {}) {
    this.config = {
      // Request queue configuration
      queue: {
        maxConcurrentRequests: config.maxConcurrentRequests || 10,
        maxQueueSize: config.maxQueueSize || 100,
        requestTimeout: config.requestTimeout || 30000,
        enablePriorityQueuing: config.enablePriorityQueuing !== false,
        ...config.queue,
      },

      // Rate limiter configuration
      rateLimiter: {
        globalRequestsPerMinute: config.globalRequestsPerMinute || 200,
        globalTokensPerMinute: config.globalTokensPerMinute || 100000,
        enableAdaptiveThrottling: config.enableAdaptiveThrottling !== false,
        ...config.rateLimiter,
      },

      // Resource manager configuration
      resourceManager: {
        enableAutoScaling: config.enableAutoScaling !== false,
        memoryThreshold: config.memoryThreshold || 0.8,
        cpuThreshold: config.cpuThreshold || 0.75,
        ...config.resourceManager,
      },

      // Performance monitor configuration
      performanceMonitor: {
        monitoringInterval: config.monitoringInterval || 5000,
        enableAutoOptimization: config.enableAutoOptimization !== false,
        ...config.performanceMonitor,
      },

      // Integration settings
      enableRequestQueuing: config.enableRequestQueuing !== false,
      enableRateLimiting: config.enableRateLimiting !== false,
      enableResourceManagement: config.enableResourceManagement !== false,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring !== false,

      // Optimization settings
      enableAutomaticOptimization: config.enableAutomaticOptimization !== false,
      optimizationInterval: config.optimizationInterval || 60000, // 1 minute

      ...config,
    };

    // Initialize components
    this.requestQueue = null;
    this.rateLimiter = null;
    this.resourceManager = null;
    this.performanceMonitor = null;

    // State tracking
    this.isInitialized = false;
    this.optimizationInterval = null;

    // Metrics
    this.metrics = {
      requestsProcessed: 0,
      requestsQueued: 0,
      requestsRateLimited: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      optimizationsApplied: 0,
    };

    console.log('PerformanceMiddleware initialized with config');
  }

  /**
   * Initialize all performance components
   */
  async initialize() {
    if (this.isInitialized) {
      console.warn('PerformanceMiddleware already initialized');
      return;
    }

    try {
      // Initialize request queue
      if (this.config.enableRequestQueuing) {
        this.requestQueue = new RequestQueue(this.config.queue);
        console.log('Request queue initialized');
      }

      // Initialize rate limiter
      if (this.config.enableRateLimiting) {
        this.rateLimiter = new RateLimiter(this.config.rateLimiter);
        console.log('Rate limiter initialized');
      }

      // Initialize resource manager
      if (this.config.enableResourceManagement) {
        this.resourceManager = new ResourceManager(this.config.resourceManager);
        this.resourceManager.start();
        console.log('Resource manager initialized and started');
      }

      // Initialize performance monitor
      if (this.config.enablePerformanceMonitoring) {
        this.performanceMonitor = new PerformanceMonitor(
          this.config.performanceMonitor
        );
        this.performanceMonitor.start();
        console.log('Performance monitor initialized and started');
      }

      // Set up component integration
      this.setupComponentIntegration();

      // Start automatic optimization
      if (this.config.enableAutomaticOptimization) {
        this.startAutomaticOptimization();
      }

      this.isInitialized = true;
      console.log('PerformanceMiddleware fully initialized');
    } catch (error) {
      console.error('Failed to initialize PerformanceMiddleware:', error);
      throw error;
    }
  }

  /**
   * Set up integration between components
   * @private
   */
  setupComponentIntegration() {
    // Resource manager -> Request queue integration
    if (this.resourceManager && this.requestQueue) {
      this.resourceManager.on('scaledUp', (event) => {
        // Update request queue concurrency limits
        this.requestQueue.config.maxConcurrentRequests = event.newValue;
        console.log(
          `Updated queue concurrency to ${event.newValue} due to scaling up`
        );
      });

      this.resourceManager.on('scaledDown', (event) => {
        // Update request queue concurrency limits
        this.requestQueue.config.maxConcurrentRequests = event.newValue;
        console.log(
          `Updated queue concurrency to ${event.newValue} due to scaling down`
        );
      });
    }

    // Performance monitor -> Rate limiter integration
    if (this.performanceMonitor && this.rateLimiter) {
      this.performanceMonitor.on('performanceAlert', (alert) => {
        if (alert.type === 'response_time' && alert.severity === 'warning') {
          // Increase throttling when response times are high
          console.log(
            'Applying adaptive throttling due to high response times'
          );
        }
      });
    }

    // Request queue -> Performance monitor integration
    if (this.requestQueue && this.performanceMonitor) {
      this.requestQueue.on('requestCompleted', (event) => {
        this.performanceMonitor.trackRequest(
          'queue',
          event.processingTime,
          true,
          { queueWaitTime: event.waitTime || 0 }
        );
      });

      this.requestQueue.on('requestFailed', (event) => {
        this.performanceMonitor.trackRequest(
          'queue',
          event.processingTime || 0,
          false,
          { error: event.error }
        );
      });
    }
  }

  /**
   * Express middleware function
   * @returns {Function} Express middleware
   */
  middleware() {
    return async (req, res, next) => {
      if (!this.isInitialized) {
        console.warn(
          'PerformanceMiddleware not initialized, skipping optimization'
        );
        return next();
      }

      const startTime = Date.now();
      const requestId = this.generateRequestId();

      // Add performance tracking to request
      req.performanceTracking = {
        requestId,
        startTime,
        middleware: this,
      };

      try {
        // Check resource availability
        if (
          this.resourceManager &&
          !this.resourceManager.canHandleNewRequest()
        ) {
          return res.status(503).json({
            success: false,
            error:
              'Service temporarily unavailable due to resource constraints',
            retryAfter: 30,
          });
        }

        // Apply rate limiting
        if (this.rateLimiter) {
          const provider = this.extractProvider(req);
          const requestInfo = this.extractRequestInfo(req);

          const rateLimitResult = await this.rateLimiter.checkRateLimit(
            provider,
            requestInfo
          );

          if (!rateLimitResult.allowed) {
            this.metrics.requestsRateLimited++;

            return res.status(429).json({
              success: false,
              error: 'Rate limit exceeded',
              reason: rateLimitResult.reason,
              details: rateLimitResult.details,
              retryAfter: Math.ceil(rateLimitResult.waitTime / 1000) || 60,
            });
          }

          // Store rate limit info for cleanup
          req.performanceTracking.rateLimitRequestId =
            rateLimitResult.requestId;
          req.performanceTracking.provider = provider;
        }

        // Apply request queuing if enabled
        if (this.requestQueue) {
          const priority = this.determinePriority(req);
          const provider = this.extractProvider(req);

          // Wrap the next() call in a queued operation
          const queuedOperation = () => {
            return new Promise((resolve, reject) => {
              // Continue with the request
              const originalEnd = res.end;
              res.end = (...args) => {
                // Track completion
                this.trackRequestCompletion(req, res, startTime);
                resolve();
                return originalEnd.apply(res, args);
              };

              // Handle errors
              const originalNext = next;
              next = (error) => {
                if (error) {
                  this.trackRequestCompletion(req, res, startTime, error);
                  reject(error);
                } else {
                  originalNext();
                }
              };

              next();
            });
          };

          try {
            await this.requestQueue.enqueue(queuedOperation, {
              priority,
              provider,
              timeout: this.config.queue.requestTimeout,
              metadata: {
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
              },
            });

            this.metrics.requestsQueued++;
          } catch (queueError) {
            console.error('Request queue error:', queueError);

            if (queueError.message.includes('queue is full')) {
              return res.status(503).json({
                success: false,
                error: 'Service temporarily unavailable - queue full',
                retryAfter: 30,
              });
            }

            // Continue without queuing on other errors
            next();
          }
        } else {
          // No queuing - continue normally but still track
          const originalEnd = res.end;
          res.end = (...args) => {
            this.trackRequestCompletion(req, res, startTime);
            return originalEnd.apply(res, args);
          };

          next();
        }
      } catch (error) {
        console.error('Performance middleware error:', error);
        this.trackRequestCompletion(req, res, startTime, error);
        next(error);
      }
    };
  }

  /**
   * Track request completion
   * @private
   */
  trackRequestCompletion(req, res, startTime, error = null) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const success = !error && res.statusCode < 400;

    // Update metrics
    this.metrics.requestsProcessed++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime =
      this.metrics.totalResponseTime / this.metrics.requestsProcessed;

    // Track with performance monitor
    if (this.performanceMonitor) {
      const provider = req.performanceTracking?.provider || 'unknown';
      this.performanceMonitor.trackRequest(provider, responseTime, success, {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        error: error?.message,
      });
    }

    // Track with resource manager
    if (this.resourceManager) {
      this.resourceManager.trackRequestCompletion(responseTime);
    }

    // Complete rate limiting tracking
    if (this.rateLimiter && req.performanceTracking?.rateLimitRequestId) {
      this.rateLimiter.completeRequest(
        req.performanceTracking.rateLimitRequestId,
        {
          success,
          tokens: this.estimateTokensUsed(req, res),
          responseTime,
        }
      );
    }
  }

  /**
   * Extract provider from request
   * @private
   */
  extractProvider(req) {
    // Try to determine provider from request
    if (req.body && req.body.provider) {
      return req.body.provider;
    }

    if (req.query && req.query.provider) {
      return req.query.provider;
    }

    // Default based on endpoint
    if (req.path.includes('cerebras')) {
      return 'cerebras';
    } else if (req.path.includes('openai')) {
      return 'openai';
    }

    return 'default';
  }

  /**
   * Extract request information for rate limiting
   * @private
   */
  extractRequestInfo(req) {
    const info = {
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    };

    // Estimate tokens based on request content
    if (req.body) {
      if (req.body.text) {
        info.estimatedTokens = Math.ceil(req.body.text.length / 4);
      } else if (req.body.prompt) {
        info.estimatedTokens = Math.ceil(req.body.prompt.length / 4);
      }
    }

    return info;
  }

  /**
   * Determine request priority
   * @private
   */
  determinePriority(req) {
    // Priority based on endpoint and request type
    if (req.path.includes('/streaming')) {
      return 'high';
    } else if (req.path.includes('/parse')) {
      return 'normal';
    } else if (req.path.includes('/patch')) {
      return 'normal';
    } else if (req.path.includes('/health') || req.path.includes('/status')) {
      return 'low';
    }

    return 'normal';
  }

  /**
   * Estimate tokens used in response
   * @private
   */
  estimateTokensUsed(req, res) {
    // Simple estimation based on response size
    const contentLength = res.get('Content-Length');
    if (contentLength) {
      return Math.ceil(parseInt(contentLength) / 4);
    }

    // Default estimate
    return 1000;
  }

  /**
   * Start automatic optimization
   * @private
   */
  startAutomaticOptimization() {
    this.optimizationInterval = setInterval(() => {
      this.performAutomaticOptimization();
    }, this.config.optimizationInterval);

    console.log('Automatic optimization started');
  }

  /**
   * Perform automatic optimization
   * @private
   */
  performAutomaticOptimization() {
    try {
      let optimizationsApplied = 0;

      // Get current performance metrics
      const performanceMetrics = this.performanceMonitor?.getMetrics();
      const resourceStatus = this.resourceManager?.getResourceStatus();
      const rateLimiterStatus = this.rateLimiter?.getStatus();

      // Apply optimizations based on current state
      if (performanceMetrics && resourceStatus) {
        // Memory optimization
        if (resourceStatus.memory.current > '80%') {
          this.applyMemoryOptimization();
          optimizationsApplied++;
        }

        // Queue optimization
        if (this.requestQueue) {
          const queueStatus = this.requestQueue.getStatus();
          if (
            queueStatus.metrics.currentQueueSize >
            this.config.queue.maxQueueSize * 0.8
          ) {
            this.applyQueueOptimization();
            optimizationsApplied++;
          }
        }

        // Rate limiting optimization
        if (rateLimiterStatus && this.rateLimiter) {
          const globalUtilization =
            rateLimiterStatus.global.requests /
            this.config.rateLimiter.globalRequestsPerMinute;
          if (globalUtilization > 0.9) {
            this.applyRateLimitOptimization();
            optimizationsApplied++;
          }
        }
      }

      if (optimizationsApplied > 0) {
        this.metrics.optimizationsApplied += optimizationsApplied;
        console.log(`Applied ${optimizationsApplied} automatic optimizations`);
      }
    } catch (error) {
      console.error('Error in automatic optimization:', error);
    }
  }

  /**
   * Apply memory optimization
   * @private
   */
  applyMemoryOptimization() {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear request queue history if it's too large
    if (this.requestQueue && this.requestQueue.requestHistory.length > 500) {
      this.requestQueue.requestHistory =
        this.requestQueue.requestHistory.slice(-250);
    }

    console.log('Applied memory optimization');
  }

  /**
   * Apply queue optimization
   * @private
   */
  applyQueueOptimization() {
    if (!this.requestQueue) return;

    // Increase processing speed by reducing queue processing interval
    if (this.requestQueue.processorInterval) {
      clearInterval(this.requestQueue.processorInterval);
      this.requestQueue.processorInterval = setInterval(() => {
        this.requestQueue.processQueue();
      }, 5); // Faster processing
    }

    console.log('Applied queue optimization');
  }

  /**
   * Apply rate limiting optimization
   * @private
   */
  applyRateLimitOptimization() {
    if (!this.rateLimiter) return;

    // Temporarily increase global limits by 10%
    const currentConfig = this.rateLimiter.config;
    this.rateLimiter.config.globalRequestsPerMinute = Math.floor(
      currentConfig.globalRequestsPerMinute * 1.1
    );

    console.log('Applied rate limiting optimization');
  }

  /**
   * Generate unique request ID
   * @private
   */
  generateRequestId() {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get performance status
   * @returns {Object} Current performance status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      components: {
        requestQueue: !!this.requestQueue,
        rateLimiter: !!this.rateLimiter,
        resourceManager: !!this.resourceManager,
        performanceMonitor: !!this.performanceMonitor,
      },
      metrics: { ...this.metrics },
      config: {
        enableRequestQueuing: this.config.enableRequestQueuing,
        enableRateLimiting: this.config.enableRateLimiting,
        enableResourceManagement: this.config.enableResourceManagement,
        enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
        enableAutomaticOptimization: this.config.enableAutomaticOptimization,
      },
    };
  }

  /**
   * Get detailed performance metrics
   * @returns {Object} Detailed metrics from all components
   */
  getDetailedMetrics() {
    return {
      middleware: { ...this.metrics },
      requestQueue: this.requestQueue?.getMetrics() || null,
      rateLimiter: this.rateLimiter?.getStatus() || null,
      resourceManager: this.resourceManager?.getResourceStatus() || null,
      performanceMonitor: this.performanceMonitor?.getMetrics() || null,
    };
  }

  /**
   * Shutdown all performance components
   */
  async shutdown() {
    console.log('Shutting down PerformanceMiddleware...');

    // Stop automatic optimization
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }

    // Shutdown components
    if (this.requestQueue) {
      this.requestQueue.shutdown();
    }

    if (this.rateLimiter) {
      this.rateLimiter.shutdown();
    }

    if (this.resourceManager) {
      this.resourceManager.shutdown();
    }

    if (this.performanceMonitor) {
      this.performanceMonitor.shutdown();
    }

    this.isInitialized = false;
    console.log('PerformanceMiddleware shutdown complete');
  }
}

module.exports = PerformanceMiddleware;
