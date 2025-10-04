// engine/ValidationTestFramework.js
// Test framework for validation pipeline accuracy and baseline requirements

const _ = require('lodash');
const winston = require('winston');

class ValidationTestFramework {
  constructor(options = {}) {
    this.config = _.merge(
      {
        accuracy: {
          baselineThreshold: 0.85,
          regressionTolerance: 0.05,
          minSampleSize: 10,
        },
        repair: {
          effectivenessThreshold: 0.75,
          maxRepairAttempts: 3,
        },
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
        },
        format: {
          consistencyThreshold: 0.9,
          formatRules: [
            'title_length',
            'description_length',
            'scene_structure',
          ],
        },
      },
      options
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

    this.baseline = null;
    this.testResults = [];
  }

  /**
   * Create validation test cases for different scenarios
   */
  createValidationTestCases(scenarios = []) {
    const defaultScenarios = [
      'valid_complete_response',
      'missing_required_fields',
      'invalid_data_types',
      'malformed_scenes',
      'incomplete_content',
      'null_undefined_input',
    ];

    const testScenarios = scenarios.length > 0 ? scenarios : defaultScenarios;
    const testCases = [];

    for (const scenario of testScenarios) {
      const testCase = this.generateTestCase(scenario);
      if (testCase) {
        testCases.push(testCase);
      }
    }

    return testCases;
  }

  /**
   * Generate a specific test case based on scenario
   */
  generateTestCase(scenario) {
    switch (scenario) {
      case 'valid_complete_response':
        return {
          id: 'valid_complete',
          scenario,
          input: {
            success: true,
            data: {
              id: 'test-dream-001',
              title: 'Enchanted Forest Dream',
              description:
                'A mystical forest filled with ancient trees, glowing mushrooms, and ethereal light filtering through the canopy',
              scenes: [
                {
                  id: 'scene-001',
                  description: 'Dense forest with towering oak trees',
                  objects: [{ type: 'tree', position: { x: 0, y: 0, z: 0 } }],
                },
              ],
            },
            metadata: {
              source: 'test-provider',
              model: 'test-model',
              processingTime: 1500,
              quality: 'high',
              tokens: { input: 100, output: 200, total: 300 },
              confidence: 0.95,
              cacheHit: false,
            },
          },
          expectedValid: true,
          expectedErrors: 0,
          expectedWarnings: 0,
        };

      case 'missing_required_fields':
        return {
          id: 'missing_fields',
          scenario,
          input: {
            success: true,
            data: {
              // Missing id, title
              description: 'A garden scene',
              scenes: [],
            },
            // Missing metadata
          },
          expectedValid: false,
          expectedErrors: 3, // id, title, metadata
          expectedWarnings: 1, // empty scenes
        };

      case 'invalid_data_types':
        return {
          id: 'invalid_types',
          scenario,
          input: {
            success: true,
            data: {
              id: 123, // Should be string
              title: 'Valid Title',
              description: 'Valid description',
              scenes: 'not-an-array', // Should be array
            },
            metadata: {
              source: 'test-provider',
              model: 'test-model',
              processingTime: 'invalid', // Should be number
              quality: 'high',
              tokens: { input: 100, output: 200, total: 300 },
              confidence: 0.95,
              cacheHit: false,
            },
          },
          expectedValid: false,
          expectedErrors: 3, // id, scenes, processingTime
          expectedWarnings: 0,
        };

      case 'malformed_scenes':
        return {
          id: 'malformed_scenes',
          scenario,
          input: {
            success: true,
            data: {
              id: 'test-dream-002',
              title: 'Test Dream',
              description: 'Test description',
              scenes: [
                {
                  // Missing id
                  description: 'Scene without id',
                  objects: [
                    { type: 'tree' }, // Missing position
                  ],
                },
              ],
            },
            metadata: {
              source: 'test-provider',
              model: 'test-model',
              processingTime: 1500,
              quality: 'high',
              tokens: { input: 100, output: 200, total: 300 },
              confidence: 0.95,
              cacheHit: false,
            },
          },
          expectedValid: false,
          expectedErrors: 2, // scene id, object position
          expectedWarnings: 0,
        };

      case 'incomplete_content':
        return {
          id: 'incomplete_content',
          scenario,
          input: {
            success: true,
            data: {
              id: 'test-dream-003',
              title: 'Short', // Too short
              description: 'Brief', // Too short
              scenes: [
                {
                  id: 'scene-001',
                  description: 'Vague', // Too short
                  objects: [],
                },
              ],
            },
            metadata: {
              source: 'test-provider',
              model: 'test-model',
              processingTime: 1500,
              quality: 'high',
              tokens: { input: 100, output: 200, total: 300 },
              confidence: 0.2, // Low confidence
              cacheHit: false,
            },
          },
          expectedValid: false,
          expectedErrors: 3, // title, description, scene description length
          expectedWarnings: 2, // low confidence, empty objects
        };

      case 'null_undefined_input':
        return {
          id: 'null_input',
          scenario,
          input: null,
          expectedValid: false,
          expectedErrors: 1,
          expectedWarnings: 0,
        };

      default:
        this.logger.warn(`Unknown test scenario: ${scenario}`);
        return null;
    }
  }

