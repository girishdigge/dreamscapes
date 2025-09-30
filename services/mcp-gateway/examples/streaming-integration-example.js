// Example of how to integrate streaming functionality into MCP Gateway endpoints
// This shows how to use the new streaming capabilities in API routes

const express = require('express');
const cerebrasService = require('../services/cerebrasService');

const router = express.Router();

// Example streaming endpoint for dream generation
router.post('/dream/stream', async (req, res) => {
  try {
    const { prompt, options = {} } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Set up Server-Sent Events for streaming response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    let chunkCount = 0;
    let startTime = Date.now();

    try {
      const result = await cerebrasService.generateDreamStream(
        prompt,
        {
          ...options,
          stream: true,
          maxTokens: options.maxTokens || 2048,
          temperature: options.temperature || 0.7,
        },
        // onChunk callback - send each chunk to client
        async (chunkData) => {
          chunkCount++;
          const eventData = {
            type: 'chunk',
            data: {
              content: chunkData.content,
              chunkIndex: chunkData.chunkIndex,
              timestamp: chunkData.timestamp,
              isComplete: false,
            },
          };

          res.write(`data: ${JSON.stringify(eventData)}\n\n`);
        },
        // onComplete callback - send final result
        async (completeData) => {
          const eventData = {
            type: 'complete',
            data: {
              content: completeData.content,
              finishReason: completeData.finishReason,
              chunkCount: completeData.chunkCount,
              processingTime: completeData.processingTime,
              usage: completeData.usage,
              model: completeData.model,
              isComplete: true,
            },
          };

          res.write(`data: ${JSON.stringify(eventData)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        },
        // onError callback - handle streaming errors
        async (errorData) => {
          const eventData = {
            type: 'error',
            data: {
              error: errorData.message,
              chunkCount: chunkCount,
              partialContent: errorData.partialContent || '',
              processingTime: Date.now() - startTime,
            },
          };

          res.write(`data: ${JSON.stringify(eventData)}\n\n`);
          res.end();
        }
      );
    } catch (error) {
      const errorInfo = cerebrasService.handleStreamingError(error, {
        endpoint: '/dream/stream',
        prompt: prompt.substring(0, 100),
      });

      const eventData = {
        type: 'error',
        data: {
          error: errorInfo.message,
          errorType: errorInfo.type,
          recoverable: errorInfo.recoverable,
          suggestion: errorInfo.suggestion,
          processingTime: Date.now() - startTime,
        },
      };

      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('Streaming endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Example endpoint for testing streaming connection
router.get('/stream/health', async (req, res) => {
  try {
    const healthCheck = await cerebrasService.testStreamingConnection();

    res.json({
      streaming: healthCheck.success,
      responseTime: healthCheck.responseTime,
      chunkCount: healthCheck.chunkCount,
      contentLength: healthCheck.contentLength,
      model: healthCheck.model,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorInfo = cerebrasService.handleStreamingError(error, {
      endpoint: '/stream/health',
    });

    res.status(500).json({
      streaming: false,
      error: errorInfo.message,
      errorType: errorInfo.type,
      recoverable: errorInfo.recoverable,
      suggestion: errorInfo.suggestion,
      timestamp: new Date().toISOString(),
    });
  }
});

// Example endpoint for streaming with timeout control
router.post('/dream/stream-timeout', async (req, res) => {
  try {
    const { prompt, timeout = 30000, options = {} } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const startTime = Date.now();

    const result = await cerebrasService.generateDreamStreamWithTimeout(
      prompt,
      {
        ...options,
        timeout: timeout,
        maxTokens: options.maxTokens || 2048,
        temperature: options.temperature || 0.7,
      }
    );

    res.json({
      success: true,
      content: result.content,
      chunkCount: result.totalChunks,
      processingTime: result.processingTime,
      averageChunkSize: result.averageChunkSize,
      finishReason: result.finishReason,
      usage: result.usage,
      model: result.model,
      timeout: timeout,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorInfo = cerebrasService.handleStreamingError(error, {
      endpoint: '/dream/stream-timeout',
      timeout: req.body.timeout,
    });

    res.status(500).json({
      success: false,
      error: errorInfo.message,
      errorType: errorInfo.type,
      recoverable: errorInfo.recoverable,
      suggestion: errorInfo.suggestion,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;

// Usage example in main app:
// const streamingRoutes = require('./examples/streaming-integration-example');
// app.use('/api/v1', streamingRoutes);
