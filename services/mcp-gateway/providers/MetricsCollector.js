// providers/MetricsCollector.js
// Advanced metrics collection and analysis system

const EventEmitter = require('events');

/**
 * Metrics Collector - Advanced metrics collection, aggregation, and analysis
 */
class MetricsCollector extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      aggregationInterval: config.aggregationInterval || 60000, // 1 minute
      retentionPeriod: config.retentionPeriod || 86400000, // 24 hours
      bucketSize: config.bucketSize || 60000, // 1 minute buckets
      enableRealTimeMetrics: config.enableRealTimeMetrics !== false,
      ...config,
    };

    // Raw metrics storage
    this.rawMetrics = new Map(); // provider_name -> metrics_array
    this.aggregatedMetrics = new Map(); // provider_name -> aggregated_data
    this.realtimeMetrics = new Map(); // provider_name -> current_window_data

    // Aggregation state
    this.isAggregating = false;
    this.aggregationInterval = null;
    this.lastAggregation = Date.now();

    // Performance tracking
    this.performanceBaselines = new Map(); // provider_name -> baseline_data
    this.anomalies = new Map(); // provider_name -> anomaly_data

    console.log('MetricsCollector initialized with config:', this.config);

    if (this.config.enableRealTimeMetrics) {
      this.startAggregation();
    }
  }

  /**
   * Initialize metrics collection for a provider
   * @param {string} providerName - Provider name
   */
  initializeProvider(providerName) {
    this.rawMetrics.set(providerName, []);
    this.aggregatedMetrics.set(providerName, new Map()); // timestamp -> aggregated_data
    this.realtimeMetrics.set(providerName, {
      windowStart: Date.now(),
      requests: 0,
      successes: 0,
      failures: 0,
      totalResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      errors: new Map(), // error_type -> count
      statusCodes: new Map(), // status_code -> count
      tokenUsage: {
        input: 0,
        output: 0,
        total: 0,
      },
    });

    this.performanceBaselines.set(providerName, {
      avgResponseTime: null,
      successRate: null,
      throughput: null,
      lastCalculated: null,
    });

    this.anomalies.set(providerName, []);

    console.log(`Metrics collection initialized for provider: ${providerName}`);
    this.emit('providerInitialized', { provider: providerName });
  }

  /**
   * Remove provider from metrics collection
   * @param {string} providerName - Provider name
   */
  removeProvider(providerName) {
    this.rawMetrics.delete(providerName);
    this.aggregatedMetrics.delete(providerName);
    this.realtimeMetrics.delete(providerName);
    this.performanceBaselines.delete(providerName);
    this.anomalies.delete(providerName);

    console.log(`Provider removed from metrics collection: ${providerName}`);
    this.emit('providerRemoved', { provider: providerName });
  }

  /**
   * Record a request metric
   * @param {string} providerName - Provider name
   * @param {Object} metric - Metric data
   */
  recordRequest(providerName, metric) {
    const timestamp = Date.now();
    const fullMetric = {
      timestamp,
      type: 'request',
      provider: providerName,
      success: metric.success,
      responseTime: metric.responseTime,
      statusCode: metric.statusCode,
      error: metric.error,
      errorType: metric.errorType,
      tokenUsage: metric.tokenUsage || metric.tokens || {},
      model: metric.model,
      endpoint: metric.endpoint,
      requestSize: metric.requestSize,
      responseSize: metric.responseSize,
      ...metric,
    };

    // Store raw metric
    const rawMetrics = this.rawMetrics.get(providerName);
    if (rawMetrics) {
      rawMetrics.push(fullMetric);

      // Limit raw metrics size
      if (rawMetrics.length > 10000) {
        rawMetrics.splice(0, rawMetrics.length - 10000);
      }
    }

    // Update real-time metrics
    this.updateRealtimeMetrics(providerName, fullMetric);

    // Check for anomalies
    this.detectAnomalies(providerName, fullMetric);

    this.emit('metricRecorded', fullMetric);
  }

  /**
   * Record a health check metric
   * @param {string} providerName - Provider name
   * @param {Object} metric - Health check data
   */
  recordHealthCheck(providerName, metric) {
    const timestamp = Date.now();
    const fullMetric = {
      timestamp,
      type: 'health_check',
      provider: providerName,
      isHealthy: metric.isHealthy,
      responseTime: metric.responseTime,
      error: metric.error,
      consecutiveFailures: metric.consecutiveFailures,
      ...metric,
    };

    // Store raw metric
    const rawMetrics = this.rawMetrics.get(providerName);
    if (rawMetrics) {
      rawMetrics.push(fullMetric);
    }

    this.emit('healthMetricRecorded', fullMetric);
  }

  /**
   * Update real-time metrics window
   * @private
   */
  updateRealtimeMetrics(providerName, metric) {
    const realtimeData = this.realtimeMetrics.get(providerName);
    if (!realtimeData) return;

    // Check if we need to reset the window
    const windowDuration = Date.now() - realtimeData.windowStart;
    if (windowDuration >= this.config.bucketSize) {
      // Emit current window data before reset
      this.emit('realtimeWindow', {
        provider: providerName,
        windowStart: realtimeData.windowStart,
        windowEnd: Date.now(),
        duration: windowDuration,
        ...realtimeData,
      });

      // Reset window
      realtimeData.windowStart = Date.now();
      realtimeData.requests = 0;
      realtimeData.successes = 0;
      realtimeData.failures = 0;
      realtimeData.totalResponseTime = 0;
      realtimeData.minResponseTime = Infinity;
      realtimeData.maxResponseTime = 0;
      realtimeData.errors.clear();
      realtimeData.statusCodes.clear();
      realtimeData.tokenUsage = { input: 0, output: 0, total: 0 };
    }

    // Update current window
    if (metric.type === 'request') {
      realtimeData.requests++;

      if (metric.success) {
        realtimeData.successes++;
      } else {
        realtimeData.failures++;

        // Track error types
        if (metric.errorType) {
          const errorCount = realtimeData.errors.get(metric.errorType) || 0;
          realtimeData.errors.set(metric.errorType, errorCount + 1);
        }
      }

      // Track response times
      if (typeof metric.responseTime === 'number') {
        realtimeData.totalResponseTime += metric.responseTime;
        realtimeData.minResponseTime = Math.min(
          realtimeData.minResponseTime,
          metric.responseTime
        );
        realtimeData.maxResponseTime = Math.max(
          realtimeData.maxResponseTime,
          metric.responseTime
        );
      }

      // Track status codes
      if (metric.statusCode) {
        const statusCount =
          realtimeData.statusCodes.get(metric.statusCode) || 0;
        realtimeData.statusCodes.set(metric.statusCode, statusCount + 1);
      }

      // Track token usage
      if (metric.tokenUsage) {
        realtimeData.tokenUsage.input += metric.tokenUsage.input || 0;
        realtimeData.tokenUsage.output += metric.tokenUsage.output || 0;
        realtimeData.tokenUsage.total += metric.tokenUsage.total || 0;
      }
    }
  }

  /**
   * Start metrics aggregation
   */
  startAggregation() {
    if (this.isAggregating) {
      console.log('Metrics aggregation is already running');
      return;
    }

    this.isAggregating = true;
    this.aggregationInterval = setInterval(() => {
      this.performAggregation();
    }, this.config.aggregationInterval);

    console.log(
      `Metrics aggregation started (interval: ${this.config.aggregationInterval}ms)`
    );
    this.emit('aggregationStarted');
  }

  /**
   * Stop metrics aggregation
   */
  stopAggregation() {
    if (!this.isAggregating) {
      console.log('Metrics aggregation is not running');
      return;
    }

    this.isAggregating = false;
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }

    console.log('Metrics aggregation stopped');
    this.emit('aggregationStopped');
  }

  /**
   * Perform metrics aggregation
   * @private
   */
  async performAggregation() {
    const now = Date.now();
    const bucketStart =
      Math.floor(now / this.config.bucketSize) * this.config.bucketSize;

    for (const [providerName, rawMetrics] of this.rawMetrics) {
      try {
        await this.aggregateProviderMetrics(
          providerName,
          rawMetrics,
          bucketStart
        );
      } catch (error) {
        console.error(`Aggregation error for ${providerName}:`, error.message);
      }
    }

    // Update performance baselines
    this.updatePerformanceBaselines();

    // Cleanup old data
    this.cleanupOldData();

    this.lastAggregation = now;
    this.emit('aggregationCompleted', { timestamp: now });
  }

  /**
   * Aggregate metrics for a specific provider
   * @private
   */
  async aggregateProviderMetrics(providerName, rawMetrics, bucketStart) {
    const bucketEnd = bucketStart + this.config.bucketSize;
    const bucketMetrics = rawMetrics.filter(
      (m) => m.timestamp >= bucketStart && m.timestamp < bucketEnd
    );

    if (bucketMetrics.length === 0) return;

    const requestMetrics = bucketMetrics.filter((m) => m.type === 'request');
    const healthMetrics = bucketMetrics.filter(
      (m) => m.type === 'health_check'
    );

    const aggregated = {
      timestamp: bucketStart,
      duration: this.config.bucketSize,
      requests: {
        total: requestMetrics.length,
        successful: requestMetrics.filter((m) => m.success).length,
        failed: requestMetrics.filter((m) => !m.success).length,
        successRate: 0,
        failureRate: 0,
      },
      responseTime: {
        avg: 0,
        min: Infinity,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      },
      throughput: {
        requestsPerSecond: 0,
        tokensPerSecond: 0,
      },
      errors: new Map(),
      statusCodes: new Map(),
      models: new Map(),
      tokenUsage: {
        input: 0,
        output: 0,
        total: 0,
      },
      health: {
        checks: healthMetrics.length,
        healthy: healthMetrics.filter((m) => m.isHealthy).length,
        unhealthy: healthMetrics.filter((m) => !m.isHealthy).length,
        avgResponseTime: 0,
      },
    };

    // Calculate request metrics
    if (requestMetrics.length > 0) {
      aggregated.requests.successRate =
        aggregated.requests.successful / aggregated.requests.total;
      aggregated.requests.failureRate =
        aggregated.requests.failed / aggregated.requests.total;

      // Response time statistics
      const responseTimes = requestMetrics
        .map((m) => m.responseTime)
        .filter((t) => typeof t === 'number')
        .sort((a, b) => a - b);

      if (responseTimes.length > 0) {
        aggregated.responseTime.avg =
          responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
        aggregated.responseTime.min = responseTimes[0];
        aggregated.responseTime.max = responseTimes[responseTimes.length - 1];
        aggregated.responseTime.p50 = this.calculatePercentile(
          responseTimes,
          0.5
        );
        aggregated.responseTime.p95 = this.calculatePercentile(
          responseTimes,
          0.95
        );
        aggregated.responseTime.p99 = this.calculatePercentile(
          responseTimes,
          0.99
        );
      }

      // Throughput
      const durationSeconds = this.config.bucketSize / 1000;
      aggregated.throughput.requestsPerSecond =
        requestMetrics.length / durationSeconds;

      // Error aggregation
      for (const metric of requestMetrics) {
        if (!metric.success && metric.errorType) {
          const count = aggregated.errors.get(metric.errorType) || 0;
          aggregated.errors.set(metric.errorType, count + 1);
        }

        if (metric.statusCode) {
          const count = aggregated.statusCodes.get(metric.statusCode) || 0;
          aggregated.statusCodes.set(metric.statusCode, count + 1);
        }

        if (metric.model) {
          const count = aggregated.models.get(metric.model) || 0;
          aggregated.models.set(metric.model, count + 1);
        }

        if (metric.tokenUsage) {
          aggregated.tokenUsage.input += metric.tokenUsage.input || 0;
          aggregated.tokenUsage.output += metric.tokenUsage.output || 0;
          aggregated.tokenUsage.total += metric.tokenUsage.total || 0;
        }
      }

      aggregated.throughput.tokensPerSecond =
        aggregated.tokenUsage.total / durationSeconds;
    }

    // Calculate health metrics
    if (healthMetrics.length > 0) {
      const healthResponseTimes = healthMetrics
        .map((m) => m.responseTime)
        .filter((t) => typeof t === 'number');

      if (healthResponseTimes.length > 0) {
        aggregated.health.avgResponseTime =
          healthResponseTimes.reduce((sum, t) => sum + t, 0) /
          healthResponseTimes.length;
      }
    }

    // Store aggregated data
    const aggregatedData = this.aggregatedMetrics.get(providerName);
    if (aggregatedData) {
      aggregatedData.set(bucketStart, aggregated);

      // Limit aggregated data size
      if (aggregatedData.size > 1440) {
        // 24 hours of minute buckets
        const oldestKey = Math.min(...aggregatedData.keys());
        aggregatedData.delete(oldestKey);
      }
    }

    this.emit('providerAggregated', {
      provider: providerName,
      bucket: bucketStart,
      data: aggregated,
    });
  }

  /**
   * Calculate percentile from sorted array
   * @private
   */
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    if (sortedArray.length === 1) return sortedArray[0];

    // Use linear interpolation for more accurate percentiles
    const index = (sortedArray.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedArray[lower];
    }

    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Update performance baselines
   * @private
   */
  updatePerformanceBaselines() {
    const now = Date.now();
    const baselineWindow = 3600000; // 1 hour

    for (const [providerName, baseline] of this.performanceBaselines) {
      // Only update baselines every hour
      if (
        baseline.lastCalculated &&
        now - baseline.lastCalculated < baselineWindow
      ) {
        continue;
      }

      const metrics = this.getMetricsSummary(providerName, baselineWindow);
      if (metrics && metrics.requests.total > 10) {
        // Need sufficient data
        baseline.avgResponseTime = metrics.responseTime.avg;
        baseline.successRate = metrics.requests.successRate;
        baseline.throughput = metrics.throughput.requestsPerSecond;
        baseline.lastCalculated = now;

        console.log(`Updated performance baseline for ${providerName}:`, {
          avgResponseTime: Math.round(baseline.avgResponseTime),
          successRate: (baseline.successRate * 100).toFixed(1) + '%',
          throughput: baseline.throughput.toFixed(1) + ' req/s',
        });
      }
    }
  }

  /**
   * Detect performance anomalies
   * @private
   */
  detectAnomalies(providerName, metric) {
    const baseline = this.performanceBaselines.get(providerName);
    if (!baseline || !baseline.avgResponseTime) return;

    const anomalies = this.anomalies.get(providerName);
    if (!anomalies) return;

    const now = Date.now();
    let anomalyDetected = false;
    let anomalyType = null;
    let severity = 'low';

    // Response time anomaly
    if (
      metric.responseTime &&
      metric.responseTime > baseline.avgResponseTime * 3
    ) {
      anomalyDetected = true;
      anomalyType = 'slow_response';
      severity =
        metric.responseTime > baseline.avgResponseTime * 5 ? 'high' : 'medium';
    }

    if (anomalyDetected) {
      const anomaly = {
        timestamp: now,
        type: anomalyType,
        severity,
        metric: metric,
        baseline: baseline,
        deviation: metric.responseTime / baseline.avgResponseTime,
      };

      anomalies.push(anomaly);

      // Limit anomaly history
      if (anomalies.length > 100) {
        anomalies.splice(0, anomalies.length - 100);
      }

      console.warn(`Anomaly detected for ${providerName}:`, {
        type: anomalyType,
        severity,
        value: metric.responseTime,
        baseline: Math.round(baseline.avgResponseTime),
        deviation: `${(anomaly.deviation * 100).toFixed(0)}%`,
      });

      this.emit('anomalyDetected', {
        provider: providerName,
        anomaly,
      });
    }
  }

  /**
   * Get metrics summary for a provider
   * @param {string} providerName - Provider name
   * @param {number} timeWindow - Time window in ms
   * @returns {Object} Metrics summary
   */
  getMetricsSummary(providerName, timeWindow = 3600000) {
    const aggregatedData = this.aggregatedMetrics.get(providerName);
    if (!aggregatedData) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const cutoff = Date.now() - timeWindow;
    const relevantBuckets = Array.from(aggregatedData.entries())
      .filter(([timestamp]) => timestamp >= cutoff)
      .map(([, data]) => data);

    if (relevantBuckets.length === 0) {
      return null;
    }

    // Aggregate across buckets
    const summary = {
      provider: providerName,
      timeWindow,
      buckets: relevantBuckets.length,
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        failureRate: 0,
      },
      responseTime: {
        avg: 0,
        min: Infinity,
        max: 0,
        p95: 0,
        p99: 0,
      },
      throughput: {
        requestsPerSecond: 0,
        tokensPerSecond: 0,
      },
      errors: new Map(),
      tokenUsage: {
        input: 0,
        output: 0,
        total: 0,
      },
    };

    let totalResponseTime = 0;
    let totalRequests = 0;
    const allP95s = [];
    const allP99s = [];

    for (const bucket of relevantBuckets) {
      summary.requests.total += bucket.requests.total;
      summary.requests.successful += bucket.requests.successful;
      summary.requests.failed += bucket.requests.failed;

      if (bucket.requests.total > 0) {
        totalResponseTime += bucket.responseTime.avg * bucket.requests.total;
        totalRequests += bucket.requests.total;

        summary.responseTime.min = Math.min(
          summary.responseTime.min,
          bucket.responseTime.min
        );
        summary.responseTime.max = Math.max(
          summary.responseTime.max,
          bucket.responseTime.max
        );

        allP95s.push(bucket.responseTime.p95);
        allP99s.push(bucket.responseTime.p99);
      }

      summary.throughput.requestsPerSecond +=
        bucket.throughput.requestsPerSecond;
      summary.throughput.tokensPerSecond += bucket.throughput.tokensPerSecond;

      summary.tokenUsage.input += bucket.tokenUsage.input;
      summary.tokenUsage.output += bucket.tokenUsage.output;
      summary.tokenUsage.total += bucket.tokenUsage.total;

      // Aggregate errors
      for (const [errorType, count] of bucket.errors) {
        const currentCount = summary.errors.get(errorType) || 0;
        summary.errors.set(errorType, currentCount + count);
      }
    }

    // Calculate averages
    if (totalRequests > 0) {
      summary.responseTime.avg = totalResponseTime / totalRequests;
      summary.requests.successRate =
        summary.requests.successful / summary.requests.total;
      summary.requests.failureRate =
        summary.requests.failed / summary.requests.total;
    }

    if (allP95s.length > 0) {
      summary.responseTime.p95 =
        allP95s.reduce((sum, p) => sum + p, 0) / allP95s.length;
      summary.responseTime.p99 =
        allP99s.reduce((sum, p) => sum + p, 0) / allP99s.length;
    }

    summary.throughput.requestsPerSecond /= relevantBuckets.length;
    summary.throughput.tokensPerSecond /= relevantBuckets.length;

    return summary;
  }

  /**
   * Get real-time metrics for a provider
   * @param {string} providerName - Provider name
   * @returns {Object} Real-time metrics
   */
  getRealtimeMetrics(providerName) {
    const realtimeData = this.realtimeMetrics.get(providerName);
    if (!realtimeData) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const now = Date.now();
    const windowDuration = now - realtimeData.windowStart;

    return {
      provider: providerName,
      windowStart: new Date(realtimeData.windowStart),
      windowDuration,
      requests: realtimeData.requests,
      successes: realtimeData.successes,
      failures: realtimeData.failures,
      successRate:
        realtimeData.requests > 0
          ? realtimeData.successes / realtimeData.requests
          : 0,
      avgResponseTime:
        realtimeData.requests > 0
          ? realtimeData.totalResponseTime / realtimeData.requests
          : 0,
      minResponseTime:
        realtimeData.minResponseTime === Infinity
          ? 0
          : realtimeData.minResponseTime,
      maxResponseTime: realtimeData.maxResponseTime,
      requestsPerSecond:
        windowDuration > 0
          ? (realtimeData.requests * 1000) / windowDuration
          : 0,
      errors: Object.fromEntries(realtimeData.errors),
      statusCodes: Object.fromEntries(realtimeData.statusCodes),
      tokenUsage: realtimeData.tokenUsage,
    };
  }

  /**
   * Get performance baseline for a provider
   * @param {string} providerName - Provider name
   * @returns {Object} Performance baseline
   */
  getPerformanceBaseline(providerName) {
    const baseline = this.performanceBaselines.get(providerName);
    if (!baseline) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    return {
      provider: providerName,
      avgResponseTime: baseline.avgResponseTime,
      successRate: baseline.successRate,
      throughput: baseline.throughput,
      lastCalculated: baseline.lastCalculated
        ? new Date(baseline.lastCalculated)
        : null,
    };
  }

  /**
   * Get recent anomalies for a provider
   * @param {string} providerName - Provider name
   * @param {number} limit - Maximum number of anomalies to return
   * @returns {Array} Recent anomalies
   */
  getRecentAnomalies(providerName, limit = 10) {
    const anomalies = this.anomalies.get(providerName);
    if (!anomalies) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    return anomalies.slice(-limit).map((anomaly) => ({
      ...anomaly,
      timestamp: new Date(anomaly.timestamp),
    }));
  }

  /**
   * Clean up old data
   * @private
   */
  cleanupOldData() {
    const now = Date.now();
    const cutoff = now - this.config.retentionPeriod;

    // Clean up raw metrics
    for (const [providerName, rawMetrics] of this.rawMetrics) {
      const originalLength = rawMetrics.length;
      const filtered = rawMetrics.filter(
        (metric) => metric.timestamp >= cutoff
      );

      if (filtered.length !== originalLength) {
        this.rawMetrics.set(providerName, filtered);
        console.log(
          `Cleaned up ${
            originalLength - filtered.length
          } old raw metrics for ${providerName}`
        );
      }
    }

    // Clean up aggregated metrics
    for (const [providerName, aggregatedData] of this.aggregatedMetrics) {
      const originalSize = aggregatedData.size;
      const keysToDelete = [];

      for (const [timestamp] of aggregatedData) {
        if (timestamp < cutoff) {
          keysToDelete.push(timestamp);
        }
      }

      for (const key of keysToDelete) {
        aggregatedData.delete(key);
      }

      if (keysToDelete.length > 0) {
        console.log(
          `Cleaned up ${keysToDelete.length} old aggregated metrics for ${providerName}`
        );
      }
    }

    // Clean up anomalies
    for (const [providerName, anomalies] of this.anomalies) {
      const originalLength = anomalies.length;
      const filtered = anomalies.filter(
        (anomaly) => anomaly.timestamp >= cutoff
      );

      if (filtered.length !== originalLength) {
        this.anomalies.set(providerName, filtered);
        console.log(
          `Cleaned up ${
            originalLength - filtered.length
          } old anomalies for ${providerName}`
        );
      }
    }
  }

  /**
   * Export metrics data
   * @param {string} providerName - Provider name (optional)
   * @param {string} type - Data type ('raw', 'aggregated', 'summary')
   * @param {number} timeWindow - Time window in ms
   * @returns {Object} Exported data
   */
  exportData(providerName = null, type = 'summary', timeWindow = 3600000) {
    const providers = providerName
      ? [providerName]
      : Array.from(this.rawMetrics.keys());
    const exportData = {};

    for (const provider of providers) {
      switch (type) {
        case 'raw':
          const rawMetrics = this.rawMetrics.get(provider) || [];
          const cutoff = Date.now() - timeWindow;
          exportData[provider] = rawMetrics.filter(
            (m) => m.timestamp >= cutoff
          );
          break;

        case 'aggregated':
          const aggregatedData = this.aggregatedMetrics.get(provider);
          if (aggregatedData) {
            const cutoffAgg = Date.now() - timeWindow;
            exportData[provider] = Array.from(aggregatedData.entries())
              .filter(([timestamp]) => timestamp >= cutoffAgg)
              .map(([timestamp, data]) => ({ timestamp, ...data }));
          }
          break;

        case 'summary':
        default:
          try {
            exportData[provider] = this.getMetricsSummary(provider, timeWindow);
          } catch (error) {
            exportData[provider] = { error: error.message };
          }
          break;
      }
    }

    return {
      exportType: type,
      timeWindow,
      timestamp: new Date(),
      data: exportData,
    };
  }

  /**
   * Get provider-specific metrics data
   * @param {string} providerName - Provider name
   * @returns {Object} Provider metrics
   */
  getProviderMetrics(providerName) {
    if (!this.rawMetrics.has(providerName)) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const rawMetrics = this.rawMetrics.get(providerName);
    const requestMetrics = rawMetrics.filter((m) => m.type === 'request');

    if (requestMetrics.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 0,
        errorRate: 0,
        averageResponseTime: 0,
        totalTokens: 0,
      };
    }

    const successfulRequests = requestMetrics.filter((m) => m.success);
    const failedRequests = requestMetrics.filter((m) => !m.success);

    const totalResponseTime = requestMetrics
      .filter((m) => typeof m.responseTime === 'number')
      .reduce((sum, m) => sum + m.responseTime, 0);

    const totalTokens = successfulRequests.reduce((sum, m) => {
      const tokens = m.tokenUsage || m.tokens || {};
      return sum + (tokens.total || (tokens.input || 0) + (tokens.output || 0));
    }, 0);

    const totalRequests = requestMetrics.length;
    const successCount = successfulRequests.length;
    const failureCount = failedRequests.length;

    return {
      totalRequests,
      successfulRequests: successCount,
      failedRequests: failureCount,
      successRate: totalRequests > 0 ? successCount / totalRequests : 0,
      errorRate: totalRequests > 0 ? failureCount / totalRequests : 0,
      averageResponseTime:
        totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      totalTokens,
    };
  }

  /**
   * Get response time percentiles for a provider
   * @param {string} providerName - Provider name
   * @returns {Object} Response time percentiles
   */
  getResponseTimePercentiles(providerName) {
    const rawMetrics = this.rawMetrics.get(providerName);
    if (!rawMetrics) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const requestMetrics = rawMetrics.filter(
      (m) => m.type === 'request' && typeof m.responseTime === 'number'
    );

    if (requestMetrics.length === 0) {
      return {
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      };
    }

    const responseTimes = requestMetrics
      .map((m) => m.responseTime)
      .sort((a, b) => a - b);

    return {
      p50: this.calculatePercentile(responseTimes, 0.5),
      p90: this.calculatePercentile(responseTimes, 0.9),
      p95: this.calculatePercentile(responseTimes, 0.95),
      p99: this.calculatePercentile(responseTimes, 0.99),
    };
  }

  /**
   * Get time series metrics for a provider
   * @param {string} providerName - Provider name
   * @param {Object} options - Query options
   * @returns {Array} Time series data
   */
  getTimeSeriesMetrics(providerName, options = {}) {
    const { startTime, endTime, interval = 900000 } = options; // 15 minutes default
    const aggregatedData = this.aggregatedMetrics.get(providerName);

    if (!aggregatedData) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const timeSeriesData = [];
    let currentTime = startTime;

    // Generate exactly the expected number of buckets
    while (currentTime < endTime) {
      const bucketEnd = currentTime + interval;
      const isLastBucket = bucketEnd >= endTime;

      // Find metrics in this time bucket using raw metrics
      const rawMetrics = this.rawMetrics.get(providerName) || [];
      const bucketMetrics = rawMetrics.filter((m) => {
        if (isLastBucket) {
          return m.timestamp >= currentTime && m.timestamp <= endTime;
        } else {
          return m.timestamp >= currentTime && m.timestamp < bucketEnd;
        }
      });

      const requestMetrics = bucketMetrics.filter((m) => m.type === 'request');

      timeSeriesData.push({
        timestamp: currentTime,
        requests: requestMetrics.length,
        successRate:
          requestMetrics.length > 0
            ? requestMetrics.filter((m) => m.success).length /
              requestMetrics.length
            : 0,
        avgResponseTime:
          requestMetrics.length > 0
            ? requestMetrics.reduce(
                (sum, m) => sum + (m.responseTime || 0),
                0
              ) / requestMetrics.length
            : 0,
        errors: requestMetrics.filter((m) => !m.success).length,
      });

      currentTime += interval;
    }

    return timeSeriesData;
  }

  /**
   * Shutdown the metrics collector (alias for stopAggregation)
   */
  shutdown() {
    this.stopAggregation();
    console.log('MetricsCollector shutdown completed');
  }

  /**
   * Get aggregated metrics across all providers
   * @returns {Object} Aggregated metrics
   */
  getAggregatedMetrics() {
    const providers = Array.from(this.rawMetrics.keys());

    if (providers.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 0,
        errorRate: 0,
        averageResponseTime: 0,
        totalTokens: 0,
        providers: [],
      };
    }

    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalResponseTime = 0;
    let totalTokens = 0;
    let totalRequestsWithResponseTime = 0;

    const providerMetrics = [];

    for (const providerName of providers) {
      const metrics = this.getProviderMetrics(providerName);
      providerMetrics.push({
        provider: providerName,
        ...metrics,
      });

      totalRequests += metrics.totalRequests;
      successfulRequests += metrics.successfulRequests;
      failedRequests += metrics.failedRequests;
      totalTokens += metrics.totalTokens;

      if (metrics.totalRequests > 0) {
        totalResponseTime +=
          metrics.averageResponseTime * metrics.totalRequests;
        totalRequestsWithResponseTime += metrics.totalRequests;
      }
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
      errorRate: totalRequests > 0 ? failedRequests / totalRequests : 0,
      averageResponseTime:
        totalRequestsWithResponseTime > 0
          ? totalResponseTime / totalRequestsWithResponseTime
          : 0,
      totalTokens,
      providers: providerMetrics,
    };
  }

  /**
   * Get response time percentiles for a provider
   * @param {string} providerName - Provider name
   * @returns {Object} Response time percentiles
   */
  getResponseTimePercentiles(providerName) {
    const rawMetrics = this.rawMetrics.get(providerName);
    if (!rawMetrics) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const requestMetrics = rawMetrics.filter(
      (m) => m.type === 'request' && typeof m.responseTime === 'number'
    );

    if (requestMetrics.length === 0) {
      return {
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      };
    }

    const responseTimes = requestMetrics
      .map((m) => m.responseTime)
      .sort((a, b) => a - b);

    return {
      p50: this.calculatePercentile(responseTimes, 0.5),
      p90: this.calculatePercentile(responseTimes, 0.9),
      p95: this.calculatePercentile(responseTimes, 0.95),
      p99: this.calculatePercentile(responseTimes, 0.99),
    };
  }

  /**
   * Get aggregated metrics across all providers
   * @returns {Object} Aggregated metrics
   */
  getAggregatedMetrics() {
    const providers = Array.from(this.rawMetrics.keys());
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalResponseTime = 0;
    let totalTokens = 0;
    let requestCount = 0;

    const providerMetrics = [];

    for (const providerName of providers) {
      try {
        const metrics = this.getProviderMetrics(providerName);
        providerMetrics.push({
          provider: providerName,
          ...metrics,
        });

        totalRequests += metrics.totalRequests;
        successfulRequests += metrics.successfulRequests;
        failedRequests += metrics.failedRequests;
        totalTokens += metrics.totalTokens;

        if (metrics.totalRequests > 0) {
          totalResponseTime +=
            metrics.averageResponseTime * metrics.totalRequests;
          requestCount += metrics.totalRequests;
        }
      } catch (error) {
        console.warn(
          `Failed to get metrics for ${providerName}:`,
          error.message
        );
      }
    }

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
      errorRate: totalRequests > 0 ? failedRequests / totalRequests : 0,
      averageResponseTime:
        requestCount > 0 ? totalResponseTime / requestCount : 0,
      totalTokens,
      providers: providerMetrics,
    };
  }

  /**
   * Reset all metrics data
   */
  reset() {
    this.rawMetrics.clear();
    this.aggregatedMetrics.clear();
    this.realtimeMetrics.clear();
    this.performanceBaselines.clear();
    this.anomalies.clear();
    console.log('MetricsCollector reset completed');
  }

  /**
   * Shutdown the metrics collector (alias for stopAggregation)
   */
  shutdown() {
    this.stopAggregation();
    console.log('MetricsCollector shutdown completed');
  }
}

module.exports = MetricsCollector;
