// engine/FormatConsistencyValidator.js
// Enhanced content format consistency validation

const _ = require('lodash');
const winston = require('winston');

class FormatConsistencyValidator {
  constructor(config = {}) {
    this.config = _.merge(
      {
        format: {
          consistencyThreshold: 0.9,
          formatRules: [
            'title_length',
            'description_length',
            'scene_structure',
            'object_format',
            'metadata_format',
            'field_naming',
            'data_types',
          ],
          requirements: {
            title: {
              minLength: 5,
              maxLength: 200,
              pattern: /^[A-Za-z0-9\s\-_'".!?]+$/,
            },
            description: {
              minLength: 20,
              maxLength: 2000,
              pattern: /^[A-Za-z0-9\s\-_'".!?,;:()]+$/,
            },
            sceneDescription: {
              minLength: 10,
              maxLength: 500,
              pattern: /^[A-Za-z0-9\s\-_'".!?,;:()]+$/,
            },
            id: { pattern: /^[a-zA-Z0-9\-_]+$/, minLength: 1 },
            uuid: {
              pattern:
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            },
          },
        },
        validation: {
          strictMode: false,
          allowEmptyOptionalFields: true,
          validateFieldNaming: true,
          validateDataTypes: true,
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
      formatIssuesByType: {},
      consistencyScores: [],
    };
  }

  /**
   * Validate content format consistency
   */
  async validateFormatConsistency(content, options = {}) {
    this.metrics.totalValidations++;

    const startTime = Date.now();
    const result = {
      consistent: true,
      score: 0,
      issues: [],
      details: {},
      processingTime: 0,
      ruleResults: {},
    };

    try {
      if (!content || typeof content !== 'object') {
        result.consistent = false;
        result.issues.push({
          rule: 'content_structure',
          message: 'Content must be a valid object',
          severity: 'high',
          field: 'content',
        });
        result.processingTime = Date.now() - startTime;
        return result;
      }

      // Run all format rules
      for (const ruleName of this.config.format.formatRules) {
        const ruleMethod = this.getRuleMethod(ruleName);
        if (ruleMethod) {
          try {
            const ruleResult = await ruleMethod.call(this, content, options);
            result.ruleResults[ruleName] = ruleResult;

            if (!ruleResult.passed) {
              result.issues.push(...ruleResult.issues);
            }
          } catch (error) {
            result.issues.push({
              rule: ruleName,
              message: `Rule validation failed: ${error.message}`,
              severity: 'medium',
              field: 'system',
            });
          }
        }
      }

      // Calculate overall consistency score
      result.score = this.calculateConsistencyScore(result.ruleResults);
      result.consistent =
        result.score >= this.config.format.consistencyThreshold;

      // Track metrics
      this.metrics.consistencyScores.push(result.score);
      if (result.consistent) {
        this.metrics.passedValidations++;
      } else {
        this.metrics.failedValidations++;
      }

      // Track issues by type
      for (const issue of result.issues) {
        this.metrics.formatIssuesByType[issue.rule] =
          (this.metrics.formatIssuesByType[issue.rule] || 0) + 1;
      }

      result.processingTime = Date.now() - startTime;

      this.logger.info('Format consistency validation completed', {
        consistent: result.consistent,
        score: result.score,
        issueCount: result.issues.length,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      result.consistent = false;
      result.issues.push({
        rule: 'validation_system',
        message: `Format validation failed: ${error.message}`,
        severity: 'high',
        field: 'system',
      });
      result.processingTime = Date.now() - startTime;

      this.logger.error('Format consistency validation failed', {
        error: error.message,
        stack: error.stack,
      });

      return result;
    }
  }

  /**
   * Get rule method by name
   */
  getRuleMethod(ruleName) {
    const methodMap = {
      title_length: this.validateTitleLength,
      description_length: this.validateDescriptionLength,
      scene_structure: this.validateSceneStructure,
      object_format: this.validateObjectFormat,
      metadata_format: this.validateMetadataFormat,
      field_naming: this.validateFieldNaming,
      data_types: this.validateDataTypes,
    };

    return methodMap[ruleName];
  }

  /**
   * Validate title length and format
   */
  async validateTitleLength(content, options = {}) {
    const result = { passed: true, issues: [], details: {} };

    if (!content.data?.title) {
      result.passed = false;
      result.issues.push({
        rule: 'title_length',
        message: 'Title is missing',
        severity: 'high',
        field: 'data.title',
      });
      return result;
    }

    const title = content.data.title;
    const requirements = this.config.format.requirements.title;

    // Check length
    if (
      title.length < requirements.minLength ||
      title.length > requirements.maxLength
    ) {
      result.passed = false;
      result.issues.push({
        rule: 'title_length',
        message: `Title length ${title.length} is outside acceptable range (${requirements.minLength}-${requirements.maxLength})`,
        severity: 'medium',
        field: 'data.title',
      });
    }

    // Check pattern
    if (!requirements.pattern.test(title)) {
      result.passed = false;
      result.issues.push({
        rule: 'title_length',
        message: 'Title contains invalid characters',
        severity: 'medium',
        field: 'data.title',
      });
    }

    result.details = {
      length: title.length,
      minLength: requirements.minLength,
      maxLength: requirements.maxLength,
      patternValid: requirements.pattern.test(title),
    };

    return result;
  }

  /**
   * Validate description length and format
   */
  async validateDescriptionLength(content, options = {}) {
    const result = { passed: true, issues: [], details: {} };

    if (!content.data?.description) {
      result.passed = false;
      result.issues.push({
        rule: 'description_length',
        message: 'Description is missing',
        severity: 'high',
        field: 'data.description',
      });
      return result;
    }

    const description = content.data.description;
    const requirements = this.config.format.requirements.description;

    // Check length
    if (
      description.length < requirements.minLength ||
      description.length > requirements.maxLength
    ) {
      result.passed = false;
      result.issues.push({
        rule: 'description_length',
        message: `Description length ${description.length} is outside acceptable range (${requirements.minLength}-${requirements.maxLength})`,
        severity: 'medium',
        field: 'data.description',
      });
    }

    // Check pattern
    if (!requirements.pattern.test(description)) {
      result.passed = false;
      result.issues.push({
        rule: 'description_length',
        message: 'Description contains invalid characters',
        severity: 'low',
        field: 'data.description',
      });
    }

    result.details = {
      length: description.length,
      minLength: requirements.minLength,
      maxLength: requirements.maxLength,
      patternValid: requirements.pattern.test(description),
    };

    return result;
  }

  /**
   * Validate scene structure consistency
   */
  async validateSceneStructure(content, options = {}) {
    const result = { passed: true, issues: [], details: {} };

    if (!content.data?.scenes || !Array.isArray(content.data.scenes)) {
      result.passed = false;
      result.issues.push({
        rule: 'scene_structure',
        message: 'Scenes must be an array',
        severity: 'high',
        field: 'data.scenes',
      });
      return result;
    }

    const scenes = content.data.scenes;
    const sceneRequirements = this.config.format.requirements.sceneDescription;
    const idRequirements = this.config.format.requirements.id;

    let validScenes = 0;
    const sceneDetails = [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneDetail = { index: i, valid: true, issues: [] };

      // Check scene ID
      if (!scene.id) {
        sceneDetail.valid = false;
        sceneDetail.issues.push('Missing scene ID');
        result.issues.push({
          rule: 'scene_structure',
          message: `Scene ${i} missing ID`,
          severity: 'medium',
          field: `data.scenes[${i}].id`,
        });
      } else if (!idRequirements.pattern.test(scene.id)) {
        sceneDetail.valid = false;
        sceneDetail.issues.push('Invalid scene ID format');
        result.issues.push({
          rule: 'scene_structure',
          message: `Scene ${i} has invalid ID format`,
          severity: 'medium',
          field: `data.scenes[${i}].id`,
        });
      }

      // Check scene description
      if (!scene.description) {
        sceneDetail.valid = false;
        sceneDetail.issues.push('Missing scene description');
        result.issues.push({
          rule: 'scene_structure',
          message: `Scene ${i} missing description`,
          severity: 'medium',
          field: `data.scenes[${i}].description`,
        });
      } else {
        const desc = scene.description;
        if (
          desc.length < sceneRequirements.minLength ||
          desc.length > sceneRequirements.maxLength
        ) {
          sceneDetail.valid = false;
          sceneDetail.issues.push('Invalid description length');
          result.issues.push({
            rule: 'scene_structure',
            message: `Scene ${i} description length ${desc.length} is outside acceptable range`,
            severity: 'low',
            field: `data.scenes[${i}].description`,
          });
        }
      }

      // Check objects array
      if (!Array.isArray(scene.objects)) {
        sceneDetail.valid = false;
        sceneDetail.issues.push('Objects must be an array');
        result.issues.push({
          rule: 'scene_structure',
          message: `Scene ${i} objects must be an array`,
          severity: 'medium',
          field: `data.scenes[${i}].objects`,
        });
      }

      if (sceneDetail.valid) {
        validScenes++;
      }

      sceneDetails.push(sceneDetail);
    }

    result.details = {
      totalScenes: scenes.length,
      validScenes: validScenes,
      sceneDetails: sceneDetails,
    };

    if (validScenes < scenes.length) {
      result.passed = false;
    }

    return result;
  }

  /**
   * Validate object format consistency
   */
  async validateObjectFormat(content, options = {}) {
    const result = { passed: true, issues: [], details: {} };

    if (!content.data?.scenes || !Array.isArray(content.data.scenes)) {
      return result; // Skip if no scenes
    }

    let totalObjects = 0;
    let validObjects = 0;
    const objectDetails = [];

    for (let i = 0; i < content.data.scenes.length; i++) {
      const scene = content.data.scenes[i];

      if (!Array.isArray(scene.objects)) {
        continue; // Skip invalid scenes
      }

      for (let j = 0; j < scene.objects.length; j++) {
        const obj = scene.objects[j];
        totalObjects++;

        const objDetail = {
          sceneIndex: i,
          objectIndex: j,
          valid: true,
          issues: [],
        };

        // Check required type field
        if (!obj.type || typeof obj.type !== 'string') {
          objDetail.valid = false;
          objDetail.issues.push('Missing or invalid type field');
          result.issues.push({
            rule: 'object_format',
            message: `Scene ${i} object ${j} missing or invalid type field`,
            severity: 'medium',
            field: `data.scenes[${i}].objects[${j}].type`,
          });
        }

        // Check position format if present
        if (obj.position) {
          if (!Array.isArray(obj.position) || obj.position.length !== 3) {
            objDetail.valid = false;
            objDetail.issues.push('Invalid position format');
            result.issues.push({
              rule: 'object_format',
              message: `Scene ${i} object ${j} position must be array of 3 numbers`,
              severity: 'low',
              field: `data.scenes[${i}].objects[${j}].position`,
            });
          } else {
            // Check if all position values are numbers
            const invalidPositions = obj.position.filter(
              (p) => typeof p !== 'number'
            );
            if (invalidPositions.length > 0) {
              objDetail.valid = false;
              objDetail.issues.push('Position values must be numbers');
              result.issues.push({
                rule: 'object_format',
                message: `Scene ${i} object ${j} position values must be numbers`,
                severity: 'low',
                field: `data.scenes[${i}].objects[${j}].position`,
              });
            }
          }
        }

        if (objDetail.valid) {
          validObjects++;
        }

        objectDetails.push(objDetail);
      }
    }

    result.details = {
      totalObjects: totalObjects,
      validObjects: validObjects,
      objectDetails: objectDetails,
    };

    if (totalObjects > 0 && validObjects < totalObjects) {
      result.passed = false;
    }

    return result;
  }

  /**
   * Validate metadata format consistency
   */
  async validateMetadataFormat(content, options = {}) {
    const result = { passed: true, issues: [], details: {} };

    if (!content.metadata || typeof content.metadata !== 'object') {
      result.passed = false;
      result.issues.push({
        rule: 'metadata_format',
        message: 'Metadata must be an object',
        severity: 'medium',
        field: 'metadata',
      });
      return result;
    }

    const metadata = content.metadata;
    const requiredFields = [
      'source',
      'model',
      'processingTime',
      'quality',
      'tokens',
      'confidence',
      'cacheHit',
    ];
    const fieldValidation = {};

    for (const field of requiredFields) {
      fieldValidation[field] = { present: false, valid: false, issues: [] };

      if (metadata[field] !== undefined) {
        fieldValidation[field].present = true;

        // Validate field-specific formats
        switch (field) {
          case 'processingTime':
            if (typeof metadata[field] === 'number' && metadata[field] >= 0) {
              fieldValidation[field].valid = true;
            } else {
              fieldValidation[field].issues.push('Must be non-negative number');
            }
            break;

          case 'confidence':
            if (
              typeof metadata[field] === 'number' &&
              metadata[field] >= 0 &&
              metadata[field] <= 1
            ) {
              fieldValidation[field].valid = true;
            } else {
              fieldValidation[field].issues.push(
                'Must be number between 0 and 1'
              );
            }
            break;

          case 'cacheHit':
            if (typeof metadata[field] === 'boolean') {
              fieldValidation[field].valid = true;
            } else {
              fieldValidation[field].issues.push('Must be boolean');
            }
            break;

          case 'tokens':
            if (
              typeof metadata[field] === 'object' &&
              metadata[field] !== null
            ) {
              const tokenFields = ['input', 'output', 'total'];
              let validTokens = true;
              for (const tokenField of tokenFields) {
                if (
                  typeof metadata[field][tokenField] !== 'number' ||
                  metadata[field][tokenField] < 0
                ) {
                  validTokens = false;
                  fieldValidation[field].issues.push(
                    `${tokenField} must be non-negative number`
                  );
                }
              }
              fieldValidation[field].valid = validTokens;
            } else {
              fieldValidation[field].issues.push(
                'Must be object with input, output, total fields'
              );
            }
            break;

          default:
            if (
              typeof metadata[field] === 'string' &&
              metadata[field].length > 0
            ) {
              fieldValidation[field].valid = true;
            } else {
              fieldValidation[field].issues.push('Must be non-empty string');
            }
        }

        // Add issues for invalid fields
        if (!fieldValidation[field].valid) {
          for (const issue of fieldValidation[field].issues) {
            result.issues.push({
              rule: 'metadata_format',
              message: `Metadata field '${field}': ${issue}`,
              severity: 'low',
              field: `metadata.${field}`,
            });
          }
        }
      } else {
        result.issues.push({
          rule: 'metadata_format',
          message: `Missing metadata field: ${field}`,
          severity: 'medium',
          field: `metadata.${field}`,
        });
      }
    }

    result.details = { fieldValidation };

    // Check if any required fields are missing or invalid
    const invalidFields = Object.values(fieldValidation).filter(
      (f) => !f.present || !f.valid
    );
    if (invalidFields.length > 0) {
      result.passed = false;
    }

    return result;
  }

  /**
   * Validate field naming consistency
   */
  async validateFieldNaming(content, options = {}) {
    const result = { passed: true, issues: [], details: {} };

    if (!this.config.validation.validateFieldNaming) {
      return result; // Skip if disabled
    }

    const namingIssues = [];

    // Check for consistent naming patterns
    this.checkObjectNaming(content, '', namingIssues);

    if (namingIssues.length > 0) {
      result.passed = false;
      result.issues.push(
        ...namingIssues.map((issue) => ({
          rule: 'field_naming',
          message: issue.message,
          severity: 'low',
          field: issue.field,
        }))
      );
    }

    result.details = { namingIssues: namingIssues };

    return result;
  }

  /**
   * Validate data types consistency
   */
  async validateDataTypes(content, options = {}) {
    const result = { passed: true, issues: [], details: {} };

    if (!this.config.validation.validateDataTypes) {
      return result; // Skip if disabled
    }

    const typeIssues = [];

    // Check for consistent data types
    this.checkDataTypes(content, '', typeIssues);

    if (typeIssues.length > 0) {
      result.passed = false;
      result.issues.push(
        ...typeIssues.map((issue) => ({
          rule: 'data_types',
          message: issue.message,
          severity: 'medium',
          field: issue.field,
        }))
      );
    }

    result.details = { typeIssues: typeIssues };

    return result;
  }

  /**
   * Check object naming recursively
   */
  checkObjectNaming(obj, path, issues) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;

      // Check naming conventions (camelCase, snake_case, etc.)
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
        issues.push({
          field: fieldPath,
          message: `Field name '${key}' does not follow naming conventions`,
        });
      }

      // Recursively check nested objects
      if (typeof value === 'object' && value !== null) {
        this.checkObjectNaming(value, fieldPath, issues);
      }
    }
  }

  /**
   * Check data types recursively
   */
  checkDataTypes(obj, path, issues) {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;

      // Check for unexpected null/undefined values in required fields
      if (value === null || value === undefined) {
        if (this.isRequiredField(fieldPath)) {
          issues.push({
            field: fieldPath,
            message: `Required field '${key}' is null or undefined`,
          });
        }
      }

      // Check for type consistency in arrays
      if (Array.isArray(value)) {
        const types = new Set(value.map((item) => typeof item));
        if (types.size > 1) {
          issues.push({
            field: fieldPath,
            message: `Array '${key}' contains mixed types: ${Array.from(
              types
            ).join(', ')}`,
          });
        }
      }

      // Recursively check nested objects
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        this.checkDataTypes(value, fieldPath, issues);
      }
    }
  }

  /**
   * Check if field is required
   */
  isRequiredField(fieldPath) {
    const requiredPaths = [
      'success',
      'data',
      'data.id',
      'data.title',
      'data.description',
      'data.scenes',
      'metadata',
      'metadata.source',
      'metadata.model',
    ];

    return requiredPaths.includes(fieldPath);
  }

  /**
   * Calculate overall consistency score
   */
  calculateConsistencyScore(ruleResults) {
    const ruleWeights = {
      title_length: 0.15,
      description_length: 0.15,
      scene_structure: 0.25,
      object_format: 0.2,
      metadata_format: 0.15,
      field_naming: 0.05,
      data_types: 0.05,
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [ruleName, ruleResult] of Object.entries(ruleResults)) {
      const weight = ruleWeights[ruleName] || 0.1;
      const score = ruleResult.passed ? 1 : 0;

      totalScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Generate format consistency report
   */
  generateConsistencyReport(validationResult) {
    return {
      timestamp: new Date().toISOString(),
      consistent: validationResult.consistent,
      score: validationResult.score,
      threshold: this.config.format.consistencyThreshold,
      summary: {
        totalRules: Object.keys(validationResult.ruleResults).length,
        passedRules: Object.values(validationResult.ruleResults).filter(
          (r) => r.passed
        ).length,
        failedRules: Object.values(validationResult.ruleResults).filter(
          (r) => !r.passed
        ).length,
        totalIssues: validationResult.issues.length,
      },
      ruleResults: validationResult.ruleResults,
      issues: validationResult.issues,
      recommendations: this.generateFormatRecommendations(validationResult),
    };
  }

  /**
   * Generate format recommendations
   */
  generateFormatRecommendations(validationResult) {
    const recommendations = [];

    // Check for critical format issues
    const highSeverityIssues = validationResult.issues.filter(
      (i) => i.severity === 'high'
    );
    if (highSeverityIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'critical_format',
        message: 'Fix critical format issues that prevent proper processing',
        actions: highSeverityIssues.map(
          (issue) => `Fix ${issue.field}: ${issue.message}`
        ),
      });
    }

    // Check consistency score
    if (validationResult.score < 0.8) {
      recommendations.push({
        priority: 'medium',
        category: 'format_consistency',
        message: 'Improve format consistency to meet quality standards',
        actions: [
          'Review and standardize field formats',
          'Ensure consistent data types',
          'Validate field naming conventions',
        ],
      });
    }

    // Check for specific rule failures
    const failedRules = Object.entries(validationResult.ruleResults)
      .filter(([_, result]) => !result.passed)
      .map(([ruleName, _]) => ruleName);

    if (failedRules.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'rule_compliance',
        message: 'Address specific format rule failures',
        actions: failedRules.map((rule) => `Fix ${rule} validation issues`),
      });
    }

    return recommendations;
  }

  /**
   * Get validation metrics
   */
  getValidationMetrics() {
    const avgScore =
      this.metrics.consistencyScores.length > 0
        ? this.metrics.consistencyScores.reduce(
            (sum, score) => sum + score,
            0
          ) / this.metrics.consistencyScores.length
        : 0;

    const successRate =
      this.metrics.totalValidations > 0
        ? (this.metrics.passedValidations / this.metrics.totalValidations) * 100
        : 0;

    return {
      totalValidations: this.metrics.totalValidations,
      passedValidations: this.metrics.passedValidations,
      failedValidations: this.metrics.failedValidations,
      successRate,
      averageConsistencyScore: avgScore,
      formatIssuesByType: { ...this.metrics.formatIssuesByType },
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
      formatIssuesByType: {},
      consistencyScores: [],
    };
  }
}

module.exports = FormatConsistencyValidator;
