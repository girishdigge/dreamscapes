/**
 * CreativeDreamPipeline - Main integration class that orchestrates all creative components
 * Transforms natural language prompts into cinematic 3D scenes
 */

const NLPWrapper = require('../nlp/NLPWrapper');
const SemanticAnalyzer = require('../nlp/SemanticAnalyzer');
const MotionMapper = require('../motion/MotionMapper');
const EventTimeline = require('../events/EventTimeline');
const CinematicCamera = require('../camera/CinematicCamera');

class CreativeDreamPipeline {
  constructor(config = {}) {
    this.config = {
      enableMotion: config.enableMotion !== false,
      enableEvents: config.enableEvents !== false,
      enableCamera: config.enableCamera !== false,
      enableSemantics: config.enableSemantics !== false,
      backwardCompatible: config.backwardCompatible || false,
      duration: config.duration || 10,
      ...config,
    };

    // Initialize components
    this.nlp = new NLPWrapper();
    this.semanticAnalyzer = new SemanticAnalyzer(this.nlp);
    this.motionMapper = new MotionMapper();
    this.eventTimeline = new EventTimeline();
    this.cinematicCamera = new CinematicCamera();

    // Cache for performance
    this.cache = new Map();
  }

  /**
   * Main processing method - transforms prompt into complete scene
   */
  async process(prompt, options = {}) {
    try {
      const startTime = Date.now();

      // Check cache
      const cacheKey = this.getCacheKey(prompt, options);
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // Step 1: Semantic Analysis
      const semantics = this.config.enableSemantics
        ? this.semanticAnalyzer.analyze(prompt)
        : this.basicParse(prompt);

      // Step 2: Motion Mapping
      const motionData = this.config.enableMotion
        ? this.mapMotions(semantics, this.config.duration)
        : {
            entities: [],
            metadata: { enhancements: [], assumptions: [], confidence: 1.0 },
          };

      // Step 3: Event Generation
      const events = this.config.enableEvents
        ? this.eventTimeline.generateTimeline(semantics, this.config.duration)
        : { events: [], metadata: { enhancements: [], confidence: 1.0 } };

      // Step 4: Camera Direction
      const camera = this.config.enableCamera
        ? this.cinematicCamera.generateCameraSequence(
            semantics,
            this.config.duration
          )
        : this.defaultCamera();

      // Step 5: Assemble final output
      const result = this.assembleOutput(
        semantics,
        motionData,
        events,
        camera,
        prompt
      );

      // Add performance metrics
      result.metadata.processingTime = Date.now() - startTime;

      // Cache result
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      return this.handleError(error, prompt);
    }
  }

  /**
   * Map motions for all entities in the scene
   */
  mapMotions(semantics, duration) {
    const entities = [];
    const metadata = {
      enhancements: [],
      assumptions: [],
      confidence: 1.0,
    };

    for (const entity of semantics.entities) {
      const verb = entity.verb || 'floating'; // Default idle animation
      const animation = this.motionMapper.mapVerbToAnimation(verb, entity, {
        duration,
      });

      entities.push({
        name: entity.text,
        type: entity.type,
        count: entity.count,
        startPosition: animation.startPosition || { x: 0, y: 0, z: 0 },
        motion: animation.type,
        path: animation.path,
        animation,
      });

      if (verb !== entity.verb) {
        metadata.assumptions.push(
          `Added default '${verb}' animation for ${entity.text}`
        );
      } else {
        metadata.enhancements.push(
          `Mapped '${verb}' to ${animation.type} animation for ${entity.text}`
        );
      }
    }

    return { entities, metadata };
  }

