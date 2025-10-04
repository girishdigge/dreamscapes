// providers/ProviderManager.js
// Enhanced Provider Manager with intelligent routing and health monitoring

const EventEmitter = require('events');
const { EnhancedLoadBalancer } = require('./ProviderSelector');
const ProviderPreferenceManager = require('./ProviderPreferenceManager');
const IntelligentRetrySystem = require('../utils/IntelligentRetrySystem');
const EnhancedCircuitBreaker = require('./EnhancedCircuitBreaker');
const { logger, requestLogger } = require('../utils/logger');
/**
 * Provider Manager - Centralized management of all AI providers
 * Handles provider selection, load balancing, fallback logic, and health monitoring
 */
class ProviderManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.providers = new Map(); // provider_name -> provider_instance
    this.providerConfigs = new Map(); // provider_name -> config
    this.healthStatus = new Map(); // provider_name -> health_data
    this.metrics = new Map(); // provider_name -> metrics_data
    this.failureHistory = new Map(); // provider_name -> failure_history
    this.lastUsedProvider = null; // last used provider for context preservation

    // Enhanced load balancing and preference management
    this.loadBalancer = new EnhancedLoadBalancer({
      strategy: config.loadBalancingStrategy || 'weighted',
      adaptiveStrategy: config.adaptiveStrategy !== false,
      ...config.loadBalancer,
    });
    this.preferenceManager = new ProviderPreferenceManager({
      dynamicAdjustmentEnabled: config.dynamicAdjustmentEnabled !== false,
      contextualRulesEnabled: config.contextualRulesEnabled !== false,
      ...config.preferenceManager,
    });

    this.circuitBreakers = new Map(); // provider_name -> circuit_breaker

    // Enhanced monitoring components
    this.healthMonitor = null;
    this.metricsCollector = null;
    this.alertingSystem = null;

    // Initialize Intelligent Retry System
    this.retrySystem = new IntelligentRetrySystem({
      baseDelay: config.baseDelay || 1000,
      maxDelay: config.maxDelay || 30000,
      backoffMultiplier: config.backoffMultiplier || 2,
      maxRetryAttempts: config.maxRetryAttempts || 3,
      maxProviderRetries: config.maxProviderRetries || 2,
      enableProviderSwitching: config.enableProviderSwitching !== false,
      preserveContext: config.preserveContext !== false,
      enableCircuitBreaker: config.enableCircuitBreaker !== false,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000,
      ...config.retrySystem,
    });

    // Configuration
    this.config = {
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
      maxRetryAttempts: config.maxRetryAttempts || 3,
      backoffMultiplier: config.backoffMultiplier || 2,
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 60000, // 1 minute
      enableEnhancedMonitoring: config.enableEnhancedMonitoring !== false,
      enableAutomatedReporting: config.enableAutomatedReporting !== false,
      ...config,
    };

    // Start health monitoring
    this.startHealthMonitoring();

    console.log('ProviderManager initialized with config:', this.config);
  }

  /**
   * Initialize enhanced monitoring systems
   * @param {Object} monitoringConfig - Monitoring configuration
   */
  initializeEnhancedMonitoring(monitoringConfig = {}) {
    if (!this.config.enableEnhancedMonitoring) {
      console.log('Enhanced monitoring disabled');
      return;
    }
    try {
      app.use(requestLogger());
      // Initialize HealthMonitor
      const HealthMonitor = require('../monitoring/HealthMonitor');
      this.healthMonitor = new HealthMonitor({
        healthCheckInterval: this.config.healthCheckInterval,
        detailedCheckInterval: monitoringConfig.detailedCheckInterval || 300000,
        alertThresholds: monitoringConfig.alertThresholds || {},
        ...monitoringConfig.healthMonitor,
      });

      // Initialize MetricsCollector
      try {
        const MetricsCollector = require('../monitoring/MetricsCollector');
        this.metricsCollector = new MetricsCollector({
          collectionInterval: monitoringConfig.collectionInterval || 60000,
          aggregationInterval: monitoringConfig.aggregationInterval || 300000,
          enableRealTimeMetrics:
            monitoringConfig.enableRealTimeMetrics !== false,
          ...monitoringConfig.metricsCollector,
        });
      } catch (metricsError) {
        console.error(
          'Failed to initialize MetricsCollector:',
          metricsError.message
        );
        this.metricsCollector = null;
      }

      // Initialize AlertingSystem
      if (this.config.enableAutomatedReporting) {
        try {
          const AlertingSystem = require('./AlertingSystem');
          this.alertingSystem = new AlertingSystem({
            alertChannels: monitoringConfig.alertChannels || ['console', 'log'],
            alertThresholds: monitoringConfig.alertThresholds || {},
            suppressionRules: monitoringConfig.suppressionRules || {},
            reportingSchedule: monitoringConfig.reportingSchedule || {},
            ...monitoringConfig.alertingSystem,
          });
        } catch (alertingError) {
          console.error(
            'Failed to initialize AlertingSystem:',
            alertingError.message
          );
          this.alertingSystem = null;
        }
      }

      // Start monitoring systems
      this.startEnhancedMonitoring();

      console.log('Enhanced monitoring systems initialized');
    } catch (error) {
      console.error('Failed to initialize enhanced monitoring:', error.message);
      console.log('Continuing with basic monitoring only');
    }
  }

  /**
   * Start enhanced monitoring systems
   * @private
   */
  startEnhancedMonitoring() {
    if (this.healthMonitor) {
      this.healthMonitor.startMonitoring(this);
    }

    if (this.metricsCollector) {
      this.metricsCollector.startCollection(this);
    }

    if (this.alertingSystem) {
      this.alertingSystem.startReporting(
        this,
        this.healthMonitor,
        this.metricsCollector
      );
    }

    console.log('Enhanced monitoring systems started');
  }

  /**
   * Stop enhanced monitoring systems
   * @private
   */
  stopEnhancedMonitoring() {
    if (this.healthMonitor) {
      this.healthMonitor.stopMonitoring();
    }

    if (this.metricsCollector) {
      this.metricsCollector.stopCollection();
    }

    if (this.alertingSystem) {
      this.alertingSystem.stopReporting();
    }

    console.log('Enhanced monitoring systems stopped');
  }

  /**
   * Register a provider with the manager
   * @param {string} name - Provider name
   * @param {BaseProvider} provider - Provider instance
   * @param {Object} config - Provider configuration
   */
  registerProvider(name, provider, config = {}) {
    if (!provider || typeof provider.generateDream !== 'function') {
      throw new Error(
        `Invalid provider: ${name}. Must implement generateDream method.`
      );
    }

    this.providers.set(name, provider);
    this.providerConfigs.set(name, {
      enabled: true,
      priority: 1,
      limits: {
        requestsPerMinute: 100,
        tokensPerMinute: 10000,
        maxConcurrent: 10,
      },
      fallback: {
        enabled: true,
        retryAttempts: 3,
        backoffMultiplier: 2,
      },
      ...config,
    });

    // Initialize health status
    this.healthStatus.set(name, {
      isHealthy: true,
      lastCheck: null,
      consecutiveFailures: 0,
      lastError: null,
    });

    // Initialize metrics
    this.metrics.set(name, {
      requests: 0,
      successes: 0,
      failures: 0,
      avgResponseTime: 0,
      totalResponseTime: 0,
      lastRequestTime: null,
      rateLimitHits: 0,
      circuitBreakerTrips: 0,
    });

    // Initialize enhanced circuit breaker
    this.circuitBreakers.set(
      name,
      new EnhancedCircuitBreaker(name, {
        threshold: this.config.circuitBreakerThreshold,
        timeout: this.config.circuitBreakerTimeout,
        adaptiveThreshold: true,
        failureRateThreshold: 0.5,
        windowSize: 100,
        windowTimeMs: 300000,
      })
    );

    console.log(`Provider registered: ${name}`);
    this.emit('providerRegistered', { name, config });
  }

  /**
   * Unregister a provider
   * @param {string} name - Provider name
   */
  unregisterProvider(name) {
    this.providers.delete(name);
    this.providerConfigs.delete(name);
    this.healthStatus.delete(name);
    this.metrics.delete(name);
    this.circuitBreakers.delete(name);

    console.log(`Provider unregistered: ${name}`);
    this.emit('providerUnregistered', { name });
  }

  /**
   * Get list of registered providers
   * @returns {Array} Array of provider names
   */
  getProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Get all registered providers (alias for getProviders)
   * @returns {Array} Array of provider names
   */
  getRegisteredProviders() {
    return this.getProviders();
  }

  /**
   * Get a specific provider by name
   * @param {string} name - Provider name
   * @returns {Object|null} Provider instance or null if not found
   */
  getProvider(name) {
    return this.providers.get(name) || null;
  }

  /**
   * Select the best provider based on requirements and current status
   * @param {Object} requirements - Selection requirements
   * @returns {Promise<Object>} Selected provider info
   */
  async selectProvider(requirements = {}) {
    // First try to get healthy providers
    let availableProviders =
      this.getAvailableProvidersWithPreferences(requirements);

    // If no healthy providers available, implement fallback mechanism
    if (availableProviders.length === 0) {
      console.log(
        'No healthy providers available, attempting fallback to unhealthy providers'
      );

      // Try with unhealthy providers as fallback
      availableProviders = this.getAvailableProvidersWithPreferences({
        ...requirements,
        allowUnhealthy: true,
      });

      if (availableProviders.length === 0) {
        throw new Error('No providers available for fallback');
      }

      console.log(
        `Fallback activated: ${availableProviders.length} providers available`
      );
    }

    // Use enhanced load balancer to select best provider
    const selected = this.loadBalancer.selectProvider(
      availableProviders,
      requirements
    );

    const isHealthy = selected.isHealthy !== false;
    const fallbackUsed = !isHealthy;

    console.log(
      `Provider selected: ${selected.name} (score: ${
        selected.selectionMetadata?.score || 'N/A'
      }, healthy: ${isHealthy}, fallback: ${fallbackUsed})`
    );

    this.emit('providerSelected', {
      name: selected.name,
      requirements,
      score: selected.selectionMetadata?.score,
      strategy: selected.selectionMetadata?.strategy,
      metadata: selected.selectionMetadata,
      fallbackUsed,
      isHealthy,
    });

    // Ensure proper provider identification and metadata
    const providerInstance = this.providers.get(selected.name);
    const providerConfig = this.providerConfigs.get(selected.name);

    return {
      name: selected.name,
      provider: providerInstance,
      config: providerConfig,
      score: selected.selectionMetadata?.score || selected.score || 0,
      selectionMetadata: {
        ...selected.selectionMetadata,
        providerId: selected.name,
        providerType: providerInstance?.constructor?.name || 'Unknown',
        configSource: providerConfig ? 'configured' : 'default',
        selectionTimestamp: Date.now(),
        healthStatus: selected.health || 'unknown',
        fallbackUsed,
        isHealthy,
      },
      // Additional provider identification
      source: selected.name,
      type: providerInstance?.constructor?.name || 'Unknown',
      isHealthy: isHealthy,
      capabilities: providerConfig?.capabilities || [],
    };
  }

  /**
   * Execute operation with intelligent retry and fallback logic
   * @param {Function} operation - Operation to execute
   * @param {Array} providers - Preferred providers (optional)
   * @param {Object} options - Execution options
   * @returns {Promise<any>} Operation result
   */
  async executeWithIntelligentRetry(operation, providers = null, options = {}) {
    try {
      // Get available providers for retry system
      const availableProviders =
        providers ||
        (await this.getEnhancedProviderFallbackList(null, options));

      // Prepare providers for retry system
      const retryProviders = availableProviders.map((providerInfo) => {
        const providerName = providerInfo.name || providerInfo;
        const providerInstance = this.providers.get(providerName);

        return {
          name: providerName,
          provider: providerInstance,
          maxRetries:
            providerInfo.maxRetries || this.config.maxProviderRetries || 2,
        };
      });

      // Execute with intelligent retry system
      return await this.retrySystem.executeWithIntelligentRetry(
        operation,
        retryProviders,
        {
          ...options,
          requestId: options.requestId || this.generateRequestId(),
          context: options.context || {},
          operationType: options.operationType || 'generateDream',
        }
      );
    } catch (error) {
      console.error('Intelligent retry execution failed:', error.message);
      throw error;
    }
  }

  /**
   * Execute operation with automatic fallback (legacy method - enhanced with retry system)
   * @param {Function} operation - Operation to execute
   * @param {Array} providers - Preferred providers (optional)
   * @param {Object} options - Execution options
   * @returns {Promise<any>} Operation result
   */
  async executeWithFallback(operation, providers = null, options = {}) {
    const startTime = Date.now();
    const maxAttempts = options.maxAttempts || this.config.maxRetryAttempts;
    let lastError = null;
    let attemptCount = 0;
    let requestId = null;
    let contextPreservation = options.preserveContext !== false;
    let originalContext = options.context || {};

    // Enhanced provider selection with fallback ordering
    const providerList = await this.getEnhancedProviderFallbackList(
      providers,
      options
    );

    // Track retry attempts per provider for better fallback logic
    const providerRetryCount = new Map();

    // Enhanced fallback metadata tracking
    const fallbackMetadata = {
      startTime: startTime,
      totalProviders: providerList.length,
      attemptedProviders: [],
      fallbackReason: null,
      recoveryStrategy: options.recoveryStrategy || 'automatic',
      providerSwitches: 0,
    };

    for (const providerInfo of providerList) {
      const { name: providerName, maxRetries = 3 } = providerInfo;

      // Try this provider with retries
      let providerSuccess = false;
      let providerRetries = 0;

      while (providerRetries < maxRetries && !providerSuccess) {
        const provider = this.providers.get(providerName);
        const circuitBreaker = this.circuitBreakers.get(providerName);

        if (!provider || !circuitBreaker.canExecute()) {
          console.log(
            `Skipping ${providerName} - provider unavailable or circuit breaker open`
          );
          break;
        }

        attemptCount++;
        providerRetries++;
        providerRetryCount.set(
          providerName,
          (providerRetryCount.get(providerName) || 0) + 1
        );
        const attemptStartTime = Date.now();

        // Track provider attempt in fallback metadata
        if (
          !fallbackMetadata.attemptedProviders.find(
            (p) => p.name === providerName
          )
        ) {
          fallbackMetadata.attemptedProviders.push({
            name: providerName,
            firstAttemptTime: attemptStartTime,
            attempts: 0,
            errors: [],
          });
          if (fallbackMetadata.attemptedProviders.length > 1) {
            fallbackMetadata.providerSwitches++;
            fallbackMetadata.fallbackReason = lastError
              ? this.classifyError(lastError)
              : 'provider_unavailable';
          }
        }

        const providerAttempt = fallbackMetadata.attemptedProviders.find(
          (p) => p.name === providerName
        );
        providerAttempt.attempts++;

        // Preserve context for provider switching
        const enhancedContext = contextPreservation
          ? {
              ...originalContext,
              previousProvider: lastError ? this.getLastUsedProvider() : null,
              attemptNumber: attemptCount,
              totalAttempts: maxAttempts,
              failureHistory: this.getRecentFailureHistory(providerName),
              switchReason: lastError ? this.classifyError(lastError) : null,
            }
          : originalContext;

        // Record request start in metrics collector
        if (this.metricsCollector) {
          requestId = this.metricsCollector.recordRequestStart(providerName, {
            model: options.model,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            streaming: options.streaming,
            inputTokens: options.inputTokens,
            metadata: {
              operation: options.operationType || 'generateDream',
              attempt: attemptCount,
              totalAttempts: maxAttempts,
              providerRetryCount: providerRetries + 1,
              maxProviderRetries: maxRetries,
              contextPreserved: contextPreservation,
              ...options.metadata,
            },
          });
        }

        try {
          console.log(
            `Attempting operation with provider: ${providerName} (attempt ${attemptCount}, provider retry ${
              providerRetries + 1
            }/${maxRetries})`
          );

          // Enhanced operation execution with context preservation
          const result = await this.executeWithEnhancedTimeout(
            () => operation(provider, providerName, enhancedContext),
            this.calculateDynamicTimeout(providerName, options.timeout),
            providerName
          );

          const responseTime = Date.now() - attemptStartTime;

          // ============================================================
          // CRITICAL VALIDATION: Promise Detection in Operation Result
          // ============================================================
          // This validation loop inspects EVERY field in the result object to ensure
          // none of them contain unresolved Promises. This is a critical safety check
          // that prevents Promise leakage from reaching the caller (index.js).
          //
          // Why this matters:
          // - The operation callback (in index.js) should have awaited all async operations
          // - If a Promise is found here, it indicates a bug in the operation callback
          // - Without this check, the Promise would propagate to Express, causing 502 errors
          // - This is our last line of defense before returning to the caller
          //
          // Common scenarios this catches:
          // 1. Missing await on responseParser.extractContentSafely()
          // 2. Missing await on asyncHelpers.ensureResolved()
          // 3. Accidentally returning a Promise in any result field
          //
          // If this validation fails:
          // - We throw immediately with detailed context (provider, field, attempt)
          // - The error includes the field name that contains the Promise
          // - This helps developers quickly identify which await is missing
          // - The operation will retry with the next provider or fail gracefully
          if (result && typeof result === 'object') {
            for (const [key, value] of Object.entries(result)) {
              if (value instanceof Promise) {
                logger.error('Promise detected in operation result', {
                  provider: providerName,
                  field: key,
                  attemptNumber: attemptCount,
                  providerRetry: providerRetries + 1,
                  responseTime,
                });
                throw new Error(
                  `Operation result contains unresolved Promise in field: ${key}. ` +
                    `Provider: ${providerName}, Attempt: ${attemptCount}`
                );
              }
            }
          }

          // Update metrics for success
          this.updateProviderMetrics(providerName, true, responseTime);
          circuitBreaker.recordSuccess();

          // Record successful request completion
          if (this.metricsCollector && requestId) {
            this.metricsCollector.recordRequestEnd(requestId, {
              success: true,
              tokens: {
                output: result.tokens?.output || 0,
                total: result.tokens?.total || 0,
              },
            });
          }

          // Update last used provider for context preservation
          this.setLastUsedProvider(providerName);

          console.log(
            `Operation succeeded with provider: ${providerName} (${responseTime}ms, attempt ${attemptCount})`
          );
          this.emit('operationSuccess', {
            provider: providerName,
            responseTime,
            totalTime: Date.now() - startTime,
            attempts: attemptCount,
            providerRetries: providerRetries + 1,
            contextPreserved: contextPreservation,
            requestId,
          });

          // Log result state for debugging
          logger.info('Provider Manager Result validated:', {
            provider: providerName,
            hasContent: !!result.content,
            contentType: typeof result.content,
            contentIsPromise: result.content instanceof Promise,
            responseTime,
          });

          return result;
        } catch (error) {
          const responseTime = Date.now() - attemptStartTime;
          lastError = error;

          // Enhanced error classification and handling
          const errorType = this.classifyError(error);
          const errorSeverity = this.classifyErrorSeverity(error);
          const isRetryable = this.shouldRetryWithEnhancedLogic(
            error,
            providerName,
            providerRetries
          );

          // Track error in fallback metadata
          const providerAttempt = fallbackMetadata.attemptedProviders.find(
            (p) => p.name === providerName
          );
          if (providerAttempt) {
            providerAttempt.errors.push({
              type: errorType,
              severity: errorSeverity,
              message: error.message,
              timestamp: Date.now(),
              responseTime: responseTime,
              retryable: isRetryable,
            });
          }

          // Update metrics for failure
          this.updateProviderMetrics(
            providerName,
            false,
            responseTime,
            errorType
          );
          circuitBreaker.recordFailure();

          // Record failure history for context preservation
          this.recordFailureHistory(providerName, {
            error: error.message,
            errorType,
            errorSeverity,
            timestamp: Date.now(),
            responseTime,
            attempt: attemptCount,
            providerRetry: providerRetries + 1,
          });

          // Record failed request completion
          if (this.metricsCollector && requestId) {
            this.metricsCollector.recordRequestEnd(requestId, {
              success: false,
              error: error.message,
              errorType,
              errorSeverity,
            });
          }

          console.error(
            `Operation failed with provider: ${providerName} (attempt ${attemptCount}, provider retry ${
              providerRetries + 1
            }):`,
            error.message
          );
          this.emit('operationFailure', {
            provider: providerName,
            error: error.message,
            errorType,
            errorSeverity,
            responseTime,
            attempts: attemptCount,
            providerRetries: providerRetries + 1,
            isRetryable,
            requestId,
          });

          // Enhanced retry logic with exponential backoff
          if (isRetryable && providerRetries < maxRetries - 1) {
            const backoffTime = this.calculateEnhancedBackoff(
              providerRetries + 1,
              errorType,
              providerName
            );
            console.log(
              `Retrying ${providerName} in ${backoffTime}ms... (retry ${
                providerRetries + 1
              }/${maxRetries})`
            );
            await this.sleep(backoffTime);
            // Continue the inner loop to retry with same provider
            continue;
          } else if (errorSeverity === 'critical') {
            // For critical errors, immediately try next provider
            console.log(
              `Critical error with ${providerName}, switching to next provider immediately`
            );
            break; // Break out of retry loop for this provider
          } else {
            // No more retries for this provider, try next one
            break;
          }
        }
      }
    }

    // All providers failed
    const totalTime = Date.now() - startTime;
    console.error(
      `All providers failed after ${attemptCount} attempts (${totalTime}ms)`
    );

    // Enhanced failure reporting
    const failureReport = this.generateFailureReport(
      providerRetryCount,
      lastError
    );

    this.emit('allProvidersFailed', {
      attempts: attemptCount,
      totalTime,
      lastError: lastError?.message,
      failureReport,
      contextPreserved: contextPreservation,
    });

    throw new Error(
      `All providers failed after ${attemptCount} attempts. ${
        failureReport.summary
      }. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Enhanced fallback provider selection with intelligent ordering
   * @param {Array} excludeProviders - Providers to exclude from fallback
   * @param {Object} options - Fallback options
   * @returns {Array} Ordered list of fallback providers
   * @private
   */
  getFallbackProviders(excludeProviders = [], options = {}) {
    const allProviders = Array.from(this.providers.keys());
    const availableForFallback = allProviders.filter(
      (name) => !excludeProviders.includes(name)
    );

    // Get provider metadata for intelligent ordering
    const providersWithMetadata = availableForFallback.map((name) => {
      const config = this.providerConfigs.get(name);
      const health = this.healthStatus.get(name);
      const metrics = this.metrics.get(name);
      const circuitBreaker = this.circuitBreakers.get(name);

      return {
        name,
        config,
        health,
        metrics,
        circuitBreaker,
        isEnabled: config?.enabled || false,
        canExecute: circuitBreaker?.canExecute() || false,
        priority: config?.priority || 1,
        recentFailures: this.getRecentFailureCount(name, 300000), // 5 minutes
        lastFailureTime: this.getLastFailureTime(name),
      };
    });

    // Filter and sort providers for fallback
    return providersWithMetadata
      .filter((p) => p.isEnabled && p.canExecute)
      .sort((a, b) => {
        // Primary sort: fewer recent failures
        if (a.recentFailures !== b.recentFailures) {
          return a.recentFailures - b.recentFailures;
        }

        // Secondary sort: higher priority
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }

        // Tertiary sort: older last failure time (more time to recover)
        const aFailureTime = a.lastFailureTime || 0;
        const bFailureTime = b.lastFailureTime || 0;
        return aFailureTime - bFailureTime;
      })
      .map((p) => ({
        name: p.name,
        maxRetries: this.getProviderMaxRetries(p.name, options),
        priority: p.priority,
        lastFailureTime: p.lastFailureTime,
        recentFailures: p.recentFailures,
      }));
  }

  /**
   * Validate fallback scenario and determine recovery strategy
   * @param {Array} attemptedProviders - Providers already attempted
   * @param {Error} lastError - Last error encountered
   * @param {Object} options - Validation options
   * @returns {Object} Fallback validation result
   * @private
   */
  validateFallbackScenario(attemptedProviders, lastError, options = {}) {
    const totalProviders = this.providers.size;
    const attemptedCount = attemptedProviders.length;
    const remainingProviders = totalProviders - attemptedCount;

    const errorType = this.classifyError(lastError);
    const errorSeverity = this.classifyErrorSeverity(lastError);

    // Determine if fallback should continue
    const shouldContinueFallback =
      remainingProviders > 0 &&
      (errorSeverity !== 'critical' || options.allowCriticalFallback);

    // Determine recovery strategy
    let recoveryStrategy = 'continue';
    if (errorType === 'rate_limit') {
      recoveryStrategy = 'backoff_and_retry';
    } else if (errorType === 'authentication') {
      recoveryStrategy = 'skip_provider';
    } else if (errorSeverity === 'critical') {
      recoveryStrategy = 'immediate_fallback';
    }

    return {
      shouldContinue: shouldContinueFallback,
      remainingProviders,
      recoveryStrategy,
      errorType,
      errorSeverity,
      recommendation: this.generateFallbackRecommendation(
        attemptedProviders,
        errorType,
        remainingProviders
      ),
    };
  }

  /**
   * Generate fallback recommendation based on failure patterns
   * @param {Array} attemptedProviders - Providers already attempted
   * @param {string} errorType - Type of error encountered
   * @param {number} remainingProviders - Number of remaining providers
   * @returns {string} Fallback recommendation
   * @private
   */
  generateFallbackRecommendation(
    attemptedProviders,
    errorType,
    remainingProviders
  ) {
    if (remainingProviders === 0) {
      return 'No more providers available for fallback';
    }

    if (errorType === 'rate_limit') {
      return 'Consider implementing exponential backoff before trying remaining providers';
    }

    if (errorType === 'authentication') {
      return 'Check provider credentials and configuration';
    }

    if (errorType === 'timeout') {
      return 'Try providers with better response time characteristics';
    }

    if (attemptedProviders.length >= 2) {
      return 'Multiple provider failures detected - investigate system-wide issues';
    }

    return `Continue with ${remainingProviders} remaining provider(s)`;
  }

  /**
   * Test fallback scenarios for validation
   * @param {Object} scenarios - Test scenarios configuration
   * @returns {Promise<Object>} Test results
   */
  async testFallbackScenarios(scenarios = {}) {
    const results = {
      totalScenarios: 0,
      passedScenarios: 0,
      failedScenarios: 0,
      scenarios: [],
    };

    // Test scenario 1: Primary provider failure
    try {
      results.totalScenarios++;
      const primaryProvider = Array.from(this.providers.keys())[0];

      // Temporarily disable primary provider
      const originalHealth = this.healthStatus.get(primaryProvider);
      this.healthStatus.set(primaryProvider, {
        ...originalHealth,
        isHealthy: false,
      });

      const selected = await this.selectProvider({ operation: 'test' });

      // Restore original health
      this.healthStatus.set(primaryProvider, originalHealth);

      if (selected.name !== primaryProvider) {
        results.passedScenarios++;
        results.scenarios.push({
          name: 'Primary provider failure fallback',
          status: 'passed',
          selectedProvider: selected.name,
          fallbackUsed: selected.selectionMetadata?.fallbackUsed || false,
        });
      } else {
        results.failedScenarios++;
        results.scenarios.push({
          name: 'Primary provider failure fallback',
          status: 'failed',
          reason: 'Failed to fallback from unhealthy primary provider',
        });
      }
    } catch (error) {
      results.failedScenarios++;
      results.scenarios.push({
        name: 'Primary provider failure fallback',
        status: 'failed',
        reason: error.message,
      });
    }

    // Test scenario 2: All providers unhealthy
    try {
      results.totalScenarios++;

      // Store original health statuses
      const originalHealthStatuses = new Map();
      for (const [name, health] of this.healthStatus) {
        originalHealthStatuses.set(name, { ...health });
        this.healthStatus.set(name, { ...health, isHealthy: false });
      }

      try {
        const selected = await this.selectProvider({ operation: 'test' });

        // Should still select a provider even if unhealthy
        results.passedScenarios++;
        results.scenarios.push({
          name: 'All providers unhealthy fallback',
          status: 'passed',
          selectedProvider: selected.name,
          fallbackUsed: true,
        });
      } catch (error) {
        if (error.message.includes('No providers available')) {
          results.failedScenarios++;
          results.scenarios.push({
            name: 'All providers unhealthy fallback',
            status: 'failed',
            reason: 'No fallback mechanism for all unhealthy providers',
          });
        }
      }

      // Restore original health statuses
      for (const [name, health] of originalHealthStatuses) {
        this.healthStatus.set(name, health);
      }
    } catch (error) {
      results.failedScenarios++;
      results.scenarios.push({
        name: 'All providers unhealthy fallback',
        status: 'failed',
        reason: error.message,
      });
    }

    return results;
  }

  /**
   * Perform health check on provider(s)
   * @param {string} providerName - Specific provider name (optional)
   * @returns {Promise<Object>} Health check results
   */
  async healthCheck(providerName = null) {
    if (providerName) {
      return await this.checkProviderHealth(providerName);
    }

    // Check all providers
    const results = {};
    const promises = Array.from(this.providers.keys()).map(async (name) => {
      try {
        results[name] = await this.checkProviderHealth(name);
      } catch (error) {
        results[name] = {
          isHealthy: false,
          error: error.message,
          timestamp: new Date(),
        };
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Get provider health information
   * @param {string} providerName - Specific provider name (optional)
   * @returns {Object} Provider health information
   */
  getProviderHealth(providerName = null) {
    if (providerName) {
      const health = this.healthStatus.get(providerName);
      const config = this.providerConfigs.get(providerName);
      const metrics = this.metrics.get(providerName);
      const circuitBreaker = this.circuitBreakers.get(providerName);

      if (!health) {
        return {
          status: 'unknown',
          error: 'Provider not found',
          isHealthy: false,
          lastCheck: null,
          consecutiveFailures: 0,
          circuitBreakerState: 'unknown',
          enabled: false,
        };
      }

      return {
        status: health.isHealthy ? 'healthy' : 'unhealthy',
        isHealthy: health.isHealthy,
        lastCheck: health.lastCheck,
        consecutiveFailures: health.consecutiveFailures || 0,
        lastError: health.lastError,
        circuitBreakerState: circuitBreaker
          ? circuitBreaker.getState()
          : 'unknown',
        enabled: config?.enabled || false,
        priority: config?.priority || 0,
        metrics: {
          requests: metrics?.requests || 0,
          successes: metrics?.successes || 0,
          failures: metrics?.failures || 0,
          successRate:
            metrics?.requests > 0 ? metrics.successes / metrics.requests : 0,
          avgResponseTime: metrics?.avgResponseTime || 0,
          lastRequestTime: metrics?.lastRequestTime,
        },
        timestamp: new Date().toISOString(),
      };
    }

    // Return health information for all providers
    const allHealth = {
      timestamp: new Date().toISOString(),
      providers: {},
      summary: {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        enabled: 0,
        disabled: 0,
      },
    };

    for (const name of this.providers.keys()) {
      const providerHealth = this.getProviderHealth(name);
      allHealth.providers[name] = providerHealth;

      allHealth.summary.total++;
      if (providerHealth.isHealthy) {
        allHealth.summary.healthy++;
      } else {
        allHealth.summary.unhealthy++;
      }

      if (providerHealth.enabled) {
        allHealth.summary.enabled++;
      } else {
        allHealth.summary.disabled++;
      }
    }

    return allHealth;
  }

  /**
   * Get provider metrics
   * @param {string} providerName - Specific provider name (optional)
   * @returns {Object} Provider metrics
   */
  getProviderMetrics(providerName = null) {
    if (providerName) {
      const metrics = this.metrics.get(providerName);
      const health = this.healthStatus.get(providerName);
      const config = this.providerConfigs.get(providerName);

      if (!metrics) {
        throw new Error(`Provider not found: ${providerName}`);
      }

      return {
        ...metrics,
        successRate:
          metrics.requests > 0 ? metrics.successes / metrics.requests : 0,
        failureRate:
          metrics.requests > 0 ? metrics.failures / metrics.requests : 0,
        isHealthy: health?.isHealthy || false,
        lastHealthCheck: health?.lastCheck,
        consecutiveFailures: health?.consecutiveFailures || 0,
        enabled: config?.enabled || false,
        priority: config?.priority || 0,
      };
    }

    // Return all provider metrics
    const allMetrics = {};
    for (const name of this.providers.keys()) {
      allMetrics[name] = this.getProviderMetrics(name);
    }
    return allMetrics;
  }

  /**
   * Get available (healthy and enabled) providers
   * @returns {Array} Available providers with scores
   */
  getAvailableProviders() {
    const available = [];

    for (const [name, provider] of this.providers) {
      const config = this.providerConfigs.get(name);
      const health = this.healthStatus.get(name);
      const metrics = this.metrics.get(name);
      const circuitBreaker = this.circuitBreakers.get(name);

      if (
        config?.enabled &&
        health?.isHealthy &&
        circuitBreaker?.canExecute()
      ) {
        const score = this.calculateProviderScore(
          name,
          metrics,
          health,
          config
        );
        available.push({
          name,
          provider,
          config,
          health,
          metrics,
          score,
        });
      }
    }

    return available.sort((a, b) => b.score - a.score);
  }

  /**
   * Get available providers with preference-based enhancements
   * @param {Object} requirements - Selection requirements
   * @returns {Array} Available providers with preference data
   */
  getAvailableProvidersWithPreferences(requirements = {}) {
    const available = [];
    const context = requirements.context || {};
    const userId = requirements.userId;
    const allowUnhealthy = requirements.allowUnhealthy || false;

    for (const [name, provider] of this.providers) {
      const config = this.providerConfigs.get(name);
      const health = this.healthStatus.get(name);
      const metrics = this.metrics.get(name);
      const circuitBreaker = this.circuitBreakers.get(name);

      // Get comprehensive preferences for this provider
      const preferences = this.preferenceManager.getComprehensivePreferences(
        name,
        context,
        userId
      );

      // Skip excluded providers
      if (preferences.isExcluded) {
        continue;
      }

      // Enhanced fallback logic: include providers based on availability criteria
      const isProviderAvailable = this.isProviderAvailableForFallback(
        name,
        config,
        health,
        circuitBreaker,
        allowUnhealthy
      );

      if (isProviderAvailable) {
        const baseScore = this.calculateProviderScore(
          name,
          metrics,
          health,
          config
        );

        // Apply preference-based score adjustments
        const preferenceBonus = preferences.isPreferred ? 25 : 0;
        const priorityScore = preferences.finalPriority;

        // Apply health penalty for unhealthy providers
        const healthPenalty = health?.isHealthy ? 0 : -20;

        const enhancedScore =
          baseScore + preferenceBonus + (priorityScore - 50) + healthPenalty;

        available.push({
          name,
          provider,
          config,
          health,
          metrics,
          preferences,
          score: Math.max(0, enhancedScore),
          baseScore,
          preferenceBonus,
          priorityScore,
          healthPenalty,
          isHealthy: health?.isHealthy || false,
        });
      }
    }

    return available.sort((a, b) => b.score - a.score);
  }

  /**
   * Determine if a provider is available for fallback scenarios
   * @param {string} name - Provider name
   * @param {Object} config - Provider configuration
   * @param {Object} health - Provider health status
   * @param {Object} circuitBreaker - Circuit breaker instance
   * @param {boolean} allowUnhealthy - Whether to allow unhealthy providers
   * @returns {boolean} Whether provider is available
   * @private
   */
  isProviderAvailableForFallback(
    name,
    config,
    health,
    circuitBreaker,
    allowUnhealthy
  ) {
    // Provider must be enabled
    if (!config?.enabled) {
      return false;
    }

    // Circuit breaker must allow execution
    if (!circuitBreaker?.canExecute()) {
      return false;
    }

    // If allowing unhealthy providers (fallback mode), include all enabled providers
    if (allowUnhealthy) {
      return true;
    }

    // Standard mode: only healthy providers
    return health?.isHealthy === true;
  }

  /**
   * Classify error for fallback decision making
   * @param {Error} error - The error to classify
   * @returns {string} Error classification
   * @private
   */
  classifyError(error) {
    if (!error) return 'unknown';

    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';

    // Network and connection errors
    if (message.includes('timeout') || code.includes('timeout')) {
      return 'timeout';
    }
    if (
      message.includes('connection') ||
      code.includes('econnrefused') ||
      code.includes('enotfound')
    ) {
      return 'connection_failed';
    }
    if (
      message.includes('network') ||
      code.includes('enetdown') ||
      code.includes('enetunreach')
    ) {
      return 'network_error';
    }

    // Authentication and authorization errors
    if (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    ) {
      return 'authentication_failed';
    }
    if (message.includes('api key') || message.includes('token')) {
      return 'invalid_credentials';
    }

    // Rate limiting and quota errors
    if (
      message.includes('rate limit') ||
      message.includes('quota') ||
      message.includes('too many requests')
    ) {
      return 'rate_limited';
    }

    // Service and capacity errors
    if (
      message.includes('service unavailable') ||
      message.includes('server error') ||
      code.includes('503')
    ) {
      return 'service_unavailable';
    }
    if (message.includes('capacity') || message.includes('overload')) {
      return 'capacity_exceeded';
    }

    // Model and input errors
    if (message.includes('model') || message.includes('invalid input')) {
      return 'invalid_request';
    }

    // Circuit breaker errors
    if (
      message.includes('circuit breaker') ||
      message.includes('breaker open')
    ) {
      return 'circuit_breaker_open';
    }

    return 'unknown_error';
  }

  /**
   * Get recent failure history for a provider
   * @param {string} providerName - Provider name
   * @returns {Array} Recent failure history
   * @private
   */
  getRecentFailureHistory(providerName) {
    const health = this.healthStatus.get(providerName);
    if (!health || !health.recentFailures) {
      return [];
    }

    // Return failures from the last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return health.recentFailures.filter(
      (failure) => failure.timestamp > fiveMinutesAgo
    );
  }

  /**
   * Get the last used provider
   * @returns {string|null} Last used provider name
   * @private
   */
  getLastUsedProvider() {
    // This could be enhanced to track the actual last used provider
    // For now, return null as a placeholder
    return null;
  }

  /**
   * Calculate provider score for selection
   * @private
   */
  calculateProviderScore(name, metrics, health, config) {
    let score = config.priority * 100; // Base score from priority

    // Success rate bonus (0-50 points)
    const successRate =
      metrics.requests > 0 ? metrics.successes / metrics.requests : 1;
    score += successRate * 50;

    // Response time penalty (faster = higher score)
    if (metrics.avgResponseTime > 0) {
      score -= Math.min(metrics.avgResponseTime / 100, 25); // Max 25 point penalty
    }

    // Health penalty for consecutive failures
    score -= health.consecutiveFailures * 10;

    // Recent activity bonus
    if (
      metrics.lastRequestTime &&
      Date.now() - metrics.lastRequestTime < 300000
    ) {
      // 5 minutes
      score += 10;
    }

    return Math.max(score, 0);
  }

  /**
   * Check individual provider health
   * @private
   */
  async checkProviderHealth(providerName) {
    const provider = this.providers.get(providerName);
    const health = this.healthStatus.get(providerName);

    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const startTime = Date.now();

    try {
      await provider.testConnection();

      // Update health status
      health.isHealthy = true;
      health.lastCheck = new Date();
      health.consecutiveFailures = 0;
      health.lastError = null;

      const responseTime = Date.now() - startTime;

      console.log(
        `Health check passed for ${providerName} (${responseTime}ms)`
      );
      this.emit('healthCheckPassed', { provider: providerName, responseTime });

      return {
        isHealthy: true,
        responseTime,
        timestamp: health.lastCheck,
      };
    } catch (error) {
      // Update health status
      health.isHealthy = false;
      health.lastCheck = new Date();
      health.consecutiveFailures++;
      health.lastError = error.message;

      console.error(`Health check failed for ${providerName}:`, error.message);
      this.emit('healthCheckFailed', {
        provider: providerName,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Update provider metrics
   * @private
   */
  updateProviderMetrics(providerName, success, responseTime, errorType = null) {
    const metrics = this.metrics.get(providerName);
    if (!metrics) return;

    metrics.requests++;
    metrics.lastRequestTime = Date.now();

    if (success) {
      metrics.successes++;
    } else {
      metrics.failures++;
    }

    // Update average response time
    metrics.totalResponseTime += responseTime;
    metrics.avgResponseTime = metrics.totalResponseTime / metrics.requests;

    // Update preference manager with performance data
    this.preferenceManager.updateProviderPerformance(providerName, {
      success,
      responseTime,
      errorType,
    });
  }

  /**
   * Start health monitoring interval
   * @private
   */
  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        console.error('Health monitoring error:', error.message);
      }
    }, this.config.healthCheckInterval);

    console.log(
      `Health monitoring started (interval: ${this.config.healthCheckInterval}ms)`
    );
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('Health monitoring stopped');
    }
  }

  /**
   * Execute operation with timeout
   * @private
   */
  async executeWithTimeout(operation, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Classify error type for better handling
   * @private
   */
  classifyError(error) {
    if (!error || !error.message) {
      return 'unknown';
    }

    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('etimedout')) {
      return 'timeout';
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return 'rate_limit';
    }
    if (
      message.includes('authentication') ||
      message.includes('unauthorized')
    ) {
      return 'authentication';
    }
    if (
      message.includes('connection') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    ) {
      return 'connection';
    }
    if (message.includes('quota') || message.includes('limit exceeded')) {
      return 'quota';
    }
    if (message.includes('bad request') || message.includes('400')) {
      return 'client_error';
    }
    if (message.includes('server error') || message.includes('500')) {
      return 'server_error';
    }

    return 'unknown';
  }

  /**
   * Get enhanced provider fallback list with intelligent ordering
   * @private
   */
  async getEnhancedProviderFallbackList(providers = null, options = {}) {
    let providerList;

    if (providers) {
      // Use provided providers but enhance with fallback info
      providerList = providers.map((name) => ({
        name,
        maxRetries: this.getProviderMaxRetries(name, options),
        priority: this.getProviderPriority(name),
        lastFailureTime: this.getLastFailureTime(name),
      }));
    } else {
      // Get all available providers with enhanced metadata
      const availableProviders = this.getAvailableProviders();
      providerList = availableProviders.map((p) => ({
        name: p.name,
        maxRetries: this.getProviderMaxRetries(p.name, options),
        priority: p.config.priority || 1,
        score: p.score,
        lastFailureTime: this.getLastFailureTime(p.name),
        consecutiveFailures:
          this.healthStatus.get(p.name)?.consecutiveFailures || 0,
      }));
    }

    // Sort providers by priority and recent performance
    return providerList.sort((a, b) => {
      // Primary sort: by priority (higher is better)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Secondary sort: by consecutive failures (fewer is better)
      if (a.consecutiveFailures !== b.consecutiveFailures) {
        return a.consecutiveFailures - b.consecutiveFailures;
      }

      // Tertiary sort: by last failure time (more recent failures go last)
      const aFailureTime = a.lastFailureTime || 0;
      const bFailureTime = b.lastFailureTime || 0;
      return aFailureTime - bFailureTime;
    });
  }

  /**
   * Get provider-specific max retries based on error patterns
   * @private
   */
  getProviderMaxRetries(providerName, options = {}) {
    const config = this.providerConfigs.get(providerName);
    const baseRetries =
      config?.fallback?.retryAttempts || this.config.maxRetryAttempts;

    // Adjust retries based on recent performance
    const recentFailures = this.getRecentFailureCount(providerName, 300000); // 5 minutes
    if (recentFailures >= 5) {
      return Math.max(1, Math.floor(baseRetries / 2)); // Reduce retries for problematic providers
    }

    return baseRetries;
  }

  /**
   * Get provider priority with dynamic adjustments
   * @private
   */
  getProviderPriority(providerName) {
    const config = this.providerConfigs.get(providerName);
    const basePriority = config?.priority || 1;

    // Adjust priority based on recent performance
    const metrics = this.metrics.get(providerName);
    if (metrics) {
      const successRate =
        metrics.requests > 0 ? metrics.successes / metrics.requests : 1;
      const priorityAdjustment = (successRate - 0.5) * 2; // -1 to +1 adjustment
      return Math.max(0.1, basePriority + priorityAdjustment);
    }

    return basePriority;
  }

  /**
   * Enhanced retry logic with provider-specific considerations
   * @private
   */
  shouldRetryWithEnhancedLogic(error, providerName, currentRetries) {
    const errorType = this.classifyError(error);
    const errorSeverity = this.classifyErrorSeverity(error);

    // Never retry critical errors
    if (errorSeverity === 'critical') {
      return false;
    }

    // Check basic retryability
    if (!this.shouldRetry(error)) {
      return false;
    }

    // Provider-specific retry logic
    const config = this.providerConfigs.get(providerName);
    const maxRetries =
      config?.fallback?.retryAttempts || this.config.maxRetryAttempts;

    if (currentRetries >= maxRetries) {
      return false;
    }

    // Error-type specific retry logic
    switch (errorType) {
      case 'rate_limit':
        // For rate limits, only retry if we haven't hit the limit too many times recently
        return this.getRateLimitRetryCount(providerName, 60000) < 3; // Max 3 rate limit retries per minute

      case 'timeout':
        // For timeouts, be more conservative with retries
        return currentRetries < Math.max(1, Math.floor(maxRetries / 2));

      case 'connection':
        // Connection errors are usually worth retrying
        return true;

      case 'server_error':
        // Server errors might be temporary
        return currentRetries < maxRetries;

      default:
        return true;
    }
  }

  /**
   * Calculate enhanced backoff with jitter and error-type considerations
   * @private
   */
  calculateEnhancedBackoff(attempt, errorType, providerName) {
    const config = this.providerConfigs.get(providerName);
    const baseMultiplier =
      config?.fallback?.backoffMultiplier || this.config.backoffMultiplier;

    // Base exponential backoff
    let backoffTime = 1000 * Math.pow(baseMultiplier, attempt - 1);

    // Error-type specific adjustments
    switch (errorType) {
      case 'rate_limit':
        // Longer backoff for rate limits
        backoffTime *= 2;
        break;
      case 'timeout':
        // Shorter backoff for timeouts (might be temporary)
        backoffTime *= 0.5;
        break;
      case 'server_error':
        // Standard backoff for server errors
        break;
      case 'connection':
        // Shorter backoff for connection issues
        backoffTime *= 0.7;
        break;
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 + 0.85; // 85-115% of calculated time
    backoffTime *= jitter;

    // Cap the maximum backoff time
    const maxBackoff = config?.fallback?.maxBackoffTime || 60000; // 1 minute default
    return Math.min(backoffTime, maxBackoff);
  }

  /**
   * Enhanced error severity classification
   * @private
   */
  classifyErrorSeverity(error) {
    if (!error || !error.message) {
      return 'medium';
    }

    const message = error.message.toLowerCase();

    // Critical errors that should cause immediate provider switch
    if (
      message.includes('authentication failed') ||
      message.includes('invalid api key') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('account suspended') ||
      message.includes('quota exceeded permanently')
    ) {
      return 'critical';
    }

    // High severity errors
    if (
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('service unavailable') ||
      message.includes('bad gateway') ||
      message.includes('gateway timeout')
    ) {
      return 'high';
    }

    // Low severity errors (likely temporary)
    if (
      message.includes('timeout') ||
      message.includes('connection reset') ||
      message.includes('connection refused') ||
      message.includes('temporary')
    ) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Check if error is retryable (enhanced version)
   * @private
   */
  shouldRetry(error) {
    const retryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'timeout',
      'rate limit',
      'temporarily unavailable',
      'service unavailable',
      'bad gateway',
      'gateway timeout',
      'connection reset',
      'socket hang up',
      'network error',
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some((retryable) =>
      errorMessage.includes(retryable)
    );
  }

  /**
   * Calculate backoff time (legacy method for compatibility)
   * @private
   */
  calculateBackoff(attempt) {
    return Math.min(
      1000 * Math.pow(this.config.backoffMultiplier, attempt - 1),
      30000
    );
  }

  /**
   * Enhanced timeout execution with provider-specific handling
   * @private
   */
  async executeWithEnhancedTimeout(operation, timeoutMs, providerName) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(
          `Operation timed out after ${timeoutMs}ms for provider ${providerName}`
        );
        error.code = 'TIMEOUT';
        error.provider = providerName;
        reject(error);
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          // Enhance error with provider context
          if (error && typeof error === 'object') {
            error.provider = providerName;
            error.timestamp = Date.now();
          }
          reject(error);
        });
    });
  }

  /**
   * Calculate dynamic timeout based on provider performance
   * @private
   */
  calculateDynamicTimeout(providerName, baseTimeout = 30000) {
    const metrics = this.metrics.get(providerName);
    if (!metrics || metrics.requests === 0) {
      return baseTimeout;
    }

    // Adjust timeout based on average response time
    const avgResponseTime = metrics.avgResponseTime;
    const timeoutMultiplier = Math.max(
      1.5,
      Math.min(3, avgResponseTime / 5000)
    ); // 1.5x to 3x based on avg response

    return Math.min(baseTimeout * timeoutMultiplier, 120000); // Cap at 2 minutes
  }

  /**
   * Context preservation methods
   * @private
   */
  setLastUsedProvider(providerName) {
    this.lastUsedProvider = {
      name: providerName,
      timestamp: Date.now(),
    };
  }

  getLastUsedProvider() {
    return this.lastUsedProvider || null;
  }

  /**
   * Failure history tracking for context preservation
   * @private
   */
  recordFailureHistory(providerName, failureData) {
    if (!this.failureHistory) {
      this.failureHistory = new Map();
    }

    if (!this.failureHistory.has(providerName)) {
      this.failureHistory.set(providerName, []);
    }

    const history = this.failureHistory.get(providerName);
    history.push(failureData);

    // Keep only recent failures (last 100 or last hour)
    const oneHourAgo = Date.now() - 3600000;
    const recentFailures = history
      .filter((f) => f.timestamp > oneHourAgo)
      .slice(-100);

    this.failureHistory.set(providerName, recentFailures);
  }

  getRecentFailureHistory(providerName, timeWindowMs = 300000) {
    if (!this.failureHistory || !this.failureHistory.has(providerName)) {
      return [];
    }

    const cutoff = Date.now() - timeWindowMs;
    return this.failureHistory
      .get(providerName)
      .filter((f) => f.timestamp > cutoff);
  }

  getRecentFailureCount(providerName, timeWindowMs = 300000) {
    return this.getRecentFailureHistory(providerName, timeWindowMs).length;
  }

  getLastFailureTime(providerName) {
    const history = this.getRecentFailureHistory(providerName, 3600000); // 1 hour
    if (history.length === 0) {
      return null;
    }
    return Math.max(...history.map((f) => f.timestamp));
  }

  getRateLimitRetryCount(providerName, timeWindowMs = 60000) {
    const history = this.getRecentFailureHistory(providerName, timeWindowMs);
    return history.filter((f) => f.errorType === 'rate_limit').length;
  }

  /**
   * Generate unique request ID
   * @returns {string} Unique request ID
   * @private
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate comprehensive failure report
   * @private
   */
  generateFailureReport(providerRetryCount, lastError) {
    const totalAttempts = Array.from(providerRetryCount.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    const providerFailures = Array.from(providerRetryCount.entries())
      .map(([provider, attempts]) => `${provider}: ${attempts} attempts`)
      .join(', ');

    const errorType = lastError ? this.classifyError(lastError) : 'unknown';
    const errorSeverity = lastError
      ? this.classifyErrorSeverity(lastError)
      : 'unknown';

    return {
      totalAttempts,
      providerFailures,
      lastErrorType: errorType,
      lastErrorSeverity: errorSeverity,
      summary: `Failed across ${providerRetryCount.size} providers with ${totalAttempts} total attempts. Last error type: ${errorType} (${errorSeverity} severity)`,
    };
  }

  /**
   * Sleep utility
   * @private
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get comprehensive monitoring report
   * @param {Object} options - Report options
   * @returns {Object} Comprehensive monitoring report
   */
  getMonitoringReport(options = {}) {
    const report = {
      timestamp: new Date(),
      basic: {
        providers: this.getProviderMetrics(),
        availableProviders: this.getAvailableProviders().length,
        totalProviders: this.providers.size,
      },
    };

    // Add health monitoring data
    if (this.healthMonitor) {
      try {
        report.health = this.healthMonitor.getHealthReport();
      } catch (error) {
        console.error('Error getting health report:', error.message);
        report.health = { error: error.message };
      }
    }

    // Add metrics data
    if (this.metricsCollector) {
      try {
        report.metrics = this.metricsCollector.getMetricsReport(null, {
          timeRange: options.timeRange || '1h',
          includeRealtime: options.includeRealtime !== false,
          includeBaseline: options.includeBaseline !== false,
        });
      } catch (error) {
        console.error('Error getting metrics report:', error.message);
        report.metrics = { error: error.message };
      }
    }

    // Add alerting data
    if (this.alertingSystem) {
      try {
        report.alerts = this.alertingSystem.getAlertStatistics({
          timeRange: options.timeRange || '24h',
        });
      } catch (error) {
        console.error('Error getting alert statistics:', error.message);
        report.alerts = { error: error.message };
      }
    }

    return report;
  }

  /**
   * Get system health status
   * @returns {Object} System health status
   */
  getSystemHealthStatus() {
    const availableProviders = this.getAvailableProviders();
    const totalProviders = this.providers.size;

    let overallHealth = 'healthy';
    let healthScore = 100;

    if (availableProviders.length === 0) {
      overallHealth = 'critical';
      healthScore = 0;
    } else if (availableProviders.length < totalProviders * 0.5) {
      overallHealth = 'degraded';
      healthScore = 50;
    } else if (availableProviders.length < totalProviders) {
      overallHealth = 'warning';
      healthScore = 75;
    }

    // Calculate average provider health score
    if (this.metricsCollector) {
      try {
        const metricsReport = this.metricsCollector.getMetricsReport();
        const providerHealthScores = Object.values(metricsReport.providers)
          .map((p) => p.aggregated?.healthScore)
          .filter((score) => score != null);

        if (providerHealthScores.length > 0) {
          const avgHealthScore =
            providerHealthScores.reduce((sum, score) => sum + score, 0) /
            providerHealthScores.length;
          healthScore = Math.min(healthScore, avgHealthScore);
        }
      } catch (error) {
        console.error('Error calculating health score:', error.message);
      }
    }

    return {
      status: overallHealth,
      score: Math.round(healthScore),
      availableProviders: availableProviders.length,
      totalProviders,
      timestamp: new Date(),
    };
  }

  /**
   * Circuit breaker management methods
   */

  /**
   * Get circuit breaker status for all providers
   * @returns {Object} Circuit breaker status for all providers
   */
  getCircuitBreakerStatus() {
    const status = {};
    for (const [providerName, circuitBreaker] of this.circuitBreakers) {
      status[providerName] = circuitBreaker.getStatistics();
    }
    return status;
  }

  /**
   * Reset circuit breaker for a specific provider
   * @param {string} providerName - Provider name
   */
  resetCircuitBreaker(providerName) {
    const circuitBreaker = this.circuitBreakers.get(providerName);
    if (circuitBreaker) {
      circuitBreaker.reset();
      console.log(`Circuit breaker reset for provider: ${providerName}`);
      this.emit('circuitBreakerReset', { provider: providerName });
    } else {
      throw new Error(`Provider not found: ${providerName}`);
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers() {
    for (const [providerName, circuitBreaker] of this.circuitBreakers) {
      circuitBreaker.reset();
    }
    console.log('All circuit breakers reset');
    this.emit('allCircuitBreakersReset');
  }

  /**
   * Get fallback statistics
   * @returns {Object} Comprehensive fallback and retry statistics
   */
  getFallbackStatistics() {
    const stats = {
      timestamp: new Date(),
      providers: {},
      overall: {
        totalProviders: this.providers.size,
        availableProviders: this.getAvailableProviders().length,
        circuitBreakersOpen: 0,
        circuitBreakersHalfOpen: 0,
        circuitBreakersClosed: 0,
      },
    };

    // Collect per-provider statistics
    for (const [providerName, circuitBreaker] of this.circuitBreakers) {
      const cbStats = circuitBreaker.getStatistics();
      const metrics = this.metrics.get(providerName);
      const health = this.healthStatus.get(providerName);
      const recentFailures = this.getRecentFailureHistory(providerName, 300000);

      stats.providers[providerName] = {
        circuitBreaker: cbStats,
        metrics: {
          requests: metrics?.requests || 0,
          successes: metrics?.successes || 0,
          failures: metrics?.failures || 0,
          avgResponseTime: metrics?.avgResponseTime || 0,
          successRate:
            metrics?.requests > 0 ? metrics.successes / metrics.requests : 0,
        },
        health: {
          isHealthy: health?.isHealthy || false,
          consecutiveFailures: health?.consecutiveFailures || 0,
          lastCheck: health?.lastCheck,
        },
        recentFailures: {
          count: recentFailures.length,
          byType: this.groupFailuresByType(recentFailures),
        },
      };

      // Update overall stats
      switch (cbStats.state) {
        case 'OPEN':
          stats.overall.circuitBreakersOpen++;
          break;
        case 'HALF_OPEN':
          stats.overall.circuitBreakersHalfOpen++;
          break;
        case 'CLOSED':
          stats.overall.circuitBreakersClosed++;
          break;
      }
    }

    return stats;
  }

  /**
   * Group failures by error type for statistics
   * @private
   */
  groupFailuresByType(failures) {
    const grouped = {};
    for (const failure of failures) {
      const type = failure.errorType || 'unknown';
      grouped[type] = (grouped[type] || 0) + 1;
    }
    return grouped;
  }

  /**
   * Export monitoring data
   * @param {Object} options - Export options
   * @returns {Object} Exported monitoring data
   */
  exportMonitoringData(options = {}) {
    const exportData = {
      timestamp: new Date(),
      format: options.format || 'json',
      timeRange: options.timeRange || '24h',
      data: {},
    };

    // Export basic provider data
    exportData.data.providers = {};
    for (const [name, provider] of this.providers) {
      exportData.data.providers[name] = {
        config: this.providerConfigs.get(name),
        health: this.healthStatus.get(name),
        metrics: this.metrics.get(name),
        circuitBreaker: this.circuitBreakers.get(name)?.getState(),
      };
    }

    // Export metrics data
    if (this.metricsCollector) {
      try {
        exportData.data.metrics = this.metricsCollector.exportMetrics({
          timeRange: options.timeRange,
          providers: options.providers,
        });
      } catch (error) {
        console.error('Error exporting metrics data:', error.message);
        exportData.data.metrics = { error: error.message };
      }
    }

    // Export health data
    if (this.healthMonitor) {
      try {
        exportData.data.health = this.healthMonitor.getHealthReport();
      } catch (error) {
        console.error('Error exporting health data:', error.message);
        exportData.data.health = { error: error.message };
      }
    }

    // Export alert data
    if (this.alertingSystem) {
      try {
        exportData.data.alerts = this.alertingSystem.getAlertStatistics({
          timeRange: options.timeRange,
        });
      } catch (error) {
        console.error('Error exporting alert data:', error.message);
        exportData.data.alerts = { error: error.message };
      }
    }

    return exportData;
  }

  /**
   * Set provider priority
   * @param {string} providerName - Provider name
   * @param {number} priority - Priority value (0-100)
   * @param {Object} options - Priority options
   */
  setProviderPriority(providerName, priority, options = {}) {
    this.preferenceManager.setProviderPriority(providerName, priority, options);
  }

  /**
   * Get provider priority
   * @param {string} providerName - Provider name
   * @returns {number} Provider priority
   */
  getProviderPriority(providerName) {
    return this.preferenceManager.getProviderPriority(providerName);
  }

  /**
   * Set provider preferences
   * @param {string} providerName - Provider name
   * @param {Object} preferences - Provider preferences
   */
  setProviderPreferences(providerName, preferences) {
    this.preferenceManager.setProviderPreferences(providerName, preferences);
  }

  /**
   * Set user preferences
   * @param {string} userId - User identifier
   * @param {Object} preferences - User preferences
   */
  setUserPreferences(userId, preferences) {
    this.preferenceManager.setUserPreferences(userId, preferences);
  }

  /**
   * Add contextual preference rule
   * @param {Object} rule - Contextual rule
   * @returns {string} Rule ID
   */
  addContextualRule(rule) {
    return this.preferenceManager.addContextualRule(rule);
  }

  /**
   * Remove contextual preference rule
   * @param {string} ruleId - Rule identifier
   * @returns {boolean} Success status
   */
  removeContextualRule(ruleId) {
    return this.preferenceManager.removeContextualRule(ruleId);
  }

  /**
   * Set load balancing strategy
   * @param {string} strategy - Strategy name
   * @param {Object} options - Strategy options
   */
  setLoadBalancingStrategy(strategy, options = {}) {
    this.loadBalancer.setStrategy(strategy, options);
  }

  /**
   * Get load balancing statistics
   * @param {Object} options - Query options
   * @returns {Object} Load balancing statistics
   */
  getLoadBalancingStats(options = {}) {
    return this.loadBalancer.getSelectionStats(options);
  }

  /**
   * Get preference statistics
   * @returns {Object} Preference statistics
   */
  getPreferenceStats() {
    return this.preferenceManager.getPreferenceStats();
  }

  /**
   * Export provider preferences
   * @returns {Object} Exportable preferences data
   */
  exportPreferences() {
    return this.preferenceManager.exportPreferences();
  }

  /**
   * Import provider preferences
   * @param {Object} data - Preferences data to import
   */
  importPreferences(data) {
    this.preferenceManager.importPreferences(data);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopHealthMonitoring();
    this.stopEnhancedMonitoring();

    // Cleanup enhanced monitoring components
    if (this.healthMonitor) {
      this.healthMonitor.destroy();
      this.healthMonitor = null;
    }

    if (this.metricsCollector) {
      this.metricsCollector.destroy();
      this.metricsCollector = null;
    }

    if (this.alertingSystem) {
      this.alertingSystem.destroy();
      this.alertingSystem = null;
    }

    // Cleanup enhanced load balancing and preferences
    if (this.loadBalancer) {
      this.loadBalancer.destroy();
      this.loadBalancer = null;
    }

    if (this.preferenceManager) {
      this.preferenceManager.destroy();
      this.preferenceManager = null;
    }

    this.providers.clear();
    this.providerConfigs.clear();
    this.healthStatus.clear();
    this.metrics.clear();
    this.circuitBreakers.clear();
    this.removeAllListeners();
    console.log('ProviderManager destroyed');
  }

  /**
   * Get provider health information
   * @param {string} providerName - Specific provider name (optional)
   * @returns {Object} Health information for provider(s)
   */
  getProviderHealth(providerName = null) {
    try {
      // Check if ProviderManager is properly initialized
      if (
        !this.providers ||
        !this.healthStatus ||
        !this.providerConfigs ||
        !this.metrics
      ) {
        return {
          status: 'error',
          error: 'ProviderManager not properly initialized',
          timestamp: new Date().toISOString(),
        };
      }

      if (providerName) {
        // Return health for specific provider
        const health = this.healthStatus.get(providerName);
        const config = this.providerConfigs.get(providerName);
        const metrics = this.metrics.get(providerName);
        const circuitBreaker = this.circuitBreakers.get(providerName);

        if (!health) {
          return {
            status: 'unknown',
            error: `Provider not found: ${providerName}`,
            timestamp: new Date().toISOString(),
          };
        }

        // Enhanced health data with additional monitoring information
        const healthData = {
          status: health.isHealthy ? 'healthy' : 'unhealthy',
          isHealthy: health.isHealthy,
          lastCheck: health.lastCheck,
          consecutiveFailures: health.consecutiveFailures || 0,
          lastError: health.lastError,
          enabled: config?.enabled || false,
          circuitBreakerState: circuitBreaker?.state || 'unknown',
          metrics: {
            requests: metrics?.requests || 0,
            successes: metrics?.successes || 0,
            failures: metrics?.failures || 0,
            successRate:
              metrics?.requests > 0 ? metrics.successes / metrics.requests : 0,
            failureRate:
              metrics?.requests > 0 ? metrics.failures / metrics.requests : 0,
            avgResponseTime: metrics?.avgResponseTime || 0,
            lastRequestTime: metrics?.lastRequestTime,
            rateLimitHits: metrics?.rateLimitHits || 0,
            circuitBreakerTrips: metrics?.circuitBreakerTrips || 0,
          },
          timestamp: new Date().toISOString(),
        };

        // Add enhanced monitoring data if available
        if (this.healthMonitor) {
          try {
            const enhancedHealth =
              this.healthMonitor.getProviderHealth(providerName);
            if (enhancedHealth) {
              healthData.detailedHealth = enhancedHealth;
            }
          } catch (error) {
            // Enhanced monitoring not available, continue with basic health data
            healthData.monitoringNote = 'Enhanced monitoring unavailable';
          }
        }

        return healthData;
      }

      // Return health for all providers
      const allHealth = {};
      const providerNames = Array.from(this.providers.keys());

      for (const name of providerNames) {
        try {
          allHealth[name] = this.getProviderHealth(name);
        } catch (error) {
          allHealth[name] = {
            status: 'error',
            error: `Failed to get health for ${name}: ${error.message}`,
            timestamp: new Date().toISOString(),
          };
        }
      }

      const healthyCount = Object.values(allHealth).filter(
        (h) => h.isHealthy
      ).length;
      const unhealthyCount = Object.values(allHealth).filter(
        (h) => !h.isHealthy
      ).length;
      const enabledCount = Object.values(allHealth).filter(
        (h) => h.enabled
      ).length;

      return {
        providers: allHealth,
        summary: {
          total: this.providers.size,
          healthy: healthyCount,
          unhealthy: unhealthyCount,
          enabled: enabledCount,
          disabled: this.providers.size - enabledCount,
          overallStatus: healthyCount > 0 ? 'operational' : 'degraded',
        },
        monitoring: {
          healthMonitorEnabled: !!this.healthMonitor,
          metricsCollectorEnabled: !!this.metricsCollector,
          alertingSystemEnabled: !!this.alertingSystem,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Handle any unexpected errors gracefully
      return {
        status: 'error',
        error: `Failed to retrieve provider health: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update provider health status
   * @param {string} providerName - Provider name
   * @param {Object} healthData - Health data to update
   */
  updateProviderHealth(providerName, healthData) {
    try {
      if (!this.healthStatus.has(providerName)) {
        console.warn(
          `Cannot update health for unknown provider: ${providerName}`
        );
        return false;
      }

      const currentHealth = this.healthStatus.get(providerName);
      const updatedHealth = {
        ...currentHealth,
        ...healthData,
        lastCheck: new Date(),
      };

      this.healthStatus.set(providerName, updatedHealth);

      // Emit health update event
      this.emit('healthUpdated', {
        provider: providerName,
        health: updatedHealth,
        timestamp: new Date(),
      });

      return true;
    } catch (error) {
      console.error(
        `Failed to update health for ${providerName}:`,
        error.message
      );
      return false;
    }
  }

  /**
   * Get aggregated health data for monitoring dashboards
   * @returns {Object} Aggregated health information
   */
  getAggregatedHealthData() {
    try {
      const allHealth = this.getProviderHealth();
      const providers = allHealth.providers || {};

      // Calculate aggregated metrics
      let totalRequests = 0;
      let totalSuccesses = 0;
      let totalFailures = 0;
      let totalResponseTime = 0;
      let providerCount = 0;

      Object.values(providers).forEach((provider) => {
        if (provider.metrics) {
          totalRequests += provider.metrics.requests || 0;
          totalSuccesses += provider.metrics.successes || 0;
          totalFailures += provider.metrics.failures || 0;
          totalResponseTime += provider.metrics.avgResponseTime || 0;
          providerCount++;
        }
      });

      return {
        ...allHealth,
        aggregatedMetrics: {
          totalRequests,
          totalSuccesses,
          totalFailures,
          overallSuccessRate:
            totalRequests > 0 ? totalSuccesses / totalRequests : 0,
          overallFailureRate:
            totalRequests > 0 ? totalFailures / totalRequests : 0,
          averageResponseTime:
            providerCount > 0 ? totalResponseTime / providerCount : 0,
        },
        systemHealth: {
          status: allHealth.summary?.healthy > 0 ? 'operational' : 'degraded',
          availableProviders: allHealth.summary?.healthy || 0,
          totalProviders: allHealth.summary?.total || 0,
          enabledProviders: allHealth.summary?.enabled || 0,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: `Failed to get aggregated health data: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if the ProviderManager is properly initialized
   * @returns {boolean} True if initialized, false otherwise
   */
  isInitialized() {
    return !!(
      this.providers &&
      this.healthStatus &&
      this.providerConfigs &&
      this.metrics &&
      this.circuitBreakers
    );
  }

  /**
   * Get health status for monitoring endpoints
   * @returns {Object} Health status suitable for monitoring endpoints
   */
  getHealthStatus() {
    try {
      if (!this.isInitialized()) {
        return {
          status: 'error',
          message: 'ProviderManager not initialized',
          timestamp: new Date().toISOString(),
        };
      }

      const healthData = this.getProviderHealth();
      const summary = healthData.summary || {};

      return {
        status: summary.healthy > 0 ? 'healthy' : 'unhealthy',
        providers: {
          total: summary.total || 0,
          healthy: summary.healthy || 0,
          unhealthy: summary.unhealthy || 0,
          enabled: summary.enabled || 0,
        },
        monitoring: healthData.monitoring || {},
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Health check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Shutdown the provider manager and cleanup resources
   */
  async shutdown() {
    console.log('Shutting down ProviderManager...');

    // Stop health monitoring
    this.stopHealthMonitoring();

    // Cleanup load balancer
    if (this.loadBalancer && this.loadBalancer.destroy) {
      this.loadBalancer.destroy();
    }

    // Cleanup preference manager
    if (this.preferenceManager && this.preferenceManager.destroy) {
      this.preferenceManager.destroy();
    }

    // Shutdown all providers
    for (const [name, provider] of this.providers) {
      if (provider && typeof provider.shutdown === 'function') {
        try {
          await provider.shutdown();
        } catch (error) {
          console.error(`Error shutting down provider ${name}:`, error.message);
        }
      }
    }

    // Clear all maps
    this.providers.clear();
    this.providerConfigs.clear();
    this.healthStatus.clear();
    this.metrics.clear();
    this.circuitBreakers.clear();

    // Remove all listeners
    this.removeAllListeners();

    console.log('ProviderManager shutdown complete');
  }

  /**
   * Generate dream using the best available provider
   * @param {string} prompt - Dream prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated dream
   */
  async generateDream(prompt, options = {}) {
    const providerInfo = await this.selectProvider({
      operation: 'generateDream',
      ...options,
    });

    if (!providerInfo || !providerInfo.provider) {
      throw new Error('No available providers for dream generation');
    }

    return await providerInfo.provider.generateDream(prompt, options);
  }
}

/**
 * Load Balancer for provider selection
 */
class LoadBalancer {
  constructor() {
    this.algorithms = {
      'round-robin': this.roundRobin.bind(this),
      weighted: this.weighted.bind(this),
      'least-connections': this.leastConnections.bind(this),
      'response-time': this.responseTime.bind(this),
    };
    this.roundRobinIndex = 0;
  }

  selectProvider(providers, requirements = {}) {
    const algorithm = requirements.loadBalancing || 'weighted';
    const selector = this.algorithms[algorithm] || this.algorithms.weighted;

    const selectedProvider = selector(providers, requirements);

    // Enhance provider with selection metadata
    if (selectedProvider) {
      selectedProvider.selectionMetadata = {
        algorithm: algorithm,
        strategy: requirements.strategy || 'default',
        timestamp: Date.now(),
        score: selectedProvider.score || 0,
        totalCandidates: providers.length,
        selectionReason: this.getSelectionReason(
          selectedProvider,
          providers,
          algorithm
        ),
        ...selectedProvider.selectionMetadata,
      };
    }

    return selectedProvider;
  }

  getSelectionReason(selected, providers, algorithm) {
    switch (algorithm) {
      case 'weighted':
        return `Selected based on weighted score: ${selected.score || 0}`;
      case 'round-robin':
        return `Selected via round-robin rotation (index: ${
          this.roundRobinIndex - 1
        })`;
      case 'least-connections':
        return `Selected for lowest connection count: ${
          selected.activeConnections || 0
        }`;
      case 'response-time':
        return `Selected for fastest response time: ${
          selected.averageResponseTime || 0
        }ms`;
      default:
        return `Selected via ${algorithm} algorithm`;
    }
  }

  roundRobin(providers, requirements = {}) {
    const currentIndex = this.roundRobinIndex % providers.length;
    const provider = providers[currentIndex];
    this.roundRobinIndex++;

    provider.selectionMetadata = {
      reason: 'Round-robin rotation',
      currentIndex: currentIndex,
      totalProviders: providers.length,
      nextIndex: this.roundRobinIndex % providers.length,
    };

    return provider;
  }

  weighted(providers, requirements = {}) {
    // Sort providers by score for consistent selection
    const sortedProviders = [...providers].sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );

    // Select based on score (higher score = higher probability)
    const totalScore = sortedProviders.reduce(
      (sum, p) => sum + (p.score || 0),
      0
    );

    if (totalScore === 0) {
      // If no scores, select by priority or first available
      const selected = sortedProviders[0];
      selected.selectionMetadata = {
        reason: 'No scores available, selected first provider',
        totalScore: 0,
      };
      return selected;
    }

    let random = Math.random() * totalScore;
    for (const provider of sortedProviders) {
      random -= provider.score || 0;
      if (random <= 0) {
        provider.selectionMetadata = {
          reason: 'Weighted random selection',
          totalScore: totalScore,
          providerScore: provider.score || 0,
          selectionProbability:
            (((provider.score || 0) / totalScore) * 100).toFixed(2) + '%',
        };
        return provider;
      }
    }

    // Fallback to highest scored provider
    const selected = sortedProviders[0];
    selected.selectionMetadata = {
      reason: 'Fallback to highest scored provider',
      totalScore: totalScore,
      providerScore: selected.score || 0,
    };
    return selected;
  }

  leastConnections(providers) {
    return providers.reduce((best, current) =>
      current.metrics.requests < best.metrics.requests ? current : best
    );
  }

  responseTime(providers) {
    return providers.reduce((best, current) =>
      current.metrics.avgResponseTime < best.metrics.avgResponseTime
        ? current
        : best
    );
  }

  /**
   * Generate dream using the best available provider
   * @param {string} prompt - Dream prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated dream
   */
  async generateDream(prompt, options = {}) {
    const provider = await this.selectProvider({
      operation: 'generateDream',
      ...options,
    });

    if (!provider) {
      throw new Error('No available providers for dream generation');
    }

    return await provider.instance.generateDream(prompt, options);
  }
}

/**
 * Enhanced Circuit Breaker for provider fault tolerance
 */
class CircuitBreaker {
  constructor(name, options = {}) {
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
  }

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

      // Require multiple successes to close, but be adaptive
      const requiredSuccesses = this.calculateRequiredSuccesses();
      if (this.successCount >= requiredSuccesses) {
        this.transitionToClosed();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

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
    // Base requirement is 1 success for faster recovery in testing
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
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
      this.halfOpenRequestCount = 0;
      console.log(
        `Circuit breaker opened for ${this.name} (${
          this.consecutiveFailures
        } consecutive failures, ${(this.failureRate * 100).toFixed(
          1
        )}% failure rate)`
      );
    }
  }

  transitionToHalfOpen() {
    if (this.state !== 'HALF_OPEN') {
      this.state = 'HALF_OPEN';
      this.lastStateChange = Date.now();
      this.successCount = 0;
      this.halfOpenRequestCount = 0;
      console.log(
        `Circuit breaker transitioning to half-open for ${this.name}`
      );
    }
  }

  transitionToClosed() {
    if (this.state !== 'CLOSED') {
      this.state = 'CLOSED';
      this.lastStateChange = Date.now();
      this.failures = 0;
      this.consecutiveFailures = 0;
      this.successCount = 0;
      this.halfOpenRequestCount = 0;
      console.log(`Circuit breaker closed for ${this.name} (recovered)`);
    }
  }

  /**
   * Get comprehensive circuit breaker state
   */
  getState() {
    return {
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
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset() {
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
      slidingWindowStats: {
        size: this.slidingWindow.length,
        maxSize: this.windowSize,
        timeWindow: this.windowTimeMs,
        recentFailureRate: this.failureRate,
      },
    };
  }
}

module.exports = ProviderManager;
