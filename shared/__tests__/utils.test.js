// shared/__tests__/utils.test.js
/**
 * Tests for shared utility functions
 */

const { utils } = require('../index');

describe('ResponseParser Utilities', () => {
  describe('extractJsonString', () => {
    test('extracts valid JSON from text', () => {
      const text = 'Some text {"key": "value"} more text';
      const result = utils.extractJsonString(text);
      expect(result).toBe('{"key": "value"}');
    });

    test('handles nested JSON objects', () => {
      const text = 'Text {"outer": {"inner": "value"}} text';
      const result = utils.extractJsonString(text);
      expect(result).toBe('{"outer": {"inner": "value"}}');
    });

    test('returns null for text without JSON', () => {
      const text = 'No JSON here';
      const result = utils.extractJsonString(text);
      expect(result).toBeNull();
    });
  });

  describe('cleanJsonString', () => {
    test('removes trailing commas', () => {
      const dirty = '{"key": "value",}';
      const clean = utils.cleanJsonString(dirty);
      expect(clean).toBe('{"key": "value"}');
    });

    test('handles null input', () => {
      const result = utils.cleanJsonString(null);
      expect(result).toBeNull();
    });
  });

  describe('normalizeRawResponse', () => {
    test('extracts content from OpenAI format', () => {
      const response = {
        choices: [{ message: { content: 'test content' } }],
      };
      const result = utils.normalizeRawResponse(response, 'openai');
      expect(result).toBe('test content');
    });

    test('returns string directly', () => {
      const response = 'direct string';
      const result = utils.normalizeRawResponse(response);
      expect(result).toBe('direct string');
    });

    test('returns null for null input', () => {
      const result = utils.normalizeRawResponse(null);
      expect(result).toBeNull();
    });
  });

  describe('detectResponseFormat', () => {
    test('detects string format', () => {
      expect(utils.detectResponseFormat('test')).toBe('string');
    });

    test('detects object format', () => {
      expect(utils.detectResponseFormat({})).toBe('object');
    });

    test('detects array format', () => {
      expect(utils.detectResponseFormat([])).toBe('array');
    });

    test('detects null format', () => {
      expect(utils.detectResponseFormat(null)).toBe('null');
    });
  });

  describe('createResponsePreview', () => {
    test('returns full text if under max length', () => {
      const text = 'Short text';
      const preview = utils.createResponsePreview(text, 100);
      expect(preview).toBe('Short text');
    });

    test('truncates long text', () => {
      const text = 'A'.repeat(500);
      const preview = utils.createResponsePreview(text, 100);
      expect(preview).toContain('...');
      expect(preview.length).toBeLessThan(text.length);
    });

    test('handles empty text', () => {
      const preview = utils.createResponsePreview('');
      expect(preview).toBe('[empty]');
    });
  });

  describe('identifyJsonIssues', () => {
    test('identifies trailing commas', () => {
      const json = '{"key": "value",}';
      const issues = utils.identifyJsonIssues(json);
      expect(issues).toContain('Trailing commas detected');
    });

    test('identifies mismatched braces', () => {
      const json = '{"key": "value"';
      const issues = utils.identifyJsonIssues(json);
      expect(issues.some((i) => i.includes('Mismatched braces'))).toBe(true);
    });

    test('returns empty array for valid JSON', () => {
      const json = '{"key": "value"}';
      const issues = utils.identifyJsonIssues(json);
      expect(issues.length).toBe(0);
    });
  });
});

