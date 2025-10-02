// utils/ResourceManager.js
// Resource management and automatic scaling system

const EventEmitter = require('events');
const os = require('os');

/**
 * Resource Manager
 * Manages system resources, implements automatic scaling, and provides resource optimization
 */
class ResourceManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Resource thresholds
      memoryThreshold: config.memoryThreshold || 0.8, // 80%
      cpuThreshold: config.cpuThreshold || 0.75, // 75%
      queueThreshold: config.queueThreshold || 50, // 50 requests
      responseTimeThreshold: config.responseTimeThreshold || 5000, // 5 seconds

      // Scaling configuration
      enableAutoScaling: config.enableAutoScaling !== false,
      scaleUpThreshold: config.scaleUpThreshold || 0.8, // 80% resource usage
      scaleDownThreshold: config.scaleDownThreshold || 0.3, // 30% resource usage
      scaleUpCooldown: config.scaleUpCooldown || 300000, // 5 minutes
      scaleDownCooldown: config.scaleDownCooldown || 600000, // 10 minutes

      // Resource limits
      maxConcurrentRequests: config.maxConcurrentRequests || 20,
      minConcurrentRequests: config.minConcurrentRequests || 5,
      maxQueueSize: config.maxQueueSize || 200,
      maxMemoryUsage: config.maxMemoryUsage || 0.9, // 90%

      // Optimization settings
      enableMemoryOptimization: config.enableMemoryOptimization !== false,
      enableCpuOptimization: config.enableCpuOptimization !== false,
      enableGarbageCollection: config.enableGarbageCollection !== false,
      gcInterval: config.gcInterval || 300000, // 5 minutes

      // Monitoring
      monitoringInterval: config.monitoringInterval || 10000, // 10 seconds
      enableResourceLogging: config.enableResourceLogging !== false,

      ...config,
    };

    // Resource state
    this.resourceState = {
      memory: {
        current: 0,
        peak: 0,
        threshold: this.config.memoryThreshold,
        optimized: false,
      },
      cpu: {
        current: 0,
        peak: 0,
        threshold: this.config.cpuThreshold,
        optimized: false,
      },
      concurrency: {
        current: this.config.maxConcurrentRequests,
        min: this.config.minConcurrentRequests,
        max: this.config.maxConcurrentRequests * 2, // Allow scaling up to 2x
        lastScaled: 0,
      },
      queue: {
        current: 0,
        max: this.config.maxQueueSize,
        threshold: this.config.queueThreshold,
      },
    };

    // Scaling history
    this.scalingHistory = [];
    this.optimizationHistory = [];

    // Monitoring
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.gcInterval = null;

    // Performance tracking
    this.performanceMetrics = {
      requestsProcessed: 0,
      averageResponseTime: 0,
      resourceUtilization: 0,
      scalingEvents: 0,
      optimizationEvents: 0,
    };

    console.log('ResourceManager initialized with config:', this.config);
  }

  /**
   * Start resource monitoring and management
   */
  start() {
    if (this.isMonitoring) {
      console.warn('ResourceManager already running');
      return;
    }

    this.isMonitoring = true;

    // Start resource monitoring
    this.monitoringInterval = setInterval(() => {
      this.monitorResources();
    }, this.config.monitoringInterval);

    // Start garbage collection optimization
    if (this.config.enableGarbageCollection) {
      this.gcInterval = setInterval(() => {
        this.optimizeGarbageCollection();
      }, this.config.gcInterval);
    }

    console.log('ResourceManager started');
    this.emit('started');
  }

  /**
   * Stop resource monitoring and management
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }

    console.log('ResourceManager stopped');
    this.emit('stopped');
  }

  /**
   * Monitor system resources and trigger optimizations
   * @private
   */
  async monitorResources() {
    try {
      // Collect resource metrics
      await this.collectResourceMetrics();

      // Check for scaling opportunities
      if (this.config.enableAutoScaling) {
        this.checkScalingTriggers();
      }

      // Apply resource optimizations
      this.applyResourceOptimizations();

      // Log resource status
      if (this.config.enableResourceLogging) {
        this.logResourceStatus();
      }

      this.emit('resourcesMonitored', this.resourceState);
    } catch (error) {
      console.error('Error monitoring resources:', error);
      this.emit('monitoringError', error);
    }
  }

  /**
   * Collect current resource metrics
   * @private
   */
  async collectResourceMetrics() {
    // Memory metrics
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryPercentage = usedMem / totalMem;

    this.resourceState.memory.current = memoryPercentage;
    this.resourceState.memory.peak = Math.max(
      this.resourceState.memory.peak,
      memoryPercentage
    );

    // CPU metrics (simplified calculation)
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const cpuUsage = Math.min(1, loadAvg[0] / cpus.length);

    this.resourceState.cpu.current = cpuUsage;
    this.resourceState.cpu.peak = Math.max(
      this.resourceState.cpu.peak,
      cpuUsage
    );

    // Update performance metrics
    this.performanceMetrics.resourceUtilization =
      (memoryPercentage + cpuUsage) / 2;
  }

  /**
   * Check for scaling triggers and apply scaling
   * @private
   */
  checkScalingTriggers() {
    const now = Date.now();
    const { memory, cpu, concurrency } = this.resourceState;

    // Check if we need to scale up
    const shouldScaleUp =
      (memory.current > this.config.scaleUpThreshold ||
        cpu.current > this.config.scaleUpThreshold) &&
      concurrency.current < concurrency.max &&
      now - concurrency.lastScaled > this.config.scaleUpCooldown;

    // Check if we can scale down
    const shouldScaleDown =
      memory.current < this.config.scaleDownThreshold &&
      cpu.current < this.config.scaleDownThreshold &&
      concurrency.current > concurrency.min &&
      now - concurrency.lastScaled > this.config.scaleDownCooldown;

    if (shouldScaleUp) {
      this.scaleUp();
    } else if (shouldScaleDown) {
      this.scaleDown();
    }
  }

  /**
   * Scale up resources
   * @private
   */
  scaleUp() {
    const oldConcurrency = this.resourceState.concurrency.current;
    const newConcurrency = Math.min(
      this.resourceState.concurrency.max,
      Math.ceil(oldConcurrency * 1.5) // Increase by 50%
    );

    if (newConcurrency > oldConcurrency) {
      this.resourceState.concurrency.current = newConcurrency;
      this.resourceState.concurrency.lastScaled = Date.now();

      const scalingEvent = {
        type: 'scale_up',
        timestamp: Date.now(),
        oldValue: oldConcurrency,
        newValue: newConcurrency,
        reason: 'High resource utilization',
        memoryUsage: this.resourceState.memory.current,
        cpuUsage: this.resourceState.cpu.current,
      };

      this.scalingHistory.push(scalingEvent);
      this.performanceMetrics.scalingEvents++;

      console.log(
        `Scaling up: ${oldConcurrency} -> ${newConcurrency} concurrent requests`
      );
      this.emit('scaledUp', scalingEvent);
    }
  }

  /**
   * Scale down resources
   * @private
   */
  scaleDown() {
    const oldConcurrency = this.resourceState.concurrency.current;
    const newConcurrency = Math.max(
      this.resourceState.concurrency.min,
      Math.floor(oldConcurrency * 0.8) // Decrease by 20%
    );

    if (newConcurrency < oldConcurrency) {
      this.resourceState.concurrency.current = newConcurrency;
      this.resourceState.concurrency.lastScaled = Date.now();

      const scalingEvent = {
        type: 'scale_down',
        timestamp: Date.now(),
        oldValue: oldConcurrency,
        newValue: newConcurrency,
        reason: 'Low resource utilization',
        memoryUsage: this.resourceState.memory.current,
        cpuUsage: this.resourceState.cpu.current,
      };

      this.scalingHistory.push(scalingEvent);
      this.performanceMetrics.scalingEvents++;

      console.log(
        `Scaling down: ${oldConcurrency} -> ${newConcurrency} concurrent requests`
      );
      this.emit('scaledDown', scalingEvent);
    }
  }

  /**
   * Apply resource optimizations
   * @private
   */
  applyResourceOptimizations() {
    const optimizations = [];

    // Memory optimization
    if (
      this.config.enableMemoryOptimization &&
      this.resourceState.memory.current > this.config.memoryThreshold &&
      !this.resourceState.memory.optimized
    ) {
      this.optimizeMemoryUsage();
      optimizations.push('memory');
      this.resourceState.memory.optimized = true;
    }

    // CPU optimization
    if (
      this.config.enableCpuOptimization &&
      this.resourceState.cpu.current > this.config.cpuThreshold &&
      !this.resourceState.cpu.optimized
    ) {
      this.optimizeCpuUsage();
      optimizations.push('cpu');
      this.resourceState.cpu.optimized = true;
    }

    // Reset optimization flags when resources are back to normal
    if (this.resourceState.memory.current < this.config.memoryThreshold * 0.8) {
      this.resourceState.memory.optimized = false;
    }
    if (this.resourceState.cpu.current < this.config.cpuThreshold * 0.8) {
      this.resourceState.cpu.optimized = false;
    }

    if (optimizations.length > 0) {
      const optimizationEvent = {
        timestamp: Date.now(),
        optimizations,
        memoryUsage: this.resourceState.memory.current,
        cpuUsage: this.resourceState.cpu.current,
      };

      this.optimizationHistory.push(optimizationEvent);
      this.performanceMetrics.optimizationEvents++;

      console.log(`Applied optimizations: ${optimizations.join(', ')}`);
      this.emit('optimizationsApplied', optimizationEvent);
    }
  }

  /**
   * Optimize memory usage
   * @private
   */
  optimizeMemoryUsage() {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('Forced garbage collection');
      }

      // Clear any internal caches that might be holding references
      this.clearInternalCaches();

      console.log('Memory optimization applied');
    } catch (error) {
      console.error('Error optimizing memory:', error);
    }
  }

  /**
   * Optimize CPU usage
   * @private
   */
  optimizeCpuUsage() {
    try {
      // Implement CPU optimization strategies
      // This could include reducing concurrent operations,
      // optimizing algorithms, or deferring non-critical tasks

      console.log('CPU optimization applied');
    } catch (error) {
      console.error('Error optimizing CPU:', error);
    }
  }

  /**
   * Clear internal caches to free memory
   * @private
   */
  clearInternalCaches() {
    // Clear scaling and optimization history if they're too large
    if (this.scalingHistory.length > 100) {
      this.scalingHistory = this.scalingHistory.slice(-50);
    }
    if (this.optimizationHistory.length > 100) {
      this.optimizationHistory = this.optimizationHistory.slice(-50);
    }
  }

  /**
   * Optimize garbage collection
   * @private
   */
  optimizeGarbageCollection() {
    try {
      if (global.gc && this.resourceState.memory.current > 0.6) {
        global.gc();
        console.log('Periodic garbage collection executed');
      }
    } catch (error) {
      console.error('Error in garbage collection optimization:', error);
    }
  }

  /**
   * Log current resource status
   * @private
   */
  logResourceStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      memory: `${(this.resourceState.memory.current * 100).toFixed(1)}%`,
      cpu: `${(this.resourceState.cpu.current * 100).toFixed(1)}%`,
      concurrency: this.resourceState.concurrency.current,
      queue: this.resourceState.queue.current,
      resourceUtilization: `${(
        this.performanceMetrics.resourceUtilization * 100
      ).toFixed(1)}%`,
    };

    console.log('Resource Status:', JSON.stringify(status, null, 2));
  }

  /**
   * Get current resource limits
   * @returns {Object} Current resource limits
   */
  getCurrentLimits() {
    return {
      maxConcurrentRequests: this.resourceState.concurrency.current,
      maxQueueSize: this.resourceState.queue.max,
      memoryThreshold: this.resourceState.memory.threshold,
      cpuThreshold: this.resourceState.cpu.threshold,
    };
  }

  /**
   * Update queue status
   * @param {number} currentSize - Current queue size
   */
  updateQueueStatus(currentSize) {
    this.resourceState.queue.current = currentSize;
  }

  /**
   * Track request completion
   * @param {number} responseTime - Response time in milliseconds
   */
  trackRequestCompletion(responseTime) {
    this.performanceMetrics.requestsProcessed++;

    // Update average response time
    const totalRequests = this.performanceMetrics.requestsProcessed;
    const currentAvg = this.performanceMetrics.averageResponseTime;
    this.performanceMetrics.averageResponseTime =
      (currentAvg * (totalRequests - 1) + responseTime) / totalRequests;
  }

  /**
   * Check if system can handle new request
   * @returns {boolean} Whether system can handle new request
   */
  canHandleNewRequest() {
    return (
      this.resourceState.memory.current < this.config.maxMemoryUsage &&
      this.resourceState.queue.current < this.resourceState.queue.max
    );
  }

  /**
   * Get resource status
   * @returns {Object} Current resource status
   */
  getResourceStatus() {
    return {
      memory: {
        current: `${(this.resourceState.memory.current * 100).toFixed(1)}%`,
        peak: `${(this.resourceState.memory.peak * 100).toFixed(1)}%`,
        threshold: `${(this.resourceState.memory.threshold * 100).toFixed(1)}%`,
        optimized: this.resourceState.memory.optimized,
      },
      cpu: {
        current: `${(this.resourceState.cpu.current * 100).toFixed(1)}%`,
        peak: `${(this.resourceState.cpu.peak * 100).toFixed(1)}%`,
        threshold: `${(this.resourceState.cpu.threshold * 100).toFixed(1)}%`,
        optimized: this.resourceState.cpu.optimized,
      },
      concurrency: {
        current: this.resourceState.concurrency.current,
        min: this.resourceState.concurrency.min,
        max: this.resourceState.concurrency.max,
        lastScaled: new Date(
          this.resourceState.concurrency.lastScaled
        ).toISOString(),
      },
      queue: {
        current: this.resourceState.queue.current,
        max: this.resourceState.queue.max,
        threshold: this.resourceState.queue.threshold,
      },
      performance: {
        ...this.performanceMetrics,
        resourceUtilization: `${(
          this.performanceMetrics.resourceUtilization * 100
        ).toFixed(1)}%`,
      },
      monitoring: this.isMonitoring,
    };
  }

  /**
   * Get scaling history
   * @param {number} limit - Number of entries to return
   * @returns {Array} Scaling history
   */
  getScalingHistory(limit = 50) {
    return this.scalingHistory.slice(-limit);
  }

  /**
   * Get optimization history
   * @param {number} limit - Number of entries to return
   * @returns {Array} Optimization history
   */
  getOptimizationHistory(limit = 50) {
    return this.optimizationHistory.slice(-limit);
  }

  /**
   * Reset resource metrics
   */
  resetMetrics() {
    this.resourceState.memory.peak = 0;
    this.resourceState.cpu.peak = 0;
    this.scalingHistory.length = 0;
    this.optimizationHistory.length = 0;
    this.performanceMetrics = {
      requestsProcessed: 0,
      averageResponseTime: 0,
      resourceUtilization: 0,
      scalingEvents: 0,
      optimizationEvents: 0,
    };

    console.log('Resource metrics reset');
    this.emit('metricsReset');
  }

  /**
   * Shutdown resource manager
   */
  shutdown() {
    this.stop();
    this.resetMetrics();
    console.log('ResourceManager shutdown complete');
  }
}

module.exports = ResourceManager;
