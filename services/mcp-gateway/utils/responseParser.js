// services/mcp-gateway/utils/responseParser.js
// Convert raw LLM responses into usable JSON scene objects.
// Enhanced with robust response handling for different provider formats.

const { utils } = require('../../../shared');
const EnhancedResponseParser = require('./EnhancedResponseParser');
const ResponseProcessingPipeline = require('./ResponseProcessingPipeline');
const { logger, logValueState } = require('./logger');

// Create global parser instance with test-aware configuration
const enhancedParser = new EnhancedResponseParser({
  enableLogging:
    process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test',
  fallbackStrategies: true,
  enableMonitoringIntegration: process.env.NODE_ENV !== 'test',
});

// Create global processing pipeline instance with test-aware configuration
const processingPipeline = new ResponseProcessingPipeline({
  enableLogging:
    process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test',
  enableFallbackStrategies: true,
  enableResponseValidation: true,
  enableContentSanitization: true,
  maxProcessingAttempts: 5,
  enableMonitoringIntegration: process.env.NODE_ENV !== 'test',
});

/**
 * Safely extract content from any response format using robust processing pipeline
 * CRITICAL: Always returns a resolved value, never a Promise
 * @param {any} response - Raw response from provider
 * @param {string} providerName - Provider name for context
 * @param {string} operationType - Type of operation for context
 * @returns {Promise<string|null>} Extracted content string (always resolved)
 */
