// tests/unit/CerebrasService.simple.test.js
// Simplified unit tests for CerebrasService class

// Mock the Cerebras SDK
jest.mock('@cerebras/cerebras_cloud_sdk', () => {
  return {
    Cerebras: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'Mock Dream',
                    description: 'Test dream description',
                    scenes: [
                      {
                        type: 'environment',
                        description: 'A peaceful garden',
                        mood: 'serene',
                      },
                    ],
                    style: 'ethereal',
                  }),
                },
              },
            ],
          }),
        },
      },
    })),
  };
});

const CerebrasService = require('../../services/CerebrasService');

describe('CerebrasService - Basic Functionality', () => {
  let cerebrasService;

  beforeEach(() => {
    cerebrasService = new CerebrasService({
      apiKey: 'test-api-key',
      model: 'llama-4-maverick-17b-128e-instruct',
      temperature: 0.6,
    });
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(cerebrasService).toBeDefined();
      expect(cerebrasService.config).toBeDefined();
    });

    test('should throw error without API key', () => {
      expect(() => {
        new CerebrasService({});
      }).toThrow();
    });
  });

  describe('Dream Generation', () => {
    test('should generate dream successfully', async () => {
      const prompt = 'I dreamed of a peaceful garden';
      const options = { style: 'ethereal' };

      const result = await cerebrasService.generateDream(prompt, options);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Mock Dream');
    });

    test('should handle basic options', async () => {
      const prompt = 'Test dream';
      const options = {
        style: 'surreal',
        temperature: 0.8,
      };

      const result = await cerebrasService.generateDream(prompt, options);
      expect(result).toBeDefined();
    });
  });

  describe('Configuration', () => {
    test('should get current configuration', () => {
      const config = cerebrasService.getConfig();
      expect(config).toBeDefined();
      expect(config.apiKey).toBe('test-api-key');
    });
  });

  describe('Error Handling', () => {
    test('should handle empty prompt', async () => {
      const result = await cerebrasService.generateDream('', {});
      expect(result).toBeDefined();
    });

    test('should handle null options', async () => {
      const result = await cerebrasService.generateDream('test', null);
      expect(result).toBeDefined();
    });
  });
});
