// services/mcp-gateway/utils/ResponseProcessingPipeline.js
// Multi-stage response processing pipeline with fallback strategies

const EnhancedResponseParser = require('./EnhancedResponseParser');

/**
 * Robust Response Processing Pipeline
 * Implements multi-stage processing with fallback strategies for AI provider responses
 */
class ResponseProcessingPipeline {
  constructor(options = {}) {
    this.config = {
      enableLogging: options.enableLogging !== false,
      maxProcessingAttempts: options.maxProcessingAttempts || 5,
      enableFallbackStrategies: options.enableFallbackStrategies !== false,
      enableResponseValidation: options.enableResponseValidation !== false,
      enableContentSanitization: options.enableContentSanitization !== false,
      maxContentLength: options.maxContentLength || 100000,
      processingTimeout: options.processingTimeout || 30000,
      ...options,
    };

    // Initialize enhanced response parser
    this.responseParser = new EnhancedResponseParser({
      enableLogging: this.config.enableLogging,
      maxContentLength: this.config.maxContentLength,
      fallbackStrategies: this.config.enableFallbackStrategies,
    });

    // Processing stage registry
    this.processingStages = new Map();
    this.fallbackStrategies = new Map();

    // Initialize default processing stages
    this._initializeDefaultStages();
    this._initializeFallbackStrategies();

    this._log('info', 'ResponseProcessingPipeline initialized', this.config);
  }