describe('ValidationHelpers Utilities', () => {
  describe('formatValidationError', () => {
    test('formats string error', () => {
      const result = utils.formatValidationError('Test error');
      expect(result).toBe('Test error');
    });

    test('formats error object with message', () => {
      const error = { message: 'Test error message' };
      const result = utils.formatValidationError(error);
      expect(result).toBe('Test error message');
    });

    test('handles null error', () => {
      const result = utils.formatValidationError(null);
      expect(result).toBe('Unknown validation error');
    });
  });

  describe('sanitizeText', () => {
    test('removes HTML tags', () => {
      const dirty = '<script>alert("xss")</script>Hello';
      const clean = utils.sanitizeText(dirty);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('Hello');
    });

    test('normalizes whitespace', () => {
      const text = 'Multiple   spaces   here';
      const clean = utils.sanitizeText(text);
      expect(clean).toBe('Multiple spaces here');
    });

    test('enforces max length', () => {
      const text = 'A'.repeat(3000);
      const clean = utils.sanitizeText(text, 100);
      expect(clean.length).toBe(100);
    });

    test('handles non-string input', () => {
      const clean = utils.sanitizeText(123);
      expect(clean).toBe('');
    });
  });

  describe('sanitizeId', () => {
    test('removes special characters', () => {
      const dirty = 'test@#$%id';
      const clean = utils.sanitizeId(dirty);
      expect(clean).toBe('testid');
    });

    test('keeps alphanumeric, underscore, and dash', () => {
      const id = 'test_id-123';
      const clean = utils.sanitizeId(id);
      expect(clean).toBe('test_id-123');
    });

    test('enforces max length', () => {
      const id = 'A'.repeat(100);
      const clean = utils.sanitizeId(id, 20);
      expect(clean.length).toBe(20);
    });
  });

  describe('ensureRequiredFields', () => {
    test('adds missing title field', () => {
      const data = { id: '123', style: 'ethereal' };
      const result = utils.ensureRequiredFields(data, 'Original text');
      expect(result.data.title).toBe('Original text');
      expect(result.modified).toBe(true);
    });

    test('adds missing style field', () => {
      const data = { id: '123', title: 'Test' };
      const result = utils.ensureRequiredFields(data);
      expect(result.data.style).toBe('ethereal');
      expect(result.modified).toBe(true);
    });

    test('does not modify complete data', () => {
      const data = { id: '123', title: 'Test', style: 'cyberpunk' };
      const result = utils.ensureRequiredFields(data);
      expect(result.modified).toBe(false);
    });

    test('handles null input', () => {
      const result = utils.ensureRequiredFields(null);
      expect(result).toBeNull();
    });
  });

  describe('generateDreamStats', () => {
    test('generates stats for valid dream', () => {
      const dream = {
        structures: [{ id: '1' }, { id: '2' }],
        entities: [
          { id: '1', count: 10 },
          { id: '2', count: 20 },
        ],
        cinematography: { durationSec: 30, shots: [{ type: 'establish' }] },
      };
      const stats = utils.generateDreamStats(dream);
      expect(stats.structures).toBe(2);
      expect(stats.entities).toBe(2);
      expect(stats.totalEntityCount).toBe(30);
      expect(stats.shots).toBe(1);
      expect(stats.duration).toBe(30);
    });

    test('handles empty dream', () => {
      const stats = utils.generateDreamStats({});
      expect(stats.structures).toBe(0);
      expect(stats.entities).toBe(0);
      expect(stats.totalEntityCount).toBe(0);
    });

    test('handles null input', () => {
      const stats = utils.generateDreamStats(null);
      expect(stats.complexityRating).toBe('unknown');
    });
  });

  describe('calculateComplexityScore', () => {
    test('calculates score for simple dream', () => {
      const dream = {
        structures: [{ id: '1' }],
        entities: [{ id: '1', count: 5 }],
        cinematography: { durationSec: 10, shots: [{ type: 'establish' }] },
      };
      const score = utils.calculateComplexityScore(dream);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(10);
    });

    test('calculates higher score for complex dream', () => {
      const dream = {
        structures: Array(10).fill({ id: '1' }),
        entities: Array(10).fill({ id: '1', count: 50 }),
        cinematography: {
          durationSec: 120,
          shots: Array(10).fill({ type: 'establish' }),
        },
      };
      const score = utils.calculateComplexityScore(dream);
      expect(score).toBeGreaterThan(20);
    });
  });

  describe('getComplexityRating', () => {
    test('returns simple for low scores', () => {
      expect(utils.getComplexityRating(3)).toBe('simple');
    });

    test('returns moderate for medium scores', () => {
      expect(utils.getComplexityRating(10)).toBe('moderate');
    });

    test('returns complex for high scores', () => {
      expect(utils.getComplexityRating(20)).toBe('complex');
    });

    test('returns very_complex for very high scores', () => {
      expect(utils.getComplexityRating(30)).toBe('very_complex');
    });
  });

  describe('isValidUUID', () => {
    test('validates correct UUID', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(utils.isValidUUID(uuid)).toBe(true);
    });

    test('rejects invalid UUID', () => {
      expect(utils.isValidUUID('not-a-uuid')).toBe(false);
      expect(utils.isValidUUID('123')).toBe(false);
      expect(utils.isValidUUID(null)).toBe(false);
    });
  });

  describe('isValidHexColor', () => {
    test('validates correct hex color', () => {
      expect(utils.isValidHexColor('#FF0000')).toBe(true);
      expect(utils.isValidHexColor('#00ff00')).toBe(true);
    });

    test('rejects invalid hex color', () => {
      expect(utils.isValidHexColor('FF0000')).toBe(false);
      expect(utils.isValidHexColor('#FFF')).toBe(false);
      expect(utils.isValidHexColor('#GGGGGG')).toBe(false);
    });
  });

  describe('validateCoordinates', () => {
    test('validates correct coordinates', () => {
      const result = utils.validateCoordinates([0, 5, 10]);
      expect(result.valid).toBe(true);
    });

    test('rejects non-array', () => {
      const result = utils.validateCoordinates('not an array');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be an array');
    });

    test('rejects wrong length', () => {
      const result = utils.validateCoordinates([0, 5]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exactly 3 values');
    });

    test('rejects non-numeric values', () => {
      const result = utils.validateCoordinates([0, 'five', 10]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('finite numbers');
    });
  });

  describe('validateRange', () => {
    test('validates value in range', () => {
      const result = utils.validateRange(5, 0, 10);
      expect(result.valid).toBe(true);
    });

    test('rejects value below minimum', () => {
      const result = utils.validateRange(-1, 0, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('>=');
    });

    test('rejects value above maximum', () => {
      const result = utils.validateRange(15, 0, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('<=');
    });

    test('rejects non-numeric value', () => {
      const result = utils.validateRange('five', 0, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('finite number');
    });
  });
});
