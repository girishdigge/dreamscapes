// services/express/utils/responseProcessor.js
const { logger } = require('./logger');
const { validateDream } = require('../middleware/validation');
const { createFallbackDream } = require('./fallbackGenerator');
const { utils } = require('@dreamscapes/shared');
const ProcessingPipeline = require('./processingPipeline');
const PipelineErrorRecovery = require('./pipelineErrorRecovery');

/**
 * Enhanced MCP Gateway response processor
 * Handles parsing, validation, and logging of MCP Gateway responses
 */
class MCPResponseProcessor {
  constructor() {
    this.validationCache = new Map();
    this.pipeline = this.initializePipeline();
  }

  /**
   * Initialize the processing pipeline with validation checkpoints
   */
  initializePipeline() {
    const pipeline = new ProcessingPipeline({ strictMode: false });

    // Stage 1: Text Extraction
    pipeline.addStage({
      name: 'text_extraction',
      process: async (response, context) => {
        return await this.extractResponseText(response, context.requestId);
      },
      onError: async (error, previousData, context) => {
        logger.error('Text extraction failed, cannot recover', {
          requestId: context.requestId,
          error: error.message,
        });
        throw error;
      },
    });

    // Stage 2: JSON Parsing
    pipeline.addStage({
      name: 'json_parsing',
      process: async (responseText, context) => {
        return this.parseJsonResponse(responseText, context.requestId);
      },
      onError: async (error, previousData, context) => {
        PipelineErrorRecovery.logRecoveryAttempt(
          'json_parsing',
          error,
          context
        );
        return await PipelineErrorRecovery.recoverFromJsonParsing(
          error,
          previousData,
          context
        );
      },
    });

    // Stage 3: Response Structure Validation
    pipeline.addStage({
      name: 'structure_validation',
      process: async (parsedResponse, context) => {
        return this.validateResponseStructure(
          parsedResponse,
          context.requestId
        );
      },
      onError: async (error, previousData, context) => {
        PipelineErrorRecovery.logRecoveryAttempt(
          'structure_validation',
          error,
          context
        );
        return await PipelineErrorRecovery.recoverFromStructureValidation(
          error,
          previousData,
          context
        );
      },
    });

    // Stage 4: Dream Data Extraction
    pipeline.addStage({
      name: 'dream_extraction',
      process: async (validatedResponse, context) => {
        const result = this.extractDreamData(
          validatedResponse,
          context.requestId,
          context.originalText
        );
        // Store dataSource in context for later use
        context.dataSource = result.dataSource;
        // Return just the dreamData for the next stage
        return result.dreamData;
      },
      onError: async (error, previousData, context) => {
        PipelineErrorRecovery.logRecoveryAttempt(
          'dream_extraction',
          error,
          context
        );
        return await PipelineErrorRecovery.recoverFromDreamExtraction(
          error,
          previousData,
          context
        );
      },
    });

    // Stage 5: Dream Schema Validation
    pipeline.addStage({
      name: 'schema_validation',
      process: async (dreamData, context) => {
        // Reconstruct the result object with dataSource from context
        const dreamDataResult = {
          dreamData: dreamData,
          dataSource: context.dataSource || 'unknown',
        };
        return this.validateDreamSchema(dreamDataResult, context.requestId);
      },
      onError: async (error, previousData, context) => {
        PipelineErrorRecovery.logRecoveryAttempt(
          'schema_validation',
          error,
          context
        );
        return await PipelineErrorRecovery.recoverFromSchemaValidation(
          error,
          previousData,
          context
        );
      },
    });

    return pipeline;
  }

