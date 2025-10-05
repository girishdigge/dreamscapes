/**
 * Creative Dream Pipeline Integration Tests
 * Tests the complete pipeline with all components
 */

const CreativeDreamPipeline = require('./CreativeDreamPipeline');
const PipelineConfig = require('./PipelineConfig');

describe('CreativeDreamPipeline', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new CreativeDreamPipeline();
  });

  describe('Initialization', () => {
    test('should initialize with default config', () => {
      expect(pipeline).toBeDefined();
      expect(pipeline.config.enableSemanticAnalysis).toBe(true);
      expect(pipeline.config.enableMotionMapping).toBe(true);
      expect(pipeline.config.enableEventGeneration).toBe(true);
      expect(pipeline.config.enableCinematicCamera).toBe(true);
    });

    test('should initialize with custom config', () => {
      const customPipeline = new CreativeDreamPipeline({
        enableSemanticAnalysis: false,
        enableMotionMapping: false,
      });

      expect(customPipeline.config.enableSemanticAnalysis).toBe(false);
      expect(customPipeline.config.enableMotionMapping).toBe(false);
    });

    test('should initialize all components', () => {
      expect(pipeline.semanticAnalyzer).toBeDefined();
      expect(pipeline.motionMapper).toBeDefined();
      expect(pipeline.eventTimeline).toBeDefined();
      expect(pipeline.cinematicCamera).toBeDefined();
    });
  });

  describe('End-to-End Processing', () => {
    test('should process simple prompt', async () => {
      const prompt = 'a dragon flying over a castle';
      const result = await pipeline.process(prompt);

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.originalText).toBe(prompt);
      expect(result.structures).toBeDefined();
     