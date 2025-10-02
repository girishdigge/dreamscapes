// tests/quality/content-quality-assessment.test.js
// Automated content quality assessment tests

const QualityAssessment = require('../../engine/QualityAssessment');
const ProviderManager = require('../../providers/ProviderManager');
const PromptEngine = require('../../engine/PromptEngine');
const {
  MockCerebrasProvider,
  MockOpenAIProvider,
} = require('../mocks/MockProviders');

describe('Content Quality Assessment', () => {
  let qualityAssessment;
  let providerManager;
  let promptEngine;

  beforeAll(() => {
    qualityAssessment = new QualityAssessment({
      metrics: {
        completeness: { weight: 0.25, threshold: 0.7 },
        relevance: { weight: 0.3, threshold: 0.8 },
        creativity: { weight: 0.2, threshold: 0.6 },
        coherence: { weight: 0.15, threshold: 0.7 },
        detail: { weight: 0.1, threshold: 0.6 },
      },
      enableDetailedAnalysis: true,
      enableSemanticAnalysis: true,
    });

    providerManager = new ProviderManager({
      providers: {
        cerebras: { enabled: true, priority: 1 },
        openai: { enabled: true, priority: 2 },
      },
    });

    providerManager.registerProvider('cerebras', new MockCerebrasProvider());
    providerManager.registerProvider('openai', new MockOpenAIProvider());

    promptEngine = new PromptEngine();
  });

  afterAll(async () => {
    if (providerManager) {
      await providerManager.shutdown();
    }
  });

  describe('Quality Metrics Assessment', () => {
    test('should assess high-quality content correctly', async () => {
      const highQualityContent = {
        title: 'The Enchanted Library of Whispered Dreams',
        description:
          'A magnificent library where ancient tomes float gracefully through the air, their pages rustling with the whispers of forgotten stories. Ethereal light filters through stained glass windows, casting rainbow patterns across marble floors where puddles of liquid starlight collect the fallen words.',
        scenes: [
          {
            type: 'environment',
            description:
              'The grand hall stretches impossibly high, with shelves that spiral into misty heights. Books with glowing spines drift like gentle birds, occasionally opening to release streams of golden letters that dance in the air before settling into new stories.',
            mood: 'mystical',
            lighting: 'ethereal golden light filtering through stained glass',
            objects: [
              {
                type: 'floating_book',
                position: { x: 2, y: 3, z: 1 },
                properties: {
                  glow: true,
                  pages: 'rustling',
                  content: 'ancient wisdom',
                },
              },
              {
                type: 'light_beam',
                position: { x: 0, y: 5, z: 0 },
                properties: {
                  color: 'rainbow',
                  intensity: 'soft',
                  source: 'stained_glass',
                },
              },
              {
                type: 'word_puddle',
                position: { x: 1, y: 0, z: 2 },
                properties: {
                  substance: 'liquid_starlight',
                  content: 'fallen_words',
                },
              },
            ],
          },
          {
            type: 'character',
            description:
              'A wise librarian with silver hair that seems to contain tiny stars, wearing robes that shift color like aurora borealis. They move silently between the floating books, occasionally catching falling words in crystal vials.',
            mood: 'serene',
            lighting: 'soft aurora glow from robes',
            objects: [
              {
                type: 'crystal_vial',
                position: { x: 0, y: 1, z: 0 },
                properties: { contents: 'captured_words', glow: 'soft_blue' },
              },
            ],
          },
        ],
        style: 'ethereal',
      };

      const assessment = await qualityAssessment.assessContent(
        highQualityContent,
        {
          originalPrompt:
            'I dreamed of a magical library where books flew like birds and words fell like rain',
          style: 'ethereal',
        }
      );

      expect(assessment.overallScore).toBeGreaterThan(0.8);
      expect(assessment.metrics.completeness).toBeGreaterThan(0.8);
      expect(assessment.metrics.relevance).toBeGreaterThan(0.8);
      expect(assessment.metrics.creativity).toBeGreaterThan(0.7);
      expect(assessment.metrics.coherence).toBeGreaterThan(0.8);
      expect(assessment.metrics.detail).toBeGreaterThan(0.8);
      expect(assessment.issues).toHaveLength(0);
      expect(assessment.strengths.length).toBeGreaterThan(3);
    });

    test('should identify low-quality content', async () => {
      const lowQualityContent = {
        title: 'Dream',
        description: 'A place with stuff',
        scenes: [
          {
            type: 'thing',
            description: 'Some stuff happens',
            mood: 'ok',
            lighting: 'light',
            objects: [
              {
                type: 'object',
                position: { x: 0, y: 0, z: 0 },
                properties: {},
              },
            ],
          },
        ],
        style: 'style',
      };

      const assessment = await qualityAssessment.assessContent(
        lowQualityContent,
        {
          originalPrompt:
            'I dreamed of a magnificent underwater kingdom with coral castles and sea creatures',
          style: 'ethereal',
        }
      );

      expect(assessment.overallScore).toBeLessThan(0.4);
      expect(assessment.metrics.completeness).toBeLessThan(0.5);
      expect(assessment.metrics.relevance).toBeLessThan(0.3);
      expect(assessment.metrics.creativity).toBeLessThan(0.3);
      expect(assessment.metrics.detail).toBeLessThan(0.3);
      expect(assessment.issues.length).toBeGreaterThan(5);
      expect(assessment.strengths).toHaveLength(0);
    });

    test('should assess content relevance to original prompt', async () => {
      const testCases = [
        {
          prompt: 'I dreamed of a peaceful garden',
          content: {
            title: 'Serene Garden Paradise',
            description:
              'A tranquil garden with blooming flowers and gentle streams',
            scenes: [
              {
                type: 'garden',
                description: 'Peaceful garden scene',
                mood: 'tranquil',
              },
            ],
          },
          expectedRelevance: 0.9,
        },
        {
          prompt: 'I dreamed of a peaceful garden',
          content: {
            title: 'Space Battle Explosion',
            description: 'Epic space battle with laser cannons and explosions',
            scenes: [
              { type: 'space', description: 'Battle scene', mood: 'intense' },
            ],
          },
          expectedRelevance: 0.1,
        },
        {
          prompt: 'I dreamed of flying through clouds',
          content: {
            title: 'Aerial Cloud Journey',
            description: 'Soaring through fluffy white clouds in the sky',
            scenes: [
              {
                type: 'sky',
                description: 'Flying through clouds',
                mood: 'free',
              },
            ],
          },
          expectedRelevance: 0.9,
        },
      ];

      for (const testCase of testCases) {
        const assessment = await qualityAssessment.assessContent(
          testCase.content,
          {
            originalPrompt: testCase.prompt,
            style: 'ethereal',
          }
        );

        expect(assessment.metrics.relevance).toBeCloseTo(
          testCase.expectedRelevance,
          1
        );
      }
    });

    test('should assess style consistency', async () => {
      const styleTestCases = [
        {
          style: 'ethereal',
          content: {
            title: 'Ethereal Dream Realm',
            description:
              'A mystical realm with soft glowing lights and floating elements',
            scenes: [
              {
                type: 'environment',
                description: 'Soft, glowing environment with ethereal beauty',
                mood: 'mystical',
                lighting: 'soft ethereal glow',
              },
            ],
          },
          expectedConsistency: 0.9,
        },
        {
          style: 'cyberpunk',
          content: {
            title: 'Neon City Streets',
            description:
              'Dark urban landscape with neon lights and futuristic technology',
            scenes: [
              {
                type: 'city',
                description:
                  'Cyberpunk street with neon signs and holographic displays',
                mood: 'gritty',
                lighting: 'neon and artificial lights',
              },
            ],
          },
          expectedConsistency: 0.9,
        },
        {
          style: 'ethereal',
          content: {
            title: 'Industrial Factory',
            description: 'Loud, mechanical factory with smoke and machinery',
            scenes: [
              {
                type: 'factory',
                description: 'Noisy industrial environment',
                mood: 'harsh',
                lighting: 'harsh fluorescent',
              },
            ],
          },
          expectedConsistency: 0.2,
        },
      ];

      for (const testCase of styleTestCases) {
        const assessment = await qualityAssessment.assessContent(
          testCase.content,
          {
            originalPrompt: 'test prompt',
            style: testCase.style,
          }
        );

        expect(assessment.styleConsistency).toBeCloseTo(
          testCase.expectedConsistency,
          1
        );
      }
    });
  });

  describe('Automated Quality Benchmarking', () => {
    test('should benchmark provider quality consistently', async () => {
      const testPrompts = [
        'I dreamed of a serene mountain lake surrounded by pine trees',
        'I dreamed of a bustling marketplace in an ancient city',
        'I dreamed of floating islands connected by rainbow bridges',
        'I dreamed of an underwater palace made of coral and pearls',
        'I dreamed of a library where books write themselves',
      ];

      const providerQualityScores = {};

      for (const provider of ['cerebras', 'openai']) {
        const scores = [];

        for (const promptText of testPrompts) {
          const prompt = promptEngine.buildDreamPrompt(promptText, 'ethereal');
          const result = await providerManager.generateDream(prompt);

          if (result.success) {
            const assessment = await qualityAssessment.assessContent(
              result.data,
              {
                originalPrompt: promptText,
                style: 'ethereal',
              }
            );
            scores.push(assessment.overallScore);
          }
        }

        providerQualityScores[provider] = {
          averageScore:
            scores.reduce((sum, score) => sum + score, 0) / scores.length,
          minScore: Math.min(...scores),
          maxScore: Math.max(...scores),
          consistency: 1 - (Math.max(...scores) - Math.min(...scores)),
          sampleSize: scores.length,
        };
      }

      console.log('Provider Quality Benchmark:');
      Object.entries(providerQualityScores).forEach(([provider, metrics]) => {
        console.log(`  ${provider}:`);
        console.log(`    Average Score: ${metrics.averageScore.toFixed(3)}`);
        console.log(
          `    Score Range: ${metrics.minScore.toFixed(
            3
          )} - ${metrics.maxScore.toFixed(3)}`
        );
        console.log(`    Consistency: ${metrics.consistency.toFixed(3)}`);
      });

      // All providers should meet minimum quality standards
      Object.values(providerQualityScores).forEach((metrics) => {
        expect(metrics.averageScore).toBeGreaterThan(0.6);
        expect(metrics.minScore).toBeGreaterThan(0.4);
        expect(metrics.consistency).toBeGreaterThan(0.5);
      });
    });

    test('should detect quality regression over time', async () => {
      const baselinePrompt =
        'I dreamed of a magical forest with glowing mushrooms';
      const iterations = 10;
      const qualityScores = [];

      for (let i = 0; i < iterations; i++) {
        const prompt = promptEngine.buildDreamPrompt(
          baselinePrompt,
          'ethereal'
        );
        const result = await providerManager.generateDream(prompt);

        if (result.success) {
          const assessment = await qualityAssessment.assessContent(
            result.data,
            {
              originalPrompt: baselinePrompt,
              style: 'ethereal',
            }
          );
          qualityScores.push(assessment.overallScore);
        }
      }

      const averageQuality =
        qualityScores.reduce((sum, score) => sum + score, 0) /
        qualityScores.length;
      const qualityVariance =
        qualityScores.reduce(
          (sum, score) => sum + Math.pow(score - averageQuality, 2),
          0
        ) / qualityScores.length;
      const qualityStdDev = Math.sqrt(qualityVariance);

      console.log(`Quality Regression Test (${iterations} iterations):`);
      console.log(`  Average Quality: ${averageQuality.toFixed(3)}`);
      console.log(`  Standard Deviation: ${qualityStdDev.toFixed(3)}`);
      console.log(
        `  Score Range: ${Math.min(...qualityScores).toFixed(3)} - ${Math.max(
          ...qualityScores
        ).toFixed(3)}`
      );

      // Quality should be consistent (low variance)
      expect(averageQuality).toBeGreaterThan(0.6);
      expect(qualityStdDev).toBeLessThan(0.2); // Low variance indicates consistency
    });

    test('should validate content structure consistency', async () => {
      const structureTestPrompts = [
        'I dreamed of a simple garden',
        'I dreamed of a complex multi-layered fantasy world with various realms',
        'I dreamed of an abstract concept becoming visual',
      ];

      for (const promptText of structureTestPrompts) {
        const prompt = promptEngine.buildDreamPrompt(promptText, 'ethereal');
        const result = await providerManager.generateDream(prompt);

        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('title');
        expect(result.data).toHaveProperty('description');
        expect(result.data).toHaveProperty('scenes');
        expect(result.data).toHaveProperty('style');

        expect(typeof result.data.title).toBe('string');
        expect(typeof result.data.description).toBe('string');
        expect(Array.isArray(result.data.scenes)).toBe(true);
        expect(typeof result.data.style).toBe('string');

        expect(result.data.title.length).toBeGreaterThan(0);
        expect(result.data.description.length).toBeGreaterThan(10);
        expect(result.data.scenes.length).toBeGreaterThan(0);

        // Validate scene structure
        result.data.scenes.forEach((scene) => {
          expect(scene).toHaveProperty('type');
          expect(scene).toHaveProperty('description');
          expect(scene).toHaveProperty('mood');
          expect(typeof scene.type).toBe('string');
          expect(typeof scene.description).toBe('string');
          expect(typeof scene.mood).toBe('string');
        });
      }
    });
  });

  describe('Content Diversity Assessment', () => {
    test('should generate diverse content for similar prompts', async () => {
      const similarPrompts = [
        'I dreamed of a garden with flowers',
        'I dreamed of a garden with blooming flowers',
        'I dreamed of a flower garden',
        'I dreamed of a garden full of colorful flowers',
        'I dreamed of a beautiful garden with many flowers',
      ];

      const results = [];
      for (const promptText of similarPrompts) {
        const prompt = promptEngine.buildDreamPrompt(promptText, 'ethereal');
        const result = await providerManager.generateDream(prompt);
        if (result.success) {
          results.push(result.data);
        }
      }

      expect(results.length).toBe(similarPrompts.length);

      // Check for diversity in titles
      const titles = results.map((r) => r.title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBeGreaterThan(titles.length * 0.7); // At least 70% unique

      // Check for diversity in descriptions
      const descriptions = results.map((r) => r.description);
      const avgDescriptionLength =
        descriptions.reduce((sum, desc) => sum + desc.length, 0) /
        descriptions.length;
      const descriptionVariance =
        descriptions.reduce(
          (sum, desc) => sum + Math.pow(desc.length - avgDescriptionLength, 2),
          0
        ) / descriptions.length;

      expect(descriptionVariance).toBeGreaterThan(100); // Should have some variance in length
    });

    test('should adapt content complexity to prompt complexity', async () => {
      const complexityTestCases = [
        {
          prompt: 'I dreamed of a tree',
          expectedComplexity: 'simple',
        },
        {
          prompt:
            'I dreamed of a magical forest with ancient trees, mystical creatures, glowing mushrooms, and hidden pathways leading to secret clearings',
          expectedComplexity: 'complex',
        },
        {
          prompt:
            "I dreamed of a multi-dimensional library where each book contains a universe, and reading opens portals to different realities where the laws of physics change based on the reader's emotions",
          expectedComplexity: 'very_complex',
        },
      ];

      for (const testCase of complexityTestCases) {
        const prompt = promptEngine.buildDreamPrompt(
          testCase.prompt,
          'ethereal'
        );
        const result = await providerManager.generateDream(prompt);

        expect(result.success).toBe(true);

        const assessment = await qualityAssessment.assessContent(result.data, {
          originalPrompt: testCase.prompt,
          style: 'ethereal',
        });

        // More complex prompts should generate more detailed content
        if (testCase.expectedComplexity === 'simple') {
          expect(result.data.scenes.length).toBeLessThanOrEqual(2);
          expect(assessment.metrics.detail).toBeGreaterThan(0.5);
        } else if (testCase.expectedComplexity === 'complex') {
          expect(result.data.scenes.length).toBeGreaterThanOrEqual(1);
          expect(assessment.metrics.detail).toBeGreaterThan(0.6);
        } else if (testCase.expectedComplexity === 'very_complex') {
          expect(result.data.scenes.length).toBeGreaterThanOrEqual(1);
          expect(assessment.metrics.detail).toBeGreaterThan(0.7);
          expect(assessment.metrics.creativity).toBeGreaterThan(0.7);
        }
      }
    });
  });

  describe('Quality Improvement Tracking', () => {
    test('should track quality improvements over iterations', async () => {
      const testPrompt =
        'I dreamed of an enchanted castle on a floating island';
      const iterations = 5;
      const qualityHistory = [];

      for (let i = 0; i < iterations; i++) {
        const prompt = promptEngine.buildDreamPrompt(testPrompt, 'ethereal', {
          iteration: i,
          previousQuality:
            qualityHistory.length > 0
              ? qualityHistory[qualityHistory.length - 1]
              : null,
        });

        const result = await providerManager.generateDream(prompt);

        if (result.success) {
          const assessment = await qualityAssessment.assessContent(
            result.data,
            {
              originalPrompt: testPrompt,
              style: 'ethereal',
            }
          );

          qualityHistory.push({
            iteration: i,
            overallScore: assessment.overallScore,
            metrics: assessment.metrics,
            timestamp: Date.now(),
          });
        }
      }

      expect(qualityHistory.length).toBe(iterations);

      // Analyze quality trend
      const scores = qualityHistory.map((h) => h.overallScore);
      const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
      const secondHalf = scores.slice(Math.floor(scores.length / 2));

      const firstHalfAvg =
        firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
      const secondHalfAvg =
        secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;

      console.log('Quality Improvement Tracking:');
      console.log(`  First half average: ${firstHalfAvg.toFixed(3)}`);
      console.log(`  Second half average: ${secondHalfAvg.toFixed(3)}`);
      console.log(
        `  Improvement: ${((secondHalfAvg - firstHalfAvg) * 100).toFixed(1)}%`
      );

      // Quality should remain consistent or improve
      expect(secondHalfAvg).toBeGreaterThanOrEqual(firstHalfAvg * 0.95);
    });

    test('should identify quality patterns by style', async () => {
      const styles = ['ethereal', 'cyberpunk', 'surreal', 'cinematic'];
      const testPrompt = 'I dreamed of a mysterious city';
      const styleQualityMap = {};

      for (const style of styles) {
        const prompt = promptEngine.buildDreamPrompt(testPrompt, style);
        const result = await providerManager.generateDream(prompt);

        if (result.success) {
          const assessment = await qualityAssessment.assessContent(
            result.data,
            {
              originalPrompt: testPrompt,
              style: style,
            }
          );

          styleQualityMap[style] = {
            overallScore: assessment.overallScore,
            styleConsistency: assessment.styleConsistency,
            creativity: assessment.metrics.creativity,
            relevance: assessment.metrics.relevance,
          };
        }
      }

      console.log('Quality by Style:');
      Object.entries(styleQualityMap).forEach(([style, metrics]) => {
        console.log(`  ${style}:`);
        console.log(`    Overall: ${metrics.overallScore.toFixed(3)}`);
        console.log(
          `    Style Consistency: ${metrics.styleConsistency.toFixed(3)}`
        );
        console.log(`    Creativity: ${metrics.creativity.toFixed(3)}`);
      });

      // All styles should meet minimum quality standards
      Object.values(styleQualityMap).forEach((metrics) => {
        expect(metrics.overallScore).toBeGreaterThan(0.5);
        expect(metrics.styleConsistency).toBeGreaterThan(0.6);
      });

      // Style consistency should be high for all styles
      Object.entries(styleQualityMap).forEach(([style, metrics]) => {
        expect(metrics.styleConsistency).toBeGreaterThan(0.6);
      });
    });
  });

  describe('Quality Assurance Automation', () => {
    test('should automatically flag low-quality content', async () => {
      const qualityThresholds = {
        overallScore: 0.6,
        relevance: 0.7,
        completeness: 0.6,
        creativity: 0.5,
      };

      // Test with intentionally poor content
      const poorContent = {
        title: 'Bad',
        description: 'Not good',
        scenes: [
          {
            type: 'bad',
            description: 'Bad scene',
            mood: 'bad',
          },
        ],
        style: 'bad',
      };

      const assessment = await qualityAssessment.assessContent(poorContent, {
        originalPrompt: 'I dreamed of a magnificent underwater kingdom',
        style: 'ethereal',
      });

      const qualityFlags = qualityAssessment.checkQualityThresholds(
        assessment,
        qualityThresholds
      );

      expect(qualityFlags.flagged).toBe(true);
      expect(qualityFlags.failedThresholds.length).toBeGreaterThan(0);
      expect(qualityFlags.failedThresholds).toContain('overallScore');
      expect(qualityFlags.failedThresholds).toContain('relevance');
    });

    test('should provide actionable quality improvement suggestions', async () => {
      const mediocreContent = {
        title: 'Dream Place',
        description: 'A place where things happen',
        scenes: [
          {
            type: 'place',
            description: 'Things are here',
            mood: 'okay',
            objects: [],
          },
        ],
        style: 'ethereal',
      };

      const assessment = await qualityAssessment.assessContent(
        mediocreContent,
        {
          originalPrompt:
            'I dreamed of a vibrant marketplace in an ancient city',
          style: 'ethereal',
        }
      );

      const suggestions =
        qualityAssessment.generateImprovementSuggestions(assessment);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.includes('title'))).toBe(true);
      expect(suggestions.some((s) => s.includes('description'))).toBe(true);
      expect(suggestions.some((s) => s.includes('detail'))).toBe(true);
    });

    test('should validate content against multiple quality dimensions', async () => {
      const testContent = {
        title: 'The Crystal Caverns of Echoing Dreams',
        description:
          'Deep beneath the earth, vast caverns stretch endlessly, their walls lined with crystals that sing with the voices of ancient dreams.',
        scenes: [
          {
            type: 'environment',
            description:
              'Massive crystal formations create a natural cathedral underground',
            mood: 'mystical',
            lighting: 'crystal reflections',
            objects: [
              {
                type: 'crystal',
                position: { x: 0, y: 2, z: 0 },
                properties: { sound: 'singing', color: 'rainbow' },
              },
            ],
          },
        ],
        style: 'ethereal',
      };

      const assessment = await qualityAssessment.assessContent(testContent, {
        originalPrompt:
          'I dreamed of underground caves filled with singing crystals',
        style: 'ethereal',
      });

      // Validate multiple quality dimensions
      const qualityDimensions = {
        narrative: assessment.metrics.coherence,
        visual: assessment.metrics.detail,
        emotional: assessment.styleConsistency,
        technical: assessment.structuralQuality || 0.8, // Mock structural quality
      };

      Object.entries(qualityDimensions).forEach(([dimension, score]) => {
        expect(score).toBeGreaterThan(0.5);
        console.log(`${dimension} quality: ${score.toFixed(3)}`);
      });

      expect(assessment.overallScore).toBeGreaterThan(0.7);
    });
  });
});
