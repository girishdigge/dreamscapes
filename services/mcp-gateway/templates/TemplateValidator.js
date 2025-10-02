// templates/TemplateValidator.js
// Template validation and testing framework

class TemplateValidator {
  constructor() {
    this.validationRules = {
      template_structure: {
        required_fields: ['name', 'description', 'template'],
        optional_fields: ['variables', 'validation', 'constraints'],
        field_types: {
          name: 'string',
          description: 'string',
          template: 'string',
          variables: 'array',
          validation: 'object',
          constraints: 'object',
        },
      },
      template_content: {
        min_length: 50,
        max_length: 10000,
        required_sections: ['INSTRUCTIONS', 'OUTPUT'],
        forbidden_patterns: [
          // Remove JSON-breaking patterns since templates may contain JSON examples
        ],
      },
      variable_validation: {
        naming_pattern: /^[a-z_][a-z0-9_]*$/,
        max_variables: 20,
        reserved_names: ['system', 'user'],
      },
    };

    this.testCases = {
      basic_rendering: {
        description: 'Test basic template rendering with variables',
        test_data: {
          input: 'test dream description',
          context: 'test context',
          style: 'ethereal',
        },
      },
      edge_cases: {
        description: 'Test edge cases and error handling',
        test_data: {
          empty_input: '',
          null_values: null,
          undefined_values: undefined,
          special_characters:
            'Test with "quotes" and \'apostrophes\' and {braces}',
        },
      },
      performance: {
        description: 'Test template performance with large inputs',
        test_data: {
          large_input: 'A'.repeat(5000),
          many_variables: Object.fromEntries(
            Array.from({ length: 15 }, (_, i) => [`var_${i}`, `value_${i}`])
          ),
        },
      },
    };
  }

  validateTemplate(template) {
    const errors = [];
    const warnings = [];

    // Validate structure
    const structureValidation = this.validateStructure(template);
    errors.push(...structureValidation.errors);
    warnings.push(...structureValidation.warnings);

    // Validate content
    const contentValidation = this.validateContent(template);
    errors.push(...contentValidation.errors);
    warnings.push(...contentValidation.warnings);

    // Validate variables
    const variableValidation = this.validateVariables(template);
    errors.push(...variableValidation.errors);
    warnings.push(...variableValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateValidationScore(errors, warnings),
    };
  }

  validateStructure(template) {
    const errors = [];
    const warnings = [];
    const rules = this.validationRules.template_structure;

    // Check required fields
    rules.required_fields.forEach((field) => {
      if (!template.hasOwnProperty(field)) {
        errors.push(`Missing required field: ${field}`);
      } else {
        const expectedType = rules.field_types[field];
        const actualValue = template[field];
        let isValidType = false;

        if (expectedType === 'array') {
          isValidType = Array.isArray(actualValue);
        } else {
          isValidType = typeof actualValue === expectedType;
        }

        if (!isValidType) {
          errors.push(
            `Invalid type for field ${field}: expected ${expectedType}, got ${
              Array.isArray(actualValue) ? 'array' : typeof actualValue
            }`
          );
        }
      }
    });

    // Check field types for optional fields
    rules.optional_fields.forEach((field) => {
      if (template.hasOwnProperty(field)) {
        const expectedType = rules.field_types[field];
        const actualValue = template[field];
        let isValidType = false;

        if (expectedType === 'array') {
          isValidType = Array.isArray(actualValue);
        } else {
          isValidType = typeof actualValue === expectedType;
        }

        if (!isValidType) {
          warnings.push(
            `Invalid type for optional field ${field}: expected ${expectedType}, got ${
              Array.isArray(actualValue) ? 'array' : typeof actualValue
            }`
          );
        }
      }
    });

    return { errors, warnings };
  }

