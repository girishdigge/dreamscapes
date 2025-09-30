// providers/EnhancedCircuitBreaker.js
// Enhanced Circuit Breaker with advanced failure detection and recovery

const EventEmitter = require('events');

/**
 * Enhanced Circuit Breaker for provider fault tolerance
 * Implements advanced failure detection, sliding window analysis, and adaptive recovery
 */
class EnhancedCircuitBreaker extends EventEmitter {
  constructor(name, options = {}) {
    super();

    this.name = name;
    this.threshold = options.threshold || 5;
    this.timeout = options.timeout || 60000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;

    // Enhanced circuit breaker features
    this.consecutiveFailures = 0;
    this.totalRequests = 0;
    this.totalSuccesses = 0;
    this.failureRate = 0;
    this.lastStateChange = Date.now();
    this.halfOpenMaxRequests = options.halfOpenMaxRequests || 3;
    this.halfOpenRequestCount = 0;
    this.adaptiveThreshold = options.adaptiveThreshold !== false;
    this.minRequestsForFailureRate = options.minRequestsForFailureRate || 10;
    this.failureRateThreshold = options.failureRateThreshold || 0.5; // 50%

    // Sliding window for failure rate calculation
    this.slidingWindow = [];
    this.windowSize = options.windowSize || 100;
    this.windowTimeMs = options.windowTimeMs || 300000; // 5 minutes

    // Advanced metrics
    this.metrics = {
      totalOpens: 0,
      totalCloses: 0,
      totalHalfOpens: 0,
      averageRecoveryTime: 0,
      lastRecoveryTime: null,
      recoveryTimes: [],
    };
  }

  /**
   * Check if the circuit breaker allows execution
   * @returns {boolean} True if execution is allowed
   */
  canExecute() {
    const now = Date.now();

    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      // Check if timeout period has passed
      if (now - this.lastFailureTime >= this.timeout) {
        this.transitionToHalfOpen();
        return true;
      }
      return false;
    }

    if (this.state === 'HALF_OPEN') {
      // Limit requests in half-open state
      return this.halfOpenRequestCount < this.halfOpenMaxRequests;
    }