  /**
   * Process MCP Gateway response with comprehensive validation and logging
   * @param {Response} response - Fetch response object
   * @param {string} requestId - Unique request identifier
   * @param {number} responseTime - Response time in milliseconds
   * @param {string} originalText - Original dream text for context
   * @returns {Object} Processed response with dreamJson and metadata
   */
  async processResponse(response, requestId, responseTime, originalText) {
    logger.info('Starting MCP Gateway response processing with pipeline', {
      requestId,
      status: response.status,
      statusText: response.statusText,
      responseTime: `${responseTime}ms`,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      pipelineStages: this.pipeline.stages.length,
    });

    try {
      // Process through the validation pipeline
      const pipelineResult = await this.pipeline.process(response, {
        requestId,
        originalText,
        responseTime,
      });

      if (!pipelineResult.success) {
        throw new Error(`Pipeline processing failed: ${pipelineResult.error}`);
      }

      const validatedDream = pipelineResult.data;

      // Create final response object with pipeline metadata
      const finalResponse = this.createProcessedResponse(
        validatedDream,
        { metadata: {} }, // Original response metadata
        requestId,
        responseTime
      );

      // Add pipeline information to response
      finalResponse.pipeline = {
        stagesCompleted: pipelineResult.stageResults.length,
        validationCheckpoints: pipelineResult.validationResults.length,
        totalProcessingTime: pipelineResult.processingTime,
        stageResults: pipelineResult.stageResults,
      };

      logger.info('Pipeline processing completed successfully', {
        requestId,
        totalTime: `${pipelineResult.processingTime}ms`,
        stagesCompleted: pipelineResult.stageResults.length,
        validationsPassed: pipelineResult.validationResults.filter(
          (v) => v.valid
        ).length,
      });

      return finalResponse;
    } catch (error) {
      logger.error('Pipeline processing failed', {
        requestId,
        error: error.message,
        stack: error.stack,
      });

      // Fall back to legacy processing if pipeline fails
      logger.warn('Falling back to legacy processing', { requestId });
      return await this.processResponseLegacy(
        response,
        requestId,
        responseTime,
        originalText
      );
    }
  }

  /**
   * Legacy processing method (fallback)
   */
  async processResponseLegacy(response, requestId, responseTime, originalText) {
    logger.info('Using legacy response processing', { requestId });

    // Step 1: Extract response text
    const responseText = await this.extractResponseText(response, requestId);

    // Step 2: Parse JSON response
    const parsedResponse = this.parseJsonResponse(responseText, requestId);

    // Step 3: Validate response structure
    const validatedResponse = this.validateResponseStructure(
      parsedResponse,
      requestId
    );

    // Step 4: Extract and validate dream data
    const dreamData = this.extractDreamData(
      validatedResponse,
      requestId,
      originalText
    );

    // Step 5: Validate dream schema
    const validatedDream = this.validateDreamSchema(dreamData, requestId);

    // Step 6: Create final response object
    return this.createProcessedResponse(
      validatedDream,
      validatedResponse,
      requestId,
      responseTime
    );
  }

  /**
   * Extract response text with error handling
   */
  async extractResponseText(response, requestId) {
    try {
      const responseText = await response.text();

      logger.info('MCP Gateway response text extracted', {
        requestId,
        responseLength: responseText.length,
        responsePreview: this.createResponsePreview(responseText),
        isEmpty: responseText.length === 0,
      });

      if (responseText.length === 0) {
        throw new Error('MCP Gateway returned empty response body');
      }

      return responseText;
    } catch (error) {
      logger.error('Failed to extract MCP Gateway response text', {
        requestId,
        error: error.message,
        errorType: error.constructor.name,
      });
      throw new Error(`Failed to read response body: ${error.message}`);
    }
  }

