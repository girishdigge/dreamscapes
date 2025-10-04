// monitoring/AsyncMetricsTracker.js
// Tracks async-related metrics for Promise detection, extraction, errors, and fallback usage

const EventEmitter = require('events');

/**
 * AsyncMetricsTracker - Tracks metrics related to async/await handling
 * Monitors Promise detection, extraction success, 502 errors, and fallback usage
 */
class AsyncMetricsTracker extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      retentionPeriod: config.retentionPeriod || 86400000, // 24 hours
      aggregationInterval: config.aggregationInterval || 60000, // 1 minute
      enableRealtime: config.enableRealtime !== false,
      ...config,
    };

    // Metrics storage
    this.metrics = {
      promiseDetections: [], // { timestamp, location, provider, context }
      extractions: [], // { timestamp, provider, success, error }
      errors502: [], // { timestamp, provider, reason, context }
      fallbackUsage: [], // { timestamp, provider, reason, fallbackType }
    };

    // Aggregated metrics (per minute)
    this.aggregated = {
      promiseDetections: new Map(), // timestamp -> count
      extractionSuccessRate: new Map(), // timestamp -> { success, total, rate }
      error502Rate: new Map(), // timestamp -> { count, total, rate }
      fallbackUsageRate: new Map(), // timestamp -> { count, total, rate }
    };

    // Realtime counters (current values)
    this.realtime = {
      promiseDetections: 0,
      extractionAttempts: 0,
      extractionSuccesses: 0,
      extractionFailures: 0,
      errors502: 0,
      totalRequests: 0,
      fallbackUsage: 0,
    };

    // Start aggregation interval
    this.aggregationTimer = null;
    if (this.config.enableRealtime) {
      this.startAggregation();
    }

    console.log('AsyncMetricsTracker initialized', { config: this.config });
  }

  /**
   * Record a Promise detection event
   * @param {string} location - Where the Promise was detected (e.g., 'result.content', 'operation result')
   * @param {string} provider - Provider name
   * @param {Object} context - Additional context
   */
  recordPromiseDetection(location, provider = 'unknown', context = {}) {
    const event = {
      timestamp: Date.now(),
      location,
      provider,
      context,
    };

    this.metrics.promiseDetections.push(event);
    this.realtime.promiseDetections++;

    // Emit event for real-time monitoring
    this.emit('promiseDetected', event);

    console.warn('⚠️  Promise detected in async flow', {
      location,
      provider,
      count: this.realtime.promiseDetections,
    });

    // Cleanup old metrics
    this.cleanupOldMetrics();
  }

  /**
   * Record an extraction attempt
   * @param {string} provider - Provider name
   * @param {boolean} success - Whether extraction succeeded
   * @param {string} error - Error message if failed
   */
  recordExtraction(provider, success, error = null) {
    const event = {
      timestamp: Date.now(),
      provider,
      success,
      error,
    };

    this.metrics.extractions.push(event);
    this.realtime.extractionAttempts++;

    if (success) {
      this.realtime.extractionSuccesses++;
    } else {
      this.realtime.extractionFailures++;
    }

    // Emit event for real-time monitoring
    this.emit('extractionAttempt', event);

    // Cleanup old metrics
    this.cleanupOldMetrics();
  }

  /**
   * Record a 502 error
   * @param {string} provider - Provider name
   * @param {string} reason - Reason for 502 error
   * @param {Object} context - Additional context
   */
  record502Error(provider, reason, context = {}) {
    const event = {
      timestamp: Date.now(),
      provider,
      reason,
      context,
    };

    this.metrics.errors502.push(event);
    this.realtime.errors502++;

    // Emit event for real-time monitoring
    this.emit('error502', event);

    console.error('502 error recorded', {
      provider,
      reason,
      totalCount: this.realtime.errors502,
    });

    // Cleanup old metrics
    this.cleanupOldMetrics();
  }

  /**
   * Record a fallback usage
   * @param {string} provider - Original provider that failed (or 'none' if no provider available)
   * @param {string} reason - Reason for fallback
   * @param {string} fallbackType - Type of fallback used (e.g., 'local_generation', 'emergency_repair')
   */
  recordFallbackUsage(provider, reason, fallbackType = 'local_generation') {
    const event = {
      timestamp: Date.now(),
      provider,
      reason,
      fallbackType,
    };

    this.metrics.fallbackUsage.push(event);
    this.realtime.fallbackUsage++;

    // Emit event for real-time monitoring
    this.emit('fallbackUsed', event);

    console.info('Fallback usage recorded', {
      provider,
      reason,
      fallbackType,
      totalCount: this.realtime.fallbackUsage,
    });

    // Cleanup old metrics
    this.cleanupOldMetrics();
  }

  /**
   * Record a request (for calculating rates)
   * @param {string} provider - Provider name
   */
  recordRequest(provider) {
    this.realtime.totalRequests++;
  }

  /**
   * Get current realtime metrics
   * @returns {Object} Realtime metrics
   */
  getRealtimeMetrics() {
    const extractionSuccessRate =
      this.realtime.extractionAttempts > 0
        ? (this.realtime.extractionSuccesses /
            this.realtime.extractionAttempts) *
          100
        : 0;

    const error502Rate =
      this.realtime.totalRequests > 0
        ? (this.realtime.errors502 / this.realtime.totalRequests) * 100
        : 0;

    const fallbackUsageRate =
      this.realtime.totalRequests > 0
        ? (this.realtime.fallbackUsage / this.realtime.totalRequests) * 100
        : 0;

    return {
      promiseDetections: this.realtime.promiseDetections,
      extraction: {
        attempts: this.realtime.extractionAttempts,
        successes: this.realtime.extractionSuccesses,
        failures: this.realtime.extractionFailures,
        successRate: extractionSuccessRate.toFixed(2) + '%',
      },
      errors502: {
        count: this.realtime.errors502,
        rate: error502Rate.toFixed(2) + '%',
      },
      fallback: {
        count: this.realtime.fallbackUsage,
        rate: fallbackUsageRate.toFixed(2) + '%',
      },
      totalRequests: this.realtime.totalRequests,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get aggregated metrics for a time range
   * @param {number} timeRangeMs - Time range in milliseconds (default: 1 hour)
   * @returns {Object} Aggregated metrics
   */
  getAggregatedMetrics(timeRangeMs = 3600000) {
    const now = Date.now();
    const startTime = now - timeRangeMs;

    // Filter metrics within time range
    const promiseDetections = this.metrics.promiseDetections.filter(
      (e) => e.timestamp >= startTime
    );
    const extractions = this.metrics.extractions.filter(
      (e) => e.timestamp >= startTime
    );
    const errors502 = this.metrics.errors502.filter(
      (e) => e.timestamp >= startTime
    );
    const fallbackUsage = this.metrics.fallbackUsage.filter(
      (e) => e.timestamp >= startTime
    );

    // Calculate rates
    const extractionSuccesses = extractions.filter((e) => e.success).length;
    const extractionSuccessRate =
      extractions.length > 0
        ? (extractionSuccesses / extractions.length) * 100
        : 0;

    // Estimate total requests (use extraction attempts as proxy)
    const totalRequests = extractions.length || 1;
    const error502Rate = (errors502.length / totalRequests) * 100;
    const fallbackUsageRate = (fallbackUsage.length / totalRequests) * 100;

    return {
      timeRange: {
        start: new Date(startTime).toISOString(),
        end: new Date(now).toISOString(),
        durationMs: timeRangeMs,
      },
      promiseDetections: {
        count: promiseDetections.length,
        byProvider: this.groupByProvider(promiseDetections),
        byLocation: this.groupByLocation(promiseDetections),
      },
      extraction: {
        attempts: extractions.length,
        successes: extractionSuccesses,
        failures: extractions.length - extractionSuccesses,
        successRate: extractionSuccessRate.toFixed(2) + '%',
        byProvider: this.groupExtractionsByProvider(extractions),
      },
      errors502: {
        count: errors502.length,
        rate: error502Rate.toFixed(2) + '%',
        byProvider: this.groupByProvider(errors502),
        byReason: this.groupByReason(errors502),
      },
      fallback: {
        count: fallbackUsage.length,
        rate: fallbackUsageRate.toFixed(2) + '%',
        byProvider: this.groupByProvider(fallbackUsage),
        byType: this.groupByFallbackType(fallbackUsage),
        byReason: this.groupByReason(fallbackUsage),
      },
      totalRequests,
    };
  }

  /**
   * Get metrics by provider
   * @param {string} provider - Provider name
   * @param {number} timeRangeMs - Time range in milliseconds
   * @returns {Object} Provider-specific metrics
   */
  getProviderMetrics(provider, timeRangeMs = 3600000) {
    const now = Date.now();
    const startTime = now - timeRangeMs;

    const promiseDetections = this.metrics.promiseDetections.filter(
      (e) => e.timestamp >= startTime && e.provider === provider
    );
    const extractions = this.metrics.extractions.filter(
      (e) => e.timestamp >= startTime && e.provider === provider
    );
    const errors502 = this.metrics.errors502.filter(
      (e) => e.timestamp >= startTime && e.provider === provider
    );
    const fallbackUsage = this.metrics.fallbackUsage.filter(
      (e) => e.timestamp >= startTime && e.provider === provider
    );

    const extractionSuccesses = extractions.filter((e) => e.success).length;
    const extractionSuccessRate =
      extractions.length > 0
        ? (extractionSuccesses / extractions.length) * 100
        : 0;

    return {
      provider,
      timeRange: {
        start: new Date(startTime).toISOString(),
        end: new Date(now).toISOString(),
      },
      promiseDetections: promiseDetections.length,
      extraction: {
        attempts: extractions.length,
        successes: extractionSuccesses,
        failures: extractions.length - extractionSuccesses,
        successRate: extractionSuccessRate.toFixed(2) + '%',
      },
      errors502: errors502.length,
      fallbackUsage: fallbackUsage.length,
    };
  }

  /**
   * Start aggregation timer
   * @private
   */
  startAggregation() {
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.config.aggregationInterval);

    console.log('AsyncMetricsTracker aggregation started', {
      interval: this.config.aggregationInterval,
    });
  }

  /**
   * Stop aggregation timer
   */
  stopAggregation() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
      console.log('AsyncMetricsTracker aggregation stopped');
    }
  }

  /**
   * Aggregate metrics for the current minute
   * @private
   */
  aggregateMetrics() {
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000) * 60000; // Round to minute

    // Aggregate promise detections
    const recentPromises = this.metrics.promiseDetections.filter(
      (e) => e.timestamp >= minuteKey && e.timestamp < minuteKey + 60000
    );
    this.aggregated.promiseDetections.set(minuteKey, recentPromises.length);

    // Aggregate extraction success rate
    const recentExtractions = this.metrics.extractions.filter(
      (e) => e.timestamp >= minuteKey && e.timestamp < minuteKey + 60000
    );
    const successes = recentExtractions.filter((e) => e.success).length;
    this.aggregated.extractionSuccessRate.set(minuteKey, {
      success: successes,
      total: recentExtractions.length,
      rate:
        recentExtractions.length > 0
          ? (successes / recentExtractions.length) * 100
          : 0,
    });

    // Aggregate 502 error rate
    const recent502 = this.metrics.errors502.filter(
      (e) => e.timestamp >= minuteKey && e.timestamp < minuteKey + 60000
    );
    const totalRequests = recentExtractions.length || 1;
    this.aggregated.error502Rate.set(minuteKey, {
      count: recent502.length,
      total: totalRequests,
      rate: (recent502.length / totalRequests) * 100,
    });

    // Aggregate fallback usage rate
    const recentFallback = this.metrics.fallbackUsage.filter(
      (e) => e.timestamp >= minuteKey && e.timestamp < minuteKey + 60000
    );
    this.aggregated.fallbackUsageRate.set(minuteKey, {
      count: recentFallback.length,
      total: totalRequests,
      rate: (recentFallback.length / totalRequests) * 100,
    });

    // Emit aggregated metrics event
    this.emit('metricsAggregated', {
      timestamp: minuteKey,
      promiseDetections: recentPromises.length,
      extractionSuccessRate:
        this.aggregated.extractionSuccessRate.get(minuteKey),
      error502Rate: this.aggregated.error502Rate.get(minuteKey),
      fallbackUsageRate: this.aggregated.fallbackUsageRate.get(minuteKey),
    });

    // Cleanup old aggregated metrics
    this.cleanupOldAggregatedMetrics();
  }

  /**
   * Get time series data for charting
   * @param {string} metric - Metric name ('promiseDetections', 'extractionSuccessRate', 'error502Rate', 'fallbackUsageRate')
   * @param {number} timeRangeMs - Time range in milliseconds
   * @returns {Array} Time series data
   */
  getTimeSeries(metric, timeRangeMs = 3600000) {
    const now = Date.now();
    const startTime = now - timeRangeMs;

    const aggregatedMap = this.aggregated[metric];
    if (!aggregatedMap) {
      return [];
    }

    const timeSeries = [];
    for (const [timestamp, value] of aggregatedMap.entries()) {
      if (timestamp >= startTime) {
        timeSeries.push({
          timestamp: new Date(timestamp).toISOString(),
          value: typeof value === 'object' ? value.rate : value,
          raw: value,
        });
      }
    }

    return timeSeries.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }

  /**
   * Group events by provider
   * @private
   */
  groupByProvider(events) {
    const grouped = {};
    for (const event of events) {
      const provider = event.provider || 'unknown';
      grouped[provider] = (grouped[provider] || 0) + 1;
    }
    return grouped;
  }

  /**
   * Group events by location
   * @private
   */
  groupByLocation(events) {
    const grouped = {};
    for (const event of events) {
      const location = event.location || 'unknown';
      grouped[location] = (grouped[location] || 0) + 1;
    }
    return grouped;
  }

  /**
   * Group events by reason
   * @private
   */
  groupByReason(events) {
    const grouped = {};
    for (const event of events) {
      const reason = event.reason || 'unknown';
      grouped[reason] = (grouped[reason] || 0) + 1;
    }
    return grouped;
  }

  /**
   * Group events by fallback type
   * @private
   */
  groupByFallbackType(events) {
    const grouped = {};
    for (const event of events) {
      const type = event.fallbackType || 'unknown';
      grouped[type] = (grouped[type] || 0) + 1;
    }
    return grouped;
  }

  /**
   * Group extractions by provider with success/failure counts
   * @private
   */
  groupExtractionsByProvider(extractions) {
    const grouped = {};
    for (const event of extractions) {
      const provider = event.provider || 'unknown';
      if (!grouped[provider]) {
        grouped[provider] = { successes: 0, failures: 0, total: 0 };
      }
      grouped[provider].total++;
      if (event.success) {
        grouped[provider].successes++;
      } else {
        grouped[provider].failures++;
      }
    }

    // Add success rate
    for (const provider in grouped) {
      const data = grouped[provider];
      data.successRate = ((data.successes / data.total) * 100).toFixed(2) + '%';
    }

    return grouped;
  }

  /**
   * Cleanup old metrics beyond retention period
   * @private
   */
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.config.retentionPeriod;

    this.metrics.promiseDetections = this.metrics.promiseDetections.filter(
      (e) => e.timestamp >= cutoff
    );
    this.metrics.extractions = this.metrics.extractions.filter(
      (e) => e.timestamp >= cutoff
    );
    this.metrics.errors502 = this.metrics.errors502.filter(
      (e) => e.timestamp >= cutoff
    );
    this.metrics.fallbackUsage = this.metrics.fallbackUsage.filter(
      (e) => e.timestamp >= cutoff
    );
  }

  /**
   * Cleanup old aggregated metrics
   * @private
   */
  cleanupOldAggregatedMetrics() {
    const cutoff = Date.now() - this.config.retentionPeriod;

    for (const [timestamp] of this.aggregated.promiseDetections.entries()) {
      if (timestamp < cutoff) {
        this.aggregated.promiseDetections.delete(timestamp);
      }
    }

    for (const [timestamp] of this.aggregated.extractionSuccessRate.entries()) {
      if (timestamp < cutoff) {
        this.aggregated.extractionSuccessRate.delete(timestamp);
      }
    }

    for (const [timestamp] of this.aggregated.error502Rate.entries()) {
      if (timestamp < cutoff) {
        this.aggregated.error502Rate.delete(timestamp);
      }
    }

    for (const [timestamp] of this.aggregated.fallbackUsageRate.entries()) {
      if (timestamp < cutoff) {
        this.aggregated.fallbackUsageRate.delete(timestamp);
      }
    }
  }

  /**
   * Export all metrics
   * @returns {Object} All metrics data
   */
  exportMetrics() {
    return {
      realtime: this.getRealtimeMetrics(),
      aggregated: {
        promiseDetections: Array.from(
          this.aggregated.promiseDetections.entries()
        ),
        extractionSuccessRate: Array.from(
          this.aggregated.extractionSuccessRate.entries()
        ),
        error502Rate: Array.from(this.aggregated.error502Rate.entries()),
        fallbackUsageRate: Array.from(
          this.aggregated.fallbackUsageRate.entries()
        ),
      },
      raw: {
        promiseDetections: this.metrics.promiseDetections.length,
        extractions: this.metrics.extractions.length,
        errors502: this.metrics.errors502.length,
        fallbackUsage: this.metrics.fallbackUsage.length,
      },
      config: this.config,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      promiseDetections: [],
      extractions: [],
      errors502: [],
      fallbackUsage: [],
    };

    this.aggregated = {
      promiseDetections: new Map(),
      extractionSuccessRate: new Map(),
      error502Rate: new Map(),
      fallbackUsageRate: new Map(),
    };

    this.realtime = {
      promiseDetections: 0,
      extractionAttempts: 0,
      extractionSuccesses: 0,
      extractionFailures: 0,
      errors502: 0,
      totalRequests: 0,
      fallbackUsage: 0,
    };

    console.log('AsyncMetricsTracker metrics reset');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopAggregation();
    this.removeAllListeners();
    console.log('AsyncMetricsTracker destroyed');
  }
}

module.exports = AsyncMetricsTracker;
