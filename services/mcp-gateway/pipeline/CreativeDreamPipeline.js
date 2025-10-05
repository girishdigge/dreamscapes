/**
 * Creative Dream Pipeline
 * Main integration class that combines all components
 */

const { SemanticAnalyzer } = require('../nlp');
const { MotionMapper } = require('../motion');
const { EventTimeline } = require('../events');
const { CinematicCamera } = require('../camera');

class CreativeDreamPipeline {
  constructor(config = {}) {
    this.config = {
      enableSemanticAnalysis: config.enableSemanticAnalysis !== false,
      enableMotionMapping: config.enableMotionMapping !== false,
      enableEventGeneration: config.enableEventGeneration !== false,
      enableCinematicCamera: config.enableCinematicCamera !== false,
      enableMetadata: config.enableMetadata !== false,
      backwardCompatible: config.backwardCompatible !== false,
      ...config,
    };

    // Initialize components
    this.semanticAnalyzer = new SemanticAnalyzer();
    this.motionMapper = new MotionMapper();
    this.eventTimeline = new EventTimeline();
    this.cinematicCamera = new CinematicCamera();

    // Performance tracking
    this.performanceMetrics = {
      totalProcessingTime: 0,
      componentTimes: {},
    };
  }

  /**
   * Main processing method - transforms prompt into enhanced dream JSON
   * @param {string} prompt - User prompt
   * @param {Object} options - Processing options
   * @returns {Object} - Enhanced dream JSON
   */
  async process(prompt, options = {}) {
    const startTime = Date.now();

    try {
      // Step 1: Semantic Analysis
      const analysis = this.config.enableSemanticAnalysis
        ? await this.runSemanticAnalysis(prompt)
        : this.createBasicAnalysis(prompt);

      // Step 2: Motion Mapping
      const animations = this.config.enableMotionMapping
        ? await this.runMotionMapping(analysis)
        : [];

      // Step 3: Event Generation
      const events = this.config.enableEventGeneration
        ? await this.runEventGeneration(analysis, animations)
        : { events: [] };

      // Step 4: Camera Sequencing
      const camera = this.config.enableCinematicCamera
        ? await this.runCameraSequencing(analysis, animations, events)
        : this.createBasicCamera(options.duration || 30);

      // Step 5: Build Enhanced JSON
      const enhancedJSON = this.buildEnhancedJSON({
        prompt,
        analysis,
        animations,
        events,
        camera,
        options,
      });

      // Step 6: Add Metadata
      if (this.config.enableMetadata) {
        enhancedJSON.creativePipeline = this.buildMetadata(
          analysis,
          animations,
          events,
          camera
        );
      }

      // Track performance
      this.performanceMetrics.totalProcessingTime = Date.now() - startTime;

      return enhancedJSON;
    } catch (error) {
      console.error('Pipeline error:', error);
      return this.handleError(error, prompt, options);
    }
  }

  /**
   * Run semantic analysis
   * @param {string} prompt - User prompt
   * @returns {Object} - Analysis results
   */
  async runSemanticAnalysis(prompt) {
    const startTime = Date.now();

    try {
      const analysis = this.semanticAnalyzer.analyze(prompt);
      this.performanceMetrics.componentTimes.semanticAnalysis =
        Date.now() - startTime;
      return analysis;
    } catch (error) {
      console.error('Semantic analysis error:', error);
      return this.createBasicAnalysis(prompt);
    }
  }

  /**
   * Run motion mapping
   * @param {Object} analysis - Semantic analysis
   * @returns {Array} - Animation configurations
   */
  async runMotionMapping(analysis) {
    const startTime = Date.now();

    try {
      const animations = [];

      // Map verbs to animations
      if (analysis.verbs && analysis.verbs.length > 0) {
        analysis.verbs.forEach((verb) => {
          if (
            verb.isMotionVerb &&
            analysis.entities &&
            analysis.entities.length > 0
          ) {
            const entity = analysis.entities[0]; // Primary entity
            const animation = this.motionMapper.mapVerbToAnimation(
              verb.text,
              entity
            );
            animations.push({
              entity: entity.text,
              ...animation,
            });
          }
        });
      }

      // Add default animations for static entities
      if (animations.length === 0 && analysis.entities) {
        analysis.entities.forEach((entity) => {
          const defaultAnim = this.motionMapper.getStaticAnimation(entity);
          animations.push({
            entity: entity.text,
            ...defaultAnim,
          });
        });
      }

      this.performanceMetrics.componentTimes.motionMapping =
        Date.now() - startTime;
      return animations;
    } catch (error) {
      console.error('Motion mapping error:', error);
      return [];
    }
  }

