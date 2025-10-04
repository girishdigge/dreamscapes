/**
 * Enhanced Content Extractor
 *
 * Comprehensive pattern matching system for extracting dream data from
 * various AI provider response formats. Supports standard patterns,
 * nested patterns, provider-specific patterns, and JSON string extraction.
 */

const { logger } = require('./logger');
const ExtractionLogger = require('./ExtractionLogger');

class EnhancedContentExtractor {
  constructor(options = {}) {
    this.options = {
      maxDepth: options.maxDepth || 5,
      enableLogging: options.enableLogging !== false,
      logLevel: options.logLevel || 'debug',
      ...options,
    };

    // Initialize extraction logger
    this.extractionLogger = new ExtractionLogger({
      enableLogging: this.options.enableLogging,
      logLevel: this.options.logLevel,
      maxResponseLength: 500,
    });

    this.metrics = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      patternSuccesses: {},
      patternFailures: {},
    };

    // Track last extraction details for metrics
    this.lastExtractionDetails = {
      lastSuccessfulPattern: null,
      attemptedPatterns: [],
    };
  }

  /**
   * Main extraction method with comprehensive pattern matching
   * @param {*} response - Response to extract from
   * @param {string} providerName - Provider name
   * @param {Object} requestContext - Request context for logging
   * @returns {Object|null} Extracted dream data or null
   */
  extractContent(response, providerName, requestContext = {}) {
    this.metrics.totalExtractions++;
    const extractionAttempts = [];

    // Reset last extraction details
    this.lastExtractionDetails = {
      lastSuccessfulPattern: null,
      attemptedPatterns: [],
    };

    // Create request context for logging
    const context = this.extractionLogger.createRequestContext({
      ...requestContext,
      provider: providerName,
      operation: 'extractContent',
    });

    try {
      // Log extraction start with structured logging
      this.extractionLogger.logExtractionStart(context, response);

      // Handle null/undefined
      if (!response) {
        this.logExtractionAttempt(
          'null_check',
          false,
          'Response is null or undefined',
          extractionAttempts,
          'null_check',
          context
        );
        this.metrics.failedExtractions++;
        this.lastExtractionDetails.attemptedPatterns = extractionAttempts;
        return null;
      }

      // Try extraction patterns in order of likelihood
      let result = null;

      // 1. Try direct dream object
      result = this.tryDirectDreamObject(response, extractionAttempts, context);
      if (result) {
        this.metrics.successfulExtractions++;
        this.recordPatternSuccess('direct_dream_object', providerName);
        this.lastExtractionDetails.lastSuccessfulPattern =
          'direct_dream_object';
        this.lastExtractionDetails.attemptedPatterns = extractionAttempts;
        this.extractionLogger.logExtractionSuccess(
          context,
          'direct_dream_object',
          result
        );
        return result;
      }

      // 2. Try standard patterns
      result = this.tryStandardPatterns(response, extractionAttempts, context);
      if (result) {
        this.metrics.successfulExtractions++;
        this.recordPatternSuccess('standard_patterns', providerName);
        this.lastExtractionDetails.lastSuccessfulPattern = 'standard_patterns';
        this.lastExtractionDetails.attemptedPatterns = extractionAttempts;
        this.extractionLogger.logExtractionSuccess(
          context,
          'standard_patterns',
          result
        );
        return result;
      }

      // 3. Try provider-specific patterns
      result = this.tryProviderSpecificPatterns(
        response,
        providerName,
        extractionAttempts,
        context
      );
      if (result) {
        this.metrics.successfulExtractions++;
        this.recordPatternSuccess(
          `provider_specific_${providerName}`,
          providerName
        );
        this.lastExtractionDetails.lastSuccessfulPattern = `provider_specific_${providerName}`;
        this.lastExtractionDetails.attemptedPatterns = extractionAttempts;
        this.extractionLogger.logExtractionSuccess(
          context,
          `provider_specific_${providerName}`,
          result
        );
        return result;
      }

      // 4. Try nested patterns
      result = this.tryNestedPatterns(response, extractionAttempts, context);
      if (result) {
        this.metrics.successfulExtractions++;
        this.recordPatternSuccess('nested_patterns', providerName);
        this.lastExtractionDetails.lastSuccessfulPattern = 'nested_patterns';
        this.lastExtractionDetails.attemptedPatterns = extractionAttempts;
        this.extractionLogger.logExtractionSuccess(
          context,
          'nested_patterns',
          result
        );
        return result;
      }

      // 5. Try JSON string extraction
      result = this.extractAndParseJSON(response, extractionAttempts, context);
      if (result) {
        this.metrics.successfulExtractions++;
        this.recordPatternSuccess('json_string', providerName);
        this.lastExtractionDetails.lastSuccessfulPattern = 'json_string';
        this.lastExtractionDetails.attemptedPatterns = extractionAttempts;
        this.extractionLogger.logExtractionSuccess(
          context,
          'json_string',
          result
        );
        return result;
      }

      // All patterns failed
      this.metrics.failedExtractions++;
      this.recordPatternFailure('all_patterns', providerName);
      this.lastExtractionDetails.attemptedPatterns = extractionAttempts;

      // Log comprehensive extraction failure
      this.extractionLogger.logExtractionFailure(
        context,
        response,
        extractionAttempts
      );

      return null;
    } catch (error) {
      this.metrics.failedExtractions++;
      this.extractionLogger.logError(
        context,
        'Error during content extraction',
        error
      );
      return null;
    }
  }

  /**
   * Try direct dream object pattern
   * Checks if response itself has id, structures, entities fields
   * @param {*} response - Response to check
   * @param {Array} attempts - Extraction attempts log
   * @param {Object} context - Request context for logging
   * @returns {Object|null} Dream data or null
   */
  tryDirectDreamObject(response, attempts, context = null) {
    const pattern = 'direct_dream_object';
    const description =
      'response.id && response.structures && response.entities';

    try {
      if (
        response &&
        typeof response === 'object' &&
        response.id &&
        response.structures &&
        response.entities
      ) {
        this.logExtractionAttempt(
          pattern,
          true,
          'Response is a direct dream object',
          attempts,
          description,
          context
        );
        return response;
      }

      const reason = this.buildMissingFieldsReason(response, [
        'id',
        'structures',
        'entities',
      ]);
      this.logExtractionAttempt(
        pattern,
        false,
        reason,
        attempts,
        description,
        context
      );
      return null;
    } catch (error) {
      this.logExtractionAttempt(
        pattern,
        false,
        `Error: ${error.message}`,
        attempts,
        description,
        context
      );
      return null;
    }
  }

  /**
   * Try standard extraction patterns
   * @param {*} response - Response to extract from
   * @param {Array} attempts - Extraction attempts log
   * @param {Object} context - Request context for logging
   * @returns {Object|null} Extracted data or null
   */
  tryStandardPatterns(response, attempts, context = null) {
    if (!response || typeof response !== 'object') {
      return null;
    }

    // Standard field names to check
    const standardFields = [
      'content',
      'data',
      'text',
      'message',
      'output',
      'result',
    ];

    for (const field of standardFields) {
      const pattern = `standard_${field}`;
      const description = `response.${field}`;

      try {
        if (field in response && response[field]) {
          const value = response[field];

          // If it's an object, check if it's a dream object
          if (typeof value === 'object' && !Array.isArray(value)) {
            if (this.isDreamObject(value)) {
              this.logExtractionAttempt(
                pattern,
                true,
                `Found dream object in response.${field}`,
                attempts,
                description
              );
              return value;
            }
          }

          // If it's a string, try parsing as JSON
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (this.isDreamObject(parsed)) {
                this.logExtractionAttempt(
                  pattern,
                  true,
                  `Parsed JSON from response.${field}`,
                  attempts,
                  description
                );
                return parsed;
              }
            } catch (e) {
              // Not JSON, continue
            }
          }

          this.logExtractionAttempt(
            pattern,
            false,
            `response.${field} exists but is not a dream object`,
            attempts,
            description
          );
        } else {
          this.logExtractionAttempt(
            pattern,
            false,
            `response.${field} is undefined or falsy`,
            attempts,
            description
          );
        }
      } catch (error) {
        this.logExtractionAttempt(
          pattern,
          false,
          `Error: ${error.message}`,
          attempts,
          description
        );
      }
    }

    return null;
  }

  /**
   * Try nested extraction patterns
   * Traverses object hierarchy up to maxDepth to find dream data
   * @param {*} response - Response to extract from
   * @param {Array} attempts - Extraction attempts log
   * @param {Object} context - Request context for logging
   * @returns {Object|null} Extracted data or null
   */
  tryNestedPatterns(response, attempts, context = null) {
    if (!response || typeof response !== 'object') {
      return null;
    }

    // Common nested patterns
    const nestedPatterns = [
      {
        path: ['choices', 0, 'message', 'content'],
        name: 'choices[0].message.content',
      },
      { path: ['data', 'content'], name: 'data.content' },
      { path: ['result', 'data'], name: 'result.data' },
      { path: ['response', 'data'], name: 'response.data' },
      { path: ['output', 'content'], name: 'output.content' },
      { path: ['message', 'content'], name: 'message.content' },
      { path: ['data', 'result'], name: 'data.result' },
      { path: ['content', 'data'], name: 'content.data' },
    ];

    for (const { path, name } of nestedPatterns) {
      const pattern = `nested_${name.replace(/\[|\]|\./g, '_')}`;
      const description = `response.${name}`;

      try {
        const value = this.getNestedValue(response, path);

        if (value !== undefined && value !== null) {
          // If it's an object, check if it's a dream object
          if (typeof value === 'object' && !Array.isArray(value)) {
            if (this.isDreamObject(value)) {
              this.logExtractionAttempt(
                pattern,
                true,
                `Found dream object at ${name}`,
                attempts,
                description
              );
              return value;
            }
          }

          // If it's a string, try parsing as JSON
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (this.isDreamObject(parsed)) {
                this.logExtractionAttempt(
                  pattern,
                  true,
                  `Parsed JSON from ${name}`,
                  attempts,
                  description
                );
                return parsed;
              }
            } catch (e) {
              // Not JSON, continue
            }
          }

          this.logExtractionAttempt(
            pattern,
            false,
            `${name} exists but is not a dream object`,
            attempts,
            description
          );
        } else {
          this.logExtractionAttempt(
            pattern,
            false,
            `${name} is undefined or null`,
            attempts,
            description
          );
        }
      } catch (error) {
        this.logExtractionAttempt(
          pattern,
          false,
          `Error: ${error.message}`,
          attempts,
          description
        );
      }
    }

    // Try deep traversal as last resort
    const deepResult = this.deepTraversal(
      response,
      this.options.maxDepth,
      attempts
    );
    if (deepResult) {
      return deepResult;
    }

    return null;
  }

  /**
   * Try provider-specific extraction patterns
   * @param {*} response - Response to extract from
   * @param {string} providerName - Provider name
   * @param {Array} attempts - Extraction attempts log
   * @param {Object} context - Request context for logging
   * @returns {Object|null} Extracted data or null
   */
  tryProviderSpecificPatterns(
    response,
    providerName,
    attempts,
    context = null
  ) {
    if (!response || typeof response !== 'object') {
      return null;
    }

    const provider = providerName.toLowerCase();

    // OpenAI-specific patterns
    if (provider === 'openai') {
      return this.tryOpenAIPatterns(response, attempts, context);
    }

    // Cerebras-specific patterns
    if (provider === 'cerebras') {
      return this.tryCerebrasPatterns(response, attempts, context);
    }

    // Generic provider patterns
    return this.tryGenericProviderPatterns(response, attempts, context);
  }

  /**
   * Try OpenAI-specific patterns
   * @param {*} response - Response to extract from
   * @param {Array} attempts - Extraction attempts log
   * @param {Object} context - Request context for logging
   * @returns {Object|null} Extracted data or null
   */
  tryOpenAIPatterns(response, attempts, context = null) {
    const pattern = 'openai_choices_message_content';
    const description = 'response.choices[0].message.content';

    try {
      if (
        response.choices &&
        Array.isArray(response.choices) &&
        response.choices.length > 0 &&
        response.choices[0].message &&
        response.choices[0].message.content
      ) {
        const content = response.choices[0].message.content;

        // Try parsing as JSON
        if (typeof content === 'string') {
          try {
            const parsed = JSON.parse(content);
            if (this.isDreamObject(parsed)) {
              this.logExtractionAttempt(
                pattern,
                true,
                'Parsed dream object from OpenAI choices[0].message.content',
                attempts,
                description
              );
              return parsed;
            }
          } catch (e) {
            // Not JSON
          }
        }

        // If it's already an object
        if (typeof content === 'object' && this.isDreamObject(content)) {
          this.logExtractionAttempt(
            pattern,
            true,
            'Found dream object in OpenAI choices[0].message.content',
            attempts,
            description
          );
          return content;
        }

        this.logExtractionAttempt(
          pattern,
          false,
          'OpenAI content exists but is not a dream object',
          attempts,
          description
        );
      } else {
        this.logExtractionAttempt(
          pattern,
          false,
          'OpenAI choices structure not found',
          attempts,
          description
        );
      }
    } catch (error) {
      this.logExtractionAttempt(
        pattern,
        false,
        `Error: ${error.message}`,
        attempts,
        description
      );
    }

    return null;
  }

  /**
   * Try Cerebras-specific patterns
   * Based on findings from Task 1 logging
   * @param {*} response - Response to extract from
   * @param {Array} attempts - Extraction attempts log
   * @param {Object} context - Request context for logging
   * @returns {Object|null} Extracted data or null
   */
  tryCerebrasPatterns(response, attempts, context = null) {
    // Pattern 1: Cerebras might return choices like OpenAI
    const pattern1 = 'cerebras_choices_message_content';
    const description1 = 'response.choices[0].message.content (Cerebras)';

    try {
      if (
        response.choices &&
        Array.isArray(response.choices) &&
        response.choices.length > 0
      ) {
        const choice = response.choices[0];

        if (choice.message && choice.message.content) {
          const content = choice.message.content;

          if (typeof content === 'string') {
            try {
              const parsed = JSON.parse(content);
              if (this.isDreamObject(parsed)) {
                this.logExtractionAttempt(
                  pattern1,
                  true,
                  'Parsed dream object from Cerebras choices[0].message.content',
                  attempts,
                  description1
                );
                return parsed;
              }
            } catch (e) {
              // Not JSON
            }
          }

          if (typeof content === 'object' && this.isDreamObject(content)) {
            this.logExtractionAttempt(
              pattern1,
              true,
              'Found dream object in Cerebras choices[0].message.content',
              attempts,
              description1
            );
            return content;
          }
        }
      }

      this.logExtractionAttempt(
        pattern1,
        false,
        'Cerebras choices structure not found or not a dream object',
        attempts,
        description1
      );
    } catch (error) {
      this.logExtractionAttempt(
        pattern1,
        false,
        `Error: ${error.message}`,
        attempts,
        description1
      );
    }

    // Pattern 2: Cerebras might return text field
    const pattern2 = 'cerebras_text';
    const description2 = 'response.text (Cerebras)';

    try {
      if (response.text) {
        if (typeof response.text === 'string') {
          try {
            const parsed = JSON.parse(response.text);
            if (this.isDreamObject(parsed)) {
              this.logExtractionAttempt(
                pattern2,
                true,
                'Parsed dream object from Cerebras text field',
                attempts,
                description2
              );
              return parsed;
            }
          } catch (e) {
            // Not JSON
          }
        }

        if (
          typeof response.text === 'object' &&
          this.isDreamObject(response.text)
        ) {
          this.logExtractionAttempt(
            pattern2,
            true,
            'Found dream object in Cerebras text field',
            attempts,
            description2
          );
          return response.text;
        }

        this.logExtractionAttempt(
          pattern2,
          false,
          'Cerebras text field exists but is not a dream object',
          attempts,
          description2
        );
      } else {
        this.logExtractionAttempt(
          pattern2,
          false,
          'Cerebras text field not found',
          attempts,
          description2
        );
      }
    } catch (error) {
      this.logExtractionAttempt(
        pattern2,
        false,
        `Error: ${error.message}`,
        attempts,
        description2
      );
    }

    return null;
  }

  /**
   * Try generic provider patterns
   * @param {*} response - Response to extract from
   * @param {Array} attempts - Extraction attempts log
   * @param {Object} context - Request context for logging
   * @returns {Object|null} Extracted data or null
   */
  tryGenericProviderPatterns(response, attempts, context = null) {
    // Try common provider response structures
    const patterns = [
      { field: 'response', name: 'generic_response' },
      { field: 'body', name: 'generic_body' },
      { field: 'payload', name: 'generic_payload' },
    ];

    for (const { field, name } of patterns) {
      const pattern = name;
      const description = `response.${field}`;

      try {
        if (field in response && response[field]) {
          const value = response[field];

          if (typeof value === 'object' && this.isDreamObject(value)) {
            this.logExtractionAttempt(
              pattern,
              true,
              `Found dream object in ${field}`,
              attempts,
              description
            );
            return value;
          }

          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (this.isDreamObject(parsed)) {
                this.logExtractionAttempt(
                  pattern,
                  true,
                  `Parsed dream object from ${field}`,
                  attempts,
                  description
                );
                return parsed;
              }
            } catch (e) {
              // Not JSON
            }
          }

          this.logExtractionAttempt(
            pattern,
            false,
            `${field} exists but is not a dream object`,
            attempts,
            description
          );
        } else {
          this.logExtractionAttempt(
            pattern,
            false,
            `${field} not found`,
            attempts,
            description
          );
        }
      } catch (error) {
        this.logExtractionAttempt(
          pattern,
          false,
          `Error: ${error.message}`,
          attempts,
          description
        );
      }
    }

    return null;
  }

  /**
   * Extract and parse JSON from string responses
   * @param {*} response - Response to extract from
   * @param {Array} attempts - Extraction attempts log
   * @param {Object} context - Request context for logging
   * @returns {Object|null} Parsed data or null
   */
  extractAndParseJSON(response, attempts, context = null) {
    const pattern = 'json_string_extraction';
    const description = 'JSON.parse(response as string)';

    try {
      // If response is a string, try parsing
      if (typeof response === 'string') {
        try {
          const parsed = JSON.parse(response);
          if (this.isDreamObject(parsed)) {
            this.logExtractionAttempt(
              pattern,
              true,
              'Parsed dream object from string response',
              attempts,
              description
            );
            return parsed;
          }

          this.logExtractionAttempt(
            pattern,
            false,
            'Parsed JSON but not a dream object',
            attempts,
            description
          );
        } catch (e) {
          this.logExtractionAttempt(
            pattern,
            false,
            `JSON parse failed: ${e.message}`,
            attempts,
            description
          );
        }
      } else {
        this.logExtractionAttempt(
          pattern,
          false,
          'Response is not a string',
          attempts,
          description
        );
      }
    } catch (error) {
      this.logExtractionAttempt(
        pattern,
        false,
        `Error: ${error.message}`,
        attempts,
        description
      );
    }

    return null;
  }

  /**
   * Deep traversal to find dream object in nested structure
   * @param {*} obj - Object to traverse
   * @param {number} maxDepth - Maximum depth
   * @param {Array} attempts - Extraction attempts log
   * @param {number} currentDepth - Current depth
   * @param {string} path - Current path
   * @returns {Object|null} Found dream object or null
   */
  deepTraversal(obj, maxDepth, attempts, currentDepth = 0, path = 'response') {
    if (currentDepth >= maxDepth) {
      return null;
    }

    if (!obj || typeof obj !== 'object') {
      return null;
    }

    // Check if current object is a dream object
    if (this.isDreamObject(obj)) {
      this.logExtractionAttempt(
        'deep_traversal',
        true,
        `Found dream object at depth ${currentDepth}, path: ${path}`,
        attempts,
        path
      );
      return obj;
    }

    // Traverse children
    try {
      const keys = Object.keys(obj);

      for (const key of keys) {
        const value = obj[key];
        const newPath = `${path}.${key}`;

        // Skip null/undefined
        if (value === null || value === undefined) {
          continue;
        }

        // If it's an object, recurse
        if (typeof value === 'object' && !Array.isArray(value)) {
          const result = this.deepTraversal(
            value,
            maxDepth,
            attempts,
            currentDepth + 1,
            newPath
          );
          if (result) {
            return result;
          }
        }

        // If it's an array, check first element
        if (Array.isArray(value) && value.length > 0) {
          const result = this.deepTraversal(
            value[0],
            maxDepth,
            attempts,
            currentDepth + 1,
            `${newPath}[0]`
          );
          if (result) {
            return result;
          }
        }

        // If it's a string, try parsing
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (this.isDreamObject(parsed)) {
              this.logExtractionAttempt(
                'deep_traversal_json',
                true,
                `Parsed dream object from string at ${newPath}`,
                attempts,
                newPath
              );
              return parsed;
            }
          } catch (e) {
            // Not JSON, continue
          }
        }
      }
    } catch (error) {
      // Continue traversal even if error
    }

    return null;
  }

  /**
   * Check if object is a dream object
   * @param {*} obj - Object to check
   * @returns {boolean} True if dream object
   */
  isDreamObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return false;
    }

    // A dream object must have at least id and structures
    // entities is also required but might be empty array
    return (
      'id' in obj &&
      'structures' in obj &&
      (Array.isArray(obj.structures) || typeof obj.structures === 'object')
    );
  }

  /**
   * Get nested value from object using path array
   * @param {Object} obj - Object to traverse
   * @param {Array} path - Path array
   * @returns {*} Value or undefined
   */
  getNestedValue(obj, path) {
    let current = obj;

    for (const key of path) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof key === 'number' && Array.isArray(current)) {
        current = current[key];
      } else if (typeof current === 'object') {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Build reason string for missing fields
   * @param {*} obj - Object to check
   * @param {Array} fields - Required fields
   * @returns {string} Reason string
   */
  buildMissingFieldsReason(obj, fields) {
    if (!obj || typeof obj !== 'object') {
      return 'Response is not an object';
    }

    const missing = fields.filter((field) => !(field in obj));

    if (missing.length === 0) {
      return 'All fields present but validation failed';
    }

    return `Missing fields: ${missing.join(', ')}`;
  }

  /**
   * Log extraction attempt
   * @param {string} pattern - Pattern name
   * @param {boolean} success - Success status
   * @param {string} reason - Reason/message
   * @param {Array} attempts - Attempts array
   * @param {string} description - Pattern description
   * @param {Object} context - Request context (optional)
   */
  logExtractionAttempt(
    pattern,
    success,
    reason,
    attempts,
    description = '',
    context = null
  ) {
    const attempt = {
      pattern,
      description,
      success,
      reason,
      timestamp: Date.now(),
    };

    attempts.push(attempt);

    // Use extraction logger if context is provided
    if (context && this.extractionLogger) {
      this.extractionLogger.logPatternAttempt(
        context,
        pattern,
        description,
        success,
        reason
      );
    } else if (this.options.enableLogging) {
      // Fallback to old logging
      const logLevel = success ? 'info' : this.options.logLevel;
      logger[logLevel](
        `Extraction pattern ${success ? 'succeeded' : 'failed'}`,
        {
          pattern,
          description,
          success,
          reason,
        }
      );
    }
  }

  /**
   * Record pattern success
   * @param {string} pattern - Pattern name
   * @param {string} provider - Provider name
   */
  recordPatternSuccess(pattern, provider) {
    const key = `${provider}_${pattern}`;
    this.metrics.patternSuccesses[key] =
      (this.metrics.patternSuccesses[key] || 0) + 1;
  }

  /**
   * Record pattern failure
   * @param {string} pattern - Pattern name
   * @param {string} provider - Provider name
   */
  recordPatternFailure(pattern, provider) {
    const key = `${provider}_${pattern}`;
    this.metrics.patternFailures[key] =
      (this.metrics.patternFailures[key] || 0) + 1;
  }

  /**
   * Get extraction metrics
   * @returns {Object} Metrics
   */
  getExtractionMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.totalExtractions > 0
          ? (this.metrics.successfulExtractions /
              this.metrics.totalExtractions) *
            100
          : 0,
      failureRate:
        this.metrics.totalExtractions > 0
          ? (this.metrics.failedExtractions / this.metrics.totalExtractions) *
            100
          : 0,
      lastSuccessfulPattern: this.lastExtractionDetails.lastSuccessfulPattern,
      attemptedPatterns: this.lastExtractionDetails.attemptedPatterns,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      patternSuccesses: {},
      patternFailures: {},
    };
  }
}

module.exports = EnhancedContentExtractor;
