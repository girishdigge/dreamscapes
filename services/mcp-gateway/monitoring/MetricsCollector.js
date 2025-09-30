// monitoring/MetricsCollector.js
// Advanced metrics collection and analysis system

const EventEmitter = require('events');

/**
 * Metrics Collector - Comprehensive metrics collection and analysis
 */
class MetricsCollector extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      collectionInterval: config.collectionInterval || 60000, // 1 minute
      aggregationInterval: config.aggregationInterval || 300000, // 5 minutes
      retentionPeriod: config.retentionPeriod || 86400000, // 24 hours
      detailedRetentionPeriod: config.detailedRetentionPeriod || 3600000, // 1 hour
      enableRealTimeMetrics: config.enableRealTimeMetrics !== false,
      ...config,
    };

    // Metrics storage
    this.rawMetrics = new Map(); // provider_name -> Array<MetricPoint>
    this.aggregatedMetrics = new Map(); // provider_name -> Array<AggregatedMetric>
    this.realtimeMetrics = new Map(); // provider_name -> RealtimeMetrics
    this.performanceBaselines = new Map(); // provider_name -> BaselineMetrics

    // Collection intervals
    this.collectionInterval = null;
    this.aggregationInterval = null;

    // Request tracking
    this.activeRequests = new Map(); // request_id -> RequestMetadata
    this.requestSequence = 0;

    console.log('MetricsCollector initialized with config:', this.config);
  }

  /**
   * Start metrics collection
   * @param {ProviderManager} providerManager - Provider manager instance
   */
  startCollection(providerManager) {
    this.providerManager = providerManager;

    // Start collection interval
    this.collectionInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.config.collectionInterval);

    // Start aggregation interval
    this.aggregationInterval = setInterval(async () => {
      await this.aggregateMetrics();
    }, this.config.aggregationInterval);

    // Setup provider manager listeners
    this.setupProviderManagerListeners();

    console.log('Metrics collection started', {
      collectionInterval: this.config.collectionInterval,
      aggregationInterval: this.config.aggregationInterval,
    });
  }

  /**
   * Stop metrics collection
   */
  stopCollection() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }

    console.log('Metrics collection stopped');
  }

  /**
   * Record request start
   * @param {string} providerName - Provider name
   * @param {Object} requestData - Request metadata
   * @returns {string} Request ID for tracking
   */
  recordRequestStart(providerName, requestData = {}) {
    const requestId = `${providerName}_${++this.requestSequence}_${Date.now()}`;

    const requestMetadata = {
      id: requestId,
      provider: providerName,
      startTime: Date.now(),
      endTime: null,
      success: null,
      error: null,
      responseTime: null,
      tokens: {
        input: requestData.inputTokens || 0,
        output: 0,
        total: 0,
      },
      metadata: {
        model: requestData.model,
        temperature: requestData.temperature,
        maxTokens: requestData.maxTokens,
        streaming: requestData.streaming || false,
        ...requestData.metadata,
      },
    };

    this.activeRequests.set(requestId, requestMetadata);

    // Update realtime metrics
    this.updateRealtimeMetrics(providerName, 'request_started');

    console.log('Request started:', { requestId, provider: providerName });

    return requestId;
  }

  /**
   * Record request completion
   * @param {string} requestId - Request ID
   * @param {Object} result - Request result
   */
  recordRequestEnd(requestId, result = {}) {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      console.warn('Request not found for completion:', { requestId });
      return;
    }

    const endTime = Date.now();
    request.endTime = endTime;
    request.responseTime = endTime - request.startTime;
    request.success = result.success !== false;
    request.error = result.error;

    if (result.tokens) {
      request.tokens.output = result.tokens.output || 0;
      request.tokens.total = request.tokens.input + request.tokens.output;
    }

    // Move to completed metrics
    this.recordCompletedRequest(request);

    // Remove from active requests
    this.activeRequests.delete(requestId);

    // Update realtime metrics
    this.updateRealtimeMetrics(request.provider, 'request_completed', request);

    console.log('Request completed:', {
      requestId,
      provider: request.provider,
      success: request.success,
      responseTime: request.responseTime,
    });
  }

  /**
   * Record completed request in metrics
   * @private
   */
  recordCompletedRequest(request) {
    const providerName = request.provider;

    if (!this.rawMetrics.has(providerName)) {
      this.rawMetrics.set(providerName, []);
    }

    const metricPoint = {
      timestamp: new Date(request.endTime),
      type: 'request',
      success: request.success,
      responseTime: request.responseTime,
      tokens: request.tokens,
      error: request.error,
      metadata: request.metadata,
    };

    this.rawMetrics.get(providerName).push(metricPoint);

    // Maintain retention period for raw metrics
    this.cleanupOldMetrics(providerName);
  }

  /**
   * Collect current metrics from all providers
   * @private
   */
  async collectMetrics() {
    if (!this.providerManager) return;

    const providers = this.providerManager.getProviders();

    for (const providerName of providers) {
      try {
        const metrics = this.providerManager.getProviderMetrics(providerName);
        const health = this.providerManager.healthStatus.get(providerName);

        const metricPoint = {
          timestamp: new Date(),
          type: 'snapshot',
          metrics: {
            requests: metrics.requests,
            successes: metrics.successes,
            failures: metrics.failures,
            successRate: metrics.successRate,
            failureRate: metrics.failureRate,
            avgResponseTime: metrics.avgResponseTime,
            rateLimitHits: metrics.rateLimitHits,
            circuitBreakerTrips: metrics.circuitBreakerTrips,
          },
          health: {
            isHealthy: health?.isHealthy || false,
            consecutiveFailures: health?.consecutiveFailures || 0,
            lastCheck: health?.lastCheck,
          },
          activeRequests: this.getActiveRequestCount(providerName),
        };

        if (!this.rawMetrics.has(providerName)) {
          this.rawMetrics.set(providerName, []);
        }

        this.rawMetrics.get(providerName).push(metricPoint);

        // Update performance baselines
        this.updatePerformanceBaseline(providerName, metricPoint);
      } catch (error) {
        console.error('Error collecting metrics:', {
          provider: providerName,
          error: error.message,
        });
      }
    }
  }

  /**
   * Aggregate raw metrics into time-based summaries
   * @private
   */
  async aggregateMetrics() {
    const providers = this.rawMetrics.keys();

    for (const providerName of providers) {
      try {
        const rawData = this.rawMetrics.get(providerName) || [];
        const aggregated = this.calculateAggregatedMetrics(rawData);

        if (!this.aggregatedMetrics.has(providerName)) {
          this.aggregatedMetrics.set(providerName, []);
        }

        this.aggregatedMetrics.get(providerName).push(aggregated);

        // Maintain retention for aggregated metrics
        this.cleanupOldAggregatedMetrics(providerName);

        this.emit('metricsAggregated', {
          provider: providerName,
          metrics: aggregated,
        });
      } catch (error) {
        console.error('Error aggregating metrics:', {
          provider: providerName,
          error: error.message,
        });
      }
    }
  }

  /**
   * Calculate aggregated metrics from raw data
   * @private
   */
  calculateAggregatedMetrics(rawData) {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 300000);

    // Filter data from last 5 minutes
    const recentData = rawData.filter(
      (point) => point.timestamp >= fiveMinutesAgo
    );

    if (recentData.length === 0) {
      return {
        timestamp: now,
        period: '5min',
        requests: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
        failureRate: 0,
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        totalTokens: 0,
        tokensPerMinute: 0,
        requestsPerMinute: 0,
        errorTypes: {},
        healthScore: 0,
      };
    }

    // Calculate request-based metrics
    const requestData = recentData.filter((point) => point.type === 'request');
    const successfulRequests = requestData.filter((point) => point.success);
    const failedRequests = requestData.filter((point) => !point.success);

    const responseTimes = requestData
      .map((point) => point.responseTime)
      .filter((time) => time != null)
      .sort((a, b) => a - b);

    const totalTokens = requestData.reduce(
      (sum, point) => sum + (point.tokens?.total || 0),
      0
    );

    // Calculate percentiles
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    // Error analysis
    const errorTypes = {};
    failedRequests.forEach((request) => {
      if (request.error) {
        const errorType = this.categorizeError(request.error);
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      }
    });

    // Health score calculation (0-100)
    const successRate =
      requestData.length > 0
        ? successfulRequests.length / requestData.length
        : 1;
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    const healthScore = this.calculateHealthScore(successRate, avgResponseTime);

    return {
      timestamp: now,
      period: '5min',
      requests: requestData.length,
      successes: successfulRequests.length,
      failures: failedRequests.length,
      successRate,
      failureRate: 1 - successRate,
      avgResponseTime,
      minResponseTime: responseTimes.length > 0 ? responseTimes[0] : 0,
      maxResponseTime:
        responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0,
      p95ResponseTime:
        responseTimes.length > 0 ? responseTimes[p95Index] || 0 : 0,
      p99ResponseTime:
        responseTimes.length > 0 ? responseTimes[p99Index] || 0 : 0,
      totalTokens,
      tokensPerMinute: totalTokens / 5, // 5-minute window
      requestsPerMinute: requestData.length / 5,
      errorTypes,
      healthScore,
    };
  }

  /**
   * Update realtime metrics
   * @private
   */
  updateRealtimeMetrics(providerName, eventType, data = null) {
    if (!this.config.enableRealTimeMetrics) return;

    if (!this.realtimeMetrics.has(providerName)) {
      this.realtimeMetrics.set(providerName, {
        activeRequests: 0,
        requestsInLastMinute: 0,
        successesInLastMinute: 0,
        failuresInLastMinute: 0,
        avgResponseTimeLastMinute: 0,
        lastActivity: null,
        recentEvents: [],
      });
    }

    const metrics = this.realtimeMetrics.get(providerName);

    switch (eventType) {
      case 'request_started':
        metrics.activeRequests++;
        break;

      case 'request_completed':
        metrics.activeRequests = Math.max(0, metrics.activeRequests - 1);
        if (data) {
          metrics.lastActivity = new Date();

          // Add to recent events (keep last 100)
          metrics.recentEvents.push({
            timestamp: new Date(),
            type: 'request_completed',
            success: data.success,
            responseTime: data.responseTime,
          });

          if (metrics.recentEvents.length > 100) {
            metrics.recentEvents = metrics.recentEvents.slice(-100);
          }

          // Update last minute metrics
          this.updateLastMinuteMetrics(providerName);
        }
        break;
    }

    this.emit('realtimeMetricsUpdated', {
      provider: providerName,
      metrics: { ...metrics },
    });
  }

  /**
   * Update last minute metrics
   * @private
   */
  updateLastMinuteMetrics(providerName) {
    const metrics = this.realtimeMetrics.get(providerName);
    if (!metrics) return;

    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentEvents = metrics.recentEvents.filter(
      (event) => event.timestamp >= oneMinuteAgo
    );

    const successes = recentEvents.filter((event) => event.success);
    const failures = recentEvents.filter((event) => !event.success);

    metrics.requestsInLastMinute = recentEvents.length;
    metrics.successesInLastMinute = successes.length;
    metrics.failuresInLastMinute = failures.length;

    if (recentEvents.length > 0) {
      const totalResponseTime = recentEvents.reduce(
        (sum, event) => sum + (event.responseTime || 0),
        0
      );
      metrics.avgResponseTimeLastMinute =
        totalResponseTime / recentEvents.length;
    } else {
      metrics.avgResponseTimeLastMinute = 0;
    }
  }

  /**
   * Update performance baseline
   * @private
   */
  updatePerformanceBaseline(providerName, metricPoint) {
    if (!this.performanceBaselines.has(providerName)) {
      this.performanceBaselines.set(providerName, {
        establishedAt: new Date(),
        sampleCount: 0,
        avgResponseTime: 0,
        avgSuccessRate: 0,
        p95ResponseTime: 0,
        lastUpdated: new Date(),
      });
    }

    const baseline = this.performanceBaselines.get(providerName);
    baseline.sampleCount++;
    baseline.lastUpdated = new Date();

    // Update running averages
    const alpha = 0.1; // Exponential moving average factor
    baseline.avgResponseTime =
      baseline.avgResponseTime * (1 - alpha) +
      metricPoint.metrics.avgResponseTime * alpha;

    baseline.avgSuccessRate =
      baseline.avgSuccessRate * (1 - alpha) +
      metricPoint.metrics.successRate * alpha;
  }

  /**
   * Get comprehensive metrics report
   * @param {string} providerName - Specific provider (optional)
   * @param {Object} options - Report options
   * @returns {Object} Metrics report
   */
  getMetricsReport(providerName = null, options = {}) {
    const timeRange = options.timeRange || '1h';
    const includeRealtime = options.includeRealtime !== false;
    const includeBaseline = options.includeBaseline !== false;

    if (providerName) {
      return this.getProviderMetricsReport(providerName, {
        timeRange,
        includeRealtime,
        includeBaseline,
      });
    }

    // Get report for all providers
    const report = {
      timestamp: new Date(),
      timeRange,
      providers: {},
      summary: {
        totalProviders: 0,
        activeProviders: 0,
        totalRequests: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        avgSuccessRate: 0,
        avgResponseTime: 0,
      },
    };

    const providers = this.providerManager?.getProviders() || [];

    for (const provider of providers) {
      const providerReport = this.getProviderMetricsReport(provider, {
        timeRange,
        includeRealtime,
        includeBaseline,
      });

      report.providers[provider] = providerReport;
      report.summary.totalProviders++;

      if (providerReport.realtime?.activeRequests > 0) {
        report.summary.activeProviders++;
      }

      report.summary.totalRequests += providerReport.aggregated?.requests || 0;
      report.summary.totalSuccesses +=
        providerReport.aggregated?.successes || 0;
      report.summary.totalFailures += providerReport.aggregated?.failures || 0;
    }

    // Calculate summary averages
    if (report.summary.totalRequests > 0) {
      report.summary.avgSuccessRate =
        report.summary.totalSuccesses / report.summary.totalRequests;
    }

    const providerResponseTimes = Object.values(report.providers)
      .map((p) => p.aggregated?.avgResponseTime)
      .filter((time) => time != null && time > 0);

    if (providerResponseTimes.length > 0) {
      report.summary.avgResponseTime =
        providerResponseTimes.reduce((sum, time) => sum + time, 0) /
        providerResponseTimes.length;
    }

    return report;
  }

  /**
   * Get metrics report for specific provider
   * @private
   */
  getProviderMetricsReport(providerName, options) {
    const report = {
      provider: providerName,
      timestamp: new Date(),
      timeRange: options.timeRange,
    };

    // Get aggregated metrics
    const aggregatedData = this.aggregatedMetrics.get(providerName) || [];
    const timeRangeMs = this.parseTimeRange(options.timeRange);
    const cutoffTime = new Date(Date.now() - timeRangeMs);

    const recentAggregated = aggregatedData.filter(
      (data) => data.timestamp >= cutoffTime
    );

    if (recentAggregated.length > 0) {
      report.aggregated = this.summarizeAggregatedData(recentAggregated);
    }

    // Get realtime metrics
    if (options.includeRealtime) {
      report.realtime = this.realtimeMetrics.get(providerName) || null;
    }

    // Get baseline metrics
    if (options.includeBaseline) {
      report.baseline = this.performanceBaselines.get(providerName) || null;
    }

    return report;
  }

  /**
   * Summarize aggregated data
   * @private
   */
  summarizeAggregatedData(aggregatedData) {
    if (aggregatedData.length === 0) return null;

    const latest = aggregatedData[aggregatedData.length - 1];
    const totals = aggregatedData.reduce(
      (acc, data) => ({
        requests: acc.requests + data.requests,
        successes: acc.successes + data.successes,
        failures: acc.failures + data.failures,
        totalTokens: acc.totalTokens + data.totalTokens,
      }),
      { requests: 0, successes: 0, failures: 0, totalTokens: 0 }
    );

    const avgResponseTime =
      aggregatedData
        .filter((data) => data.avgResponseTime > 0)
        .reduce((sum, data) => sum + data.avgResponseTime, 0) /
      aggregatedData.length;

    return {
      ...totals,
      successRate: totals.requests > 0 ? totals.successes / totals.requests : 0,
      failureRate: totals.requests > 0 ? totals.failures / totals.requests : 0,
      avgResponseTime,
      healthScore: latest.healthScore,
      p95ResponseTime: latest.p95ResponseTime,
      p99ResponseTime: latest.p99ResponseTime,
      requestsPerMinute: latest.requestsPerMinute,
      tokensPerMinute: latest.tokensPerMinute,
      errorTypes: latest.errorTypes,
    };
  }

  /**
   * Parse time range string to milliseconds
   * @private
   */
  parseTimeRange(timeRange) {
    const units = {
      m: 60000, // minutes
      h: 3600000, // hours
      d: 86400000, // days
    };

    const match = timeRange.match(/^(\d+)([mhd])$/);
    if (!match) return 3600000; // Default to 1 hour

    const [, amount, unit] = match;
    return parseInt(amount) * (units[unit] || 3600000);
  }

  /**
   * Categorize error for analysis
   * @private
   */
  categorizeError(error) {
    const errorMessage = error.toLowerCase();

    if (errorMessage.includes('timeout')) return 'timeout';
    if (errorMessage.includes('rate limit')) return 'rate_limit';
    if (errorMessage.includes('authentication')) return 'auth';
    if (errorMessage.includes('connection')) return 'connection';
    if (errorMessage.includes('server error') || errorMessage.includes('500'))
      return 'server_error';
    if (errorMessage.includes('bad request') || errorMessage.includes('400'))
      return 'client_error';
    if (errorMessage.includes('not found') || errorMessage.includes('404'))
      return 'not_found';

    return 'unknown';
  }

  /**
   * Calculate health score (0-100)
   * @private
   */
  calculateHealthScore(successRate, avgResponseTime) {
    let score = 100;

    // Success rate component (0-60 points)
    score *= successRate;

    // Response time component (penalty for slow responses)
    if (avgResponseTime > 1000) {
      // 1 second
      const penalty = Math.min((avgResponseTime - 1000) / 10000, 0.4); // Max 40% penalty
      score *= 1 - penalty;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get active request count for provider
   * @private
   */
  getActiveRequestCount(providerName) {
    let count = 0;
    for (const request of this.activeRequests.values()) {
      if (request.provider === providerName) {
        count++;
      }
    }
    return count;
  }

  /**
   * Setup provider manager event listeners
   * @private
   */
  setupProviderManagerListeners() {
    if (!this.providerManager) return;

    // Listen for operation events to track metrics
    this.providerManager.on('operationSuccess', (data) => {
      // This would be called from the provider manager when operations complete
      // For now, we rely on explicit recordRequestStart/End calls
    });

    this.providerManager.on('operationFailure', (data) => {
      // This would be called from the provider manager when operations fail
      // For now, we rely on explicit recordRequestStart/End calls
    });
  }

  /**
   * Clean up old raw metrics
   * @private
   */
  cleanupOldMetrics(providerName) {
    const metrics = this.rawMetrics.get(providerName);
    if (!metrics) return;

    const cutoffTime = new Date(
      Date.now() - this.config.detailedRetentionPeriod
    );
    const filteredMetrics = metrics.filter(
      (metric) => metric.timestamp >= cutoffTime
    );

    this.rawMetrics.set(providerName, filteredMetrics);
  }

  /**
   * Clean up old aggregated metrics
   * @private
   */
  cleanupOldAggregatedMetrics(providerName) {
    const metrics = this.aggregatedMetrics.get(providerName);
    if (!metrics) return;

    const cutoffTime = new Date(Date.now() - this.config.retentionPeriod);
    const filteredMetrics = metrics.filter(
      (metric) => metric.timestamp >= cutoffTime
    );

    this.aggregatedMetrics.set(providerName, filteredMetrics);
  }

  /**
   * Export metrics data
   * @param {Object} options - Export options
   * @returns {Object} Exported metrics data
   */
  exportMetrics(options = {}) {
    const format = options.format || 'json';
    const timeRange = options.timeRange || '24h';
    const providers = options.providers || this.rawMetrics.keys();

    const exportData = {
      timestamp: new Date(),
      timeRange,
      format,
      data: {},
    };

    const timeRangeMs = this.parseTimeRange(timeRange);
    const cutoffTime = new Date(Date.now() - timeRangeMs);

    for (const providerName of providers) {
      const rawData = this.rawMetrics.get(providerName) || [];
      const aggregatedData = this.aggregatedMetrics.get(providerName) || [];

      exportData.data[providerName] = {
        raw: rawData.filter((data) => data.timestamp >= cutoffTime),
        aggregated: aggregatedData.filter(
          (data) => data.timestamp >= cutoffTime
        ),
        baseline: this.performanceBaselines.get(providerName),
        realtime: this.realtimeMetrics.get(providerName),
      };
    }

    return exportData;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopCollection();
    this.rawMetrics.clear();
    this.aggregatedMetrics.clear();
    this.realtimeMetrics.clear();
    this.performanceBaselines.clear();
    this.activeRequests.clear();
    this.removeAllListeners();
    console.log('MetricsCollector destroyed');
  }
}

module.exports = MetricsCollector;
