// engine/PromptAnalytics.js
// Prompt performance tracking and analytics system

class PromptAnalytics {
  constructor(options = {}) {
    this.options = {
      retention_days: 30,
      batch_size: 100,
      auto_aggregate: true,
      real_time_tracking: true,
      ...options,
    };

    this.metrics = new Map();
    this.sessions = new Map();
    this.aggregatedData = new Map();
    this.alerts = [];

    this.trackingCategories = {
      performance: {
        response_time: 'Average response time in milliseconds',
        token_usage: 'Token consumption per request',
        success_rate: 'Percentage of successful requests',
        error_rate: 'Percentage of failed requests',
        throughput: 'Requests per minute',
      },
      quality: {
        relevance_score: 'How relevant the output is to input',
        completeness_score: 'How complete the generated content is',
        creativity_score: 'How creative and original the output is',
        coherence_score: 'How coherent and well-structured the output is',
        user_satisfaction: 'User satisfaction rating (1-5)',
      },
      usage: {
        prompt_types: 'Distribution of prompt types used',
        provider_usage: 'Usage distribution across providers',
        style_preferences: 'Most popular style choices',
        quality_levels: 'Distribution of quality level requests',
        feature_adoption: 'Adoption rate of new features',
      },
      optimization: {
        ab_test_performance: 'A/B test results and improvements',
        optimization_impact: 'Impact of applied optimizations',
        variant_success_rates: 'Success rates of different variants',
        improvement_trends: 'Trends in performance improvements',
      },
    };

    this.alertThresholds = {
      response_time: { warning: 5000, critical: 10000 },
      error_rate: { warning: 0.05, critical: 0.1 },
      success_rate: { warning: 0.9, critical: 0.8 },
      quality_score: { warning: 0.7, critical: 0.6 },
    };

    if (this.options.auto_aggregate) {
      this.startAggregation();
    }
  }

  trackRequest(requestData) {
    const {
      request_id,
      session_id,
      prompt_type,
      provider,
      style,
      quality,
      input_length,
      timestamp = new Date().toISOString(),
    } = requestData;

    const trackingData = {
      request_id,
      session_id,
      prompt_type,
      provider,
      style,
      quality,
      input_length,
      timestamp,
      status: 'started',
      metrics: {},
    };

    this.metrics.set(request_id, trackingData);
    this.updateSessionData(session_id, trackingData);

    return request_id;
  }

  trackResponse(requestId, responseData) {
    const trackingData = this.metrics.get(requestId);
    if (!trackingData) return;

    const {
      response_time,
      token_usage,
      output_length,
      success,
      error,
      quality_scores = {},
      provider_metadata = {},
    } = responseData;

    trackingData.status = success ? 'completed' : 'failed';
    trackingData.completed_at = new Date().toISOString();
    trackingData.metrics = {
      response_time,
      token_usage,
      output_length,
      success,
      error,
      quality_scores,
      provider_metadata,
    };

    // Check for alerts
    this.checkAlerts(trackingData);

    // Update aggregated data if real-time tracking is enabled
    if (this.options.real_time_tracking) {
      this.updateAggregatedData(trackingData);
    }

    return trackingData;
  }

  trackUserFeedback(requestId, feedback) {
    const trackingData = this.metrics.get(requestId);
    if (!trackingData) return;

    const {
      satisfaction_rating,
      quality_rating,
      usefulness_rating,
      comments,
      timestamp = new Date().toISOString(),
    } = feedback;

    trackingData.user_feedback = {
      satisfaction_rating,
      quality_rating,
      usefulness_rating,
      comments,
      timestamp,
    };

    // Update quality scores with user feedback
    if (trackingData.metrics.quality_scores) {
      trackingData.metrics.quality_scores.user_satisfaction =
        satisfaction_rating;
    }

    return trackingData;
  }

