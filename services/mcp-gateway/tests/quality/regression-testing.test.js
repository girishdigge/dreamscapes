// tests/quality/regression-testing.test.js
// Regression testing for content generation consistency

const ProviderManager = require('../../providers/ProviderManager');
const { ValidationPipeline } = require('../../engine');
const PromptEngine = require('../../engine/PromptEngine');
const QualityAssessment = require('../../engine/QualityAssessment');
const {
  MockCerebrasProvider,
  MockOpenAIProvider,
} = require('../mocks/MockProviders');
const crypto = require('crypto');

describe('Regression Testing', () => {
  let providerManager;
  let validationPipeline;
  let promptEngine;
  let qualityAssessment;

  // Baseline test cases for regression testing
  const baselineTestCases = [
    {
      id: 'garden-ethereal',
      prompt:
        'I dreamed of a peaceful garden with flowing water and blooming flowers',
      style: 'ethereal',
      expectedElements: ['garden', 'water', 'flowers', 'peaceful'],
      minQualityScore: 0.7,
      maxScenes: 3,
    },
    {
      id: 'city-cyberpunk',
      prompt: 'I dreamed of a futuristic city with neon lights and flying cars',
      style: 'cyberpunk',
      expectedElements: ['city', 'neon', 'futuristic', 'technology'],
      minQualityScore: 0.7,
      maxScenes: 4,
    },
    {
      id: 'forest-surreal',
      prompt: 'I dreamed of a magical forest where trees whispered secrets',
      style: 'surreal',
      expectedElements: ['forest', 'trees', 'magical', 'whisper'],
      minQualityScore: 0.6,
      maxScenes: 3,
    },
    {
      id: 'ocean-cinematic',
      prompt: 'I dreamed of diving deep into an endless ocean',
      style: 'cinematic',
      expectedElements: ['ocean', 'deep', 'diving', 'water'],
      minQualityScore: 0.7,
      maxScenes: 5,
    },
    {
      id: 'library-ethereal',
      prompt: 'I dreamed of a vast library where books flew like birds',
      style: 'ethereal',
      expectedElements: ['library', 'books', 'flying', 'knowledge'],
      minQualityScore: 0.7,
      maxScenes: 3,
    },
  ];

  beforeAll(async () => {
    providerManager = new ProviderManager({
      providers: {
        cerebras: { enabled: true, priority: 1 },
        openai: { enabled: true, priority: 2 },
      },
      fallback: { enabled: true },
    });

    validationPipeline = new ValidationPipeline();
    promptEngine = new PromptEngine();
    qualityAssessment = new QualityAssessment();

    // Register providers with consistent behavior for regression testing
    providerManager.registerProvider(
      'cerebras',
      new MockCerebrasProvider({
        responseDelay: 100,
        failureRate: 0, // No failures for consistent testing
      })
    );
    providerManager.registerProvider(
      'openai',
      new MockOpenAIProvider({
        responseDelay: 150,
        failureRate: 0,
      })
    );
  });

  afterAll(async () => {
    if (providerManager) {
      await providerManager.shutdown();
    }
  });

  describe('Content Generation Consistency', () => {
    test('should generate consistent structure across multiple runs', async () => {
      const testCase = baselineTestCases[0]; // Garden ethereal
      const runs = 5;
      const results = [];

      for (let i = 0; i < runs; i++) {
        const prompt = promptEngine.buildDreamPrompt(
          testCase.prompt,
          testCase.style
        );
        const result = await providerManager.generateDream(prompt);

        expect(result.success).toBe(true);
        results.push(result.data);
      }

      // Verify structural consistency
      results.forEach((result) => {
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('scenes');
        expect(result).toHaveProperty('style');

        expect(typeof result.title).toBe('string');
        expect(typeof result.description).toBe('string');
        expect(Array.isArray(result.scenes)).toBe(true);
        expect(result.style).toBe(testCase.style);

        expect(result.title.length).toBeGreaterThan(5);
        expect(result.description.length).toBeGreaterThan(20);
        expect(result.scenes.length).toBeGreaterThan(0);
        expect(result.scenes.length).toBeLessThanOrEqual(testCase.maxScenes);
      });

      // Check for content diversity (shouldn't be identical)
      const titles = results.map((r) => r.title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBeGreaterThan(1); // Should have some variation

      // Check for consistent quality
      const qualityScores = [];
      for (const result of results) {
        const assessment = await qualityAssessment.assessContent(result, {
          originalPrompt: testCase.prompt,
          style: testCase.style,
        });
        qualityScores.push(assessment.overallScore);
      }

      const avgQuality =
        qualityScores.reduce((sum, score) => sum + score, 0) /
        qualityScores.length;
      const qualityVariance =
        qualityScores.reduce(
          (sum, score) => sum + Math.pow(score - avgQuality, 2),
          0
        ) / qualityScores.length;

      expect(avgQuality).toBeGreaterThan(testCase.minQualityScore);
      expect(qualityVariance).toBeLessThan(0.05); // Low variance indicates consistency
    });

    test('should maintain baseline quality across all test cases', async () => {
      const results = {};

      for (const testCase of baselineTestCases) {
        const prompt = promptEngine.buildDreamPrompt(
          testCase.prompt,
          testCase.style
        );
        const result = await providerManager.generateDream(prompt);

        expect(result.success).toBe(true);

        const assessment = await qualityAssessment.assessContent(result.data, {
          originalPrompt: testCase.prompt,
          style: testCase.style,
        });

        results[testCase.id] = {
          testCase,
          result: result.data,
          assessment,
          qualityScore: assessment.overallScore,
        };

        // Verify baseline quality requirements
        expect(assessment.overallScore).toBeGreaterThan(
          testCase.minQualityScore
        );

        // Verify expected elements are present
        const contentText = JSON.stringify(result.data).toLowerCase();
        testCase.expectedElements.forEach((element) => {
          expect(contentText).toContain(element.toLowerCase());
        });
      }

      // Log regression test results
      console.log('\nRegression Test Results:');
      Object.entries(results).forEach(([id, data]) => {
        console.log(
          `  ${id}: Quality ${data.qualityScore.toFixed(3)} (min: ${
            data.testCase.minQualityScore
          })`
        );
      });
    });

    test('should detect content regression between versions', async () => {
      // Simulate baseline results (in real scenario, these would be stored)
      const baselineResults = {};

      // Generate current results
      const currentResults = {};

      for (const testCase of baselineTestCases.slice(0, 3)) {
        // Test subset for performance
        // Generate baseline
        const baselinePrompt = promptEngine.buildDreamPrompt(
          testCase.prompt,
          testCase.style
        );
        const baselineResult = await providerManager.generateDream(
          baselinePrompt
        );
        const baselineAssessment = await qualityAssessment.assessContent(
          baselineResult.data,
          {
            originalPrompt: testCase.prompt,
            style: testCase.style,
          }
        );

        baselineResults[testCase.id] = {
          qualityScore: baselineAssessment.overallScore,
          relevanceScore: baselineAssessment.metrics.relevance,
          creativityScore: baselineAssessment.metrics.creativity,
          completenessScore: baselineAssessment.metrics.completeness,
        };

        // Generate current results (simulate slight variation)
        const currentPrompt = promptEngine.buildDreamPrompt(
          testCase.prompt,
          testCase.style
        );
        const currentResult = await providerManager.generateDream(
          currentPrompt
        );
        const currentAssessment = await qualityAssessment.assessContent(
          currentResult.data,
          {
            originalPrompt: testCase.prompt,
            style: testCase.style,
          }
        );

        currentResults[testCase.id] = {
          qualityScore: currentAssessment.overallScore,
          relevanceScore: currentAssessment.metrics.relevance,
          creativityScore: currentAssessment.metrics.creativity,
          completenessScore: currentAssessment.metrics.completeness,
        };
      }

      // Compare results and detect regressions
      const regressionThreshold = 0.1; // 10% degradation threshold
      const regressions = [];

      Object.keys(baselineResults).forEach((testId) => {
        const baseline = baselineResults[testId];
        const current = currentResults[testId];

        Object.keys(baseline).forEach((metric) => {
          const degradation = baseline[metric] - current[metric];
          const degradationPercent = degradation / baseline[metric];

          if (degradationPercent > regressionThreshold) {
            regressions.push({
              testId,
              metric,
              baseline: baseline[metric],
              current: current[metric],
              degradation: degradationPercent,
            });
          }
        });
      });

      // Log regression analysis
      if (regressions.length > 0) {
        console.log('\nDetected Regressions:');
        regressions.forEach((regression) => {
          console.log(
            `  ${regression.testId}.${
              regression.metric
            }: ${regression.baseline.toFixed(3)} → ${regression.current.toFixed(
              3
            )} (${(regression.degradation * 100).toFixed(1)}% degradation)`
          );
        });
      } else {
        console.log('\nNo significant regressions detected');
      }

      // For this test, we expect no major regressions
      expect(regressions.length).toBe(0);
    });
  });

  describe('Provider Consistency Testing', () => {
    test('should maintain consistent output quality across providers', async () => {
      const testPrompt =
        'I dreamed of a mystical mountain peak shrouded in clouds';
      const providerResults = {};

      for (const providerName of ['cerebras', 'openai']) {
        // Force specific provider
        const originalConfig = providerManager.config.providers;

        // Temporarily disable other providers
        Object.keys(originalConfig).forEach((name) => {
          providerManager.config.providers[name].enabled =
            name === providerName;
        });

        const prompt = promptEngine.buildDreamPrompt(testPrompt, 'ethereal');
        const result = await providerManager.generateDream(prompt);

        expect(result.success).toBe(true);
        expect(result.metadata.source).toBe(providerName);

        const assessment = await qualityAssessment.assessContent(result.data, {
          originalPrompt: testPrompt,
          style: 'ethereal',
        });

        providerResults[providerName] = {
          result: result.data,
          assessment,
          qualityScore: assessment.overallScore,
        };

        // Restore original config
        providerManager.config.providers = originalConfig;
      }

      // Compare provider results
      const providerNames = Object.keys(providerResults);
      const qualityScores = providerNames.map(
        (name) => providerResults[name].qualityScore
      );
      const qualityDifference =
        Math.max(...qualityScores) - Math.min(...qualityScores);

      console.log('\nProvider Consistency Results:');
      providerNames.forEach((name) => {
        console.log(
          `  ${name}: Quality ${providerResults[name].qualityScore.toFixed(3)}`
        );
      });
      console.log(`  Quality difference: ${qualityDifference.toFixed(3)}`);

      // Quality difference between providers should be reasonable
      expect(qualityDifference).toBeLessThan(0.3);

      // All providers should meet minimum quality
      qualityScores.forEach((score) => {
        expect(score).toBeGreaterThan(0.5);
      });
    });

    test('should handle provider fallback consistently', async () => {
      const testPrompt = 'I dreamed of a floating castle in the sky';
      const fallbackScenarios = [
        { failingProvider: 'cerebras', workingProvider: 'openai' },
        { failingProvider: 'openai', workingProvider: 'cerebras' },
      ];

      for (const scenario of fallbackScenarios) {
        // Make one provider fail
        const failingProvider = providerManager.getProvider(
          scenario.failingProvider
        );
        failingProvider.setFailureRate(1.0);

        const prompt = promptEngine.buildDreamPrompt(testPrompt, 'ethereal');
        const result = await providerManager.generateDream(prompt);

        expect(result.success).toBe(true);
        expect(result.metadata.source).toBe(scenario.workingProvider);

        const assessment = await qualityAssessment.assessContent(result.data, {
          originalPrompt: testPrompt,
          style: 'ethereal',
        });

        expect(assessment.overallScore).toBeGreaterThan(0.5);

        // Reset provider
        failingProvider.setFailureRate(0);
      }
    });
  });

  describe('Validation Pipeline Regression', () => {
    test('should maintain validation accuracy over time', async () => {
      const validationTestCases = [
        {
          name: 'valid-complete',
          content: {
            title: 'Complete Dream',
            description: 'A fully formed dream with all required elements',
            scenes: [
              {
                type: 'environment',
                description: 'Detailed scene description',
                mood: 'peaceful',
                lighting: 'soft',
                objects: [{ type: 'tree', position: { x: 0, y: 0, z: 0 } }],
              },
            ],
            style: 'ethereal',
          },
          expectedValid: true,
          expectedRepairNeeded: false,
        },
        {
          name: 'invalid-missing-fields',
          content: {
            // Missing title
            description: 'Incomplete dream',
            scenes: [], // Empty scenes
            // Missing style
          },
          expectedValid: false,
          expectedRepairNeeded: true,
        },
        {
          name: 'invalid-wrong-types',
          content: {
            title: 123, // Wrong type
            description: 'Dream with type errors',
            scenes: 'not-an-array', // Wrong type
            style: 'ethereal',
          },
          expectedValid: false,
          expectedRepairNeeded: true,
        },
      ];

      for (const testCase of validationTestCases) {
        const result = await validationPipeline.validateAndRepair(
          { success: true, data: testCase.content },
          'dreamResponse',
          { originalPrompt: 'test', style: 'ethereal' }
        );

        if (testCase.expectedValid) {
          expect(result.validation.valid).toBe(true);
          expect(result.repair).toBeNull();
        } else {
          expect(result.validation.valid).toBe(false);
          if (testCase.expectedRepairNeeded) {
            expect(result.repair).toBeTruthy();
            expect(result.success).toBe(true); // Should be repaired
          }
        }
      }
    });

    test('should maintain repair effectiveness', async () => {
      const repairTestCases = [
        {
          name: 'missing-title',
          brokenContent: {
            // title missing
            description: 'A dream without a title',
            scenes: [
              { type: 'environment', description: 'scene', mood: 'test' },
            ],
            style: 'ethereal',
          },
          expectedRepairs: ['title'],
        },
        {
          name: 'empty-scenes',
          brokenContent: {
            title: 'Dream with Empty Scenes',
            description: 'A dream with no scenes',
            scenes: [],
            style: 'ethereal',
          },
          expectedRepairs: ['scenes'],
        },
        {
          name: 'missing-object-positions',
          brokenContent: {
            title: 'Positioning Issues',
            description: 'Objects without positions',
            scenes: [
              {
                type: 'environment',
                description: 'Scene with positioning issues',
                mood: 'test',
                objects: [
                  { type: 'tree' }, // Missing position
                ],
              },
            ],
            style: 'ethereal',
          },
          expectedRepairs: ['position'],
        },
      ];

      for (const testCase of repairTestCases) {
        const result = await validationPipeline.validateAndRepair(
          { success: true, data: testCase.brokenContent },
          'dreamResponse',
          { originalPrompt: 'repair test', style: 'ethereal' }
        );

        expect(result.success).toBe(true);
        expect(result.repair).toBeTruthy();
        expect(result.repair.appliedStrategies.length).toBeGreaterThan(0);

        // Verify specific repairs were applied
        testCase.expectedRepairs.forEach((expectedRepair) => {
          const repairApplied = result.repair.appliedStrategies.some(
            (strategy) =>
              strategy.toLowerCase().includes(expectedRepair.toLowerCase())
          );
          expect(repairApplied).toBe(true);
        });

        // Final content should be valid
        const finalValidation = await validationPipeline.validateSchema(
          { success: true, data: result.finalContent.data },
          'dreamResponse'
        );
        expect(finalValidation.valid).toBe(true);
      }
    });
  });

  describe('Performance Regression Testing', () => {
    test('should maintain response time baselines', async () => {
      const performanceBaselines = {
        singleRequest: 500, // ms
        concurrentRequests: 2000, // ms for 10 concurrent
        validationTime: 100, // ms
      };

      // Single request performance
      const singleStart = Date.now();
      const prompt = promptEngine.buildDreamPrompt(
        'I dreamed of a performance test',
        'ethereal'
      );
      const singleResult = await providerManager.generateDream(prompt);
      const singleTime = Date.now() - singleStart;

      expect(singleResult.success).toBe(true);
      expect(singleTime).toBeLessThan(performanceBaselines.singleRequest);

      // Concurrent requests performance
      const concurrentPromises = [];
      const concurrentStart = Date.now();

      for (let i = 0; i < 10; i++) {
        const concurrentPrompt = promptEngine.buildDreamPrompt(
          `Concurrent test ${i}`,
          'ethereal'
        );
        concurrentPromises.push(
          providerManager.generateDream(concurrentPrompt)
        );
      }

      const concurrentResults = await Promise.all(concurrentPromises);
      const concurrentTime = Date.now() - concurrentStart;

      expect(concurrentResults.every((r) => r.success)).toBe(true);
      expect(concurrentTime).toBeLessThan(
        performanceBaselines.concurrentRequests
      );

      // Validation performance
      const validationStart = Date.now();
      await validationPipeline.validateAndRepair(singleResult, 'dreamResponse');
      const validationTime = Date.now() - validationStart;

      expect(validationTime).toBeLessThan(performanceBaselines.validationTime);

      console.log('\nPerformance Regression Results:');
      console.log(
        `  Single request: ${singleTime}ms (baseline: ${performanceBaselines.singleRequest}ms)`
      );
      console.log(
        `  Concurrent requests: ${concurrentTime}ms (baseline: ${performanceBaselines.concurrentRequests}ms)`
      );
      console.log(
        `  Validation: ${validationTime}ms (baseline: ${performanceBaselines.validationTime}ms)`
      );
    });

    test('should maintain memory usage baselines', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const prompt = promptEngine.buildDreamPrompt(
          `Memory test ${i}`,
          'ethereal'
        );
        const result = await providerManager.generateDream(prompt);
        expect(result.success).toBe(true);

        // Periodic cleanup
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryPerOperation = memoryIncrease / iterations;

      console.log(`\nMemory Usage Regression:`);
      console.log(
        `  Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(1)}MB`
      );
      console.log(
        `  Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(1)}MB`
      );
      console.log(`  Increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`);
      console.log(
        `  Per operation: ${(memoryPerOperation / 1024).toFixed(1)}KB`
      );

      // Memory increase should be reasonable
      expect(memoryPerOperation).toBeLessThan(50 * 1024); // Less than 50KB per operation
    });
  });

  describe('Data Integrity Regression', () => {
    test('should maintain data structure integrity', async () => {
      const testPrompt = 'I dreamed of a data integrity test scenario';
      const iterations = 10;
      const structureHashes = [];

      for (let i = 0; i < iterations; i++) {
        const prompt = promptEngine.buildDreamPrompt(testPrompt, 'ethereal');
        const result = await providerManager.generateDream(prompt);

        expect(result.success).toBe(true);

        // Create structure hash (ignoring content, focusing on structure)
        const structure = {
          hasTitle: !!result.data.title,
          hasDescription: !!result.data.description,
          hasScenes: Array.isArray(result.data.scenes),
          sceneCount: result.data.scenes?.length || 0,
          hasStyle: !!result.data.style,
          sceneStructure:
            result.data.scenes?.map((scene) => ({
              hasType: !!scene.type,
              hasDescription: !!scene.description,
              hasMood: !!scene.mood,
              hasObjects: Array.isArray(scene.objects),
              objectCount: scene.objects?.length || 0,
            })) || [],
        };

        const structureHash = crypto
          .createHash('md5')
          .update(JSON.stringify(structure))
          .digest('hex');

        structureHashes.push(structureHash);
      }

      // All structures should be identical
      const uniqueStructures = new Set(structureHashes);
      expect(uniqueStructures.size).toBe(1);

      console.log(
        `\nData Structure Integrity: ${
          uniqueStructures.size === 1 ? 'PASS' : 'FAIL'
        }`
      );
      console.log(
        `  Unique structures found: ${uniqueStructures.size} (expected: 1)`
      );
    });

    test('should maintain content format consistency', async () => {
      const formatTestCases = [
        { prompt: 'I dreamed of a simple test', expectedMinLength: 50 },
        {
          prompt: 'I dreamed of a complex multi-layered fantasy world',
          expectedMinLength: 100,
        },
      ];

      for (const testCase of formatTestCases) {
        const prompt = promptEngine.buildDreamPrompt(
          testCase.prompt,
          'ethereal'
        );
        const result = await providerManager.generateDream(prompt);

        expect(result.success).toBe(true);

        // Validate format consistency
        expect(typeof result.data.title).toBe('string');
        expect(typeof result.data.description).toBe('string');
        expect(typeof result.data.style).toBe('string');
        expect(Array.isArray(result.data.scenes)).toBe(true);

        expect(result.data.title.length).toBeGreaterThan(5);
        expect(result.data.description.length).toBeGreaterThan(
          testCase.expectedMinLength
        );
        expect(result.data.scenes.length).toBeGreaterThan(0);

        // Validate scene format consistency
        result.data.scenes.forEach((scene) => {
          expect(typeof scene.type).toBe('string');
          expect(typeof scene.description).toBe('string');
          expect(typeof scene.mood).toBe('string');

          if (scene.objects) {
            expect(Array.isArray(scene.objects)).toBe(true);
            scene.objects.forEach((obj) => {
              expect(typeof obj.type).toBe('string');
              expect(typeof obj.position).toBe('object');
              expect(typeof obj.position.x).toBe('number');
              expect(typeof obj.position.y).toBe('number');
              expect(typeof obj.position.z).toBe('number');
            });
          }
        });
      }
    });
  });
});
