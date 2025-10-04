/**
 * Enhanced Response Transformer
 *
 * Ensures AI provider responses are properly transformed to expected format,
 * validates transformed data, and applies content repair if needed.
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('./logger');
const { validationMonitor, EnhancedContentRepair } = require('../../../shared');
const EnumMapper = require('../../../shared/validators/EnumMapper');

const MCPGatewayValidator = require('../validators/MCPGatewayValidator');
const ResponseStructureInspector = require('./ResponseStructureInspector');
const EnhancedContentExtractor = require('./EnhancedContentExtractor');
const ExtractionLogger = require('./ExtractionLogger');

class EnhancedResponseTransformer {
  constructor(options = {}) {
    this.options = {
      enableValidation: options.enableValidation !== false,
      enableRepair: options.enableRepair !== false,
      strictMode: options.strictMode !== false,
      logTransformations: options.logTransformations !== false,
      enableStructureInspection: options.enableStructureInspection !== false,
      ...options,
    };

    // Initialize extraction logger
    this.extractionLogger = new ExtractionLogger({
      enableLogging: this.options.logTransformations,
      logLevel: options.logLevel || 'info',
      maxResponseLength: 500,
    });

    // Initialize MCPGatewayValidator (wraps shared UnifiedValidator)
    this.validator = new MCPGatewayValidator({
      strictMode: this.options.strictMode,
      logErrors: this.options.logTransformations,
    });

    // Initialize content repair
    this.contentRepair = new EnhancedContentRepair({
      enabled: this.options.enableRepair,
      maxAttempts: 3,
    });

    // Initialize response structure inspector
    this.structureInspector = new ResponseStructureInspector({
      maxDepth: 5,
      maxSampleLength: 500,
      logLevel: 'debug',
      enableDetailedLogging: this.options.enableStructureInspection,
    });

    // Initialize enhanced content extractor
    this.contentExtractor = new EnhancedContentExtractor({
      maxDepth: 5,
      enableLogging: this.options.logTransformations,
      logLevel: 'debug',
    });

    // Store reference to extraction metrics collector (will be set externally)
    this.extractionMetricsCollector =
      options.extractionMetricsCollector || null;

    this.metrics = {
      totalTransformations: 0,
      successfulTransformations: 0,
      failedTransformations: 0,
      repairsApplied: 0,
      validationFailures: 0,
    };
  }

  /**
   * Transform AI provider response to expected dream format
   * @param {Object} response - Raw AI provider response
   * @param {string} provider - Provider name (cerebras, openai, etc.)
   * @param {Object} context - Request context (prompt, style, etc.)
   * @returns {Promise<Object>} Transformed and validated response
   */
  async transformResponse(response, provider, context = {}) {
    const startTime = Date.now();
    this.metrics.totalTransformations++;

    // Create request context for logging
    const requestContext = this.extractionLogger.createRequestContext({
      requestId: context.requestId || this.generateRequestId(),
      provider,
      operation: 'transformResponse',
      promptText: context.text ? context.text.substring(0, 100) : undefined,
      style: context.style,
    });

    // Store request context for use in extraction
    this.currentRequestContext = requestContext;

    try {
      // Log transformation start with structured logging
      this.extractionLogger.logTransformationStart(requestContext, response);

      // Inspect response structure before extraction
      if (this.options.enableStructureInspection) {
        const inspection = this.structureInspector.inspectResponse(
          response,
          provider,
          {
            operation: 'transformResponse',
            context: requestContext,
          }
        );
        this.extractionLogger.logStructureInspection(
          requestContext,
          inspection
        );
      }

      // Step 1: Extract dream data from response
      let dreamData = this.extractDreamData(response, provider, requestContext);

      if (!dreamData) {
        // Check if this was an empty response
        if (this.isEmptyResponse(response)) {
          // Return specific error for empty responses
          const emptyResponseError = new Error(
            `Empty response from provider: ${provider}. ` +
              `Provider returned null, undefined, or empty object ({}). ` +
              `Please check provider configuration and API status.`
          );
          emptyResponseError.errorType = 'EMPTY_RESPONSE';
          emptyResponseError.provider = provider;
          emptyResponseError.suggestion =
            'Check provider configuration, API key validity, and service status';
          throw emptyResponseError;
        }

        // Extraction failure already logged by extractDreamData
        throw new Error(
          `Failed to extract dream data from response. Provider: ${provider}, ` +
            `Response type: ${typeof response}`
        );
      }

      // Step 2: Normalize data structure
      dreamData = this.normalizeStructure(dreamData, provider, context);

      // Step 3: Validate transformed data using MCPGatewayValidator
      if (this.options.enableValidation) {
        this.extractionLogger.logValidationStart(requestContext, dreamData);

        const validationResult = this.validator.validateProviderResponse(
          dreamData,
          provider,
          { operation: 'transformResponse', context: requestContext }
        );

        // Log validation result using extraction logger
        this.extractionLogger.logValidationResult(
          requestContext,
          validationResult
        );

        if (!validationResult.valid) {
          this.metrics.validationFailures++;

          // Step 4: Apply content repair if validation failed
          if (this.options.enableRepair) {
            this.extractionLogger.logRepairStart(
              requestContext,
              validationResult.errors
            );

            const repairResult = await this.repairTransformedData(
              dreamData,
              validationResult.errors,
              context,
              provider,
              requestContext
            );

            // Log repair result using extraction logger
            this.extractionLogger.logRepairResult(requestContext, repairResult);

            if (repairResult.success) {
              dreamData = repairResult.content.data || repairResult.content;
              this.metrics.repairsApplied++;
            }
          }
        }
      }

      // Step 5: Final validation using MCPGatewayValidator
      const finalValidation = this.validator.validateProviderResponse(
        dreamData,
        provider,
        { operation: 'finalValidation', context }
      );

      if (!finalValidation.valid && this.options.strictMode) {
        throw new Error(
          `Transformed data still invalid after repair: ${finalValidation.errors.length} errors`
        );
      }

      // Step 6: Validate source enum value
      if (
        dreamData.source &&
        !EnumMapper.isValidEnumValue('source', dreamData.source)
      ) {
        const mappedSource = EnumMapper.mapFallbackToSource(
          dreamData.source,
          provider
        );
        logger.info('Correcting invalid source enum in final dream', {
          original: dreamData.source,
          mapped: mappedSource,
        });
        dreamData.source = mappedSource;
      }

      // Step 7: Add transformation metadata
      const transformedResponse = {
        data: dreamData,
        metadata: {
          provider,
          transformedAt: new Date().toISOString(),
          transformationTime: Date.now() - startTime,
          validationPassed: finalValidation.valid,
          repairApplied: this.metrics.repairsApplied > 0,
          errorCount: finalValidation.errorCount || 0,
          warningCount: finalValidation.warningCount || 0,
        },
      };

      this.metrics.successfulTransformations++;

      // Log transformation success using extraction logger
      this.extractionLogger.logTransformationSuccess(
        requestContext,
        transformedResponse,
        Date.now() - startTime
      );

      return transformedResponse;
    } catch (error) {
      this.metrics.failedTransformations++;

      // Log transformation failure using extraction logger
      this.extractionLogger.logTransformationFailure(
        requestContext,
        error,
        Date.now() - startTime
      );

      // Log extraction metrics for debugging
      const extractionMetrics = this.contentExtractor.getExtractionMetrics();
      this.extractionLogger.logExtractionMetrics(
        requestContext,
        extractionMetrics
      );

      throw error;
    }
  }

  /**
   * Check if response is empty (null, undefined, or empty object)
   * @param {*} response - Response to check
   * @returns {boolean} True if response is empty
   */
  isEmptyResponse(response) {
    // Check for null or undefined
    if (response === null || response === undefined) {
      return true;
    }

    // Check for empty object ({})
    if (
      typeof response === 'object' &&
      !Array.isArray(response) &&
      Object.keys(response).length === 0
    ) {
      return true;
    }

    return false;
  }

  /**
   * Extract dream data from provider response using EnhancedContentExtractor
   * @param {Object} response - Raw provider response
   * @param {string} provider - Provider name
   * @param {Object} requestContext - Request context for logging
   * @returns {Object|null} Extracted dream data
   */
  extractDreamData(response, provider, requestContext) {
    try {
      // Step 0: Check for empty response BEFORE extraction attempts
      if (this.isEmptyResponse(response)) {
        logger.error('Empty response detected from provider', {
          provider,
          requestId: requestContext.requestId,
          responseType: typeof response,
          isNull: response === null,
          isUndefined: response === undefined,
          timestamp: new Date().toISOString(),
        });

        // Log empty response using extraction logger
        this.extractionLogger.logError(
          requestContext,
          'Empty response from provider',
          new Error('EMPTY_RESPONSE')
        );

        // Record empty response in metrics collector
        if (this.extractionMetricsCollector) {
          this.extractionMetricsCollector.recordExtractionFailure(
            provider,
            response,
            [],
            {
              requestId: requestContext.requestId,
              responseType: typeof response,
              errorType: 'EMPTY_RESPONSE',
            }
          );
        }

        return null;
      }

      // Step 1: Inspect and log complete response structure BEFORE extraction
      if (this.options.enableStructureInspection) {
        const inspection = this.structureInspector.inspectResponse(
          response,
          provider,
          { operation: 'extractDreamData', context: requestContext }
        );

        // Log structure inspection using extraction logger
        this.extractionLogger.logStructureInspection(
          requestContext,
          inspection
        );

        // Log nested structure for deeper inspection
        const nestedStructure = this.structureInspector.getNestedStructure(
          response,
          3
        );
        this.extractionLogger.logNestedStructure(
          requestContext,
          nestedStructure
        );

        // Log response sample
        this.extractionLogger.logResponseSample(requestContext, response);
      }

      // Step 2: Use EnhancedContentExtractor to extract dream data
      const dreamData = this.contentExtractor.extractContent(
        response,
        provider,
        requestContext
      );

      // Step 3: If extraction failed, log detailed failure information and record metrics
      if (!dreamData) {
        this.logExtractionFailure(response, provider);

        // Record extraction failure in metrics collector
        if (this.extractionMetricsCollector) {
          const extractionMetrics =
            this.contentExtractor.getExtractionMetrics();
          const attemptedPatterns = extractionMetrics.attemptedPatterns || [];

          this.extractionMetricsCollector.recordExtractionFailure(
            provider,
            response,
            attemptedPatterns,
            {
              requestId: this.currentRequestId,
              responseType: typeof response,
            }
          );
        }

        return null;
      }

      // Step 4: Record successful extraction in metrics collector
      if (this.extractionMetricsCollector) {
        const extractionMetrics = this.contentExtractor.getExtractionMetrics();
        const successfulPattern =
          extractionMetrics.lastSuccessfulPattern || 'unknown';

        this.extractionMetricsCollector.recordExtractionAttempt(
          provider,
          successfulPattern,
          true,
          {
            requestId: requestContext.requestId,
            responseType: typeof response,
          }
        );
      }

      return dreamData;
    } catch (error) {
      this.extractionLogger.logError(
        requestContext,
        'Error extracting dream data',
        error
      );
      return null;
    }
  }

  /**
   * Log comprehensive extraction failure information
   * @param {*} response - Response that failed extraction
   * @param {string} provider - Provider name
   * @param {Object} requestContext - Request context for logging
   */
  logExtractionFailure(response, provider, requestContext) {
    // Get extraction metrics from content extractor
    const extractionMetrics = this.contentExtractor.getExtractionMetrics();

    // Log extraction failure using extraction logger
    this.extractionLogger.logExtractionFailure(
      requestContext,
      response,
      extractionMetrics.attemptedPatterns || []
    );

    // Log extraction metrics
    this.extractionLogger.logExtractionMetrics(
      requestContext,
      extractionMetrics
    );
  }

  /**
   * Normalize data structure to expected format
   * @param {Object} dreamData - Extracted dream data
   * @param {string} provider - Provider name
   * @param {Object} context - Request context
   * @returns {Object} Normalized dream data
   */
  normalizeStructure(dreamData, provider, context) {
    const normalized = { ...dreamData };

    // Ensure required top-level fields exist
    if (!normalized.id) {
      normalized.id = this.generateId();
    }

    if (!normalized.title) {
      normalized.title = context.text
        ? context.text.substring(0, 50)
        : 'Untitled Dream';
    }

    if (!normalized.style) {
      normalized.style = context.style || 'ethereal';
    }

    if (!normalized.source) {
      // Ensure source is a valid enum value
      // If provider is 'mcp-gateway', use it directly; otherwise map it
      normalized.source = EnumMapper.isValidEnumValue('source', provider)
        ? provider
        : 'mcp-gateway';
    } else {
      // Validate existing source and map if needed
      if (!EnumMapper.isValidEnumValue('source', normalized.source)) {
        const mappedSource = EnumMapper.mapFallbackToSource(
          normalized.source,
          provider
        );
        logger.info('Mapped invalid source to valid enum', {
          original: normalized.source,
          mapped: mappedSource,
        });
        normalized.source = mappedSource;
      }
    }

    if (!normalized.created) {
      normalized.created = new Date().toISOString();
    }

    // Ensure arrays exist (even if empty - repair will fill them)
    if (!Array.isArray(normalized.structures)) {
      normalized.structures = [];
    }

    if (!Array.isArray(normalized.entities)) {
      normalized.entities = [];
    }

    // Ensure objects exist
    if (
      !normalized.cinematography ||
      typeof normalized.cinematography !== 'object'
    ) {
      normalized.cinematography = {
        durationSec: 30,
        shots: [],
      };
    }

    if (!normalized.environment || typeof normalized.environment !== 'object') {
      normalized.environment = {};
    }

    if (!normalized.render || typeof normalized.render !== 'object') {
      normalized.render = {};
    }

    // Ensure metadata exists
    if (!normalized.metadata || typeof normalized.metadata !== 'object') {
      normalized.metadata = {};
    }

    // Add context information to metadata
    normalized.metadata = {
      ...normalized.metadata,
      originalText: context.text || normalized.metadata.originalText,
      requestedStyle: context.style || normalized.metadata.requestedStyle,
      source: provider,
      generatedAt: new Date().toISOString(),
    };

    return normalized;
  }

  /**
   * Repair transformed data using content repair system
   * @param {Object} dreamData - Dream data to repair
   * @param {Array} errors - Validation errors
   * @param {Object} context - Request context
   * @param {string} provider - Provider name for metrics
   * @param {Object} requestContext - Request context for logging
   * @returns {Promise<Object>} Repair result
   */
  async repairTransformedData(
    dreamData,
    errors,
    context,
    provider = 'unknown',
    requestContext = {}
  ) {
    try {
      // Wrap dream data in expected format for content repair
      const contentToRepair = {
        data: dreamData,
        metadata: dreamData.metadata || {},
      };

      // Use prompt-aware repair if context is available
      if (context.text && context.style) {
        return await this.contentRepair.repairWithContext(
          contentToRepair,
          context.text,
          context.style,
          {
            errors,
            usePromptContext: true,
            source: 'mcp-gateway',
            provider,
          }
        );
      }

      // Otherwise use standard repair
      return await this.contentRepair.repairContent(contentToRepair, errors, {
        source: 'mcp-gateway',
        provider,
      });
    } catch (error) {
      this.extractionLogger.logError(
        requestContext,
        'Content repair failed during transformation',
        error
      );

      return {
        success: false,
        content: { data: dreamData },
        errors: [error.message],
      };
    }
  }

  /**
   * Generate a unique request ID
   * @returns {string} Request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate a unique ID
   * @returns {string} UUID
   */
  generateId() {
    return uuidv4();
  }

  /**
   * Validate response before sending to Express service
   * @param {Object} response - Response to validate
   * @param {string} provider - Provider name
   * @returns {Object} Validation result
   */
  validateBeforeSending(response, provider = 'unknown') {
    const errors = [];

    // Check response structure
    if (!response || typeof response !== 'object') {
      errors.push({
        field: 'response',
        error: 'INVALID_RESPONSE',
        message: 'Response must be an object',
      });
      return { valid: false, errors };
    }

    // Check data field
    if (!response.data) {
      errors.push({
        field: 'data',
        error: 'MISSING_DATA',
        message: 'Response must contain data field',
      });
    } else {
      // Validate dream data using MCPGatewayValidator
      const dreamValidation = this.validator.validateProviderResponse(
        response.data,
        provider,
        { operation: 'validateBeforeSending' }
      );
      if (!dreamValidation.valid) {
        errors.push(...dreamValidation.errors);
      }
    }

    // Check metadata field
    if (!response.metadata) {
      errors.push({
        field: 'metadata',
        error: 'MISSING_METADATA',
        message: 'Response must contain metadata field',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      errorCount: errors.length,
    };
  }

  /**
   * Get transformation metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.totalTransformations > 0
          ? (this.metrics.successfulTransformations /
              this.metrics.totalTransformations) *
            100
          : 0,
      repairRate:
        this.metrics.successfulTransformations > 0
          ? (this.metrics.repairsApplied /
              this.metrics.successfulTransformations) *
            100
          : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalTransformations: 0,
      successfulTransformations: 0,
      failedTransformations: 0,
      repairsApplied: 0,
      validationFailures: 0,
    };
  }
}

module.exports = EnhancedResponseTransformer;