    return false;
  }

  /**
   * Record a successful operation
   */
  recordSuccess() {
    const now = Date.now();
    this.totalRequests++;
    this.totalSuccesses++;
    this.consecutiveFailures = 0;

    // Add to sliding window
    this.addToSlidingWindow(true, now);

    // Update failure rate
    this.updateFailureRate();

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      this.halfOpenRequestCount++;

      // Calculate required successes for recovery
      const requiredSuccesses = this.calculateRequiredSuccesses();
      if (this.successCount >= requiredSuccesses) {
        this.transitionToClosed();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in closed state
      this.failures = 0;
    }

    this.emit('success', {
      provider: this.name,
      state: this.state,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
    });
  }

  /**
   * Record a failed operation
   */
  recordFailure() {
    const now = Date.now();
    this.totalRequests++;
    this.failures++;
    this.consecutiveFailures++;
    this.lastFailureTime = now;

    // Add to sliding window
    this.addToSlidingWindow(false, now);

    // Update failure rate
    this.updateFailureRate();

    if (this.state === 'HALF_OPEN') {
      this.halfOpenRequestCount++;
      // Any failure in half-open state opens the circuit
      this.transitionToOpen();
    } else if (this.state === 'CLOSED') {
      // Check if we should open the circuit
      if (this.shouldOpenCircuit()) {
        this.transitionToOpen();
      }
    }

    this.emit('failure', {
      provider: this.name,
      state: this.state,
      failures: this.failures,
      consecutiveFailures: this.consecutiveFailures,
      failureRate: this.failureRate,
    });
  }

  /**
   * Determine if circuit should open based on multiple criteria
   * @private
   */
  shouldOpenCircuit() {
    // Traditional threshold-based check
    if (this.consecutiveFailures >= this.threshold) {
      return true;
    }

    // Adaptive failure rate check
    if (
      this.adaptiveThreshold &&
      this.totalRequests >= this.minRequestsForFailureRate
    ) {
      if (this.failureRate >= this.failureRateThreshold) {
        console.log(
          `Circuit breaker opening for ${
            this.name
          } due to high failure rate: ${(this.failureRate * 100).toFixed(1)}%`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate required successes to close circuit based on recent performance
   * @private
   */
  calculateRequiredSuccesses() {
    // Base requirement is 1 success for faster recovery
    let required = 1;

    // Increase requirement based on recent failure rate
    if (this.failureRate > 0.7) {
      required = 3;
    } else if (this.failureRate > 0.5) {
      required = 2;
    }

    return required;
  }

  /**
   * Add request result to sliding window
   * @private
   */
  addToSlidingWindow(success, timestamp) {
    this.slidingWindow.push({ success, timestamp });

    // Remove old entries outside the time window
    const cutoff = timestamp - this.windowTimeMs;
    this.slidingWindow = this.slidingWindow.filter(
      (entry) => entry.timestamp > cutoff
    );

    // Limit window size
    if (this.slidingWindow.length > this.windowSize) {
      this.slidingWindow = this.slidingWindow.slice(-this.windowSize);
    }
  }

  /**
   * Update failure rate based on sliding window
   * @private
   */
  updateFailureRate() {
    if (this.slidingWindow.length === 0) {
      this.failureRate = 0;
      return;
    }

    const failures = this.slidingWindow.filter(
      (entry) => !entry.success
    ).length;
    this.failureRate = failures / this.slidingWindow.length;
  }

  /**
   * State transition methods
   * @private
   */
  transitionToOpen() {
    if (this.state !== 'OPEN') {
      const previousState = this.state;
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
      this.halfOpenRequestCount = 0;
      this.metrics.totalOpens++;

      console.log(
        `Circuit breaker opened for ${this.name} (${
          this.consecutiveFailures
        } consecutive failures, ${(this.failureRate * 100).toFixed(
          1
        )}% failure rate)`
      );

      this.emit('stateChange', {
        provider: this.name,
        previousState,
        newState: 'OPEN',
        reason: 'failure_threshold_exceeded',
        consecutiveFailures: this.consecutiveFailures,
        failureRate: this.failureRate,
      });
    }
  }

  transitionToHalfOpen() {
    if (this.state !== 'HALF_OPEN') {
      const previousState = this.state;
      this.state = 'HALF_OPEN';
      this.lastStateChange = Date.now();
      this.successCount = 0;
      this.halfOpenRequestCount = 0;
      this.metrics.totalHalfOpens++;

      console.log(
        `Circuit breaker transitioning to half-open for ${this.name}`
      );

      this.emit('stateChange', {
        provider: this.name,
        previousState,
        newState: 'HALF_OPEN',
        reason: 'timeout_expired',
        timeInPreviousState: Date.now() - this.lastStateChange,
      });
    }
  }

  transitionToClosed() {
    if (this.state !== 'CLOSED') {
      const previousState = this.state;
      const recoveryTime = Date.now() - this.lastStateChange;

      this.state = 'CLOSED';
      this.lastStateChange = Date.now();
      this.failures = 0;
      this.consecutiveFailures = 0;
      this.successCount = 0;
      this.halfOpenRequestCount = 0;
      this.metrics.totalCloses++;
      this.metrics.lastRecoveryTime = recoveryTime;
      this.metrics.recoveryTimes.push(recoveryTime);

      // Calculate average recovery time
      if (this.metrics.recoveryTimes.length > 0) {
        this.metrics.averageRecoveryTime =
          this.metrics.recoveryTimes.reduce((sum, time) => sum + time, 0) /
          this.metrics.recoveryTimes.length;
      }

      // Keep only recent recovery times
      if (this.metrics.recoveryTimes.length > 10) {
        this.metrics.recoveryTimes = this.metrics.recoveryTimes.slice(-10);
      }

      console.log(
        `Circuit breaker closed for ${this.name} (recovered in ${recoveryTime}ms)`
      );

      this.emit('stateChange', {
        provider: this.name,
        previousState,
        newState: 'CLOSED',
        reason: 'recovery_successful',
        recoveryTime,
        successesRequired: this.calculateRequiredSuccesses(),
      });
    }
  }

  /**
   * Get comprehensive circuit breaker state
   */
  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      totalSuccesses: this.totalSuccesses,
      failureRate: this.failureRate,
      lastStateChange: this.lastStateChange,
      halfOpenRequestCount: this.halfOpenRequestCount,
      halfOpenMaxRequests: this.halfOpenMaxRequests,
      slidingWindowSize: this.slidingWindow.length,
      timeInCurrentState: Date.now() - this.lastStateChange,
      threshold: this.threshold,
      timeout: this.timeout,
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset() {
    const previousState = this.state;

    this.state = 'CLOSED';
    this.failures = 0;
    this.consecutiveFailures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
    this.totalRequests = 0;
    this.totalSuccesses = 0;
    this.failureRate = 0;
    this.lastStateChange = Date.now();
    this.halfOpenRequestCount = 0;
    this.slidingWindow = [];

    console.log(`Circuit breaker reset for ${this.name}`);

    this.emit('reset', {
      provider: this.name,
      previousState,
    });
  }

  /**
   * Get circuit breaker statistics
   */
  getStatistics() {
    const now = Date.now();
    const timeInState = now - this.lastStateChange;

    return {
      name: this.name,
      state: this.state,
      timeInCurrentState: timeInState,
      totalRequests: this.totalRequests,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalRequests - this.totalSuccesses,
      successRate:
        this.totalRequests > 0 ? this.totalSuccesses / this.totalRequests : 0,
      failureRate: this.failureRate,
      consecutiveFailures: this.consecutiveFailures,
      lastFailureTime: this.lastFailureTime,
      threshold: this.threshold,
      timeout: this.timeout,
      metrics: { ...this.metrics },
      slidingWindowStats: {
        size: this.slidingWindow.length,
        maxSize: this.windowSize,
        timeWindow: this.windowTimeMs,
        recentFailureRate: this.failureRate,
      },
      configuration: {
        threshold: this.threshold,
        timeout: this.timeout,
        halfOpenMaxRequests: this.halfOpenMaxRequests,
        adaptiveThreshold: this.adaptiveThreshold,
        minRequestsForFailureRate: this.minRequestsForFailureRate,
        failureRateThreshold: this.failureRateThreshold,
        windowSize: this.windowSize,
        windowTimeMs: this.windowTimeMs,
      },
    };
  }

  /**
   * Update circuit breaker configuration
   */
  updateConfiguration(options = {}) {
    if (options.threshold !== undefined) this.threshold = options.threshold;
    if (options.timeout !== undefined) this.timeout = options.timeout;
    if (options.halfOpenMaxRequests !== undefined)
      this.halfOpenMaxRequests = options.halfOpenMaxRequests;
    if (options.adaptiveThreshold !== undefined)
      this.adaptiveThreshold = options.adaptiveThreshold;
    if (options.minRequestsForFailureRate !== undefined)
      this.minRequestsForFailureRate = options.minRequestsForFailureRate;
    if (options.failureRateThreshold !== undefined)
      this.failureRateThreshold = options.failureRateThreshold;
    if (options.windowSize !== undefined) this.windowSize = options.windowSize;
    if (options.windowTimeMs !== undefined)
      this.windowTimeMs = options.windowTimeMs;

    this.emit('configurationUpdated', {
      provider: this.name,
      configuration: this.getStatistics().configuration,
    });
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const stats = this.getStatistics();
    let healthStatus = 'healthy';

    if (this.state === 'OPEN') {
      healthStatus = 'unhealthy';
    } else if (this.state === 'HALF_OPEN') {
      healthStatus = 'recovering';
    } else if (this.failureRate > 0.3) {
      healthStatus = 'degraded';
    }

    return {
      status: healthStatus,
      state: this.state,
      failureRate: this.failureRate,
      consecutiveFailures: this.consecutiveFailures,
      timeInCurrentState: stats.timeInCurrentState,
      lastFailureTime: this.lastFailureTime,
      isHealthy: healthStatus === 'healthy',
    };
  }
}

module.exports = EnhancedCircuitBreaker;