  /**
   * Parse JSON response with detailed error handling
   */
  parseJsonResponse(responseText, requestId) {
    try {
      const parsed = JSON.parse(responseText);

      logger.info('MCP Gateway JSON response parsed successfully', {
        requestId,
        responseType: typeof parsed,
        isObject: typeof parsed === 'object' && parsed !== null,
        hasSuccess: 'success' in parsed,
        hasData: 'data' in parsed,
        hasFallback: 'fallback' in parsed,
        hasError: 'error' in parsed,
        hasMetadata: 'metadata' in parsed,
        topLevelKeys: Object.keys(parsed || {}),
      });

      return parsed;
    } catch (parseError) {
      logger.error('Failed to parse MCP Gateway JSON response', {
        requestId,
        parseError: parseError.message,
        responseTextPreview: this.createResponsePreview(responseText),
        responseLength: responseText.length,
        parseErrorPosition: parseError.message.match(/position (\d+)/)?.[1],
      });

      // Try to identify common JSON issues
      const jsonIssues = this.identifyJsonIssues(responseText);
      if (jsonIssues.length > 0) {
        logger.warn('Identified potential JSON issues', {
          requestId,
          issues: jsonIssues,
        });
      }

      throw new Error(
        `Invalid JSON response from MCP Gateway: ${parseError.message}`
      );
    }
  }

  /**
   * Validate MCP Gateway response structure
   */
  validateResponseStructure(parsedResponse, requestId) {
    logger.info('Validating MCP Gateway response structure', {
      requestId,
      responseType: typeof parsedResponse,
      isNull: parsedResponse === null,
      isArray: Array.isArray(parsedResponse),
    });

    // Check if response is an object
    if (typeof parsedResponse !== 'object' || parsedResponse === null) {
      logger.error('MCP Gateway response is not a valid object', {
        requestId,
        responseType: typeof parsedResponse,
        response: parsedResponse,
      });
      throw new Error(
        'MCP Gateway returned invalid response structure - expected object'
      );
    }

    // Check for required response fields
    const requiredFields = ['success'];
    const missingFields = requiredFields.filter(
      (field) => !(field in parsedResponse)
    );

    if (missingFields.length > 0) {
      logger.error('MCP Gateway response missing required fields', {
        requestId,
        missingFields,
        availableFields: Object.keys(parsedResponse),
        response: parsedResponse,
      });
      throw new Error(
        `MCP Gateway response missing required fields: ${missingFields.join(
          ', '
        )}`
      );
    }

    // Validate success field
    if (typeof parsedResponse.success !== 'boolean') {
      logger.error('MCP Gateway response success field is not boolean', {
        requestId,
        successType: typeof parsedResponse.success,
        successValue: parsedResponse.success,
      });
      throw new Error('MCP Gateway response success field must be boolean');
    }

    // Log response structure analysis
    logger.info('MCP Gateway response structure validated', {
      requestId,
      success: parsedResponse.success,
      hasData: !!parsedResponse.data,
      hasFallback: !!parsedResponse.fallback,
      hasError: !!parsedResponse.error,
      hasMetadata: !!parsedResponse.metadata,
      errorMessage: parsedResponse.error,
      metadataKeys: parsedResponse.metadata
        ? Object.keys(parsedResponse.metadata)
        : [],
    });

    return parsedResponse;
  }