  /**
   * Validate accuracy against baseline requirements
   */
  async validateAccuracy(testCases, validationPipeline) {
    const results = {
      totalTests: testCases.length,
      passedTests: 0,
      failedTests: 0,
      accuracy: 0,
      baseline: this.baseline,
      details: [],
      issues: [],
    };

    for (const testCase of testCases) {
      try {
        const validationResult = await validationPipeline.validateResponse(
          testCase.input,
          'dreamResponse'
        );

        const passed = this.evaluateTestResult(testCase, validationResult);

        if (passed) {
          results.passedTests++;
        } else {
          results.failedTests++;
          results.issues.push({
            testId: testCase.id,
            scenario: testCase.scenario,
            expected: {
              valid: testCase.expectedValid,
              errors: testCase.expectedErrors,
              warnings: testCase.expectedWarnings,
            },
            actual: {
              valid: validationResult.valid,
              errors: validationResult.errors?.length || 0,
              warnings: validationResult.warnings?.length || 0,
            },
          });
        }

        results.details.push({
          testId: testCase.id,
          scenario: testCase.scenario,
          passed,
          processingTime: validationResult.processingTime,
        });
      } catch (error) {
        results.failedTests++;
        results.issues.push({
          testId: testCase.id,
          scenario: testCase.scenario,
          error: error.message,
        });
      }
    }

    results.accuracy =
      results.totalTests > 0 ? results.passedTests / results.totalTests : 0;

    // Check against baseline
    if (
      this.baseline &&
      results.accuracy <
        this.baseline.accuracy - this.config.accuracy.regressionTolerance
    ) {
      results.issues.push({
        type: 'regression',
        message: `Accuracy regression detected: ${results.accuracy.toFixed(
          3
        )} < ${(
          this.baseline.accuracy - this.config.accuracy.regressionTolerance
        ).toFixed(3)}`,
        severity: 'high',
      });
    }

    this.testResults.push({
      timestamp: new Date().toISOString(),
      type: 'accuracy',
      results,
    });

    return results;
  }

