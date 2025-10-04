/**
 * Enhanced Processing Pipeline with Validation Checkpoints
 *
 * Provides stage-by-stage validation and error handling for dream data processing.
 * Each stage validates its input and output to catch data loss early.
 */

const { logger } = require('./logger');
const { UnifiedValidator } = require('@dreamscapes/shared');

class ProcessingPipeline {
  constructor(options = {}) {
    this.validator = new UnifiedValidator({
      strictMode: options.strictMode !== false,
      logErrors: true,
    });

    this.stages = [];
    this.metrics = {
      totalProcessed: 0,
      successfulProcessing: 0,
      failedProcessing: 0,
      stageMetrics: {},
    };
  }

  /**
   * Process data through the pipeline with validation at each stage
   * @param {Object} data - Initial data to process
   * @param {Object} context - Processing context (requestId, originalText, etc.)
   * @returns {Object} Processed data with validation results
   */
  async process(data, context = {}) {
    const requestId = context.requestId || 'unknown';
    const startTime = Date.now();

    logger.info('Starting pipeline processing', {
      requestId,
      stageCount: this.stages.length,
      hasData: !!data,
      contextKeys: Object.keys(context),
      timestamp: new Date().toISOString(),
    });

    this.metrics.totalProcessed++;

    const processingResult = {
      success: false,
      data: null,
      stageResults: [],
      validationResults: [],
      transformationLogs: [],
      errors: [],
      processingTime: 0,
      requestId,
    };

    try {
      let currentData = data;
      let previousStageData = null;

      // Process through each stage
      for (let i = 0; i < this.stages.length; i++) {
        const stage = this.stages[i];
        const stageName = stage.name || `stage_${i}`;

        logger.info(`Processing stage: ${stageName}`, {
          requestId,
          stageIndex: i + 1,
          totalStages: this.stages.length,
          timestamp: new Date().toISOString(),
        });

        // Log data BEFORE stage processing
        const beforeSnapshot = this.createDataSnapshot(
          currentData,
          stageName,
          'before'
        );
        this.logDataTransformation(beforeSnapshot, requestId);

        // Validate input to this stage
        const inputValidation = await this.validateStageInput(
          currentData,
          stageName,
          requestId
        );

        processingResult.validationResults.push({
          stage: stageName,
          phase: 'input',
          timestamp: new Date().toISOString(),
          ...inputValidation,
        });

        // Check if input validation failed critically
        if (!inputValidation.valid && inputValidation.criticalCount > 0) {
          const error = new Error(
            `Stage ${stageName} input validation failed with ${inputValidation.criticalCount} critical errors`
          );
          error.stage = stageName;
          error.phase = 'input';
          error.validation = inputValidation;
          throw error;
        }

        // Store data before processing for comparison
        previousStageData = this.cloneData(currentData);

        // Execute stage processing
        const stageStartTime = Date.now();
        let stageResult;

        try {
          stageResult = await stage.process(currentData, context);
          const stageTime = Date.now() - stageStartTime;

          // Track stage metrics
          this.trackStageMetrics(stageName, true, stageTime);

          // Log data AFTER stage processing
          const afterSnapshot = this.createDataSnapshot(
            stageResult,
            stageName,
            'after'
          );
          this.logDataTransformation(afterSnapshot, requestId);

          // Compare before and after
          const transformation = this.compareDataSnapshots(
            beforeSnapshot,
            afterSnapshot,
            stageName
          );
          processingResult.transformationLogs.push(transformation);

          logger.info(`Stage ${stageName} completed successfully`, {
            requestId,
            processingTime: `${stageTime}ms`,
            hasResult: !!stageResult,
            dataChanged: transformation.dataChanged,
            fieldsAdded: transformation.fieldsAdded.length,
            fieldsRemoved: transformation.fieldsRemoved.length,
            fieldsModified: transformation.fieldsModified.length,
          });

          processingResult.stageResults.push({
            stage: stageName,
            success: true,
            processingTime: stageTime,
            dataChanged: transformation.dataChanged,
            transformation: {
              fieldsAdded: transformation.fieldsAdded,
              fieldsRemoved: transformation.fieldsRemoved,
              fieldsModified: transformation.fieldsModified,
            },
          });

          currentData = stageResult;
        } catch (stageError) {
          const stageTime = Date.now() - stageStartTime;
          this.trackStageMetrics(stageName, false, stageTime);

          logger.error(`Stage ${stageName} processing failed`, {
            requestId,
            error: stageError.message,
            processingTime: `${stageTime}ms`,
            stack: stageError.stack,
            context: {
              stageIndex: i + 1,
              totalStages: this.stages.length,
              hasErrorRecovery: !!stage.onError,
            },
          });

          processingResult.stageResults.push({
            stage: stageName,
            success: false,
            processingTime: stageTime,
            error: stageError.message,
            errorType: stageError.constructor.name,
          });

          // Check if stage has error recovery
          if (stage.onError) {
            logger.info(`Attempting error recovery for stage ${stageName}`, {
              requestId,
              errorType: stageError.constructor.name,
            });

            try {
              const recoveryStartTime = Date.now();
              currentData = await stage.onError(
                stageError,
                previousStageData,
                context
              );
              const recoveryTime = Date.now() - recoveryStartTime;

              logger.info(`Error recovery successful for stage ${stageName}`, {
                requestId,
                recoveryTime: `${recoveryTime}ms`,
                recoveredData: !!currentData,
              });

              // Log recovery transformation
              const afterRecovery = this.createDataSnapshot(
                currentData,
                stageName,
                'after_recovery'
              );
              this.logDataTransformation(afterRecovery, requestId);
            } catch (recoveryError) {
              logger.error(`Error recovery failed for stage ${stageName}`, {
                requestId,
                error: recoveryError.message,
                originalError: stageError.message,
              });
              throw stageError; // Throw original error
            }
          } else {
            throw stageError;
          }
        }

        // Validate output from this stage
        const outputValidation = await this.validateStageOutput(
          currentData,
          stageName,
          requestId
        );

        processingResult.validationResults.push({
          stage: stageName,
          phase: 'output',
          timestamp: new Date().toISOString(),
          ...outputValidation,
        });

        // Log field counts for debugging
        this.logFieldCounts(currentData, stageName, 'output', requestId);

        // Check if output validation failed critically
        if (!outputValidation.valid && outputValidation.criticalCount > 0) {
          logger.error(
            `Stage ${stageName} output validation failed critically`,
            {
              requestId,
              criticalErrors: outputValidation.criticalCount,
              errors: outputValidation.errors,
              context: {
                stageIndex: i + 1,
                totalStages: this.stages.length,
              },
            }
          );

          const error = new Error(
            `Stage ${stageName} output validation failed with ${outputValidation.criticalCount} critical errors`
          );
          error.stage = stageName;
          error.phase = 'output';
          error.validation = outputValidation;
          throw error;
        }

        // Warn about non-critical validation issues
        if (!outputValidation.valid) {
          logger.warn(`Stage ${stageName} output has validation warnings`, {
            requestId,
            errorCount: outputValidation.errorCount,
            warningCount: outputValidation.warningCount,
            errors: outputValidation.errors.slice(0, 3),
          });
        }
      }

      // Final validation
      // After schema_validation stage, currentData has structure: { dreamData, dataSource, validation }
      // Extract the actual dream object for final validation
      const dreamObjectToValidate = currentData.dreamData || currentData;

      console.log(
        '[ProcessingPipeline] Final validation - currentData keys:',
        Object.keys(currentData)
      );
      console.log(
        '[ProcessingPipeline] Final validation - dreamObjectToValidate.id:',
        dreamObjectToValidate.id
      );

      const finalValidation = this.validator.validateDreamObject(
        dreamObjectToValidate
      );
      processingResult.validationResults.push({
        stage: 'final',
        phase: 'complete',
        timestamp: new Date().toISOString(),
        ...finalValidation,
      });

      if (!finalValidation.valid) {
        logger.warn('Final pipeline validation has issues', {
          requestId,
          errorCount: finalValidation.errorCount,
          errors: finalValidation.errors.slice(0, 5),
        });
      }

      processingResult.success = true;
      processingResult.data = currentData;
      processingResult.processingTime = Date.now() - startTime;

      this.metrics.successfulProcessing++;

      // Calculate success rate for each stage
      const stageSuccessRates = this.calculateStageSuccessRates();

      logger.info('Pipeline processing completed successfully', {
        requestId,
        totalTime: `${processingResult.processingTime}ms`,
        stagesCompleted: this.stages.length,
        validationsPassed: processingResult.validationResults.filter(
          (v) => v.valid
        ).length,
        validationsTotal: processingResult.validationResults.length,
        transformationsLogged: processingResult.transformationLogs.length,
        stageSuccessRates,
        timestamp: new Date().toISOString(),
      });

      return processingResult;
    } catch (error) {
      this.metrics.failedProcessing++;
      processingResult.success = false;
      processingResult.error = error.message;
      processingResult.errorStage = error.stage;
      processingResult.errorPhase = error.phase;
      processingResult.processingTime = Date.now() - startTime;

      logger.error('Pipeline processing failed', {
        requestId,
        error: error.message,
        stage: error.stage,
        phase: error.phase,
        totalTime: `${processingResult.processingTime}ms`,
        stagesCompleted: processingResult.stageResults.filter((s) => s.success)
          .length,
        totalStages: this.stages.length,
        stack: error.stack,
        context: {
          validationResults: processingResult.validationResults.length,
          transformationLogs: processingResult.transformationLogs.length,
        },
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  /**
   * Validate input to a processing stage
   */
  async validateStageInput(data, stageName, requestId) {
    logger.debug(`Validating input for stage: ${stageName}`, {
      requestId,
      hasData: !!data,
      dataType: typeof data,
    });

    // Only validate dream objects (skip validation for Response objects, strings, etc.)
    // Dream objects should have dreamData property or be the final dream structure
    const isDreamData =
      data &&
      typeof data === 'object' &&
      (data.dreamData || (data.id && data.title && data.style));

    if (!isDreamData) {
      // Skip validation for non-dream data (intermediate processing stages)
      logger.debug(
        `Skipping validation for non-dream data at stage: ${stageName}`,
        {
          requestId,
          dataType: typeof data,
          isString: typeof data === 'string',
          hasText: typeof data === 'object' && 'text' in data,
        }
      );

      return {
        valid: true,
        errors: [],
        errorCount: 0,
        criticalCount: 0,
        skipped: true,
        reason: 'Not dream data',
      };
    }

    // Extract dream data if wrapped
    const dreamToValidate = data.dreamData || data;

    // Perform full validation on dream data
    const validation = this.validator.validateDreamObject(dreamToValidate);

    logger.debug(`Stage ${stageName} input validation result`, {
      requestId,
      valid: validation.valid,
      errorCount: validation.errorCount,
      criticalCount: validation.criticalCount || 0,
    });

    return validation;
  }

  /**
   * Validate output from a processing stage
   */
  async validateStageOutput(data, stageName, requestId) {
    logger.debug(`Validating output for stage: ${stageName}`, {
      requestId,
      hasData: !!data,
      dataType: typeof data,
    });

    // Only validate dream objects (skip validation for Response objects, strings, etc.)
    // Dream objects should have dreamData property or be the final dream structure
    const isDreamData =
      data &&
      typeof data === 'object' &&
      (data.dreamData || (data.id && data.title && data.style));

    if (!isDreamData) {
      // Skip validation for non-dream data (intermediate processing stages)
      logger.debug(
        `Skipping validation for non-dream data at stage: ${stageName}`,
        {
          requestId,
          dataType: typeof data,
          isString: typeof data === 'string',
          hasText: typeof data === 'object' && 'text' in data,
        }
      );

      return {
        valid: true,
        errors: [],
        errorCount: 0,
        criticalCount: 0,
        skipped: true,
        reason: 'Not dream data',
      };
    }

    // Extract dream data if wrapped
    const dreamToValidate = data.dreamData || data;

    // Perform full validation on dream data
    const validation = this.validator.validateDreamObject(dreamToValidate);

    // Log specific field counts
    const fieldCounts = this.validator.getFieldCounts(dreamToValidate);

    logger.debug(`Stage ${stageName} output validation result`, {
      requestId,
      valid: validation.valid,
      errorCount: validation.errorCount,
      criticalCount: validation.criticalCount || 0,
      fieldCounts,
    });

    return validation;
  }

  /**
   * Log field counts for debugging
   */
  logFieldCounts(data, stageName, phase, requestId) {
    if (!data || typeof data !== 'object') return;

    // Extract dream data if wrapped (from dream_extraction stage)
    const dreamData = data.dreamData || data;

    const counts = {
      structures: Array.isArray(dreamData.structures)
        ? dreamData.structures.length
        : 0,
      entities: Array.isArray(dreamData.entities)
        ? dreamData.entities.length
        : 0,
      cinematographyShots: dreamData.cinematography?.shots?.length || 0,
      hasEnvironment: !!dreamData.environment,
      hasRenderConfig: !!dreamData.render,
      hasMetadata: !!dreamData.metadata,
    };

    logger.info(`Stage ${stageName} ${phase} field counts`, {
      requestId,
      ...counts,
    });
  }

  /**
   * Track metrics for a stage
   */
  trackStageMetrics(stageName, success, processingTime) {
    if (!this.metrics.stageMetrics[stageName]) {
      this.metrics.stageMetrics[stageName] = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalProcessingTime: 0,
        averageProcessingTime: 0,
      };
    }

    const metrics = this.metrics.stageMetrics[stageName];
    metrics.totalExecutions++;
    metrics.totalProcessingTime += processingTime;
    metrics.averageProcessingTime =
      metrics.totalProcessingTime / metrics.totalExecutions;

    if (success) {
      metrics.successfulExecutions++;
    } else {
      metrics.failedExecutions++;
    }
  }

  /**
   * Add a processing stage to the pipeline
   * @param {Object} stage - Stage configuration
   * @param {string} stage.name - Stage name
   * @param {Function} stage.process - Processing function
   * @param {Function} stage.onError - Optional error recovery function
   */
  addStage(stage) {
    if (!stage.name || typeof stage.name !== 'string') {
      throw new Error('Stage must have a name');
    }

    if (!stage.process || typeof stage.process !== 'function') {
      throw new Error('Stage must have a process function');
    }

    this.stages.push(stage);

    logger.info('Stage added to pipeline', {
      stageName: stage.name,
      hasErrorRecovery: !!stage.onError,
      totalStages: this.stages.length,
    });
  }

  /**
   * Clone data for comparison
   */
  cloneData(data) {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (error) {
      logger.warn('Failed to clone data', { error: error.message });
      return data;
    }
  }

  /**
   * Check if two data objects are equal
   */
  dataEquals(data1, data2) {
    try {
      return JSON.stringify(data1) === JSON.stringify(data2);
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a snapshot of data for before/after comparison
   */
  createDataSnapshot(data, stageName, phase) {
    const snapshot = {
      stage: stageName,
      phase,
      timestamp: new Date().toISOString(),
      dataType: typeof data,
      isNull: data === null,
      isArray: Array.isArray(data),
    };

    if (data && typeof data === 'object') {
      // Extract dream data if wrapped (from dream_extraction stage)
      const dreamData = data.dreamData || data;

      snapshot.fieldCounts = {
        structures: Array.isArray(dreamData.structures)
          ? dreamData.structures.length
          : 0,
        entities: Array.isArray(dreamData.entities)
          ? dreamData.entities.length
          : 0,
        cinematographyShots: dreamData.cinematography?.shots?.length || 0,
        hasEnvironment: !!dreamData.environment,
        hasRenderConfig: !!dreamData.render,
        hasMetadata: !!dreamData.metadata,
        hasId: !!dreamData.id,
        hasTitle: !!dreamData.title,
        hasStyle: !!dreamData.style,
      };

      snapshot.topLevelKeys = Object.keys(data);
      snapshot.dataSize = JSON.stringify(data).length;

      // Note if data is wrapped
      if (data.dreamData) {
        snapshot.isWrapped = true;
        snapshot.wrapperKeys = Object.keys(data);
      }
    }

    return snapshot;
  }

  /**
   * Log data transformation details
   */
  logDataTransformation(snapshot, requestId) {
    logger.debug(`Data snapshot: ${snapshot.stage} - ${snapshot.phase}`, {
      requestId,
      ...snapshot,
    });
  }

  /**
   * Compare two data snapshots to identify changes
   */
  compareDataSnapshots(beforeSnapshot, afterSnapshot, stageName) {
    const comparison = {
      stage: stageName,
      dataChanged: false,
      fieldsAdded: [],
      fieldsRemoved: [],
      fieldsModified: [],
      sizeChange: 0,
    };

    // Compare top-level keys
    if (beforeSnapshot.topLevelKeys && afterSnapshot.topLevelKeys) {
      const beforeKeys = new Set(beforeSnapshot.topLevelKeys);
      const afterKeys = new Set(afterSnapshot.topLevelKeys);

      // Find added fields
      afterKeys.forEach((key) => {
        if (!beforeKeys.has(key)) {
          comparison.fieldsAdded.push(key);
          comparison.dataChanged = true;
        }
      });

      // Find removed fields
      beforeKeys.forEach((key) => {
        if (!afterKeys.has(key)) {
          comparison.fieldsRemoved.push(key);
          comparison.dataChanged = true;
        }
      });
    }

    // Compare field counts
    if (beforeSnapshot.fieldCounts && afterSnapshot.fieldCounts) {
      const beforeCounts = beforeSnapshot.fieldCounts;
      const afterCounts = afterSnapshot.fieldCounts;

      Object.keys(afterCounts).forEach((field) => {
        if (beforeCounts[field] !== afterCounts[field]) {
          comparison.fieldsModified.push({
            field,
            before: beforeCounts[field],
            after: afterCounts[field],
          });
          comparison.dataChanged = true;
        }
      });
    }

    // Compare data size
    if (beforeSnapshot.dataSize && afterSnapshot.dataSize) {
      comparison.sizeChange = afterSnapshot.dataSize - beforeSnapshot.dataSize;
      if (comparison.sizeChange !== 0) {
        comparison.dataChanged = true;
      }
    }

    return comparison;
  }

  /**
   * Calculate success rates for each stage
   */
  calculateStageSuccessRates() {
    const rates = {};

    Object.entries(this.metrics.stageMetrics).forEach(
      ([stageName, metrics]) => {
        rates[stageName] = {
          successRate:
            metrics.totalExecutions > 0
              ? (metrics.successfulExecutions / metrics.totalExecutions) * 100
              : 0,
          averageTime: metrics.averageProcessingTime,
          totalExecutions: metrics.totalExecutions,
        };
      }
    );

    return rates;
  }

  /**
   * Get pipeline metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.totalProcessed > 0
          ? (this.metrics.successfulProcessing / this.metrics.totalProcessed) *
            100
          : 0,
    };
  }

  /**
   * Reset pipeline metrics
   */
  resetMetrics() {
    this.metrics = {
      totalProcessed: 0,
      successfulProcessing: 0,
      failedProcessing: 0,
      stageMetrics: {},
    };
  }

  /**
   * Clear all stages
   */
  clearStages() {
    this.stages = [];
    logger.info('All pipeline stages cleared');
  }
}

module.exports = ProcessingPipeline;