  validateContent(template) {
    const errors = [];
    const warnings = [];
    const rules = this.validationRules.template_content;

    if (!template.template) return { errors, warnings };

    const content = template.template;

    // Check length
    if (content.length < rules.min_length) {
      warnings.push(
        `Template content is quite short (${content.length} chars, minimum recommended: ${rules.min_length})`
      );
    }
    if (content.length > rules.max_length) {
      errors.push(
        `Template content is too long (${content.length} chars, maximum: ${rules.max_length})`
      );
    }

    // Check required sections
    rules.required_sections.forEach((section) => {
      if (!content.includes(section)) {
        warnings.push(`Template missing recommended section: ${section}`);
      }
    });

    // Check forbidden patterns
    rules.forbidden_patterns.forEach((pattern) => {
      if (pattern.test(content)) {
        errors.push(`Template contains forbidden pattern: ${pattern.source}`);
      }
    });

    // Check variable placeholders (only simple {variable} patterns, not JSON)
    const placeholders = content.match(/\{[a-z_][a-z0-9_]*\}/gi) || [];
    const variables = template.variables || [];

    placeholders.forEach((placeholder) => {
      const varName = placeholder.slice(1, -1);
      if (!variables.includes(varName)) {
        warnings.push(`Template uses undefined variable: ${varName}`);
      }
    });

    variables.forEach((variable) => {
      const placeholder = `{${variable}}`;
      if (!content.includes(placeholder)) {
        warnings.push(
          `Declared variable '${variable}' is not used in template`
        );
      }
    });

    return { errors, warnings };
  }

  validateVariables(template) {
    const errors = [];
    const warnings = [];
    const rules = this.validationRules.variable_validation;

    if (!template.variables) return { errors, warnings };

    const variables = template.variables;

    // Check variable count
    if (variables.length > rules.max_variables) {
      errors.push(
        `Too many variables (${variables.length}, maximum: ${rules.max_variables})`
      );
    }

    // Check variable names
    variables.forEach((variable) => {
      if (!rules.naming_pattern.test(variable)) {
        errors.push(
          `Invalid variable name: ${variable} (must match pattern: ${rules.naming_pattern.source})`
        );
      }

      if (rules.reserved_names.includes(variable)) {
        errors.push(`Variable name '${variable}' is reserved`);
      }
    });

    // Check for duplicates
    const duplicates = variables.filter(
      (item, index) => variables.indexOf(item) !== index
    );
    if (duplicates.length > 0) {
      errors.push(`Duplicate variables found: ${duplicates.join(', ')}`);
    }

    return { errors, warnings };
  }

  calculateValidationScore(errors, warnings) {
    let score = 100;
    score -= errors.length * 20; // Major penalty for errors
    score -= warnings.length * 5; // Minor penalty for warnings
    return Math.max(0, score);
  }

  testTemplate(template, testCase = 'basic_rendering') {
    const testData = this.testCases[testCase];
    if (!testData) {
      throw new Error(`Unknown test case: ${testCase}`);
    }

    const results = {
      test_case: testCase,
      description: testData.description,
      passed: true,
      errors: [],
      warnings: [],
      performance: {},
      output: null,
    };

    try {
      // Validate template first
      const validation = this.validateTemplate(template);
      if (!validation.valid) {
        results.passed = false;
        results.errors.push(...validation.errors);
        results.warnings.push(...validation.warnings);
        return results;
      }

      // Test rendering performance
      const startTime = Date.now();

      // Simulate template rendering
      let rendered = template.template;
      if (template.variables) {
        template.variables.forEach((variable) => {
          const placeholder = `{${variable}}`;
          const value =
            testData.test_data[variable] || `[${variable}_TEST_VALUE]`;
          rendered = rendered.replace(
            new RegExp(placeholder, 'g'),
            String(value)
          );
        });
      }

      const endTime = Date.now();
      results.performance.render_time = endTime - startTime;
      results.output = rendered;

      // Check output quality
      if (rendered.length < 100) {
        results.warnings.push('Rendered output is quite short');
      }

      if (rendered.includes('[') && rendered.includes('_TEST_VALUE]')) {
        results.warnings.push('Some variables were not properly substituted');
      }
    } catch (error) {
      results.passed = false;
      results.errors.push(`Template rendering failed: ${error.message}`);
    }

    return results;
  }

