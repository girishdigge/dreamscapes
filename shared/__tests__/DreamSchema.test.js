/**
 * DreamSchema Validation Tests
 *
 * Comprehensive unit tests for DreamSchema validation rules
 * Tests valid and invalid data scenarios, edge cases, and boundary conditions
 */

const DreamSchema = require('../schemas/DreamSchema');

describe('DreamSchema', () => {
  describe('Complete Dream Object Validation', () => {
    test('should validate a complete valid dream object', () => {
      const validDream = createValidDream();
      const result = DreamSchema.validate(validDream);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.errorCount).toBe(0);
    });

    test('should reject dream with missing required fields', () => {
      const invalidDream = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Dream',
        // Missing style, structures, entities, etc.
      };

      const result = DreamSchema.validate(invalidDream);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.field === 'style')).toBe(true);
      expect(result.errors.some((e) => e.field === 'structures')).toBe(true);
      expect(result.errors.some((e) => e.field === 'entities')).toBe(true);
    });

    test('should reject null or undefined dream object', () => {
      const nullResult = DreamSchema.validate(null);
      const undefinedResult = DreamSchema.validate(undefined);

      expect(nullResult.valid).toBe(false);
      expect(undefinedResult.valid).toBe(false);
    });

    test('should provide clear error messages for missing fields', () => {
      const incompleteDream = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = DreamSchema.validate(incompleteDream);

      result.errors.forEach((error) => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('error');
        expect(error).toHaveProperty('message');
        expect(error.message).toMatch(/required|missing/i);
      });
    });
  });

  describe('ID Field Validation', () => {
    test('should accept valid UUID format', () => {
      const dream = createValidDream();
      dream.id = '123e4567-e89b-12d3-a456-426614174000';

      const result = DreamSchema.validate(dream);
      const idError = result.errors.find((e) => e.field === 'id');

      expect(idError).toBeUndefined();
    });

    test('should reject invalid UUID format', () => {
      const dream = createValidDream();
      dream.id = 'not-a-valid-uuid';

      const result = DreamSchema.validate(dream);
      const idError = result.errors.find((e) => e.field === 'id');

      expect(idError).toBeDefined();
      expect(idError.error).toBe('PATTERN_MISMATCH');
    });

    test('should reject missing ID', () => {
      const dream = createValidDream();
      delete dream.id;

      const result = DreamSchema.validate(dream);
      const idError = result.errors.find((e) => e.field === 'id');

      expect(idError).toBeDefined();
      expect(idError.error).toBe('MISSING_REQUIRED_FIELD');
    });
  });

  describe('Title Field Validation', () => {
    test('should accept valid title', () => {
      const dream = createValidDream();
      dream.title = 'A Beautiful Dream';

      const result = DreamSchema.validate(dream);
      const titleError = result.errors.find((e) => e.field === 'title');

      expect(titleError).toBeUndefined();
    });

    test('should reject empty title', () => {
      const dream = createValidDream();
      dream.title = '';

      const result = DreamSchema.validate(dream);
      const titleError = result.errors.find((e) => e.field === 'title');

      expect(titleError).toBeDefined();
      expect(titleError.error).toBe('STRING_TOO_SHORT');
    });

    test('should reject title exceeding max length', () => {
      const dream = createValidDream();
      dream.title = 'a'.repeat(201);

      const result = DreamSchema.validate(dream);
      const titleError = result.errors.find((e) => e.field === 'title');

      expect(titleError).toBeDefined();
      expect(titleError.error).toBe('STRING_TOO_LONG');
    });

    test('should accept title at max length boundary', () => {
      const dream = createValidDream();
      dream.title = 'a'.repeat(200);

      const result = DreamSchema.validate(dream);
      const titleError = result.errors.find((e) => e.field === 'title');

      expect(titleError).toBeUndefined();
    });
  });

  describe('Style Field Validation', () => {
    test('should accept valid style values', () => {
      const validStyles = [
        'ethereal',
        'cyberpunk',
        'surreal',
        'fantasy',
        'nightmare',
        'nature',
        'abstract',
      ];

      validStyles.forEach((style) => {
        const dream = createValidDream();
        dream.style = style;

        const result = DreamSchema.validate(dream);
        const styleError = result.errors.find((e) => e.field === 'style');

        expect(styleError).toBeUndefined();
      });
    });

    test('should reject invalid style value', () => {
      const dream = createValidDream();
      dream.style = 'invalid-style';

      const result = DreamSchema.validate(dream);
      const styleError = result.errors.find((e) => e.field === 'style');

      expect(styleError).toBeDefined();
      expect(styleError.error).toBe('INVALID_ENUM_VALUE');
      expect(styleError.message).toContain('ethereal');
    });
  });

  describe('Structures Array Validation', () => {
    test('should accept valid structures array', () => {
      const dream = createValidDream();
      const result = DreamSchema.validate(dream);
      const structuresError = result.errors.find((e) =>
        e.field.startsWith('structures')
      );

      expect(structuresError).toBeUndefined();
    });

    test('should reject empty structures array', () => {
      const dream = createValidDream();
      dream.structures = [];

      const result = DreamSchema.validate(dream);
      const structuresError = result.errors.find(
        (e) => e.field === 'structures'
      );

      expect(structuresError).toBeDefined();
      expect(structuresError.error).toBe('ARRAY_TOO_SHORT');
      expect(structuresError.message).toContain('at least 1');
    });

    test('should reject structures array exceeding max items', () => {
      const dream = createValidDream();
      dream.structures = Array(11)
        .fill(null)
        .map((_, i) => createValidStructure(`struct-${i}`));

      const result = DreamSchema.validate(dream);
      const structuresError = result.errors.find(
        (e) => e.field === 'structures'
      );

      expect(structuresError).toBeDefined();
      expect(structuresError.error).toBe('ARRAY_TOO_LONG');
    });

    test('should accept structures array at max boundary', () => {
      const dream = createValidDream();
      dream.structures = Array(10)
        .fill(null)
        .map((_, i) => createValidStructure(`struct-${i}`));

      const result = DreamSchema.validate(dream);
      const structuresError = result.errors.find(
        (e) => e.field === 'structures'
      );

      expect(structuresError).toBeUndefined();
    });

    test('should validate individual structure fields', () => {
      const dream = createValidDream();
      dream.structures[0].type = 'invalid-type';

      const result = DreamSchema.validate(dream);
      const typeError = result.errors.find((e) =>
        e.field.includes('structures[0].type')
      );

      expect(typeError).toBeDefined();
      expect(typeError.error).toBe('INVALID_ENUM_VALUE');
    });

    test('should reject structure with invalid position array', () => {
      const dream = createValidDream();
      dream.structures[0].pos = [1, 2]; // Only 2 elements instead of 3

      const result = DreamSchema.validate(dream);
      const posError = result.errors.find((e) =>
        e.field.includes('structures[0].pos')
      );

      expect(posError).toBeDefined();
      expect(posError.error).toBe('ARRAY_TOO_SHORT');
    });

    test('should reject structure with non-numeric position values', () => {
      const dream = createValidDream();
      dream.structures[0].pos = [1, 'invalid', 3];

      const result = DreamSchema.validate(dream);
      const posError = result.errors.find((e) =>
        e.field.includes('structures[0].pos[1]')
      );

      expect(posError).toBeDefined();
      expect(posError.error).toBe('INVALID_ITEM_TYPE');
    });

    test('should accept structure with numeric scale', () => {
      const dream = createValidDream();
      dream.structures[0].scale = 2.5;

      const result = DreamSchema.validate(dream);
      const scaleError = result.errors.find((e) =>
        e.field.includes('structures[0].scale')
      );

      expect(scaleError).toBeUndefined();
    });

    test('should accept structure with array scale', () => {
      const dream = createValidDream();
      dream.structures[0].scale = [1, 2, 3];

      const result = DreamSchema.validate(dream);
      const scaleError = result.errors.find((e) =>
        e.field.includes('structures[0].scale')
      );

      expect(scaleError).toBeUndefined();
    });

    test('should reject structure scale below minimum', () => {
      const dream = createValidDream();
      dream.structures[0].scale = 0.05;

      const result = DreamSchema.validate(dream);
      const scaleError = result.errors.find((e) =>
        e.field.includes('structures[0].scale')
      );

      expect(scaleError).toBeDefined();
      expect(scaleError.error).toBe('NUMBER_TOO_SMALL');
    });

    test('should reject structure scale above maximum', () => {
      const dream = createValidDream();
      dream.structures[0].scale = 15;

      const result = DreamSchema.validate(dream);
      const scaleError = result.errors.find((e) =>
        e.field.includes('structures[0].scale')
      );

      expect(scaleError).toBeDefined();
      expect(scaleError.error).toBe('NUMBER_TOO_LARGE');
    });

    test('should accept valid structure features', () => {
      const dream = createValidDream();
      dream.structures[0].features = ['glowing_edges', 'particle_effects'];

      const result = DreamSchema.validate(dream);
      const featuresError = result.errors.find((e) =>
        e.field.includes('structures[0].features')
      );

      expect(featuresError).toBeUndefined();
    });
  });

  describe('Entities Array Validation', () => {
    test('should accept valid entities array', () => {
      const dream = createValidDream();
      const result = DreamSchema.validate(dream);
      const entitiesError = result.errors.find((e) =>
        e.field.startsWith('entities')
      );

      expect(entitiesError).toBeUndefined();
    });

    test('should reject empty entities array', () => {
      const dream = createValidDream();
      dream.entities = [];

      const result = DreamSchema.validate(dream);
      const entitiesError = result.errors.find((e) => e.field === 'entities');

      expect(entitiesError).toBeDefined();
      expect(entitiesError.error).toBe('ARRAY_TOO_SHORT');
    });

    test('should reject entities array exceeding max items', () => {
      const dream = createValidDream();
      dream.entities = Array(6)
        .fill(null)
        .map((_, i) => createValidEntity(`entity-${i}`));

      const result = DreamSchema.validate(dream);
      const entitiesError = result.errors.find((e) => e.field === 'entities');

      expect(entitiesError).toBeDefined();
      expect(entitiesError.error).toBe('ARRAY_TOO_LONG');
    });

    test('should validate entity count boundaries', () => {
      const dream = createValidDream();
      dream.entities[0].count = 0;

      const result = DreamSchema.validate(dream);
      const countError = result.errors.find((e) =>
        e.field.includes('entities[0].count')
      );

      expect(countError).toBeDefined();
      expect(countError.error).toBe('NUMBER_TOO_SMALL');
    });

    test('should reject entity count above maximum', () => {
      const dream = createValidDream();
      dream.entities[0].count = 101;

      const result = DreamSchema.validate(dream);
      const countError = result.errors.find((e) =>
        e.field.includes('entities[0].count')
      );

      expect(countError).toBeDefined();
      expect(countError.error).toBe('NUMBER_TOO_LARGE');
    });

    test('should validate entity params object', () => {
      const dream = createValidDream();
      dream.entities[0].params = {
        speed: 2.5,
        glow: 0.8,
        size: 1.5,
        color: '#ff0000',
      };

      const result = DreamSchema.validate(dream);
      const paramsError = result.errors.find((e) =>
        e.field.includes('entities[0].params')
      );

      expect(paramsError).toBeUndefined();
    });

    test('should reject invalid color format in entity params', () => {
      const dream = createValidDream();
      dream.entities[0].params.color = 'red';

      const result = DreamSchema.validate(dream);
      const colorError = result.errors.find((e) =>
        e.field.includes('entities[0].params.color')
      );

      expect(colorError).toBeDefined();
      expect(colorError.error).toBe('PATTERN_MISMATCH');
    });

    test('should validate entity params numeric ranges', () => {
      const dream = createValidDream();
      dream.entities[0].params.speed = -1;

      const result = DreamSchema.validate(dream);
      const speedError = result.errors.find((e) =>
        e.field.includes('entities[0].params.speed')
      );

      expect(speedError).toBeDefined();
      expect(speedError.error).toBe('NUMBER_TOO_SMALL');
    });
  });

  describe('Cinematography Validation', () => {
    test('should accept valid cinematography', () => {
      const dream = createValidDream();
      const result = DreamSchema.validate(dream);
      const cinematographyError = result.errors.find((e) =>
        e.field.startsWith('cinematography')
      );

      expect(cinematographyError).toBeUndefined();
    });

    test('should reject cinematography with duration below minimum', () => {
      const dream = createValidDream();
      dream.cinematography.durationSec = 5;

      const result = DreamSchema.validate(dream);
      const durationError = result.errors.find((e) =>
        e.field.includes('cinematography.durationSec')
      );

      expect(durationError).toBeDefined();
      expect(durationError.error).toBe('NUMBER_TOO_SMALL');
    });

    test('should reject cinematography with duration above maximum', () => {
      const dream = createValidDream();
      dream.cinematography.durationSec = 150;

      const result = DreamSchema.validate(dream);
      const durationError = result.errors.find((e) =>
        e.field.includes('cinematography.durationSec')
      );

      expect(durationError).toBeDefined();
      expect(durationError.error).toBe('NUMBER_TOO_LARGE');
    });

    test('should reject cinematography with empty shots array', () => {
      const dream = createValidDream();
      dream.cinematography.shots = [];

      const result = DreamSchema.validate(dream);
      const shotsError = result.errors.find((e) =>
        e.field.includes('cinematography.shots')
      );

      expect(shotsError).toBeDefined();
      expect(shotsError.error).toBe('ARRAY_TOO_SHORT');
    });

    test('should validate shot type enum', () => {
      const dream = createValidDream();
      dream.cinematography.shots[0].type = 'invalid-shot-type';

      const result = DreamSchema.validate(dream);
      const typeError = result.errors.find((e) =>
        e.field.includes('cinematography.shots[0].type')
      );

      expect(typeError).toBeDefined();
      expect(typeError.error).toBe('INVALID_ENUM_VALUE');
    });

    test('should validate shot duration boundaries', () => {
      const dream = createValidDream();
      dream.cinematography.shots[0].duration = 1;

      const result = DreamSchema.validate(dream);
      const durationError = result.errors.find((e) =>
        e.field.includes('cinematography.shots[0].duration')
      );

      expect(durationError).toBeDefined();
      expect(durationError.error).toBe('NUMBER_TOO_SMALL');
    });

    test('should accept valid shot positions', () => {
      const dream = createValidDream();
      dream.cinematography.shots[0].startPos = [0, 10, 20];
      dream.cinematography.shots[0].endPos = [5, 15, 25];

      const result = DreamSchema.validate(dream);
      const posError = result.errors.find(
        (e) =>
          e.field.includes('cinematography.shots[0].startPos') ||
          e.field.includes('cinematography.shots[0].endPos')
      );

      expect(posError).toBeUndefined();
    });
  });

  describe('Environment Validation', () => {
    test('should accept valid environment', () => {
      const dream = createValidDream();
      const result = DreamSchema.validate(dream);
      const environmentError = result.errors.find((e) =>
        e.field.startsWith('environment')
      );

      expect(environmentError).toBeUndefined();
    });

    test('should validate environment preset enum', () => {
      const dream = createValidDream();
      dream.environment.preset = 'invalid-preset';

      const result = DreamSchema.validate(dream);
      const presetError = result.errors.find((e) =>
        e.field.includes('environment.preset')
      );

      expect(presetError).toBeDefined();
      expect(presetError.error).toBe('INVALID_ENUM_VALUE');
    });

    test('should validate fog density range', () => {
      const dream = createValidDream();
      dream.environment.fog = 1.5;

      const result = DreamSchema.validate(dream);
      const fogError = result.errors.find((e) =>
        e.field.includes('environment.fog')
      );

      expect(fogError).toBeDefined();
      expect(fogError.error).toBe('NUMBER_TOO_LARGE');
    });

    test('should validate skyColor format', () => {
      const dream = createValidDream();
      dream.environment.skyColor = 'blue';

      const result = DreamSchema.validate(dream);
      const skyColorError = result.errors.find((e) =>
        e.field.includes('environment.skyColor')
      );

      expect(skyColorError).toBeDefined();
      expect(skyColorError.error).toBe('PATTERN_MISMATCH');
    });

    test('should validate ambientLight range', () => {
      const dream = createValidDream();
      dream.environment.ambientLight = -0.5;

      const result = DreamSchema.validate(dream);
      const ambientLightError = result.errors.find((e) =>
        e.field.includes('environment.ambientLight')
      );

      expect(ambientLightError).toBeDefined();
      expect(ambientLightError.error).toBe('NUMBER_TOO_SMALL');
    });
  });

  describe('Render Configuration Validation', () => {
    test('should accept valid render config', () => {
      const dream = createValidDream();
      const result = DreamSchema.validate(dream);
      const renderError = result.errors.find((e) =>
        e.field.startsWith('render')
      );

      expect(renderError).toBeUndefined();
    });

    test('should validate resolution array', () => {
      const dream = createValidDream();
      dream.render.res = [1920]; // Only 1 element

      const result = DreamSchema.validate(dream);
      const resError = result.errors.find((e) =>
        e.field.includes('render.res')
      );

      expect(resError).toBeDefined();
      expect(resError.error).toBe('ARRAY_TOO_SHORT');
    });

    test('should validate fps enum', () => {
      const dream = createValidDream();
      dream.render.fps = 45;

      const result = DreamSchema.validate(dream);
      const fpsError = result.errors.find((e) =>
        e.field.includes('render.fps')
      );

      expect(fpsError).toBeDefined();
      expect(fpsError.error).toBe('INVALID_ENUM_VALUE');
    });

    test('should validate quality enum', () => {
      const dream = createValidDream();
      dream.render.quality = 'super-ultra';

      const result = DreamSchema.validate(dream);
      const qualityError = result.errors.find((e) =>
        e.field.includes('render.quality')
      );

      expect(qualityError).toBeDefined();
      expect(qualityError.error).toBe('INVALID_ENUM_VALUE');
    });
  });

  describe('Created Field Validation', () => {
    test('should accept valid ISO date string', () => {
      const dream = createValidDream();
      dream.created = '2024-01-15T10:30:00.000Z';

      const result = DreamSchema.validate(dream);
      const createdError = result.errors.find((e) => e.field === 'created');

      expect(createdError).toBeUndefined();
    });

    test('should reject invalid date format', () => {
      const dream = createValidDream();
      dream.created = '2024-01-15';

      const result = DreamSchema.validate(dream);
      const createdError = result.errors.find((e) => e.field === 'created');

      expect(createdError).toBeDefined();
      expect(createdError.error).toBe('PATTERN_MISMATCH');
    });
  });

  describe('Source Field Validation', () => {
    test('should accept valid source values', () => {
      const validSources = [
        'cerebras',
        'openai',
        'mock',
        'mcp-gateway',
        'express',
      ];

      validSources.forEach((source) => {
        const dream = createValidDream();
        dream.source = source;

        const result = DreamSchema.validate(dream);
        const sourceError = result.errors.find((e) => e.field === 'source');

        expect(sourceError).toBeUndefined();
      });
    });

    test('should reject invalid source value', () => {
      const dream = createValidDream();
      dream.source = 'unknown-source';

      const result = DreamSchema.validate(dream);
      const sourceError = result.errors.find((e) => e.field === 'source');

      expect(sourceError).toBeDefined();
      expect(sourceError.error).toBe('INVALID_ENUM_VALUE');
    });
  });

  describe('Standalone Validation Methods', () => {
    test('validateStructures should work independently', () => {
      const structures = [createValidStructure('struct-1')];
      const result = DreamSchema.validateStructures(structures);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validateEntities should work independently', () => {
      const entities = [createValidEntity('entity-1')];
      const result = DreamSchema.validateEntities(entities);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validateCinematography should work independently', () => {
      const cinematography = createValidCinematography();
      const result = DreamSchema.validateCinematography(cinematography);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validateEnvironment should work independently', () => {
      const environment = createValidEnvironment();
      const result = DreamSchema.validateEnvironment(environment);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validateRenderConfig should work independently', () => {
      const render = createValidRenderConfig();
      const result = DreamSchema.validateRenderConfig(render);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
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
