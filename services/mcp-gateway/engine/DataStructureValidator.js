// engine/DataStructureValidator.js
// Comprehensive data structure integrity validation

const _ = require('lodash');
const winston = require('winston');

class DataStructureValidator {
  constructor(config = {}) {
    this.config = _.merge(
      {
        integrity: {
          requiredFields: ['success', 'data', 'metadata'],
          dataFields: ['id', 'title', 'description', 'scenes'],
          metadataFields: [
            'source',
            'model',
            'processingTime',
            'quality',
            'tokens',
            'confidence',
            'cacheHit',
          ],
          sceneFields: ['id', 'description', 'objects'],
          objectFields: ['type'],
          strictMode: false,
          allowUnknownFields: true,
        },
        validation: {
          minCoverage: 0.8,
          criticalFieldWeight: 1.0,
          optionalFieldWeight: 0.5,
        },
      },
      config
    );

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
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      integrityIssues: {},
      fieldCoverage: {},
    };
  }

  /**
   * Validate comprehensive data structure integrity
   */
  async validateDataStructure(data, schema = 'dreamResponse', options = {}) {
    this.metrics.totalValidations++;

    const startTime = Date.now();
    const result = {
      valid: true,
      issues: [],
      coverage: 0,
      details: {},
      processingTime: 0,
      fieldAnalysis: {},
      integrityScore: 0,
    };

    try {
      if (schema === 'dreamResponse') {
        await this.validateDreamResponseStructure(data, result, options);
      } else {
        result.valid = false;
        result.issues.push({
          type: 'unknown_schema',
          message: `Unknown schema type: ${schema}`,
          severity: 'high',
          field: 'schema',
        });
      }

      // Calculate overall integrity score
      result.integrityScore = this.calculateIntegrityScore(result);
      result.valid =
        result.integrityScore >= this.config.validation.minCoverage;

      if (result.valid) {
        this.metrics.passedValidations++;
      } else {
        this.metrics.failedValidations++;
      }

      result.processingTime = Date.now() - startTime;

      this.logger.info('Data structure validation completed', {
        valid: result.valid,
        integrityScore: result.integrityScore,
        issueCount: result.issues.length,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      result.valid = false;
      result.issues.push({
        type: 'validation_error',
        message: `Validation failed: ${error.message}`,
        severity: 'high',
        field: 'system',
      });
      result.processingTime = Date.now() - startTime;

      this.logger.error('Data structure validation failed', {
        error: error.message,
        stack: error.stack,
      });

      return result;
    }
  }

  /**
   * Validate dream response structure specifically
   */
  async validateDreamResponseStructure(data, result, options = {}) {
    // Validate top-level structure
    await this.validateTopLevelFields(data, result);

    // Validate data object
    if (data && data.data) {
      await this.validateDataObject(data.data, result);
    }

    // Validate metadata object
    if (data && data.metadata) {
      await this.validateMetadataObject(data.metadata, result);
    }

    // Calculate field coverage
    result.coverage = this.calculateFieldCoverage(data, result);
  }

  /**
   * Validate top-level required fields
   */
  async validateTopLevelFields(data, result) {
    const requiredFields = this.config.integrity.requiredFields;
    const presentFields = [];
    const missingFields = [];

    for (const field of requiredFields) {
      if (data && data[field] !== undefined) {
        presentFields.push(field);

        // Validate field types
        await this.validateFieldType(data, field, result);
      } else {
        missingFields.push(field);
        result.issues.push({
          type: 'missing_required_field',
          message: `Missing required field: ${field}`,
          severity: 'high',
          field: field,
        });
      }
    }

    result.details.topLevel = {
      required: requiredFields,
      present: presentFields,
      missing: missingFields,
      coverage: presentFields.length / requiredFields.length,
    };
  }

  /**
   * Validate data object structure
   */
  async validateDataObject(dataObj, result) {
    const dataFields = this.config.integrity.dataFields;
    const presentFields = [];
    const missingFields = [];

    for (const field of dataFields) {
      if (dataObj[field] !== undefined) {
        presentFields.push(field);

        // Validate specific data field requirements
        await this.validateDataField(dataObj, field, result);
      } else {
        missingFields.push(field);
        result.issues.push({
          type: 'missing_data_field',
          message: `Missing data field: ${field}`,
          severity: field === 'id' || field === 'title' ? 'high' : 'medium',
          field: `data.${field}`,
        });
      }
    }

    // Validate scenes array if present
    if (dataObj.scenes) {
      await this.validateScenesArray(dataObj.scenes, result);
    }

    result.details.dataFields = {
      required: dataFields,
      present: presentFields,
      missing: missingFields,
      coverage: presentFields.length / dataFields.length,
    };
  }

  /**
   * Validate metadata object structure
   */
  async validateMetadataObject(metadata, result) {
    const metadataFields = this.config.integrity.metadataFields;
    const presentFields = [];
    const missingFields = [];

    for (const field of metadataFields) {
      if (metadata[field] !== undefined) {
        presentFields.push(field);

        // Validate metadata field types and values
        await this.validateMetadataField(metadata, field, result);
      } else {
        missingFields.push(field);
        result.issues.push({
          type: 'missing_metadata_field',
          message: `Missing metadata field: ${field}`,
          severity: 'medium',
          field: `metadata.${field}`,
        });
      }
    }

    result.details.metadataFields = {
      required: metadataFields,
      present: presentFields,
      missing: missingFields,
      coverage: presentFields.length / metadataFields.length,
    };
  }

  /**
   * Validate scenes array structure
   */
  async validateScenesArray(scenes, result) {
    if (!Array.isArray(scenes)) {
      result.issues.push({
        type: 'invalid_scenes_type',
        message: 'Scenes must be an array',
        severity: 'high',
        field: 'data.scenes',
      });
      return;
    }

    if (scenes.length === 0) {
      result.issues.push({
        type: 'empty_scenes_array',
        message: 'Scenes array is empty',
        severity: 'medium',
        field: 'data.scenes',
      });
      return;
    }

    const sceneFields = this.config.integrity.sceneFields;
    const sceneAnalysis = {
      totalScenes: scenes.length,
      validScenes: 0,
      invalidScenes: 0,
      fieldCoverage: {},
    };

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      let sceneValid = true;

      // Check required scene fields
      for (const field of sceneFields) {
        if (scene[field] === undefined) {
          result.issues.push({
            type: 'missing_scene_field',
            message: `Scene ${i} missing required field: ${field}`,
            severity: 'medium',
            field: `data.scenes[${i}].${field}`,
          });
          sceneValid = false;
        }
      }

      // Validate objects array in scene
      if (scene.objects) {
        await this.validateSceneObjects(scene.objects, i, result);
      }

      if (sceneValid) {
        sceneAnalysis.validScenes++;
      } else {
        sceneAnalysis.invalidScenes++;
      }
    }

    result.details.scenes = sceneAnalysis;
  }

  /**
   * Validate scene objects array
   */
  async validateSceneObjects(objects, sceneIndex, result) {
    if (!Array.isArray(objects)) {
      result.issues.push({
        type: 'invalid_objects_type',
        message: `Scene ${sceneIndex} objects must be an array`,
        severity: 'medium',
        field: `data.scenes[${sceneIndex}].objects`,
      });
      return;
    }

    const objectFields = this.config.integrity.objectFields;

    for (let j = 0; j < objects.length; j++) {
      const obj = objects[j];

      // Check required object fields
      for (const field of objectFields) {
        if (obj[field] === undefined) {
          result.issues.push({
            type: 'missing_object_field',
            message: `Scene ${sceneIndex} object ${j} missing required field: ${field}`,
            severity: 'low',
            field: `data.scenes[${sceneIndex}].objects[${j}].${field}`,
          });
        }
      }

      // Validate position array if present
      if (obj.position && !Array.isArray(obj.position)) {
        result.issues.push({
          type: 'invalid_position_type',
          message: `Scene ${sceneIndex} object ${j} position must be an array`,
          severity: 'low',
          field: `data.scenes[${sceneIndex}].objects[${j}].position`,
        });
      }
    }
  }

  /**
   * Validate field types
   */
  async validateFieldType(data, field, result) {
    const value = data[field];

    switch (field) {
      case 'success':
        if (typeof value !== 'boolean') {
          result.issues.push({
            type: 'invalid_field_type',
            message: `Field '${field}' must be boolean, got ${typeof value}`,
            severity: 'medium',
            field: field,
          });
        }
        break;

      case 'data':
        if (typeof value !== 'object' || value === null) {
          result.issues.push({
            type: 'invalid_field_type',
            message: `Field '${field}' must be object, got ${typeof value}`,
            severity: 'high',
            field: field,
          });
        }
        break;

      case 'metadata':
        if (typeof value !== 'object' || value === null) {
          result.issues.push({
            type: 'invalid_field_type',
            message: `Field '${field}' must be object, got ${typeof value}`,
            severity: 'medium',
            field: field,
          });
        }
        break;
    }
  }

  /**
   * Validate specific data fields
   */
  async validateDataField(dataObj, field, result) {
    const value = dataObj[field];

    switch (field) {
      case 'id':
        if (typeof value !== 'string' || value.length === 0) {
          result.issues.push({
            type: 'invalid_data_field',
            message: `Data field '${field}' must be non-empty string`,
            severity: 'high',
            field: `data.${field}`,
          });
        }
        break;

      case 'title':
        if (typeof value !== 'string' || value.length < 1) {
          result.issues.push({
            type: 'invalid_data_field',
            message: `Data field '${field}' must be string with length >= 1`,
            severity: 'high',
            field: `data.${field}`,
          });
        }
        break;

      case 'description':
        if (typeof value !== 'string' || value.length < 10) {
          result.issues.push({
            type: 'invalid_data_field',
            message: `Data field '${field}' must be string with length >= 10`,
            severity: 'medium',
            field: `data.${field}`,
          });
        }
        break;

      case 'scenes':
        if (!Array.isArray(value)) {
          result.issues.push({
            type: 'invalid_data_field',
            message: `Data field '${field}' must be array`,
            severity: 'high',
            field: `data.${field}`,
          });
        }
        break;
    }
  }

  /**
   * Validate metadata fields
   */
  async validateMetadataField(metadata, field, result) {
    const value = metadata[field];

    switch (field) {
      case 'processingTime':
        if (typeof value !== 'number' || value < 0) {
          result.issues.push({
            type: 'invalid_metadata_field',
            message: `Metadata field '${field}' must be non-negative number`,
            severity: 'low',
            field: `metadata.${field}`,
          });
        }
        break;

      case 'confidence':
        if (typeof value !== 'number' || value < 0 || value > 1) {
          result.issues.push({
            type: 'invalid_metadata_field',
            message: `Metadata field '${field}' must be number between 0 and 1`,
            severity: 'low',
            field: `metadata.${field}`,
          });
        }
        break;

      case 'cacheHit':
        if (typeof value !== 'boolean') {
          result.issues.push({
            type: 'invalid_metadata_field',
            message: `Metadata field '${field}' must be boolean`,
            severity: 'low',
            field: `metadata.${field}`,
          });
        }
        break;

      case 'tokens':
        if (typeof value !== 'object' || value === null) {
          result.issues.push({
            type: 'invalid_metadata_field',
            message: `Metadata field '${field}' must be object`,
            severity: 'low',
            field: `metadata.${field}`,
          });
        } else {
          // Validate token fields
          const tokenFields = ['input', 'output', 'total'];
          for (const tokenField of tokenFields) {
            if (
              typeof value[tokenField] !== 'number' ||
              value[tokenField] < 0
            ) {
              result.issues.push({
                type: 'invalid_token_field',
                message: `Token field '${tokenField}' must be non-negative number`,
                severity: 'low',
                field: `metadata.${field}.${tokenField}`,
              });
            }
          }
        }
        break;
    }
  }

  /**
   * Calculate field coverage
   */
  calculateFieldCoverage(data, result) {
    let totalFields = 0;
    let presentFields = 0;

    // Count top-level fields
    totalFields += this.config.integrity.requiredFields.length;
    presentFields += result.details.topLevel?.present?.length || 0;

    // Count data fields
    if (data && data.data) {
      totalFields += this.config.integrity.dataFields.length;
      presentFields += result.details.dataFields?.present?.length || 0;
    }

    // Count metadata fields
    if (data && data.metadata) {
      totalFields += this.config.integrity.metadataFields.length;
      presentFields += result.details.metadataFields?.present?.length || 0;
    }

    return totalFields > 0 ? presentFields / totalFields : 0;
  }

  /**
   * Calculate overall integrity score
   */
  calculateIntegrityScore(result) {
    let score = 0;
    let totalWeight = 0;

    // Weight by severity of issues
    const severityWeights = { high: 1.0, medium: 0.6, low: 0.3 };
    let penaltyScore = 0;

    for (const issue of result.issues) {
      const weight = severityWeights[issue.severity] || 0.5;
      penaltyScore += weight;
      totalWeight += 1;
    }

    // Base score from coverage
    const coverageScore = result.coverage || 0;

    // Apply penalties
    const maxPenalty = Math.min(penaltyScore * 0.1, 0.5); // Max 50% penalty
    score = Math.max(0, coverageScore - maxPenalty);

    return score;
  }

  /**
   * Generate detailed integrity report
   */
  generateIntegrityReport(validationResult) {
    return {
      timestamp: new Date().toISOString(),
      valid: validationResult.valid,
      integrityScore: validationResult.integrityScore,
      coverage: validationResult.coverage,
      summary: {
        totalIssues: validationResult.issues.length,
        highSeverityIssues: validationResult.issues.filter(
          (i) => i.severity === 'high'
        ).length,
        mediumSeverityIssues: validationResult.issues.filter(
          (i) => i.severity === 'medium'
        ).length,
        lowSeverityIssues: validationResult.issues.filter(
          (i) => i.severity === 'low'
        ).length,
      },
      details: validationResult.details,
      issues: validationResult.issues,
      recommendations: this.generateRecommendations(validationResult),
    };
  }

  /**
   * Generate recommendations based on validation results
   */
  generateRecommendations(validationResult) {
    const recommendations = [];

    // Check for missing critical fields
    const highSeverityIssues = validationResult.issues.filter(
      (i) => i.severity === 'high'
    );
    if (highSeverityIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'critical_fields',
        message: 'Fix missing critical fields to ensure basic functionality',
        actions: highSeverityIssues.map(
          (issue) => `Add missing field: ${issue.field}`
        ),
      });
    }

    // Check coverage
    if (validationResult.coverage < 0.8) {
      recommendations.push({
        priority: 'medium',
        category: 'field_coverage',
        message: 'Improve field coverage to meet minimum requirements',
        actions: [
          'Add missing optional fields',
          'Ensure all required fields are present',
        ],
      });
    }

    // Check data structure consistency
    const structureIssues = validationResult.issues.filter(
      (i) => i.type.includes('invalid_') || i.type.includes('missing_')
    );
    if (structureIssues.length > 5) {
      recommendations.push({
        priority: 'medium',
        category: 'structure_consistency',
        message:
          'Multiple structure issues detected - consider data validation improvements',
        actions: [
          'Review data generation logic',
          'Add structure validation before processing',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Get validation metrics
   */
  getValidationMetrics() {
    const successRate =
      this.metrics.totalValidations > 0
        ? (this.metrics.passedValidations / this.metrics.totalValidations) * 100
        : 0;

    return {
      totalValidations: this.metrics.totalValidations,
      passedValidations: this.metrics.passedValidations,
      failedValidations: this.metrics.failedValidations,
      successRate,
      integrityIssues: { ...this.metrics.integrityIssues },
      fieldCoverage: { ...this.metrics.fieldCoverage },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      integrityIssues: {},
      fieldCoverage: {},
    };
  }
}

module.exports = DataStructureValidator;
