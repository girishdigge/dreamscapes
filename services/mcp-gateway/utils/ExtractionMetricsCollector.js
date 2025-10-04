/**
 * Extraction Metrics Collector
 *
 * Tracks extraction metrics for AI provider responses, including success rates,
 * pattern effectiveness, and failure patterns. Integrates with shared ValidationMonitor
 * for comprehensive monitoring across services.
 */

const { logger } = require('./logger');

// Lazy load shared module to avoid import issues in tests
let validationMonitor;
try {
  const shared = require('../../../shared');
  validationMonitor = shared.validationMonitor;
} catch (error) {
  // Fallback for tests or when shared module is not available
  validationMonitor = null;
  if (process.env.NODE_ENV !== 'test') {
    logger.warn('Failed to load shared ValidationMonitor', {
      error: error.message,
    });
  }
}

class ExtractionMetricsCollector {
  constructor(options = {}) {
    this.options = {
      enableLogging: options.enableLogging !== false,
      maxHistorySize: options.maxHistorySize || 1000,
      aggregationInterval: options.aggregationInterval || 60000, // 1 minute
      syncInterval: options.syncInterval || 300000, // 5 minutes
      ...options,
    };

    // Extraction metrics by provider
    this.extractionMetrics = {
      totalAttempts: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      byProvider: {},
      byPattern: {},
      failurePatterns: [],
      recentFailures: [],
    };

    // Extraction history
    this.extractionHistory = [];

    // Start aggregation and sync intervals
    if (this.options.aggregationInterval > 0) {
      this.aggregationTimer = setInterval(() => {
        this.aggregateMetrics();
      }, this.options.aggregationInterval);
    }

    if (this.options.syncInterval > 0) {
      this.syncTimer = setInterval(() => {
        this.syncWithSharedMonitor();
      }, this.options.syncInterval);
    }

    if (this.options.enableLogging) {
      logger.info('ExtractionMetricsCollector initialized', {
        maxHistorySize: this.options.maxHistorySize,
        aggregationInterval: this.options.aggregationInterval,
        syncInterval: this.options.syncInterval,
      });
    }
  }

  /**
   * Record an extraction attempt
   * @param {string} provider - Provider name (cerebras, openai, etc.)
   * @param {string} pattern - Pattern that was used or attempted
   * @param {boolean} success - Whether extraction succeeded
   * @param {Object} context - Additional context
   */
  recordExtractionAttempt(provider, pattern, success, context = {}) {
    const timestamp = new Date().toISOString();

    // Update total counts
    this.extractionMetrics.totalAttempts++;

    if (success) {
      this.extractionMetrics.successfulExtractions++;
    } else {
      this.extractionMetrics.failedExtractions++;
    }

    // Initialize provider metrics if not exists
    if (!this.extractionMetrics.byProvider[provider]) {
      this.extractionMetrics.byProvider[provider] = {
        totalAttempts: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
        patterns: {},
        lastSuccess: null,
        lastFailure: null,
      };
    }

    const providerMetrics = this.extractionMetrics.byProvider[provider];
    providerMetrics.totalAttempts++;

    if (success) {
      providerMetrics.successful++;
      providerMetrics.lastSuccess = timestamp;
    } else {
      providerMetrics.failed++;
      providerMetrics.lastFailure = timestamp;
    }

    // Update success rate
    providerMetrics.successRate =
      providerMetrics.totalAttempts > 0
        ? (providerMetrics.successful / providerMetrics.totalAttempts) * 100
        : 0;

    // Track pattern usage
    if (!providerMetrics.patterns[pattern]) {
      providerMetrics.patterns[pattern] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
      };
    }

    const patternMetrics = providerMetrics.patterns[pattern];
    patternMetrics.attempts++;

    if (success) {
      patternMetrics.successes++;
    } else {
      patternMetrics.failures++;
    }

    patternMetrics.successRate =
      patternMetrics.attempts > 0
        ? (patternMetrics.successes / patternMetrics.attempts) * 100
        : 0;

    // Track global pattern metrics
    if (!this.extractionMetrics.byPattern[pattern]) {
      this.extractionMetrics.byPattern[pattern] = {
        attempts: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
        providers: {},
      };
    }

