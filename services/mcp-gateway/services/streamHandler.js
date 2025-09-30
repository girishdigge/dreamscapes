// services/mcp-gateway/services/streamHandler.js
// Stream processing utilities for real-time AI response handling

const EventEmitter = require('events');

class StreamHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      chunkSize: options.chunkSize || 1024,
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      ...options,
    };
    this.buffer = '';
    this.isComplete = false;
    this.error = null;
    this.retryCount = 0;
  }

  async processStream(stream, onChunk, onComplete, onError) {
    try {
      let fullContent = '';
      let currentChunk = '';

      for await (const chunk of stream) {
        try {
          // Handle different chunk formats from Cerebras SDK
          const content = this.extractContentFromChunk(chunk);

          if (content) {
            currentChunk += content;
            fullContent += content;

            // Emit chunk for real-time processing
            if (onChunk) {
              await onChunk({
                content: currentChunk,
                fullContent: fullContent,
                chunk: chunk,
                timestamp: Date.now(),
              });
            }

            this.emit('chunk', {
              content: currentChunk,
              fullContent: fullContent,
              chunk: chunk,
            });
          }

          // Check if stream is complete
          if (
            chunk.choices &&
            chunk.choices[0] &&
            chunk.choices[0].finish_reason
          ) {
            this.isComplete = true;

            if (onComplete) {
              await onComplete({
                fullContent: fullContent,
                finishReason: chunk.choices[0].finish_reason,
                usage: chunk.usage,
                timestamp: Date.now(),
              });
            }

            this.emit('complete', {
              fullContent: fullContent,
              finishReason: chunk.choices[0].finish_reason,
              usage: chunk.usage,
            });

            break;
          }
        } catch (chunkError) {
          console.error('Error processing chunk:', chunkError);
          this.emit('chunkError', chunkError);

          if (this.retryCount < this.options.maxRetries) {
            this.retryCount++;
            await this.delay(this.options.retryDelay * this.retryCount);
            continue;
          } else {
            throw chunkError;
          }
        }
      }

      return fullContent;
    } catch (error) {
      this.error = error;

      if (onError) {
        await onError(error);
      }

      this.emit('error', error);
      throw error;
    }
  }

  extractContentFromChunk(chunk) {
    try {
      // Handle different response formats from Cerebras
      if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
        return chunk.choices[0].delta.content || '';
      }

      if (chunk.choices && chunk.choices[0] && chunk.choices[0].message) {
        return chunk.choices[0].message.content || '';
      }

      // Fallback for raw content
      if (typeof chunk === 'string') {
        return chunk;
      }

      return '';
    } catch (error) {
      console.error('Error extracting content from chunk:', error);
      return '';
    }
  }

  async processStreamWithTimeout(stream, handlers = {}) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(`Stream processing timeout after ${this.options.timeout}ms`)
        );
      }, this.options.timeout);

      this.processStream(
        stream,
        handlers.onChunk,
        (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      ).catch(reject);
    });
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  reset() {
    this.buffer = '';
    this.isComplete = false;
    this.error = null;
    this.retryCount = 0;
  }

  getStatus() {
    return {
      isComplete: this.isComplete,
      hasError: !!this.error,
      error: this.error,
      retryCount: this.retryCount,
      bufferSize: this.buffer.length,
    };
  }
}

// Utility functions for stream handling
function createStreamResponse(res, options = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    ...options.headers,
  });

  return {
    write: (data) => {
      try {
        const chunk = typeof data === 'string' ? data : JSON.stringify(data);
        res.write(chunk + '\n');
      } catch (error) {
        console.error('Error writing stream chunk:', error);
      }
    },
    end: (data) => {
      try {
        if (data) {
          const chunk = typeof data === 'string' ? data : JSON.stringify(data);
          res.write(chunk + '\n');
        }
        res.end();
      } catch (error) {
        console.error('Error ending stream:', error);
        res.end();
      }
    },
    error: (error) => {
      try {
        res.write(`ERROR: ${error.message}\n`);
        res.end();
      } catch (writeError) {
        console.error('Error writing stream error:', writeError);
        res.end();
      }
    },
  };
}

function createSSEResponse(res, options = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    ...options.headers,
  });

  return {
    send: (event, data, id) => {
      try {
        if (id) res.write(`id: ${id}\n`);
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (error) {
        console.error('Error sending SSE event:', error);
      }
    },
    close: () => {
      try {
        res.write('event: close\n');
        res.write('data: {}\n\n');
        res.end();
      } catch (error) {
        console.error('Error closing SSE stream:', error);
        res.end();
      }
    },
    error: (error) => {
      try {
        res.write('event: error\n');
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      } catch (writeError) {
        console.error('Error sending SSE error:', writeError);
        res.end();
      }
    },
  };
}

module.exports = {
  StreamHandler,
  createStreamResponse,
  createSSEResponse,
};
