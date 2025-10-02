// tests/unit/PromptEngine.test.js
// Unit tests for PromptEngine class

const PromptEngine = require('../../engine/PromptEngine');
const VideoPromptEngine = require('../../engine/VideoPromptEngine');

describe('PromptEngine', () => {
  let promptEngine;

  beforeEach(() => {
    const config = {
      templates: {
        basePath: './templates',
        enableCaching: true,
        enableOptimization: true,
      },
      optimization: {
        enableAnalytics: true,
        enableABTesting: true,
        qualityThreshold: 0.8,
      },
    };

    promptEngine = new PromptEngine(config);
  });

  describe('Dream Prompt Generation', () => {
    test('should build basic dream prompt', async () => {
      const text = 'I dreamed of a peaceful garden';
      const style = 'ethereal';
      const context = {};

      const prompt = await promptEngine.buildDreamPrompt(text, style, context);

      expect(prompt).toContain(text);
      expect(prompt).toContain('ethereal');
      expect(prompt).toContain('JSON');
      expect(prompt.length).toBeGreaterThan(100);
    });

    test('should include style-specific guidance', async () => {
      const text = 'I dreamed of a city';
      const styles = ['ethereal', 'cyberpunk', 'surreal', 'cinematic'];

      for (const style of styles) {
        const prompt = await promptEngine.buildDreamPrompt(text, style, {});
        expect(prompt.toLowerCase()).toContain(style.toLowerCase());
      }
    });

    test('should handle complex dream descriptions', () => {
      const complexText = `I dreamed I was walking through a vast library where books flew like birds, 
        their pages rustling in the wind. The shelves stretched infinitely upward, and words fell like rain, 
        forming puddles of stories on the marble floor.`;

      const prompt = promptEngine.buildDreamPrompt(complexText, 'surreal', {});

      expect(prompt).toContain('library');
      expect(prompt).toContain('books');
      expect(prompt).toContain('surreal');
      expect(prompt).toMatch(/scene|environment|atmosphere/i);
    });

    test('should include context when provided', () => {
      const text = 'I dreamed of a forest';
      const context = {
        previousDreams: ['garden', 'ocean'],
        userPreferences: { mood: 'peaceful', lighting: 'soft' },
        sessionContext: { theme: 'nature' },
      };

      const prompt = promptEngine.buildDreamPrompt(text, 'ethereal', context);

      expect(prompt).toContain('peaceful');
      expect(prompt).toContain('nature');
      expect(prompt.length).toBeGreaterThan(200);
    });

    test('should handle empty or minimal input', () => {
      const text = 'dream';
      const prompt = promptEngine.buildDreamPrompt(text, 'ethereal', {});

      expect(prompt).toContain(text);
      expect(prompt).toContain('ethereal');
      expect(prompt.length).toBeGreaterThan(50);
    });
  });

  describe('Video Prompt Generation', () => {
    test('should build video generation prompt', () => {
      const sceneData = {
        title: 'Peaceful Garden',
        scenes: [
          {
            type: 'environment',
            description: 'A serene garden with flowing water',
            mood: 'peaceful',
            lighting: 'soft golden hour',
          },
        ],
        style: 'ethereal',
      };

      const prompt = promptEngine.buildVideoPrompt(sceneData, 'high');

      expect(prompt).toContain('video');
      expect(prompt).toContain('garden');
      expect(prompt).toContain('peaceful');
      expect(prompt).toContain('cinematography');
    });

    test('should include quality-specific parameters', () => {
      const sceneData = {
        title: 'Test Scene',
        scenes: [{ type: 'test', description: 'test scene' }],
      };

      const qualities = ['draft', 'standard', 'high', 'cinematic'];

      qualities.forEach((quality) => {
        const prompt = promptEngine.buildVideoPrompt(sceneData, quality);
        expect(prompt.toLowerCase()).toContain(quality);
      });
    });

    test('should handle complex scene structures', () => {
      const complexScene = {
        title: 'Epic Journey',
        scenes: [
          {
            type: 'environment',
            description: 'Mountain landscape',
            mood: 'adventurous',
            lighting: 'dramatic sunset',
            camera: { angle: 'wide', movement: 'pan' },
          },
          {
            type: 'character',
            description: 'Lone traveler',
            mood: 'determined',
            lighting: 'backlit',
            camera: { angle: 'medium', movement: 'follow' },
          },
        ],
        transitions: [{ type: 'fade', duration: 2 }],
        style: 'cinematic',
      };

      const prompt = promptEngine.buildVideoPrompt(complexScene, 'cinematic');

      expect(prompt).toContain('mountain');
      expect(prompt).toContain('traveler');
      expect(prompt).toContain('fade');
      expect(prompt).toContain('cinematic');
    });
  });

  describe('Refinement Prompts', () => {
    test('should build refinement prompt', () => {
      const content = {
        title: 'Garden Dream',
        scenes: [{ type: 'garden', mood: 'peaceful' }],
      };
      const feedback = 'Make it more colorful and add flowers';

      const prompt = promptEngine.buildRefinementPrompt(content, feedback);

      expect(prompt).toContain('colorful');
      expect(prompt).toContain('flowers');
      expect(prompt).toContain('Garden Dream');
      expect(prompt).toContain('refine');
    });

    test('should handle multiple feedback points', () => {
      const content = { title: 'Test Dream' };
      const feedback = [
        'Add more detail to the environment',
        'Improve the lighting',
        'Make the mood more mysterious',
      ];

      const prompt = promptEngine.buildRefinementPrompt(content, feedback);

      expect(prompt).toContain('detail');
      expect(prompt).toContain('lighting');
      expect(prompt).toContain('mysterious');
    });

    test('should preserve original content structure', () => {
      const originalContent = {
        title: 'Original Title',
        scenes: [
          { id: 1, type: 'forest' },
          { id: 2, type: 'river' },
        ],
        metadata: { source: 'test' },
      };
      const feedback = 'Minor adjustments';

      const prompt = promptEngine.buildRefinementPrompt(
        originalContent,
        feedback
      );

      expect(prompt).toContain('Original Title');
      expect(prompt).toContain('forest');
      expect(prompt).toContain('river');
    });
  });

  describe('Template Management', () => {
    test('should get template by type and style', () => {
      const template = promptEngine.getTemplate('dream', 'ethereal');

      expect(template).toBeTruthy();
      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(0);
    });

    test('should fallback to base template when style not found', () => {
      const template = promptEngine.getTemplate('dream', 'nonexistent_style');

      expect(template).toBeTruthy();
      expect(typeof template).toBe('string');
    });

    test('should cache templates for performance', () => {
      const template1 = promptEngine.getTemplate('dream', 'ethereal');
      const template2 = promptEngine.getTemplate('dream', 'ethereal');

      // Should be the same reference (cached)
      expect(template1).toBe(template2);
    });

    test('should validate template structure', () => {
      const validTemplate = promptEngine.getTemplate('dream', 'ethereal');

      expect(validTemplate).toContain('{text}');
      expect(validTemplate).toContain('{style}');
    });
  });

  describe('Context-Aware Generation', () => {
    test('should adapt prompts based on provider capabilities', () => {
      const text = 'I dreamed of a castle';
      const context = {
        provider: 'cerebras',
        model: 'llama-4-maverick-17b',
        capabilities: {
          maxTokens: 32768,
          supportsStreaming: true,
          supportsSystemPrompts: true,
        },
      };

      const prompt = promptEngine.buildDreamPrompt(text, 'ethereal', context);

      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain('castle');
    });

    test('should adjust for different model capabilities', () => {
      const text = 'I dreamed of a spaceship';

      const cerebrasContext = {
        provider: 'cerebras',
        model: 'llama-4-maverick-17b',
        capabilities: { maxTokens: 32768 },
      };

      const openaiContext = {
        provider: 'openai',
        model: 'gpt-4',
        capabilities: { maxTokens: 4000 },
      };

      const cerebrasPrompt = promptEngine.buildDreamPrompt(
        text,
        'cyberpunk',
        cerebrasContext
      );
      const openaiPrompt = promptEngine.buildDreamPrompt(
        text,
        'cyberpunk',
        openaiContext
      );

      // Cerebras prompt can be longer due to higher token limit
      expect(cerebrasPrompt.length).toBeGreaterThanOrEqual(openaiPrompt.length);
    });

    test('should include session context', () => {
      const text = 'I dreamed of water';
      const context = {
        sessionContext: {
          previousThemes: ['nature', 'tranquility'],
          userMood: 'contemplative',
          timeOfDay: 'evening',
        },
      };

      const prompt = promptEngine.buildDreamPrompt(text, 'ethereal', context);

      expect(prompt).toContain('nature');
      expect(prompt).toContain('contemplative');
    });
  });

  describe('Prompt Optimization', () => {
    test('should optimize prompts based on performance data', () => {
      const text = 'I dreamed of a mountain';
      const performanceData = {
        ethereal: { averageQuality: 0.9, responseTime: 2000 },
        cinematic: { averageQuality: 0.7, responseTime: 3000 },
      };

      promptEngine.updatePerformanceData(performanceData);

      const prompt = promptEngine.buildOptimizedPrompt(text, 'ethereal');

      expect(prompt).toContain('mountain');
      expect(prompt).toContain('ethereal');
    });

    test('should A/B test different prompt variations', () => {
      const text = 'I dreamed of a forest';

      const variation1 = promptEngine.buildDreamPrompt(text, 'ethereal', {
        variation: 'A',
      });
      const variation2 = promptEngine.buildDreamPrompt(text, 'ethereal', {
        variation: 'B',
      });

      expect(variation1).not.toBe(variation2);
      expect(variation1).toContain('forest');
      expect(variation2).toContain('forest');
    });

    test('should track prompt performance', () => {
      const promptId = 'test-prompt-123';
      const metrics = {
        quality: 0.85,
        responseTime: 1500,
        userSatisfaction: 0.9,
      };

      promptEngine.recordPromptPerformance(promptId, metrics);

      const performance = promptEngine.getPromptPerformance(promptId);
      expect(performance.quality).toBe(0.85);
      expect(performance.responseTime).toBe(1500);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing template gracefully', () => {
      const template = promptEngine.getTemplate('nonexistent', 'style');

      expect(template).toBeTruthy();
      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(0);
    });

    test('should handle malformed context data', () => {
      const text = 'I dreamed of a lake';
      const malformedContext = {
        previousDreams: 'not-an-array',
        userPreferences: null,
        sessionContext: 'invalid',
      };

      expect(() => {
        promptEngine.buildDreamPrompt(text, 'ethereal', malformedContext);
      }).not.toThrow();
    });

    test('should handle empty or null inputs', () => {
      expect(() => {
        promptEngine.buildDreamPrompt('', 'ethereal', {});
      }).not.toThrow();

      expect(() => {
        promptEngine.buildDreamPrompt(null, 'ethereal', {});
      }).not.toThrow();

      expect(() => {
        promptEngine.buildDreamPrompt('test', '', {});
      }).not.toThrow();
    });

    test('should validate prompt length limits', () => {
      const veryLongText = 'I dreamed of '.repeat(1000) + 'a garden';
      const context = { provider: 'openai', capabilities: { maxTokens: 1000 } };

      const prompt = promptEngine.buildDreamPrompt(
        veryLongText,
        'ethereal',
        context
      );

      // Should be truncated to fit within limits
      expect(prompt.length).toBeLessThan(4000); // Rough token limit
    });
  });

  describe('Performance', () => {
    test('should generate prompts efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        promptEngine.buildDreamPrompt(`Dream ${i}`, 'ethereal', {});
      }

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should cache template compilation', () => {
      const template = 'ethereal';

      const startTime1 = Date.now();
      promptEngine.getTemplate('dream', template);
      const firstTime = Date.now() - startTime1;

      const startTime2 = Date.now();
      promptEngine.getTemplate('dream', template);
      const secondTime = Date.now() - startTime2;

      // Second call should be faster (cached)
      expect(secondTime).toBeLessThanOrEqual(firstTime);
    });

    test('should handle concurrent prompt generation', async () => {
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve(
            promptEngine.buildDreamPrompt(`Dream ${i}`, 'ethereal', {})
          )
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      expect(results.every((r) => typeof r === 'string')).toBe(true);
      expect(results.every((r) => r.length > 0)).toBe(true);
    });
  });

  describe('Integration with VideoPromptEngine', () => {
    test('should work with VideoPromptEngine for cinematography', () => {
      const sceneData = {
        title: 'Ocean Sunset',
        scenes: [
          {
            type: 'environment',
            description: 'Vast ocean at sunset',
            mood: 'serene',
            lighting: 'golden hour',
          },
        ],
      };

      const videoEngine = new VideoPromptEngine();
      const cinematographyPrompt =
        videoEngine.buildCinematographyPrompt(sceneData);

      expect(cinematographyPrompt).toContain('ocean');
      expect(cinematographyPrompt).toContain('sunset');
      expect(cinematographyPrompt).toContain('camera');
      expect(cinematographyPrompt).toContain('shot');
    });

    test('should generate transition prompts', () => {
      const scenes = [
        { type: 'forest', mood: 'mysterious' },
        { type: 'clearing', mood: 'peaceful' },
      ];

      const videoEngine = new VideoPromptEngine();
      const transitionPrompt = videoEngine.buildTransitionPrompt(
        scenes[0],
        scenes[1]
      );

      expect(transitionPrompt).toContain('forest');
      expect(transitionPrompt).toContain('clearing');
      expect(transitionPrompt).toContain('transition');
    });
  });
});
