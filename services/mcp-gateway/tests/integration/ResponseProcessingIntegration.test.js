// services/mcp-gateway/tests/integration/ResponseProcessingIntegration.test.js
// Integration tests for Response Processing Pipeline with AI services

const CerebrasService = require('../../services/cerebrasService');
const {
  generateDream,
  patchDream,
  enrichStyle,
} = require('../../services/openaiService');
const {
  processingPipeline,
  extractContentSafely,
} = require('../../utils/responseParser');

describe('Response Processing Integration', () => {
  let cerebrasService;

  beforeAll(() => {
    cerebrasService = new CerebrasService({
      apiKey: 'test-key',
    });
  });

  describe('Cerebras Service Integration', () => {
    test('should process Cerebras generateDream response through pipeline', async () => {
      const result = await cerebrasService.generateDream(
        'Create a surreal dream'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('title');
    });

    test('should process Cerebras streaming response through pipeline', async () => {
      const result = await cerebrasService.generateDreamStream(
        'Create a streaming dream'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('title');
    });

    test('should handle Cerebras service errors gracefully', async () => {
      // Test with invalid input
      await expect(cerebrasService.generateDream('')).rejects.toThrow();
      await expect(cerebrasService.generateDream(null)).rejects.toThrow();
    });
  });

  describe('OpenAI Service Integration', () => {
    test('should process OpenAI generateDream response through pipeline', async () => {
      // Mock the axios call to avoid actual API calls
      const mockAxios = require('axios');
      mockAxios.post = jest.fn().mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content:
                  '{"title": "OpenAI Dream", "description": "A test dream", "structures": []}',
              },
            },
          ],
        },
      });

      const result = await generateDream('Create an OpenAI dream');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      // Should be valid JSON
      expect(() => JSON.parse(result)).not.toThrow();

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('title', 'OpenAI Dream');
    });

    test('should process OpenAI patchDream response through pipeline', async () => {
      const mockAxios = require('axios');
      mockAxios.post = jest.fn().mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content:
                  '{"title": "Patched Dream", "modifications": ["color", "lighting"]}',
              },
            },
          ],
        },
      });

      const baseJson = { title: 'Original Dream', structures: [] };
      const result = await patchDream('Modify the dream colors', baseJson);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('title', 'Patched Dream');
    });

    test('should process OpenAI enrichStyle response through pipeline', async () => {
      const mockAxios = require('axios');
      mockAxios.post = jest.fn().mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content:
                  '{"style": "enhanced", "cinematography": {"lighting": "dramatic"}}',
              },
            },
          ],
        },
      });

      const baseJson = { title: 'Style Dream', structures: [] };
      const result = await enrichStyle('Enhance the style', baseJson);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('style', 'enhanced');
    });
  });

  describe('Response Parser Integration', () => {
    test('should extract content safely from various response formats', async () => {
      // Test string response
      const stringResult = await extractContentSafely(
        '{"title": "String Response"}',
        'test-provider',
        'generateDream'
      );
      expect(stringResult).toBe('{"title": "String Response"}');

      // Test object response
      const objectResult = await extractContentSafely(
        { choices: [{ message: { content: '{"title": "Object Response"}' } }] },
        'openai',
        'generateDream'
      );
      expect(objectResult).toBe('{"title": "Object Response"}');

      // Test nested response
      const nestedResult = await extractContentSafely(
        { data: { result: { text: '{"title": "Nested Response"}' } } },
        'complex-provider',
        'generateDream'
      );
      expect(nestedResult).toContain('Nested Response');
    });

    test('should handle malformed responses with fallback strategies', async () => {
      // Test malformed JSON
      const malformedResult = await extractContentSafely(
        '{"title": "Malformed", "description": "test",}', // Trailing comma
        'test-provider',
        'generateDream'
      );
      expect(malformedResult).toBeDefined();
      expect(malformedResult).toContain('Malformed');

      // Test partial content
      const partialResult = await extractContentSafely(
        { someField: 'This is recoverable content' },
        'test-provider',
        'generateDream'
      );
      expect(partialResult).toContain('recoverable content');
    });

    test('should return null for completely invalid responses', async () => {
      const nullResult = await extractContentSafely(null, 'test-provider');
      expect(nullResult).toBeNull();

      const undefinedResult = await extractContentSafely(
        undefined,
        'test-provider'
      );
      expect(undefinedResult).toBeNull();

      const emptyResult = await extractContentSafely('', 'test-provider');
      expect(emptyResult).toBeNull();
    });
  });

  describe('Pipeline Performance Integration', () => {
    test('should process multiple responses concurrently', async () => {
      const responses = [
        '{"title": "Concurrent Dream 1"}',
        {
          choices: [
            { message: { content: '{"title": "Concurrent Dream 2"}' } },
          ],
        },
        { content: '{"title": "Concurrent Dream 3"}' },
      ];

      const startTime = Date.now();

      const promises = responses.map((response, index) =>
        processingPipeline.processResponse(
          response,
          `provider-${index}`,
          'generateDream'
        )
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.content).toContain(`Concurrent Dream ${index + 1}`);
      });

      // Should complete in reasonable time (less than 5 seconds for 3 simple responses)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('should handle high-volume processing', async () => {
      const responses = Array.from(
        { length: 50 },
        (_, i) => `{"title": "Volume Test ${i}", "id": ${i}}`
      );

      const startTime = Date.now();

      const promises = responses.map((response, index) =>
        extractContentSafely(response, 'volume-provider', 'generateDream')
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result).toContain(`Volume Test ${index}`);
      });

      // Should complete in reasonable time (less than 10 seconds for 50 responses)
      expect(endTime - startTime).toBeLessThan(10000);

      console.log(
        `Processed ${responses.length} responses in ${endTime - startTime}ms`
      );
    });
  });

  describe('Error Recovery Integration', () => {
    test('should recover from service errors using pipeline fallbacks', async () => {
      // Simulate a service that returns malformed responses
      const malformedResponses = [
        '{"title": "Test", "invalid": }', // Invalid JSON
        { choices: [{ message: null }] }, // Null message
        { data: { result: undefined } }, // Undefined result
        'Partial text content without JSON structure but recoverable',
      ];

      for (const response of malformedResponses) {
        const result = await extractContentSafely(
          response,
          'error-provider',
          'generateDream'
        );

        // Should either succeed with recovered content or fail gracefully
        if (result !== null) {
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        }
      }
    });

    test('should maintain service functionality despite processing errors', async () => {
      // Test that services continue to work even when pipeline encounters errors
      const validResponse = '{"title": "Valid Dream", "structures": []}';

      // First, process a valid response
      const validResult = await extractContentSafely(
        validResponse,
        'test-provider',
        'generateDream'
      );
      expect(validResult).toBe(validResponse);

      // Then, process an invalid response
      const invalidResult = await extractContentSafely(
        null,
        'test-provider',
        'generateDream'
      );
      expect(invalidResult).toBeNull();

      // Finally, verify that valid responses still work
      const secondValidResult = await extractContentSafely(
        validResponse,
        'test-provider',
        'generateDream'
      );
      expect(secondValidResult).toBe(validResponse);
    });
  });

  describe('Provider-Specific Integration', () => {
    test('should handle provider-specific response formats correctly', async () => {
      // Test OpenAI format
      const openaiResponse = {
        choices: [
          {
            message: {
              content: '{"provider": "openai", "format": "chat_completion"}',
            },
          },
        ],
      };

      const openaiResult = await processingPipeline.processResponse(
        openaiResponse,
        'openai',
        'generateDream'
      );

      expect(openaiResult.success).toBe(true);
      expect(openaiResult.content).toContain('openai');
      expect(openaiResult.metadata.provider).toBe('openai');

      // Test Cerebras format
      const cerebrasResponse = {
        content: '{"provider": "cerebras", "format": "streaming"}',
      };

      const cerebrasResult = await processingPipeline.processResponse(
        cerebrasResponse,
        'cerebras',
        'generateDream'
      );

      expect(cerebrasResult.success).toBe(true);
      expect(cerebrasResult.content).toContain('cerebras');
      expect(cerebrasResult.metadata.provider).toBe('cerebras');

      // Test generic format
      const genericResponse = {
        output: '{"provider": "generic", "format": "standard"}',
      };

      const genericResult = await processingPipeline.processResponse(
        genericResponse,
        'generic-provider',
        'generateDream'
      );

      expect(genericResult.success).toBe(true);
      expect(genericResult.content).toContain('generic');
      expect(genericResult.metadata.provider).toBe('generic-provider');
    });

    test('should preserve provider context through processing stages', async () => {
      const response = '{"test": "context preservation"}';

      const result = await processingPipeline.processResponse(
        response,
        'context-provider',
        'generateDream',
        {
          userId: 'test-user',
          sessionId: 'test-session',
          customData: { important: true },
        }
      );

      expect(result.success).toBe(true);
      expect(result.metadata.provider).toBe('context-provider');
      expect(result.metadata.operationType).toBe('generateDream');
      // Context should be preserved in metadata
      expect(result.metadata.processingId).toBeDefined();
    });
  });
});
