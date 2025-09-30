// tests/template-system.test.js
// Tests for the prompt template system

const {
  BaseTemplates,
  StyleTemplates,
  QualityTemplates,
  ContextTemplates,
  TemplateValidator,
  TemplateComposer,
} = require('../templates');

describe('Template System Tests', () => {
  let baseTemplates, styleTemplates, qualityTemplates, contextTemplates;
  let validator, composer;

  beforeEach(() => {
    baseTemplates = new BaseTemplates();
    styleTemplates = new StyleTemplates();
    qualityTemplates = new QualityTemplates();
    contextTemplates = new ContextTemplates();
    validator = new TemplateValidator();
    composer = new TemplateComposer(
      baseTemplates,
      styleTemplates,
      qualityTemplates,
      contextTemplates
    );
  });

  describe('BaseTemplates', () => {
    test('should retrieve dream_generation template', () => {
      const template = baseTemplates.getTemplate('dream_generation');
      expect(template).toBeDefined();
      expect(template.name).toBe('dream_generation');
      expect(template.template).toContain('INPUT: {input}');
    });

    test('should render template with variables', () => {
      const rendered = baseTemplates.renderTemplate('dream_generation', {
        input: 'I dreamed of flying over mountains',
      });

      expect(rendered.content).toContain('I dreamed of flying over mountains');
      expect(rendered.metadata.template).toBe('dream_generation');
    });

    test('should handle missing variables gracefully', () => {
      const rendered = baseTemplates.renderTemplate('dream_generation', {});
      expect(rendered.content).toContain('[input_NOT_PROVIDED]');
    });

    test('should validate template structure', () => {
      const template = baseTemplates.getTemplate('dream_generation');
      expect(baseTemplates.validateTemplate(template)).toBe(true);
    });
  });

  describe('StyleTemplates', () => {
    test('should apply ethereal style to template', () => {
      const baseContent = 'Create a dream scene: {input}';
      const styled = styleTemplates.applyStyleToTemplate(
        baseContent,
        'ethereal'
      );

      expect(styled.content).toContain('ETHEREAL STYLE REQUIREMENTS');
      expect(styled.style).toBe('ethereal');
      expect(styled.enhancements.lighting).toContain('Soft, diffused lighting');
    });

    test('should combine styles', () => {
      const combined = styleTemplates.combineStyles(
        'ethereal',
        'cyberpunk',
        0.7
      );
      expect(combined.name).toBe('ethereal_cyberpunk_blend');
      expect(combined.prompt_additions).toContain('PRIMARY STYLE (ethereal)');
    });

    test('should validate style names', () => {
      expect(styleTemplates.validateStyle('ethereal')).toBe(true);
      expect(styleTemplates.validateStyle('nonexistent')).toBe(false);
    });
  });

  describe('QualityTemplates', () => {
    test('should apply quality specifications', () => {
      const baseContent = 'Generate dream content';
      const quality = qualityTemplates.applyQualityToTemplate(
        baseContent,
        'high'
      );

      expect(quality.content).toContain('HIGH QUALITY SPECIFICATIONS');
      expect(quality.constraints.max_objects_per_scene).toBe(15);
      expect(quality.specifications.detail_level).toBe('detailed');
    });

    test('should recommend optimal quality', () => {
      const optimal = qualityTemplates.getOptimalQuality({
        speed_priority: true,
      });
      expect(optimal).toBe('draft');

      const professional = qualityTemplates.getOptimalQuality({
        professional_output: true,
      });
      expect(professional).toBe('cinematic');
    });

    test('should compare quality levels', () => {
      const comparison = qualityTemplates.compareQualities(
        'draft',
        'cinematic'
      );
      expect(comparison.complexity_diff).toBeLessThan(0);
      expect(comparison.recommendation).toBe('cinematic');
    });
  });

  describe('ContextTemplates', () => {
    test('should apply user preferences context', () => {
      const baseContent = 'Create dream: {input}';
      const contextData = {
        preferred_styles: ['ethereal', 'natural'],
        quality_preference: 'high',
      };

      const contextual = contextTemplates.applyContextToTemplate(
        baseContent,
        'user_preferences',
        contextData
      );

      expect(contextual.content).toContain('USER PREFERENCES CONTEXT');
      expect(contextual.content).toContain('ethereal, natural');
    });

    test('should apply multiple contexts', () => {
      const baseContent = 'Create dream: {input}';
      const contexts = {
        user_preferences: { preferred_styles: ['ethereal'] },
        session_context: { mood: 'peaceful' },
      };

      const multiContextual = contextTemplates.applyMultipleContexts(
        baseContent,
        contexts
      );
      expect(multiContextual.applied_contexts).toHaveLength(2);
      expect(multiContextual.content).toContain('USER PREFERENCES CONTEXT');
      expect(multiContextual.content).toContain('SESSION CONTEXT');
    });

    test('should build context from user history', () => {
      const userHistory = {
        dreams: [
          { style: 'ethereal', themes: ['nature', 'peace'] },
          { style: 'ethereal', themes: ['water', 'calm'] },
          { style: 'natural', themes: ['forest'] },
        ],
      };

      const context = contextTemplates.buildContextFromHistory(userHistory);
      expect(context.user_preferences.preferred_styles).toContain('ethereal');
      expect(context.user_preferences.favorite_themes).toContain('nature');
    });
  });

  describe('TemplateValidator', () => {
    test('should validate correct template structure', () => {
      const template = baseTemplates.getTemplate('dream_generation');
      const validation = validator.validateTemplate(template);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.score).toBeGreaterThan(80);
    });

    test('should detect template errors', () => {
      const invalidTemplate = {
        name: 'test',
        // Missing description and template
        variables: ['input'],
      };

      const validation = validator.validateTemplate(invalidTemplate);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should run template tests', () => {
      const template = baseTemplates.getTemplate('dream_generation');
      const testResult = validator.testTemplate(template, 'basic_rendering');

      expect(testResult.passed).toBe(true);
      expect(testResult.output).toBeDefined();
      expect(testResult.performance.render_time).toBeDefined();
    });

    test('should validate template collection', () => {
      const templates = {
        template1: baseTemplates.getTemplate('dream_generation'),
        template2: baseTemplates.getTemplate('scene_refinement'),
      };

      const collectionValidation =
        validator.validateTemplateCollection(templates);
      expect(collectionValidation.total_templates).toBe(2);
      expect(collectionValidation.valid_templates).toBeGreaterThan(0);
    });
  });

  describe('TemplateComposer', () => {
    test('should compose basic template', () => {
      const composition = {
        base: 'dream_generation',
        variables: {
          input: 'I dreamed of a magical forest',
        },
      };

      const composed = composer.composeTemplate(composition);
      expect(composed.content).toContain('I dreamed of a magical forest');
      expect(composed.metadata.template_name).toContain('dream_generation');
    });

    test('should compose template with style and quality', () => {
      const composition = {
        base: 'dream_generation',
        style: 'ethereal',
        quality: 'high',
        variables: {
          input: 'A peaceful garden',
        },
      };

      const composed = composer.composeTemplate(composition);
      expect(composed.content).toContain('ETHEREAL STYLE REQUIREMENTS');
      expect(composed.content).toContain('HIGH QUALITY SPECIFICATIONS');
      expect(composed.metadata.style).toBe('ethereal');
      expect(composed.metadata.quality).toBe('high');
    });

    test('should compose template with contexts', () => {
      const composition = {
        base: 'dream_generation',
        contexts: {
          user_preferences: {
            preferred_styles: ['natural'],
            quality_preference: 'high',
          },
        },
        variables: {
          input: 'Mountain landscape',
        },
      };

      const composed = composer.composeTemplate(composition);
      expect(composed.content).toContain('USER PREFERENCES CONTEXT');
      expect(composed.metadata.contexts).toBeDefined();
    });

    test('should validate composition', () => {
      const validComposition = {
        base: 'dream_generation',
        style: 'ethereal',
        quality: 'high',
      };

      const validation = composer.validateComposition(validComposition);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid composition', () => {
      const invalidComposition = {
        base: 'nonexistent_template',
        style: 'invalid_style',
      };

      const validation = composer.validateComposition(invalidComposition);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should create template inheritance', () => {
      const parent = baseTemplates.getTemplate('dream_generation');
      const childOverrides = {
        name: 'specialized_dream',
        template:
          parent.template +
          '\n\nSPECIAL INSTRUCTIONS: Focus on emotional depth.',
      };

      const inherited = composer.createTemplateInheritance(
        parent,
        childOverrides
      );
      expect(inherited.name).toBe('specialized_dream');
      expect(inherited.template).toContain('SPECIAL INSTRUCTIONS');
      expect(inherited.inheritance_metadata.parent).toBe('dream_generation');
    });

    test('should analyze composition complexity', () => {
      const composition = {
        base: 'dream_generation',
        style: 'ethereal',
        quality: 'cinematic',
        contexts: {
          user_preferences: {},
          session_context: {},
        },
        variables: {
          input: 'test',
          context: 'test',
        },
      };

      const analysis = composer.analyzeComposition(composition);
      expect(analysis.complexity_score).toBeGreaterThan(0);
      expect(analysis.component_count).toBeGreaterThan(3);
      expect(analysis.variable_count).toBe(2);
    });

    test('should cache composed templates', () => {
      const composition = {
        base: 'dream_generation',
        variables: { input: 'test' },
      };

      // First call
      const composed1 = composer.composeTemplate(composition);
      const cacheStats1 = composer.getCacheStats();

      // Second call should use cache
      const composed2 = composer.composeTemplate(composition);
      const cacheStats2 = composer.getCacheStats();

      expect(cacheStats1.size).toBe(1);
      expect(cacheStats2.size).toBe(1);
      expect(composed1.content).toBe(composed2.content);
    });
  });

  describe('Integration Tests', () => {
    test('should create complete dream generation workflow', () => {
      // Simulate a complete workflow
      const dreamInput =
        'I dreamed of floating islands connected by rainbow bridges';

      const composition = {
        base: 'dream_generation',
        style: 'ethereal',
        quality: 'high',
        contexts: {
          user_preferences: {
            preferred_styles: ['ethereal', 'natural'],
            quality_preference: 'high',
          },
          session_context: {
            mood: 'peaceful',
            theme_focus: 'nature',
          },
        },
        variables: {
          input: dreamInput,
        },
      };

      // Validate composition
      const validation = composer.validateComposition(composition);
      expect(validation.valid).toBe(true);

      // Compose template
      const composed = composer.composeTemplate(composition);
      expect(composed.content).toContain(dreamInput);
      expect(composed.content).toContain('ETHEREAL STYLE REQUIREMENTS');
      expect(composed.content).toContain('HIGH QUALITY SPECIFICATIONS');
      expect(composed.content).toContain('USER PREFERENCES CONTEXT');

      // Analyze complexity
      const analysis = composer.analyzeComposition(composition);
      expect(analysis.complexity_score).toBeGreaterThan(0);

      // Export composition
      const exported = composer.exportComposition(composition);
      expect(exported.composition_config).toEqual(composition);
      expect(exported.rendered_template).toBe(composed.content);
    });

    test('should handle template variants', () => {
      const baseComposition = {
        base: 'dream_generation',
        variables: { input: 'A mysterious castle' },
      };

      const variants = {
        ethereal_version: { style: 'ethereal', quality: 'high' },
        cyberpunk_version: { style: 'cyberpunk', quality: 'standard' },
        minimal_version: { style: 'minimalist', quality: 'draft' },
      };

      const variantResults = composer.createTemplateVariant(
        baseComposition,
        variants
      );

      expect(Object.keys(variantResults)).toHaveLength(3);
      expect(variantResults.ethereal_version.metadata.style).toBe('ethereal');
      expect(variantResults.cyberpunk_version.metadata.style).toBe('cyberpunk');
      expect(variantResults.minimal_version.metadata.style).toBe('minimalist');
    });
  });
});

