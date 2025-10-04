/**
 * Cross-Service Validation Monitor
 *
 * Tracks validation results across all services to provide insights into
 * validation health, common failure patterns, and service-specific issues.
 */

class ValidationMonitor {
  constructor(options = {}) {
    this.options = {
      enableLogging: options.enableLogging !== false,
      maxHistorySize: options.maxHistorySize || 1000,
      aggregationInterval: options.aggregationInterval || 60000, // 1 minute
      ...options,
    };

    // Validation history by service
    this.validationHistory = new Map();

    // Aggregated metrics
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      byService: {},
      byErrorType: {},
      byFieldPath: {},
      recentFailures: [],
    };

    // Start aggregation interval
    if (this.options.aggregationInterval > 0) {
      this.aggregationTimer = setInterval(() => {
        this.aggregateMetrics();
      }, this.options.aggregationInterval);
    }
  }

  /**
   * Record a validation result
   * @param {string} service - Service name (express, mcp-gateway, etc.)
   * @param {Object} validationResult - Validation result object
   * @param {Object} context - Additional context
   */
  recordValidation(service, validationResult, context = {}) {
    const timestamp = new Date().toISOString();
    const record = {
      service,
      timestamp,
      valid: validationResult.valid,
      errorCount: validationResult.errorCount || 0,
      errors: validationResult.errors || [],
      warnings: validationResult.warnings || [],
      validationTime: validationResult.validationTime || 0,
      context: {
        dreamId: context.dreamId,
        requestId: context.requestId,
        operation: context.operation,
        ...context,
      },
    };

    // Add to service-specific history
    if (!this.validationHistory.has(service)) {
      this.validationHistory.set(service, []);
    }

    const serviceHistory = this.validationHistory.get(service);
    serviceHistory.push(record);

    // Trim history if it exceeds max size
    if (serviceHistory.length > this.options.maxHistorySize) {
      serviceHistory.shift();
    }

    // Update metrics
    this.updateMetrics(record);

    // Log if enabled
    if (this.options.enableLogging) {
      this.logValidation(record);
    }
  }

  /**
   * Record a repair operation
   * @param {string} service - Service name (express, mcp-gateway, etc.)
   * @param {string} provider - Provider name (cerebras, openai, etc.)
   * @param {Object} repairResult - Repair result object
   */
  recordRepair(service, provider, repairResult) {
    const timestamp = new Date().toISOString();

    // Initialize repair metrics if not exists
    if (!this.metrics.repairs) {
      this.metrics.repairs = {
        total: 0,
        successful: 0,
        failed: 0,
        byService: {},
        byProvider: {},
        byStrategy: {},
      };
    }

    // Update total counts
    this.metrics.repairs.total++;
    if (repairResult.success) {
      this.metrics.repairs.successful++;
    } else {
      this.metrics.repairs.failed++;
    }

    // Update service-specific repair metrics
    if (!this.metrics.repairs.byService[service]) {
      this.metrics.repairs.byService[service] = {
        total: 0,
        successful: 0,
        failed: 0,
        averageProcessingTime: 0,
        totalProcessingTime: 0,
      };
    }

    const serviceRepairMetrics = this.metrics.repairs.byService[service];
    serviceRepairMetrics.total++;
    serviceRepairMetrics.totalProcessingTime +=
      repairResult.processingTime || 0;
    serviceRepairMetrics.averageProcessingTime =
      serviceRepairMetrics.totalProcessingTime / serviceRepairMetrics.total;

    if (repairResult.success) {
      serviceRepairMetrics.successful++;
    } else {
      serviceRepairMetrics.failed++;
    }

    // Update provider-specific repair metrics
    if (!this.metrics.repairs.byProvider[provider]) {
      this.metrics.repairs.byProvider[provider] = {
        total: 0,
        successful: 0,
        failed: 0,
      };
    }

    const providerRepairMetrics = this.metrics.repairs.byProvider[provider];
    providerRepairMetrics.total++;
    if (repairResult.success) {
      providerRepairMetrics.successful++;
    } else {
      providerRepairMetrics.failed++;
    }

    // Track strategies used
    if (repairResult.strategiesApplied) {
      repairResult.strategiesApplied.forEach((strategy) => {
        this.metrics.repairs.byStrategy[strategy] =
          (this.metrics.repairs.byStrategy[strategy] || 0) + 1;
      });
    }

    // Log if enabled
    if (this.options.enableLogging) {
      if (repairResult.success) {
        console.log(`[ValidationMonitor] [${service}] Repair succeeded`, {
          provider,
          strategiesApplied: repairResult.strategiesApplied?.length || 0,
          processingTime: `${repairResult.processingTime}ms`,
        });
      } else {
        console.warn(`[ValidationMonitor] [${service}] Repair failed`, {
          provider,
          remainingErrors: repairResult.remainingErrorCount || 0,
          processingTime: `${repairResult.processingTime}ms`,
        });
      }
    }
  }

  /**
   * Update aggregated metrics
   * @private
   */
  updateMetrics(record) {
    // Update total counts
    this.metrics.totalValidations++;

    if (record.valid) {
      this.metrics.successfulValidations++;
    } else {
      this.metrics.failedValidations++;
    }

    // Update service-specific metrics
    if (!this.metrics.byService[record.service]) {
      this.metrics.byService[record.service] = {
        total: 0,
        successful: 0,
        failed: 0,
        averageValidationTime: 0,
        totalValidationTime: 0,
        errorTypes: {},
      };
    }

    const serviceMetrics = this.metrics.byService[record.service];
    serviceMetrics.total++;
    serviceMetrics.totalValidationTime += record.validationTime;
    serviceMetrics.averageValidationTime =
      serviceMetrics.totalValidationTime / serviceMetrics.total;

    if (record.valid) {
      serviceMetrics.successful++;
    } else {
      serviceMetrics.failed++;

      // Track error types
      record.errors.forEach((error) => {
        const errorType = error.error || 'UNKNOWN_ERROR';
        this.metrics.byErrorType[errorType] =
          (this.metrics.byErrorType[errorType] || 0) + 1;

        serviceMetrics.errorTypes[errorType] =
          (serviceMetrics.errorTypes[errorType] || 0) + 1;

        // Track field paths
        if (error.field) {
          this.metrics.byFieldPath[error.field] =
            (this.metrics.byFieldPath[error.field] || 0) + 1;
        }
      });

      // Add to recent failures
      this.metrics.recentFailures.push({
        service: record.service,
        timestamp: record.timestamp,
        errorCount: record.errorCount,
        errors: record.errors.slice(0, 3), // Keep first 3 errors
        context: record.context,
      });

      // Keep only last 100 recent failures
      if (this.metrics.recentFailures.length > 100) {
        this.metrics.recentFailures.shift();
      }
    }
  }

  /**
   * Aggregate metrics periodically
   * @private
   */
  aggregateMetrics() {
    // Calculate success rates
    for (const [service, metrics] of Object.entries(this.metrics.byService)) {
      metrics.successRate =
        metrics.total > 0 ? (metrics.successful / metrics.total) * 100 : 0;
      metrics.failureRate =
        metrics.total > 0 ? (metrics.failed / metrics.total) * 100 : 0;
    }

    // Identify top error types
    const sortedErrors = Object.entries(this.metrics.byErrorType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    this.metrics.topErrorTypes = sortedErrors.map(([errorType, count]) => ({
      errorType,
      count,
      percentage: (count / this.metrics.failedValidations) * 100,
    }));

    // Identify problematic fields
    const sortedFields = Object.entries(this.metrics.byFieldPath)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    this.metrics.problematicFields = sortedFields.map(([field, count]) => ({
      field,
      count,
      percentage: (count / this.metrics.failedValidations) * 100,
    }));

    if (this.options.enableLogging) {
      console.log('[ValidationMonitor] Metrics aggregated', {
        totalValidations: this.metrics.totalValidations,
        successRate:
          this.metrics.totalValidations > 0
            ? (this.metrics.successfulValidations /
                this.metrics.totalValidations) *
              100
            : 0,
        topErrorTypes: this.metrics.topErrorTypes?.slice(0, 3),
      });
    }
  }

  /**
   * Log validation record
   * @private
   */
  logValidation(record) {
    if (record.valid) {
      console.log(`[ValidationMonitor] [${record.service}] Validation passed`, {
        validationTime: `${record.validationTime}ms`,
        dreamId: record.context.dreamId,
      });
    } else {
      console.warn(
        `[ValidationMonitor] [${record.service}] Validation failed`,
        {
          errorCount: record.errorCount,
          errors: record.errors.slice(0, 3).map((e) => ({
            field: e.field,
            error: e.error,
            message: e.message,
          })),
          dreamId: record.context.dreamId,
        }
      );
    }
  }

  /**
   * Get validation metrics for a specific service
   * @param {string} service - Service name
   * @returns {Object} Service-specific metrics
   */
  getServiceMetrics(service) {
    const serviceMetrics = this.metrics.byService[service];

    if (!serviceMetrics) {
      return {
        service,
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        failureRate: 0,
        averageValidationTime: 0,
        errorTypes: {},
      };
    }

    return {
      service,
      ...serviceMetrics,
      successRate:
        serviceMetrics.total > 0
          ? (serviceMetrics.successful / serviceMetrics.total) * 100
          : 0,
      failureRate:
        serviceMetrics.total > 0
          ? (serviceMetrics.failed / serviceMetrics.total) * 100
          : 0,
    };
  }

  /**
   * Get overall validation metrics
   * @returns {Object} Overall metrics
   */
  getOverallMetrics() {
    return {
      totalValidations: this.metrics.totalValidations,
      successfulValidations: this.metrics.successfulValidations,
      failedValidations: this.metrics.failedValidations,
      successRate:
        this.metrics.totalValidations > 0
          ? (this.metrics.successfulValidations /
              this.metrics.totalValidations) *
            100
          : 0,
      failureRate:
        this.metrics.totalValidations > 0
          ? (this.metrics.failedValidations / this.metrics.totalValidations) *
            100
          : 0,
      services: Object.keys(this.metrics.byService),
      topErrorTypes: this.metrics.topErrorTypes || [],
      problematicFields: this.metrics.problematicFields || [],
      recentFailuresCount: this.metrics.recentFailures.length,
    };
  }

  /**
   * Get validation health report
   * @returns {Object} Health report
   */
  getHealthReport() {
    const overallMetrics = this.getOverallMetrics();

    // Determine health status
    let healthStatus = 'healthy';
    const issues = [];

    if (overallMetrics.failureRate > 50) {
      healthStatus = 'critical';
      issues.push('High failure rate (>50%)');
    } else if (overallMetrics.failureRate > 25) {
      healthStatus = 'warning';
      issues.push('Elevated failure rate (>25%)');
    }

    // Check service-specific health
    const serviceHealth = {};
    for (const service of overallMetrics.services) {
      const serviceMetrics = this.getServiceMetrics(service);

      let serviceStatus = 'healthy';
      const serviceIssues = [];

      if (serviceMetrics.failureRate > 50) {
        serviceStatus = 'critical';
        serviceIssues.push('High failure rate');
      } else if (serviceMetrics.failureRate > 25) {
        serviceStatus = 'warning';
        serviceIssues.push('Elevated failure rate');
      }

      if (serviceMetrics.averageValidationTime > 1000) {
        serviceStatus = serviceStatus === 'healthy' ? 'warning' : serviceStatus;
        serviceIssues.push('Slow validation times');
      }

      serviceHealth[service] = {
        status: serviceStatus,
        issues: serviceIssues,
        metrics: serviceMetrics,
      };
    }

    return {
      timestamp: new Date().toISOString(),
      overallStatus: healthStatus,
      issues,
      overallMetrics,
      serviceHealth,
      recommendations: this.generateRecommendations(
        overallMetrics,
        serviceHealth
      ),
    };
  }

  /**
   * Generate recommendations based on metrics
   * @private
   */
  generateRecommendations(overallMetrics, serviceHealth) {
    const recommendations = [];

    // Check for high failure rates
    if (overallMetrics.failureRate > 25) {
      recommendations.push({
        priority: 'high',
        category: 'validation_failures',
        message: 'High validation failure rate detected',
        suggestion:
          'Review top error types and problematic fields to identify common issues',
        data: {
          topErrorTypes: overallMetrics.topErrorTypes?.slice(0, 3),
          problematicFields: overallMetrics.problematicFields?.slice(0, 3),
        },
      });
    }

    // Check for service-specific issues
    for (const [service, health] of Object.entries(serviceHealth)) {
      if (health.status === 'critical') {
        recommendations.push({
          priority: 'critical',
          category: 'service_health',
          message: `Service ${service} has critical validation issues`,
          suggestion: `Investigate ${service} validation logic and data flow`,
          data: {
            service,
            failureRate: health.metrics.failureRate,
            topErrors: Object.entries(health.metrics.errorTypes)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3),
          },
        });
      }
    }

    // Check for common error patterns
    if (
      overallMetrics.topErrorTypes &&
      overallMetrics.topErrorTypes.length > 0
    ) {
      const topError = overallMetrics.topErrorTypes[0];
      if (topError.percentage > 30) {
        recommendations.push({
          priority: 'medium',
          category: 'error_pattern',
          message: `Error type '${
            topError.errorType
          }' accounts for ${topError.percentage.toFixed(1)}% of failures`,
          suggestion: 'Focus on resolving this specific error type',
          data: {
            errorType: topError.errorType,
            count: topError.count,
            percentage: topError.percentage,
          },
        });
      }
    }

    // Check for problematic fields
    if (
      overallMetrics.problematicFields &&
      overallMetrics.problematicFields.length > 0
    ) {
      const topField = overallMetrics.problematicFields[0];
      if (topField.percentage > 30) {
        recommendations.push({
          priority: 'medium',
          category: 'field_validation',
          message: `Field '${topField.field}' is frequently failing validation`,
          suggestion:
            'Review data generation and transformation for this field',
          data: {
            field: topField.field,
            count: topField.count,
            percentage: topField.percentage,
          },
        });
      }
    }

    return recommendations;
  }

  /**
   * Get recent validation failures
   * @param {number} limit - Maximum number of failures to return
   * @returns {Array} Recent failures
   */
  getRecentFailures(limit = 20) {
    return this.metrics.recentFailures.slice(-limit).reverse();
  }

  /**
   * Get validation history for a service
   * @param {string} service - Service name
   * @param {number} limit - Maximum number of records to return
   * @returns {Array} Validation history
   */
  getServiceHistory(service, limit = 100) {
    const history = this.validationHistory.get(service) || [];
    return history.slice(-limit).reverse();
  }

  /**
   * Clear validation history
   * @param {string} service - Optional service name to clear specific service history
   */
  clearHistory(service = null) {
    if (service) {
      this.validationHistory.delete(service);

      // Reset service metrics
      if (this.metrics.byService[service]) {
        delete this.metrics.byService[service];
      }
    } else {
      this.validationHistory.clear();
      this.metrics = {
        totalValidations: 0,
        successfulValidations: 0,
        failedValidations: 0,
        byService: {},
        byErrorType: {},
        byFieldPath: {},
        recentFailures: [],
      };
    }

    if (this.options.enableLogging) {
      console.log('[ValidationMonitor] History cleared', {
        service: service || 'all',
      });
    }
  }

  /**
   * Destroy monitor and clean up resources
   */
  destroy() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    this.clearHistory();

    if (this.options.enableLogging) {
      console.log('[ValidationMonitor] Monitor destroyed');
    }
  }
}

// Create singleton instance
const validationMonitor = new ValidationMonitor({
  enableLogging: process.env.NODE_ENV !== 'test',
  maxHistorySize: 1000,
  aggregationInterval: 60000, // 1 minute
});

module.exports = {
  ValidationMonitor,
  validationMonitor,
};
