// templates/TemplateComposer.js
// Template inheritance and composition system for complex prompts

class TemplateComposer {
  constructor(
    baseTemplates,
    styleTemplates,
    qualityTemplates,
    contextTemplates
  ) {
    this.baseTemplates = baseTemplates;
    this.styleTemplates = styleTemplates;
    this.qualityTemplates = qualityTemplates;
    this.contextTemplates = contextTemplates;

    this.compositionCache = new Map();
    this.inheritanceRules = {
      base: { priority: 1, required: true },
      style: { priority: 2, required: false },
      quality: { priority: 3, required: false },
      context: { priority: 4, required: false },
    };
  }

  composeTemplate(composition) {
    const {
      base,
      style = null,
      quality = 'standard',
      contexts = {},
      variables = {},
      options = {},
    } = composition;

    // Generate cache key
    const cacheKey = this.generateCacheKey(composition);
    if (this.compositionCache.has(cacheKey) && !options.bypass_cache) {
      return this.compositionCache.get(cacheKey);
    }

    try {
      // Start with base template
      const baseTemplate = this.baseTemplates.getTemplate(base);
      if (!baseTemplate) {
        throw new Error(`Base template '${base}' not found`);
      }

      let composedTemplate = {
        name: `${base}_composed`,
        description: baseTemplate.description,
        template: baseTemplate.template,
        variables: [...(baseTemplate.variables || [])],
        validation: { ...baseTemplate.validation },
        composition_metadata: {
          base,
          style,
          quality,
          contexts: Object.keys(contexts),
          composed_at: new Date().toISOString(),
        },
      };

      // Apply style enhancements
      if (style) {
        composedTemplate = this.applyStyleInheritance(composedTemplate, style);
      }

      // Apply quality specifications
      if (quality) {
        composedTemplate = this.applyQualityInheritance(
          composedTemplate,
          quality
        );
      }

      // Apply context enhancements
      if (Object.keys(contexts).length > 0) {
        composedTemplate = this.applyContextInheritance(
          composedTemplate,
          contexts
        );
      }

      // Render with variables
      const renderedTemplate = this.renderComposedTemplate(
        composedTemplate,
        variables
      );

      // Cache the result
      this.compositionCache.set(cacheKey, renderedTemplate);

      return renderedTemplate;
    } catch (error) {
      throw new Error(`Template composition failed: ${error.message}`);
    }
  }

  applyStyleInheritance(template, styleName) {
    const styleEnhancement = this.styleTemplates.applyStyleToTemplate(
      template.template,
      styleName
    );

    return {
      ...template,
      template: styleEnhancement.content,
      style: styleEnhancement.style,
      style_enhancements: styleEnhancement.enhancements,
      name: `${template.name}_${styleName}`,
      description: `${template.description} with ${styleName} style`,
    };
  }

  applyQualityInheritance(template, qualityName) {
    const qualityEnhancement = this.qualityTemplates.applyQualityToTemplate(
      template.template,
      qualityName
    );

    return {
      ...template,
      template: qualityEnhancement.content,
      quality: qualityEnhancement.quality,
      quality_specifications: qualityEnhancement.specifications,
      quality_constraints: qualityEnhancement.constraints,
      name: `${template.name}_${qualityName}`,
      description: `${template.description} at ${qualityName} quality`,
    };
  }

  applyContextInheritance(template, contexts) {
    const contextEnhancement = this.contextTemplates.applyMultipleContexts(
      template.template,
      contexts
    );

    return {
      ...template,
      template: contextEnhancement.content,
      applied_contexts: contextEnhancement.applied_contexts,
      name: `${template.name}_contextual`,
      description: `${template.description} with contextual enhancements`,
    };
  }

  renderComposedTemplate(template, variables = {}) {
    let rendered = template.template;

    // Merge template variables with provided variables
    const allVariables = { ...variables };

    // Add metadata variables
    if (template.composition_metadata) {
      allVariables.composition_base = template.composition_metadata.base;
      allVariables.composition_style =
        template.composition_metadata.style || 'none';
      allVariables.composition_quality =
        template.composition_metadata.quality || 'standard';
    }

    // Replace variables in the template
    const templateVariables = template.variables || [];
    templateVariables.forEach((variable) => {
      const placeholder = `{${variable}}`;
      const value = allVariables[variable] || `[${variable}_NOT_PROVIDED]`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    });

    return {
      content: rendered,
      metadata: {
        template_name: template.name,
        composition: template.composition_metadata,
        variables_used: templateVariables,
        variables_provided: Object.keys(allVariables),
        style: template.style,
        quality: template.quality,
        contexts: template.applied_contexts,
        rendered_at: new Date().toISOString(),
      },
      validation: template.validation,
      constraints: template.quality_constraints,
    };
  }

  createTemplateInheritance(parentTemplate, childOverrides) {
    const parent =
      typeof parentTemplate === 'string'
        ? this.baseTemplates.getTemplate(parentTemplate)
        : parentTemplate;

    if (!parent) {
      throw new Error('Parent template not found or invalid');
    }

    const inherited = {
      ...parent,
      ...childOverrides,
      name: childOverrides.name || `${parent.name}_inherited`,
      description:
        childOverrides.description || `${parent.description} (inherited)`,
      variables: [
        ...(parent.variables || []),
        ...(childOverrides.variables || []),
      ].filter((v, i, arr) => arr.indexOf(v) === i), // Remove duplicates
      validation: {
        ...parent.validation,
        ...childOverrides.validation,
      },
      inheritance_metadata: {
        parent: parent.name,
        inherited_at: new Date().toISOString(),
        overrides: Object.keys(childOverrides),
      },
    };

    return inherited;
  }

