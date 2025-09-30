// services/mcp-gateway/index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const cerebrasService = require('./services/cerebrasService');
const openaiService = require('./services/openaiService');
const promptBuilder = require('./services/promptBuilder');
const responseParser = require('./utils/responseParser');
const {
  errorHandler,
  asyncHandler,
  aiServiceErrorHandler,
} = require('./utils/errorHandler');
const { logger, requestLogger } = require('./utils/logger');

// Import enhanced validation and repair system
const { ValidationPipeline } = require('./engine');

// Import enhanced caching system
const { getCacheService } = require('./services/cacheService');
const cacheRoutes = require('./routes/cache');

// Initialize validation pipeline
const validationPipeline = new ValidationPipeline();

// Initialize cache service
let cacheService = null;
const initializeCacheService = async () => {
  try {
    cacheService = getCacheService();
    await cacheService.initialize();
    logger.info('Enhanced caching system initialized');
  } catch (error) {
    logger.warn(
      'Failed to initialize caching system, continuing without cache:',
      error.message
    );
  }
};

const app = express();
const PORT = process.env.PORT || 8080;

// Security and middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Structured request logging
app.use(requestLogger());

// Cache management routes
app.use('/cache', cacheRoutes);

// Health check
app.get('/health', (req, res) => {
  logger.debug('Health check requested');
  res.json({
    service: 'dreamscapes-mcp-gateway',
    status: 'healthy',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Validation and repair metrics endpoint
app.get('/metrics/validation', (req, res) => {
  logger.debug('Validation metrics requested');
  try {
    const metrics = validationPipeline.getComprehensiveMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get validation metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve validation metrics',
    });
  }
});

// Status (external service quick checks)
app.get(
  '/status',
  asyncHandler(async (req, res) => {
    logger.debug('Status check requested');
    const status = {
      service: 'dreamscapes-mcp-gateway',
      timestamp: new Date().toISOString(),
      services: {},
    };

    // Cerebras
    if (process.env.CEREBRAS_API_KEY) {
      try {
        await cerebrasService.testConnection();
        status.services.cerebras = { status: 'healthy' };
        logger.debug('Cerebras service check: healthy');
      } catch (err) {
        status.services.cerebras = { status: 'unhealthy', error: err.message };
        logger.warn('Cerebras service check failed', { error: err.message });
      }
    } else {
      status.services.cerebras = { status: 'not_configured' };
      logger.debug('Cerebras service: not configured');
    }

    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        await openaiService.testConnection();
        status.services.openai = { status: 'healthy' };
        logger.debug('OpenAI service check: healthy');
      } catch (err) {
        status.services.openai = { status: 'unhealthy', error: err.message };
        logger.warn('OpenAI service check failed', { error: err.message });
      }
    } else {
      status.services.openai = { status: 'not_configured' };
      logger.debug('OpenAI service: not configured');
    }

    // LLaMA stylist (optional)
    const LLAMA_URL = process.env.LLAMA_URL;
    if (LLAMA_URL) {
      try {
        const pong = await cerebrasService.pingUrl(LLAMA_URL); // small helper
        status.services.llama = { status: 'reachable', url: LLAMA_URL, pong };
        logger.debug('LLaMA service check: reachable', { url: LLAMA_URL });
      } catch (err) {
        status.services.llama = { status: 'unreachable', error: err.message };
        logger.warn('LLaMA service check failed', {
          url: LLAMA_URL,
          error: err.message,
        });
      }
    } else {
      status.services.llama = { status: 'not_configured' };
      logger.debug('LLaMA service: not configured');
    }

    res.json(status);
  })
);