  /**
   * Extract dream data from validated response
   */
  extractDreamData(validatedResponse, requestId, originalText) {
    logger.info('Extracting dream data from MCP Gateway response', {
      requestId,
      success: validatedResponse.success,
      hasData: !!validatedResponse.data,
      hasFallback: !!validatedResponse.fallback,
      hasError: !!validatedResponse.error,
    });

    // Handle unsuccessful responses
    if (!validatedResponse.success) {
      const errorMessage =
        validatedResponse.error || 'Unknown error from MCP Gateway';
      logger.error('MCP Gateway reported unsuccessful response', {
        requestId,
        error: errorMessage,
        hasData: !!validatedResponse.data,
        hasFallback: !!validatedResponse.fallback,
      });
      throw new Error(`MCP Gateway reported failure: ${errorMessage}`);
    }

    // Extract dream data (prefer data over fallback)
    let dreamData = null;
    let dataSource = 'unknown';

    if (validatedResponse.data) {
      dreamData = validatedResponse.data;
      dataSource = 'ai';
      logger.info('Using primary AI-generated dream data', {
        requestId,
        dataSource,
        dreamId: dreamData.id,
        dreamTitle: dreamData.title,
      });
    } else if (validatedResponse.fallback) {
      dreamData = validatedResponse.fallback;
      dataSource = 'ai_fallback';
      logger.info('Using fallback AI-generated dream data', {
        requestId,
        dataSource,
        dreamId: dreamData.id,
        dreamTitle: dreamData.title,
      });
    } else {
      logger.error('MCP Gateway response contains no dream data', {
        requestId,
        success: validatedResponse.success,
        availableFields: Object.keys(validatedResponse),
        response: validatedResponse,
      });
      throw new Error(
        'MCP Gateway response contains no dream data (no data or fallback field)'
      );
    }

    // Validate dream data is an object
    if (typeof dreamData !== 'object' || dreamData === null) {
      logger.error('Dream data is not a valid object', {
        requestId,
        dataSource,
        dreamDataType: typeof dreamData,
        dreamData,
      });
      throw new Error(
        `Dream data is not a valid object - got ${typeof dreamData}`
      );
    }

    // Ensure required fields are present - add them if missing
    dreamData = this.ensureRequiredFields(dreamData, originalText, requestId);

    // Clean up: Remove empty 'data' field if it exists (artifact from response wrapping)
    if (
      dreamData.data &&
      typeof dreamData.data === 'object' &&
      Object.keys(dreamData.data).length === 0
    ) {
      delete dreamData.data;
      logger.debug('Removed empty data field from dream object', { requestId });
    }

    // Log dream data structure
    logger.info('Dream data extracted successfully', {
      requestId,
      dataSource,
      dreamId: dreamData.id,
      dreamTitle: dreamData.title,
      dreamStyle: dreamData.style,
      hasStructures: Array.isArray(dreamData.structures),
      structureCount: dreamData.structures?.length || 0,
      hasEntities: Array.isArray(dreamData.entities),
      entityCount: dreamData.entities?.length || 0,
      hasCinematography: !!dreamData.cinematography,
      shotCount: dreamData.cinematography?.shots?.length || 0,
      hasEnvironment: !!dreamData.environment,
      environmentPreset: dreamData.environment?.preset,
    });

    return { dreamData, dataSource };
  }

