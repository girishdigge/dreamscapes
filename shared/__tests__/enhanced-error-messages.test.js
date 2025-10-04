/**
 * Enhanced Error Messages Tests
 *
 * Tests for enhanced validation error messages with repair suggestions,
 * actionable error messages, service context logging, and error format consistency.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

const UnifiedValidator = require('../validators/UnifiedValidator');
const DreamSchema = require('../schemas/DreamSchema');
const EnumMapper = require('../validators/EnumMapper');

describe('Enhanced Error Messages', () => {
  describe('Repair Suggestions in Errors', () => {
    test('should include repair suggestion for invalid source enum', () => {
      const dream = createValidDream();
      dream.source = 'local_fallback';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      expect(result.valid).toBe(false);
      const sourceError = result.errors.find((e) => e.field === 'source');

      expect(sourceError).toBeDefined();
      expect(sourceError.error).toBe('INVALID_ENUM_VALUE');
      expect(sourceError.repairSuggestion).toBeDefined();
      expect(sourceError.repairSuggestion).toBe('express');
    });

    test('should include repair suggestion for safe_fallback source', () => {
      const dream = createValidDream();
      dream.source = 'safe_fallback';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const sourceError = result.errors.find((e) => e.field === 'source');

      expect(sourceError).toBeDefined();
      expect(sourceError.repairSuggestion).toBe('express');
    });

    test('should include repair suggestion for mcp-gateway-fallback source', () => {
      const dream = createValidDream();
      dream.source = 'mcp-gateway-fallback';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const sourceError = result.errors.find((e) => e.field === 'source');

      expect(sourceError).toBeDefined();
      expect(sourceError.repairSuggestion).toBe('mcp-gateway');
    });

    test('should include repair suggestion for invalid shot type', () => {
      const dream = createValidDream();
      dream.cinematography.shots[0].type = 'dolly_zoom';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const shotTypeError = result.errors.find((e) =>
        e.field.includes('cinematography.shots[0].type')
      );

      expect(shotTypeError).toBeDefined();
      expect(shotTypeError.error).toBe('INVALID_ENUM_VALUE');
      expect(shotTypeError.repairSuggestion).toBeDefined();
      expect(shotTypeError.repairSuggestion).toBe('zoom');
    });

    test('should include repair suggestion for tracking shot type', () => {
      const dream = createValidDream();
      dream.cinematography.shots[0].type = 'tracking';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const shotTypeError = result.errors.find((e) =>
        e.field.includes('cinematography.shots[0].type')
      );

      expect(shotTypeError).toBeDefined();
      expect(shotTypeError.repairSuggestion).toBe('flythrough');
    });

    test('should include repair suggestion for pan shot type', () => {
      const dream = createValidDream();
      dream.cinematography.shots[0].type = 'pan';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const shotTypeError = result.errors.find((e) =>
        e.field.includes('cinematography.shots[0].type')
      );

      expect(shotTypeError).toBeDefined();
      expect(shotTypeError.repairSuggestion).toBe('orbit');
    });

    test('should include repair suggestion for static shot type', () => {
      const dream = createValidDream();
      dream.cinematography.shots[0].type = 'static';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const shotTypeError = result.errors.find((e) =>
        e.field.includes('cinematography.shots[0].type')
      );

      expect(shotTypeError).toBeDefined();
      expect(shotTypeError.repairSuggestion).toBe('establish');
    });

    test('should include repair suggestion for unknown enum value using Levenshtein distance', () => {
      const dream = createValidDream();
      dream.source = 'expresss'; // Typo: extra 's'

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const sourceError = result.errors.find((e) => e.field === 'source');

      expect(sourceError).toBeDefined();
      expect(sourceError.repairSuggestion).toBeDefined();
      expect(sourceError.repairSuggestion).toBe('express');
    });

    test('should include repair suggestion for style enum with typo', () => {
      const dream = createValidDream();
      dream.style = 'etherial'; // Typo: should be 'ethereal'

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const styleError = result.errors.find((e) => e.field === 'style');

      expect(styleError).toBeDefined();
      expect(styleError.repairSuggestion).toBeDefined();
      expect(styleError.repairSuggestion).toBe('ethereal');
    });

    test('should include repair suggestion for render quality enum', () => {
      const dream = createValidDream();
      dream.render.quality = 'hight'; // Typo: should be 'high'

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const qualityError = result.errors.find((e) =>
        e.field.includes('render.quality')
      );

      expect(qualityError).toBeDefined();
      expect(qualityError.repairSuggestion).toBeDefined();
      expect(qualityError.repairSuggestion).toBe('high');
    });

    test('should include repair suggestion for environment preset enum', () => {
      const dream = createValidDream();
      dream.environment.preset = 'nite'; // Typo: should be 'night'

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const presetError = result.errors.find((e) =>
        e.field.includes('environment.preset')
      );

      expect(presetError).toBeDefined();
      expect(presetError.repairSuggestion).toBeDefined();
      expect(presetError.repairSuggestion).toBe('night');
    });

    test('should include repair suggestion for number enum (fps)', () => {
      const dream = createValidDream();
      dream.render.fps = 25; // Invalid: should be 24, 30, or 60

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const fpsError = result.errors.find((e) =>
        e.field.includes('render.fps')
      );

      expect(fpsError).toBeDefined();
      expect(fpsError.repairSuggestion).toBeDefined();
      expect([24, 30]).toContain(fpsError.repairSuggestion);
    });
  });

  describe('Actionable Error Messages', () => {
    test('should provide actionable error message with valid options listed', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const sourceError = result.errors.find((e) => e.field === 'source');

      expect(sourceError).toBeDefined();
      expect(sourceError.message).toContain('must be one of');
      expect(sourceError.message).toContain('cerebras');
      expect(sourceError.message).toContain('openai');
      expect(sourceError.message).toContain('mock');
      expect(sourceError.message).toContain('mcp-gateway');
      expect(sourceError.message).toContain('express');
    });

    test('should provide expected and received values in error', () => {
      const dream = createValidDream();
      dream.source = 'local_fallback';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const sourceError = result.errors.find((e) => e.field === 'source');

      expect(sourceError).toBeDefined();
      expect(sourceError.expected).toBeDefined();
      expect(sourceError.received).toBe('local_fallback');
      expect(Array.isArray(sourceError.expected)).toBe(true);
      expect(sourceError.expected).toContain('express');
    });

    test('should provide clear field path in error', () => {
      const dream = createValidDream();
      dream.cinematography.shots[0].type = 'invalid-shot';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const shotTypeError = result.errors.find((e) =>
        e.field.includes('cinematography.shots[0].type')
      );

      expect(shotTypeError).toBeDefined();
      expect(shotTypeError.field).toBe('cinematography.shots[0].type');
    });

    test('should provide error type for programmatic handling', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const sourceError = result.errors.find((e) => e.field === 'source');

      expect(sourceError).toBeDefined();
      expect(sourceError.error).toBe('INVALID_ENUM_VALUE');
    });

    test('should provide actionable message for multiple enum violations', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';
      dream.style = 'invalid-style';
      dream.cinematography.shots[0].type = 'invalid-shot';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const enumErrors = result.errors.filter(
        (e) => e.error === 'INVALID_ENUM_VALUE'
      );

      expect(enumErrors.length).toBeGreaterThanOrEqual(3);
      enumErrors.forEach((error) => {
        expect(error.message).toContain('must be one of');
        expect(error.expected).toBeDefined();
        expect(error.received).toBeDefined();
        expect(error.repairSuggestion).toBeDefined();
      });
    });

    test('should provide actionable message for parameter range violations', () => {
      const dream = createValidDream();
      dream.entities[0].params.glow = 1.5; // Above max of 1

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const glowError = result.errors.find((e) =>
        e.field.includes('entities[0].params.glow')
      );

      expect(glowError).toBeDefined();
      expect(glowError.message).toContain('at most');
      expect(glowError.expected).toContain('1');
      expect(glowError.received).toBe(1.5);
    });
  });

  describe('Service Context in Logging', () => {
    let consoleErrorSpy;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    test('should log service context with enum errors', () => {
      const dream = createValidDream();
      dream.source = 'local_fallback';

      const validator = new UnifiedValidator({ logErrors: true });
      validator.validateDreamObject(dream);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCall = consoleErrorSpy.mock.calls.find((call) =>
        call[0].includes('Enum validation failures')
      );

      expect(logCall).toBeDefined();
      expect(logCall[1]).toHaveProperty('source');
      expect(logCall[1]).toHaveProperty('dreamId');
      expect(logCall[1].source).toBe('local_fallback'); // Logs the actual invalid source
    });

    test('should log dream ID in error context', () => {
      const dream = createValidDream();
      dream.id = '123e4567-e89b-12d3-a456-426614174000';
      dream.source = 'invalid-source';

      const validator = new UnifiedValidator({ logErrors: true });
      validator.validateDreamObject(dream);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCall = consoleErrorSpy.mock.calls.find((call) =>
        call[0].includes('Enum validation failures')
      );

      expect(logCall).toBeDefined();
      expect(logCall[1].dreamId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    test('should log repair suggestions in error context', () => {
      const dream = createValidDream();
      dream.source = 'local_fallback';

      const validator = new UnifiedValidator({ logErrors: true });
      validator.validateDreamObject(dream);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCall = consoleErrorSpy.mock.calls.find((call) =>
        call[0].includes('Enum validation failures')
      );

      expect(logCall).toBeDefined();
      expect(logCall[1].errors).toBeDefined();
      expect(logCall[1].errors[0]).toHaveProperty('repairSuggestion');
      expect(logCall[1].errors[0].repairSuggestion).toBe('express');
    });

    test('should log actionable message with repair suggestion', () => {
      const dream = createValidDream();
      dream.source = 'local_fallback';

      const validator = new UnifiedValidator({ logErrors: true });
      validator.validateDreamObject(dream);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCall = consoleErrorSpy.mock.calls.find((call) =>
        call[0].includes('Enum validation failures')
      );

      expect(logCall).toBeDefined();
      expect(logCall[1].errors[0]).toHaveProperty('actionable');
      expect(logCall[1].errors[0].actionable).toContain(
        "Consider using 'express' instead of 'local_fallback'"
      );
    });

    test('should log error count in context', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';
      dream.style = 'invalid-style';

      const validator = new UnifiedValidator({ logErrors: true });
      validator.validateDreamObject(dream);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCall = consoleErrorSpy.mock.calls.find((call) =>
        call[0].includes('Enum validation failures')
      );

      expect(logCall).toBeDefined();
      expect(logCall[1]).toHaveProperty('errorCount');
      expect(logCall[1].errorCount).toBeGreaterThanOrEqual(2);
    });

    test('should separate enum errors from other errors in logs', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';
      dream.title = ''; // String too short error

      const validator = new UnifiedValidator({ logErrors: true });
      validator.validateDreamObject(dream);

      expect(consoleErrorSpy).toHaveBeenCalled();

      const enumLogCall = consoleErrorSpy.mock.calls.find((call) =>
        call[0].includes('Enum validation failures')
      );
      const otherLogCall = consoleErrorSpy.mock.calls.find(
        (call) =>
          call[0].includes('Validation failed') &&
          !call[0].includes('Enum validation failures')
      );

      expect(enumLogCall).toBeDefined();
      expect(otherLogCall).toBeDefined();
    });

    test('should log critical errors with service context', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';

      const validator = new UnifiedValidator({ logErrors: true });
      const result = validator.validateDreamObject(dream);

      // Mark error as critical
      result.errors[0].severity = 'critical';

      // Re-validate to trigger critical error logging
      validator.logValidationErrors(dream, result.errors);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const criticalLogCall = consoleErrorSpy.mock.calls.find((call) =>
        call[0].includes('Critical validation errors')
      );

      expect(criticalLogCall).toBeDefined();
      expect(criticalLogCall[1]).toHaveProperty('source');
      expect(criticalLogCall[1]).toHaveProperty('context');
    });

    test('should include service name in context message', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';

      const validator = new UnifiedValidator({ logErrors: true });
      const result = validator.validateDreamObject(dream);

      result.errors[0].severity = 'critical';
      validator.logValidationErrors(dream, result.errors);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const criticalLogCall = consoleErrorSpy.mock.calls.find((call) =>
        call[0].includes('Critical validation errors')
      );

      expect(criticalLogCall).toBeDefined();
      expect(criticalLogCall[1].context).toContain('invalid-source'); // Logs the actual invalid source
    });

    test('should log recommendation for fixing generator', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';

      const validator = new UnifiedValidator({ logErrors: true });
      const result = validator.validateDreamObject(dream);

      result.errors[0].severity = 'critical';
      validator.logValidationErrors(dream, result.errors);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const criticalLogCall = consoleErrorSpy.mock.calls.find((call) =>
        call[0].includes('Critical validation errors')
      );

      expect(criticalLogCall).toBeDefined();
      expect(criticalLogCall[1]).toHaveProperty('recommendation');
      expect(criticalLogCall[1].recommendation).toContain('DreamSchema');
    });
  });

  describe('Error Format Consistency', () => {
    test('should have consistent error structure for all enum violations', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';
      dream.style = 'invalid-style';
      dream.render.quality = 'invalid-quality';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const enumErrors = result.errors.filter(
        (e) => e.error === 'INVALID_ENUM_VALUE'
      );

      expect(enumErrors.length).toBeGreaterThanOrEqual(3);

      enumErrors.forEach((error) => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('error');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('expected');
        expect(error).toHaveProperty('received');
        expect(error).toHaveProperty('repairSuggestion');
      });
    });

    test('should have consistent error structure for range violations', () => {
      const dream = createValidDream();
      dream.entities[0].params.glow = 1.5;
      dream.entities[0].params.speed = 15;
      dream.environment.fog = 2;

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const rangeErrors = result.errors.filter(
        (e) => e.error === 'NUMBER_TOO_LARGE'
      );

      expect(rangeErrors.length).toBeGreaterThanOrEqual(3);

      rangeErrors.forEach((error) => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('error');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('expected');
        expect(error).toHaveProperty('received');
      });
    });

    test('should have consistent error structure for missing fields', () => {
      const dream = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const missingErrors = result.errors.filter(
        (e) => e.error === 'MISSING_REQUIRED_FIELD'
      );

      expect(missingErrors.length).toBeGreaterThan(0);

      missingErrors.forEach((error) => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('error');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('expected');
        expect(error).toHaveProperty('received');
      });
    });

    test('should have consistent error structure for pattern mismatches', () => {
      const dream = createValidDream();
      dream.id = 'not-a-uuid';
      dream.created = 'not-a-date';
      dream.environment.skyColor = 'not-a-hex-color';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const patternErrors = result.errors.filter(
        (e) => e.error === 'PATTERN_MISMATCH'
      );

      expect(patternErrors.length).toBeGreaterThanOrEqual(3);

      patternErrors.forEach((error) => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('error');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('expected');
        expect(error).toHaveProperty('received');
      });
    });

    test('should include context in all errors when available', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';
      dream.style = 'invalid-style';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      result.errors.forEach((error) => {
        expect(error).toHaveProperty('context');
        expect(error.context).toHaveProperty('source');
        expect(error.context).toHaveProperty('dreamId');
        expect(error.context).toHaveProperty('generatedAt');
      });
    });

    test('should use consistent severity levels', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';
      delete dream.title;

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      result.errors.forEach((error) => {
        if (error.severity) {
          expect(['critical', 'error', 'warning']).toContain(error.severity);
        }
      });
    });

    test('should maintain error format across different validation methods', () => {
      const dream = createValidDream();
      dream.source = 'invalid-source';

      const validator = new UnifiedValidator();

      // Test validateDreamObject
      const dreamResult = validator.validateDreamObject(dream);
      const dreamError = dreamResult.errors.find((e) => e.field === 'source');

      // Test direct schema validation
      const schemaResult = DreamSchema.validate(dream);
      const schemaError = schemaResult.errors.find((e) => e.field === 'source');

      // Both should have same structure
      expect(dreamError).toHaveProperty('field');
      expect(dreamError).toHaveProperty('error');
      expect(dreamError).toHaveProperty('message');
      expect(dreamError).toHaveProperty('repairSuggestion');

      expect(schemaError).toHaveProperty('field');
      expect(schemaError).toHaveProperty('error');
      expect(schemaError).toHaveProperty('message');
      expect(schemaError).toHaveProperty('repairSuggestion');
    });
  });

  describe('Integration with EnumMapper', () => {
    test('should use EnumMapper for source repair suggestions', () => {
      const dream = createValidDream();
      dream.source = 'local_fallback';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const sourceError = result.errors.find((e) => e.field === 'source');

      // Verify repair suggestion matches EnumMapper output
      const mapperSuggestion = EnumMapper.mapFallbackToSource('local_fallback');
      expect(sourceError.repairSuggestion).toBe(mapperSuggestion);
    });

    test('should use EnumMapper for shot type repair suggestions', () => {
      const dream = createValidDream();
      dream.cinematography.shots[0].type = 'dolly_zoom';

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const shotTypeError = result.errors.find((e) =>
        e.field.includes('cinematography.shots[0].type')
      );

      // Verify repair suggestion matches EnumMapper output
      const mapperSuggestion = EnumMapper.mapShotType('dolly_zoom');
      expect(shotTypeError.repairSuggestion).toBe(mapperSuggestion);
    });

    test('should fall back to Levenshtein distance when EnumMapper has no mapping', () => {
      const dream = createValidDream();
      dream.source = 'expresss'; // Typo not in EnumMapper

      const validator = new UnifiedValidator();
      const result = validator.validateDreamObject(dream);

      const sourceError = result.errors.find((e) => e.field === 'source');

      expect(sourceError.repairSuggestion).toBeDefined();
      expect(sourceError.repairSuggestion).toBe('express');
    });
  });
});

// Helper functions to create valid test data
function createValidDream() {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    title: 'Test Dream',
    style: 'ethereal',
    structures: [createValidStructure('struct-1')],
    entities: [createValidEntity('entity-1')],
    cinematography: createValidCinematography(),
    environment: createValidEnvironment(),
    render: createValidRenderConfig(),
    created: '2024-01-15T10:30:00.000Z',
    source: 'cerebras',
  };
}

function createValidStructure(id) {
  return {
    id,
    type: 'floating_platform',
    pos: [0, 5, 10],
    rotation: [0, 0, 0],
    scale: 1,
    features: ['glowing_edges'],
  };
}

function createValidEntity(id) {
  return {
    id,
    type: 'floating_orbs',
    count: 10,
    params: {
      speed: 1,
      glow: 0.5,
      size: 1,
      color: '#ffffff',
    },
  };
}

function createValidCinematography() {
  return {
    durationSec: 30,
    shots: [
      {
        type: 'establish',
        target: 'struct-1',
        duration: 10,
        startPos: [0, 10, 20],
        endPos: [5, 15, 25],
      },
      {
        type: 'orbit',
        target: 'entity-1',
        duration: 20,
      },
    ],
  };
}

function createValidEnvironment() {
  return {
    preset: 'dusk',
    fog: 0.3,
    skyColor: '#87CEEB',
    ambientLight: 0.5,
  };
}

function createValidRenderConfig() {
  return {
    res: [1920, 1080],
    fps: 30,
    quality: 'medium',
  };
}