  /**
   * Process provider response through multi-stage pipeline
   * @param {any} response - Raw response from provider
   * @param {string} providerName - Name of the provider
   * @param {string} operationType - Type of operation
   * @param {Object} context - Processing context
   * @returns {Promise<Object>} Processed response result
   */
  async processResponse(response, providerName, operationType, context = {}) {
    const startTime = Date.now();
    const processingId = this._generateProcessingId();

    this._log('info', `Starting response processing [${processingId}]`, {
      provider: providerName,
      operationType,
      responseType: typeof response,
    });

    try {
      // Stage 1: Response Normalization
      const normalizedResult = await this._executeStage(
        'normalization',
        response,
        { providerName, operationType, context, processingId }
      );

      if (!normalizedResult.success) {
        return this._handleStageFailure(
          'normalization',
          normalizedResult,
          response,
          { providerName, operationType, context, processingId }
        );
      }

      // Stage 2: Content Extraction
      const extractedResult = await this._executeStage(
        'extraction',
        normalizedResult.data,
        { providerName, operationType, context, processingId }
      );

      if (!extractedResult.success) {
        return this._handleStageFailure(
          'extraction',
          extractedResult,
          response,
          { providerName, operationType, context, processingId }
        );
      }

      // Stage 3: Content Validation
      let validatedResult = { success: true, data: extractedResult.data };
      if (this.config.enableResponseValidation) {
        validatedResult = await this._executeStage(
          'validation',
          extractedResult.data,
          { providerName, operationType, context, processingId }
        );

        if (!validatedResult.success) {
          return this._handleStageFailure(
            'validation',
            validatedResult,
            response,
            { providerName, operationType, context, processingId }
          );
        }
      }

      // Stage 4: Content Sanitization
      let sanitizedResult = { success: true, data: validatedResult.data };
      if (this.config.enableContentSanitization) {
        sanitizedResult = await this._executeStage(
          'sanitization',
          validatedResult.data,
          { providerName, operationType, context, processingId }
        );

        if (!sanitizedResult.success) {
          return this._handleStageFailure(
            'sanitization',
            sanitizedResult,
            response,
            { providerName, operationType, context, processingId }
          );
        }
      }

      const processingTime = Date.now() - startTime;

      const result = {
        success: true,
        content: sanitizedResult.data,
        metadata: {
          processingId,
          provider: providerName,
          operationType,
          processingTime,
          stagesCompleted: [
            'normalization',
            'extraction',
            'validation',
            'sanitization',
          ].filter(
            (stage) =>
              stage === 'normalization' ||
              stage === 'extraction' ||
              (stage === 'validation' &&
                this.config.enableResponseValidation) ||
              (stage === 'sanitization' &&
                this.config.enableContentSanitization)
          ),
          originalResponseType: typeof response,
          contentLength: sanitizedResult.data ? sanitizedResult.data.length : 0,
        },
        error: null,
      };

      this._log('info', `Response processing completed [${processingId}]`, {
        processingTime,
        contentLength: result.metadata.contentLength,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this._log('error', `Response processing failed [${processingId}]`, {
        error: error.message,
        processingTime,
      });

      // Attempt final fallback recovery
      return this._attemptFinalRecovery(response, error, {
        providerName,
        operationType,
        context,
        processingId,
        processingTime,
      });
    }
  }

  /**
   * Register a custom processing stage
   * @param {string} stageName - Name of the stage
   * @param {Function} stageFunction - Processing function
   * @param {Object} options - Stage options
   */
  registerProcessingStage(stageName, stageFunction, options = {}) {
    if (typeof stageFunction !== 'function') {
      throw new Error('Stage function must be a function');
    }

    this.processingStages.set(stageName, {
      function: stageFunction,
      timeout: options.timeout || 10000,
      retryAttempts: options.retryAttempts || 2,
      fallbackEnabled: options.fallbackEnabled !== false,
      ...options,
    });

    this._log('info', `Processing stage registered: ${stageName}`);
  }

  /**
   * Register a custom fallback strategy
   * @param {string} strategyName - Name of the strategy
   * @param {Function} strategyFunction - Fallback function
   * @param {Object} options - Strategy options
   */
  registerFallbackStrategy(strategyName, strategyFunction, options = {}) {
    if (typeof strategyFunction !== 'function') {
      throw new Error('Strategy function must be a function');
    }

    this.fallbackStrategies.set(strategyName, {
      function: strategyFunction,
      priority: options.priority || 50,
      applicableStages: options.applicableStages || ['all'],
      ...options,
    });

    this._log('info', `Fallback strategy registered: ${strategyName}`);
  }

  /**
   * Initialize default processing stages
   * @private
   */
  _initializeDefaultStages() {
    // Normalization Stage
    this.registerProcessingStage('normalization', async (data, context) => {
      const result = this.responseParser.normalizeResponse(
        data,
        context.providerName
      );

      if (!result.success) {
        throw new Error(`Normalization failed: ${result.error}`);
      }

      return {
        success: true,
        data: result.data,
        metadata: {
          format: result.format,
          method: 'enhanced_parser',
        },
      };
    });

    // Content Extraction Stage
    this.registerProcessingStage('extraction', async (data, context) => {
      const result = this.responseParser.extractContent(
        data,
        context.operationType
      );

      if (!result.success) {
        throw new Error(`Content extraction failed: ${result.error}`);
      }

      return {
        success: true,
        data: result.content,
        metadata: {
          method: result.method,
          extractionStrategy: 'multi_attempt',
        },
      };
    });

    // Content Validation Stage
    this.registerProcessingStage('validation', async (data, context) => {
      const result = this.responseParser.validateContent(
        data,
        context.operationType
      );

      if (!result.success) {
        throw new Error(`Content validation failed: ${result.error}`);
      }

      return {
        success: true,
        data: result.content,
        metadata: {
          validationPassed: true,
          warnings: result.warning ? [result.warning] : [],
        },
      };
    });

    // Content Sanitization Stage
    this.registerProcessingStage('sanitization', async (data, context) => {
      try {
        const sanitized = this._sanitizeContent(data, context);
        return {
          success: true,
          data: sanitized,
          metadata: {
            sanitized: true,
            originalLength: data ? data.length : 0,
            finalLength: sanitized ? sanitized.length : 0,
          },
        };
      } catch (error) {
        throw new Error(`Content sanitization failed: ${error.message}`);
      }
    });
  }

  /**
   * Initialize default fallback strategies
   * @private
   */
  _initializeFallbackStrategies() {
    // Raw Content Extraction Strategy
    this.registerFallbackStrategy(
      'raw_extraction',
      async (originalResponse, error, context) => {
        try {
          if (typeof originalResponse === 'string') {
            return {
              success: true,
              content: originalResponse.trim(),
              method: 'raw_string',
            };
          }

          // Try to extract any string content from object
          const stringContent = this._extractAnyStringContent(originalResponse);
          if (stringContent) {
            return {
              success: true,
              content: stringContent,
              method: 'raw_object_extraction',
            };
          }

          return { success: false, error: 'No string content found' };
        } catch (fallbackError) {
          return { success: false, error: fallbackError.message };
        }
      },
      { priority: 10, applicableStages: ['normalization', 'extraction'] }
    );

    // JSON Recovery Strategy
    this.registerFallbackStrategy(
      'json_recovery',
      async (originalResponse, error, context) => {
        try {
          const content =
            typeof originalResponse === 'string'
              ? originalResponse
              : JSON.stringify(originalResponse);

          // Try to extract and fix JSON
          const jsonBlock = this._extractJsonBlock(content);
          if (jsonBlock) {
            const cleaned = this._cleanJsonString(jsonBlock);
            if (cleaned) {
              // Validate JSON
              JSON.parse(cleaned);
              return {
                success: true,
                content: cleaned,
                method: 'json_recovery',
              };
            }
          }

          return { success: false, error: 'JSON recovery failed' };
        } catch (fallbackError) {
          return { success: false, error: fallbackError.message };
        }
      },
      { priority: 20, applicableStages: ['extraction', 'validation'] }
    );

    // Partial Content Strategy
    this.registerFallbackStrategy(
      'partial_content',
      async (originalResponse, error, context) => {
        try {
          // Accept partial or malformed content if it has some useful data
          const content =
            typeof originalResponse === 'string'
              ? originalResponse
              : this._extractAnyStringContent(originalResponse);

          if (content && content.trim().length > 10) {
            return {
              success: true,
              content: content.trim(),
              method: 'partial_content',
              warning: 'Content may be incomplete or malformed',
            };
          }

          return {
            success: false,
            error: 'Insufficient content for partial recovery',
          };
        } catch (fallbackError) {
          return { success: false, error: fallbackError.message };
        }
      },
      { priority: 5, applicableStages: ['all'] }
    );
  }

  /**
   * Execute a processing stage with timeout and retry logic
   * @private
   */
  async _executeStage(stageName, data, context) {
    const stage = this.processingStages.get(stageName);
    if (!stage) {
      throw new Error(`Unknown processing stage: ${stageName}`);
    }

    let lastError = null;
    const maxAttempts = stage.retryAttempts + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this._log(
          'debug',
          `Executing stage: ${stageName} (attempt ${attempt}/${maxAttempts})`
        );

        const result = await this._executeWithTimeout(
          () => stage.function(data, context),
          stage.timeout
        );

        this._log('debug', `Stage completed: ${stageName}`);
        return result;
      } catch (error) {
        lastError = error;
        this._log(
          'warn',
          `Stage failed: ${stageName} (attempt ${attempt}/${maxAttempts})`,
          {
            error: error.message,
          }
        );

        if (attempt < maxAttempts) {
          // Wait before retry
          await this._sleep(Math.pow(2, attempt - 1) * 1000);
        }
      }
    }

    return {
      success: false,
      error: `Stage ${stageName} failed after ${maxAttempts} attempts: ${lastError.message}`,
      stage: stageName,
      attempts: maxAttempts,
    };
  }

