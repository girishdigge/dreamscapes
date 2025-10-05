/**
 * Creative Dream Pipeline Routes
 * API endpoints for enhancing dreams with creative intelligence
 *
 * NOTE: This is separate from the main /parse endpoint which uses AI.
 * The Creative Pipeline uses NLP to add motion, events, and camera direction
 * to either user prompts OR existing dream JSON from /parse.
 */

const express = require('express');
const router = express.Router();
const CreativeDreamPipeline = require('../integration/CreativeDreamPipeline');
const PipelineConfig = require('../integration/PipelineConfig');
const { asyncHandler } = require('../utils/errorHandler');
const { logger } = require('../utils/logger');

// Initialize pipeline with default configuration
let defaultPipeline = null;

/**
 * Initialize the default pipeline
 */
function initializePipeline() {
  if (!defaultPipeline) {
    defaultPipeline = new CreativeDreamPipeline(PipelineConfig.DEFAULT);
    logger.info('Creative Dream Pipeline initialized');
  }
  return defaultPipeline;
}

/**
 * POST /api/creative/enhance
 * Enhance a dream prompt with creative intelligence (motion, events, camera)
 *
 * This endpoint uses NLP (not AI) to add cinematic enhancements to prompts.
 * Use this for quick, deterministic scene generation without AI costs.
 *
 * Request Body:
 * {
 *   prompt: string (required) - Natural language prompt
 *   config: object (optional) - Pipeline configuration
 *   preset: string (optional) - Configuration preset name
 *   includeMetadata: boolean (optional) - Include metadata in response (default: true)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     prompt: string,
 *     entities: array,
 *     environment: object,
 *     events: array,
 *     camera: array,
 *     metadata: object (if includeMetadata is true)
 *   },
 *   processingTime: number,
 *   timestamp: string
 * }
 */