  createTemplateChain(templates) {
    if (!Array.isArray(templates) || templates.length === 0) {
      throw new Error('Template chain must be a non-empty array');
    }

    let chainedTemplate = templates[0];

    for (let i = 1; i < templates.length; i++) {
      chainedTemplate = this.createTemplateInheritance(
        chainedTemplate,
        templates[i]
      );
    }

    chainedTemplate.name = `chained_${templates
      .map((t) => t.name || 'unnamed')
      .join('_')}`;
    chainedTemplate.description = `Chained template from ${templates.length} components`;
    chainedTemplate.chain_metadata = {
      chain_length: templates.length,
      components: templates.map((t) => t.name || 'unnamed'),
      created_at: new Date().toISOString(),
    };

    return chainedTemplate;
  }

  validateComposition(composition) {
    const errors = [];
    const warnings = [];

    // Validate base template
    if (!composition.base) {
      errors.push('Base template is required');
    } else if (!this.baseTemplates.getTemplate(composition.base)) {
      errors.push(`Base template '${composition.base}' not found`);
    }

    // Validate style
    if (
      composition.style &&
      !this.styleTemplates.validateStyle(composition.style)
    ) {
      warnings.push(`Style '${composition.style}' not found, will be ignored`);
    }

    // Validate quality
    if (
      composition.quality &&
      !this.qualityTemplates.validateQualityLevel(composition.quality)
    ) {
      warnings.push(
        `Quality level '${composition.quality}' not found, will use 'standard'`
      );
    }

    // Validate contexts
    if (composition.contexts) {
      Object.keys(composition.contexts).forEach((contextName) => {
        if (
          !this.contextTemplates.validateContext(
            contextName,
            composition.contexts[contextName]
          )
        ) {
          warnings.push(
            `Context '${contextName}' validation failed, will be ignored`
          );
        }
      });
    }

    // Validate variables
    if (composition.variables) {
      Object.keys(composition.variables).forEach((variable) => {
        if (typeof composition.variables[variable] === 'undefined') {
          warnings.push(`Variable '${variable}' is undefined`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  generateCacheKey(composition) {
    const keyComponents = [
      composition.base,
      composition.style || 'no_style',
      composition.quality || 'standard',
      JSON.stringify(composition.contexts || {}),
      JSON.stringify(composition.variables || {}),
    ];

    return keyComponents.join('|');
  }

  clearCache() {
    this.compositionCache.clear();
  }

  getCacheStats() {
    return {
      size: this.compositionCache.size,
      keys: Array.from(this.compositionCache.keys()),
    };
  }

  exportComposition(composition) {
    const composed = this.composeTemplate(composition);

    return {
      composition_config: composition,
      rendered_template: composed.content,
      metadata: composed.metadata,
      export_timestamp: new Date().toISOString(),
      version: '1.0',
    };
  }

  importComposition(exportedComposition) {
    if (!exportedComposition.composition_config) {
      throw new Error(
        'Invalid exported composition: missing composition_config'
      );
    }

    return this.composeTemplate(exportedComposition.composition_config);
  }

  createTemplateVariant(baseComposition, variants) {
    const results = {};

    Object.entries(variants).forEach(([variantName, variantConfig]) => {
      const mergedComposition = {
        ...baseComposition,
        ...variantConfig,
      };

      try {
        results[variantName] = this.composeTemplate(mergedComposition);
      } catch (error) {
        results[variantName] = {
          error: error.message,
          variant_config: variantConfig,
        };
      }
    });

    return results;
  }

  analyzeComposition(composition) {
    const analysis = {
      complexity_score: 0,
      estimated_tokens: 0,
      component_count: 0,
      variable_count: 0,
      recommendations: [],
    };

    // Analyze base template
    const baseTemplate = this.baseTemplates.getTemplate(composition.base);
    if (baseTemplate) {
      analysis.estimated_tokens += baseTemplate.template.length / 4; // Rough token estimate
      analysis.component_count++;
    }

    // Analyze style complexity
    if (composition.style) {
      analysis.complexity_score += 1;
      analysis.component_count++;
    }

    // Analyze quality impact
    if (composition.quality) {
      const qualityConstraints = this.qualityTemplates.getQualityConstraints(
        composition.quality
      );
      if (qualityConstraints) {
        analysis.complexity_score += qualityConstraints.complexity_level || 1;
        analysis.estimated_tokens +=
          (qualityConstraints.max_objects_per_scene || 5) * 10;
      }
      analysis.component_count++;
    }

    // Analyze contexts
    const contextCount = Object.keys(composition.contexts || {}).length;
    analysis.complexity_score += contextCount * 0.5;
    analysis.component_count += contextCount;

    // Analyze variables
    analysis.variable_count = Object.keys(composition.variables || {}).length;

    // Generate recommendations
    if (analysis.complexity_score > 5) {
      analysis.recommendations.push(
        'Consider simplifying the composition for better performance'
      );
    }

    if (analysis.estimated_tokens > 2000) {
      analysis.recommendations.push(
        'High token count detected, consider breaking into smaller templates'
      );
    }

    if (analysis.variable_count > 10) {
      analysis.recommendations.push(
        'Many variables detected, ensure all are necessary'
      );
    }

    return analysis;
  }
}

module.exports = TemplateComposer;