  /**
   * Handle stage failure with fallback strategies
   * @private
   */
  async _handleStageFailure(stageName, stageResult, originalResponse, context) {
    this._log('warn', `Handling stage failure: ${stageName}`, {
      error: stageResult.error,
    });

    if (!this.config.enableFallbackStrategies) {
      return {
        success: false,
        content: null,
        error: stageResult.error,
        metadata: {
          ...context,
          failedStage: stageName,
          fallbackAttempted: false,
        },
      };
    }

    // Get applicable fallback strategies for this stage
    const applicableStrategies = Array.from(this.fallbackStrategies.entries())
      .filter(
        ([name, strategy]) =>
          strategy.applicableStages.includes('all') ||
          strategy.applicableStages.includes(stageName)
      )
      .sort(([, a], [, b]) => b.priority - a.priority);

    // Try fallback strategies in priority order
    for (const [strategyName, strategy] of applicableStrategies) {
      try {
        this._log('debug', `Attempting fallback strategy: ${strategyName}`);

        const fallbackResult = await strategy.function(
          originalResponse,
          new Error(stageResult.error),
          context
        );

        if (fallbackResult.success) {
          this._log('info', `Fallback strategy succeeded: ${strategyName}`);

          return {
            success: true,
            content: fallbackResult.content,
            metadata: {
              ...context,
              failedStage: stageName,
              fallbackStrategy: strategyName,
              fallbackMethod: fallbackResult.method,
              warning: fallbackResult.warning,
            },
            error: null,
          };
        }
      } catch (fallbackError) {
        this._log('debug', `Fallback strategy failed: ${strategyName}`, {
          error: fallbackError.message,
        });
      }
    }

    // All fallback strategies failed
    return {
      success: false,
      content: null,
      error: `Stage ${stageName} failed and all fallback strategies exhausted: ${stageResult.error}`,
      metadata: {
        ...context,
        failedStage: stageName,
        fallbackAttempted: true,
        fallbackStrategiesAttempted: applicableStrategies.length,
      },
    };
  }