router.post(
  '/creative/enhance',
  asyncHandler(async (req, res) => {
    const startTime = Date.now();

    // Extract request parameters
    const { prompt, config, preset, includeMetadata = true } = req.body;

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      logger.warn('Invalid prompt received', { prompt });
      return res.status(400).json({
        success: false,
        error: 'Invalid prompt',
        message: 'Prompt must be a non-empty string',
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Processing creative enhancement', {
      promptLength: prompt.length,
      hasConfig: !!config,
      preset,
    });

    try {
      // Determine configuration
      let pipelineConfig;

      if (preset) {
        // Use preset
        pipelineConfig = PipelineConfig.getPreset(preset);
        if (!pipelineConfig) {
          logger.warn('Invalid preset requested', { preset });
          return res.status(400).json({
            success: false,
            error: 'Invalid preset',
            message: `Preset '${preset}' not found. Available presets: default, minimal, full, performance`,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (config) {
        // Validate custom configuration
        const validation = PipelineConfig.validate(config);
        if (!validation.valid) {
          logger.warn('Invalid configuration', { errors: validation.errors });
          return res.status(400).json({
            success: false,
            error: 'Invalid configuration',
            message: 'Configuration validation failed',
            errors: validation.errors,
            timestamp: new Date().toISOString(),
          });
        }
        pipelineConfig = PipelineConfig.merge(config);
      } else {
        // Use default pipeline
        pipelineConfig = null; // Will use default
      }

      // Create or use pipeline
      const pipeline = pipelineConfig
        ? new CreativeDreamPipeline(pipelineConfig)
        : initializePipeline();

      // Process the prompt
      const result = await pipeline.process(prompt);

      // Build response
      const response = {
        success: true,
        data: {
          prompt: result.prompt,
          entities: result.entities,
          environment: result.environment,
          events: result.events,
          camera: result.camera,
        },
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      // Include metadata if requested
      if (includeMetadata) {
        response.data.metadata = result.metadata;
      }

      // Add configuration info
      response.configuration = {
        preset: preset || 'default',
        features: {
          motion: pipelineConfig?.enableMotion !== false,
          events: pipelineConfig?.enableEvents !== false,
          camera: pipelineConfig?.enableCamera !== false,
          semantics: pipelineConfig?.enableSemantics !== false,
        },
      };

      logger.info('Creative enhancement completed', {
        promptLength: prompt.length,
        entitiesCount: result.entities.length,
        eventsCount: result.events.length,
        cameraShots: result.camera.length,
        processingTime: response.processingTime,
        confidence: result.metadata?.confidence,
      });

      res.json(response);
    } catch (error) {
      logger.error('Failed to process creative enhancement', {
        error: error.message,
        stack: error.stack,
        prompt: prompt.substring(0, 100),
      });

      res.status(500).json({
        success: false,
        error: 'Processing failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

/**
 * GET /api/creative/presets
 * Get available configuration presets
 */
router.get('/creative/presets', (req, res) => {
  logger.debug('Presets requested');

  const presets = {
    default: {
      name: 'default',
      description: 'Balanced configuration with all features enabled',
      features: PipelineConfig.DEFAULT,
    },
    minimal: {
      name: 'minimal',
      description: 'Fastest processing, backward compatible mode',
      features: PipelineConfig.MINIMAL,
    },
    full: {
      name: 'full',
      description: 'Maximum quality with all enhancements',
      features: PipelineConfig.FULL_CREATIVE,
    },
    performance: {
      name: 'performance',
      description: 'Speed-optimized with selective features',
      features: PipelineConfig.PERFORMANCE,
    },
  };

  res.json({
    success: true,
    data: presets,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/creative/stats
 * Get pipeline statistics
 */
router.get('/creative/stats', (req, res) => {
  logger.debug('Pipeline stats requested');

  if (!defaultPipeline) {
    return res.json({
      success: true,
      data: {
        initialized: false,
        message: 'Pipeline not yet initialized',
      },
      timestamp: new Date().toISOString(),
    });
  }

  const stats = defaultPipeline.getStats();

  res.json({
    success: true,
    data: {
      initialized: true,
      cacheSize: stats.cacheSize,
      configuration: stats.config,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/creative/clear-cache
 * Clear the pipeline cache
 */
router.post('/creative/clear-cache', (req, res) => {
  logger.info('Cache clear requested');

  if (!defaultPipeline) {
    return res.json({
      success: true,
      message: 'No cache to clear (pipeline not initialized)',
      timestamp: new Date().toISOString(),
    });
  }

  const statsBefore = defaultPipeline.getStats();
  defaultPipeline.clearCache();

  logger.info('Cache cleared', { previousSize: statsBefore.cacheSize });

  res.json({
    success: true,
    message: 'Cache cleared successfully',
    previousCacheSize: statsBefore.cacheSize,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/creative/batch
 * Process multiple prompts in batch
 */
router.post(
  '/creative/batch',
  asyncHandler(async (req, res) => {
    const startTime = Date.now();

    const { prompts, config, preset, includeMetadata = true } = req.body;

    // Validate prompts array
    if (!Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prompts',
        message: 'Prompts must be a non-empty array',
        timestamp: new Date().toISOString(),
      });
    }

    if (prompts.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Too many prompts',
        message: 'Maximum 10 prompts per batch request',
        timestamp: new Date().toISOString(),
      });
    }

    logger.info('Processing batch request', { count: prompts.length });

    try {
      // Determine configuration
      let pipelineConfig = preset
        ? PipelineConfig.getPreset(preset)
        : config
        ? PipelineConfig.merge(config)
        : null;

      // Create or use pipeline
      const pipeline = pipelineConfig
        ? new CreativeDreamPipeline(pipelineConfig)
        : initializePipeline();

      // Process all prompts
      const results = [];
      for (const prompt of prompts) {
        if (typeof prompt !== 'string' || prompt.trim().length === 0) {
          results.push({
            success: false,
            error: 'Invalid prompt',
            prompt,
          });
          continue;
        }

        try {
          const result = await pipeline.process(prompt);
          results.push({
            success: true,
            data: {
              prompt: result.prompt,
              entities: result.entities,
              environment: result.environment,
              events: result.events,
              camera: result.camera,
              ...(includeMetadata && { metadata: result.metadata }),
            },
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            prompt,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;

      logger.info('Batch processing complete', {
        total: prompts.length,
        successful: successCount,
        failed: prompts.length - successCount,
        processingTime: Date.now() - startTime,
      });

      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: prompts.length,
            successful: successCount,
            failed: prompts.length - successCount,
          },
        },
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Batch processing failed', {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        error: 'Batch processing failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  })
);

module.exports = router;
