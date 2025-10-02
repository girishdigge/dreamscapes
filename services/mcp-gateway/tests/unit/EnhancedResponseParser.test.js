// services/mcp-gateway/tests/unit/EnhancedResponseParser.test.js
// Unit tests for Enhanced Response Parser

const EnhancedResponseParser = require('../../utils/EnhancedResponseParser');

describe('EnhancedResponseParser', () => {
  let parser;

  beforeEach(() => {
    parser = new EnhancedResponseParser({
      enableLogging: false, // Disable logging for tests
    });
  });

  describe('parseProviderResponse', () => {
    it('should handle string responses correctly', () => {
      const response = 'This is a test response';
      const result = parser.parseProviderResponse(
        response,
        'test',
        'generateDream'
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe('This is a test response');
      expect(result.metadata.provider).toBe('test');
      expect(result.metadata.originalFormat).toBe('string');
    });

    it('should handle null/undefined responses', () => {
      const result1 = parser.parseProviderResponse(
        null,
        'test',
        'generateDream'
      );
      const result2 = parser.parseProviderResponse(
        undefined,
        'test',
        'generateDream'
      );

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result1.error).toBeTruthy();
      expect(result2.error).toBeTruthy();
    });

    it('should handle JSON string responses', () => {
      const jsonResponse =
        '{"structures": [], "entities": [], "cinematography": {}}';
      const result = parser.parseProviderResponse(
        jsonResponse,
        'test',
        'generateDream'
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe(jsonResponse);
      expect(result.metadata.extractionMethod).toBe('direct_json');
    });
  });

  describe('parseCerebrasResponse', () => {
    it('should handle Cerebras chat completion format', () => {
      const response = {
        choices: [
          {
            message: {
              content: 'Generated dream content',
            },
          },
        ],
      };

      const result = parser.parseCerebrasResponse(response);

      expect(result.success).toBe(true);
      expect(result.data).toBe('Generated dream content');
      expect(result.format).toBe('cerebras_chat');
    });

    it('should handle Cerebras streaming format', () => {
      const response = {
        content: 'Streaming content',
      };

      const result = parser.parseCerebrasResponse(response);

      expect(result.success).toBe(true);
      expect(result.data).toBe('Streaming content');
      expect(result.format).toBe('cerebras_streaming');
    });

    it('should handle Cerebras delta format', () => {
      const response = {
        choices: [
          {
            delta: {
              content: 'Delta content',
            },
          },
        ],
      };

      const result = parser.parseCerebrasResponse(response);

      expect(result.success).toBe(true);
      expect(result.data).toBe('Delta content');
      expect(result.format).toBe('cerebras_delta');
    });

    it('should handle empty choices array', () => {
      const response = {
        choices: [],
      };

      const result = parser.parseCerebrasResponse(response);

      // Should fall back to generic parsing and stringify the object
      expect(result.success).toBe(true);
      expect(result.data).toBe('{"choices":[]}');
      expect(result.format).toBe('generic_object');
    });
  });

  describe('parseOpenAIResponse', () => {
    it('should handle OpenAI chat completion format', () => {
      const response = {
        choices: [
          {
            message: {
              content: 'OpenAI generated content',
            },
          },
        ],
      };

      const result = parser.parseOpenAIResponse(response);

      expect(result.success).toBe(true);
      expect(result.data).toBe('OpenAI generated content');
      expect(result.format).toBe('openai_chat');
    });

    it('should handle OpenAI legacy completion format', () => {
      const response = {
        choices: [
          {
            text: 'Legacy completion text',
          },
        ],
      };

      const result = parser.parseOpenAIResponse(response);

      expect(result.success).toBe(true);
      expect(result.data).toBe('Legacy completion text');
      expect(result.format).toBe('openai_completion');
    });

    it('should handle OpenAI data field format', () => {
      const response = {
        data: 'Direct data content',
      };

      const result = parser.parseOpenAIResponse(response);

      expect(result.success).toBe(true);
      expect(result.data).toBe('Direct data content');
      expect(result.format).toBe('openai_data');
    });
  });

  describe('parseGenericResponse', () => {
    it('should handle common content fields', () => {
      const testCases = [
        { field: 'content', value: 'Content value' },
        { field: 'text', value: 'Text value' },
        { field: 'output', value: 'Output value' },
        { field: 'result', value: 'Result value' },
      ];

      testCases.forEach(({ field, value }) => {
        const response = { [field]: value };
        const result = parser.parseGenericResponse(response);

        expect(result.success).toBe(true);
        expect(result.data).toBe(value);
        expect(result.format).toBe(`generic_${field}`);
      });
    });

    it('should handle nested choices format', () => {
      const response = {
        choices: [
          {
            content: 'Nested content',
          },
        ],
      };

      const result = parser.parseGenericResponse(response);

      expect(result.success).toBe(true);
      expect(result.data).toBe('Nested content');
      expect(result.format).toBe('generic_choices_content');
    });

    it('should handle complete object format', () => {
      const response = {
        structures: [],
        entities: [],
        cinematography: {},
      };

      const result = parser.parseGenericResponse(response);

      expect(result.success).toBe(true);
      expect(result.data).toBe(JSON.stringify(response));
      expect(result.format).toBe('generic_object');
    });
  });

  describe('extractContent', () => {
    it('should extract JSON content successfully', () => {
      const jsonData = '{"structures": [], "entities": []}';
      const result = parser.extractContent(jsonData, 'generateDream');

      expect(result.success).toBe(true);
      expect(result.content).toBe(jsonData);
      expect(result.method).toBe('direct_json');
    });

    it('should extract JSON block from text', () => {
      const textWithJson =
        'Here is the dream: {"structures": [], "entities": []} End of dream.';
      const result = parser.extractContent(textWithJson, 'generateDream');

      expect(result.success).toBe(true);
      expect(result.content).toBe('{"structures": [], "entities": []}');
      expect(result.method).toBe('json_block');
    });

    it('should handle non-JSON operations', () => {
      const textData = 'Simple text response';
      const result = parser.extractContent(textData, 'simpleOperation');

      expect(result.success).toBe(true);
      expect(result.content).toBe('Simple text response');
      expect(result.method).toBe('direct');
    });

    it('should handle empty data', () => {
      const result = parser.extractContent('', 'generateDream');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid string data');
    });
  });

  describe('validateContent', () => {
    it('should validate non-empty content', () => {
      const result = parser.validateContent('Valid content', 'generateDream');

      expect(result.success).toBe(true);
      expect(result.content).toBe('Valid content');
    });

    it('should reject empty content', () => {
      const result = parser.validateContent('', 'generateDream');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Content is empty');
    });

    it('should validate JSON content for dream operations', () => {
      const jsonContent = '{"structures": [], "entities": []}';
      const result = parser.validateContent(jsonContent, 'generateDream');

      expect(result.success).toBe(true);
      expect(result.content).toBe(jsonContent);
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = '{"structures": [], "entities":}';
      const result = parser.validateContent(invalidJson, 'generateDream');

      expect(result.success).toBe(true); // Should still pass with warning
      expect(result.content).toBe(invalidJson);
      expect(result.warning).toContain('JSON validation failed');
    });
  });

  describe('attemptContentRecovery', () => {
    it('should recover content from object with string fields', () => {
      const response = {
        error: 'Some error',
        data: 'Recoverable content',
        metadata: { id: 123 },
      };

      const result = parser.attemptContentRecovery(
        response,
        new Error('Test error')
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe('Recoverable content'); // Should pick the longest string
      expect(result.method).toBe('recovery_longest_string');
    });

    it('should recover direct string content', () => {
      const response = 'Direct string content';
      const result = parser.attemptContentRecovery(
        response,
        new Error('Test error')
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe('Direct string content');
      expect(result.method).toBe('recovery_direct_string');
    });

    it('should fail recovery for non-recoverable content', () => {
      const response = { number: 123, boolean: true };
      const result = parser.attemptContentRecovery(
        response,
        new Error('Test error')
      );

      expect(result.success).toBe(false);
      expect(result.method).toBe('recovery_failed');
    });
  });

  describe('error handling', () => {
    it('should handle parsing errors gracefully', () => {
      // Create a parser that will throw an error in main processing
      const testParser = new EnhancedResponseParser({ enableLogging: false });
      // Override extractContent to throw an error
      testParser.extractContent = () => {
        throw new Error('Simulated main error');
      };

      const result = testParser.parseProviderResponse(
        'test content',
        'test',
        'generateDream'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error.type).toBe('parsing_error');
      expect(result.error.recoverable).toBe(true);
    });

    it('should provide detailed metadata on errors', () => {
      // Create a parser that will throw an error in main processing to get metadata
      const testParser = new EnhancedResponseParser({ enableLogging: false });
      testParser.extractContent = () => {
        throw new Error('Simulated error for metadata test');
      };

      const result = testParser.parseProviderResponse(
        'test content',
        'test',
        'generateDream'
      );

      expect(result.success).toBe(false);
      expect(result.metadata).toBeTruthy();
      expect(result.metadata.provider).toBe('test');
      expect(result.metadata.operationType).toBe('generateDream');
      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle real Cerebras streaming response', () => {
      const realResponse = {
        content:
          '{"structures": [{"type": "building", "description": "A tall tower"}], "entities": [], "cinematography": {"lighting": "soft"}}',
        finishReason: 'stop',
        chunkCount: 5,
        processingTime: 1500,
      };

      const result = parser.parseProviderResponse(
        realResponse,
        'cerebras',
        'generateDream'
      );

      expect(result.success).toBe(true);
      expect(result.content).toContain('structures');
      expect(result.metadata.provider).toBe('cerebras');
    });

    it('should handle real OpenAI chat completion response', () => {
      const realResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content:
                '{"structures": [{"type": "castle", "description": "Medieval fortress"}], "entities": [{"name": "dragon", "type": "creature"}], "cinematography": {"mood": "epic"}}',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 56,
          completion_tokens: 31,
          total_tokens: 87,
        },
      };

      const result = parser.parseProviderResponse(
        realResponse,
        'openai',
        'generateDream'
      );

      expect(result.success).toBe(true);
      expect(result.content).toContain('structures');
      expect(result.content).toContain('castle');
      expect(result.metadata.provider).toBe('openai');
    });
  });
});