  /**
   * Attempt final recovery when all stages fail
   * @private
   */
  async _attemptFinalRecovery(originalResponse, error, context) {
    this._log('warn', 'Attempting final recovery', { error: error.message });

    try {
      // Use enhanced response parser's recovery mechanism
      const recoveryResult = this.responseParser.attemptContentRecovery(
        originalResponse,
        error
      );

      if (recoveryResult.success) {
        return {
          success: true,
          content: recoveryResult.content,
          metadata: {
            ...context,
            recoveryMethod: recoveryResult.method,
            warning:
              recoveryResult.warning ||
              'Content recovered through final recovery',
          },
          error: null,
        };
      }
    } catch (recoveryError) {
      this._log('error', 'Final recovery failed', {
        error: recoveryError.message,
      });
    }

    // Complete failure
    return {
      success: false,
      content: null,
      error: `Complete processing failure: ${error.message}`,
      metadata: {
        ...context,
        provider: context.providerName,
        operationType: context.operationType,
      },
    };
  }

  /**
   * Sanitize content for security and consistency
   * @private
   */
  _sanitizeContent(content, context) {
    if (!content || typeof content !== 'string') {
      return content;
    }

    let sanitized = content;

    // Remove potential security risks
    sanitized = sanitized.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ''
    );
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\r\n/g, '\n');
    sanitized = sanitized.replace(/\r/g, '\n');
    sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

    // Trim excessive whitespace
    sanitized = sanitized.trim();

    // Truncate if too long
    if (sanitized.length > this.config.maxContentLength) {
      sanitized = sanitized.substring(0, this.config.maxContentLength);
      this._log('warn', 'Content truncated during sanitization', {
        originalLength: content.length,
        truncatedLength: sanitized.length,
      });
    }

    return sanitized;
  }

  /**
   * Extract any string content from an object
   * @private
   */
  _extractAnyStringContent(obj, maxDepth = 3) {
    if (maxDepth <= 0) return null;

    if (typeof obj === 'string') {
      return obj.trim().length > 0 ? obj.trim() : null;
    }

    if (!obj || typeof obj !== 'object') {
      return null;
    }

    // Try common content fields first
    const contentFields = [
      'content',
      'text',
      'output',
      'result',
      'data',
      'message',
      'response',
    ];

    for (const field of contentFields) {
      if (obj[field] && typeof obj[field] === 'string') {
        const content = obj[field].trim();
        if (content.length > 0) return content;
      }
    }

    // Recursively search for string content
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const content = value.trim();
        if (content.length > 0) return content;
      } else if (typeof value === 'object' && value !== null) {
        const nestedContent = this._extractAnyStringContent(
          value,
          maxDepth - 1
        );
        if (nestedContent) return nestedContent;
      }
    }

    return null;
  }

  /**
   * Extract JSON block from text
   * @private
   */
  _extractJsonBlock(text) {
    if (!text || typeof text !== 'string') return null;

    const firstBrace = text.indexOf('{');
    if (firstBrace === -1) return null;

    let depth = 0;
    let start = -1;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (start === -1) start = i;
        depth++;
      } else if (text[i] === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          return text.slice(start, i + 1);
        }
      }
    }

    return null;
  }

  /**
   * Clean JSON string by removing common issues
   * @private
   */
  _cleanJsonString(jsonStr) {
    if (!jsonStr || typeof jsonStr !== 'string') return null;

    try {
      // Remove trailing commas
      let cleaned = jsonStr.replace(/,\s*([}\]])/g, '$1');

      // Fix common quote issues
      cleaned = cleaned.replace(/'/g, '"');

      // Remove comments
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
      cleaned = cleaned.replace(/\/\/.*$/gm, '');

      return cleaned;
    } catch (error) {
      return null;
    }
  }

  /**
   * Execute function with timeout
   * @private
   */
  async _executeWithTimeout(fn, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(fn())
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
   * Sleep for specified milliseconds
   * @private
   */
  async _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate unique processing ID
   * @private
   */
  _generateProcessingId() {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log messages if logging is enabled
   * @private
   */
  _log(level, message, data = null) {
    if (!this.config.enableLogging) return;

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [ResponseProcessingPipeline] [${level.toUpperCase()}] ${message}`;

    if (data) {
      console[level](logMessage, data);
    } else {
      console[level](logMessage);
    }
  }

  /**
   * Get pipeline statistics
   * @returns {Object} Pipeline statistics
   */
  getStatistics() {
    return {
      registeredStages: Array.from(this.processingStages.keys()),
      registeredFallbackStrategies: Array.from(this.fallbackStrategies.keys()),
      configuration: this.config,
    };
  }

  /**
   * Reset pipeline state
   */
  reset() {
    this.processingStages.clear();
    this.fallbackStrategies.clear();
    this._initializeDefaultStages();
    this._initializeFallbackStrategies();
    this._log('info', 'Pipeline reset completed');
  }
}

module.exports = ResponseProcessingPipeline;