  /**
   * Run event generation
   * @param {Object} analysis - Semantic analysis
   * @param {Array} animations - Animation configurations
   * @returns {Object} - Event timeline
   */
  async runEventGeneration(analysis, animations) {
    const startTime = Date.now();

    try {
      const sceneData = {
        entities: analysis.entities || [],
        verbs: analysis.verbs || [],
        animations: animations || [],
      };

      const timeline = this.eventTimeline.generateTimeline(sceneData, 30);

      this.performanceMetrics.componentTimes.eventGeneration =
        Date.now() - startTime;
      return timeline;
    } catch (error) {
      console.error('Event generation error:', error);
      return { events: [], duration: 30 };
    }
  }

  /**
   * Run camera sequencing
   * @param {Object} analysis - Semantic analysis
   * @param {Array} animations - Animation configurations
   * @param {Object} events - Event timeline
   * @returns {Object} - Camera sequence
   */
  async runCameraSequencing(analysis, animations, events) {
    const startTime = Date.now();

    try {
      const sceneData = {
        entities: analysis.entities || [],
        verbs: analysis.verbs || [],
        animations: animations || [],
        events: events.events || [],
      };

      const cameraSequence = this.cinematicCamera.generateCameraSequence(
        sceneData,
        30
      );

      this.performanceMetrics.componentTimes.cameraSequencing =
        Date.now() - startTime;
      return cameraSequence;
    } catch (error) {
      console.error('Camera sequencing error:', error);
      return this.createBasicCamera(30);
    }
  }

  /**
   * Build enhanced JSON output
   * @param {Object} data - All pipeline data
   * @returns {Object} - Enhanced JSON
   */
  buildEnhancedJSON(data) {
    const { prompt, analysis, animations, events, camera, options } = data;

    return {
      // Basic info
      title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
      originalText: prompt,
      style: analysis.mood?.dominantMood || options.style || 'default',

      // Structures
      structures: this.buildStructures(analysis),

      // Entities
      entities: this.buildEntities(analysis, animations),

      // Cinematography (enhanced)
      cinematography: this.buildCinematography(camera, options.duration || 30),

      // Environment (enhanced)
      environment: this.buildEnvironment(analysis),

      // Render settings
      render: {
        res: options.resolution || [1280, 720],
        fps: options.fps || 30,
        quality: options.quality || 'medium',
      },

      // Metadata
      metadata: {
        generatedAt: new Date().toISOString(),
        processingTime: this.performanceMetrics.totalProcessingTime,
        source: 'creative-pipeline',
        version: '2.0.0',
        pipelineVersion: '2.0.0-creative',
        originalText: prompt,
        requestedStyle: options.style,
        options: options,
      },
    };
  }

  /**
   * Build structures array
   * @param {Object} analysis - Semantic analysis
   * @returns {Array} - Structures
   */
  buildStructures(analysis) {
    const structures = [];

    if (analysis.entities) {
      analysis.entities.forEach((entity, index) => {
        if (entity.type === 'structure' || entity.type === 'natural_element') {
          structures.push({
            id: `s${index + 1}`,
            type: this.normalizeType(entity.text),
            pos: [0, Math.random() * 20 + 10, 0],
            scale: Math.random() * 0.5 + 0.7,
            rotation: [0, Math.random() * Math.PI * 2, 0],
            features: this.inferFeatures(entity, analysis),
          });
        }
      });
    }

    return structures;
  }

  /**
   * Build entities array
   * @param {Object} analysis - Semantic analysis
   * @param {Array} animations - Animations
   * @returns {Array} - Entities
   */
  buildEntities(analysis, animations) {
    const entities = [];

    if (analysis.entities) {
      analysis.entities.forEach((entity, index) => {
        if (entity.type !== 'structure' && entity.type !== 'natural_element') {
          const animation = animations.find((a) => a.entity === entity.text);

          entities.push({
            id: `e${index + 1}`,
            type: this.normalizeType(entity.text),
            count: entity.count || 1,
            params: {
              speed: animation?.speed || Math.random() * 0.5 + 0.8,
              glow: Math.random() * 0.3 + 0.5,
              size: Math.random() * 0.3 + 0.7,
              color: this.inferColor(analysis),
            },
          });
        }
      });
    }

    return entities;
  }

  /**
   * Build cinematography object
   * @param {Object} camera - Camera sequence
   * @param {number} duration - Duration
   * @returns {Object} - Cinematography
   */
  buildCinematography(camera, duration) {
    const shots = [];

    if (camera.shots) {
      camera.shots.forEach((shot) => {
        shots.push({
          type: this.mapShotType(shot.type),
          target: shot.target?.id || shot.target?.text || 's1',
          duration: shot.duration,
          startPos: shot.camera?.position
            ? [
                shot.camera.position.x,
                shot.camera.position.y,
                shot.camera.position.z,
              ]
            : [0, 30, 50],
          endPos: shot.camera?.endPosition
            ? [
                shot.camera.endPosition.x,
                shot.camera.endPosition.y,
                shot.camera.endPosition.z,
              ]
            : [0, 25, 20],
        });
      });
    }

    return {
      durationSec: duration,
      shots: shots.length > 0 ? shots : this.createDefaultShots(duration),
    };
  }