  /**
   * Validate dream data against schema
   */
  validateDreamSchema(dreamDataResult, requestId) {
    const { dreamData, dataSource } = dreamDataResult;

    logger.info('Starting dream schema validation', {
      requestId,
      dataSource,
      dreamId: dreamData.id,
      validationCacheSize: this.validationCache.size,
    });

    // Create cache key for validation results
    const cacheKey = this.createValidationCacheKey(dreamData);

    // Check validation cache
    if (this.validationCache.has(cacheKey)) {
      const cachedResult = this.validationCache.get(cacheKey);
      logger.info('Using cached validation result', {
        requestId,
        cacheKey: cacheKey.substring(0, 16) + '...',
        cachedValid: cachedResult.valid,
        cachedErrorCount: cachedResult.errors?.length || 0,
      });
      return { ...dreamDataResult, validation: cachedResult };
    }

    // Perform validation
    logger.debug('Dream data before schema validation', {
      requestId,
      dreamData: JSON.stringify(dreamData, null, 2),
      hasRequiredFields: {
        id: !!dreamData.id,
        title: !!dreamData.title,
        style: !!dreamData.style,
      },
    });

    console.log(
      'dream data before schema validation in express/utils/responseProccessor',
      dreamData
    );

    const validation = validateDream(dreamData);

    logger.debug('Dream validation result', {
      requestId,
      valid: validation.valid,
      errorCount: validation.errors?.length || 0,
      errors: validation.errors,
      details: validation.details,
    });

    console.log(
      'post validation in express/utils/responseProccessor',
      validation
    );
    // Cache validation result
    this.validationCache.set(cacheKey, validation);

    // Clean cache if it gets too large
    if (this.validationCache.size > 100) {
      const firstKey = this.validationCache.keys().next().value;
      this.validationCache.delete(firstKey);
    }

    // Log validation results
    if (validation.valid) {
      logger.info('Dream schema validation passed', {
        requestId,
        dataSource,
        dreamId: dreamData.id,
        validationCached: false,
      });
    } else {
      logger.warn('Dream schema validation failed', {
        requestId,
        dataSource,
        dreamId: dreamData.id,
        errorCount: validation.errors?.length || 0,
        errors: validation.errors?.slice(0, 5), // Log first 5 errors
        validationType: validation.type || 'schema',
        validationDetails: validation.details
          ? validation.details.slice(0, 3)
          : undefined,
      });

      // Log detailed validation errors for debugging
      if (validation.errors && validation.errors.length > 0) {
        validation.errors.forEach((error, index) => {
          logger.debug('Dream validation error detail', {
            requestId,
            errorIndex: index,
            error,
            dreamId: dreamData.id,
          });
        });
      }

      // If validation still fails after ensuring required fields, create a fallback dream
      if (
        !validation.valid &&
        validation.errors &&
        validation.errors.length > 0
      ) {
        const hasRequiredFieldErrors = validation.errors.some(
          (error) =>
            error.includes('required property') &&
            (error.includes('id') ||
              error.includes('title') ||
              error.includes('style'))
        );

        if (hasRequiredFieldErrors) {
          logger.error(
            'Critical validation failure - creating fallback dream',
            {
              requestId,
              originalDreamId: dreamData.id,
              errors: validation.errors,
            }
          );

          // Create a fallback dream using the original text
          const fallbackDream = createFallbackDream(
            originalText || 'Emergency dream scene',
            dreamData.style || 'ethereal',
            { requestId }
          );

          logger.info('Fallback dream created successfully', {
            requestId,
            fallbackId: fallbackDream.id,
            fallbackTitle: fallbackDream.title,
            fallbackStyle: fallbackDream.style,
            fallbackSource: fallbackDream.source, // Log the valid source enum
          });

          // Update the dream data and re-validate
          dreamData = fallbackDream;
          dataSource = 'fallback_generator';

          // Re-validate the fallback dream
          const fallbackValidation = validateDream(fallbackDream);
          validation = fallbackValidation;

          logger.info('Fallback dream validation result', {
            requestId,
            valid: fallbackValidation.valid,
            errorCount: fallbackValidation.errors?.length || 0,
          });
        }
      }
    }

    return { dreamData, dataSource, validation };
  }

  /**
   * Create final processed response object
   */
  createProcessedResponse(
    validatedDreamResult,
    originalResponse,
    requestId,
    responseTime
  ) {
    const { dreamData, dataSource, validation } = validatedDreamResult;

    // Extract metadata from original response
    const responseMetadata = originalResponse.metadata || {};

    // Create comprehensive metadata
    const metadata = {
      requestId,
      source: responseMetadata.source || dataSource,
      processingTimeMs: responseMetadata.processingTimeMs,
      responseTime,
      generatedAt: responseMetadata.generatedAt || new Date().toISOString(),
      validation: {
        valid: validation.valid,
        errorCount: validation.errors?.length || 0,
        validationType: validation.type,
      },
      originalResponseFields: Object.keys(originalResponse),
    };

    // Log final processing result
    logger.info('MCP Gateway response processing completed', {
      requestId,
      success: true,
      dreamId: dreamData.id,
      source: metadata.source,
      validationPassed: validation.valid,
      totalResponseTime: `${responseTime}ms`,
      processingSteps: [
        'text_extraction',
        'json_parsing',
        'structure_validation',
        'dream_data_extraction',
        'schema_validation',
        'response_creation',
      ],
    });

    return {
      dreamJson: dreamData,
      source: metadata.source,
      responseTime,
      requestId,
      metadata,
      validation,
      success: true,
    };
  }