  updateSessionData(sessionId, requestData) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        session_id: sessionId,
        started_at: requestData.timestamp,
        requests: [],
        metrics: {
          total_requests: 0,
          successful_requests: 0,
          avg_response_time: 0,
          total_tokens: 0,
          preferred_styles: {},
          preferred_providers: {},
        },
      });
    }

    const session = this.sessions.get(sessionId);
    session.requests.push(requestData.request_id);
    session.last_activity = requestData.timestamp;
  }

  generateReport(options = {}) {
    const {
      time_range = '24h',
      categories = Object.keys(this.trackingCategories),
      format = 'summary',
      include_trends = true,
    } = options;

    const timeFilter = this.createTimeFilter(time_range);
    const filteredMetrics = Array.from(this.metrics.values()).filter((metric) =>
      timeFilter(new Date(metric.timestamp))
    );

    const report = {
      generated_at: new Date().toISOString(),
      time_range,
      total_requests: filteredMetrics.length,
      categories: {},
    };

    categories.forEach((category) => {
      report.categories[category] = this.generateCategoryReport(
        category,
        filteredMetrics,
        format
      );
    });

    if (include_trends) {
      report.trends = this.generateTrendAnalysis(filteredMetrics, time_range);
    }

    return report;
  }

  generateCategoryReport(category, metrics, format) {
    const categoryConfig = this.trackingCategories[category];
    if (!categoryConfig) return {};

    const report = {};

    Object.keys(categoryConfig).forEach((metricName) => {
      const values = this.extractMetricValues(metrics, metricName);

      if (values.length > 0) {
        report[metricName] = {
          description: categoryConfig[metricName],
          count: values.length,
          ...this.calculateStatistics(values, metricName),
        };
      }
    });

    return report;
  }

  extractMetricValues(metrics, metricName) {
    const values = [];

    metrics.forEach((metric) => {
      let value = null;

      switch (metricName) {
        case 'response_time':
          value = metric.metrics?.response_time;
          break;
        case 'token_usage':
          value = metric.metrics?.token_usage;
          break;
        case 'success_rate':
          value = metric.metrics?.success ? 1 : 0;
          break;
        case 'error_rate':
          value = metric.metrics?.success ? 0 : 1;
          break;
        case 'relevance_score':
          value = metric.metrics?.quality_scores?.relevance;
          break;
        case 'completeness_score':
          value = metric.metrics?.quality_scores?.completeness;
          break;
        case 'creativity_score':
          value = metric.metrics?.quality_scores?.creativity;
          break;
        case 'coherence_score':
          value = metric.metrics?.quality_scores?.coherence;
          break;
        case 'user_satisfaction':
          value = metric.user_feedback?.satisfaction_rating;
          break;
        case 'prompt_types':
          value = metric.prompt_type;
          break;
        case 'provider_usage':
          value = metric.provider;
          break;
        case 'style_preferences':
          value = metric.style;
          break;
        case 'quality_levels':
          value = metric.quality;
          break;
      }

      if (value !== null && value !== undefined) {
        values.push(value);
      }
    });

    return values;
  }

  calculateStatistics(values, metricName) {
    if (values.length === 0) return {};

    // For categorical data
    if (typeof values[0] === 'string') {
      const distribution = {};
      values.forEach((value) => {
        distribution[value] = (distribution[value] || 0) + 1;
      });

      const sortedDistribution = Object.entries(distribution)
        .sort(([, a], [, b]) => b - a)
        .reduce((obj, [key, value]) => {
          obj[key] = {
            count: value,
            percentage: ((value / values.length) * 100).toFixed(1),
          };
          return obj;
        }, {});

      return {
        distribution: sortedDistribution,
        most_common: Object.keys(sortedDistribution)[0],
        unique_values: Object.keys(distribution).length,
      };
    }

    // For numerical data
    const sorted = values.sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    // Calculate standard deviation
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    // Calculate percentiles
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    return {
      mean: Number(mean.toFixed(2)),
      median: Number(median.toFixed(2)),
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      std_dev: Number(stdDev.toFixed(2)),
      percentiles: {
        p25: Number(p25.toFixed(2)),
        p75: Number(p75.toFixed(2)),
        p95: Number(p95.toFixed(2)),
      },
    };
  }

  generateTrendAnalysis(metrics, timeRange) {
    const trends = {
      performance_trend: this.calculatePerformanceTrend(metrics),
      quality_trend: this.calculateQualityTrend(metrics),
      usage_trend: this.calculateUsageTrend(metrics),
      error_trend: this.calculateErrorTrend(metrics),
    };

    return trends;
  }

  calculatePerformanceTrend(metrics) {
    const timeSlots = this.groupMetricsByTime(metrics, 'hour');
    const responseTimes = [];

    Object.keys(timeSlots)
      .sort()
      .forEach((timeSlot) => {
        const slotMetrics = timeSlots[timeSlot];
        const avgResponseTime =
          slotMetrics
            .filter((m) => m.metrics?.response_time)
            .reduce((sum, m) => sum + m.metrics.response_time, 0) /
          slotMetrics.length;

        if (!isNaN(avgResponseTime)) {
          responseTimes.push({ time: timeSlot, value: avgResponseTime });
        }
      });

    return {
      data_points: responseTimes,
      trend_direction: this.calculateTrendDirection(
        responseTimes.map((r) => r.value)
      ),
      improvement_percentage: this.calculateImprovement(
        responseTimes.map((r) => r.value)
      ),
    };
  }

  calculateQualityTrend(metrics) {
    const timeSlots = this.groupMetricsByTime(metrics, 'hour');
    const qualityScores = [];

    Object.keys(timeSlots)
      .sort()
      .forEach((timeSlot) => {
        const slotMetrics = timeSlots[timeSlot];
        const avgQuality = this.calculateAverageQuality(slotMetrics);

        if (avgQuality > 0) {
          qualityScores.push({ time: timeSlot, value: avgQuality });
        }
      });

    return {
      data_points: qualityScores,
      trend_direction: this.calculateTrendDirection(
        qualityScores.map((q) => q.value)
      ),
      improvement_percentage: this.calculateImprovement(
        qualityScores.map((q) => q.value)
      ),
    };
  }

  calculateUsageTrend(metrics) {
    const timeSlots = this.groupMetricsByTime(metrics, 'hour');
    const usageData = [];

    Object.keys(timeSlots)
      .sort()
      .forEach((timeSlot) => {
        usageData.push({
          time: timeSlot,
          requests: timeSlots[timeSlot].length,
        });
      });

    return {
      data_points: usageData,
      trend_direction: this.calculateTrendDirection(
        usageData.map((u) => u.requests)
      ),
      peak_usage: Math.max(...usageData.map((u) => u.requests)),
      avg_usage:
        usageData.reduce((sum, u) => sum + u.requests, 0) / usageData.length,
    };
  }

  calculateErrorTrend(metrics) {
    const timeSlots = this.groupMetricsByTime(metrics, 'hour');
    const errorRates = [];

    Object.keys(timeSlots)
      .sort()
      .forEach((timeSlot) => {
        const slotMetrics = timeSlots[timeSlot];
        const errorRate =
          slotMetrics.filter((m) => !m.metrics?.success).length /
          slotMetrics.length;
        errorRates.push({ time: timeSlot, value: errorRate });
      });

    return {
      data_points: errorRates,
      trend_direction: this.calculateTrendDirection(
        errorRates.map((e) => e.value)
      ),
      current_error_rate: errorRates[errorRates.length - 1]?.value || 0,
    };
  }

  groupMetricsByTime(metrics, interval) {
    const groups = {};

    metrics.forEach((metric) => {
      const date = new Date(metric.timestamp);
      let key;

      switch (interval) {
        case 'hour':
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
          break;
        case 'day':
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `${weekStart.getFullYear()}-W${Math.ceil(
            weekStart.getDate() / 7
          )}`;
          break;
        default:
          key = date.toISOString().split('T')[0];
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(metric);
    });

    return groups;
  }

  calculateTrendDirection(values) {
    if (values.length < 2) return 'insufficient_data';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    if (Math.abs(change) < 0.05) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  calculateImprovement(values) {
    if (values.length < 2) return 0;

    const first = values[0];
    const last = values[values.length - 1];

    return (((last - first) / first) * 100).toFixed(1);
  }

  calculateAverageQuality(metrics) {
    const qualityScores = metrics
      .filter((m) => m.metrics?.quality_scores)
      .map((m) => {
        const scores = m.metrics.quality_scores;
        const scoreValues = Object.values(scores).filter(
          (s) => typeof s === 'number'
        );
        return scoreValues.length > 0
          ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
          : 0;
      })
      .filter((score) => score > 0);

    return qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : 0;
  }

  checkAlerts(trackingData) {
    const alerts = [];

    // Check response time
    if (trackingData.metrics.response_time) {
      const responseTime = trackingData.metrics.response_time;
      if (responseTime > this.alertThresholds.response_time.critical) {
        alerts.push({
          type: 'critical',
          metric: 'response_time',
          value: responseTime,
          threshold: this.alertThresholds.response_time.critical,
          message: `Critical response time: ${responseTime}ms`,
        });
      } else if (responseTime > this.alertThresholds.response_time.warning) {
        alerts.push({
          type: 'warning',
          metric: 'response_time',
          value: responseTime,
          threshold: this.alertThresholds.response_time.warning,
          message: `High response time: ${responseTime}ms`,
        });
      }
    }

    // Check success rate (calculated over recent requests)
    const recentMetrics = this.getRecentMetrics(10);
    const successRate =
      recentMetrics.filter((m) => m.metrics?.success).length /
      recentMetrics.length;

    if (successRate < this.alertThresholds.success_rate.critical) {
      alerts.push({
        type: 'critical',
        metric: 'success_rate',
        value: successRate,
        threshold: this.alertThresholds.success_rate.critical,
        message: `Critical success rate: ${(successRate * 100).toFixed(1)}%`,
      });
    }

    alerts.forEach((alert) => {
      alert.timestamp = new Date().toISOString();
      alert.request_id = trackingData.request_id;
      this.alerts.push(alert);
    });

    return alerts;
  }

  getRecentMetrics(count = 10) {
    return Array.from(this.metrics.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, count);
  }

  createTimeFilter(timeRange) {
    const now = new Date();
    let cutoffTime;

    switch (timeRange) {
      case '1h':
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffTime = new Date(0); // All time
    }

    return (timestamp) => timestamp >= cutoffTime;
  }

  updateAggregatedData(trackingData) {
    const date = new Date(trackingData.timestamp).toISOString().split('T')[0];

    if (!this.aggregatedData.has(date)) {
      this.aggregatedData.set(date, {
        date,
        total_requests: 0,
        successful_requests: 0,
        total_response_time: 0,
        total_tokens: 0,
        quality_scores: [],
        providers: {},
        styles: {},
        errors: [],
      });
    }

    const dayData = this.aggregatedData.get(date);
    dayData.total_requests++;

    if (trackingData.metrics.success) {
      dayData.successful_requests++;
    } else if (trackingData.metrics.error) {
      dayData.errors.push(trackingData.metrics.error);
    }

    if (trackingData.metrics.response_time) {
      dayData.total_response_time += trackingData.metrics.response_time;
    }

    if (trackingData.metrics.token_usage) {
      dayData.total_tokens += trackingData.metrics.token_usage;
    }

    if (trackingData.metrics.quality_scores) {
      dayData.quality_scores.push(trackingData.metrics.quality_scores);
    }

    // Track provider usage
    if (trackingData.provider) {
      dayData.providers[trackingData.provider] =
        (dayData.providers[trackingData.provider] || 0) + 1;
    }

    // Track style usage
    if (trackingData.style) {
      dayData.styles[trackingData.style] =
        (dayData.styles[trackingData.style] || 0) + 1;
    }
  }

  startAggregation() {
    // Run aggregation every hour
    setInterval(() => {
      this.performAggregation();
    }, 60 * 60 * 1000);
  }

  performAggregation() {
    // Clean up old data
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.retention_days);

    // Remove old metrics
    for (const [requestId, metric] of this.metrics.entries()) {
      if (new Date(metric.timestamp) < cutoffDate) {
        this.metrics.delete(requestId);
      }
    }

    // Remove old sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (new Date(session.last_activity || session.started_at) < cutoffDate) {
        this.sessions.delete(sessionId);
      }
    }

    // Remove old alerts
    this.alerts = this.alerts.filter(
      (alert) => new Date(alert.timestamp) >= cutoffDate
    );
  }

  getAlerts(severity = null) {
    let alerts = this.alerts;

    if (severity) {
      alerts = alerts.filter((alert) => alert.type === severity);
    }

    return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  clearAlerts(olderThan = null) {
    if (olderThan) {
      const cutoff = new Date(olderThan);
      this.alerts = this.alerts.filter(
        (alert) => new Date(alert.timestamp) >= cutoff
      );
    } else {
      this.alerts = [];
    }
  }

  exportData(options = {}) {
    const {
      include_raw_metrics = false,
      include_sessions = false,
      include_aggregated = true,
      time_range = '30d',
    } = options;

    const timeFilter = this.createTimeFilter(time_range);
    const exportData = {
      exported_at: new Date().toISOString(),
      time_range,
      summary: this.generateReport({ time_range, format: 'summary' }),
    };

    if (include_raw_metrics) {
      exportData.raw_metrics = Array.from(this.metrics.values()).filter(
        (metric) => timeFilter(new Date(metric.timestamp))
      );
    }

    if (include_sessions) {
      exportData.sessions = Array.from(this.sessions.values()).filter(
        (session) => timeFilter(new Date(session.started_at))
      );
    }

    if (include_aggregated) {
      exportData.aggregated_data = Array.from(
        this.aggregatedData.values()
      ).filter((data) => timeFilter(new Date(data.date)));
    }

    return exportData;
  }
}

module.exports = PromptAnalytics;
