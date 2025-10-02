// routes/streaming.js
// API endpoints for streaming dream generation

const express = require('express');
const { logger } = require('../utils/logger');
const promptBuilder = require('../services/promptBuilder');
const responseParser = require('../utils/responseParser');
const { ValidationPipeline } = require('../engine');

const router = express.Router();
const validationPipeline = new ValidationPipeline();

// Streaming dream generation endpoint
router.post('/parse', async (req, res) => {
  const startTime = Date.now();
  const { text, style = 'ethereal', options = {} } = req.body;

  logger.info('Streaming dream parse request', {
    textLength: text?.length || 0,
    style,
    hasOptions: Object.keys(options).length > 0,
  });

  // Basic validation
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    logger.warn('Invalid streaming parse request: missing or empty text');
    return res.status(400).json({
      success: false,
      error: 'Text is required',
    });
  }

  const providerManager = req.app.locals.providerManager;

  if (!providerManager) {
    return res.status(503).json({
      success: false,
      error: 'ProviderManager not available',
      message: 'Streaming requires ProviderManager',
    });
  }

  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Helper function to send SSE data
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial connection confirmation
  sendEvent('connected', {
    message: 'Streaming connection established',
    timestamp: new Date().toISOString(),
  });

  try {
    // Build prompt
    const prompt = promptBuilder.buildDreamParsePrompt(text, style, options);

    sendEvent('prompt_built', {
      message: 'Prompt constructed',
      style,
      timestamp: new Date().toISOString(),
    });

    // Use ProviderManager with streaming support
    const result = await providerManager.executeWithFallback(
      async (provider, providerName, context) => {
        sendEvent('provider_selected', {
          provider: providerName,
          attempt: context.attemptNumber || 1,
          timestamp: new Date().toISOString(),
        });

        logger.info(
          `Streaming dream generation with provider: ${providerName}`,
          {
            style,
            textLength: text.length,
            attempt: context.attemptNumber || 1,
          }
        );

        const providerStart = Date.now();

        // Check if provider supports streaming
        if (provider.generateDreamStream && options.streaming !== false) {
          sendEvent('streaming_started', {
            provider: providerName,
            message: 'Starting streaming generation',
            timestamp: new Date().toISOString(),
          });

          let accumulatedContent = '';
          let chunkCount = 0;

          const streamResponse = await provider.generateDreamStream(prompt, {
            ...options,
            context: context,
            onChunk: (chunk) => {
              chunkCount++;
              accumulatedContent += chunk;

              sendEvent('content_chunk', {
                chunk,
                chunkNumber: chunkCount,
                accumulatedLength: accumulatedContent.length,
                timestamp: new Date().toISOString(),
              });
            },
            onProgress: (progress) => {
              sendEvent('progress', {
                progress,
                timestamp: new Date().toISOString(),
              });
            },
          });

          const responseTime = Date.now() - providerStart;

          sendEvent('streaming_complete', {
            provider: providerName,
            totalChunks: chunkCount,
            responseTime,
            timestamp: new Date().toISOString(),
          });

          return {
            content: streamResponse,
            provider: providerName,
            responseTime,
            context,
            streaming: true,
            chunks: chunkCount,
          };
        } else {
          // Fallback to non-streaming generation
          sendEvent('generation_started', {
            provider: providerName,
            message: 'Starting non-streaming generation',
            timestamp: new Date().toISOString(),
          });

          const response = await provider.generateDream(prompt, {
            ...options,
            context: context,
          });

          const responseTime = Date.now() - providerStart;

          sendEvent('generation_complete', {
            provider: providerName,
            responseTime,
            timestamp: new Date().toISOString(),
          });

          return {
            content: response,
            provider: providerName,
            responseTime,
            context,
            streaming: false,
          };
        }
      },
      null, // Use automatic provider selection
      {
        maxAttempts: 3,
        timeout: options.timeout || 45000, // Longer timeout for streaming
        preserveContext: true,
        operationType: 'generateDreamStream',
        streaming: true,
        context: {
          originalText: text,
          style,
          options,
        },
      }
    );

    sendEvent('ai_generation_complete', {
      provider: result.provider,
      responseTime: result.responseTime,
      streaming: result.streaming,
      chunks: result.chunks || 0,
      timestamp: new Date().toISOString(),
    });

    // Parse AI response
    sendEvent('parsing_started', {
      message: 'Parsing AI response to scene JSON',
      timestamp: new Date().toISOString(),
    });

    const parsed = responseParser.parseDreamResponse(
      result.content,
      result.provider
    );

    if (!parsed) {
      sendEvent('error', {
        error: 'Failed to parse AI response',
        provider: result.provider,
        timestamp: new Date().toISOString(),
      });
      res.end();
      return;
    }

    sendEvent('parsing_complete', {
      message: 'AI response parsed successfully',
      timestamp: new Date().toISOString(),
    });

    // Enhanced validation and repair
    sendEvent('validation_started', {
      message: 'Starting content validation and repair',
      timestamp: new Date().toISOString(),
    });

    let finalContent = parsed;
    try {
      const pipelineResult = await validationPipeline.validateAndRepair(
        parsed,
        'dreamResponse',
        {
          originalPrompt: text,
          provider: result.provider,
          style: style,
        }
      );

      finalContent = pipelineResult.finalContent;

      sendEvent('validation_complete', {
        valid: pipelineResult.success,
        errorsFound: pipelineResult.validation?.errors?.length || 0,
        repairApplied: !!pipelineResult.repair,
        timestamp: new Date().toISOString(),
      });
    } catch (validationError) {
      sendEvent('validation_error', {
        error: validationError.message,
        timestamp: new Date().toISOString(),
      });
    }

    // Attach metadata
    finalContent.metadata = {
      ...(finalContent.metadata || {}),
      generatedAt: new Date().toISOString(),
      source: result.provider,
      processingTimeMs: Date.now() - startTime,
      originalText: text,
      requestedStyle: style,
      options,
      streaming: {
        enabled: result.streaming,
        chunks: result.chunks || 0,
        provider: result.provider,
      },
      provider: {
        name: result.provider,
        responseTime: result.responseTime,
        attempts: result.context?.attemptNumber || 1,
        managedByProviderManager: true,
        contextPreserved: result.context?.previousProvider ? true : false,
      },
    };

    // Send final result
    sendEvent('complete', {
      success: true,
      data: finalContent,
      metadata: {
        source: result.provider,
        processingTimeMs: Date.now() - startTime,
        streaming: result.streaming,
        chunks: result.chunks || 0,
      },
      timestamp: new Date().toISOString(),
    });

    logger.info('Streaming dream generation completed', {
      provider: result.provider,
      processingTimeMs: Date.now() - startTime,
      streaming: result.streaming,
      chunks: result.chunks || 0,
    });
  } catch (error) {
    logger.error('Streaming dream generation failed:', error.message);

    sendEvent('error', {
      error: 'Dream generation failed',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Close the connection
  res.end();
});

// Streaming patch endpoint
router.post('/patch', async (req, res) => {
  const startTime = Date.now();
  const { baseJson, editText, options = {} } = req.body;

  if (!baseJson || typeof baseJson !== 'object') {
    return res.status(400).json({ success: false, error: 'baseJson required' });
  }
  if (!editText || typeof editText !== 'string') {
    return res.status(400).json({ success: false, error: 'editText required' });
  }

  const providerManager = req.app.locals.providerManager;

  if (!providerManager) {
    return res.status(503).json({
      success: false,
      error: 'ProviderManager not available',
    });
  }

  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent('connected', {
    message: 'Streaming patch connection established',
    timestamp: new Date().toISOString(),
  });

  try {
    const prompt = promptBuilder.buildPatchPrompt(baseJson, editText, options);

    sendEvent('prompt_built', {
      message: 'Patch prompt constructed',
      timestamp: new Date().toISOString(),
    });

    const result = await providerManager.executeWithFallback(
      async (provider, providerName, context) => {
        sendEvent('provider_selected', {
          provider: providerName,
          attempt: context.attemptNumber || 1,
          timestamp: new Date().toISOString(),
        });

        const providerStart = Date.now();

        // Check if provider supports streaming patches
        if (provider.patchDreamStream && options.streaming !== false) {
          sendEvent('streaming_started', {
            provider: providerName,
            message: 'Starting streaming patch',
            timestamp: new Date().toISOString(),
          });

          const streamResponse = await provider.patchDreamStream(
            prompt,
            baseJson,
            {
              ...options,
              context: context,
              onChunk: (chunk) => {
                sendEvent('content_chunk', {
                  chunk,
                  timestamp: new Date().toISOString(),
                });
              },
            }
          );

          const responseTime = Date.now() - providerStart;

          sendEvent('streaming_complete', {
            provider: providerName,
            responseTime,
            timestamp: new Date().toISOString(),
          });

          return {
            content: streamResponse,
            provider: providerName,
            responseTime,
            context,
            streaming: true,
          };
        } else {
          // Fallback to non-streaming
          sendEvent('generation_started', {
            provider: providerName,
            message: 'Starting non-streaming patch',
            timestamp: new Date().toISOString(),
          });

          const response = await provider.patchDream(prompt, baseJson, {
            ...options,
            context: context,
          });

          const responseTime = Date.now() - providerStart;

          return {
            content: response,
            provider: providerName,
            responseTime,
            context,
            streaming: false,
          };
        }
      },
      null,
      {
        maxAttempts: 3,
        timeout: options.timeout || 30000,
        preserveContext: true,
        operationType: 'patchDreamStream',
        context: {
          baseJson,
          editText,
          options,
        },
      }
    );

    const patched = responseParser.parsePatchResponse(
      result.content,
      baseJson,
      result.provider
    );

    if (!patched) {
      sendEvent('error', {
        error: 'Failed to parse patch response',
        timestamp: new Date().toISOString(),
      });
      res.end();
      return;
    }

    patched.metadata = {
      ...(patched.metadata || {}),
      patchedAt: new Date().toISOString(),
      source: result.provider,
      processingTimeMs: Date.now() - startTime,
      editText,
      streaming: {
        enabled: result.streaming,
        provider: result.provider,
      },
    };

    sendEvent('complete', {
      success: true,
      data: patched,
      metadata: {
        source: result.provider,
        processingTimeMs: Date.now() - startTime,
        streaming: result.streaming,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Streaming patch failed:', error.message);

    sendEvent('error', {
      error: 'Patch operation failed',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  res.end();
});

module.exports = router;