    const globalPatternMetrics = this.extractionMetrics.byPattern[pattern];
    globalPatternMetrics.attempts++;

    if (success) {
      globalPatternMetrics.successes++;
    } else {
      globalPatternMetrics.failures++;
    }

    globalPatternMetrics.successRate =
      globalPatternMetrics.attempts > 0
        ? (globalPatternMetrics.successes / globalPatternMetrics.attempts) * 100
        : 0;

    // Track provider usage for this pattern
    if (!globalPatternMetrics.providers[provider]) {
      globalPatternMetrics.providers[provider] = {
        attempts: 0,
        successes: 0,
      };
    }

    globalPatternMetrics.providers[provider].attempts++;
    if (success) {
      globalPatternMetrics.providers[provider].successes++;
    }

    // Add to history
    const record = {
      timestamp,
      provider,
      pattern,
      success,
      context: {
        requestId: context.requestId,
        responseType: context.responseType,
        attemptedPatterns: context.attemptedPatterns,
        ...context,
      },
    };

    this.extractionHistory.push(record);

    // Trim history if exceeds max size
    if (this.extractionHistory.length > this.options.maxHistorySize) {
      this.extractionHistory.shift();
    }

    // Log if enabled
    if (this.options.enableLogging) {
      if (success) {
        logger.debug('Extraction attempt succeeded', {
          provider,
          pattern,
          requestId: context.requestId,
        });
      } else {
        logger.warn('Extraction attempt failed', {
          provider,
          pattern,
          requestId: context.requestId,
          attemptedPatterns: context.attemptedPatterns?.length || 0,
        });
      }
    }
  }

  /**
   * Record an extraction failure with detailed information
   * @param {string} provider - Provider name
   * @param {*} response - The response that failed extraction
   * @param {Array} attemptedPatterns - List of patterns that were attempted
   * @param {Object} context - Additional context
   */
  recordExtractionFailure(
    provider,
    response,
    attemptedPatterns = [],
    context = {}
  ) {
    const timestamp = new Date().toISOString();

    // Create failure record
    const failureRecord = {
      timestamp,
      provider,
      attemptedPatterns: attemptedPatterns.map((attempt) => ({
        pattern: attempt.pattern,
        description: attempt.description,
        reason: attempt.reason,
      })),
      responseDetails: {
        type: typeof response,
        isNull: response === null || response === undefined,
        isArray: Array.isArray(response),
        topLevelKeys:
          response && typeof response === 'object' && !Array.isArray(response)
            ? Object.keys(response)
            : [],
        hasContent:
          response && typeof response === 'object' && 'content' in response,
        hasData: response && typeof response === 'object' && 'data' in response,
        hasChoices:
          response && typeof response === 'object' && 'choices' in response,
      },
      context: {
        requestId: context.requestId,
        errorId: context.errorId,
        ...context,
      },
    };

    // Add to recent failures
    this.extractionMetrics.recentFailures.push(failureRecord);

    // Keep only last 100 failures
    if (this.extractionMetrics.recentFailures.length > 100) {
      this.extractionMetrics.recentFailures.shift();
    }

    // Detect and record failure patterns
    this.detectAndRecordFailurePattern(failureRecord);

    // Log detailed failure information
    if (this.options.enableLogging) {
      logger.error('Extraction failure recorded', {
        provider,
        attemptedPatternsCount: attemptedPatterns.length,
        responseType: failureRecord.responseDetails.type,
        topLevelKeys: failureRecord.responseDetails.topLevelKeys,
        requestId: context.requestId,
      });
    }
  }

  /**
   * Detect and record failure patterns
   * @private
   * @param {Object} failureRecord - Failure record
   */
  detectAndRecordFailurePattern(failureRecord) {
    const { provider, responseDetails, attemptedPatterns } = failureRecord;

    // Create pattern signature
    const patternSignature = {
      provider,
      responseType: responseDetails.type,
      hasContent: responseDetails.hasContent,
      hasData: responseDetails.hasData,
      hasChoices: responseDetails.hasChoices,
      topLevelKeysCount: responseDetails.topLevelKeys.length,
      attemptedPatternsCount: attemptedPatterns.length,
    };

    // Check if this pattern already exists
    const existingPattern = this.extractionMetrics.failurePatterns.find(
      (p) =>
        p.provider === patternSignature.provider &&
        p.responseType === patternSignature.responseType &&
        p.hasContent === patternSignature.hasContent &&
        p.hasData === patternSignature.hasData &&
        p.hasChoices === patternSignature.hasChoices
    );

    if (existingPattern) {
      existingPattern.occurrences++;
      existingPattern.lastOccurrence = failureRecord.timestamp;
      existingPattern.examples.push({
        timestamp: failureRecord.timestamp,
        requestId: failureRecord.context.requestId,
        topLevelKeys: responseDetails.topLevelKeys,
      });

      // Keep only last 5 examples
      if (existingPattern.examples.length > 5) {
        existingPattern.examples.shift();
      }
    } else {
      // Create new failure pattern
      this.extractionMetrics.failurePatterns.push({
        ...patternSignature,
        occurrences: 1,
        firstOccurrence: failureRecord.timestamp,
        lastOccurrence: failureRecord.timestamp,
        examples: [
          {
            timestamp: failureRecord.timestamp,
            requestId: failureRecord.context.requestId,
            topLevelKeys: responseDetails.topLevelKeys,
          },
        ],
      });
    }

    // Sort failure patterns by occurrences
    this.extractionMetrics.failurePatterns.sort(
      (a, b) => b.occurrences - a.occurrences
    );

    // Keep only top 20 failure patterns
    if (this.extractionMetrics.failurePatterns.length > 20) {
      this.extractionMetrics.failurePatterns =
        this.extractionMetrics.failurePatterns.slice(0, 20);
    }
  }

  /**
   * Get extraction success rate for a provider
   * @param {string} provider - Provider name
   * @returns {number} Success rate (0-100)
   */
  getExtractionSuccessRate(provider) {
    const providerMetrics = this.extractionMetrics.byProvider[provider];

    if (!providerMetrics || providerMetrics.totalAttempts === 0) {
      return 0;
    }

    return providerMetrics.successRate;
  }

  /**
   * Get successful patterns by provider
   * @param {string} provider - Optional provider name
   * @returns {Object} Successful patterns
   */
  getSuccessfulPatternsByProvider(provider = null) {
    if (provider) {
      const providerMetrics = this.extractionMetrics.byProvider[provider];

      if (!providerMetrics) {
        return {};
      }

      // Get patterns sorted by success rate
      const patterns = Object.entries(providerMetrics.patterns)
        .map(([pattern, metrics]) => ({
          pattern,
          ...metrics,
        }))
        .filter((p) => p.successes > 0)
        .sort((a, b) => b.successRate - a.successRate);

      return {
        provider,
        patterns,
        totalPatterns: patterns.length,
      };
    }

    // Get successful patterns for all providers
    const result = {};

    for (const [providerName, providerMetrics] of Object.entries(
      this.extractionMetrics.byProvider
    )) {
      const patterns = Object.entries(providerMetrics.patterns)
        .map(([pattern, metrics]) => ({
          pattern,
          ...metrics,
        }))
        .filter((p) => p.successes > 0)
        .sort((a, b) => b.successRate - a.successRate);

      result[providerName] = {
        patterns,
        totalPatterns: patterns.length,
      };
    }

    return result;
  }

  /**
   * Get failure patterns
   * @param {number} limit - Maximum number of patterns to return
   * @returns {Array} Failure patterns
   */
  getFailurePatterns(limit = 10) {
    return this.extractionMetrics.failurePatterns.slice(0, limit);
  }

  /**
   * Aggregate metrics periodically
   * @private
   */
  aggregateMetrics() {
    // Calculate overall success rate
    const overallSuccessRate =
      this.extractionMetrics.totalAttempts > 0
        ? (this.extractionMetrics.successfulExtractions /
            this.extractionMetrics.totalAttempts) *
          100
        : 0;

    // Identify top performing patterns
    const topPatterns = Object.entries(this.extractionMetrics.byPattern)
      .map(([pattern, metrics]) => ({
        pattern,
        ...metrics,
      }))
      .filter((p) => p.successes > 0)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10);

    // Identify problematic providers
    const problematicProviders = Object.entries(
      this.extractionMetrics.byProvider
    )
      .map(([provider, metrics]) => ({
        provider,
        ...metrics,
      }))
      .filter((p) => p.successRate < 50 && p.totalAttempts > 10)
      .sort((a, b) => a.successRate - b.successRate);

    // Generate alerts if alerting system is available
    if (this.alertingSystem) {
      this.generateExtractionAlerts(this.alertingSystem);
    }

    if (this.options.enableLogging) {
      logger.info('Extraction metrics aggregated', {
        totalAttempts: this.extractionMetrics.totalAttempts,
        overallSuccessRate: overallSuccessRate.toFixed(2) + '%',
        topPatternsCount: topPatterns.length,
        problematicProvidersCount: problematicProviders.length,
        failurePatternsCount: this.extractionMetrics.failurePatterns.length,
      });
    }
  }

  /**
   * Set alerting system for automatic alert generation
   * @param {Object} alertingSystem - AlertingSystem instance
   */
  setAlertingSystem(alertingSystem) {
    this.alertingSystem = alertingSystem;

    if (this.options.enableLogging) {
      logger.info('AlertingSystem integrated with ExtractionMetricsCollector');
    }
  }

  /**
   * Sync extraction metrics with shared ValidationMonitor
   */
  syncWithSharedMonitor() {
    // Skip if validationMonitor is not available
    if (!validationMonitor) {
      if (this.options.enableLogging) {
        logger.debug('Skipping sync - ValidationMonitor not available');
      }
      return;
    }

    try {
      // Create extraction metrics summary for shared monitor
      const extractionSummary = {
        timestamp: new Date().toISOString(),
        service: 'mcp-gateway',
        type: 'extraction',
        metrics: {
          totalAttempts: this.extractionMetrics.totalAttempts,
          successfulExtractions: this.extractionMetrics.successfulExtractions,
          failedExtractions: this.extractionMetrics.failedExtractions,
          successRate:
            this.extractionMetrics.totalAttempts > 0
              ? (this.extractionMetrics.successfulExtractions /
                  this.extractionMetrics.totalAttempts) *
                100
              : 0,
          byProvider: {},
        },
      };

      // Add provider-specific metrics
      for (const [provider, metrics] of Object.entries(
        this.extractionMetrics.byProvider
      )) {
        extractionSummary.metrics.byProvider[provider] = {
          totalAttempts: metrics.totalAttempts,
          successful: metrics.successful,
          failed: metrics.failed,
          successRate: metrics.successRate,
          topPatterns: Object.entries(metrics.patterns)
            .map(([pattern, patternMetrics]) => ({
              pattern,
              successRate: patternMetrics.successRate,
              attempts: patternMetrics.attempts,
            }))
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, 5),
        };
      }

      // Store extraction metrics in ValidationMonitor's custom metrics
      if (!validationMonitor.metrics.extraction) {
        validationMonitor.metrics.extraction = {
          totalAttempts: 0,
          successfulExtractions: 0,
          failedExtractions: 0,
          byProvider: {},
          byPattern: {},
          lastSync: null,
        };
      }

      // Update extraction metrics in shared monitor
      validationMonitor.metrics.extraction = {
        totalAttempts: this.extractionMetrics.totalAttempts,
        successfulExtractions: this.extractionMetrics.successfulExtractions,
        failedExtractions: this.extractionMetrics.failedExtractions,
        successRate: extractionSummary.metrics.successRate,
        byProvider: extractionSummary.metrics.byProvider,
        byPattern: Object.fromEntries(
          Object.entries(this.extractionMetrics.byPattern)
            .map(([pattern, metrics]) => [
              pattern,
              {
                attempts: metrics.attempts,
                successes: metrics.successes,
                failures: metrics.failures,
                successRate: metrics.successRate,
              },
            ])
            .slice(0, 10)
        ),
        failurePatterns: this.extractionMetrics.failurePatterns.slice(0, 5),
        lastSync: new Date().toISOString(),
      };

      // Also record as validation for compatibility
      if (typeof validationMonitor.recordValidation === 'function') {
        // Create a pseudo-validation result for extraction metrics
        const pseudoValidation = {
          valid: this.extractionMetrics.successfulExtractions > 0,
          errorCount: this.extractionMetrics.failedExtractions,
          errors: this.extractionMetrics.recentFailures
            .slice(0, 5)
            .map((failure) => ({
              field: 'extraction',
              error: 'EXTRACTION_FAILED',
              message: `Extraction failed for ${failure.provider}`,
              context: {
                provider: failure.provider,
                attemptedPatterns: failure.attemptedPatterns.length,
              },
            })),
        };

        validationMonitor.recordValidation(
          'mcp-gateway-extraction',
          pseudoValidation,
          {
            operation: 'extraction',
            extractionMetrics: extractionSummary.metrics,
          }
        );
      }

      if (this.options.enableLogging) {
        logger.debug(
          'Synced extraction metrics with shared ValidationMonitor',
          {
            totalAttempts: this.extractionMetrics.totalAttempts,
            successRate: extractionSummary.metrics.successRate.toFixed(2) + '%',
            providers: Object.keys(this.extractionMetrics.byProvider).length,
          }
        );
      }
    } catch (error) {
      logger.error('Error syncing with shared ValidationMonitor', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Generate alerts for extraction issues
   * @param {Object} alertingSystem - Optional AlertingSystem instance
   * @returns {Array} Generated alerts
   */
  generateExtractionAlerts(alertingSystem = null) {
    const alerts = [];
    const timestamp = new Date().toISOString();

    // Calculate overall success rate
    const overallSuccessRate =
      this.extractionMetrics.totalAttempts > 0
        ? (this.extractionMetrics.successfulExtractions /
            this.extractionMetrics.totalAttempts) *
          100
        : 0;

    // Alert for high extraction failure rate (> 10%)
    if (this.extractionMetrics.totalAttempts > 10 && overallSuccessRate < 90) {
      const failureRate = 100 - overallSuccessRate;
      const severity = failureRate > 50 ? 'critical' : 'warning';

      const alert = {
        type: 'extraction_failure_rate',
        severity,
        category: 'extraction',
        message: `High extraction failure rate: ${failureRate.toFixed(1)}%`,
        details: {
          failureRate,
          successRate: overallSuccessRate,
          totalAttempts: this.extractionMetrics.totalAttempts,
          failedExtractions: this.extractionMetrics.failedExtractions,
          threshold: 10,
        },
        timestamp,
      };

      alerts.push(alert);

      // Send to alerting system if available
      if (alertingSystem && typeof alertingSystem.processAlert === 'function') {
        alertingSystem.processAlert(alert);
      }
    }

    // Alert for consistent extraction pattern failures
    for (const [pattern, metrics] of Object.entries(
      this.extractionMetrics.byPattern
    )) {
      if (metrics.attempts > 5 && metrics.successRate < 20) {
        const alert = {
          type: 'extraction_pattern_failure',
          severity: 'warning',
          category: 'extraction',
          message: `Extraction pattern consistently failing: ${pattern}`,
          details: {
            pattern,
            successRate: metrics.successRate,
            attempts: metrics.attempts,
            failures: metrics.failures,
            providers: Object.keys(metrics.providers),
          },
          timestamp,
        };

        alerts.push(alert);

        if (
          alertingSystem &&
          typeof alertingSystem.processAlert === 'function'
        ) {
          alertingSystem.processAlert(alert);
        }
      }
    }

    // Alert for provider-specific extraction issues
    for (const [provider, metrics] of Object.entries(
      this.extractionMetrics.byProvider
    )) {
      if (metrics.totalAttempts > 10 && metrics.successRate < 50) {
        const alert = {
          type: 'provider_extraction_failure',
          severity: 'critical',
          category: 'extraction',
          provider,
          message: `Provider ${provider} has critical extraction failure rate: ${(
            100 - metrics.successRate
          ).toFixed(1)}%`,
          details: {
            provider,
            successRate: metrics.successRate,
            totalAttempts: metrics.totalAttempts,
            failed: metrics.failed,
            lastFailure: metrics.lastFailure,
            topFailingPatterns: Object.entries(metrics.patterns)
              .filter(([, p]) => p.failures > 0)
              .sort(([, a], [, b]) => b.failures - a.failures)
              .slice(0, 3)
              .map(([pattern, p]) => ({
                pattern,
                failures: p.failures,
                successRate: p.successRate,
              })),
          },
          timestamp,
        };

        alerts.push(alert);

        if (
          alertingSystem &&
          typeof alertingSystem.processAlert === 'function'
        ) {
          alertingSystem.processAlert(alert);
        }
      }
    }

    // Alert for emerging failure patterns
    const recentFailurePatterns = this.extractionMetrics.failurePatterns.filter(
      (pattern) => {
        const lastOccurrence = new Date(pattern.lastOccurrence);
        const oneHourAgo = new Date(Date.now() - 3600000);
        return lastOccurrence >= oneHourAgo && pattern.occurrences >= 3;
      }
    );

    if (recentFailurePatterns.length > 0) {
      const alert = {
        type: 'emerging_extraction_pattern',
        severity: 'warning',
        category: 'extraction',
        message: `${recentFailurePatterns.length} new extraction failure patterns detected`,
        details: {
          patternCount: recentFailurePatterns.length,
          patterns: recentFailurePatterns.slice(0, 3).map((p) => ({
            provider: p.provider,
            responseType: p.responseType,
            occurrences: p.occurrences,
            lastOccurrence: p.lastOccurrence,
          })),
          timeWindow: '1 hour',
        },
        timestamp,
      };

      alerts.push(alert);

      if (alertingSystem && typeof alertingSystem.processAlert === 'function') {
        alertingSystem.processAlert(alert);
      }
    }

    if (this.options.enableLogging && alerts.length > 0) {
      logger.warn('Generated extraction alerts', {
        alertCount: alerts.length,
        criticalCount: alerts.filter((a) => a.severity === 'critical').length,
        warningCount: alerts.filter((a) => a.severity === 'warning').length,
      });
    }

    return alerts;
  }

  /**
   * Detect extraction patterns and generate insights
   * @returns {Object} Pattern insights
   */
  detectExtractionPatterns() {
    const insights = {
      timestamp: new Date().toISOString(),
      overallHealth: 'healthy',
      issues: [],
      recommendations: [],
      patterns: {
        successful: [],
        failing: [],
        emerging: [],
      },
    };

    // Calculate overall success rate
    const overallSuccessRate =
      this.extractionMetrics.totalAttempts > 0
        ? (this.extractionMetrics.successfulExtractions /
            this.extractionMetrics.totalAttempts) *
          100
        : 0;

    // Determine overall health
    if (overallSuccessRate < 50) {
      insights.overallHealth = 'critical';
      insights.issues.push({
        severity: 'critical',
        message: `Overall extraction success rate is critically low: ${overallSuccessRate.toFixed(
          1
        )}%`,
      });
    } else if (overallSuccessRate < 75) {
      insights.overallHealth = 'warning';
      insights.issues.push({
        severity: 'warning',
        message: `Overall extraction success rate is below target: ${overallSuccessRate.toFixed(
          1
        )}%`,
      });
    }

    // Identify successful patterns
    const successfulPatterns = Object.entries(this.extractionMetrics.byPattern)
      .map(([pattern, metrics]) => ({
        pattern,
        ...metrics,
      }))
      .filter((p) => p.successRate > 80 && p.attempts > 5)
      .sort((a, b) => b.successRate - a.successRate);

    insights.patterns.successful = successfulPatterns.slice(0, 5);

    // Identify failing patterns
    const failingPatterns = Object.entries(this.extractionMetrics.byPattern)
      .map(([pattern, metrics]) => ({
        pattern,
        ...metrics,
      }))
      .filter((p) => p.successRate < 20 && p.attempts > 5)
      .sort((a, b) => a.successRate - b.successRate);

    insights.patterns.failing = failingPatterns.slice(0, 5);

    if (failingPatterns.length > 0) {
      insights.issues.push({
        severity: 'warning',
        message: `${failingPatterns.length} extraction patterns have low success rates`,
      });

      insights.recommendations.push({
        priority: 'medium',
        message: 'Review and update failing extraction patterns',
        patterns: failingPatterns.slice(0, 3).map((p) => p.pattern),
      });
    }

    // Check for provider-specific issues
    for (const [provider, metrics] of Object.entries(
      this.extractionMetrics.byProvider
    )) {
      if (metrics.successRate < 50 && metrics.totalAttempts > 10) {
        insights.issues.push({
          severity: 'critical',
          message: `Provider ${provider} has critically low extraction success rate: ${metrics.successRate.toFixed(
            1
          )}%`,
          provider,
        });

        insights.recommendations.push({
          priority: 'high',
          message: `Investigate ${provider} response format and update extraction patterns`,
          provider,
          successRate: metrics.successRate,
        });
      }
    }

    // Identify emerging failure patterns
    const recentFailurePatterns = this.extractionMetrics.failurePatterns.filter(
      (pattern) => {
        const lastOccurrence = new Date(pattern.lastOccurrence);
        const oneHourAgo = new Date(Date.now() - 3600000);
        return lastOccurrence >= oneHourAgo && pattern.occurrences >= 3;
      }
    );

    insights.patterns.emerging = recentFailurePatterns.slice(0, 5);

    if (recentFailurePatterns.length > 0) {
      insights.issues.push({
        severity: 'warning',
        message: `${recentFailurePatterns.length} new failure patterns detected in the last hour`,
      });

      insights.recommendations.push({
        priority: 'high',
        message: 'Investigate emerging failure patterns immediately',
        patterns: recentFailurePatterns.slice(0, 3).map((p) => ({
          provider: p.provider,
          responseType: p.responseType,
          occurrences: p.occurrences,
        })),
      });
    }

    return insights;
  }

  /**
   * Get comprehensive metrics report
   * @returns {Object} Metrics report
   */
  getMetricsReport() {
    return {
      timestamp: new Date().toISOString(),
      overall: {
        totalAttempts: this.extractionMetrics.totalAttempts,
        successfulExtractions: this.extractionMetrics.successfulExtractions,
        failedExtractions: this.extractionMetrics.failedExtractions,
        successRate:
          this.extractionMetrics.totalAttempts > 0
            ? (this.extractionMetrics.successfulExtractions /
                this.extractionMetrics.totalAttempts) *
              100
            : 0,
      },
      byProvider: this.extractionMetrics.byProvider,
      byPattern: this.extractionMetrics.byPattern,
      failurePatterns: this.extractionMetrics.failurePatterns.slice(0, 10),
      recentFailures: this.extractionMetrics.recentFailures
        .slice(-20)
        .reverse(),
      insights: this.detectExtractionPatterns(),
    };
  }

  /**
   * Get recent extraction history
   * @param {number} limit - Maximum number of records to return
   * @returns {Array} Recent extraction history
   */
  getRecentHistory(limit = 50) {
    return this.extractionHistory.slice(-limit).reverse();
  }

  /**
   * Clear metrics and history
   * @param {string} provider - Optional provider to clear specific provider metrics
   */
  clearMetrics(provider = null) {
    if (provider) {
      // Clear specific provider metrics
      if (this.extractionMetrics.byProvider[provider]) {
        delete this.extractionMetrics.byProvider[provider];
      }

      // Remove provider from pattern metrics
      for (const pattern of Object.values(this.extractionMetrics.byPattern)) {
        if (pattern.providers[provider]) {
          delete pattern.providers[provider];
        }
      }

      // Remove provider from history
      this.extractionHistory = this.extractionHistory.filter(
        (record) => record.provider !== provider
      );

      if (this.options.enableLogging) {
        logger.info('Cleared extraction metrics for provider', { provider });
      }
    } else {
      // Clear all metrics
      this.extractionMetrics = {
        totalAttempts: 0,
        successfulExtractions: 0,
        failedExtractions: 0,
        byProvider: {},
        byPattern: {},
        failurePatterns: [],
        recentFailures: [],
      };

      this.extractionHistory = [];

      if (this.options.enableLogging) {
        logger.info('Cleared all extraction metrics');
      }
    }
  }

  /**
   * Destroy collector and clean up resources
   */
  destroy() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    this.clearMetrics();

    if (this.options.enableLogging) {
      logger.info('ExtractionMetricsCollector destroyed');
    }
  }
}

module.exports = ExtractionMetricsCollector;