  runAllTests(template) {
    const allResults = {};

    Object.keys(this.testCases).forEach((testCase) => {
      try {
        allResults[testCase] = this.testTemplate(template, testCase);
      } catch (error) {
        allResults[testCase] = {
          test_case: testCase,
          passed: false,
          errors: [error.message],
          warnings: [],
          performance: {},
          output: null,
        };
      }
    });

    // Calculate overall score
    const totalTests = Object.keys(allResults).length;
    const passedTests = Object.values(allResults).filter(
      (result) => result.passed
    ).length;
    const overallScore = Math.round((passedTests / totalTests) * 100);

    return {
      overall_score: overallScore,
      total_tests: totalTests,
      passed_tests: passedTests,
      failed_tests: totalTests - passedTests,
      results: allResults,
    };
  }

  validateTemplateCollection(templates) {
    const results = {
      total_templates: Object.keys(templates).length,
      valid_templates: 0,
      invalid_templates: 0,
      template_results: {},
      collection_warnings: [],
    };

    // Validate each template
    Object.entries(templates).forEach(([name, template]) => {
      const validation = this.validateTemplate(template);
      results.template_results[name] = validation;

      if (validation.valid) {
        results.valid_templates++;
      } else {
        results.invalid_templates++;
      }
    });

    // Check for collection-level issues
    const templateNames = Object.keys(templates);
    const duplicateNames = templateNames.filter(
      (name, index) => templateNames.indexOf(name) !== index
    );

    if (duplicateNames.length > 0) {
      results.collection_warnings.push(
        `Duplicate template names: ${duplicateNames.join(', ')}`
      );
    }

    // Check for naming consistency
    const namingPatterns = templateNames.map((name) => name.split('_').length);
    const inconsistentNaming = new Set(namingPatterns).size > 2;

    if (inconsistentNaming) {
      results.collection_warnings.push(
        'Inconsistent template naming patterns detected'
      );
    }

    return results;
  }

  generateValidationReport(validationResults) {
    let report = '# Template Validation Report\n\n';

    if (validationResults.template_results) {
      // Collection report
      report += `## Collection Summary\n`;
      report += `- Total templates: ${validationResults.total_templates}\n`;
      report += `- Valid templates: ${validationResults.valid_templates}\n`;
      report += `- Invalid templates: ${validationResults.invalid_templates}\n`;
      report += `- Success rate: ${Math.round(
        (validationResults.valid_templates /
          validationResults.total_templates) *
          100
      )}%\n\n`;

      if (validationResults.collection_warnings.length > 0) {
        report += `## Collection Warnings\n`;
        validationResults.collection_warnings.forEach((warning) => {
          report += `- ${warning}\n`;
        });
        report += '\n';
      }

      report += `## Individual Template Results\n`;
      Object.entries(validationResults.template_results).forEach(
        ([name, result]) => {
          report += `### ${name}\n`;
          report += `- Valid: ${result.valid ? '✅' : '❌'}\n`;
          report += `- Score: ${result.score}/100\n`;

          if (result.errors.length > 0) {
            report += `- Errors: ${result.errors.length}\n`;
            result.errors.forEach((error) => (report += `  - ${error}\n`));
          }

          if (result.warnings.length > 0) {
            report += `- Warnings: ${result.warnings.length}\n`;
            result.warnings.forEach(
              (warning) => (report += `  - ${warning}\n`)
            );
          }

          report += '\n';
        }
      );
    } else {
      // Single template report
      report += `## Template Validation\n`;
      report += `- Valid: ${validationResults.valid ? '✅' : '❌'}\n`;
      report += `- Score: ${validationResults.score}/100\n\n`;

      if (validationResults.errors.length > 0) {
        report += `### Errors\n`;
        validationResults.errors.forEach((error) => (report += `- ${error}\n`));
        report += '\n';
      }

      if (validationResults.warnings.length > 0) {
        report += `### Warnings\n`;
        validationResults.warnings.forEach(
          (warning) => (report += `- ${warning}\n`)
        );
        report += '\n';
      }
    }

    return report;
  }
}

module.exports = TemplateValidator;
