// monitoring/PerformanceMonitor.js
// Performance monitoring and optimization system

const EventEmitter = require('events');
const os = require('os');

/**
 * Performance Monitor
 * Tracks system performance, resource usage, and provides optimization recommendations
 */
class PerformanceMonitor extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      monitoringInterval: config.monitoringInterval || 5000, // 5 seconds
      memoryThreshold: config.memoryThreshold || 0.8, // 80% memory usage
      cpuThreshold: config.cpuThreshold || 0.8, // 80% CPU usage
      responseTimeThreshold: config.responseTimeThreshold || 5000, // 5 seconds
      enableAutoOptimization: config.enableAutoOptimization !== false,
      enableResourceAlerts: config.enableResourceAlerts !== false,
      enablePerformanceLogging: config.enablePerformanceLogging !== false,
      historySize: config.historySize || 1000,
      ...config,
    };

    // Performance metrics
    this.metrics = {
      system: {
        memory: {
          used: 0,
          total: 0,
          percentage: 0,
          heapUsed: 0,
          heapTotal: 0,
          external: 0,
        },
        cpu: {
          usage: 0,
          loadAverage: [0, 0, 0],
        },
        uptime: 0,
        timestamp: Date.now(),
      },
      application: {
        requests: {
          total: 0,
          active: 0,
          completed: 0,
          failed: 0,
          avgResponseTime: 0,
          minResponseTime: Infinity,
          maxResponseTime: 0,
        },
        providers: new Map(),
        cache: {
          hits: 0,
          misses: 0,
          hitRate: 0,
          size: 0,
        },
        queue: {
          size: 0,
          maxSize: 0,
          avgWaitTime: 0,
          processing: 0,
        },
      },
      history: [],
    };

    // Performance tracking
    this.performanceHistory = [];
    this.alertHistory = [];
    this.optimizationHistory = [];

    // Resource monitoring
    this.resourceMonitor = null;
    this.isMonitoring = false;

    // Optimization recommendations
    this.optimizationRecommendations = new Map();

    console.log('PerformanceMonitor initialized with config:', this.config);
  }

  /**
   * Start performance monitoring
   */
  start() {
    if (this.isMonitoring) {
      console.warn('PerformanceMonitor already running');
      return;
    }

    this.isMonitoring = true;
    this.resourceMonitor = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoringInterval);

    console.log('PerformanceMonitor started');
    this.emit('monitoringStarted');
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }

    console.log('PerformanceMonitor stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Collect system and application metrics
   * @private
   */
  async collectMetrics() {
    try {
      // Collect system metrics
      await this.collectSystemMetrics();

      // Collect application metrics
      this.collectApplicationMetrics();

      // Add to history
      this.addToHistory();

      // Check thresholds and generate alerts
      this.checkThresholds();

      // Generate optimization recommendations
      if (this.config.enableAutoOptimization) {
        this.generateOptimizationRecommendations();
      }

      // Log performance data
      if (this.config.enablePerformanceLogging) {
        this.logPerformanceData();
      }

      this.emit('metricsCollected', this.metrics);
    } catch (error) {
      console.error('Error collecting performance metrics:', error);
      this.emit('metricsError', error);
    }
  }

  /**
   * Collect system-level metrics
   * @private
   */
  async collectSystemMetrics() {
    // Memory metrics
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    this.metrics.system.memory = {
      used: usedMem,
      total: totalMem,
      percentage: usedMem / totalMem,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
    };

    // CPU metrics
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    // Calculate CPU usage (simplified)
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 1 - idle / total;

    this.metrics.system.cpu = {
      usage: Math.max(0, Math.min(1, usage)),
      loadAverage: loadAvg,
    };

    // System uptime
    this.metrics.system.uptime = process.uptime();
    this.metrics.system.timestamp = Date.now();
  }

  /**
   * Collect application-level metrics
   * @private
   */
  collectApplicationMetrics() {
    // Request metrics are updated externally via trackRequest method
    // This method can collect other application-specific metrics

    // Update cache hit rate
    const totalCacheRequests =
      this.metrics.application.cache.hits +
      this.metrics.application.cache.misses;
    this.metrics.application.cache.hitRate =
      totalCacheRequests > 0
        ? this.metrics.application.cache.hits / totalCacheRequests
        : 0;
  }

  /**
   * Track request performance
   * @param {string} provider - Provider name
   * @param {number} responseTime - Response time in ms
   * @param {boolean} success - Whether request was successful
   * @param {Object} metadata - Additional metadata
   */
  trackRequest(provider, responseTime, success, metadata = {}) {
    // Update overall request metrics
    this.metrics.application.requests.total++;

    if (success) {
      this.metrics.application.requests.completed++;
    } else {
      this.metrics.application.requests.failed++;
    }

    // Update response time metrics
    this.metrics.application.requests.minResponseTime = Math.min(
      this.metrics.application.requests.minResponseTime,
      responseTime
    );
    this.metrics.application.requests.maxResponseTime = Math.max(
      this.metrics.application.requests.maxResponseTime,
      responseTime
    );

    // Calculate average response time
    const totalRequests = this.metrics.application.requests.total;
    const currentAvg = this.metrics.application.requests.avgResponseTime;
    this.metrics.application.requests.avgResponseTime =
      (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;

    // Update provider-specific metrics
    if (!this.metrics.application.providers.has(provider)) {
      this.metrics.application.providers.set(provider, {
        requests: 0,
        completed: 0,
        failed: 0,
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        totalResponseTime: 0,
      });
    }

    const providerMetrics = this.metrics.application.providers.get(provider);
    providerMetrics.requests++;
    providerMetrics.totalResponseTime += responseTime;

    if (success) {
      providerMetrics.completed++;
    } else {
      providerMetrics.failed++;
    }

    providerMetrics.minResponseTime = Math.min(
      providerMetrics.minResponseTime,
      responseTime
    );
    providerMetrics.maxResponseTime = Math.max(
      providerMetrics.maxResponseTime,
      responseTime
    );
    providerMetrics.avgResponseTime =
      providerMetrics.totalResponseTime / providerMetrics.requests;

    // Emit request tracked event
    this.emit('requestTracked', {
      provider,
      responseTime,
      success,
      metadata,
    });
  }

  /**
   * Track cache performance
   * @param {boolean} hit - Whether it was a cache hit
   * @param {number} size - Current cache size
   */
  trackCache(hit, size = null) {
    if (hit) {
      this.metrics.application.cache.hits++;
    } else {
      this.metrics.application.cache.misses++;
    }

    if (size !== null) {
      this.metrics.application.cache.size = size;
    }

    // Update hit rate
    const totalRequests =
      this.metrics.application.cache.hits +
      this.metrics.application.cache.misses;
    this.metrics.application.cache.hitRate =
      totalRequests > 0
        ? this.metrics.application.cache.hits / totalRequests
        : 0;
  }

  /**
   * Track queue performance
   * @param {number} size - Current queue size
   * @param {number} waitTime - Wait time for processed request
   * @param {number} processing - Number of requests being processed
   */
  trackQueue(size, waitTime = null, processing = null) {
    this.metrics.application.queue.size = size;
    this.metrics.application.queue.maxSize = Math.max(
      this.metrics.application.queue.maxSize,
      size
    );

    if (processing !== null) {
      this.metrics.application.queue.processing = processing;
    }

    if (waitTime !== null) {
      // Update average wait time (simplified calculation)
      const currentAvg = this.metrics.application.queue.avgWaitTime;
      this.metrics.application.queue.avgWaitTime =
        currentAvg === 0 ? waitTime : (currentAvg + waitTime) / 2;
    }
  }

  /**
   * Add current metrics to history
   * @private
   */
  addToHistory() {
    const snapshot = {
      timestamp: Date.now(),
      system: { ...this.metrics.system },
      application: {
        requests: { ...this.metrics.application.requests },
        cache: { ...this.metrics.application.cache },
        queue: { ...this.metrics.application.queue },
        providers: Object.fromEntries(this.metrics.application.providers),
      },
    };

    this.performanceHistory.push(snapshot);

    // Trim history if too large
    if (this.performanceHistory.length > this.config.historySize) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Check performance thresholds and generate alerts
   * @private
   */
  checkThresholds() {
    const alerts = [];

    // Memory threshold check
    if (this.metrics.system.memory.percentage > this.config.memoryThreshold) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `Memory usage is ${(
          this.metrics.system.memory.percentage * 100
        ).toFixed(1)}% (threshold: ${(
          this.config.memoryThreshold * 100
        ).toFixed(1)}%)`,
        value: this.metrics.system.memory.percentage,
        threshold: this.config.memoryThreshold,
        timestamp: Date.now(),
      });
    }

    // CPU threshold check
    if (this.metrics.system.cpu.usage > this.config.cpuThreshold) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `CPU usage is ${(this.metrics.system.cpu.usage * 100).toFixed(
          1
        )}% (threshold: ${(this.config.cpuThreshold * 100).toFixed(1)}%)`,
        value: this.metrics.system.cpu.usage,
        threshold: this.config.cpuThreshold,
        timestamp: Date.now(),
      });
    }

    // Response time threshold check
    if (
      this.metrics.application.requests.avgResponseTime >
      this.config.responseTimeThreshold
    ) {
      alerts.push({
        type: 'response_time',
        severity: 'warning',
        message: `Average response time is ${this.metrics.application.requests.avgResponseTime.toFixed(
          0
        )}ms (threshold: ${this.config.responseTimeThreshold}ms)`,
        value: this.metrics.application.requests.avgResponseTime,
        threshold: this.config.responseTimeThreshold,
        timestamp: Date.now(),
      });
    }

    // Process alerts
    if (alerts.length > 0 && this.config.enableResourceAlerts) {
      this.processAlerts(alerts);
    }
  }

  /**
   * Process performance alerts
   * @private
   */
  processAlerts(alerts) {
    alerts.forEach((alert) => {
      // Add to alert history
      this.alertHistory.push(alert);

      // Trim alert history
      if (this.alertHistory.length > 100) {
        this.alertHistory.shift();
      }

      // Log alert
      console.warn(`Performance Alert [${alert.type}]: ${alert.message}`);

      // Emit alert event
      this.emit('performanceAlert', alert);
    });
  }

  /**
   * Generate optimization recommendations
   * @private
   */
  generateOptimizationRecommendations() {
    const recommendations = [];

    // Memory optimization recommendations
    if (this.metrics.system.memory.percentage > 0.7) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        action: 'optimize_memory',
        description: 'Consider implementing memory optimization strategies',
        suggestions: [
          'Enable garbage collection optimization',
          'Implement object pooling for frequently created objects',
          'Review cache size limits',
          'Consider reducing concurrent request limits',
        ],
      });
    }

    // Response time optimization recommendations
    if (this.metrics.application.requests.avgResponseTime > 3000) {
      recommendations.push({
        type: 'response_time',
        priority: 'medium',
        action: 'optimize_response_time',
        description: 'Response times are higher than optimal',
        suggestions: [
          'Implement request queuing and prioritization',
          'Enable connection pooling',
          'Optimize AI provider selection logic',
          'Implement more aggressive caching',
        ],
      });
    }

    // Cache optimization recommendations
    if (
      this.metrics.application.cache.hitRate < 0.3 &&
      this.metrics.application.cache.hits +
        this.metrics.application.cache.misses >
        100
    ) {
      recommendations.push({
        type: 'cache',
        priority: 'medium',
        action: 'optimize_cache',
        description: 'Cache hit rate is low, consider cache optimization',
        suggestions: [
          'Review cache key generation strategy',
          'Implement semantic similarity caching',
          'Adjust cache TTL values',
          'Implement cache warming strategies',
        ],
      });
    }

    // Queue optimization recommendations
    if (this.metrics.application.queue.avgWaitTime > 2000) {
      recommendations.push({
        type: 'queue',
        priority: 'high',
        action: 'optimize_queue',
        description: 'Queue wait times are high',
        suggestions: [
          'Increase concurrent request limits',
          'Implement priority queuing',
          'Optimize provider selection for faster providers',
          'Consider horizontal scaling',
        ],
      });
    }

    // Update recommendations
    recommendations.forEach((rec) => {
      this.optimizationRecommendations.set(rec.type, rec);
    });

    // Add to optimization history
    if (recommendations.length > 0) {
      this.optimizationHistory.push({
        timestamp: Date.now(),
        recommendations: [...recommendations],
      });

      // Trim optimization history
      if (this.optimizationHistory.length > 50) {
        this.optimizationHistory.shift();
      }

      // Emit optimization event
      this.emit('optimizationRecommendations', recommendations);
    }
  }

  /**
   * Log performance data
   * @private
   */
  logPerformanceData() {
    const logData = {
      timestamp: new Date().toISOString(),
      system: {
        memory: `${(this.metrics.system.memory.percentage * 100).toFixed(1)}%`,
        cpu: `${(this.metrics.system.cpu.usage * 100).toFixed(1)}%`,
        uptime: `${Math.floor(this.metrics.system.uptime / 3600)}h ${Math.floor(
          (this.metrics.system.uptime % 3600) / 60
        )}m`,
      },
      application: {
        requests: {
          total: this.metrics.application.requests.total,
          success_rate:
            this.metrics.application.requests.total > 0
              ? (
                  (this.metrics.application.requests.completed /
                    this.metrics.application.requests.total) *
                  100
                ).toFixed(1) + '%'
              : '0%',
          avg_response_time: `${this.metrics.application.requests.avgResponseTime.toFixed(
            0
          )}ms`,
        },
        cache: {
          hit_rate: `${(this.metrics.application.cache.hitRate * 100).toFixed(
            1
          )}%`,
          size: this.metrics.application.cache.size,
        },
        queue: {
          size: this.metrics.application.queue.size,
          avg_wait_time: `${this.metrics.application.queue.avgWaitTime.toFixed(
            0
          )}ms`,
        },
      },
    };

    console.log('Performance Metrics:', JSON.stringify(logData, null, 2));
  }

  /**
   * Get current performance metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      providers: Object.fromEntries(this.metrics.application.providers),
    };
  }

  /**
   * Get performance history
   * @param {number} limit - Number of history entries to return
   * @returns {Array} Performance history
   */
  getHistory(limit = 100) {
    return this.performanceHistory.slice(-limit);
  }

  /**
   * Get alert history
   * @param {number} limit - Number of alerts to return
   * @returns {Array} Alert history
   */
  getAlerts(limit = 50) {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get optimization recommendations
   * @returns {Array} Current optimization recommendations
   */
  getOptimizationRecommendations() {
    return Array.from(this.optimizationRecommendations.values());
  }

  /**
   * Get performance summary
   * @returns {Object} Performance summary
   */
  getSummary() {
    const totalRequests = this.metrics.application.requests.total;
    const successRate =
      totalRequests > 0
        ? (this.metrics.application.requests.completed / totalRequests) * 100
        : 0;

    return {
      system: {
        memory_usage: `${(this.metrics.system.memory.percentage * 100).toFixed(
          1
        )}%`,
        cpu_usage: `${(this.metrics.system.cpu.usage * 100).toFixed(1)}%`,
        uptime: Math.floor(this.metrics.system.uptime),
      },
      application: {
        total_requests: totalRequests,
        success_rate: `${successRate.toFixed(1)}%`,
        avg_response_time: `${this.metrics.application.requests.avgResponseTime.toFixed(
          0
        )}ms`,
        cache_hit_rate: `${(
          this.metrics.application.cache.hitRate * 100
        ).toFixed(1)}%`,
        queue_size: this.metrics.application.queue.size,
      },
      alerts: this.alertHistory.length,
      recommendations: this.optimizationRecommendations.size,
      monitoring_status: this.isMonitoring ? 'active' : 'inactive',
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics.application.requests = {
      total: 0,
      active: 0,
      completed: 0,
      failed: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
    };

    this.metrics.application.cache = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
    };

    this.metrics.application.queue = {
      size: 0,
      maxSize: 0,
      avgWaitTime: 0,
      processing: 0,
    };

    this.metrics.application.providers.clear();
    this.performanceHistory.length = 0;
    this.alertHistory.length = 0;
    this.optimizationHistory.length = 0;
    this.optimizationRecommendations.clear();

    console.log('Performance metrics reset');
    this.emit('metricsReset');
  }

  /**
   * Shutdown performance monitor
   */
  shutdown() {
    this.stop();
    this.resetMetrics();
    console.log('PerformanceMonitor shutdown complete');
  }
}

module.exports = PerformanceMonitor;
