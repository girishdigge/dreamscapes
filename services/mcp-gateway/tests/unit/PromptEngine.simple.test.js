// tests/unit/PromptEngine.simple.test.js
// Simplified unit tests for PromptEngine class

const PromptEngine = require('../../engine/PromptEngine');

describe('PromptEngine - Basic Functionality', () => {
  let promptEngine;

  beforeEach(() => {
    promptEngine = new PromptEngine();
  });

  describe('Dream Prompt Generation', () => {
    test('should build basic dream prompt', async () => {
      const text = 'I dreamed of a peaceful garden';
      const style = 'ethereal';
      const context = {};

      const prompt = await promptEngine.buildDreamPrompt(text, style, context);

      expect(typeof prompt).toBe('string');
      expect(prompt).toContain(text);
      expect(prompt).toContain('ethereal');
      expect(prompt).toContain('JSON');
      expect(prompt.length).toBeGreaterThan(100);
    });

    test('should handle different styles', async () => {
      const text = 'I dreamed of a city';
      const styles = ['ethereal', 'cyberpunk', 'surreal'];

      for (const style of styles) {
        const prompt = await promptEngine.buildDreamPrompt(text, style, {});
        expect(typeof prompt).toBe('string');
        expect(prompt.toLowerCase()).toContain(style.toLowerCase());
      }
    });

    test('should handle empty or minimal input', async () => {
      const text = 'Dream';
      const prompt = await promptEngine.buildDreamPrompt(text, 'ethereal', {});

      expect(typeof prompt).toBe('string');
      expect(prompt).toContain(text);
      expect(prompt.length).toBeGreaterThan(50);
    });
  });

  describe('Video Prompt Generation', () => {
    test('should build video generation prompt', () => {
      const dreamData = {
        title: 'Ocean Sunset',
        scenes: [{ description: 'Vast ocean at sunset', mood: 'serene' }],
      };

      const prompt = promptEngine.buildVideoPrompt(dreamData, 'cinematic');

      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('Ocean Sunset');
      expect(prompt).toContain('cinematic');
    });
  });

  describe('Template Management', () => {
    test('should get template by type and style', () => {
      const template = promptEngine.getTemplate('dream', 'ethereal');
      expect(template).toBeDefined();
    });

    test('should handle missing templates gracefully', () => {
      const template = promptEngine.getTemplate('nonexistent', 'unknown');
      expect(template).toBeDefined(); // Should fallback to base template
    });
  });

  describe('Error Handling', () => {
    test('should handle missing template gracefully', () => {
      expect(() => {
        promptEngine.getTemplate('invalid_type', 'invalid_style');
      }).not.toThrow();
    });

    test('should handle empty or null inputs', async () => {
      const prompt = await promptEngine.buildDreamPrompt('', 'ethereal', {});
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });
  });
});