  /**
   * Build environment object
   * @param {Object} analysis - Semantic analysis
   * @returns {Object} - Environment
   */
  buildEnvironment(analysis) {
    const env = analysis.environment || {};
    const preset = env.preset || 'clear';
    const presetConfig = env.presetConfig || {};

    return {
      preset: preset,
      fog: presetConfig.fog || 0.3,
      skyColor: this.inferColor(analysis),
      ambientLight: presetConfig.ambientLight || 0.8,
    };
  }

  /**
   * Build metadata object
   * @param {Object} analysis - Analysis
   * @param {Array} animations - Animations
   * @param {Object} events - Events
   * @param {Object} camera - Camera
   * @returns {Object} - Metadata
   */
  buildMetadata(analysis, animations, events, camera) {
    return {
      semanticAnalysis: {
        entities: analysis.entities?.map((e) => ({
          text: e.text,
          count: e.count,
          type: e.type,
          confidence: 0.9,
        })),
        verbs: analysis.verbs?.map((v) => ({
          text: v.text,
          category: v.category,
          intensity: v.intensity,
        })),
        mood: analysis.mood,
        environment: analysis.environment,
      },
      animations: animations.map((a) => ({
        entity: a.entity,
        type: a.type,
        pattern: a.pattern,
      })),
      events: events.events?.map((e) => ({
        type: e.type,
        time: e.time,
      })),
      camera: {
        totalShots: camera.shots?.length || 0,
        shotTypes: camera.shots?.map((s) => s.type) || [],
      },
      performance: this.performanceMetrics,
    };
  }

  /**
   * Helper methods
   */

  normalizeType(text) {
    return text.toLowerCase().replace(/\s+/g, '_');
  }

  inferFeatures(entity, analysis) {
    const features = [];

    if (
      analysis.mood?.dominantMood === 'ethereal' ||
      analysis.mood?.dominantMood === 'magical'
    ) {
      features.push('glowing_edges', 'particle_effects');
    }

    return features;
  }

  inferColor(analysis) {
    if (analysis.modifiers?.colors && analysis.modifiers.colors.length > 0) {
      return this.colorNameToHex(analysis.modifiers.colors[0]);
    }

    if (analysis.mood?.dominantMood === 'ethereal') {
      return '#a6d8ff';
    }

    return '#ffffff';
  }

  colorNameToHex(colorName) {
    const colors = {
      golden: '#ffd700',
      blue: '#4169e1',
      red: '#dc143c',
      green: '#228b22',
      purple: '#9370db',
    };
    return colors[colorName] || '#ffffff';
  }

  mapShotType(type) {
    const mapping = {
      establishing: 'establish',
      tracking: 'flythrough',
      close_up: 'closeup',
      pull_back: 'pullback',
      pan: 'pan',
    };
    return mapping[type] || 'establish';
  }

  createBasicAnalysis(prompt) {
    return {
      originalPrompt: prompt,
      entities: [],
      verbs: [],
      modifiers: {},
      mood: {},
      environment: {},
    };
  }

  createBasicCamera(duration) {
    return {
      duration,
      shots: this.createDefaultShots(duration),
    };
  }

  createDefaultShots(duration) {
    return [
      {
        type: 'establishing',
        duration: duration * 0.4,
        camera: {
          position: { x: 0, y: 30, z: 50 },
          lookAt: { x: 0, y: 0, z: 0 },
        },
      },
      {
        type: 'tracking',
        duration: duration * 0.6,
        camera: {
          position: { x: 0, y: 25, z: 20 },
          endPosition: { x: 30, y: 20, z: -20 },
        },
      },
    ];
  }

  handleError(error, prompt, options) {
    console.error('Pipeline error:', error);

    // Return basic fallback
    return {
      title: prompt.substring(0, 50),
      originalText: prompt,
      style: options.style || 'default',
      structures: [],
      entities: [],
      cinematography: {
        durationSec: 30,
        shots: this.createDefaultShots(30),
      },
      environment: {
        preset: 'clear',
        fog: 0.3,
        skyColor: '#ffffff',
        ambientLight: 0.8,
      },
      metadata: {
        error: error.message,
        fallback: true,
      },
    };
  }

  /**
   * Get performance metrics
   * @returns {Object} - Performance data
   */
  getPerformanceMetrics() {
    return this.performanceMetrics;
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics() {
    this.performanceMetrics = {
      totalProcessingTime: 0,
      componentTimes: {},
    };
  }
}

module.exports = CreativeDreamPipeline;