// Main parse endpoint - dream text -> scene JSON
app.post(
  '/parse',
  asyncHandler(async (req, res, next) => {
    const startTime = Date.now();
    const { text, style = 'ethereal', options = {} } = req.body;

    logger.info('Dream parse request', {
      textLength: text?.length || 0,
      style,
      hasOptions: Object.keys(options).length > 0,
    });

    // Basic validation (more complex checks happen downstream)
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      logger.warn('Invalid parse request: missing or empty text');
      return res.status(400).json({
        success: false,
        error: 'Text is required',
      });
    }

    // Check cache first
    let cachedResponse = null;
    if (cacheService && cacheService.isAvailable()) {
      try {
        cachedResponse = await cacheService.getCachedDream(text, {
          style,
          ...options,
        });
        if (cachedResponse) {
          logger.info('Cache hit for dream parse', {
            textLength: text.length,
            style,
            cacheAge:
              Date.now() - (cachedResponse.cacheMetadata?.cachedAt || 0),
          });

          // Update metadata for cache hit
          cachedResponse.metadata = {
            ...cachedResponse.metadata,
            cacheHit: true,
            processingTimeMs: Date.now() - startTime,
            servedAt: new Date().toISOString(),
          };

          return res.json({
            success: true,
            data: cachedResponse,
            metadata: {
              source: cachedResponse.metadata?.source || 'cache',
              processingTimeMs: Date.now() - startTime,
              cacheHit: true,
              validation: cachedResponse.metadata?.validation,
            },
          });
        }
      } catch (cacheError) {
        logger.warn(
          'Cache lookup failed, proceeding with AI generation:',
          cacheError.message
        );
      }
    }

    // Build prompt
    const prompt = promptBuilder.buildDreamParsePrompt(text, style, options);

    let aiRaw = null;
    let source = null;

    // Try Cerebras
    if (process.env.CEREBRAS_API_KEY) {
      try {
        const cerebrasStart = Date.now();
        aiRaw = await cerebrasService.generateDream(prompt, options);
        source = 'cerebras';
        logger.logAIRequest(
          'cerebras',
          'generateDream',
          Date.now() - cerebrasStart,
          true,
          { style }
        );
      } catch (err) {
        logger.logAIRequest(
          'cerebras',
          'generateDream',
          Date.now() - startTime,
          false,
          {
            error: err.message,
            style,
          }
        );
        // Don't throw, try fallback
      }
    }

    // Fallback: OpenAI
    if (!aiRaw && process.env.OPENAI_API_KEY) {
      try {
        const openaiStart = Date.now();
        aiRaw = await openaiService.generateDream(prompt, options);
        source = 'openai';
        logger.logAIRequest(
          'openai',
          'generateDream',
          Date.now() - openaiStart,
          true,
          { style }
        );
      } catch (err) {
        logger.logAIRequest(
          'openai',
          'generateDream',
          Date.now() - startTime,
          false,
          {
            error: err.message,
            style,
          }
        );
        // Don't throw, will handle below
      }
    }

    // If still nothing, return a failure so orchestrator can fallback
    if (!aiRaw) {
      logger.error('No AI providers available for dream generation', {
        cerebrasConfigured: !!process.env.CEREBRAS_API_KEY,
        openaiConfigured: !!process.env.OPENAI_API_KEY,
      });
      return res.status(502).json({
        success: false,
        error: 'No AI providers available',
        fallback: true,
      });
    }

    // Parse AI response to scene JSON
    const parsed = responseParser.parseDreamResponse(aiRaw, source);

    if (!parsed) {
      logger.error('Failed to parse AI response', {
        source,
        responseLength: aiRaw?.length || 0,
      });
      return res.status(502).json({
        success: false,
        error: 'Failed to parse AI response',
        fallback: true,
      });
    }

    // Attach initial metadata
    parsed.metadata = {
      ...(parsed.metadata || {}),
      generatedAt: new Date().toISOString(),
      source,
      processingTimeMs: Date.now() - startTime,
      originalText: text,
      requestedStyle: style,
      options,
    };

    // Enhanced validation and repair pipeline
    let finalContent = parsed;
    let validationResult = null;
    let repairResult = null;

    try {
      const validationStart = Date.now();

      // Run validation and repair pipeline
      const pipelineResult = await validationPipeline.validateAndRepair(
        parsed,
        'dreamResponse',
        {
          originalPrompt: text,
          provider: source,
          style: style,
        }
      );

      validationResult = pipelineResult.validation;
      repairResult = pipelineResult.repair;
      finalContent = pipelineResult.finalContent;

      // Add validation metadata
      finalContent.metadata = {
        ...finalContent.metadata,
        validation: {
          valid: pipelineResult.success,
          errorsFound: validationResult?.errors?.length || 0,
          warningsFound: validationResult?.warnings?.length || 0,
          repairApplied: !!repairResult,
          repairStrategies: repairResult?.appliedStrategies?.length || 0,
          validationTime: Date.now() - validationStart,
        },
      };

      logger.info('Content validation and repair completed', {
        source,
        initiallyValid: validationResult?.valid || false,
        repairApplied: !!repairResult,
        finalValid: pipelineResult.success,
        errorsFixed: repairResult
          ? (validationResult?.errors?.length || 0) -
            (repairResult.remainingErrors?.length || 0)
          : 0,
      });
    } catch (validationError) {
      logger.error('Validation and repair pipeline failed', {
        error: validationError.message,
        source,
      });

      // Continue with original content if validation fails
      finalContent.metadata = {
        ...finalContent.metadata,
        validation: {
          valid: false,
          error: validationError.message,
          repairApplied: false,
        },
      };
    }

    const totalTime = Date.now() - startTime;

    // Cache the response if caching is available
    if (cacheService && cacheService.isAvailable()) {
      try {
        await cacheService.cacheDreamResponse(text, finalContent, {
          style,
          quality: options.quality || 'standard',
          provider: source,
          ...options,
        });
        logger.debug('Response cached successfully');
      } catch (cacheError) {
        logger.warn('Failed to cache response:', cacheError.message);
      }
    }

    logger.info('Dream parse completed', {
      source,
      processingTimeMs: totalTime,
      style,
      success: true,
      validationApplied: !!validationResult,
      repairApplied: !!repairResult,
      cached: cacheService?.isAvailable() || false,
    });

    res.json({
      success: true,
      data: finalContent,
      metadata: {
        source,
        processingTimeMs: totalTime,
        cacheHit: false,
        validation: finalContent.metadata?.validation,
      },
    });
  })
);

