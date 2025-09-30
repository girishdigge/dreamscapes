// engine/SchemaValidator.js
// Comprehensive schema validation for 3D scene data and video parameters

const Joi = require('joi');
const _ = require('lodash');
const winston = require('winston');

class SchemaValidator {
  constructor(config = {}) {
    this.config = config;
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/schema-validation.log' }),
      ],
    });

    // Initialize validation schemas
    this.schemas = this.initializeSchemas();
  }

  /**
   * Initialize comprehensive Joi validation schemas
   */
  initializeSchemas() {
    return {
      // Enhanced dream response schema
      dreamResponse: Joi.object({
        success: Joi.boolean().required(),
        data: Joi.object({
          id: Joi.string().uuid().required(),
          title: Joi.string().min(5).max(200).required(),
          description: Joi.string().min(20).max(2000).required(),
          scenes: Joi.array()
            .items(
              Joi.object({
                id: Joi.string().required(),
                description: Joi.string().min(10).required(),
                objects: Joi.array()
                  .items(
                    Joi.object({
                      id: Joi.string().optional(),
                      type: Joi.string().required(),
                      position: Joi.array()
                        .items(Joi.number())
                        .length(3)
                        .optional(),
                      rotation: Joi.array()
                        .items(Joi.number())
                        .length(3)
                        .optional(),
                      scale: Joi.array()
                        .items(Joi.number())
                        .length(3)
                        .optional(),
                      properties: Joi.object().optional(),
                    }).unknown(true)
                  )
                  .min(1)
                  .required(),
                lighting: Joi.object({
                  ambient: Joi.object({
                    color: Joi.string()
                      .pattern(/^#[0-9a-fA-F]{6}$/)
                      .optional(),
                    intensity: Joi.number().min(0).max(2).optional(),
                  }).optional(),
                  directional: Joi.array()
                    .items(
                      Joi.object({
                        direction: Joi.array()
                          .items(Joi.number())
                          .length(3)
                          .required(),
                        color: Joi.string()
                          .pattern(/^#[0-9a-fA-F]{6}$/)
                          .optional(),
                        intensity: Joi.number().min(0).max(5).optional(),
                      })
                    )
                    .optional(),
                  point: Joi.array()
                    .items(
                      Joi.object({
                        position: Joi.array()
                          .items(Joi.number())
                          .length(3)
                          .required(),
                        color: Joi.string()
                          .pattern(/^#[0-9a-fA-F]{6}$/)
                          .optional(),
                        intensity: Joi.number().min(0).max(10).optional(),
                        range: Joi.number().min(0).optional(),
                      })
                    )
                    .optional(),
                }).optional(),
                camera: Joi.object({
                  position: Joi.array()
                    .items(Joi.number())
                    .length(3)
                    .optional(),
                  target: Joi.array().items(Joi.number()).length(3).optional(),
                  fov: Joi.number().min(10).max(180).optional(),
                  near: Joi.number().min(0.1).optional(),
                  far: Joi.number().min(1).optional(),
                }).optional(),
                environment: Joi.object({
                  skybox: Joi.string().optional(),
                  fog: Joi.object({
                    enabled: Joi.boolean().optional(),
                    color: Joi.string()
                      .pattern(/^#[0-9a-fA-F]{6}$/)
                      .optional(),
                    near: Joi.number().min(0).optional(),
                    far: Joi.number().min(0).optional(),
                  }).optional(),
                  ground: Joi.object({
                    enabled: Joi.boolean().optional(),
                    color: Joi.string()
                      .pattern(/^#[0-9a-fA-F]{6}$/)
                      .optional(),
                    texture: Joi.string().optional(),
                  }).optional(),
                }).optional(),
              }).unknown(true)
            )
            .min(1)
            .max(10)
            .required(),
          cinematography: Joi.object({
            shots: Joi.array()
              .items(
                Joi.object({
                  type: Joi.string()
                    .valid(
                      'establish',
                      'flythrough',
                      'orbit',
                      'close_up',
                      'pull_back',
                      'pan',
                      'tilt',
                      'zoom',
                      'dolly',
                      'tracking'
                    )
                    .required(),
                  target: Joi.string().optional(),
                  duration: Joi.number().min(1).max(60).required(),
                  startPos: Joi.array()
                    .items(Joi.number())
                    .length(3)
                    .optional(),
                  endPos: Joi.array().items(Joi.number()).length(3).optional(),
                  startTarget: Joi.array()
                    .items(Joi.number())
                    .length(3)
                    .optional(),
                  endTarget: Joi.array()
                    .items(Joi.number())
                    .length(3)
                    .optional(),
                  easing: Joi.string()
                    .valid(
                      'linear',
                      'ease-in',
                      'ease-out',
                      'ease-in-out',
                      'bounce'
                    )
                    .optional(),
                  fov: Joi.object({
                    start: Joi.number().min(10).max(180).optional(),
                    end: Joi.number().min(10).max(180).optional(),
                  }).optional(),
                }).unknown(true)
              )
              .min(1)
              .required(),
            transitions: Joi.array()
              .items(
                Joi.object({
                  type: Joi.string()
                    .valid('cut', 'fade', 'dissolve', 'wipe')
                    .required(),
                  duration: Joi.number().min(0).max(5).optional(),
                  direction: Joi.string().optional(),
                })
              )
              .optional(),
            effects: Joi.array()
              .items(
                Joi.object({
                  type: Joi.string().required(),
                  parameters: Joi.object().optional(),
                  startTime: Joi.number().min(0).optional(),
                  duration: Joi.number().min(0).optional(),
                })
              )
              .optional(),
            duration: Joi.number().min(5).max(300).required(),
          }).optional(),
          style: Joi.object({
            visual: Joi.object({
              colorPalette: Joi.array()
                .items(Joi.string().pattern(/^#[0-9a-fA-F]{6}$/))
                .optional(),
              mood: Joi.string()
                .valid(
                  'bright',
                  'dark',
                  'mysterious',
                  'ethereal',
                  'dramatic',
                  'serene'
                )
                .optional(),
              contrast: Joi.number().min(0).max(2).optional(),
              saturation: Joi.number().min(0).max(2).optional(),
              brightness: Joi.number().min(0).max(2).optional(),
            }).optional(),
            audio: Joi.object({
              ambientSound: Joi.string().optional(),
              musicStyle: Joi.string().optional(),
              volume: Joi.number().min(0).max(1).optional(),
            }).optional(),
            mood: Joi.object({
              primary: Joi.string().required(),
              secondary: Joi.string().optional(),
              intensity: Joi.number().min(0).max(1).optional(),
            }).optional(),
          }).optional(),
        }).required(),
        metadata: Joi.object({
          source: Joi.string()
            .valid('cerebras', 'openai', 'llama', 'local')
            .required(),
          model: Joi.string().required(),
          processingTime: Joi.number().min(0).max(300000).required(),
          quality: Joi.string()
            .valid('draft', 'standard', 'high', 'cinematic')
            .required(),
          tokens: Joi.object({
            input: Joi.number().integer().min(0).required(),
            output: Joi.number().integer().min(0).required(),
            total: Joi.number().integer().min(0).required(),
          }).required(),
          confidence: Joi.number().min(0).max(1).required(),
          cacheHit: Joi.boolean().required(),
          generationId: Joi.string().optional(),
          timestamp: Joi.date().iso().optional(),
          version: Joi.string().optional(),
        }).required(),
      }).unknown(false),

      // 3D Scene data schema (based on docs/schema.json)
      sceneData: Joi.object({
        id: Joi.string().required(),
        title: Joi.string().min(1).max(200).required(),
        style: Joi.string()
          .valid('ethereal', 'cyberpunk', 'surreal', 'fantasy', 'nightmare')
          .required(),
        seed: Joi.number().integer().min(0).optional(),
        environment: Joi.object({
          preset: Joi.string()
            .valid('dawn', 'dusk', 'night', 'void', 'underwater')
            .optional(),
          fog: Joi.number().min(0).max(1).optional(),
          skyColor: Joi.string()
            .pattern(/^#[0-9a-fA-F]{6}$/)
            .optional(),
          ambientLight: Joi.number().min(0).max(2).optional(),
          weather: Joi.object({
            type: Joi.string()
              .valid('clear', 'cloudy', 'rainy', 'stormy', 'misty')
              .optional(),
            intensity: Joi.number().min(0).max(1).optional(),
          }).optional(),
        }).optional(),
        structures: Joi.array()
          .items(
            Joi.object({
              id: Joi.string().required(),
              template: Joi.string()
                .valid(
                  'floating_library',
                  'crystal_tower',
                  'twisted_house',
                  'portal_arch',
                  'floating_island',
                  'infinite_staircase',
                  'ancient_temple',
                  'glass_cathedral',
                  'spiral_tower'
                )
                .required(),
              pos: Joi.array().items(Joi.number()).length(3).required(),
              scale: Joi.number().min(0.1).max(10).default(1),
              rotation: Joi.array()
                .items(Joi.number())
                .length(3)
                .default([0, 0, 0]),
              features: Joi.array().items(Joi.string()).optional(),
              materials: Joi.object({
                primary: Joi.string().optional(),
                secondary: Joi.string().optional(),
                emission: Joi.string()
                  .pattern(/^#[0-9a-fA-F]{6}$/)
                  .optional(),
                opacity: Joi.number().min(0).max(1).optional(),
              }).optional(),
            }).unknown(true)
          )
          .max(10)
          .optional(),
        entities: Joi.array()
          .items(
            Joi.object({
              id: Joi.string().required(),
              type: Joi.string()
                .valid(
                  'book_swarm',
                  'floating_orbs',
                  'particle_stream',
                  'shadow_figures',
                  'light_butterflies',
                  'memory_fragments',
                  'energy_wisps',
                  'crystal_shards',
                  'floating_text'
                )
                .required(),
              count: Joi.number().integer().min(1).max(100).default(1),
              params: Joi.object({
                speed: Joi.number().min(0).max(10).optional(),
                glow: Joi.number().min(0).max(1).optional(),
                size: Joi.number().min(0.1).max(5).optional(),
                color: Joi.string()
                  .pattern(/^#[0-9a-fA-F]{6}$/)
                  .optional(),
                opacity: Joi.number().min(0).max(1).optional(),
                animation: Joi.object({
                  type: Joi.string()
                    .valid('float', 'rotate', 'pulse', 'drift')
                    .optional(),
                  speed: Joi.number().min(0).max(5).optional(),
                  amplitude: Joi.number().min(0).max(10).optional(),
                }).optional(),
              }).optional(),
            }).unknown(true)
          )
          .max(5)
          .optional(),
        cinematography: Joi.object({
          durationSec: Joi.number().min(5).max(300).required(),
          shots: Joi.array()
            .items(
              Joi.object({
                type: Joi.string()
                  .valid(
                    'establish',
                    'flythrough',
                    'orbit',
                    'close_up',
                    'pull_back',
                    'pan',
                    'tilt',
                    'zoom',
                    'dolly',
                    'tracking'
                  )
                  .required(),
                target: Joi.string().optional(),
                duration: Joi.number().min(1).max(60).required(),
                startPos: Joi.array().items(Joi.number()).length(3).optional(),
                endPos: Joi.array().items(Joi.number()).length(3).optional(),
                startTarget: Joi.array()
                  .items(Joi.number())
                  .length(3)
                  .optional(),
                endTarget: Joi.array().items(Joi.number()).length(3).optional(),
                fov: Joi.number().min(10).max(180).default(75),
                easing: Joi.string()
                  .valid('linear', 'ease-in', 'ease-out', 'ease-in-out')
                  .default('ease-in-out'),
              }).unknown(true)
            )
            .min(1)
            .required(),
        }).required(),
        render: Joi.object({
          res: Joi.array()
            .items(Joi.number().integer().positive())
            .length(2)
            .optional(),
          fps: Joi.number().integer().valid(24, 30, 60).default(30),
          quality: Joi.string()
            .valid('draft', 'medium', 'high')
            .default('medium'),
          samples: Joi.number().integer().min(1).max(1024).optional(),
          denoise: Joi.boolean().default(true),
        }).optional(),
        assumptions: Joi.array().items(Joi.string()).optional(),
      }).unknown(true),

      // Video parameters schema
      videoParameters: Joi.object({
        resolution: Joi.object({
          width: Joi.number().integer().min(240).max(7680).required(),
          height: Joi.number().integer().min(135).max(4320).required(),
        }).required(),
        fps: Joi.number().integer().valid(24, 25, 30, 50, 60).required(),
        duration: Joi.number().min(1).max(600).required(),
        quality: Joi.string()
          .valid('draft', 'standard', 'high', 'cinematic')
          .required(),
        codec: Joi.string().valid('h264', 'h265', 'vp9', 'av1').default('h264'),
        bitrate: Joi.number().integer().min(500).max(100000).optional(),
        profile: Joi.string().valid('baseline', 'main', 'high').optional(),
        preset: Joi.string()
          .valid('ultrafast', 'fast', 'medium', 'slow', 'veryslow')
          .optional(),
        crf: Joi.number().integer().min(0).max(51).optional(),
        audio: Joi.object({
          enabled: Joi.boolean().default(false),
          codec: Joi.string().valid('aac', 'mp3', 'opus').optional(),
          bitrate: Joi.number().integer().min(64).max(320).optional(),
          sampleRate: Joi.number()
            .integer()
            .valid(22050, 44100, 48000)
            .optional(),
        }).optional(),
      }).unknown(true),

      // Prompt validation schema
      promptData: Joi.object({
        text: Joi.string().min(5).max(5000).required(),
        style: Joi.string()
          .valid('ethereal', 'cyberpunk', 'surreal', 'fantasy', 'nightmare')
          .optional(),
        quality: Joi.string()
          .valid('draft', 'standard', 'high', 'cinematic')
          .default('standard'),
        context: Joi.object({
          previousDreams: Joi.array().items(Joi.object()).optional(),
          userPreferences: Joi.object().optional(),
          sessionContext: Joi.object().optional(),
        }).optional(),
        options: Joi.object({
          streaming: Joi.boolean().default(false),
          maxTokens: Joi.number().integer().min(100).max(32768).optional(),
          temperature: Joi.number().min(0).max(2).optional(),
          providers: Joi.array().items(Joi.string()).optional(),
          fallbackEnabled: Joi.boolean().default(true),
        }).optional(),
      }).unknown(true),

      // Error response schema
      errorResponse: Joi.object({
        success: Joi.boolean().valid(false).required(),
        error: Joi.object({
          code: Joi.string().required(),
          message: Joi.string().required(),
          details: Joi.object().optional(),
          timestamp: Joi.date().iso().optional(),
          requestId: Joi.string().optional(),
        }).required(),
        metadata: Joi.object({
          source: Joi.string().optional(),
          processingTime: Joi.number().min(0).optional(),
          retryable: Joi.boolean().optional(),
        }).optional(),
      }).unknown(false),
    };
  }

  /**
   * Validate content against specified schema
   * @param {Object} content - Content to validate
   * @param {string} schemaName - Name of schema to validate against
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  async validate(content, schemaName, options = {}) {
    const startTime = Date.now();

    try {
      const schema = this.schemas[schemaName];
      if (!schema) {
        throw new Error(`Unknown schema: ${schemaName}`);
      }

      const validationOptions = {
        abortEarly: false,
        allowUnknown: options.allowUnknown || false,
        stripUnknown: options.stripUnknown || false,
        convert: options.convert !== false,
        presence: options.presence || 'optional',
        ...options.joiOptions,
      };

      const result = schema.validate(content, validationOptions);

      const validationResult = {
        valid: !result.error,
        value: result.value,
        errors: [],
        warnings: [],
        processingTime: Date.now() - startTime,
        schema: schemaName,
      };

      // Process validation errors
      if (result.error) {
        validationResult.errors = result.error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type,
          value: detail.context?.value,
          label: detail.context?.label,
          severity: this.getErrorSeverity(detail.type),
        }));
      }

      // Process warnings (if any)
      if (result.warning) {
        validationResult.warnings = result.warning.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type,
          value: detail.context?.value,
          severity: 'warning',
        }));
      }

      // Additional custom validations
      const customValidation = await this.performCustomValidation(
        content,
        schemaName
      );
      if (customValidation.errors.length > 0) {
        validationResult.errors.push(...customValidation.errors);
        validationResult.valid = false;
      }
      if (customValidation.warnings.length > 0) {
        validationResult.warnings.push(...customValidation.warnings);
      }

      this.logger.info('Schema validation completed', {
        schema: schemaName,
        valid: validationResult.valid,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
        processingTime: validationResult.processingTime,
      });

      return validationResult;
    } catch (error) {
      this.logger.error('Schema validation failed', {
        schema: schemaName,
        error: error.message,
        stack: error.stack,
      });

      return {
        valid: false,
        errors: [
          {
            field: 'validation_system',
            message: `Schema validation failed: ${error.message}`,
            type: 'system_error',
            severity: 'critical',
          },
        ],
        warnings: [],
        processingTime: Date.now() - startTime,
        schema: schemaName,
      };
    }
  }

  /**
   * Perform custom validation beyond Joi schema
   */
  async performCustomValidation(content, schemaName) {
    const errors = [];
    const warnings = [];

    try {
      switch (schemaName) {
        case 'dreamResponse':
          await this.validateDreamResponseCustom(content, errors, warnings);
          break;
        case 'sceneData':
          await this.validateSceneDataCustom(content, errors, warnings);
          break;
        case 'videoParameters':
          await this.validateVideoParametersCustom(content, errors, warnings);
          break;
      }
    } catch (error) {
      errors.push({
        field: 'custom_validation',
        message: `Custom validation failed: ${error.message}`,
        type: 'system_error',
        severity: 'high',
      });
    }

    return { errors, warnings };
  }

  /**
   * Custom validation for dream response
   */
  async validateDreamResponseCustom(content, errors, warnings) {
    // Validate cinematography consistency
    if (content.data?.cinematography) {
      const cinematography = content.data.cinematography;

      // Check total shot duration vs declared duration
      if (cinematography.shots && cinematography.duration) {
        const totalShotDuration = cinematography.shots.reduce(
          (sum, shot) => sum + (shot.duration || 0),
          0
        );

        const durationDiff = Math.abs(
          totalShotDuration - cinematography.duration
        );
        if (durationDiff > 10) {
          errors.push({
            field: 'data.cinematography.duration',
            message: `Total shot duration (${totalShotDuration}s) significantly differs from declared duration (${cinematography.duration}s)`,
            type: 'consistency_error',
            severity: 'medium',
          });
        } else if (durationDiff > 5) {
          warnings.push({
            field: 'data.cinematography.duration',
            message: `Shot duration mismatch: ${durationDiff}s difference`,
            type: 'consistency_warning',
            severity: 'low',
          });
        }
      }

      // Validate shot targets reference existing scene objects
      if (cinematography.shots && content.data.scenes) {
        const sceneObjectIds = new Set();
        content.data.scenes.forEach((scene) => {
          if (scene.objects) {
            scene.objects.forEach((obj) => {
              if (obj.id) sceneObjectIds.add(obj.id);
            });
          }
        });

        cinematography.shots.forEach((shot, index) => {
          if (shot.target && !sceneObjectIds.has(shot.target)) {
            warnings.push({
              field: `data.cinematography.shots[${index}].target`,
              message: `Shot target "${shot.target}" does not reference any scene object`,
              type: 'reference_warning',
              severity: 'low',
            });
          }
        });
      }
    }

    // Validate scene object consistency
    if (content.data?.scenes) {
      const sceneIds = new Set();
      content.data.scenes.forEach((scene, sceneIndex) => {
        // Check for duplicate scene IDs
        if (scene.id) {
          if (sceneIds.has(scene.id)) {
            errors.push({
              field: `data.scenes[${sceneIndex}].id`,
              message: `Duplicate scene ID: ${scene.id}`,
              type: 'uniqueness_error',
              severity: 'high',
            });
          }
          sceneIds.add(scene.id);
        }

        // Validate object positions are reasonable
        if (scene.objects) {
          scene.objects.forEach((obj, objIndex) => {
            if (obj.position) {
              const [x, y, z] = obj.position;
              if (
                Math.abs(x) > 1000 ||
                Math.abs(y) > 1000 ||
                Math.abs(z) > 1000
              ) {
                warnings.push({
                  field: `data.scenes[${sceneIndex}].objects[${objIndex}].position`,
                  message:
                    'Object position values are very large, may cause rendering issues',
                  type: 'range_warning',
                  severity: 'low',
                });
              }
            }
          });
        }
      });
    }

    // Validate metadata consistency
    if (content.metadata) {
      // Check confidence vs quality correlation
      if (
        content.metadata.confidence !== undefined &&
        content.metadata.quality
      ) {
        const qualityThresholds = {
          draft: 0.3,
          standard: 0.5,
          high: 0.7,
          cinematic: 0.8,
        };

        const expectedMinConfidence =
          qualityThresholds[content.metadata.quality] || 0.5;
        if (content.metadata.confidence < expectedMinConfidence) {
          warnings.push({
            field: 'metadata.confidence',
            message: `Low confidence (${content.metadata.confidence}) for quality level "${content.metadata.quality}"`,
            type: 'quality_warning',
            severity: 'medium',
          });
        }
      }

      // Check token usage reasonableness
      if (content.metadata.tokens) {
        if (content.metadata.tokens.output < 50) {
          warnings.push({
            field: 'metadata.tokens.output',
            message:
              'Very low output token count may indicate incomplete response',
            type: 'completeness_warning',
            severity: 'medium',
          });
        }

        if (
          content.metadata.tokens.total !==
          content.metadata.tokens.input + content.metadata.tokens.output
        ) {
          errors.push({
            field: 'metadata.tokens.total',
            message: 'Total tokens does not equal input + output tokens',
            type: 'calculation_error',
            severity: 'low',
          });
        }
      }
    }
  }

  /**
   * Custom validation for scene data
   */
  async validateSceneDataCustom(content, errors, warnings) {
    // Validate structure positions don't overlap significantly
    if (content.structures && content.structures.length > 1) {
      for (let i = 0; i < content.structures.length; i++) {
        for (let j = i + 1; j < content.structures.length; j++) {
          const struct1 = content.structures[i];
          const struct2 = content.structures[j];

          if (struct1.pos && struct2.pos) {
            const distance = Math.sqrt(
              Math.pow(struct1.pos[0] - struct2.pos[0], 2) +
                Math.pow(struct1.pos[1] - struct2.pos[1], 2) +
                Math.pow(struct1.pos[2] - struct2.pos[2], 2)
            );

            const minDistance =
              ((struct1.scale || 1) + (struct2.scale || 1)) * 2;
            if (distance < minDistance) {
              warnings.push({
                field: `structures[${i}].pos`,
                message: `Structure "${struct1.id}" may overlap with "${struct2.id}"`,
                type: 'spatial_warning',
                severity: 'low',
              });
            }
          }
        }
      }
    }

    // Validate cinematography shot positions are within reasonable bounds
    if (content.cinematography?.shots) {
      content.cinematography.shots.forEach((shot, index) => {
        if (shot.startPos) {
          const [x, y, z] = shot.startPos;
          if (Math.abs(x) > 500 || Math.abs(y) > 500 || Math.abs(z) > 500) {
            warnings.push({
              field: `cinematography.shots[${index}].startPos`,
              message:
                'Camera position is very far from origin, may cause rendering issues',
              type: 'range_warning',
              severity: 'low',
            });
          }
        }
      });
    }

    // Validate entity count vs performance
    if (content.entities) {
      const totalEntities = content.entities.reduce(
        (sum, entity) => sum + (entity.count || 1),
        0
      );

      if (totalEntities > 500) {
        warnings.push({
          field: 'entities',
          message: `High entity count (${totalEntities}) may impact performance`,
          type: 'performance_warning',
          severity: 'medium',
        });
      }
    }
  }

  /**
   * Custom validation for video parameters
   */
  async validateVideoParametersCustom(content, errors, warnings) {
    // Validate resolution aspect ratio
    if (content.resolution) {
      const { width, height } = content.resolution;
      const aspectRatio = width / height;

      const commonRatios = [
        { ratio: 16 / 9, name: '16:9' },
        { ratio: 4 / 3, name: '4:3' },
        { ratio: 21 / 9, name: '21:9' },
        { ratio: 1 / 1, name: '1:1' },
      ];

      const isCommonRatio = commonRatios.some(
        (common) => Math.abs(aspectRatio - common.ratio) < 0.01
      );

      if (!isCommonRatio) {
        warnings.push({
          field: 'resolution',
          message: `Unusual aspect ratio ${aspectRatio.toFixed(
            2
          )}:1, may not display correctly on all devices`,
          type: 'compatibility_warning',
          severity: 'low',
        });
      }
    }

    // Validate bitrate vs resolution/quality
    if (content.bitrate && content.resolution && content.quality) {
      const { width, height } = content.resolution;
      const pixels = width * height;

      const recommendedBitrates = {
        draft: (pixels * 0.1) / 1000,
        standard: (pixels * 0.2) / 1000,
        high: (pixels * 0.4) / 1000,
        cinematic: (pixels * 0.8) / 1000,
      };

      const recommended = recommendedBitrates[content.quality];
      if (recommended && content.bitrate < recommended * 0.5) {
        warnings.push({
          field: 'bitrate',
          message: `Bitrate ${content.bitrate} kbps may be too low for ${content.quality} quality at ${width}x${height}`,
          type: 'quality_warning',
          severity: 'medium',
        });
      }
    }

    // Validate fps vs duration for file size
    if (content.fps && content.duration && content.resolution) {
      const { width, height } = content.resolution;
      const estimatedFrames = content.fps * content.duration;
      const estimatedSize =
        (width * height * estimatedFrames * 3) / (1024 * 1024); // Rough MB estimate

      if (estimatedSize > 1000) {
        // > 1GB
        warnings.push({
          field: 'duration',
          message: `High resolution, fps, and duration combination may result in very large file size (~${Math.round(
            estimatedSize
          )}MB)`,
          type: 'performance_warning',
          severity: 'medium',
        });
      }
    }
  }

  /**
   * Get error severity based on Joi error type
   */
  getErrorSeverity(errorType) {
    const severityMap = {
      'any.required': 'high',
      'any.invalid': 'high',
      'string.min': 'medium',
      'string.max': 'medium',
      'string.pattern.base': 'medium',
      'number.min': 'medium',
      'number.max': 'medium',
      'array.min': 'medium',
      'array.max': 'medium',
      'object.unknown': 'low',
      'any.unknown': 'low',
    };

    return severityMap[errorType] || 'medium';
  }

  /**
   * Get available schemas
   */
  getAvailableSchemas() {
    return Object.keys(this.schemas);
  }

  /**
   * Get schema definition
   */
  getSchema(schemaName) {
    return this.schemas[schemaName];
  }

  /**
   * Add custom schema
   */
  addSchema(name, schema) {
    this.schemas[name] = schema;
  }

  /**
   * Validate multiple contents against different schemas
   */
  async validateBatch(validations) {
    const results = [];

    for (const validation of validations) {
      const result = await this.validate(
        validation.content,
        validation.schema,
        validation.options
      );

      results.push({
        ...result,
        id: validation.id,
        name: validation.name,
      });
    }

    return results;
  }
}

module.exports = SchemaValidator;
