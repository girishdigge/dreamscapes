// engine/ValidationPipeline.js
// Comprehensive validation and content repair pipeline

const Joi = require('joi');
const _ = require('lodash');
const winston = require('winston');

// Import validation components and configuration
const validationConfig = require('../config/validation');
const SchemaValidator = require('./SchemaValidator');
const QualityAssessment = require('./QualityAssessment');
const ContentRepair = require('./ContentRepair');
const RetryStrategies = require('./RetryStrategies');

class ValidationPipeline {
  constructor(options = {}) {
    this.config = _.merge({}, validationConfig, options);
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      repairAttempts: 0,
      successfulRepairs: 0,
      qualityScores: [],
    };

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/validation.log' }),
      ],
    });

    // Initialize validation components
    this.schemaValidator = new SchemaValidator(this.config);
    this.qualityAssessment = new QualityAssessment(this.config);
    this.contentRepair = new ContentRepair(this.config);
    this.retryStrategies = new RetryStrategies(this.config);

    // Initialize legacy schemas for backward compatibility
    this.schemas = this.initializeSchemas();

    // Initialize quality assessment rules
    this.qualityRules = this.initializeQualityRules();
  }

  /**
   * Initialize Joi validation schemas for different content types
   */
  initializeSchemas() {
    return {
      // Dream response schema based on the design document
      dreamResponse: Joi.object({
        success: Joi.boolean().required(),
        data: Joi.object({
          id: Joi.string().required(),
          title: Joi.string().min(1).max(200).required(),
          description: Joi.string().min(10).max(2000).required(),
          scenes: Joi.array()
            .items(
              Joi.object({
                id: Joi.string().required(),
                description: Joi.string().min(5).required(),
                objects: Joi.array().items(Joi.object()).required(),
                lighting: Joi.object().optional(),
                camera: Joi.object().optional(),
                environment: Joi.object().optional(),
              })
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
                      'pull_back'
                    )
                    .required(),
                  target: Joi.string().optional(),
                  duration: Joi.number().min(2).max(30).required(),
                  startPos: Joi.array()
                    .items(Joi.number())
                    .length(3)
                    .optional(),
                  endPos: Joi.array().items(Joi.number()).length(3).optional(),
                })
              )
              .required(),
            transitions: Joi.array().items(Joi.object()).optional(),
            effects: Joi.array().items(Joi.object()).optional(),
            duration: Joi.number().min(1).required(),
          }).optional(),
          style: Joi.object({
            visual: Joi.object().optional(),
            audio: Joi.object().optional(),
            mood: Joi.object().optional(),
          }).optional(),
        }).required(),
        metadata: Joi.object({
          source: Joi.string().required(),
          model: Joi.string().required(),
          processingTime: Joi.number().min(0).required(),
          quality: Joi.string()
            .valid('draft', 'standard', 'high', 'cinematic')
            .required(),
          tokens: Joi.object({
            input: Joi.number().min(0).required(),
            output: Joi.number().min(0).required(),
            total: Joi.number().min(0).required(),
          }).required(),
          confidence: Joi.number().min(0).max(1).required(),
          cacheHit: Joi.boolean().required(),
        }).required(),
      }),

      // 3D Scene data schema based on docs/schema.json
      sceneData: Joi.object({
        id: Joi.string().required(),
        title: Joi.string().required(),
        style: Joi.string()
          .valid('ethereal', 'cyberpunk', 'surreal', 'fantasy', 'nightmare')
          .required(),
        seed: Joi.number().integer().optional(),
        environment: Joi.object({
          preset: Joi.string()
            .valid('dawn', 'dusk', 'night', 'void', 'underwater')
            .optional(),
          fog: Joi.number().min(0).max(1).optional(),
          skyColor: Joi.string()
            .pattern(/^#[0-9a-fA-F]{6}$/)
            .optional(),
          ambientLight: Joi.number().min(0).max(2).optional(),
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
                  'infinite_staircase'
                )
                .required(),
              pos: Joi.array().items(Joi.number()).length(3).required(),
              scale: Joi.number().min(0.1).max(10).optional(),
              rotation: Joi.array().items(Joi.number()).length(3).optional(),
              features: Joi.array().items(Joi.string()).optional(),
            })
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
                  'memory_fragments'
                )
                .required(),
              count: Joi.number().integer().min(1).max(100).optional(),
              params: Joi.object({
                speed: Joi.number().optional(),
                glow: Joi.number().min(0).max(1).optional(),
                size: Joi.number().optional(),
                color: Joi.string().optional(),
              }).optional(),
            })
          )
          .max(5)
          .optional(),
        cinematography: Joi.object({
          durationSec: Joi.number().min(10).max(120).required(),
          shots: Joi.array()
            .items(
              Joi.object({
                type: Joi.string()
                  .valid(
                    'establish',
                    'flythrough',
                    'orbit',
                    'close_up',
                    'pull_back'
                  )
                  .required(),
                target: Joi.string().optional(),
                duration: Joi.number().min(2).max(30).required(),
                startPos: Joi.array().items(Joi.number()).length(3).optional(),
                endPos: Joi.array().items(Joi.number()).length(3).optional(),
              })
            )
            .required(),
        }).required(),
        render: Joi.object({
          res: Joi.array().items(Joi.number().integer()).length(2).optional(),
          fps: Joi.number().integer().valid(24, 30, 60).optional(),
          quality: Joi.string().valid('draft', 'medium', 'high').optional(),
        }).optional(),
        assumptions: Joi.array().items(Joi.string()).optional(),
      }),

      // Video parameters schema
      videoParameters: Joi.object({
        resolution: Joi.object({
          width: Joi.number().integer().min(480).max(4096).required(),
          height: Joi.number().integer().min(270).max(2160).required(),
        }).required(),
        fps: Joi.number().integer().valid(24, 30, 60).required(),
        duration: Joi.number().min(5).max(300).required(),
        quality: Joi.string()
          .valid('draft', 'standard', 'high', 'cinematic')
          .required(),
        codec: Joi.string().valid('h264', 'h265', 'vp9').optional(),
        bitrate: Joi.number().min(1000).max(50000).optional(),
      }),
    };
  }

  /**
   * Initialize quality assessment rules
   */
  initializeQualityRules() {
    return {
      titleRelevance: {
        weight: 0.15,
        check: (content, originalPrompt) => {
          if (!content.data?.title || !originalPrompt) return 0.5;

          const title = content.data.title.toLowerCase();
          const prompt = originalPrompt.toLowerCase();

          // Simple keyword matching - could be enhanced with NLP
          const titleWords = title.split(/\s+/);
          const promptWords = prompt.split(/\s+/);

          const matches = titleWords.filter((word) =>
            promptWords.some(
              (pWord) => pWord.includes(word) || word.includes(pWord)
            )
          );

          return Math.min(matches.length / Math.max(titleWords.length, 3), 1);
        },
      },

      descriptionQuality: {
        weight: 0.2,
        check: (content) => {
          const description = content.data?.description;
          if (!description) return 0;

          let score = 0;

          // Length check
          if (description.length >= 50) score += 0.3;
          if (description.length >= 100) score += 0.2;

          // Descriptive words check
          const descriptiveWords = [
            'vivid',
            'ethereal',
            'mysterious',
            'glowing',
            'floating',
            'shimmering',
          ];
          const hasDescriptive = descriptiveWords.some((word) =>
            description.toLowerCase().includes(word)
          );
          if (hasDescriptive) score += 0.3;

          // Sentence structure
          const sentences = description
            .split(/[.!?]+/)
            .filter((s) => s.trim().length > 0);
          if (sentences.length >= 2) score += 0.2;

          return Math.min(score, 1);
        },
      },

      sceneConsistency: {
        weight: 0.25,
        check: (content) => {
          const scenes = content.data?.scenes;
          if (!scenes || !Array.isArray(scenes)) return 0;

          let score = 0;

          // Check if all scenes have required fields
          const validScenes = scenes.filter(
            (scene) => scene.id && scene.description && scene.objects
          );
          score += (validScenes.length / scenes.length) * 0.4;

          // Check scene descriptions quality
          const qualityScenes = scenes.filter(
            (scene) => scene.description && scene.description.length >= 20
          );
          score += (qualityScenes.length / scenes.length) * 0.3;

          // Check for object consistency
          const scenesWithObjects = scenes.filter(
            (scene) =>
              scene.objects &&
              Array.isArray(scene.objects) &&
              scene.objects.length > 0
          );
          score += (scenesWithObjects.length / scenes.length) * 0.3;

          return Math.min(score, 1);
        },
      },

      cinematographyQuality: {
        weight: 0.2,
        check: (content) => {
          const cinematography = content.data?.cinematography;
          if (!cinematography) return 0.3; // Optional but adds quality

          let score = 0;

          // Check shots array
          if (cinematography.shots && Array.isArray(cinematography.shots)) {
            const validShots = cinematography.shots.filter(
              (shot) => shot.type && shot.duration && shot.duration >= 2
            );
            score += (validShots.length / cinematography.shots.length) * 0.5;

            // Check shot variety
            const shotTypes = new Set(
              cinematography.shots.map((shot) => shot.type)
            );
            if (shotTypes.size >= 2) score += 0.3;
          }

          // Check duration
          if (cinematography.duration && cinematography.duration >= 10) {
            score += 0.2;
          }

          return Math.min(score, 1);
        },
      },

      technicalValidity: {
        weight: 0.2,
        check: (content) => {
          let score = 0;

          // Check metadata presence
          if (content.metadata) {
            const requiredMetadata = [
              'source',
              'model',
              'processingTime',
              'quality',
              'tokens',
            ];
            const presentMetadata = requiredMetadata.filter(
              (field) => content.metadata[field] !== undefined
            );
            score += (presentMetadata.length / requiredMetadata.length) * 0.4;
          }

          // Check data structure completeness
          if (content.data) {
            const requiredData = ['id', 'title', 'description', 'scenes'];
            const presentData = requiredData.filter(
              (field) => content.data[field] !== undefined
            );
            score += (presentData.length / requiredData.length) * 0.6;
          }

          return Math.min(score, 1);
        },
      },
    };
  }

  /**
   * Comprehensive validation of AI-generated content
   * @param {Object} content - The content to validate
   * @param {string} schemaType - Type of schema to validate against
   * @param {Object} options - Additional validation options
   * @returns {Object} Validation result
   */
  async validateResponse(content, schemaType = 'dreamResponse', options = {}) {
    this.metrics.totalValidations++;

    const startTime = Date.now();
    const result = {
      valid: false,
      errors: [],
      warnings: [],
      score: 0,
      details: {},
      processingTime: 0,
      schemaValidation: null,
      qualityAssessment: null,
    };

    try {
      // Enhanced schema validation using SchemaValidator
      const schemaValidation = await this.schemaValidator.validate(
        content,
        schemaType,
        options
      );
      result.schemaValidation = schemaValidation;

      // Merge schema validation results
      result.errors.push(...schemaValidation.errors);
      result.warnings.push(...schemaValidation.warnings);
      result.details.schemaValidation = {
        valid: schemaValidation.valid,
        processingTime: schemaValidation.processingTime,
      };

      // Additional content-specific validation (legacy support)
      const contentValidation = await this.validateContentSpecific(
        content,
        schemaType
      );
      result.errors.push(...contentValidation.errors);
      result.warnings.push(...contentValidation.warnings);

      // Determine if validation passed
      result.valid = result.errors.length === 0;

      if (result.valid) {
        this.metrics.successfulValidations++;
      } else {
        this.metrics.failedValidations++;
      }

      result.processingTime = Date.now() - startTime;

      this.logger.info('Validation completed', {
        schemaType,
        valid: result.valid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      this.metrics.failedValidations++;
      result.errors.push({
        field: 'validation_system',
        message: error.message,
        type: 'system_error',
        severity: 'error',
      });

      result.processingTime = Date.now() - startTime;

      this.logger.error('Validation system error', {
        error: error.message,
        stack: error.stack,
        schemaType,
      });

      return result;
    }
  }

  /**
   * Content-specific validation beyond schema
   */
  async validateContentSpecific(content, schemaType) {
    const errors = [];
    const warnings = [];

    if (schemaType === 'dreamResponse') {
      // Validate 3D scene data structure
      if (content.data?.scenes) {
        for (const [index, scene] of content.data.scenes.entries()) {
          // Check for empty or invalid objects array
          if (
            !scene.objects ||
            !Array.isArray(scene.objects) ||
            scene.objects.length === 0
          ) {
            warnings.push({
              field: `data.scenes[${index}].objects`,
              message: 'Scene has no objects defined',
              type: 'content_quality',
              severity: 'warning',
            });
          }

          // Check for reasonable scene description length
          if (scene.description && scene.description.length < 10) {
            warnings.push({
              field: `data.scenes[${index}].description`,
              message: 'Scene description is too short',
              type: 'content_quality',
              severity: 'warning',
            });
          }
        }
      }

      // Validate cinematography data
      if (content.data?.cinematography) {
        const cinematography = content.data.cinematography;

        // Check total shot duration vs declared duration
        if (cinematography.shots && cinematography.duration) {
          const totalShotDuration = cinematography.shots.reduce(
            (sum, shot) => sum + (shot.duration || 0),
            0
          );

          if (Math.abs(totalShotDuration - cinematography.duration) > 5) {
            warnings.push({
              field: 'data.cinematography.duration',
              message: 'Total shot duration does not match declared duration',
              type: 'content_consistency',
              severity: 'warning',
            });
          }
        }
      }

      // Validate metadata consistency
      if (content.metadata) {
        // Check confidence score reasonableness
        if (content.metadata.confidence < 0.3) {
          warnings.push({
            field: 'metadata.confidence',
            message: 'Low confidence score indicates potential quality issues',
            type: 'quality_warning',
            severity: 'warning',
          });
        }

        // Check token usage reasonableness
        if (content.metadata.tokens) {
          if (content.metadata.tokens.output < 100) {
            warnings.push({
              field: 'metadata.tokens.output',
              message:
                'Very low output token count may indicate incomplete response',
              type: 'completeness_warning',
              severity: 'warning',
            });
          }
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Assess content quality using multiple criteria
   * @param {Object} content - Content to assess
   * @param {Object} requirements - Quality requirements
   * @param {string} originalPrompt - Original user prompt for relevance checking
   * @returns {Object} Quality assessment result
   */
  async qualityCheck(content, requirements = {}, originalPrompt = '') {
    const startTime = Date.now();
    const result = {
      score: 0,
      passed: false,
      issues: [],
      breakdown: {},
      processingTime: 0,
    };

    try {
      let totalScore = 0;
      let totalWeight = 0;

      // Run each quality rule
      for (const [ruleName, rule] of Object.entries(this.qualityRules)) {
        try {
          const ruleScore = rule.check(content, originalPrompt);
          const weightedScore = ruleScore * rule.weight;

          totalScore += weightedScore;
          totalWeight += rule.weight;

          result.breakdown[ruleName] = {
            score: ruleScore,
            weight: rule.weight,
            weightedScore: weightedScore,
          };

          // Add issues for low-scoring rules
          if (ruleScore < 0.5) {
            result.issues.push({
              rule: ruleName,
              score: ruleScore,
              severity: ruleScore < 0.3 ? 'high' : 'medium',
              message: `${ruleName} scored ${(ruleScore * 100).toFixed(
                1
              )}% - below quality threshold`,
            });
          }
        } catch (error) {
          this.logger.warn(`Quality rule ${ruleName} failed`, {
            error: error.message,
          });
          result.issues.push({
            rule: ruleName,
            score: 0,
            severity: 'high',
            message: `Quality rule failed: ${error.message}`,
          });
        }
      }

      // Calculate final score
      result.score = totalWeight > 0 ? totalScore / totalWeight : 0;

      // Determine if quality check passed
      const minScore =
        requirements.minScore || this.config.quality.minConfidenceScore || 0.7;
      result.passed = result.score >= minScore;

      // Track quality scores for metrics
      this.metrics.qualityScores.push(result.score);

      result.processingTime = Date.now() - startTime;

      this.logger.info('Quality check completed', {
        score: result.score,
        passed: result.passed,
        issueCount: result.issues.length,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      result.issues.push({
        rule: 'quality_system',
        score: 0,
        severity: 'high',
        message: `Quality assessment failed: ${error.message}`,
      });

      result.processingTime = Date.now() - startTime;

      this.logger.error('Quality check system error', {
        error: error.message,
        stack: error.stack,
      });

      return result;
    }
  }

  /**
   * Get comprehensive validation metrics
   * @returns {Object} Current validation metrics
   */
  getValidationMetrics() {
    const avgQualityScore =
      this.metrics.qualityScores.length > 0
        ? this.metrics.qualityScores.reduce((sum, score) => sum + score, 0) /
          this.metrics.qualityScores.length
        : 0;

    return {
      totalValidations: this.metrics.totalValidations,
      successfulValidations: this.metrics.successfulValidations,
      failedValidations: this.metrics.failedValidations,
      successRate:
        this.metrics.totalValidations > 0
          ? (this.metrics.successfulValidations /
              this.metrics.totalValidations) *
            100
          : 0,
      repairAttempts: this.metrics.repairAttempts,
      successfulRepairs: this.metrics.successfulRepairs,
      repairSuccessRate:
        this.metrics.repairAttempts > 0
          ? (this.metrics.successfulRepairs / this.metrics.repairAttempts) * 100
          : 0,
      averageQualityScore: avgQualityScore,
      qualityScoreCount: this.metrics.qualityScores.length,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Automatic content repair for validation failures
   * @param {Object} content - The content to repair
   * @param {Array} errors - Validation errors found
   * @param {Object} options - Repair options
   * @returns {Object} Repair result
   */
  async repairContent(content, errors = [], options = {}) {
    this.metrics.repairAttempts++;

    const startTime = Date.now();
    const result = {
      success: false,
      repairedContent: null,
      appliedStrategies: [],
      remainingErrors: [...errors],
      warnings: [],
      processingTime: 0,
    };

    try {
      this.logger.info('Starting automatic content repair', {
        errorCount: errors.length,
        repairEnabled: this.config.repair?.enabled,
      });

      if (!this.config.repair?.enabled) {
        result.warnings.push({
          type: 'repair_disabled',
          message: 'Automatic repair is disabled',
          severity: 'info',
        });
        result.repairedContent = content;
        return result;
      }

      // Use ContentRepair class for automatic repair
      const repairResult = await this.contentRepair.repairContent(
        content,
        errors,
        options
      );

      result.success = repairResult.success;
      result.repairedContent = repairResult.repairedContent;
      result.appliedStrategies = repairResult.appliedStrategies;
      result.remainingErrors = repairResult.remainingErrors;
      result.warnings.push(...repairResult.warnings);

      if (result.success) {
        this.metrics.successfulRepairs++;
      }

      result.processingTime = Date.now() - startTime;

      this.logger.info('Content repair completed', {
        success: result.success,
        strategiesApplied: result.appliedStrategies.length,
        errorsFixed: errors.length - result.remainingErrors.length,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      result.processingTime = Date.now() - startTime;

      this.logger.error('Content repair failed', {
        error: error.message,
        stack: error.stack,
      });

      throw new Error(`Content repair failed: ${error.message}`);
    }
  }

  /**
   * Generate intelligent retry strategy for validation errors
   * @param {Array} errors - Validation errors
   * @param {Object} originalContent - Original content that failed
   * @param {Object} context - Context information (prompt, provider, etc.)
   * @param {Object} options - Retry options
   * @returns {Object} Retry strategy result
   */
  async generateRetryStrategy(
    errors,
    originalContent,
    context = {},
    options = {}
  ) {
    const startTime = Date.now();
    const result = {
      success: false,
      strategy: null,
      retryPrompt: null,
      retryOptions: {},
      recommendations: [],
      processingTime: 0,
    };

    try {
      this.logger.info('Generating retry strategy', {
        errorCount: errors.length,
        context: {
          provider: context.provider,
          model: context.model,
        },
      });

      // Use RetryStrategies class for intelligent retry
      const retryResult = await this.retryStrategies.executeRetryStrategy(
        errors,
        originalContent,
        context,
        options
      );

      result.success = retryResult.success;
      result.strategy = retryResult.strategy;
      result.retryPrompt = retryResult.retryPrompt;
      result.retryOptions = retryResult.retryOptions;
      result.recommendations = retryResult.recommendations;
      result.processingTime = Date.now() - startTime;

      this.logger.info('Retry strategy generated', {
        success: result.success,
        strategy: result.strategy,
        hasRetryPrompt: !!result.retryPrompt,
        recommendationCount: result.recommendations.length,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      result.processingTime = Date.now() - startTime;

      this.logger.error('Retry strategy generation failed', {
        error: error.message,
        stack: error.stack,
      });

      throw new Error(`Retry strategy generation failed: ${error.message}`);
    }
  }

  /**
   * Complete validation and repair pipeline
   * @param {Object} content - Content to validate and potentially repair
   * @param {string} schemaType - Schema type for validation
   * @param {Object} options - Pipeline options
   * @returns {Object} Complete pipeline result
   */
  async validateAndRepair(content, schemaType = 'dreamResponse', options = {}) {
    const startTime = Date.now();
    const result = {
      validation: null,
      repair: null,
      finalContent: null,
      success: false,
      processingTime: 0,
    };

    try {
      // Step 1: Initial validation
      result.validation = await this.validateResponse(
        content,
        schemaType,
        options
      );

      // Step 2: Attempt repair if validation failed and repair is enabled
      if (!result.validation.valid && this.config.repair?.enabled) {
        result.repair = await this.repairContent(
          content,
          result.validation.errors,
          options
        );

        if (result.repair.success && result.repair.repairedContent) {
          // Step 3: Re-validate repaired content
          const revalidation = await this.validateResponse(
            result.repair.repairedContent,
            schemaType,
            options
          );

          if (revalidation.valid) {
            result.finalContent = result.repair.repairedContent;
            result.success = true;
          } else {
            // Repair didn't fully fix the issues
            result.finalContent = result.repair.repairedContent;
            result.success = false;
            result.validation.errors = revalidation.errors;
          }
        } else {
          result.finalContent = content;
          result.success = false;
        }
      } else {
        result.finalContent = content;
        result.success = result.validation.valid;
      }

      result.processingTime = Date.now() - startTime;

      this.logger.info('Validation and repair pipeline completed', {
        initiallyValid: result.validation.valid,
        repairAttempted: !!result.repair,
        repairSuccessful: result.repair?.success || false,
        finalSuccess: result.success,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      result.processingTime = Date.now() - startTime;

      this.logger.error('Validation and repair pipeline failed', {
        error: error.message,
        stack: error.stack,
      });

      throw new Error(
        `Validation and repair pipeline failed: ${error.message}`
      );
    }
  }

  /**
   * Get comprehensive metrics including repair and retry statistics
   */
  getComprehensiveMetrics() {
    const validationMetrics = this.getValidationMetrics();
    const repairMetrics = this.contentRepair.getRepairMetrics();
    const retryMetrics = this.retryStrategies.getRetryMetrics();

    return {
      validation: validationMetrics,
      repair: repairMetrics,
      retry: retryMetrics,
      combined: {
        totalOperations: validationMetrics.totalValidations,
        overallSuccessRate: validationMetrics.successRate,
        repairContribution: repairMetrics.successfulRepairs,
        retryContribution: retryMetrics.successfulRetries,
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  /**
   * Reset all metrics including repair and retry
   */
  resetAllMetrics() {
    this.resetMetrics();
    this.contentRepair.resetMetrics();
    this.retryStrategies.resetMetrics();
  }

  /**
   * Reset validation metrics
   */
  resetMetrics() {
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      repairAttempts: 0,
      successfulRepairs: 0,
      qualityScores: [],
    };
  }
}

module.exports = ValidationPipeline;
