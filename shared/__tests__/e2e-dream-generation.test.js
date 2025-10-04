/**
 * End-to-End Dream Generation Integration Tests
 *
 * Tests complete dream generation flow from Express to frontend
 * Verifies data consistency across all service boundaries
 * Tests various prompt types and styles for complete generation
 *
 * Requirements: 5.1, 5.2, 5.4
 */

const axios = require('axios');
const { UnifiedValidator } = require('../index');

// Test configuration
const CONFIG = {
  expressUrl: process.env.EXPRESS_URL || 'http://localhost:8000',
  timeout: 30000,
  retries: 3,
  retryDelay: 2000,
};

// Test data for various dream styles
const TEST_DREAMS = [
  {
    name: 'Ethereal Dream',
    description: 'A peaceful garden with glowing flowers under a starlit sky',
    style: 'ethereal',
    expectedDuration: 20,
  },
  {
    name: 'Cyberpunk Dream',
    description:
      'Neon butterflies dance around a crystalline tower in a digital void',
    style: 'cyberpunk',
    expectedDuration: 25,
  },
  {
    name: 'Surreal Dream',
    description:
      'A house that grows like a tree with rooms as leaves, floating in cotton candy clouds',
    style: 'surreal',
    expectedDuration: 35,
  },
  {
    name: 'Fantasy Dream',
    description: 'A magical castle with floating towers and enchanted forests',
    style: 'fantasy',
    expectedDuration: 30,
  },
  {
    name: 'Nature Dream',
    description: 'A serene forest with ancient trees and mystical creatures',
    style: 'nature',
    expectedDuration: 25,
  },
];