// Patch endpoint - modify a scene JSON with an edit instruction
app.post('/patch', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { baseJson, editText, options = {} } = req.body;

    if (!baseJson || typeof baseJson !== 'object') {
      return res
        .status(400)
        .json({ success: false, error: 'baseJson required' });
    }
    if (!editText || typeof editText !== 'string') {
      return res
        .status(400)
        .json({ success: false, error: 'editText required' });
    }

    const prompt = promptBuilder.buildPatchPrompt(baseJson, editText, options);

    let aiRaw = null;
    let source = null;

    if (process.env.CEREBRAS_API_KEY) {
      try {
        aiRaw = await cerebrasService.patchDream(prompt, baseJson, options);
        source = 'cerebras';
      } catch (err) {
        console.warn('Cerebras patch failed:', err.message);
      }
    }

    if (!aiRaw && process.env.OPENAI_API_KEY) {
      try {
        aiRaw = await openaiService.patchDream(prompt, baseJson, options);
        source = 'openai';
      } catch (err) {
        console.warn('OpenAI patch failed:', err.message);
      }
    }

    if (!aiRaw) {
      return res.status(502).json({
        success: false,
        error: 'No AI providers available for patching',
        fallback: true,
      });
    }

    const patched = responseParser.parsePatchResponse(aiRaw, baseJson, source);

    if (!patched) {
      return res.status(502).json({
        success: false,
        error: 'Failed to parse AI patch response',
        fallback: true,
      });
    }

    patched.metadata = {
      ...(patched.metadata || {}),
      patchedAt: new Date().toISOString(),
      source,
      processingTimeMs: Date.now() - startTime,
      editText,
    };

    res.json({
      success: true,
      data: patched,
      metadata: {
        source,
        processingTimeMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Style enrichment endpoint - ask AI to "enrich" or convert to a style
app.post('/style-enrich', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const { baseJson, targetStyle, options = {} } = req.body;

    if (!baseJson || typeof baseJson !== 'object') {
      return res
        .status(400)
        .json({ success: false, error: 'baseJson required' });
    }

    const style = targetStyle || baseJson.style || 'ethereal';
    const prompt = promptBuilder.buildStyleEnrichmentPrompt(
      baseJson,
      style,
      options
    );

    let aiRaw = null;
    let source = null;

    if (process.env.CEREBRAS_API_KEY) {
      try {
        aiRaw = await cerebrasService.enrichStyle(prompt, baseJson, options);
        source = 'cerebras';
      } catch (err) {
        console.warn('Cerebras style enrich failed:', err.message);
      }
    }

    if (!aiRaw && process.env.OPENAI_API_KEY) {
      try {
        aiRaw = await openaiService.enrichStyle(prompt, baseJson, options);
        source = 'openai';
      } catch (err) {
        console.warn('OpenAI style enrich failed:', err.message);
      }
    }

    if (!aiRaw) {
      return res.status(502).json({
        success: false,
        error: 'No AI providers available for style enrichment',
        fallback: true,
      });
    }

    const enriched = responseParser.parseStyleResponse(aiRaw, baseJson, source);

    if (!enriched) {
      return res.status(502).json({
        success: false,
        error: 'Failed to parse style enrichment response',
        fallback: true,
      });
    }

    enriched.metadata = {
      ...(enriched.metadata || {}),
      enrichedAt: new Date().toISOString(),
      source,
      processingTimeMs: Date.now() - startTime,
      targetStyle: style,
    };

    res.json({
      success: true,
      data: enriched,
      metadata: {
        source,
        processingTimeMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Fallback 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available: ['/parse', '/patch', '/style-enrich', '/health', '/status'],
  });
});

// Error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (cacheService) {
    await cacheService.cleanup();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (cacheService) {
    await cacheService.cleanup();
  }
  process.exit(0);
});

// Unhandled error logging
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

app.listen(PORT, async () => {
  logger.info('🌐 MCP Gateway started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    cerebrasConfigured: !!process.env.CEREBRAS_API_KEY,
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    llamaUrl: process.env.LLAMA_URL || 'not configured',
  });

  // Initialize cache service after server starts
  await initializeCacheService();
});