async function extractContentSafely(
  response,
  providerName = 'unknown',
  operationType = 'generateDream'
) {
  try {
    // ============================================================
    // CRITICAL PROMISE RESOLUTION #1: Input Sanitization
    // ============================================================
    // This await ensures the response parameter is fully resolved before we
    // attempt to process it. Even though the response should already be resolved
    // by the caller, this is defensive programming to handle edge cases where:
    // - The provider returns a Promise instead of a value
    // - Nested Promises exist in the response chain
    // - Async middleware wraps the response
    //
    // Promise.resolve() is safe to call on non-Promise values (returns them as-is)
    // and will await Promise values, ensuring we always work with resolved data.
    const resolvedResponse = await Promise.resolve(response);

    // Log initial state for debugging
    logValueState('extractContentSafely.input', resolvedResponse, {
      provider: providerName,
      operation: operationType,
    });

    // Use the robust processing pipeline for enhanced handling
    const result = await processingPipeline.processResponse(
      resolvedResponse,
      providerName,
      operationType,
      { timestamp: Date.now() }
    );

    if (result.success && result.content) {
      // ============================================================
      // CRITICAL PROMISE RESOLUTION #2: Pipeline Result Validation
      // ============================================================
      // After the processing pipeline extracts content, we must ensure the
      // extracted content itself is not a Promise. The pipeline may use async
      // operations internally (JSON parsing, string manipulation, etc.) and
      // could accidentally return a Promise instead of the actual content.
      //
      // This await is our safety net to catch that scenario. Without it:
      // - finalContent could be Promise { <pending> }
      // - Caller receives a Promise instead of dream data
      // - Result: 502 errors and empty content objects
      //
      // Promise.resolve() handles both cases safely:
      // - If result.content is a Promise: awaits it
      // - If result.content is a value: returns it unchanged
      const finalContent = await Promise.resolve(result.content);

      // Log extraction state
      logValueState('extractContentSafely.pipelineResult', finalContent, {
        provider: providerName,
        success: true,
        source: 'pipeline',
      });

      logger.debug('Content extracted successfully via pipeline', {
        provider: providerName,
        contentType: typeof finalContent,
        isPromise: finalContent instanceof Promise,
        hasContent: !!finalContent,
        contentLength:
          typeof finalContent === 'string' ? finalContent.length : 0,
      });

      return finalContent;
    }

    // Fallback to legacy parser if pipeline fails
    logger.warn(
      `Processing pipeline failed for ${providerName}, falling back to legacy parser`
    );
    const legacyResult = enhancedParser.parseProviderResponse(
      resolvedResponse,
      providerName,
      operationType
    );

    if (legacyResult.success && legacyResult.content) {
      // ============================================================
      // CRITICAL PROMISE RESOLUTION #3: Legacy Parser Fallback
      // ============================================================
      // When the processing pipeline fails, we fall back to the legacy parser.
      // The legacy parser may also use async operations, so we must ensure its
      // result is fully resolved before returning. This maintains consistency
      // with the pipeline path and prevents Promise leakage through the fallback.
      //
      // This is especially important because fallback scenarios often occur under
      // error conditions, and we don't want to compound the problem by introducing
      // Promise-related bugs in the recovery path.
      const legacyContent = await Promise.resolve(legacyResult.content);

      // Log extraction state
      logValueState('extractContentSafely.legacyResult', legacyContent, {
        provider: providerName,
        success: true,
        source: 'legacy',
      });

      logger.debug('Content extracted successfully via legacy parser', {
        provider: providerName,
        contentType: typeof legacyContent,
        isPromise: legacyContent instanceof Promise,
        hasContent: !!legacyContent,
      });

      return legacyContent;
    }

    // Final attempt with recovery
    if (!legacyResult.success) {
      const recovery = enhancedParser.attemptContentRecovery(
        resolvedResponse,
        new Error(legacyResult.error?.message || 'Unknown error')
      );
      if (recovery.success && recovery.content) {
        // ============================================================
        // CRITICAL PROMISE RESOLUTION #4: Recovery Path Safety
        // ============================================================
        // This is our last-ditch effort to extract content when both the pipeline
        // and legacy parser have failed. The recovery mechanism may use aggressive
        // extraction strategies that could involve async operations. We MUST ensure
        // the recovered content is fully resolved before returning.
        //
        // This is the deepest fallback level, and Promise leakage here would be
        // particularly difficult to debug since it only occurs in edge cases.
        // The await ensures we maintain our contract: extractContentSafely ALWAYS
        // returns resolved values, never Promises, regardless of which code path
        // was taken (pipeline, legacy, or recovery).
        const recoveryContent = await Promise.resolve(recovery.content);

        // Log extraction state
        logValueState('extractContentSafely.recoveryResult', recoveryContent, {
          provider: providerName,
          success: true,
          source: 'recovery',
        });

        logger.debug('Content extracted successfully via recovery', {
          provider: providerName,
          contentType: typeof recoveryContent,
          isPromise: recoveryContent instanceof Promise,
          hasContent: !!recoveryContent,
        });

        return recoveryContent;
      }
    }

    logger.warn('Content extraction returned null', {
      provider: providerName,
      operation: operationType,
      pipelineSuccess: result.success,
      legacySuccess: legacyResult.success,
    });

    return null;
  } catch (error) {
    logger.error('Content extraction failed', {
      provider: providerName,
      operation: operationType,
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}

// Use shared utility functions
function _extractJsonString(text) {
  return utils.extractJsonString(text);
}

function _normalizeRawResponse(raw, providerName = 'unknown') {
  // Enhanced normalization using the new parser
  const result = enhancedParser.normalizeResponse(raw, providerName);

  if (result.success) {
    return result.data;
  }

  // Fallback to shared utility for compatibility
  return utils.normalizeRawResponse(raw, providerName);
}

async function parseDreamResponse(raw, source = 'unknown') {
  try {
    // Use robust processing pipeline for enhanced handling
    const result = await processingPipeline.processResponse(
      raw,
      source,
      'generateDream',
      { timestamp: Date.now() }
    );

    if (result.success && result.content) {
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(result.content);
        return parsed;
      } catch (jsonError) {
        // If JSON parsing fails, try shared utility extraction
        const jsonStr = utils.extractJsonString(result.content);
        if (jsonStr) {
          try {
            const parsed = JSON.parse(jsonStr);
            return parsed;
          } catch (parseErr) {
            // attempt tiny fixes using shared utility
            const tidy = utils.cleanJsonString(jsonStr);
            if (tidy) {
              try {
                return JSON.parse(tidy);
              } catch (err2) {
                // give up on JSON parsing, return null
              }
            }
          }
        }
      }
    }

    // Fallback to shared utility for parsing
    return utils.parseDreamResponse(raw, source);
  } catch (err) {
    return null;
  }
}

async function parsePatchResponse(raw, baseJson, source = 'unknown') {
  // Similar strategy to parseDreamResponse, produce full patched JSON.
  const parsed = await parseDreamResponse(raw, source);
  if (!parsed) {
    return null;
  }

  // If parsed doesn't contain expected top-level fields, try to merge
  if (!parsed.id && baseJson && baseJson.id) {
    parsed.id = parsed.id || baseJson.id;
  }
  return parsed;
}

async function parseStyleResponse(raw, baseJson, source = 'unknown') {
  const parsed = await parseDreamResponse(raw, source);
  if (!parsed) return null;

  // If server returns only modifications, merge with baseJson
  if (
    !parsed.structures &&
    baseJson &&
    (baseJson.structures || parsed.structures)
  ) {
    // naive merge: overlay parsed onto baseJson
    return { ...baseJson, ...parsed };
  }

  return parsed;
}

module.exports = {
  parseDreamResponse,
  parsePatchResponse,
  parseStyleResponse,
  extractContentSafely,
  enhancedParser,
  processingPipeline,
};
