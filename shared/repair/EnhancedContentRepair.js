// repair/EnhancedContentRepair.js
// Enhanced content repair system with improved effectiveness

const _ = require('lodash');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const { validationMonitor } = require('../validators/ValidationMonitor');

class EnhancedContentRepair {
  constructor(config = {}) {
    this.config = _.merge(
      {
        enabled: true,
        maxAttempts: 3,
        strategies: [
          'repairEnums',
          'fixStructure',
          'fillMissingFields',
          'enhanceContent',
          'validateTypes',
          'normalizeMetadata',
        ],
        defaults: {
          processingTime: 1000,
          quality: 'standard',
          confidence: 0.7,
          cacheHit: false,
        },
        repair: {
          minTitleLength: 5,
          minDescriptionLength: 20,
          minSceneDescriptionLength: 10,
        },
      },
      config
    );

    // Keyword mappings for prompt-aware generation
    this.keywordMappings = {
      structures: {
        library: ['floating_library', 'crystal_tower'],
        house: ['twisted_house', 'floating_island'],
        tower: ['crystal_tower', 'crystal_spire'],
        portal: ['portal_arch', 'energy_nexus'],
        stairs: ['infinite_staircase', 'floating_platform'],
        tree: ['organic_tree', 'floating_island'],
        crystal: ['crystal_spire', 'crystal_tower'],
        platform: ['floating_platform', 'geometric_form'],
        island: ['floating_island', 'floating_platform'],
        sculpture: ['abstract_sculpture', 'geometric_form'],
      },
      entities: {
        book: ['book_swarm', 'memory_fragments'],
        particle: ['particle_swarm', 'particle_stream'],
        orb: ['floating_orbs', 'light_butterflies'],
        shadow: ['shadow_figures', 'memory_fragments'],
        light: ['light_butterflies', 'floating_orbs'],
        crystal: ['crystal_shards', 'geometric_shapes'],
        energy: ['energy_beings', 'particle_stream'],
        butterfly: ['light_butterflies', 'particle_swarm'],
      },
    };

    // Style-specific defaults
    this.styleDefaults = {
      ethereal: {
        environment: {
          preset: 'dusk',
          fog: 0.4,
          skyColor: '#B8A9D4',
          ambientLight: 0.6,
        },
        cinematography: {
          durationSec: 30,
          shotTypes: ['establish', 'orbit', 'flythrough'],
        },
        render: {
          res: [1920, 1080],
          fps: 30,
          quality: 'high',
        },
        colors: ['#B8A9D4', '#E8D5F2', '#A8C5E8'],
      },
      cyberpunk: {
        environment: {
          preset: 'night',
          fog: 0.6,
          skyColor: '#1A0033',
          ambientLight: 0.3,
        },
        cinematography: {
          durationSec: 30,
          shotTypes: ['flythrough', 'zoom', 'close_up'],
        },
        render: {
          res: [1920, 1080],
          fps: 30,
          quality: 'high',
        },
        colors: ['#FF00FF', '#00FFFF', '#FF0080'],
      },
      surreal: {
        environment: {
          preset: 'void',
          fog: 0.3,
          skyColor: '#4A2C5E',
          ambientLight: 0.5,
        },
        cinematography: {
          durationSec: 35,
          shotTypes: ['orbit', 'establish', 'pull_back'],
        },
        render: {
          res: [1920, 1080],
          fps: 30,
          quality: 'high',
        },
        colors: ['#8B4789', '#D4A5D4', '#6B4C6B'],
      },
      fantasy: {
        environment: {
          preset: 'golden_hour',
          fog: 0.2,
          skyColor: '#FFD700',
          ambientLight: 0.7,
        },
        cinematography: {
          durationSec: 30,
          shotTypes: ['establish', 'flythrough', 'orbit'],
        },
        render: {
          res: [1920, 1080],
          fps: 30,
          quality: 'high',
        },
        colors: ['#FFD700', '#FFA500', '#FF6347'],
      },
      nightmare: {
        environment: {
          preset: 'night',
          fog: 0.7,
          skyColor: '#1A0000',
          ambientLight: 0.2,
        },
        cinematography: {
          durationSec: 30,
          shotTypes: ['close_up', 'zoom', 'flythrough'],
        },
        render: {
          res: [1920, 1080],
          fps: 30,
          quality: 'high',
        },
        colors: ['#8B0000', '#4B0000', '#2B0000'],
      },
      nature: {
        environment: {
          preset: 'dawn',
          fog: 0.2,
          skyColor: '#87CEEB',
          ambientLight: 0.8,
        },
        cinematography: {
          durationSec: 30,
          shotTypes: ['establish', 'orbit', 'flythrough'],
        },
        render: {
          res: [1920, 1080],
          fps: 30,
          quality: 'high',
        },
        colors: ['#228B22', '#90EE90', '#32CD32'],
      },
      abstract: {
        environment: {
          preset: 'space',
          fog: 0.1,
          skyColor: '#000033',
          ambientLight: 0.4,
        },
        cinematography: {
          durationSec: 30,
          shotTypes: ['orbit', 'zoom', 'pull_back'],
        },
        render: {
          res: [1920, 1080],
          fps: 30,
          quality: 'high',
        },
        colors: ['#FF00FF', '#00FFFF', '#FFFF00'],
      },
    };

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          silent: process.env.NODE_ENV === 'test',
        }),
      ],
    });

    this.metrics = {
      totalRepairAttempts: 0,
      successfulRepairs: 0,
      failedRepairs: 0,
      repairsByStrategy: {},
      repairsByErrorType: {},
      // Enhanced metrics for task 9.2
      repairsByType: {
        enum: 0,
        parameter: 0,
        id: 0,
      },
      repairsByField: {},
      lastMetricsLog: Date.now(),
      metricsLogInterval: 60000, // Log metrics every 60 seconds
    };

    // Define repair strategies
    this.repairStrategies = {
      repairEnums: this.repairEnums.bind(this),
      fixStructure: this.fixStructure.bind(this),
      fillMissingFields: this.fillMissingFields.bind(this),
      enhanceContent: this.enhanceContent.bind(this),
      validateTypes: this.validateTypes.bind(this),
      normalizeMetadata: this.normalizeMetadata.bind(this),
    };
  }

  /**
   * Extract keywords from prompt text
   */
  extractKeywords(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      return { structures: [], entities: [], themes: [] };
    }

    const lowerPrompt = prompt.toLowerCase();
    const keywords = {
      structures: [],
      entities: [],
      themes: [],
    };

    // Extract structure keywords
    for (const [keyword, types] of Object.entries(
      this.keywordMappings.structures
    )) {
      if (lowerPrompt.includes(keyword)) {
        keywords.structures.push(...types);
      }
    }

    // Extract entity keywords
    for (const [keyword, types] of Object.entries(
      this.keywordMappings.entities
    )) {
      if (lowerPrompt.includes(keyword)) {
        keywords.entities.push(...types);
      }
    }

    // Extract theme keywords
    const themeKeywords = [
      'floating',
      'glowing',
      'dark',
      'bright',
      'mysterious',
      'ancient',
      'futuristic',
      'organic',
      'geometric',
      'ethereal',
      'surreal',
    ];
    for (const theme of themeKeywords) {
      if (lowerPrompt.includes(theme)) {
        keywords.themes.push(theme);
      }
    }

    return keywords;
  }

  /**
   * Get style-specific defaults
   */
  getStyleDefaults(style) {
    const normalizedStyle = style?.toLowerCase() || 'ethereal';
    return this.styleDefaults[normalizedStyle] || this.styleDefaults.ethereal;
  }

  /**
   * Generate structures based on prompt keywords
   * Ensures structures are functionally complete for 3D rendering
   */
  generateStructuresFromPrompt(prompt, style, count = 2) {
    const keywords = this.extractKeywords(prompt);
    const structures = [];

    // Use keyword-based structure types if available
    let structureTypes =
      keywords.structures.length > 0
        ? keywords.structures
        : this.getDefaultStructureTypes(style);

    // Remove duplicates
    structureTypes = [...new Set(structureTypes)];

    // Ensure we have at least one structure type
    if (structureTypes.length === 0) {
      structureTypes = ['floating_platform'];
    }

    for (let i = 0; i < count; i++) {
      const type = structureTypes[i % structureTypes.length];
      const structure = this.createCompleteStructure(type, style, keywords, i);
      structures.push(structure);
    }

    this.logger.debug('Generated structures from prompt', {
      count: structures.length,
      types: structureTypes,
      style,
      hasKeywords: keywords.structures.length > 0,
    });

    return structures;
  }

  /**
   * Create a complete structure object with all required fields
   */
  createCompleteStructure(type, style, keywords, index) {
    const hasGlowing =
      keywords.themes.includes('glowing') ||
      style === 'ethereal' ||
      style === 'cyberpunk';
    const hasFloating =
      keywords.themes.includes('floating') || style === 'ethereal';
    const isDark = keywords.themes.includes('dark') || style === 'nightmare';
    const isFuturistic =
      keywords.themes.includes('futuristic') || style === 'cyberpunk';

    // Calculate position with proper spacing
    const angle = (index / 3) * Math.PI * 2;
    const radius = 20 + Math.random() * 15;
    const pos = [
      Math.cos(angle) * radius,
      15 + Math.random() * 15,
      Math.sin(angle) * radius,
    ];

    // Calculate scale based on structure type
    let scale;
    if (type.includes('tower') || type.includes('spire')) {
      scale = [
        3 + Math.random() * 2,
        10 + Math.random() * 10,
        3 + Math.random() * 2,
      ];
    } else if (type.includes('platform') || type.includes('island')) {
      scale = [8 + Math.random() * 4, 1 + Math.random(), 8 + Math.random() * 4];
    } else {
      scale = 4 + Math.random() * 4;
    }

    // Select appropriate features
    const features = [];
    if (hasGlowing) {
      features.push('glowing_edges');
    }
    if (hasFloating) {
      features.push('particle_effects');
    }
    if (isFuturistic) {
      features.push('animated_textures', 'emissive');
    }
    if (isDark) {
      features.push('pulsating');
    }
    if (features.length === 0) {
      features.push('reflective_surface');
    }

    return {
      id: `struct_${Date.now()}_${index}`,
      type,
      pos,
      rotation: [
        Math.random() * 0.2 - 0.1,
        Math.random() * Math.PI * 2,
        Math.random() * 0.2 - 0.1,
      ],
      scale,
      features: features.slice(0, 3), // Limit to 3 features
    };
  }

  /**
   * Get default structure types based on style
   */
  getDefaultStructureTypes(style) {
    const styleStructures = {
      ethereal: ['floating_platform', 'crystal_spire', 'floating_island'],
      cyberpunk: ['geometric_form', 'crystal_tower', 'energy_nexus'],
      surreal: ['twisted_house', 'infinite_staircase', 'abstract_sculpture'],
      fantasy: ['crystal_tower', 'organic_tree', 'portal_arch'],
      nightmare: ['twisted_house', 'abstract_sculpture', 'portal_arch'],
      nature: ['organic_tree', 'floating_island', 'crystal_spire'],
      abstract: ['geometric_form', 'abstract_sculpture', 'energy_nexus'],
    };

    return styleStructures[style] || styleStructures.ethereal;
  }

  /**
   * Generate entities based on prompt keywords
   * Ensures entities are functionally complete for 3D rendering
   */
  generateEntitiesFromPrompt(prompt, style, count = 2) {
    const keywords = this.extractKeywords(prompt);
    const styleDefaults = this.getStyleDefaults(style);
    const entities = [];

    // Use keyword-based entity types if available
    let entityTypes =
      keywords.entities.length > 0
        ? keywords.entities
        : this.getDefaultEntityTypes(style);

    // Remove duplicates
    entityTypes = [...new Set(entityTypes)];

    // Ensure we have at least one entity type
    if (entityTypes.length === 0) {
      entityTypes = ['floating_orbs'];
    }

    for (let i = 0; i < count; i++) {
      const type = entityTypes[i % entityTypes.length];
      const entity = this.createCompleteEntity(
        type,
        style,
        styleDefaults,
        keywords,
        i
      );
      entities.push(entity);
    }

    this.logger.debug('Generated entities from prompt', {
      count: entities.length,
      types: entityTypes,
      style,
      hasKeywords: keywords.entities.length > 0,
    });

    return entities;
  }

  /**
   * Create a complete entity object with all required fields
   */
  createCompleteEntity(type, style, styleDefaults, keywords, index) {
    const color = styleDefaults.colors[index % styleDefaults.colors.length];

    // Determine entity count based on type
    let entityCount;
    if (type.includes('swarm') || type.includes('stream')) {
      entityCount = 30 + Math.floor(Math.random() * 40);
    } else if (type.includes('orbs') || type.includes('butterflies')) {
      entityCount = 15 + Math.floor(Math.random() * 25);
    } else {
      entityCount = 10 + Math.floor(Math.random() * 20);
    }

    // Determine parameters based on style and keywords
    const isFast = keywords.themes.includes('fast') || style === 'cyberpunk';
    const isGlowing =
      keywords.themes.includes('glowing') ||
      style === 'ethereal' ||
      style === 'cyberpunk';
    const isLarge =
      keywords.themes.includes('large') || type.includes('beings');

    return {
      id: `entity_${Date.now()}_${index}`,
      type,
      count: entityCount,
      params: {
        speed: isFast ? 1.5 + Math.random() * 1.5 : 0.5 + Math.random() * 1.0,
        glow: isGlowing ? 0.6 + Math.random() * 0.3 : 0.3 + Math.random() * 0.4,
        size: isLarge ? 1.5 + Math.random() * 1.5 : 0.5 + Math.random() * 1.0,
        color,
      },
    };
  }

  /**
   * Get default entity types based on style
   */
  getDefaultEntityTypes(style) {
    const styleEntities = {
      ethereal: ['floating_orbs', 'light_butterflies', 'particle_swarm'],
      cyberpunk: ['particle_stream', 'geometric_shapes', 'energy_beings'],
      surreal: ['shadow_figures', 'memory_fragments', 'particle_swarm'],
      fantasy: ['light_butterflies', 'crystal_shards', 'floating_orbs'],
      nightmare: ['shadow_figures', 'particle_swarm', 'memory_fragments'],
      nature: ['light_butterflies', 'particle_swarm', 'floating_orbs'],
      abstract: ['geometric_shapes', 'particle_stream', 'crystal_shards'],
    };

    return styleEntities[style] || styleEntities.ethereal;
  }

  /**
   * Generate cinematography based on prompt and style
   */
  generateCinematographyFromPrompt(prompt, style, structures = []) {
    const styleDefaults = this.getStyleDefaults(style);
    const shotTypes = styleDefaults.cinematography.shotTypes;
    const durationSec = styleDefaults.cinematography.durationSec;

    const shots = [];
    const shotCount = Math.min(3, shotTypes.length);
    const shotDuration = Math.floor(durationSec / shotCount);

    for (let i = 0; i < shotCount; i++) {
      const shot = {
        type: shotTypes[i % shotTypes.length],
        duration: shotDuration,
      };

      // Add target if structures are available
      if (structures.length > 0) {
        shot.target = structures[i % structures.length].id;
      }

      // Add camera positions for specific shot types
      if (shot.type === 'flythrough') {
        shot.startPos = [-50, 30, 50];
        shot.endPos = [50, 30, -50];
      } else if (shot.type === 'orbit') {
        shot.startPos = [40, 25, 0];
        shot.endPos = [0, 25, 40];
      } else if (shot.type === 'establish') {
        shot.startPos = [0, 50, 80];
        shot.endPos = [0, 40, 60];
      }

      shots.push(shot);
    }

    return {
      durationSec,
      shots,
    };
  }

  /**
   * Generate environment settings based on style
   */
  generateEnvironmentFromStyle(style) {
    const styleDefaults = this.getStyleDefaults(style);
    return { ...styleDefaults.environment };
  }

  /**
   * Generate render configuration based on style
   */
  generateRenderConfigFromStyle(style) {
    const styleDefaults = this.getStyleDefaults(style);
    return { ...styleDefaults.render };
  }

  /**
   * Repair content with prompt context
   */
  async repairWithContext(content, originalPrompt, style, options = {}) {
    const repairOptions = {
      ...options,
      prompt: originalPrompt,
      style: style || 'ethereal',
      usePromptContext: true,
    };

    // Use errors from options if provided, otherwise empty array
    const errors = options.errors || [];

    return this.repairContent(content, errors, repairOptions);
  }

  /**
   * Main repair method
   */
  async repairContent(content, errors = [], options = {}) {
    if (!this.config.enabled) {
      return {
        success: false,
        content,
        errors,
        message: 'Content repair is disabled',
      };
    }

    this.metrics.totalRepairAttempts++;

    const repairContext = {
      originalContent: _.cloneDeep(content),
      currentContent: _.cloneDeep(content),
      originalErrors: [...errors],
      remainingErrors: [...errors],
      appliedStrategies: [],
      warnings: [],
      startTime: Date.now(),
    };

    try {
      // Handle null or invalid content
      if (!content || typeof content !== 'object') {
        throw new Error('Invalid content provided for repair');
      }

      // Ensure basic structure exists
      // Only add data wrapper if content is not already a dream object
      const isDreamObject =
        content.id && content.structures && content.entities;

      if (!isDreamObject && !content.data) {
        content.data = {};
      }
      if (!content.metadata) {
        content.metadata = {};
      }

      let currentAttempt = 0;
      const maxAttempts = options.maxAttempts || this.config.maxAttempts;

      while (
        repairContext.remainingErrors.length > 0 &&
        currentAttempt < maxAttempts
      ) {
        currentAttempt++;
        let progressMade = false;

        for (const strategyName of this.config.strategies) {
          if (repairContext.remainingErrors.length === 0) break;

          try {
            const strategyResult = await this.repairStrategies[strategyName](
              repairContext.currentContent,
              repairContext.remainingErrors,
              options
            );

            if (strategyResult.success) {
              repairContext.currentContent = strategyResult.content;
              repairContext.remainingErrors = strategyResult.remainingErrors;
              repairContext.warnings.push(...strategyResult.warnings);
              repairContext.appliedStrategies.push(strategyName);
              progressMade = true;

              // Update metrics
              this.metrics.repairsByStrategy[strategyName] =
                (this.metrics.repairsByStrategy[strategyName] || 0) + 1;

              this.logger.debug(`Strategy ${strategyName} succeeded`, {
                remainingErrors: repairContext.remainingErrors.length,
                warnings: strategyResult.warnings.length,
              });
            }
          } catch (strategyError) {
            this.logger.warn(`Strategy ${strategyName} failed`, {
              error: strategyError.message,
            });
          }
        }

        if (!progressMade) {
          this.logger.warn('No progress made in repair attempt', {
            attempt: currentAttempt,
            remainingErrors: repairContext.remainingErrors.length,
          });
          break;
        }
      }

      const success = repairContext.remainingErrors.length === 0;
      const processingTime = Date.now() - repairContext.startTime;

      if (success) {
        this.metrics.successfulRepairs++;
      } else {
        this.metrics.failedRepairs++;
      }

      // Record repair metrics to shared ValidationMonitor
      if (validationMonitor) {
        validationMonitor.recordRepair(
          options.source || 'mcp-gateway',
          options.provider || 'unknown',
          {
            success,
            strategiesApplied: repairContext.appliedStrategies,
            originalErrorCount: repairContext.originalErrors.length,
            remainingErrorCount: repairContext.remainingErrors.length,
            processingTime,
            attempts: currentAttempt,
          }
        );
      }

      // Update metadata with repair information
      if (repairContext.currentContent.metadata) {
        repairContext.currentContent.metadata.repairInfo = {
          applied: repairContext.appliedStrategies,
          processingTime,
          originalErrorCount: repairContext.originalErrors.length,
          remainingErrorCount: repairContext.remainingErrors.length,
          warningCount: repairContext.warnings.length,
        };
      }

      return {
        success,
        content: repairContext.currentContent,
        errors: repairContext.remainingErrors,
        warnings: repairContext.warnings,
        appliedStrategies: repairContext.appliedStrategies,
        processingTime,
        attempts: currentAttempt,
      };
    } catch (error) {
      this.metrics.failedRepairs++;
      this.logger.error('Content repair failed', { error: error.message });

      return {
        success: false,
        content: repairContext.originalContent,
        errors: [...repairContext.originalErrors, error.message],
        warnings: repairContext.warnings,
        appliedStrategies: repairContext.appliedStrategies,
        processingTime: Date.now() - repairContext.startTime,
      };
    }
  }

  /**
   * Validate repaired content against schema
   */
  validateRepairedContent(content) {
    const DreamSchema = require('../schemas/DreamSchema');
    const validationResult = {
      valid: true,
      errors: [],
      warnings: [],
      fieldCounts: {},
    };

    try {
      // Validate complete dream object if it has the expected structure
      if (content.data) {
        const dreamData = content.data;

        // Count structures
        if (dreamData.structures && Array.isArray(dreamData.structures)) {
          validationResult.fieldCounts.structures = dreamData.structures.length;
          const structureValidation = DreamSchema.validateStructures(
            dreamData.structures
          );
          if (!structureValidation.valid) {
            validationResult.valid = false;
            validationResult.errors.push(...structureValidation.errors);
          }
        } else {
          validationResult.valid = false;
          validationResult.errors.push({
            field: 'structures',
            error: 'MISSING_REQUIRED_FIELD',
            message: 'Structures array is missing or invalid',
          });
        }

        // Count entities
        if (dreamData.entities && Array.isArray(dreamData.entities)) {
          validationResult.fieldCounts.entities = dreamData.entities.length;
          const entityValidation = DreamSchema.validateEntities(
            dreamData.entities
          );
          if (!entityValidation.valid) {
            validationResult.valid = false;
            validationResult.errors.push(...entityValidation.errors);
          }
        } else {
          validationResult.valid = false;
          validationResult.errors.push({
            field: 'entities',
            error: 'MISSING_REQUIRED_FIELD',
            message: 'Entities array is missing or invalid',
          });
        }

        // Validate cinematography
        if (dreamData.cinematography) {
          const cinematographyValidation = DreamSchema.validateCinematography(
            dreamData.cinematography
          );
          if (!cinematographyValidation.valid) {
            validationResult.valid = false;
            validationResult.errors.push(...cinematographyValidation.errors);
          }
          if (dreamData.cinematography.shots) {
            validationResult.fieldCounts.shots =
              dreamData.cinematography.shots.length;
          }
        } else {
          validationResult.valid = false;
          validationResult.errors.push({
            field: 'cinematography',
            error: 'MISSING_REQUIRED_FIELD',
            message: 'Cinematography is missing',
          });
        }

        // Validate environment
        if (dreamData.environment) {
          const environmentValidation = DreamSchema.validateEnvironment(
            dreamData.environment
          );
          if (!environmentValidation.valid) {
            validationResult.valid = false;
            validationResult.errors.push(...environmentValidation.errors);
          }
        } else {
          validationResult.warnings.push({
            field: 'environment',
            message: 'Environment settings are missing',
          });
        }

        // Validate render config
        if (dreamData.render) {
          const renderValidation = DreamSchema.validateRenderConfig(
            dreamData.render
          );
          if (!renderValidation.valid) {
            validationResult.valid = false;
            validationResult.errors.push(...renderValidation.errors);
          }
        } else {
          validationResult.warnings.push({
            field: 'render',
            message: 'Render configuration is missing',
          });
        }
      } else {
        validationResult.valid = false;
        validationResult.errors.push({
          field: 'data',
          error: 'MISSING_REQUIRED_FIELD',
          message: 'Data object is missing',
        });
      }

      return validationResult;
    } catch (error) {
      this.logger.error('Validation failed', { error: error.message });
      return {
        valid: false,
        errors: [
          {
            field: 'validation',
            error: 'VALIDATION_ERROR',
            message: `Validation failed: ${error.message}`,
          },
        ],
        warnings: [],
        fieldCounts: validationResult.fieldCounts,
      };
    }
  }

  /**
   * Generate detailed repair report
   */
  generateRepairReport(repairResult, validationResult) {
    const report = {
      timestamp: new Date().toISOString(),
      success: repairResult.success,
      processingTime: repairResult.processingTime,
      attempts: repairResult.attempts,
      appliedStrategies: repairResult.appliedStrategies,
      errorReduction: {
        original: repairResult.errors?.length || 0,
        remaining: repairResult.errors?.length || 0,
        fixed:
          (repairResult.errors?.length || 0) -
          (repairResult.errors?.length || 0),
      },
      validation: {
        valid: validationResult?.valid || false,
        errorCount: validationResult?.errors?.length || 0,
        warningCount: validationResult?.warnings?.length || 0,
        fieldCounts: validationResult?.fieldCounts || {},
      },
      warnings: repairResult.warnings || [],
      recommendations: [],
    };

    // Add recommendations based on validation results
    if (validationResult && !validationResult.valid) {
      if (
        !validationResult.fieldCounts.structures ||
        validationResult.fieldCounts.structures === 0
      ) {
        report.recommendations.push(
          'Add at least one structure for 3D rendering'
        );
      }
      if (
        !validationResult.fieldCounts.entities ||
        validationResult.fieldCounts.entities === 0
      ) {
        report.recommendations.push(
          'Add at least one entity for interactive elements'
        );
      }
      if (
        !validationResult.fieldCounts.shots ||
        validationResult.fieldCounts.shots === 0
      ) {
        report.recommendations.push('Add camera shots for cinematography');
      }
    }

    // Add effectiveness metrics
    if (repairResult.appliedStrategies.length > 0) {
      report.effectiveness = {
        strategiesUsed: repairResult.appliedStrategies.length,
        averageTimePerStrategy:
          repairResult.processingTime / repairResult.appliedStrategies.length,
        successRate: repairResult.success && validationResult?.valid ? 100 : 0,
      };
    }

    return report;
  }

  /**
   * Log repair effectiveness and success rates
   */
  logRepairEffectiveness(report) {
    const logLevel =
      report.success && report.validation.valid ? 'info' : 'warn';

    this.logger[logLevel]('Content repair completed', {
      success: report.success,
      validationPassed: report.validation.valid,
      processingTime: report.processingTime,
      strategiesApplied: report.appliedStrategies.length,
      errorReduction: report.errorReduction,
      fieldCounts: report.validation.fieldCounts,
      recommendations: report.recommendations,
    });

    // Update metrics with validation results
    if (report.validation.valid) {
      this.metrics.successfulRepairs++;
    } else {
      this.metrics.failedRepairs++;
    }

    // Track repair effectiveness by strategy
    for (const strategy of report.appliedStrategies) {
      if (!this.metrics.repairsByStrategy[strategy]) {
        this.metrics.repairsByStrategy[strategy] = 0;
      }
      this.metrics.repairsByStrategy[strategy]++;
    }

    return report;
  }

  /**
   * Repair content with validation and reporting
   */
  async repairAndValidate(content, errors = [], options = {}) {
    // Perform repair
    const repairResult = await this.repairContent(content, errors, options);

    // Validate repaired content
    const validationResult = this.validateRepairedContent(repairResult.content);

    // Generate comprehensive report
    const report = this.generateRepairReport(repairResult, validationResult);

    // Log effectiveness
    this.logRepairEffectiveness(report);

    return {
      ...repairResult,
      validation: validationResult,
      report,
    };
  }

  /**
   * Fix structural issues
   * Works with dream objects (structures/entities) not legacy scenes
   */
  async fixStructure(content, errors, options = {}) {
    const result = {
      success: false,
      content: _.cloneDeep(content),
      remainingErrors: [...errors],
      warnings: [],
    };

    try {
      let structureFixed = false;

      // Determine if this is a dream object or wrapped in data
      const isDreamObject =
        result.content.id &&
        result.content.structures &&
        result.content.cinematography;

      // Work with the actual dream data
      const dreamData = isDreamObject ? result.content : result.content.data;

      if (!dreamData) {
        // Create basic dream structure
        result.content = {
          id: result.content.id || uuidv4(),
          title: result.content.title || 'Untitled Dream',
          style: result.content.style || options.style || 'ethereal',
          structures: [],
          entities: [],
          cinematography: {
            durationSec: 30,
            shots: [],
          },
          environment: {},
          render: {},
          metadata: result.content.metadata || {},
        };
        structureFixed = true;
      } else {
        // Ensure required arrays exist
        if (!dreamData.structures || !Array.isArray(dreamData.structures)) {
          dreamData.structures = [];
          structureFixed = true;
        }

        if (!dreamData.entities || !Array.isArray(dreamData.entities)) {
          dreamData.entities = [];
          structureFixed = true;
        }

        // Ensure cinematography exists with correct structure
        if (!dreamData.cinematography) {
          dreamData.cinematography = {
            durationSec: 30,
            shots: [],
          };
          structureFixed = true;
        } else if (!dreamData.cinematography.shots) {
          dreamData.cinematography.shots = [];
          structureFixed = true;
        }

        // Ensure metadata exists
        if (!result.content.metadata) {
          result.content.metadata = {};
          structureFixed = true;
        }
      }

      if (structureFixed) {
        result.success = true;
        result.warnings.push({
          type: 'structure_fixed',
          message: 'Fixed structural issues in dream object',
          severity: 'medium',
        });

        // Remove structure-related errors
        result.remainingErrors = result.remainingErrors.filter((error) => {
          const errorStr =
            typeof error === 'string' ? error : error.message || '';
          return (
            !errorStr.includes('structure') &&
            !errorStr.includes('scenes') &&
            !errorStr.includes('data') &&
            !errorStr.includes('metadata')
          );
        });
      }

      return result;
    } catch (error) {
      throw new Error(`Structure repair failed: ${error.message}`);
    }
  }

  /**
   * Fill missing required fields
   * Works with dream objects (structures/entities) not legacy scenes
   */
  async fillMissingFields(content, errors, options = {}) {
    const result = {
      success: false,
      content: _.cloneDeep(content),
      remainingErrors: [...errors],
      warnings: [],
    };

    try {
      let fieldsFilled = 0;
      const prompt = options.originalPrompt || options.prompt || '';

      // Determine if this is a dream object or wrapped in data
      const isDreamObject =
        result.content.id &&
        result.content.structures &&
        result.content.cinematography;

      // Work with the actual dream data
      const dreamData = isDreamObject ? result.content : result.content.data;

      if (!dreamData) {
        throw new Error('Cannot fill missing fields: no dream data found');
      }

      const style = options.style || dreamData.style || 'ethereal';
      const usePromptContext = options.usePromptContext !== false; // Default to true

      // Fill missing dream fields
      if (!dreamData.id) {
        dreamData.id = uuidv4();
        fieldsFilled++;
      }

      if (!dreamData.title) {
        dreamData.title =
          usePromptContext && prompt
            ? prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')
            : 'Generated Dream Experience';
        fieldsFilled++;
      }

      if (!dreamData.style) {
        dreamData.style = style;
        fieldsFilled++;
      }

      // Generate or fill structures using prompt context
      if (
        !dreamData.structures ||
        !Array.isArray(dreamData.structures) ||
        dreamData.structures.length === 0
      ) {
        if (usePromptContext && prompt) {
          dreamData.structures = this.generateStructuresFromPrompt(
            prompt,
            style,
            2
          );
          fieldsFilled += dreamData.structures.length;
          this.logger.info('Generated structures from prompt context', {
            count: dreamData.structures.length,
            style,
          });
        } else {
          dreamData.structures = [
            {
              id: `s${Date.now()}`,
              type: 'floating_platform',
              pos: [0, 20, 0],
              rotation: [0, 0, 0],
              scale: [10, 1, 10],
              features: ['glowing_edges'],
            },
          ];
          fieldsFilled++;
        }
      } else {
        // Validate and fill missing structure fields
        for (const structure of dreamData.structures) {
          if (!structure.id) {
            structure.id = `s${Date.now()}`;
            fieldsFilled++;
          }
          if (!structure.type) {
            structure.type = 'floating_platform';
            fieldsFilled++;
          }
          if (!structure.pos || !Array.isArray(structure.pos)) {
            structure.pos = [0, 20, 0];
            fieldsFilled++;
          }
          if (!structure.rotation || !Array.isArray(structure.rotation)) {
            structure.rotation = [0, 0, 0];
            fieldsFilled++;
          }
          if (!structure.scale) {
            structure.scale = 5;
            fieldsFilled++;
          }
          if (!structure.features || !Array.isArray(structure.features)) {
            structure.features = ['glowing_edges'];
            fieldsFilled++;
          }
        }
      }

      // Generate or fill entities using prompt context
      if (
        !dreamData.entities ||
        !Array.isArray(dreamData.entities) ||
        dreamData.entities.length === 0
      ) {
        if (usePromptContext && prompt) {
          dreamData.entities = this.generateEntitiesFromPrompt(
            prompt,
            style,
            2
          );
          fieldsFilled += dreamData.entities.length;
          this.logger.info('Generated entities from prompt context', {
            count: dreamData.entities.length,
            style,
          });
        } else {
          dreamData.entities = [
            {
              id: `e${Date.now()}`,
              type: 'floating_orbs',
              count: 20,
              params: {
                speed: 1.0,
                glow: 0.5,
                size: 1.0,
                color: '#ffffff',
              },
            },
          ];
          fieldsFilled++;
        }
      } else {
        // Validate and fill missing entity fields
        for (const entity of dreamData.entities) {
          if (!entity.id) {
            entity.id = `e${Date.now()}`;
            fieldsFilled++;
          }
          if (!entity.type) {
            entity.type = 'floating_orbs';
            fieldsFilled++;
          }
          if (!entity.count) {
            entity.count = 20;
            fieldsFilled++;
          }
          if (!entity.params) {
            const styleDefaults = this.getStyleDefaults(style);
            entity.params = {
              speed: 1.0,
              glow: 0.5,
              size: 1.0,
              color: styleDefaults.colors[0],
            };
            fieldsFilled++;
          }
        }
      }

      // Generate or fill cinematography using prompt context
      if (
        !dreamData.cinematography ||
        typeof dreamData.cinematography !== 'object'
      ) {
        if (usePromptContext) {
          dreamData.cinematography = this.generateCinematographyFromPrompt(
            prompt,
            style,
            dreamData.structures
          );
          fieldsFilled++;
          this.logger.info('Generated cinematography from style context', {
            style,
            shotCount: dreamData.cinematography.shots.length,
          });
        } else {
          dreamData.cinematography = {
            durationSec: 30,
            shots: [
              {
                type: 'establish',
                duration: 10,
                startPos: [0, 50, 80],
                endPos: [0, 40, 60],
              },
              {
                type: 'orbit',
                duration: 20,
                startPos: [40, 25, 0],
                endPos: [0, 25, 40],
              },
            ],
          };
          fieldsFilled++;
        }
      }

      // Generate or fill environment using style context
      if (
        !result.content.data.environment ||
        typeof result.content.data.environment !== 'object'
      ) {
        result.content.data.environment =
          this.generateEnvironmentFromStyle(style);
        fieldsFilled++;
        this.logger.info('Generated environment from style context', { style });
      }

      // Generate or fill render config using style context
      if (
        !result.content.data.render ||
        typeof result.content.data.render !== 'object'
      ) {
        result.content.data.render = this.generateRenderConfigFromStyle(style);
        fieldsFilled++;
        this.logger.info('Generated render config from style context', {
          style,
        });
      }

      // Fill missing metadata fields
      if (result.content.metadata) {
        const metadataDefaults = {
          source: 'enhanced-repair',
          model: 'repair-system',
          processingTime: this.config.defaults.processingTime,
          quality: this.config.defaults.quality,
          confidence: this.config.defaults.confidence,
          cacheHit: this.config.defaults.cacheHit,
          tokens: { input: 100, output: 200, total: 300 },
        };

        if (usePromptContext && prompt) {
          metadataDefaults.originalText = prompt;
          metadataDefaults.requestedStyle = style;
        }

        for (const [field, defaultValue] of Object.entries(metadataDefaults)) {
          if (result.content.metadata[field] === undefined) {
            result.content.metadata[field] = defaultValue;
            fieldsFilled++;
          }
        }
      }

      if (fieldsFilled > 0) {
        result.success = true;
        const message = usePromptContext
          ? `Filled ${fieldsFilled} missing fields using prompt context`
          : `Filled ${fieldsFilled} missing fields with defaults`;
        result.warnings.push({
          type: 'fields_filled',
          message,
          severity: 'low',
        });

        // Remove missing field errors
        result.remainingErrors = result.remainingErrors.filter((error) => {
          const errorStr =
            typeof error === 'string' ? error : error.message || '';
          return (
            !errorStr.includes('required') &&
            !errorStr.includes('missing') &&
            !errorStr.includes('must have')
          );
        });
      }

      return result;
    } catch (error) {
      throw new Error(`Missing fields repair failed: ${error.message}`);
    }
  }

  /**
   * Enhance content quality
   */
  async enhanceContent(content, errors, options = {}) {
    const result = {
      success: false,
      content: _.cloneDeep(content),
      remainingErrors: [...errors],
      warnings: [],
    };

    try {
      let contentEnhanced = false;

      // Enhance title if too short
      if (
        result.content.data?.title &&
        result.content.data.title.length < this.config.repair.minTitleLength
      ) {
        result.content.data.title = `Enhanced ${result.content.data.title} Dream Experience`;
        contentEnhanced = true;
      }

      // Enhance description if too short
      if (
        result.content.data?.description &&
        result.content.data.description.length <
          this.config.repair.minDescriptionLength
      ) {
        result.content.data.description = `${result.content.data.description}. This immersive experience features detailed environments with carefully crafted atmospheric elements that create a compelling and engaging dreamscape.`;
        contentEnhanced = true;
      }

      // Enhance structure and entity details
      if (
        result.content.data?.structures &&
        Array.isArray(result.content.data.structures)
      ) {
        for (const structure of result.content.data.structures) {
          if (!structure.features || structure.features.length === 0) {
            structure.features = ['enhanced_details'];
            contentEnhanced = true;
          }
        }
      }

      if (
        result.content.data?.entities &&
        Array.isArray(result.content.data.entities)
      ) {
        for (const entity of result.content.data.entities) {
          if (!entity.params) {
            entity.params = {
              speed: 1.0,
              glow: 0.5,
              size: 1.0,
              color: '#ffffff',
            };
            contentEnhanced = true;
          }
        }
      }

      if (contentEnhanced) {
        result.success = true;
        result.warnings.push({
          type: 'content_enhanced',
          message: 'Enhanced content quality and descriptions',
          severity: 'low',
        });

        // Remove content quality errors
        result.remainingErrors = result.remainingErrors.filter((error) => {
          const errorStr =
            typeof error === 'string' ? error : error.message || '';
          return (
            !errorStr.includes('length') &&
            !errorStr.includes('too short') &&
            !errorStr.includes('min')
          );
        });
      }

      return result;
    } catch (error) {
      throw new Error(`Content enhancement failed: ${error.message}`);
    }
  }

  /**
   * Validate and fix data types
   */
  async validateTypes(content, errors, options = {}) {
    const result = {
      success: false,
      content: _.cloneDeep(content),
      remainingErrors: [...errors],
      warnings: [],
    };

    try {
      let typesFixed = false;

      // Fix data.id type
      if (
        result.content.data?.id &&
        typeof result.content.data.id !== 'string'
      ) {
        result.content.data.id = String(result.content.data.id);
        typesFixed = true;
      }

      // Fix data.title type
      if (
        result.content.data?.title &&
        typeof result.content.data.title !== 'string'
      ) {
        result.content.data.title = String(result.content.data.title);
        typesFixed = true;
      }

      // Fix dream structure types
      if (
        result.content.data?.structures &&
        !Array.isArray(result.content.data.structures)
      ) {
        result.content.data.structures = [];
        typesFixed = true;
      }

      if (
        result.content.data?.entities &&
        !Array.isArray(result.content.data.entities)
      ) {
        result.content.data.entities = [];
        typesFixed = true;
      }

      // Fix metadata.processingTime type
      if (
        result.content.metadata?.processingTime &&
        typeof result.content.metadata.processingTime !== 'number'
      ) {
        const parsed = parseInt(result.content.metadata.processingTime);
        result.content.metadata.processingTime = isNaN(parsed) ? 1000 : parsed;
        typesFixed = true;
      }

      // Fix structure positions
      if (
        result.content.data?.structures &&
        Array.isArray(result.content.data.structures)
      ) {
        for (const structure of result.content.data.structures) {
          if (structure.pos && !Array.isArray(structure.pos)) {
            structure.pos = [0, 20, 0];
            typesFixed = true;
          }
          if (structure.rotation && !Array.isArray(structure.rotation)) {
            structure.rotation = [0, 0, 0];
            typesFixed = true;
          }
        }
      }

      if (typesFixed) {
        result.success = true;
        result.warnings.push({
          type: 'types_fixed',
          message: 'Fixed data type issues',
          severity: 'low',
        });

        // Remove type-related errors
        result.remainingErrors = result.remainingErrors.filter((error) => {
          const errorStr =
            typeof error === 'string' ? error : error.message || '';
          return (
            !errorStr.includes('must be a') &&
            !errorStr.includes('type') &&
            !errorStr.includes('number') &&
            !errorStr.includes('string') &&
            !errorStr.includes('array')
          );
        });
      }

      return result;
    } catch (error) {
      throw new Error(`Type validation failed: ${error.message}`);
    }
  }

  /**
   * Normalize metadata values
   */
  async normalizeMetadata(content, errors, options = {}) {
    const result = {
      success: false,
      content: _.cloneDeep(content),
      remainingErrors: [...errors],
      warnings: [],
    };

    try {
      let metadataFixed = false;

      if (result.content.metadata) {
        const metadata = result.content.metadata;

        // Normalize confidence score
        if (typeof metadata.confidence === 'number') {
          if (metadata.confidence > 1) {
            if (metadata.confidence > 100) {
              metadata.confidence = 1.0;
            } else {
              metadata.confidence = metadata.confidence / 100;
            }
            metadata.confidence = Math.min(metadata.confidence, 1.0);
            metadataFixed = true;
          } else if (metadata.confidence < 0) {
            metadata.confidence = 0;
            metadataFixed = true;
          }
        }

        // Normalize quality value
        const validQualities = ['draft', 'standard', 'high', 'cinematic'];
        if (metadata.quality && !validQualities.includes(metadata.quality)) {
          metadata.quality = 'standard';
          metadataFixed = true;
        }

        // Normalize processingTime
        if (
          metadata.processingTime &&
          typeof metadata.processingTime !== 'number'
        ) {
          const parsed = parseInt(metadata.processingTime);
          metadata.processingTime = isNaN(parsed) ? 1000 : Math.max(0, parsed);
          metadataFixed = true;
        }

        // Normalize token counts
        if (metadata.tokens && typeof metadata.tokens === 'object') {
          ['input', 'output', 'total'].forEach((field) => {
            if (
              metadata.tokens[field] &&
              typeof metadata.tokens[field] !== 'number'
            ) {
              const parsed = parseInt(metadata.tokens[field]);
              metadata.tokens[field] = isNaN(parsed) ? 0 : Math.max(0, parsed);
              metadataFixed = true;
            }
          });
        }
      }

      if (metadataFixed) {
        result.success = true;
        result.warnings.push({
          type: 'metadata_normalized',
          message: 'Normalized metadata values to valid ranges',
          severity: 'low',
        });

        // Remove metadata-related errors
        result.remainingErrors = result.remainingErrors.filter((error) => {
          const errorStr =
            typeof error === 'string' ? error : error.message || '';
          return (
            !errorStr.includes('confidence') &&
            !errorStr.includes('quality') &&
            !errorStr.includes('processingTime') &&
            !errorStr.includes('tokens')
          );
        });
      }

      return result;
    } catch (error) {
      throw new Error(`Metadata normalization failed: ${error.message}`);
    }
  }

  /**
   * Get repair metrics
   */
  getRepairMetrics() {
    const successRate =
      this.metrics.totalRepairAttempts > 0
        ? (this.metrics.successfulRepairs / this.metrics.totalRepairAttempts) *
          100
        : 0;

    return {
      totalRepairAttempts: this.metrics.totalRepairAttempts,
      successfulRepairs: this.metrics.successfulRepairs,
      failedRepairs: this.metrics.failedRepairs,
      successRate,
      repairsByStrategy: { ...this.metrics.repairsByStrategy },
      repairsByErrorType: { ...this.metrics.repairsByErrorType },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRepairAttempts: 0,
      successfulRepairs: 0,
      failedRepairs: 0,
      repairsByStrategy: {},
      repairsByErrorType: {},
    };
  }

  /**
   * Helper method to group repairs by field for summary logging
   * @private
   */
  _groupRepairsByField(repairs) {
    const grouped = {};
    for (const repair of repairs) {
      const field = repair.field || 'unknown';
      if (!grouped[field]) {
        grouped[field] = 0;
      }
      grouped[field]++;
    }
    return grouped;
  }

  /**
   * Track repair metrics for aggregate reporting
   * @private
   */
  _trackRepairMetrics(repairs) {
    if (!repairs || repairs.length === 0) {
      return;
    }

    for (const repair of repairs) {
      // Count by type (enum, parameter, id)
      const type = repair.type || 'enum';
      if (this.metrics.repairsByType[type] !== undefined) {
        this.metrics.repairsByType[type]++;
      }

      // Count by field
      const field = repair.field || 'unknown';
      if (!this.metrics.repairsByField[field]) {
        this.metrics.repairsByField[field] = 0;
      }
      this.metrics.repairsByField[field]++;
    }

    // Check if it's time to log aggregate metrics
    const now = Date.now();
    if (now - this.metrics.lastMetricsLog >= this.metrics.metricsLogInterval) {
      this._logAggregateMetrics();
      this.metrics.lastMetricsLog = now;
    }
  }

  /**
   * Log aggregate repair metrics
   * @private
   */
  _logAggregateMetrics() {
    const totalRepairs =
      this.metrics.repairsByType.enum +
      this.metrics.repairsByType.parameter +
      this.metrics.repairsByType.id;

    if (totalRepairs === 0) {
      return; // No repairs to report
    }

    // Calculate success rate
    const totalAttempts = this.metrics.totalRepairAttempts || 1;
    const successRate = (
      (this.metrics.successfulRepairs / totalAttempts) *
      100
    ).toFixed(2);

    this.logger.info('[RepairMetrics] Aggregate repair metrics', {
      timestamp: new Date().toISOString(),
      totalRepairs,
      repairsByType: { ...this.metrics.repairsByType },
      repairsByField: { ...this.metrics.repairsByField },
      successRate: `${successRate}%`,
      totalAttempts: this.metrics.totalRepairAttempts,
      successfulRepairs: this.metrics.successfulRepairs,
      failedRepairs: this.metrics.failedRepairs,
    });
  }

  /**
   * Get current repair metrics (for monitoring/testing)
   */
  getRepairMetrics() {
    const totalRepairs =
      this.metrics.repairsByType.enum +
      this.metrics.repairsByType.parameter +
      this.metrics.repairsByType.id;

    const totalAttempts = this.metrics.totalRepairAttempts || 1;
    const successRate = (
      (this.metrics.successfulRepairs / totalAttempts) *
      100
    ).toFixed(2);

    return {
      totalRepairs,
      repairsByType: { ...this.metrics.repairsByType },
      repairsByField: { ...this.metrics.repairsByField },
      successRate: parseFloat(successRate),
      totalAttempts: this.metrics.totalRepairAttempts,
      successfulRepairs: this.metrics.successfulRepairs,
      failedRepairs: this.metrics.failedRepairs,
    };
  }

  /**
   * Reset repair metrics (useful for testing)
   */
  resetRepairMetrics() {
    this.metrics.repairsByType = {
      enum: 0,
      parameter: 0,
      id: 0,
    };
    this.metrics.repairsByField = {};
    this.metrics.lastMetricsLog = Date.now();
  }

  /**
   * Repair strategy: Fix enum violations
   * This is the strategy wrapper that integrates with the repair workflow
   */
  async repairEnums(content, errors, options = {}) {
    try {
      const result = {
        success: false,
        content: _.cloneDeep(content),
        remainingErrors: [...errors],
        warnings: [],
      };

      // Check if content has data field (dream object)
      if (!result.content.data) {
        return result;
      }

      const dream = result.content.data;

      // Apply enum repairs (for non-type fields like source, shot types, etc.)
      const repairResult = this.repairEnumViolations(dream, errors);

      // Apply flexible type repairs for structures and entities
      let structureRepairResult = { repaired: false, repairs: [] };
      let entityRepairResult = { repaired: false, repairs: [] };

      if (dream.structures && Array.isArray(dream.structures)) {
        structureRepairResult = this.repairStructures(dream.structures);
      }

      if (dream.entities && Array.isArray(dream.entities)) {
        entityRepairResult = this.repairEntities(dream.entities);
      }

      // Combine all repairs
      const allRepairs = [
        ...repairResult.repairs,
        ...structureRepairResult.repairs,
        ...entityRepairResult.repairs,
      ];

      if (allRepairs.length > 0) {
        result.success = true;
        result.content.data = dream;

        // Remove enum-related and type-related errors from remaining errors
        result.remainingErrors = errors.filter((error) => {
          const isEnumError =
            error.error === 'INVALID_ENUM_VALUE' ||
            (typeof error === 'string' && error.includes('enum')) ||
            (error.message && error.message.includes('enum'));

          const isTypeError =
            error.error === 'INVALID_TYPE_FORMAT' ||
            (typeof error === 'string' && error.includes('type')) ||
            (error.message && error.message.includes('type'));

          // Keep errors that weren't repaired
          if (!isEnumError && !isTypeError) return true;

          const field = error.field || error.path;
          const wasRepaired = allRepairs.some(
            (repair) => repair.field === field
          );

          return !wasRepaired;
        });

        // Add warnings for repairs made
        allRepairs.forEach((repair) => {
          result.warnings.push(
            `Repaired ${repair.field}: ${repair.originalValue} → ${repair.repairedValue}`
          );
        });

        this.logger.info('[RepairStrategy] Enum and type repair completed', {
          enumRepairsCount: repairResult.repairs.length,
          structureRepairsCount: structureRepairResult.repairs.length,
          entityRepairsCount: entityRepairResult.repairs.length,
          totalRepairs: allRepairs.length,
          remainingErrors: result.remainingErrors.length,
        });
      }

      return result;
    } catch (error) {
      this.logger.error('[RepairStrategy] Enum repair failed', {
        error: error.message,
      });
      throw new Error(`Enum repair failed: ${error.message}`);
    }
  }

  /**
   * Repairs invalid enum values in a dream
   * @param {Object} dream - Dream object
   * @param {Array} validationErrors - Errors from UnifiedValidator
   * @returns {Object} {repaired: boolean, repairs: Array}
   */
  repairEnumViolations(dream, validationErrors) {
    const EnumMapper = require('../validators/EnumMapper');
    const repairs = [];

    if (!dream || !validationErrors || !Array.isArray(validationErrors)) {
      return { repaired: false, repairs: [] };
    }

    // Process each validation error
    for (const error of validationErrors) {
      // Check if this is an enum violation error
      const isEnumError =
        error.error === 'INVALID_ENUM_VALUE' ||
        (typeof error === 'string' && error.includes('enum')) ||
        (error.message && error.message.includes('enum'));

      if (!isEnumError) {
        continue;
      }

      // Determine which field has the enum violation
      const field = error.field || error.path;

      if (field === 'source') {
        // Repair source enum
        const originalValue = dream.source;
        const repairedValue = this.repairSourceEnum(dream, originalValue);

        if (repairedValue !== originalValue) {
          dream.source = repairedValue;
          const repairInfo = {
            type: 'enum',
            field: 'source',
            originalValue,
            repairedValue,
            reason: 'Invalid source enum mapped to valid value',
            timestamp: new Date().toISOString(),
            dreamId: dream.id || 'unknown',
          };
          repairs.push(repairInfo);

          // Enhanced logging with all required fields
          this.logger.info('[EnumRepair] Repaired source enum', {
            field: 'source',
            original: originalValue,
            repaired: repairedValue,
            reason: 'Invalid source enum mapped to valid value',
            dreamId: dream.id || 'unknown',
            timestamp: repairInfo.timestamp,
          });
        }
      } else if (
        field === 'cinematography.shots[].type' ||
        field === 'cinematography.shots.type' ||
        (field && field.includes('cinematography'))
      ) {
        // Repair shot types
        const shotRepairs = this.repairShotTypes(dream);
        if (shotRepairs.repaired) {
          repairs.push(...shotRepairs.repairs);
        }
      } else if (field === 'id') {
        // Repair dream ID
        const originalId = dream.id;
        const newId = this.repairDreamId(dream);

        if (newId !== originalId) {
          const repairInfo = {
            type: 'id',
            field: 'id',
            originalValue: originalId,
            repairedValue: newId,
            reason: 'Invalid ID format replaced with UUID',
            timestamp: new Date().toISOString(),
            dreamId: newId,
          };
          repairs.push(repairInfo);

          // Enhanced logging with all required fields
          this.logger.info('[EnumRepair] Repaired dream ID', {
            field: 'id',
            original: originalId,
            repaired: newId,
            reason: 'Invalid ID format replaced with UUID',
            dreamId: newId,
            timestamp: repairInfo.timestamp,
          });
        }
      } else {
        // Generic enum repair using EnumMapper
        const originalValue = _.get(dream, field);
        if (originalValue) {
          const closestValue = EnumMapper.findClosestEnumValue(
            field,
            originalValue
          );
          if (closestValue && closestValue !== originalValue) {
            _.set(dream, field, closestValue);
            const repairInfo = {
              type: 'enum',
              field,
              originalValue,
              repairedValue: closestValue,
              reason: 'Invalid enum value mapped to closest valid value',
              timestamp: new Date().toISOString(),
              dreamId: dream.id || 'unknown',
            };
            repairs.push(repairInfo);

            // Enhanced logging with all required fields
            this.logger.info('[EnumRepair] Repaired enum field', {
              field,
              original: originalValue,
              repaired: closestValue,
              reason: 'Invalid enum value mapped to closest valid value',
              dreamId: dream.id || 'unknown',
              timestamp: repairInfo.timestamp,
            });
          }
        }
      }
    }

    // Enhanced summary logging
    if (repairs.length > 0) {
      this.logger.info(
        `[EnumRepair] Completed enum repairs in dream ${dream.id || 'unknown'}`,
        {
          totalRepairs: repairs.length,
          repairsByField: this._groupRepairsByField(repairs),
          dreamId: dream.id || 'unknown',
          timestamp: new Date().toISOString(),
        }
      );

      // Track metrics for aggregate reporting
      this._trackRepairMetrics(repairs);
    }

    return {
      repaired: repairs.length > 0,
      repairs,
    };
  }

  /**
   * Repairs invalid source enum value
   * @param {Object} dream - Dream object
   * @param {string} invalidSource - Current invalid source
   * @returns {string} Valid source value
   */
  repairSourceEnum(dream, invalidSource) {
    const EnumMapper = require('../validators/EnumMapper');

    if (!invalidSource) {
      this.logger.warn('[EnumRepair] No source value provided, using default');
      return 'express';
    }

    // Check if it's already valid
    if (EnumMapper.isValidEnumValue('source', invalidSource)) {
      return invalidSource;
    }

    // Try to map known fallback types
    const mapped = EnumMapper.mapFallbackToSource(invalidSource);

    this.logger.info('[EnumRepair] Repaired source enum', {
      original: invalidSource,
      repaired: mapped,
      dreamId: dream.id || 'unknown',
    });

    return mapped;
  }

  /**
   * Repairs invalid shot types in cinematography
   * @param {Object} dream - Dream object
   * @returns {Object} {repaired: boolean, repairs: Array}
   */
  repairShotTypes(dream) {
    const EnumMapper = require('../validators/EnumMapper');
    const repairs = [];

    if (
      !dream ||
      !dream.cinematography ||
      !dream.cinematography.shots ||
      !Array.isArray(dream.cinematography.shots)
    ) {
      return { repaired: false, repairs: [] };
    }

    // Iterate through all shots
    dream.cinematography.shots.forEach((shot, index) => {
      if (!shot || !shot.type) {
        return;
      }

      const originalType = shot.type;

      // Check if shot type is valid
      if (
        EnumMapper.isValidEnumValue('cinematography.shots[].type', originalType)
      ) {
        return;
      }

      // Map to valid shot type
      const mappedType = EnumMapper.mapShotType(originalType);

      if (mappedType !== originalType) {
        shot.type = mappedType;
        const repairInfo = {
          type: 'enum',
          field: `cinematography.shots[${index}].type`,
          originalValue: originalType,
          repairedValue: mappedType,
          reason: 'Invalid shot type mapped to valid value',
          timestamp: new Date().toISOString(),
          dreamId: dream.id || 'unknown',
          shotIndex: index,
        };
        repairs.push(repairInfo);

        // Enhanced logging with all required fields
        this.logger.info('[EnumRepair] Repaired shot type', {
          field: `cinematography.shots[${index}].type`,
          shotIndex: index,
          original: originalType,
          repaired: mappedType,
          reason: 'Invalid shot type mapped to valid value',
          dreamId: dream.id || 'unknown',
          timestamp: repairInfo.timestamp,
        });
      }
    });

    return {
      repaired: repairs.length > 0,
      repairs,
    };
  }

  /**
   * Repairs invalid ID format
   * @param {Object} dream - Dream object
   * @returns {string} New valid UUID
   */
  repairDreamId(dream) {
    const { v4: uuidv4 } = require('uuid');

    if (!dream) {
      return uuidv4();
    }

    const currentId = dream.id;

    // UUID pattern validation
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // Check if current ID matches UUID pattern
    if (currentId && uuidPattern.test(currentId)) {
      return currentId; // Already valid
    }

    // Generate new UUID
    const newId = uuidv4();

    // Preserve original ID in metadata for tracking
    if (!dream.metadata) {
      dream.metadata = {};
    }
    if (currentId) {
      dream.metadata.originalId = currentId;
    }

    // Update dream ID
    dream.id = newId;

    // Enhanced logging with all required fields
    this.logger.info('[IDRepair] Repaired dream ID', {
      field: 'id',
      original: currentId || 'none',
      repaired: newId,
      reason: currentId
        ? 'Invalid ID format replaced with UUID'
        : 'Missing ID replaced with UUID',
      timestamp: new Date().toISOString(),
      preservedInMetadata: !!currentId,
    });

    return newId;
  }

  /**
   * Check if a type string is valid according to flexible type validation rules
   * @param {string} typeString - The type string to validate
   * @returns {boolean} True if valid, false otherwise
   */
  isValidTypeString(typeString) {
    // Check if type is a non-empty string
    if (!typeString || typeof typeString !== 'string') {
      return false;
    }

    // Check length constraints (2-100 characters)
    if (typeString.length < 2 || typeString.length > 100) {
      return false;
    }

    // Check pattern: alphanumeric with underscores and hyphens only
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(typeString)) {
      return false;
    }

    return true;
  }

  /**
   * Sanitize a type string to meet format requirements
   * Handles empty types, too long types, special characters, and whitespace
   * @param {string} typeString - The type string to sanitize
   * @param {string} defaultType - Default type to use if empty ('unknown_structure' or 'unknown_entity')
   * @returns {string} Sanitized type string
   */
  sanitizeTypeString(typeString, defaultType = 'unknown') {
    // Handle empty or null types
    if (
      !typeString ||
      typeof typeString !== 'string' ||
      typeString.trim().length === 0
    ) {
      return defaultType;
    }

    // Start with trimmed string
    let sanitized = typeString.trim();

    // Replace whitespace with underscores
    sanitized = sanitized.replace(/\s+/g, '_');

    // Replace special characters (anything not alphanumeric, underscore, or hyphen) with underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Remove consecutive underscores
    sanitized = sanitized.replace(/_+/g, '_');

    // Remove leading/trailing underscores or hyphens
    sanitized = sanitized.replace(/^[_-]+|[_-]+$/g, '');

    // Handle too long types - truncate to 100 chars
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
      // Remove trailing underscores or hyphens after truncation
      sanitized = sanitized.replace(/[_-]+$/, '');
    }

    // If after sanitization we have less than 2 chars, use default
    if (sanitized.length < 2) {
      return defaultType;
    }

    return sanitized;
  }

  /**
   * Repair structures to preserve valid flexible types
   * Only repairs types if format is invalid
   * @param {Array} structures - Array of structure objects
   * @returns {Object} {repaired: boolean, repairs: Array}
   */
  repairStructures(structures) {
    const repairs = [];

    if (!structures || !Array.isArray(structures)) {
      return { repaired: false, repairs: [] };
    }

    structures.forEach((structure, index) => {
      if (!structure || !structure.type) {
        // Missing type - add default
        const originalValue = structure.type;
        structure.type = 'unknown_structure';
        repairs.push({
          type: 'structure_type',
          field: `structures[${index}].type`,
          originalValue: originalValue || 'missing',
          repairedValue: structure.type,
          reason: 'Missing type replaced with default',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const originalType = structure.type;

      // Check if type is already valid
      if (this.isValidTypeString(originalType)) {
        // Type is valid - preserve it as-is
        return;
      }

      // Type format is invalid - sanitize it
      const sanitizedType = this.sanitizeTypeString(
        originalType,
        'unknown_structure'
      );

      if (sanitizedType !== originalType) {
        structure.type = sanitizedType;
        repairs.push({
          type: 'structure_type',
          field: `structures[${index}].type`,
          originalValue: originalType,
          repairedValue: sanitizedType,
          reason: 'Invalid type format sanitized',
          timestamp: new Date().toISOString(),
        });

        this.logger.info('[TypeRepair] Sanitized structure type', {
          field: `structures[${index}].type`,
          structureIndex: index,
          original: originalType,
          repaired: sanitizedType,
          reason: 'Invalid type format sanitized',
          timestamp: new Date().toISOString(),
        });
      }
    });

    return {
      repaired: repairs.length > 0,
      repairs,
    };
  }

  /**
   * Repair entities to preserve valid flexible types
   * Only repairs types if format is invalid
   * @param {Array} entities - Array of entity objects
   * @returns {Object} {repaired: boolean, repairs: Array}
   */
  repairEntities(entities) {
    const repairs = [];

    if (!entities || !Array.isArray(entities)) {
      return { repaired: false, repairs: [] };
    }

    entities.forEach((entity, index) => {
      if (!entity || !entity.type) {
        // Missing type - add default
        const originalValue = entity.type;
        entity.type = 'unknown_entity';
        repairs.push({
          type: 'entity_type',
          field: `entities[${index}].type`,
          originalValue: originalValue || 'missing',
          repairedValue: entity.type,
          reason: 'Missing type replaced with default',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const originalType = entity.type;

      // Check if type is already valid
      if (this.isValidTypeString(originalType)) {
        // Type is valid - preserve it as-is
        return;
      }

      // Type format is invalid - sanitize it
      const sanitizedType = this.sanitizeTypeString(
        originalType,
        'unknown_entity'
      );

      if (sanitizedType !== originalType) {
        entity.type = sanitizedType;
        repairs.push({
          type: 'entity_type',
          field: `entities[${index}].type`,
          originalValue: originalType,
          repairedValue: sanitizedType,
          reason: 'Invalid type format sanitized',
          timestamp: new Date().toISOString(),
        });

        this.logger.info('[TypeRepair] Sanitized entity type', {
          field: `entities[${index}].type`,
          entityIndex: index,
          original: originalType,
          repaired: sanitizedType,
          reason: 'Invalid type format sanitized',
          timestamp: new Date().toISOString(),
        });
      }
    });

    return {
      repaired: repairs.length > 0,
      repairs,
    };
  }
}

module.exports = EnhancedContentRepair;
