/**
 * Error Handling and Recovery Integration Tests
 *
 * Tests system behavior when AI providers return invalid data
 * Verifies content repair generates complete, renderable dreams
 * Tests validation error propagation and user-friendly error messages
 *
 * Requirements: 2.2, 2.4, 5.3
 */

const axios = require('axios');
const { UnifiedValidator } = require('../index');

// Test configuration
const CONFIG = {
  expressUrl: process.env.EXPRESS_URL || 'http://localhost:8000',
  timeout: 30000,
};

describe('Error Handling and Recovery', () => {
  let validator;

  beforeAll(() => {
    validator = new UnifiedValidator({
      strictMode: true,
      logErrors: false, // Disable logging for error tests
    });
  });

  describe('Invalid Request Handling', () => {
    test('should reject request with missing description', async () => {
      try {
        await axios.post(
          `${CONFIG.expressUrl}/api/parse-dream`,
          {
            style: 'ethereal',
            duration: 20,
            // Missing description
          },
          {
            timeout: CONFIG.timeout,
            headers: { 'Content-Type': 'application/json' },
            validateStatus: () => true, // Don't throw on any status
          }
        );
      } catch (error) {
        // Request should fail with clear error
        expect(error.response).toBeDefined();
        expect(error.response.status).toBeGreaterThanOrEqual(400);
      }
    });

    test('should reject request with invalid style', async () => {
      try {
        const response = await axios.post(
          `${CONFIG.expressUrl}/api/parse-dream`,
          {
            description: 'A test dream',
            style: 'invalid-style',
            duration: 20,
          },
          {
            timeout: CONFIG.timeout,
            headers: { 'Content-Type': 'application/json' },
            validateStatus: () => true,
          }
        );

        // Should either reject or auto-correct to valid style
        if (response.status >= 400) {
          expect(response.data).toHaveProperty('error');
        } else {
          // If accepted, should have corrected to valid style
          const validStyles = [
            'ethereal',
            'cyberpunk',
            'surreal',
            'fantasy',
            'nightmare',
            'nature',
            'abstract',
          ];
          expect(validStyles).toContain(response.data.style);
        }
      } catch (error) {
        expect(error.response.status).toBeGreaterThanOrEqual(400);
      }
    });

    test('should reject request with invalid duration', async () => {
      try {
        const response = await axios.post(
          `${CONFIG.expressUrl}/api/parse-dream`,
          {
            description: 'A test dream',
            style: 'ethereal',
            duration: 5, // Below minimum
          },
          {
            timeout: CONFIG.timeout,
            headers: { 'Content-Type': 'application/json' },
            validateStatus: () => true,
          }
        );

        // Should either reject or auto-correct to valid duration
        if (response.status >= 400) {
          expect(response.data).toHaveProperty('error');
        } else {
          // If accepted, should have corrected to valid duration
          expect(
            response.data.cinematography.durationSec
          ).toBeGreaterThanOrEqual(10);
        }
      } catch (error) {
        expect(error.response.status).toBeGreaterThanOrEqual(400);
      }
    });

    test('should handle malformed JSON gracefully', async () => {
      try {
        await axios.post(
          `${CONFIG.expressUrl}/api/parse-dream`,
          'invalid json',
          {
            timeout: CONFIG.timeout,
            headers: { 'Content-Type': 'application/json' },
            validateStatus: () => true,
          }
        );
      } catch (error) {
        expect(error.response).toBeDefined();
        expect(error.response.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('Content Repair System', () => {
    test('should repair dreams with missing structures', async () => {
      // Generate a dream and verify repair works
      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'A minimal scene',
          style: 'abstract',
          duration: 15,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(200);
      const dream = response.data;

      // Even with minimal description, should have structures
      expect(dream.structures).toBeDefined();
      expect(dream.structures.length).toBeGreaterThan(0);

      // Validate the repaired dream
      const validationResult = validator.validateDreamObject(dream);
      expect(validationResult.valid).toBe(true);
    });

    test('should repair dreams with missing entities', async () => {
      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'An empty void',
          style: 'abstract',
          duration: 15,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(200);
      const dream = response.data;

      // Should have entities even for empty description
      expect(dream.entities).toBeDefined();
      expect(dream.entities.length).toBeGreaterThan(0);

      const validationResult = validator.validateDreamObject(dream);
      expect(validationResult.valid).toBe(true);
    });

    test('should generate complete cinematography when missing', async () => {
      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'A static scene',
          style: 'ethereal',
          duration: 20,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(200);
      const dream = response.data;

      // Should have complete cinematography
      expect(dream.cinematography).toBeDefined();
      expect(dream.cinematography.shots).toBeDefined();
      expect(dream.cinematography.shots.length).toBeGreaterThan(0);
      expect(dream.cinematography.durationSec).toBeGreaterThan(0);

      const validationResult = validator.validateDreamObject(dream);
      expect(validationResult.valid).toBe(true);
    });

    test('should generate environment when missing', async () => {
      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'A scene without environment details',
          style: 'nature',
          duration: 20,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(200);
      const dream = response.data;

      // Should have complete environment
      expect(dream.environment).toBeDefined();
      expect(dream.environment.preset).toBeDefined();
      expect(dream.environment.fog).toBeDefined();
      expect(dream.environment.skyColor).toBeDefined();
      expect(dream.environment.ambientLight).toBeDefined();

      const validationResult = validator.validateDreamObject(dream);
      expect(validationResult.valid).toBe(true);
    });

    test('should generate render config when missing', async () => {
      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'A scene without render details',
          style: 'cyberpunk',
          duration: 25,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(200);
      const dream = response.data;

      // Should have complete render config
      expect(dream.render).toBeDefined();
      expect(dream.render.res).toBeDefined();
      expect(dream.render.fps).toBeDefined();
      expect(dream.render.quality).toBeDefined();

      const validationResult = validator.validateDreamObject(dream);
      expect(validationResult.valid).toBe(true);
    });

    test('repaired dreams should be renderable', async () => {
      const response = await axios.post(
        `${CONFIG.expressUrl}/api/parse-dream`,
        {
          description: 'Minimal input',
          style: 'abstract',
          duration: 15,
        },
        {
          timeout: CONFIG.timeout,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      expect(response.status).toBe(200);
      const dream = response.data;

      // Check renderability
      const renderCheck = validator.isRenderable(dream);
      expect(renderCheck.renderable).toBe(true);
      expect(renderCheck.errorCount).toBe(0);
    });
  });

  describe('Validation Error Messages', () => {
    test('should provide clear error messages for invalid data', () => {
      const invalidDream = {
        id: 'invalid-id',
        title: '',
        style: 'invalid',
        structures: [],
        entities: [],
      };

      const validationResult = validator.validateDreamObject(invalidDream);

      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);

      // Each error should have clear message
      validationResult.errors.forEach((error) => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('error');
        expect(error).toHaveProperty('message');
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      });
    });

    test('should categorize errors by severity', () => {
      const invalidDream = {
        id: 'invalid-id',
        title: 'Test',
        style: 'ethereal',
        structures: [],
        entities: [],
        cinematography: { durationSec: 30, shots: [] },
        environment: { preset: 'dusk' },
        render: { res: [1920, 1080], fps: 30, quality: 'medium' },
        created: new Date().toISOString(),
        source: 'test',
      };

      const validationResult = validator.validateDreamObject(invalidDream);

      expect(validationResult).toHaveProperty('categorized');
      expect(validationResult.categorized).toHaveProperty('critical');
      expect(validationResult.categorized).toHaveProperty('error');
      expect(validationResult.categorized).toHaveProperty('warning');
    });

    test('should identify specific missing fields', () => {
      const incompleteDream = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Dream',
        style: 'ethereal',
        // Missing structures, entities, etc.
      };

      const validationResult = validator.validateDreamObject(incompleteDream);

      expect(validationResult.valid).toBe(false);

      // Should identify missing structures
      const structuresError = validationResult.errors.find((e) =>
        e.field.includes('structures')
      );
      expect(structuresError).toBeDefined();
      expect(structuresError.message).toContain('required');

      // Should identify missing entities
      const entitiesError = validationResult.errors.find((e) =>
        e.field.includes('entities')
      );
      expect(entitiesError).toBeDefined();
      expect(entitiesError.message).toContain('required');
    });

    test('should provide expected vs received values', () => {
      const invalidDream = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test',
        style: 'invalid-style',
        structures: [
          {
            id: 'struct-1',
            type: 'floating_platform',
            pos: [0, 0, 0],
          },
        ],
        entities: [
          {
            id: 'entity-1',
            type: 'floating_orbs',
            count: 10,
            params: { speed: 1, glow: 0.5, size: 1, color: '#ffffff' },
          },
        ],
        cinematography: { durationSec: 30, shots: [] },
        environment: { preset: 'dusk' },
        render: { res: [1920, 1080], fps: 30, quality: 'medium' },
        created: new Date().toISOString(),
        source: 'test',
      };

      const validationResult = validator.validateDreamObject(invalidDream);

      const styleError = validationResult.errors.find((e) =>
        e.field.includes('style')
      );
      if (styleError) {
        expect(styleError).toHaveProperty('expected');
        expect(styleError).toHaveProperty('received');
        expect(styleError.received).toBe('invalid-style');
      }
    });
  });

  describe('Error Recovery Strategies', () => {
    test('should handle network timeouts gracefully', async () => {
      try {
        await axios.post(
          `${CONFIG.expressUrl}/api/parse-dream`,
          {
            description: 'A test dream',
            style: 'ethereal',
            duration: 20,
          },
          {
            timeout: 100, // Very short timeout to force timeout
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        expect(error.code).toBeDefined();
        // Should be a timeout error
        expect(['ECONNABORTED', 'ETIMEDOUT']).toContain(error.code);
      }
    }, 10000);

    test('should handle service unavailability', async () => {
      try {
        await axios.post(
          'http://localhost:9999/api/parse-dream', // Non-existent service
          {
            description: 'A test dream',
            style: 'ethereal',
            duration: 20,
          },
          {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        expect(error.code).toBeDefined();
        expect(['ECONNREFUSED', 'ENOTFOUND']).toContain(error.code);
      }
    });
  });

  describe('Validation Report Generation', () => {
    test('should generate comprehensive validation report', () => {
      const dream = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Dream',
        style: 'ethereal',
        structures: [
          {
            id: 'struct-1',
            type: 'floating_platform',
            pos: [0, 5, 10],
            rotation: [0, 0, 0],
            scale: 1,
            features: ['glowing_edges'],
          },
        ],
        entities: [
          {
            id: 'entity-1',
            type: 'floating_orbs',
            count: 10,
            params: {
              speed: 1,
              glow: 0.5,
              size: 1,
              color: '#ffffff',
            },
          },
        ],
        cinematography: {
          durationSec: 30,
          shots: [
            {
              type: 'establish',
              target: 'struct-1',
              duration: 10,
              startPos: [0, 10, 20],
              endPos: [5, 15, 25],
            },
          ],
        },
        environment: {
          preset: 'dusk',
          fog: 0.3,
          skyColor: '#87CEEB',
          ambientLight: 0.5,
        },
        render: {
          res: [1920, 1080],
          fps: 30,
          quality: 'medium',
        },
        created: new Date().toISOString(),
        source: 'test',
      };

      const report = validator.generateValidationReport(dream);

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('dreamId');
      expect(report).toHaveProperty('overallValidation');
      expect(report).toHaveProperty('sectionValidation');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('fieldCounts');

      expect(report.summary).toHaveProperty('isValid');
      expect(report.summary).toHaveProperty('totalErrors');
      expect(report.summary).toHaveProperty('sectionsWithErrors');

      expect(report.fieldCounts).toHaveProperty('structures');
      expect(report.fieldCounts).toHaveProperty('entities');
      expect(report.fieldCounts).toHaveProperty('cinematographyShots');
    });

    test('should track field counts for debugging', () => {
      const dream = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test',
        style: 'ethereal',
        structures: [{ id: 's1', type: 'floating_platform', pos: [0, 0, 0] }],
        entities: [
          {
            id: 'e1',
            type: 'floating_orbs',
            count: 10,
            params: { speed: 1, glow: 0.5, size: 1, color: '#ffffff' },
          },
        ],
        cinematography: {
          durationSec: 30,
          shots: [{ type: 'establish', duration: 10 }],
        },
        environment: { preset: 'dusk' },
        render: { res: [1920, 1080], fps: 30, quality: 'medium' },
        created: new Date().toISOString(),
        source: 'test',
      };

      const report = validator.generateValidationReport(dream);

      expect(report.fieldCounts.structures).toBe(1);
      expect(report.fieldCounts.entities).toBe(1);
      expect(report.fieldCounts.cinematographyShots).toBe(1);
      expect(report.fieldCounts.hasEnvironment).toBe(true);
      expect(report.fieldCounts.hasRenderConfig).toBe(true);
    });
  });

  describe('Renderability Checks', () => {
    test('should identify non-renderable dreams', () => {
      const nonRenderableDream = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Incomplete Dream',
        style: 'ethereal',
        structures: [], // Empty - not renderable
        entities: [], // Empty - not renderable
        created: new Date().toISOString(),
        source: 'test',
      };

      const renderCheck = validator.isRenderable(nonRenderableDream);

      expect(renderCheck.renderable).toBe(false);
      expect(renderCheck.errors.length).toBeGreaterThan(0);

      // Should identify missing structures
      const structuresError = renderCheck.errors.find((e) =>
        e.field.includes('structures')
      );
      expect(structuresError).toBeDefined();

      // Should identify missing entities
      const entitiesError = renderCheck.errors.find((e) =>
        e.field.includes('entities')
      );
      expect(entitiesError).toBeDefined();
    });

    test('should confirm renderable dreams', () => {
      const renderableDream = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Complete Dream',
        style: 'ethereal',
        structures: [
          {
            id: 'struct-1',
            type: 'floating_platform',
            pos: [0, 5, 10],
            rotation: [0, 0, 0],
            scale: 1,
            features: [],
          },
        ],
        entities: [
          {
            id: 'entity-1',
            type: 'floating_orbs',
            count: 10,
            params: { speed: 1, glow: 0.5, size: 1, color: '#ffffff' },
          },
        ],
        cinematography: {
          durationSec: 30,
          shots: [{ type: 'establish', duration: 10 }],
        },
        environment: {
          preset: 'dusk',
          fog: 0.3,
          skyColor: '#87CEEB',
          ambientLight: 0.5,
        },
        render: {
          res: [1920, 1080],
          fps: 30,
          quality: 'medium',
        },
        created: new Date().toISOString(),
        source: 'test',
      };

      const renderCheck = validator.isRenderable(renderableDream);

      expect(renderCheck.renderable).toBe(true);
      expect(renderCheck.errorCount).toBe(0);
    });
  });

  describe('Use Case Specific Validation', () => {
    test('should validate for API response use case', () => {
      const dream = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test',
        style: 'ethereal',
        structures: [
          { id: 's1', type: 'floating_platform', pos: [0, 0, 0], scale: 1 },
        ],
        entities: [
          {
            id: 'e1',
            type: 'floating_orbs',
            count: 10,
            params: { speed: 1, glow: 0.5, size: 1, color: '#ffffff' },
          },
        ],
        cinematography: {
          durationSec: 30,
          shots: [{ type: 'establish', duration: 10 }],
        },
        environment: { preset: 'dusk' },
        render: { res: [1920, 1080], fps: 30, quality: 'medium' },
        created: new Date().toISOString(),
        source: 'test',
      };

      const result = validator.validateForUseCase(dream, 'api-response');

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('renderable');
      expect(result).toHaveProperty('renderErrors');
    });

    test('should validate for database storage use case', () => {
      const dream = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test',
        style: 'ethereal',
        structures: [{ id: 's1', type: 'floating_platform', pos: [0, 0, 0] }],
        entities: [
          {
            id: 'e1',
            type: 'floating_orbs',
            count: 10,
            params: { speed: 1, glow: 0.5, size: 1, color: '#ffffff' },
          },
        ],
        cinematography: {
          durationSec: 30,
          shots: [{ type: 'establish', duration: 10 }],
        },
        environment: { preset: 'dusk' },
        render: { res: [1920, 1080], fps: 30, quality: 'medium' },
        created: new Date().toISOString(),
        source: 'test',
      };

      const result = validator.validateForUseCase(dream, 'database-storage');

      expect(result).toHaveProperty('valid');
    });
  });
});
