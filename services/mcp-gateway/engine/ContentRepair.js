// engine/ContentRepair.js
// Automatic content repair mechanisms for AI-generated content

const _ = require('lodash');
const winston = require('winston');

// Import configuration and utilities
const validationConfig = require('../config/validation');
const BaseTemplates = require('../templates/BaseTemplates');

class ContentRepair {
  constructor(options = {}) {
    this.config = _.merge({}, validationConfig.repair, options);
    this.baseTemplates = new BaseTemplates();

    this.metrics = {
      totalRepairAttempts: 0,
      successfulRepairs: 0,
      failedRepairs: 0,
      repairsByStrategy: {},
      repairsByErrorType: {},
    };

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/content-repair.log' }),
      ],
    });

    // Initialize repair strategies
    this.repairStrategies = this.initializeRepairStrategies();
  }

  /**
   * Initialize all repair strategies
   */
  initializeRepairStrategies() {
    return {
      fixJsonStructure: this.fixJsonStructure.bind(this),
      fillMissingFields: this.fillMissingFields.bind(this),
      enhanceDescriptions: this.enhanceDescriptions.bind(this),
      validateObjects: this.validateObjects.bind(this),
      repairCinematography: this.repairCinematography.bind(this),
      normalizeMetadata: this.normalizeMetadata.bind(this),
    };
  }

  /**
   * Main repair method - attempts to fix content using multiple strategies
   * @param {Object} content - The malformed content to repair
   * @param {Array} errors - Validation errors found in the content
   * @param {Object} options - Repair options
   * @returns {Object} Repair result with fixed content
   */
  async repairContent(content, errors = [], options = {}) {
    this.metrics.totalRepairAttempts++;

    const startTime = Date.now();
    const result = {
      success: false,
      repairedContent: null,
      appliedStrategies: [],
      remainingErrors: [...errors],
      warnings: [],
      processingTime: 0,
      attempts: 0,
    };

    try {
      // Handle null or invalid content
      if (!content || typeof content !== 'object') {
        throw new Error('Invalid content provided for repair');
      }

      let currentContent = _.cloneDeep(content);
      let currentErrors = [...errors];
      let attempts = 0;
      const maxAttempts = options.maxAttempts || this.config.maxAttempts;

      this.logger.info('Starting content repair', {
        errorCount: errors.length,
        maxAttempts,
        strategies: this.config.strategies,
      });

      // Apply repair strategies in order
      while (attempts < maxAttempts && currentErrors.length > 0) {
        attempts++;
        let repairMade = false;

        for (const strategyName of this.config.strategies) {
          if (!this.repairStrategies[strategyName]) {
            this.logger.warn(`Unknown repair strategy: ${strategyName}`);
            continue;
          }

          try {
            const strategyResult = await this.repairStrategies[strategyName](
              currentContent,
              currentErrors,
              options
            );

            if (strategyResult.success) {
              currentContent = strategyResult.content;
              currentErrors = strategyResult.remainingErrors || [];
              result.appliedStrategies.push({
                strategy: strategyName,
                errorsFixed: errors.length - currentErrors.length,
                warnings: strategyResult.warnings || [],
              });
              result.warnings.push(...(strategyResult.warnings || []));
              repairMade = true;

              // Track strategy usage
              this.metrics.repairsByStrategy[strategyName] =
                (this.metrics.repairsByStrategy[strategyName] || 0) + 1;

              this.logger.debug(`Strategy ${strategyName} applied`, {
                errorsFixed: errors.length - currentErrors.length,
                remainingErrors: currentErrors.length,
              });
            }
          } catch (error) {
            this.logger.error(`Repair strategy ${strategyName} failed`, {
              error: error.message,
              stack: error.stack,
            });
            result.warnings.push({
              type: 'strategy_error',
              message: `Repair strategy ${strategyName} failed: ${error.message}`,
              severity: 'medium',
            });
          }
        }

        // If no repairs were made in this iteration, break to avoid infinite loop
        if (!repairMade) {
          break;
        }
      }

      result.repairedContent = currentContent;
      result.remainingErrors = currentErrors;
      result.attempts = attempts;
      result.success = currentErrors.length < errors.length;

      if (result.success) {
        this.metrics.successfulRepairs++;
      } else {
        this.metrics.failedRepairs++;
      }

      result.processingTime = Date.now() - startTime;

      this.logger.info('Content repair completed', {
        success: result.success,
        originalErrors: errors.length,
        remainingErrors: currentErrors.length,
        strategiesApplied: result.appliedStrategies.length,
        attempts: attempts,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      this.metrics.failedRepairs++;
      result.processingTime = Date.now() - startTime;

      this.logger.error('Content repair system error', {
        error: error.message,
        stack: error.stack,
      });

      throw new Error(`Content repair failed: ${error.message}`);
    }
  }

  /**
   * Fix JSON structure issues
   */
  async fixJsonStructure(content, errors, options = {}) {
    const result = {
      success: false,
      content: _.cloneDeep(content),
      remainingErrors: [...errors],
      warnings: [],
    };

    try {
      // Fix missing success field
      if (typeof result.content.success === 'undefined') {
        result.content.success = true;
        result.remainingErrors = result.remainingErrors.filter(
          (error) => error.field !== 'success'
        );
        result.success = true;
      }

      // Ensure data object exists
      if (!result.content.data || typeof result.content.data !== 'object') {
        result.content.data = result.content.data || {};
        result.remainingErrors = result.remainingErrors.filter(
          (error) => error.field !== 'data'
        );
        result.success = true;
      }

      // Ensure metadata object exists
      if (
        !result.content.metadata ||
        typeof result.content.metadata !== 'object'
      ) {
        result.content.metadata = result.content.metadata || {};
        result.remainingErrors = result.remainingErrors.filter(
          (error) => error.field !== 'metadata'
        );
        result.success = true;
      }

      // Fix array fields that should be arrays
      const arrayFields = ['scenes', 'shots', 'transitions', 'effects'];
      for (const field of arrayFields) {
        const fieldPath =
          field === 'scenes'
            ? 'data.scenes'
            : field === 'shots'
            ? 'data.cinematography.shots'
            : `data.cinematography.${field}`;

        const value = _.get(result.content, fieldPath);
        if (value && !Array.isArray(value)) {
          _.set(result.content, fieldPath, []);
          result.warnings.push({
            type: 'structure_fix',
            message: `Converted ${fieldPath} to array`,
            severity: 'low',
          });
          result.success = true;
        }
      }

      return result;
    } catch (error) {
      throw new Error(`JSON structure repair failed: ${error.message}`);
    }
  }

  /**
   * Fill missing required fields with appropriate defaults
   */
  async fillMissingFields(content, errors, options = {}) {
    const result = {
      success: false,
      content: _.cloneDeep(content),
      remainingErrors: [...errors],
      warnings: [],
    };

    try {
      const defaults = this.config.defaults;
      let fieldsFilled = 0;

      // Fill missing data fields
      if (result.content.data) {
        if (!result.content.data.id) {
          result.content.data.id = `dream_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          fieldsFilled++;
        }

        if (!result.content.data.title) {
          result.content.data.title = 'Generated Dream Scene';
          fieldsFilled++;
        }

        if (
          !result.content.data.description ||
          result.content.data.description.length < 10
        ) {
          result.content.data.description =
            'A mysterious and captivating dream scene with ethereal elements and surreal atmosphere.';
          fieldsFilled++;
        }

        if (
          !result.content.data.scenes ||
          !Array.isArray(result.content.data.scenes)
        ) {
          result.content.data.scenes = [
            {
              id: 'scene_1',
              description: 'A dreamlike environment with floating elements',
              objects: [],
            },
          ];
          fieldsFilled++;
        }
      }

      // Fill missing metadata fields
      if (result.content.metadata) {
        const metadataDefaults = {
          source: 'unknown',
          model: 'unknown',
          processingTime: defaults.processingTime,
          quality: defaults.quality,
          confidence: defaults.confidence,
          cacheHit: defaults.cacheHit,
          tokens: {
            input: 0,
            output: 0,
            total: 0,
          },
        };

        for (const [field, defaultValue] of Object.entries(metadataDefaults)) {
          if (!result.content.metadata[field]) {
            result.content.metadata[field] = defaultValue;
            fieldsFilled++;
          }
        }
      }

      // Remove errors for fields that were filled
      if (fieldsFilled > 0) {
        result.remainingErrors = result.remainingErrors.filter((error) => {
          // Remove missing field errors that we've addressed
          return !(error.type === 'missing_field' || error.type === 'required');
        });

        result.success = true;
        result.warnings.push({
          type: 'fields_filled',
          message: `Filled ${fieldsFilled} missing fields with defaults`,
          severity: 'low',
        });
      }

      return result;
    } catch (error) {
      throw new Error(`Missing fields repair failed: ${error.message}`);
    }
  }

  /**
   * Enhance short or poor quality descriptions
   */
  async enhanceDescriptions(content, errors, options = {}) {
    const result = {
      success: false,
      content: _.cloneDeep(content),
      remainingErrors: [...errors],
      warnings: [],
    };

    try {
      let descriptionsEnhanced = 0;
      const minLength = this.config.autoRepair.shortDescriptions.minLength;
      const enhanceBelow =
        this.config.autoRepair.shortDescriptions.enhanceBelow;

      // Enhance main description
      if (result.content.data?.description) {
        const desc = result.content.data.description;
        if (desc.length < enhanceBelow) {
          const enhancedDesc = this.enhanceDescription(desc);
          if (enhancedDesc !== desc) {
            result.content.data.description = enhancedDesc;
            descriptionsEnhanced++;
          }
        }
      }

      // Enhance scene descriptions
      if (
        result.content.data?.scenes &&
        Array.isArray(result.content.data.scenes)
      ) {
        for (const scene of result.content.data.scenes) {
          if (scene.description && scene.description.length < enhanceBelow) {
            const enhancedDesc = this.enhanceDescription(scene.description);
            if (enhancedDesc !== scene.description) {
              scene.description = enhancedDesc;
              descriptionsEnhanced++;
            }
          }
        }
      }

      if (descriptionsEnhanced > 0) {
        result.success = true;
        result.warnings.push({
          type: 'descriptions_enhanced',
          message: `Enhanced ${descriptionsEnhanced} short descriptions`,
          severity: 'low',
        });

        // Remove description quality errors
        result.remainingErrors = result.remainingErrors.filter(
          (error) =>
            !error.field?.includes('description') ||
            error.type !== 'content_quality'
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Description enhancement failed: ${error.message}`);
    }
  }

  /**
   * Validate and fix object arrays in scenes
   */
  async validateObjects(content, errors, options = {}) {
    const result = {
      success: false,
      content: _.cloneDeep(content),
      remainingErrors: [...errors],
      warnings: [],
    };

    try {
      let objectsFixed = 0;

      if (
        result.content.data?.scenes &&
        Array.isArray(result.content.data.scenes)
      ) {
        for (const scene of result.content.data.scenes) {
          // Ensure objects array exists
          if (!scene.objects || !Array.isArray(scene.objects)) {
            scene.objects = [];
            objectsFixed++;
          }

          // Add default object if scene has no objects
          if (scene.objects.length === 0) {
            scene.objects.push({
              id: `obj_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 5)}`,
              type: 'ambient_element',
              description: 'Ethereal floating element',
              position: [0, 0, 0],
              scale: 1.0,
            });
            objectsFixed++;
          }

          // Validate existing objects
          for (const obj of scene.objects) {
            if (!obj.id) {
              obj.id = `obj_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 5)}`;
              objectsFixed++;
            }
            if (!obj.type) {
              obj.type = 'ambient_element';
              objectsFixed++;
            }
            if (!obj.position || !Array.isArray(obj.position)) {
              obj.position = [0, 0, 0];
              objectsFixed++;
            }
          }
        }
      }

      if (objectsFixed > 0) {
        result.success = true;
        result.warnings.push({
          type: 'objects_fixed',
          message: `Fixed ${objectsFixed} object-related issues`,
          severity: 'low',
        });

        // Remove object-related errors
        result.remainingErrors = result.remainingErrors.filter(
          (error) => !error.field?.includes('objects')
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Object validation repair failed: ${error.message}`);
    }
  }

  /**
   * Repair cinematography data
   */
  async repairCinematography(content, errors, options = {}) {
    const result = {
      success: false,
      content: _.cloneDeep(content),
      remainingErrors: [...errors],
      warnings: [],
    };

    try {
      let cinematographyFixed = false;

      if (result.content.data) {
        // Ensure cinematography object exists
        if (!result.content.data.cinematography) {
          result.content.data.cinematography = {
            shots: [],
            duration: this.config.defaults.duration,
          };
          cinematographyFixed = true;
        }

        const cinematography = result.content.data.cinematography;

        // Ensure shots array exists
        if (!cinematography.shots || !Array.isArray(cinematography.shots)) {
          cinematography.shots = [];
          cinematographyFixed = true;
        }

        // Add default shot if no shots exist
        if (cinematography.shots.length === 0) {
          cinematography.shots.push({
            type: 'establish',
            duration: 10,
            target: 'scene_overview',
          });
          cinematographyFixed = true;
        }

        // Fix shot durations and types
        for (const shot of cinematography.shots) {
          if (!shot.type) {
            shot.type = 'establish';
            cinematographyFixed = true;
          }
          if (!shot.duration || shot.duration < 2) {
            shot.duration = 5;
            cinematographyFixed = true;
          }
          if (shot.duration > 30) {
            shot.duration = 30;
            cinematographyFixed = true;
          }
        }

        // Calculate and fix total duration
        const totalShotDuration = cinematography.shots.reduce(
          (sum, shot) => sum + (shot.duration || 0),
          0
        );

        if (
          !cinematography.duration ||
          Math.abs(cinematography.duration - totalShotDuration) > 5
        ) {
          cinematography.duration = totalShotDuration;
          cinematographyFixed = true;
        }
      }

      if (cinematographyFixed) {
        result.success = true;
        result.warnings.push({
          type: 'cinematography_fixed',
          message: 'Fixed cinematography data structure and values',
          severity: 'low',
        });

        // Remove cinematography-related errors
        result.remainingErrors = result.remainingErrors.filter(
          (error) => !error.field?.includes('cinematography')
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Cinematography repair failed: ${error.message}`);
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
            metadata.confidence = Math.min(metadata.confidence / 100, 1); // Convert percentage and cap at 1
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

        // Normalize processing time
        if (
          typeof metadata.processingTime === 'number' &&
          metadata.processingTime < 0
        ) {
          metadata.processingTime = 0;
          metadataFixed = true;
        }

        // Ensure tokens object is properly structured
        if (metadata.tokens && typeof metadata.tokens === 'object') {
          const tokenFields = ['input', 'output', 'total'];
          for (const field of tokenFields) {
            if (
              typeof metadata.tokens[field] !== 'number' ||
              metadata.tokens[field] < 0
            ) {
              metadata.tokens[field] = 0;
              metadataFixed = true;
            }
          }

          // Ensure total is sum of input and output
          const expectedTotal = metadata.tokens.input + metadata.tokens.output;
          if (metadata.tokens.total !== expectedTotal) {
            metadata.tokens.total = expectedTotal;
            metadataFixed = true;
          }
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
        result.remainingErrors = result.remainingErrors.filter(
          (error) =>
            !error.field?.includes('metadata') || error.type !== 'range_error'
        );
      }

      return result;
    } catch (error) {
      throw new Error(`Metadata normalization failed: ${error.message}`);
    }
  }

  /**
   * Enhance a description with more detail
   */
  enhanceDescription(description) {
    if (!description || description.length > 100) {
      return description;
    }

    const enhancements = [
      'with ethereal lighting and mysterious atmosphere',
      'featuring floating elements and dreamlike qualities',
      'surrounded by shimmering particles and soft glows',
      'bathed in otherworldly colors and surreal beauty',
      'filled with magical energy and enchanting details',
    ];

    const randomEnhancement =
      enhancements[Math.floor(Math.random() * enhancements.length)];
    return `${description.trim()} ${randomEnhancement}`;
  }

  /**
   * Get repair metrics
   */
  getRepairMetrics() {
    const totalAttempts = this.metrics.totalRepairAttempts;
    const successRate =
      totalAttempts > 0
        ? (this.metrics.successfulRepairs / totalAttempts) * 100
        : 0;

    return {
      totalRepairAttempts: this.metrics.totalRepairAttempts,
      successfulRepairs: this.metrics.successfulRepairs,
      failedRepairs: this.metrics.failedRepairs,
      successRate: successRate,
      repairsByStrategy: { ...this.metrics.repairsByStrategy },
      repairsByErrorType: { ...this.metrics.repairsByErrorType },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Reset repair metrics
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
}

module.exports = ContentRepair;