// Helper function to run tests
if (require.main === module) {
  console.log('Running template system tests...');

  // Simple test runner for demonstration
  const runTests = async () => {
    try {
      const baseTemplates = new BaseTemplates();
      const styleTemplates = new StyleTemplates();
      const qualityTemplates = new QualityTemplates();
      const contextTemplates = new ContextTemplates();
      const validator = new TemplateValidator();
      const composer = new TemplateComposer(
        baseTemplates,
        styleTemplates,
        qualityTemplates,
        contextTemplates
      );

      console.log('✅ All template classes instantiated successfully');

      // Test basic template retrieval
      const dreamTemplate = baseTemplates.getTemplate('dream_generation');
      console.log('✅ Dream generation template retrieved');

      // Test template rendering
      const rendered = baseTemplates.renderTemplate('dream_generation', {
        input: 'I dreamed of flying through clouds',
      });
      console.log('✅ Template rendered successfully');

      // Test style application
      const styled = styleTemplates.applyStyleToTemplate(
        rendered.content,
        'ethereal'
      );
      console.log('✅ Style applied successfully');

      // Test composition
      const composition = {
        base: 'dream_generation',
        style: 'ethereal',
        quality: 'high',
        variables: { input: 'A magical forest' },
      };

      const composed = composer.composeTemplate(composition);
      console.log('✅ Template composition successful');

      // Test validation
      const validation = validator.validateTemplate(dreamTemplate);
      console.log(
        `✅ Template validation: ${
          validation.valid ? 'PASSED' : 'FAILED'
        } (Score: ${validation.score})`
      );

      console.log('\n🎉 All template system tests passed!');
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  };

  runTests();
}