  /**
   * Create a preview of response text for logging (using shared utilities)
   */
  createResponsePreview(responseText, maxLength = 300) {
    return utils.createResponsePreview(responseText, maxLength);
  }

  /**
   * Identify common JSON parsing issues (using shared utilities)
   */
  identifyJsonIssues(responseText) {
    return utils.identifyJsonIssues(responseText);
  }

  /**
   * Ensure required fields are present in dream data (using shared utilities)
   */
  ensureRequiredFields(dreamData, originalText, requestId) {
    const result = utils.ensureRequiredFields(dreamData, originalText);

    if (!result) {
      logger.error('Failed to ensure required fields', { requestId });
      return dreamData;
    }

    if (result.modified) {
      logger.info('Dream data was modified to ensure required fields', {
        requestId,
        dreamId: result.data.id,
        title: result.data.title,
        style: result.data.style,
      });
    }

    return result.data;
  }

  /**
   * Create cache key for validation results (using shared utilities)
   */
  createValidationCacheKey(dreamData) {
    return utils.createValidationCacheKey(dreamData);
  }

  /**
   * Process error response from MCP Gateway
   */
  processErrorResponse(error, requestId, responseTime, originalText) {
    logger.error('Processing MCP Gateway error response', {
      requestId,
      error: error.message,
      errorType: error.constructor.name,
      responseTime: `${responseTime}ms`,
      originalTextLength: originalText?.length || 0,
      stack: error.stack,
    });

    // Enhance error with processing context
    const enhancedError = new Error(error.message);
    enhancedError.requestId = requestId;
    enhancedError.responseTime = responseTime;
    enhancedError.processingStage = this.identifyProcessingStage(error);
    enhancedError.originalError = error;
    enhancedError.category = this.categorizeError(error);
    enhancedError.retryable = this.isRetryableError(error);

    logger.error('Enhanced error details', {
      requestId,
      processingStage: enhancedError.processingStage,
      category: enhancedError.category,
      retryable: enhancedError.retryable,
      responseTime: `${responseTime}ms`,
    });

    throw enhancedError;
  }

  /**
   * Identify which processing stage failed
   */
  identifyProcessingStage(error) {
    const message = error.message.toLowerCase();

    if (message.includes('read response body') || message.includes('extract')) {
      return 'text_extraction';
    }

    if (message.includes('json') || message.includes('parse')) {
      return 'json_parsing';
    }

    if (message.includes('structure') || message.includes('required fields')) {
      return 'structure_validation';
    }

    if (message.includes('dream data') || message.includes('no data')) {
      return 'dream_data_extraction';
    }

    if (message.includes('schema') || message.includes('validation')) {
      return 'schema_validation';
    }

    return 'unknown';
  }

  /**
   * Categorize error for handling decisions
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('abort')) {
      return 'timeout';
    }

    if (message.includes('json') || message.includes('parse')) {
      return 'parsing';
    }

    if (message.includes('validation') || message.includes('schema')) {
      return 'validation';
    }

    if (message.includes('network') || message.includes('connection')) {
      return 'network';
    }

    return 'processing';
  }

  /**
   * Determine if error is retryable
   */
  isRetryableError(error) {
    const category = this.categorizeError(error);
    const retryableCategories = ['timeout', 'network'];
    return retryableCategories.includes(category);
  }

  /**
   * Clear validation cache
   */
  clearValidationCache() {
    const cacheSize = this.validationCache.size;
    this.validationCache.clear();
    logger.info('Validation cache cleared', {
      previousSize: cacheSize,
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.validationCache.size,
      maxSize: 100,
    };
  }
}

// Create singleton instance
const responseProcessor = new MCPResponseProcessor();

module.exports = {
  MCPResponseProcessor,
  responseProcessor,
};