  /**
   * Evaluate if a test result matches expectations
   */
  evaluateTestResult(testCase, validationResult) {
    // Check if validation result matches expected validity
    if (validationResult.valid !== testCase.expectedValid) {
      return false;
    }

    // For invalid cases, check error and warning counts
    if (!testCase.expectedValid) {
      const actualErrors = validationResult.errors?.length || 0;
      const actualWarnings = validationResult.warnings?.length || 0;

      // Allow some tolerance in error/warning counts
      const errorTolerance = 1;
      const warningTolerance = 2;

      if (Math.abs(actualErrors - testCase.expectedErrors) > errorTolerance) {
        return false;
      }

      if (
        Math.abs(actualWarnings - testCase.expectedWarnings) > warningTolerance
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create repair test scenarios
   */
  createRepairScenarios(issues = []) {
    const defaultIssues = [
      'missing_required_fields',
      'invalid_data_types',
      'malformed_structure',
      'incomplete_content',
      'format_inconsistency',
    ];

    const repairIssues = issues.length > 0 ? issues : defaultIssues;
    const scenarios = [];

    for (const issue of repairIssues) {
      const scenario = this.generateRepairScenario(issue);
      if (scenario) {
        scenarios.push(scenario);
      }
    }

    return scenarios;
  }

  /**
   * Generate repair scenario for specific issue type
   */
  generateRepairScenario(issueType) {
    switch (issueType) {
      case 'missing_required_fields':
        return {
          id: 'repair_missing_fields',
          issueType,
          brokenContent: {
            success: true,
            data: {
              // Missing id, title
              description: 'A garden scene',
              scenes: [
                {
                  description: 'Garden with flowers',
                  // Missing id, objects
                },
              ],
            },
            // Missing metadata
          },
          expectedRepairSuccess: true,
          expectedFixedFields: [
            'data.id',
            'data.title',
            'data.scenes[0].id',
            'data.scenes[0].objects',
            'metadata',
          ],
        };

      case 'invalid_data_types':
        return {
          id: 'repair_invalid_types',
          issueType,
          brokenContent: {
            success: true,
            data: {
              id: 123, // Should be string
              title: 'Valid Title',
              description: 'Valid description',
              scenes: 'not-an-array', // Should be array
            },
            metadata: {
              source: 'test-provider',
              model: 'test-model',
              processingTime: 'invalid', // Should be number
              quality: 'high',
              tokens: { input: 100, output: 200, total: 300 },
              confidence: 0.95,
              cacheHit: false,
            },
          },
          expectedRepairSuccess: true,
          expectedFixedFields: [
            'data.id',
            'data.scenes',
            'metadata.processingTime',
          ],
        };

      case 'malformed_structure':
        return {
          id: 'repair_malformed_structure',
          issueType,
          brokenContent: {
            success: true,
            data: {
              id: 'test-dream',
              title: 'Test Dream',
              description: 'Test description',
              scenes: [
                {
                  id: 'scene-001',
                  description: 'Test scene',
                  objects: [
                    { type: 'tree' }, // Missing position
                    { position: { x: 1, y: 0, z: 1 } }, // Missing type
                  ],
                },
              ],
            },
            metadata: {
              source: 'test-provider',
              model: 'test-model',
              processingTime: 1500,
              quality: 'high',
              tokens: { input: 100, output: 200, total: 300 },
              confidence: 0.95,
              cacheHit: false,
            },
          },
          expectedRepairSuccess: true,
          expectedFixedFields: [
            'data.scenes[0].objects[0].position',
            'data.scenes[0].objects[1].type',
          ],
        };

      default:
        return null;
    }
  }

  /**
   * Test repair effectiveness
   */
  async testRepairEffectiveness(scenarios, validationPipeline) {
    const results = {
      totalScenarios: scenarios.length,
      successfulRepairs: 0,
      failedRepairs: 0,
      effectiveness: 0,
      details: [],
      issues: [],
    };

    for (const scenario of scenarios) {
      try {
        // First validate to get errors
        const initialValidation = await validationPipeline.validateResponse(
          scenario.brokenContent,
          'dreamResponse'
        );

        // Attempt repair
        const repairResult = await validationPipeline.repairContent(
          scenario.brokenContent,
          initialValidation.errors || []
        );

        // Validate repaired content
        let repairedValidation = null;
        if (repairResult.success && repairResult.repairedContent) {
          repairedValidation = await validationPipeline.validateResponse(
            repairResult.repairedContent,
            'dreamResponse'
          );
        }

        const repairSuccessful = this.evaluateRepairResult(
          scenario,
          repairResult,
          repairedValidation
        );

        if (repairSuccessful) {
          results.successfulRepairs++;
        } else {
          results.failedRepairs++;
          results.issues.push({
            scenarioId: scenario.id,
            issueType: scenario.issueType,
            repairSuccess: repairResult.success,
            repairedValid: repairedValidation?.valid || false,
            expectedSuccess: scenario.expectedRepairSuccess,
          });
        }

        results.details.push({
          scenarioId: scenario.id,
          issueType: scenario.issueType,
          repairSuccessful,
          initialErrors: initialValidation.errors?.length || 0,
          finalErrors: repairedValidation?.errors?.length || 0,
          processingTime: repairResult.processingTime,
        });
      } catch (error) {
        results.failedRepairs++;
        results.issues.push({
          scenarioId: scenario.id,
          issueType: scenario.issueType,
          error: error.message,
        });
      }
    }

    results.effectiveness =
      results.totalScenarios > 0
        ? results.successfulRepairs / results.totalScenarios
        : 0;

    this.testResults.push({
      timestamp: new Date().toISOString(),
      type: 'repair_effectiveness',
      results,
    });

    return results;
  }

  /**
   * Evaluate repair result against expectations
   */
  evaluateRepairResult(scenario, repairResult, repairedValidation) {
    // Check if repair success matches expectation
    if (repairResult.success !== scenario.expectedRepairSuccess) {
      return false;
    }

    // If repair was expected to succeed, check if repaired content is valid
    if (scenario.expectedRepairSuccess) {
      if (!repairedValidation || !repairedValidation.valid) {
        return false;
      }

      // Check if expected fields were fixed (basic check)
      if (scenario.expectedFixedFields && repairResult.repairedContent) {
        for (const fieldPath of scenario.expectedFixedFields) {
          if (!this.checkFieldExists(repairResult.repairedContent, fieldPath)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Check if a field exists at the given path
   */
  checkFieldExists(obj, path) {
    try {
      return _.get(obj, path) !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate data structure integrity using DataStructureValidator
   */
  async validateDataStructure(
    data,
    schema = 'dreamResponse',
    validationPipeline = null
  ) {
    if (
      validationPipeline &&
      validationPipeline.validateDataStructureIntegrity
    ) {
      // Use ValidationPipeline's data structure validator
      return await validationPipeline.validateDataStructureIntegrity(
        data,
        schema
      );
    }

    // Fallback to basic validation
    const results = {
      valid: true,
      issues: [],
      coverage: 0,
      details: {},
      integrityScore: 0,
    };

    if (schema === 'dreamResponse') {
      // Check required top-level fields
      const requiredFields = this.config.integrity.requiredFields;
      const presentFields = requiredFields.filter(
        (field) => data && data[field] !== undefined
      );

      results.coverage = presentFields.length / requiredFields.length;
      results.details.topLevel = {
        required: requiredFields,
        present: presentFields,
        missing: requiredFields.filter(
          (field) => !presentFields.includes(field)
        ),
      };

      // Check data fields
      if (data && data.data) {
        const dataFields = this.config.integrity.dataFields;
        const presentDataFields = dataFields.filter(
          (field) => data.data[field] !== undefined
        );

        results.details.dataFields = {
          required: dataFields,
          present: presentDataFields,
          missing: dataFields.filter(
            (field) => !presentDataFields.includes(field)
          ),
        };
      }

      // Check metadata fields
      if (data && data.metadata) {
        const metadataFields = this.config.integrity.metadataFields;
        const presentMetadataFields = metadataFields.filter(
          (field) => data.metadata[field] !== undefined
        );

        results.details.metadataFields = {
          required: metadataFields,
          present: presentMetadataFields,
          missing: metadataFields.filter(
            (field) => !presentMetadataFields.includes(field)
          ),
        };
      }

      // Calculate integrity score
      results.integrityScore = results.coverage;
      results.valid = results.integrityScore >= 0.8; // 80% coverage threshold

      // Add issues for missing critical fields
      if (results.details.topLevel?.missing?.length > 0) {
        results.issues.push({
          type: 'missing_required_fields',
          fields: results.details.topLevel.missing,
          severity: 'high',
        });
      }
    }

    return results;
  }

  /**
   * Check format consistency using FormatConsistencyValidator
   */
  async checkFormatConsistency(content, validationPipeline = null) {
    if (validationPipeline && validationPipeline.validateFormatConsistency) {
      // Use ValidationPipeline's format consistency validator
      return await validationPipeline.validateFormatConsistency(content);
    }

    // Fallback to basic validation
    const results = {
      consistent: true,
      score: 0,
      issues: [],
      details: {},
    };

    if (!content || !content.data) {
      results.consistent = false;
      results.issues.push({
        rule: 'content_structure',
        message: 'Missing content data',
        severity: 'high',
      });
      return results;
    }

    let passedRules = 0;
    const totalRules = this.config.format.formatRules.length;

    // Check title length
    if (this.config.format.formatRules.includes('title_length')) {
      const title = content.data.title;
      if (
        title &&
        typeof title === 'string' &&
        title.length >= 5 &&
        title.length <= 200
      ) {
        passedRules++;
        results.details.title_length = { passed: true, length: title.length };
      } else {
        results.issues.push({
          rule: 'title_length',
          message: `Title length ${
            title?.length || 0
          } is outside acceptable range (5-200)`,
          severity: 'medium',
        });
        results.details.title_length = {
          passed: false,
          length: title?.length || 0,
        };
      }
    }

    // Check description length
    if (this.config.format.formatRules.includes('description_length')) {
      const description = content.data.description;
      if (
        description &&
        typeof description === 'string' &&
        description.length >= 10 &&
        description.length <= 2000
      ) {
        passedRules++;
        results.details.description_length = {
          passed: true,
          length: description.length,
        };
      } else {
        results.issues.push({
          rule: 'description_length',
          message: `Description length ${
            description?.length || 0
          } is outside acceptable range (10-2000)`,
          severity: 'medium',
        });
        results.details.description_length = {
          passed: false,
          length: description?.length || 0,
        };
      }
    }

    // Check scene structure
    if (this.config.format.formatRules.includes('scene_structure')) {
      const scenes = content.data.scenes;
      if (Array.isArray(scenes) && scenes.length > 0) {
        const validScenes = scenes.filter(
          (scene) =>
            scene.id &&
            scene.description &&
            scene.objects &&
            Array.isArray(scene.objects)
        );

        if (validScenes.length === scenes.length) {
          passedRules++;
          results.details.scene_structure = {
            passed: true,
            validScenes: validScenes.length,
            totalScenes: scenes.length,
          };
        } else {
          results.issues.push({
            rule: 'scene_structure',
            message: `${
              scenes.length - validScenes.length
            } scenes have invalid structure`,
            severity: 'medium',
          });
          results.details.scene_structure = {
            passed: false,
            validScenes: validScenes.length,
            totalScenes: scenes.length,
          };
        }
      } else {
        results.issues.push({
          rule: 'scene_structure',
          message: 'No valid scenes found',
          severity: 'high',
        });
        results.details.scene_structure = {
          passed: false,
          validScenes: 0,
          totalScenes: 0,
        };
      }
    }

    results.score = totalRules > 0 ? passedRules / totalRules : 0;
    results.consistent =
      results.score >= this.config.format.consistencyThreshold;

    return results;
  }

  /**
   * Run baseline tests and establish baseline
   */
  async runBaselineTests(validationPipeline) {
    const testCases = this.createValidationTestCases();
    const accuracyResults = await this.validateAccuracy(
      testCases,
      validationPipeline
    );

    const repairScenarios = this.createRepairScenarios();
    const repairResults = await this.testRepairEffectiveness(
      repairScenarios,
      validationPipeline
    );

    this.baseline = {
      timestamp: new Date().toISOString(),
      accuracy: accuracyResults.accuracy,
      repairEffectiveness: repairResults.effectiveness,
      testCaseCount: testCases.length,
      repairScenarioCount: repairScenarios.length,
    };

    return this.baseline;
  }

  /**
   * Compare current results with baseline
   */
  compareWithBaseline(currentResults) {
    if (!this.baseline) {
      return {
        hasBaseline: false,
        message: 'No baseline established for comparison',
      };
    }

    const comparison = {
      hasBaseline: true,
      baseline: this.baseline,
      current: currentResults,
      changes: {},
      regression: false,
      improvement: false,
    };

    // Compare accuracy
    if (currentResults.accuracy !== undefined) {
      const accuracyChange = currentResults.accuracy - this.baseline.accuracy;
      comparison.changes.accuracy = {
        baseline: this.baseline.accuracy,
        current: currentResults.accuracy,
        change: accuracyChange,
        changePercent: (accuracyChange / this.baseline.accuracy) * 100,
      };

      if (accuracyChange < -this.config.accuracy.regressionTolerance) {
        comparison.regression = true;
      } else if (accuracyChange > this.config.accuracy.regressionTolerance) {
        comparison.improvement = true;
      }
    }

    // Compare repair effectiveness
    if (currentResults.effectiveness !== undefined) {
      const effectivenessChange =
        currentResults.effectiveness - this.baseline.repairEffectiveness;
      comparison.changes.repairEffectiveness = {
        baseline: this.baseline.repairEffectiveness,
        current: currentResults.effectiveness,
        change: effectivenessChange,
        changePercent:
          (effectivenessChange / this.baseline.repairEffectiveness) * 100,
      };
    }

    return comparison;
  }

  /**
   * Generate comprehensive validation report
   */
  generateValidationReport() {
    return {
      timestamp: new Date().toISOString(),
      baseline: this.baseline,
      testResults: this.testResults,
      summary: {
        totalTests: this.testResults.length,
        latestAccuracy:
          this.testResults.length > 0
            ? this.testResults[this.testResults.length - 1].results?.accuracy
            : null,
        hasBaseline: !!this.baseline,
        config: this.config,
      },
    };
  }

  /**
   * Reset test results and baseline
   */
  reset() {
    this.baseline = null;
    this.testResults = [];
  }
}

module.exports = ValidationTestFramework;