  /**
   * Assemble all components into final output format
   */
  assembleOutput(semantics, motionData, events, camera, originalPrompt) {
    const output = {
      prompt: originalPrompt,
      entities: this.buildEntities(semantics, motionData),
      environment: semantics.environment,
      events: events.events || [],
      camera: camera.shots || [],
      metadata: {
        assumptions: [],
        enhancements: [],
        warnings: [],
        confidence: 1.0,
        processingTime: 0,
      },
    };

    // Collect metadata
    this.collectMetadata(output, semantics, motionData, events, camera);

    return output;
  }

  /**
   * Build entity list with all enhancements
   */
  buildEntities(semantics, motionData) {
    const entities = [];

    for (const entity of semantics.entities) {
      const motion =
        motionData.entities?.find((m) => m.name === entity.text) || {};

      entities.push({
        name: entity.text,
        type: entity.type || 'unknown',
        count: entity.count || 1,
        position: motion.startPosition || { x: 0, y: 0, z: 0 },
        motion: motion.motion || null,
        path: motion.path || null,
        modifiers: entity.modifiers || [],
      });
    }

    return entities;
  }

  /**
   * Collect metadata from all components
   */
  collectMetadata(output, semantics, motionData, events, camera) {
    const metadata = output.metadata;

    // Semantic assumptions
    if (semantics.metadata) {
      metadata.assumptions.push(...(semantics.metadata.assumptions || []));
      metadata.warnings.push(...(semantics.metadata.warnings || []));
    }

    // Motion enhancements
    if (motionData.metadata) {
      metadata.enhancements.push(...(motionData.metadata.enhancements || []));
      metadata.assumptions.push(...(motionData.metadata.assumptions || []));
    }

    // Event enhancements
    if (events.metadata) {
      metadata.enhancements.push(...(events.metadata.enhancements || []));
    }

    // Camera enhancements
    if (camera.metadata) {
      metadata.enhancements.push(...(camera.metadata.enhancements || []));
    }

    // Calculate overall confidence
    const confidences = [
      semantics.metadata?.confidence || 1.0,
      motionData.metadata?.confidence || 1.0,
      events.metadata?.confidence || 1.0,
      camera.metadata?.confidence || 1.0,
    ];
    metadata.confidence = confidences.reduce((a, b) => a * b, 1.0);
  }

  /**
   * Basic parsing for backward compatibility mode
   */
  basicParse(prompt) {
    const doc = this.nlp.parse(prompt);
    const nouns = doc.nouns().out('array');

    return {
      entities: nouns.map((noun) => ({
        text: noun,
        type: 'unknown',
        count: 1,
        modifiers: [],
      })),
      environment: {
        time: 'day',
        weather: 'clear',
        location: 'generic',
      },
      mood: 'neutral',
      metadata: {
        assumptions: ['Using basic parsing mode'],
        warnings: [],
        confidence: 0.5,
      },
    };
  }

  /**
   * Default camera for backward compatibility
   */
  defaultCamera() {
    return {
      shots: [
        {
          type: 'static',
          startTime: 0,
          duration: 10,
          position: { x: 0, y: 5, z: 10 },
          target: { x: 0, y: 0, z: 0 },
          fov: 60,
        },
      ],
      metadata: {
        enhancements: [],
        confidence: 1.0,
      },
    };
  }

  /**
   * Error handling with graceful fallback
   */
  handleError(error, prompt) {
    console.error('CreativeDreamPipeline error:', error);

    return {
      prompt,
      entities: [],
      environment: {
        time: 'day',
        weather: 'clear',
        location: 'generic',
      },
      events: [],
      camera: this.defaultCamera().shots,
      metadata: {
        assumptions: [],
        enhancements: [],
        warnings: [`Pipeline error: ${error.message}`],
        confidence: 0.0,
        error: error.message,
        processingTime: 0,
      },
    };
  }

  /**
   * Generate cache key for performance optimization
   */
  getCacheKey(prompt, options) {
    return `${prompt}:${JSON.stringify(options)}:${JSON.stringify(
      this.config
    )}`;
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      config: this.config,
    };
  }
}

module.exports = CreativeDreamPipeline;