describe('End-to-End Dream Generation Integration', () => {
  let validator;

  beforeAll(() => {
    validator = new UnifiedValidator({
      strictMode: true,
      logErrors: true,
    });
  });

  describe('Service Availability', () => {
    test('Express service should be available', async () => {
      try {
        const response = await axios.get(`${CONFIG.expressUrl}/health`, {
          timeout: CONFIG.timeout,
        });
        expect(response.status).toBe(200);
      } catch (error) {
        throw new Error(
          `Express service not available: ${error.message}. Make sure services are running.`
        );
      }
    });

    test('API documentation endpoint should be accessible', async () => {
      const response = await axios.get(`${CONFIG.expressUrl}/api`, {
        timeout: CONFIG.timeout,
      });
      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
    });
  });

  describe('Complete Dream Generation Flow', () => {
    TEST_DREAMS.forEach((testDream) => {
      describe(`${testDream.name} Generation`, () => {
        let generatedDream;
        let dreamId;

        test('should generate dream with complete structure', async () => {
          const response = await axios.post(
            `${CONFIG.expressUrl}/api/parse-dream`,
            {
              description: testDream.description,
              style: testDream.style,
              duration: testDream.expectedDuration,
            },
            {
              timeout: CONFIG.timeout,
              headers: { 'Content-Type': 'application/json' },
            }
          );

          expect(response.status).toBe(200);
          expect(response.data).toBeDefined();

          generatedDream = response.data;
          dreamId = generatedDream.id;

          // Verify basic structure
          expect(generatedDream).toHaveProperty('id');
          expect(generatedDream).toHaveProperty('title');
          expect(generatedDream).toHaveProperty('style');
          expect(generatedDream.style).toBe(testDream.style);
        });

        test('should have non-empty structures array', () => {
          expect(generatedDream).toHaveProperty('structures');
          expect(Array.isArray(generatedDream.structures)).toBe(true);
          expect(generatedDream.structures.length).toBeGreaterThan(0);

          // Verify each structure has required fields
          generatedDream.structures.forEach((structure, index) => {
            expect(structure).toHaveProperty('id');
            expect(structure).toHaveProperty('type');
            expect(structure).toHaveProperty('pos');
            expect(Array.isArray(structure.pos)).toBe(true);
            expect(structure.pos.length).toBe(3);
          });
        });

        test('should have non-empty entities array', () => {
          expect(generatedDream).toHaveProperty('entities');
          expect(Array.isArray(generatedDream.entities)).toBe(true);
          expect(generatedDream.entities.length).toBeGreaterThan(0);

          // Verify each entity has required fields
          generatedDream.entities.forEach((entity, index) => {
            expect(entity).toHaveProperty('id');
            expect(entity).toHaveProperty('type');
            expect(entity).toHaveProperty('count');
            expect(entity).toHaveProperty('params');
            expect(entity.count).toBeGreaterThan(0);
          });
        });

        test('should have complete cinematography configuration', () => {
          expect(generatedDream).toHaveProperty('cinematography');
          expect(generatedDream.cinematography).toHaveProperty('durationSec');
          expect(generatedDream.cinematography).toHaveProperty('shots');
          expect(Array.isArray(generatedDream.cinematography.shots)).toBe(true);
          expect(generatedDream.cinematography.shots.length).toBeGreaterThan(0);

          // Verify each shot has required fields
          generatedDream.cinematography.shots.forEach((shot, index) => {
            expect(shot).toHaveProperty('type');
            expect(shot).toHaveProperty('duration');
            expect(shot.duration).toBeGreaterThan(0);
          });
        });

        test('should have environment configuration', () => {
          expect(generatedDream).toHaveProperty('environment');
          expect(generatedDream.environment).toHaveProperty('preset');
          expect(generatedDream.environment).toHaveProperty('fog');
          expect(generatedDream.environment).toHaveProperty('skyColor');
          expect(generatedDream.environment).toHaveProperty('ambientLight');
        });

        test('should have render configuration', () => {
          expect(generatedDream).toHaveProperty('render');
          expect(generatedDream.render).toHaveProperty('res');
          expect(generatedDream.render).toHaveProperty('fps');
          expect(generatedDream.render).toHaveProperty('quality');
          expect(Array.isArray(generatedDream.render.res)).toBe(true);
          expect(generatedDream.render.res.length).toBe(2);
        });

        test('should pass unified validation', () => {
          const validationResult =
            validator.validateDreamObject(generatedDream);

          if (!validationResult.valid) {
            console.error('Validation errors:', validationResult.errors);
          }

          expect(validationResult.valid).toBe(true);
          expect(validationResult.errorCount).toBe(0);
        });

        test('should be renderable', () => {
          const renderCheck = validator.isRenderable(generatedDream);

          if (!renderCheck.renderable) {
            console.error('Renderability errors:', renderCheck.errors);
          }

          expect(renderCheck.renderable).toBe(true);
          expect(renderCheck.errorCount).toBe(0);
        });

        test('should have valid metadata', () => {
          expect(generatedDream).toHaveProperty('created');
          expect(generatedDream).toHaveProperty('source');
          expect(typeof generatedDream.created).toBe('string');
          expect(typeof generatedDream.source).toBe('string');
        });
      });
    });
  });

  describe('Data Consistency Across Service Boundaries', () => {
    test('should maintain data structure through multiple requests', async () => {
      const dream1Response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'A floating crystal palace in the clouds',
          style: 'ethereal',
          duration: 30,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const dream1 = dream1Response.data;

      // Make another request
      const dream2Response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'A neon city with flying cars',
          style: 'cyberpunk',
          duration: 25,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const dream2 = dream2Response.data;

      // Both dreams should have consistent structure
      const validation1 = validator.validateDreamObject(dream1);
      const validation2 = validator.validateDreamObject(dream2);

      expect(validation1.valid).toBe(true);
      expect(validation2.valid).toBe(true);

      // Both should have same field structure
      expect(Object.keys(dream1).sort()).toEqual(Object.keys(dream2).sort());
    });

    test('should handle concurrent requests consistently', async () => {
      const requests = TEST_DREAMS.slice(0, 3).map((testDream) =>
        axios.post(
          `${CONFIG.expressUrl}/api/parse-dream`,
          {
            description: testDream.description,
            style: testDream.style,
            duration: testDream.expectedDuration,
          },
          {
            timeout: CONFIG.timeout,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      const responses = await Promise.all(requests);

      // All responses should be valid
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();

        const validationResult = validator.validateDreamObject(response.data);
        expect(validationResult.valid).toBe(true);
      });

      // All dreams should have unique IDs
      const ids = responses.map((r) => r.data.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Style-Specific Generation', () => {
    const styles = ['ethereal', 'cyberpunk', 'surreal', 'fantasy', 'nature'];

    styles.forEach((style) => {
      test(`should generate valid ${style} style dream`, async () => {
        const response = await axios.post(
          `${CONFIG.expressUrl}/api/parse-dream`,
          {
            description: `A ${style} landscape with unique features`,
            style: style,
            duration: 25,
          },
          {
            timeout: CONFIG.timeout,
            headers: { 'Content-Type': 'application/json' },
          }
        );

        expect(response.status).toBe(200);
        const dream = response.data;

        expect(dream.style).toBe(style);

        const validationResult = validator.validateDreamObject(dream);
        expect(validationResult.valid).toBe(true);

        const renderCheck = validator.isRenderable(dream);
        expect(renderCheck.renderable).toBe(true);
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle minimum duration', async () => {
      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'A simple scene',
          style: 'ethereal',
          duration: 10, // Minimum duration
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(200);
      const dream = response.data;

      expect(dream.cinematography.durationSec).toBeGreaterThanOrEqual(10);

      const validationResult = validator.validateDreamObject(dream);
      expect(validationResult.valid).toBe(true);
    });

    test('should handle maximum duration', async () => {
      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'An epic journey through multiple realms',
          style: 'fantasy',
          duration: 120, // Maximum duration
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(200);
      const dream = response.data;

      expect(dream.cinematography.durationSec).toBeLessThanOrEqual(120);

      const validationResult = validator.validateDreamObject(dream);
      expect(validationResult.valid).toBe(true);
    });

    test('should handle very short descriptions', async () => {
      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'A dream',
          style: 'abstract',
          duration: 20,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(200);
      const dream = response.data;

      // Should still generate complete structure
      expect(dream.structures.length).toBeGreaterThan(0);
      expect(dream.entities.length).toBeGreaterThan(0);

      const validationResult = validator.validateDreamObject(dream);
      expect(validationResult.valid).toBe(true);
    });

    test('should handle very long descriptions', async () => {
      const longDescription =
        'A vast and intricate dreamscape featuring multiple floating islands connected by bridges of light, ' +
        'each island containing unique structures like crystal towers, organic trees, and geometric forms, ' +
        'populated by various entities including floating orbs, particle swarms, and energy beings, ' +
        'all set against a backdrop of swirling nebulae and distant stars, ' +
        'with dynamic lighting that shifts from dawn to dusk throughout the scene';

      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: longDescription,
          style: 'fantasy',
          duration: 60,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(200);
      const dream = response.data;

      const validationResult = validator.validateDreamObject(dream);
      expect(validationResult.valid).toBe(true);
    });
  });

  describe('API Response Format', () => {
    test('should return consistent response format', async () => {
      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'A test dream',
          style: 'ethereal',
          duration: 20,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.data).toBeDefined();
      expect(typeof response.data).toBe('object');
    });

    test('should include all required top-level fields', async () => {
      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'A test dream',
          style: 'ethereal',
          duration: 20,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const dream = response.data;
      const requiredFields = [
        'id',
        'title',
        'style',
        'structures',
        'entities',
        'cinematography',
        'environment',
        'render',
        'created',
        'source',
      ];

      requiredFields.forEach((field) => {
        expect(dream).toHaveProperty(field);
      });
    });
  });
});
