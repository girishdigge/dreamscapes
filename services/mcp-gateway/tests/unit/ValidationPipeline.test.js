// tests/unit/ValidationPipeline.test.js
// Unit tests for ValidationPipeline class

const { ValidationPipeline } = require('../../engine');
const SchemaValidator = require('../../engine/SchemaValidator');
const ContentRepair = require('../../engine/ContentRepair');
const QualityAssessment = require('../../engine/QualityAssessment');

describe('ValidationPipeline', () => {
  let validationPipeline;

  beforeEach(() => {
    const config = {
      validation: {
        enableSchemaValidation: true,
        enableContentValidation: true,
        enableQualityAssessment: true,
        strictMode: false,
      },
      repair: {
        enableAutoRepair: true,
        maxRepairAttempts: 3,
        repairStrategies: ['structure', 'content', 'format'],
      },
      quality: {
        minQualityScore: 0.7,
        enableDetailedAnalysis: true,
        qualityMetrics: ['completeness', 'relevance', 'structure'],
      },
    };

    validationPipeline = new ValidationPipeline(config);
  });

  describe('Schema Validation', () => {
    test('should validate correct dream response structure', async () => {
      const validResponse = {
        success: true,
        data: {
          title: 'Peaceful Garden Dream',
          description: 'A serene garden with flowing water',
          scenes: [
            {
              type: 'environment',
              description: 'Garden scene',
              mood: 'peaceful',
              lighting: 'soft',
              objects: [
                { type: 'tree', position: { x: 0, y: 0, z: 0 } },
                { type: 'water', position: { x: 5, y: 0, z: 3 } },
              ],
            },
          ],
          style: 'ethereal',
          metadata: {
            source: 'cerebras',
            confidence: 0.9,
          },
        },
      };

      const result = await validationPipeline.validateSchema(
        validResponse,
        'dreamResponse'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('should detect missing required fields', async () => {
      const invalidResponse = {
        success: true,
        data: {
          // Missing title
          description: 'A garden scene',
          scenes: [], // Empty scenes array
          // Missing style
        },
      };

      const result = await validationPipeline.validateSchema(
        invalidResponse,
        'dreamResponse'
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('title'))).toBe(true);
      expect(result.errors.some((e) => e.includes('style'))).toBe(true);
    });

    test('should detect invalid data types', async () => {
      const invalidResponse = {
        success: true,
        data: {
          title: 123, // Should be string
          description: 'Valid description',
          scenes: 'not-an-array', // Should be array
          style: 'ethereal',
        },
      };

      const result = await validationPipeline.validateSchema(
        invalidResponse,
        'dreamResponse'
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('title'))).toBe(true);
      expect(result.errors.some((e) => e.includes('scenes'))).toBe(true);
    });

    test('should validate scene structure', async () => {
      const responseWithInvalidScene = {
        success: true,
        data: {
          title: 'Test Dream',
          description: 'Test description',
          scenes: [
            {
              // Missing type
              description: 'Scene description',
              mood: 'peaceful',
              objects: [
                {
                  type: 'tree',
                  // Missing position
                },
              ],
            },
          ],
          style: 'ethereal',
        },
      };

      const result = await validationPipeline.validateSchema(
        responseWithInvalidScene,
        'dreamResponse'
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('type'))).toBe(true);
      expect(result.errors.some((e) => e.includes('position'))).toBe(true);
    });

    test('should provide detailed error locations', async () => {
      const invalidResponse = {
        success: true,
        data: {
          title: 'Test Dream',
          description: 'Test description',
          scenes: [
            {
              type: 'environment',
              description: 'Scene 1',
              mood: 'peaceful',
              objects: [
                {
                  type: 'tree',
                  position: { x: 'invalid', y: 0, z: 0 }, // x should be number
                },
              ],
            },
          ],
          style: 'ethereal',
        },
      };

      const result = await validationPipeline.validateSchema(
        invalidResponse,
        'dreamResponse'
      );

      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('scenes[0].objects[0].position.x'))
      ).toBe(true);
    });
  });

  describe('Content Validation', () => {
    test('should validate content relevance', async () => {
      const response = {
        data: {
          title: 'Garden Dream',
          description: 'A peaceful garden with flowers',
          scenes: [
            {
              type: 'environment',
              description: 'Garden scene with trees and flowers',
              mood: 'peaceful',
            },
          ],
        },
      };

      const context = {
        originalPrompt: 'I dreamed of a peaceful garden',
        style: 'ethereal',
      };

      const result = await validationPipeline.validateContent(
        response,
        context
      );

      expect(result.valid).toBe(true);
      expect(result.relevanceScore).toBeGreaterThan(0.7);
      expect(result.issues).toHaveLength(0);
    });

    test('should detect content mismatch', async () => {
      const response = {
        data: {
          title: 'Space Battle',
          description: 'Epic space battle with lasers',
          scenes: [
            {
              type: 'space',
              description: 'Spaceship battle scene',
              mood: 'intense',
            },
          ],
        },
      };

      const context = {
        originalPrompt: 'I dreamed of a peaceful garden',
        style: 'ethereal',
      };

      const result = await validationPipeline.validateContent(
        response,
        context
      );

      expect(result.valid).toBe(false);
      expect(result.relevanceScore).toBeLessThan(0.5);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should validate style consistency', async () => {
      const response = {
        data: {
          title: 'Cyberpunk City',
          description: 'Neon-lit futuristic cityscape',
          scenes: [
            {
              type: 'city',
              description: 'Cyberpunk street scene',
              mood: 'futuristic',
            },
          ],
          style: 'cyberpunk',
        },
      };

      const context = {
        originalPrompt: 'I dreamed of a futuristic city',
        style: 'cyberpunk',
      };

      const result = await validationPipeline.validateContent(
        response,
        context
      );

      expect(result.valid).toBe(true);
      expect(result.styleConsistency).toBeGreaterThan(0.8);
    });

    test('should check content completeness', async () => {
      const incompleteResponse = {
        data: {
          title: 'Incomplete Dream',
          description: '', // Empty description
          scenes: [
            {
              type: 'environment',
              description: 'Vague scene', // Too brief
              mood: 'unknown',
            },
          ],
        },
      };

      const context = {
        originalPrompt:
          'I dreamed of a detailed magical forest with mystical creatures',
        style: 'ethereal',
      };

      const result = await validationPipeline.validateContent(
        incompleteResponse,
        context
      );

      expect(result.valid).toBe(false);
      expect(result.completenessScore).toBeLessThan(0.6);
      expect(result.issues.some((i) => i.includes('description'))).toBe(true);
    });
  });

  describe('Quality Assessment', () => {
    test('should assess high-quality content', async () => {
      const highQualityResponse = {
        data: {
          title: 'Enchanted Forest Dream',
          description:
            'A mystical forest filled with ancient trees, glowing mushrooms, and ethereal light filtering through the canopy',
          scenes: [
            {
              type: 'environment',
              description:
                'Dense forest with towering oak trees, their branches intertwined to form a natural cathedral',
              mood: 'mystical',
              lighting: 'dappled sunlight with ethereal glow',
              objects: [
                {
                  type: 'tree',
                  position: { x: 0, y: 0, z: 0 },
                  properties: { species: 'oak', age: 'ancient' },
                },
                {
                  type: 'mushroom',
                  position: { x: 2, y: 0, z: 1 },
                  properties: { glow: true, color: 'blue' },
                },
              ],
            },
          ],
          style: 'ethereal',
        },
        metadata: {
          source: 'cerebras',
          confidence: 0.95,
        },
      };

      const assessment = await validationPipeline.assessQuality(
        highQualityResponse
      );

      expect(assessment.overallScore).toBeGreaterThan(0.8);
      expect(assessment.metrics.completeness).toBeGreaterThan(0.8);
      expect(assessment.metrics.detail).toBeGreaterThan(0.8);
      expect(assessment.metrics.creativity).toBeGreaterThan(0.7);
    });

    test('should assess low-quality content', async () => {
      const lowQualityResponse = {
        data: {
          title: 'Dream',
          description: 'A place',
          scenes: [
            {
              type: 'thing',
              description: 'Some stuff',
              mood: 'ok',
            },
          ],
          style: 'style',
        },
      };

      const assessment = await validationPipeline.assessQuality(
        lowQualityResponse
      );

      expect(assessment.overallScore).toBeLessThan(0.5);
      expect(assessment.metrics.completeness).toBeLessThan(0.5);
      expect(assessment.metrics.detail).toBeLessThan(0.5);
      expect(assessment.issues.length).toBeGreaterThan(0);
    });

    test('should provide detailed quality metrics', async () => {
      const response = {
        data: {
          title: 'Ocean Sunset Dream',
          description: 'A beautiful sunset over calm ocean waters',
          scenes: [
            {
              type: 'environment',
              description: 'Peaceful ocean scene at golden hour',
              mood: 'serene',
              lighting: 'golden sunset',
            },
          ],
          style: 'ethereal',
        },
      };

      const assessment = await validationPipeline.assessQuality(response);

      expect(assessment.metrics).toHaveProperty('completeness');
      expect(assessment.metrics).toHaveProperty('detail');
      expect(assessment.metrics).toHaveProperty('creativity');
      expect(assessment.metrics).toHaveProperty('coherence');
      expect(assessment.metrics).toHaveProperty('relevance');

      Object.values(assessment.metrics).forEach((score) => {
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Content Repair', () => {
    test('should repair missing required fields', async () => {
      const brokenResponse = {
        success: true,
        data: {
          // Missing title
          description: 'A garden scene',
          scenes: [
            {
              type: 'environment',
              description: 'Garden with flowers',
              // Missing mood
            },
          ],
          // Missing style
        },
      };

      const context = {
        originalPrompt: 'I dreamed of a peaceful garden',
        style: 'ethereal',
      };

      const result = await validationPipeline.repairContent(
        brokenResponse,
        context
      );

      expect(result.success).toBe(true);
      expect(result.repairedContent.data.title).toBeTruthy();
      expect(result.repairedContent.data.style).toBeTruthy();
      expect(result.repairedContent.data.scenes[0].mood).toBeTruthy();
      expect(result.appliedStrategies.length).toBeGreaterThan(0);
    });

    test('should repair malformed scene structure', async () => {
      const brokenResponse = {
        success: true,
        data: {
          title: 'Forest Dream',
          description: 'A forest scene',
          scenes: [
            {
              type: 'environment',
              description: 'Forest scene',
              mood: 'peaceful',
              objects: [
                {
                  type: 'tree',
                  // Missing position
                },
                {
                  // Missing type
                  position: { x: 1, y: 0, z: 1 },
                },
              ],
            },
          ],
          style: 'ethereal',
        },
      };

      const result = await validationPipeline.repairContent(brokenResponse);

      expect(result.success).toBe(true);
      expect(
        result.repairedContent.data.scenes[0].objects[0].position
      ).toBeTruthy();
      expect(
        result.repairedContent.data.scenes[0].objects[1].type
      ).toBeTruthy();
    });

    test('should enhance incomplete content', async () => {
      const incompleteResponse = {
        success: true,
        data: {
          title: 'Dream',
          description: 'A place',
          scenes: [
            {
              type: 'environment',
              description: 'Scene',
              mood: 'mood',
            },
          ],
          style: 'ethereal',
        },
      };

      const context = {
        originalPrompt:
          'I dreamed of a magical underwater kingdom with coral castles',
        style: 'ethereal',
      };

      const result = await validationPipeline.repairContent(
        incompleteResponse,
        context
      );

      expect(result.success).toBe(true);
      expect(result.repairedContent.data.title.length).toBeGreaterThan(5);
      expect(result.repairedContent.data.description.length).toBeGreaterThan(
        20
      );
      expect(
        result.repairedContent.data.scenes[0].description.length
      ).toBeGreaterThan(10);
    });

    test('should fix data type issues', async () => {
      const brokenResponse = {
        success: true,
        data: {
          title: 123, // Should be string
          description: 'Valid description',
          scenes: 'not-an-array', // Should be array
          style: 'ethereal',
        },
      };

      const result = await validationPipeline.repairContent(brokenResponse);

      expect(result.success).toBe(true);
      expect(typeof result.repairedContent.data.title).toBe('string');
      expect(Array.isArray(result.repairedContent.data.scenes)).toBe(true);
    });

    test('should handle unrepairable content', async () => {
      const completelyBrokenResponse = {
        // Missing success field
        data: null, // Null data
      };

      const result = await validationPipeline.repairContent(
        completelyBrokenResponse
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.remainingErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Full Pipeline Integration', () => {
    test('should validate and repair in sequence', async () => {
      const problematicResponse = {
        success: true,
        data: {
          title: 'Dream', // Too brief
          description: 'A place', // Too brief
          scenes: [
            {
              type: 'environment',
              description: 'Scene', // Too brief
              // Missing mood
              objects: [
                {
                  type: 'tree',
                  // Missing position
                },
              ],
            },
          ],
          // Missing style
        },
      };

      const context = {
        originalPrompt:
          'I dreamed of a serene mountain lake surrounded by pine trees',
        style: 'ethereal',
      };

      const result = await validationPipeline.validateAndRepair(
        problematicResponse,
        'dreamResponse',
        context
      );

      expect(result.success).toBe(true);
      expect(result.finalContent.data.title.length).toBeGreaterThan(5);
      expect(result.finalContent.data.style).toBeTruthy();
      expect(result.finalContent.data.scenes[0].mood).toBeTruthy();
      expect(
        result.finalContent.data.scenes[0].objects[0].position
      ).toBeTruthy();
      expect(result.validation.valid).toBe(false); // Initially invalid
      expect(result.repair.success).toBe(true); // But successfully repaired
    });

    test('should handle content that passes validation', async () => {
      const validResponse = {
        success: true,
        data: {
          title: 'Peaceful Mountain Lake',
          description:
            'A serene mountain lake surrounded by towering pine trees',
          scenes: [
            {
              type: 'environment',
              description:
                'Crystal clear lake reflecting snow-capped mountains',
              mood: 'peaceful',
              lighting: 'soft morning light',
              objects: [
                { type: 'tree', position: { x: 0, y: 0, z: 0 } },
                { type: 'water', position: { x: 5, y: 0, z: 3 } },
              ],
            },
          ],
          style: 'ethereal',
        },
      };

      const result = await validationPipeline.validateAndRepair(
        validResponse,
        'dreamResponse'
      );

      expect(result.success).toBe(true);
      expect(result.validation.valid).toBe(true);
      expect(result.repair).toBeNull(); // No repair needed
      expect(result.finalContent).toBe(validResponse); // Unchanged
    });

    test('should provide comprehensive metrics', async () => {
      const response = {
        success: true,
        data: {
          title: 'Test Dream',
          description: 'Test description',
          scenes: [
            {
              type: 'environment',
              description: 'Test scene',
              mood: 'test',
            },
          ],
          style: 'ethereal',
        },
      };

      const result = await validationPipeline.validateAndRepair(
        response,
        'dreamResponse'
      );

      expect(result.metrics).toBeTruthy();
      expect(result.metrics).toHaveProperty('validationTime');
      expect(result.metrics).toHaveProperty('repairTime');
      expect(result.metrics).toHaveProperty('totalTime');
      expect(result.metrics).toHaveProperty('qualityScore');
    });
  });

  describe('Performance and Metrics', () => {
    test('should track validation metrics', () => {
      const metrics = validationPipeline.getValidationMetrics();

      expect(metrics).toHaveProperty('totalValidations');
      expect(metrics).toHaveProperty('successfulValidations');
      expect(metrics).toHaveProperty('failedValidations');
      expect(metrics).toHaveProperty('averageValidationTime');
      expect(metrics).toHaveProperty('repairAttempts');
      expect(metrics).toHaveProperty('successfulRepairs');
    });

    test('should provide comprehensive metrics', () => {
      const comprehensiveMetrics = validationPipeline.getComprehensiveMetrics();

      expect(comprehensiveMetrics).toHaveProperty('validation');
      expect(comprehensiveMetrics).toHaveProperty('repair');
      expect(comprehensiveMetrics).toHaveProperty('quality');
      expect(comprehensiveMetrics).toHaveProperty('performance');
      expect(comprehensiveMetrics).toHaveProperty('errors');
    });

    test('should handle high-volume validation efficiently', async () => {
      const responses = [];
      for (let i = 0; i < 50; i++) {
        responses.push({
          success: true,
          data: {
            title: `Dream ${i}`,
            description: `Description ${i}`,
            scenes: [
              {
                type: 'environment',
                description: `Scene ${i}`,
                mood: 'test',
              },
            ],
            style: 'ethereal',
          },
        });
      }

      const startTime = Date.now();
      const results = await Promise.all(
        responses.map((response) =>
          validationPipeline.validateAndRepair(response, 'dreamResponse')
        )
      );
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(50);
      expect(results.every((r) => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Error Handling', () => {
    test('should handle null or undefined input', async () => {
      const result1 = await validationPipeline.validateAndRepair(
        null,
        'dreamResponse'
      );
      const result2 = await validationPipeline.validateAndRepair(
        undefined,
        'dreamResponse'
      );

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      expect(result1.error).toBeTruthy();
      expect(result2.error).toBeTruthy();
    });

    test('should handle invalid schema type', async () => {
      const response = { success: true, data: {} };

      const result = await validationPipeline.validateAndRepair(
        response,
        'invalidSchemaType'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown schema type');
    });

    test('should handle validation errors gracefully', async () => {
      // Mock a validation error
      const originalValidate = validationPipeline.schemaValidator.validate;
      validationPipeline.schemaValidator.validate = () => {
        throw new Error('Validation system error');
      };

      const response = { success: true, data: {} };
      const result = await validationPipeline.validateAndRepair(
        response,
        'dreamResponse'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation system error');

      // Restore original method
      validationPipeline.schemaValidator.validate = originalValidate;
    });
  });
});
