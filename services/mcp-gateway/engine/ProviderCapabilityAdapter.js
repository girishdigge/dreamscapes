// engine/ProviderCapabilityAdapter.js
// Dynamic prompt adjustment based on provider capabilities

class ProviderCapabilityAdapter {
  constructor() {
    this.providerProfiles = {
      cerebras: {
        name: 'cerebras',
        model: 'llama-3.3-70b',
        capabilities: {
          max_tokens: 32768,
          context_window: 128000,
          supports_streaming: true,
          supports_json_mode: true,
          supports_function_calling: false,
          optimal_temperature: 0.6,
          optimal_top_p: 0.9,
          max_completion_tokens: 32768,
        },
        strengths: [
          'creative_writing',
          'detailed_descriptions',
          'narrative_flow',
          'imaginative_content',
          'long_form_generation',
          'contextual_understanding',
        ],
        limitations: [
          'complex_reasoning',
          'mathematical_operations',
          'code_generation',
          'factual_accuracy',
          'structured_data_parsing',
        ],
        optimization_strategies: {
          prompt_style: 'narrative_focused',
          instruction_format: 'conversational',
          output_format: 'detailed_descriptive',
          context_handling: 'extensive_context',
          creativity_boost: 'high',
        },
      },
      openai: {
        name: 'openai',
        model: 'gpt-4',
        capabilities: {
          max_tokens: 4096,
          context_window: 8192,
          supports_streaming: true,
          supports_json_mode: true,
          supports_function_calling: true,
          optimal_temperature: 0.7,
          optimal_top_p: 1.0,
          max_completion_tokens: 4096,
        },
        strengths: [
          'structured_output',
          'complex_reasoning',
          'consistency',
          'instruction_following',
          'json_formatting',
          'logical_coherence',
        ],
        limitations: [
          'very_long_content',
          'creative_narrative',
          'token_limitations',
          'context_length',
          'cost_per_token',
        ],
        optimization_strategies: {
          prompt_style: 'structured_precise',
          instruction_format: 'bullet_points',
          output_format: 'json_structured',
          context_handling: 'concise_context',
          creativity_boost: 'medium',
        },
      },
      llama: {
        name: 'llama',
        model: 'llama-2-7b',
        capabilities: {
          max_tokens: 2048,
          context_window: 4096,
          supports_streaming: false,
          supports_json_mode: false,
          supports_function_calling: false,
          optimal_temperature: 0.8,
          optimal_top_p: 0.95,
          max_completion_tokens: 2048,
        },
        strengths: [
          'local_processing',
          'privacy',
          'customization',
          'no_api_costs',
          'offline_capability',
          'consistent_availability',
        ],
        limitations: [
          'output_length',
          'complex_instructions',
          'json_formatting',
          'reasoning_depth',
          'context_understanding',
          'creative_quality',
        ],
        optimization_strategies: {
          prompt_style: 'simple_direct',
          instruction_format: 'numbered_steps',
          output_format: 'plain_text',
          context_handling: 'minimal_context',
          creativity_boost: 'low',
        },
      },
    };

    this.adaptationRules = {
      token_management: {
        cerebras: {
          strategy: 'maximize_detail',
          token_buffer: 1000,
          truncation_method: 'smart_truncation',
        },
        openai: {
          strategy: 'optimize_efficiency',
          token_buffer: 500,
          truncation_method: 'priority_based',
        },
        llama: {
          strategy: 'minimize_length',
          token_buffer: 200,
          truncation_method: 'aggressive_truncation',
        },
      },
      instruction_formatting: {
        cerebras: {
          style: 'narrative',
          structure: 'flowing_paragraphs',
          emphasis: 'creative_language',
          examples: 'detailed_examples',
        },
        openai: {
          style: 'structured',
          structure: 'bullet_points',
          emphasis: 'clear_directives',
          examples: 'concise_examples',
        },
        llama: {
          style: 'simple',
          structure: 'numbered_list',
          emphasis: 'direct_commands',
          examples: 'minimal_examples',
        },
      },
      output_formatting: {
        cerebras: {
          format: 'rich_json',
          validation: 'flexible',
          error_handling: 'graceful_degradation',
          structure_complexity: 'high',
        },
        openai: {
          format: 'strict_json',
          validation: 'schema_enforced',
          error_handling: 'retry_with_correction',
          structure_complexity: 'medium',
        },
        llama: {
          format: 'simple_structure',
          validation: 'basic',
          error_handling: 'fallback_format',
          structure_complexity: 'low',
        },
      },
    };
  }

  adaptPromptForProvider(prompt, provider, options = {}) {
    const profile = this.providerProfiles[provider];
    if (!profile) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    try {
      let adaptedPrompt = prompt;

      // Apply token management
      adaptedPrompt = this.applyTokenManagement(
        adaptedPrompt,
        provider,
        profile
      );

      // Apply instruction formatting
      adaptedPrompt = this.applyInstructionFormatting(
        adaptedPrompt,
        provider,
        profile
      );

      // Apply output formatting requirements
      adaptedPrompt = this.applyOutputFormatting(
        adaptedPrompt,
        provider,
        profile
      );

      // Apply provider-specific optimizations
      adaptedPrompt = this.applyProviderOptimizations(
        adaptedPrompt,
        provider,
        profile
      );

      // Add provider-specific parameters
      const parameters = this.generateProviderParameters(
        provider,
        profile,
        options
      );

      return {
        prompt: adaptedPrompt,
        parameters,
        metadata: {
          original_provider: provider,
          adaptations_applied: this.getAppliedAdaptations(provider),
          estimated_tokens: this.estimateTokenCount(adaptedPrompt),
          optimization_level: this.calculateOptimizationLevel(
            provider,
            options
          ),
          adaptation_timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(`Provider adaptation failed: ${error.message}`);
    }
  }

  applyTokenManagement(prompt, provider, profile) {
    const rules = this.adaptationRules.token_management[provider];
    const maxTokens = profile.capabilities.max_tokens;
    const currentTokens = this.estimateTokenCount(prompt);

    if (currentTokens <= maxTokens - rules.token_buffer) {
      return prompt; // No truncation needed
    }

    switch (rules.truncation_method) {
      case 'smart_truncation':
        return this.smartTruncation(prompt, maxTokens - rules.token_buffer);
      case 'priority_based':
        return this.priorityBasedTruncation(
          prompt,
          maxTokens - rules.token_buffer
        );
      case 'aggressive_truncation':
        return this.aggressiveTruncation(
          prompt,
          maxTokens - rules.token_buffer
        );
      default:
        return this.simpleTruncation(prompt, maxTokens - rules.token_buffer);
    }
  }

  applyInstructionFormatting(prompt, provider, profile) {
    const rules = this.adaptationRules.instruction_formatting[provider];

    switch (rules.style) {
      case 'narrative':
        return this.formatAsNarrative(prompt, rules);
      case 'structured':
        return this.formatAsStructured(prompt, rules);
      case 'simple':
        return this.formatAsSimple(prompt, rules);
      default:
        return prompt;
    }
  }

  applyOutputFormatting(prompt, provider, profile) {
    const rules = this.adaptationRules.output_formatting[provider];

    // Add provider-specific output format instructions
    const outputInstructions = this.generateOutputInstructions(rules, profile);

    return prompt + '\n\n' + outputInstructions;
  }

  applyProviderOptimizations(prompt, provider, profile) {
    const strategies = profile.optimization_strategies;
    let optimizedPrompt = prompt;

    // Apply creativity boost
    if (strategies.creativity_boost === 'high') {
      optimizedPrompt = this.enhanceCreativity(optimizedPrompt);
    } else if (strategies.creativity_boost === 'low') {
      optimizedPrompt = this.reduceCreativity(optimizedPrompt);
    }

    // Apply context handling strategy
    if (strategies.context_handling === 'extensive_context') {
      optimizedPrompt = this.expandContext(optimizedPrompt);
    } else if (strategies.context_handling === 'minimal_context') {
      optimizedPrompt = this.minimizeContext(optimizedPrompt);
    }

    // Apply provider-specific enhancements
    optimizedPrompt = this.applyProviderSpecificEnhancements(
      optimizedPrompt,
      provider,
      profile
    );

    return optimizedPrompt;
  }

  generateProviderParameters(provider, profile, options) {
    const baseParams = {
      temperature: profile.capabilities.optimal_temperature,
      top_p: profile.capabilities.optimal_top_p,
      max_tokens: profile.capabilities.max_completion_tokens,
      stream: profile.capabilities.supports_streaming,
    };

    // Apply provider-specific parameter adjustments
    switch (provider) {
      case 'cerebras':
        return {
          ...baseParams,
          model: profile.model,
          stream: options.streaming !== false,
          temperature:
            options.creativity === 'high' ? 0.8 : baseParams.temperature,
          max_completion_tokens: Math.min(
            baseParams.max_tokens,
            options.max_length || 32768
          ),
        };

      case 'openai':
        return {
          ...baseParams,
          model: profile.model,
          response_format: profile.capabilities.supports_json_mode
            ? { type: 'json_object' }
            : undefined,
          temperature:
            options.creativity === 'low' ? 0.3 : baseParams.temperature,
        };

      case 'llama':
        return {
          ...baseParams,
          temperature:
            options.creativity === 'high' ? 0.9 : baseParams.temperature,
          max_tokens: Math.min(
            baseParams.max_tokens,
            options.max_length || 2048
          ),
          stream: false, // Llama typically doesn't support streaming
        };

      default:
        return baseParams;
    }
  }

  // Token management methods
  smartTruncation(prompt, maxTokens) {
    const sections = this.identifyPromptSections(prompt);
    const priorities = this.assignSectionPriorities(sections);

    let truncatedPrompt = '';
    let currentTokens = 0;

    // Add sections in priority order until token limit
    for (const section of priorities) {
      const sectionTokens = this.estimateTokenCount(section.content);
      if (currentTokens + sectionTokens <= maxTokens) {
        truncatedPrompt += section.content + '\n\n';
        currentTokens += sectionTokens;
      } else {
        // Partially include the section if possible
        const remainingTokens = maxTokens - currentTokens;
        if (remainingTokens > 50) {
          const partialContent = this.truncateSection(
            section.content,
            remainingTokens
          );
          truncatedPrompt += partialContent;
        }
        break;
      }
    }

    return truncatedPrompt.trim();
  }

  priorityBasedTruncation(prompt, maxTokens) {
    // Keep essential sections, remove optional ones
    const essentialSections = this.extractEssentialSections(prompt);
    const optionalSections = this.extractOptionalSections(prompt);

    let result = essentialSections.join('\n\n');
    let currentTokens = this.estimateTokenCount(result);

    // Add optional sections if space allows
    for (const section of optionalSections) {
      const sectionTokens = this.estimateTokenCount(section);
      if (currentTokens + sectionTokens <= maxTokens) {
        result += '\n\n' + section;
        currentTokens += sectionTokens;
      }
    }

    return result;
  }

  aggressiveTruncation(prompt, maxTokens) {
    // Simple character-based truncation with buffer
    const maxChars = maxTokens * 3.5; // Rough chars-to-tokens ratio
    if (prompt.length <= maxChars) return prompt;

    return (
      prompt.substring(0, maxChars - 100) + '\n\n[Content truncated for length]'
    );
  }

  simpleTruncation(prompt, maxTokens) {
    const maxChars = maxTokens * 4; // Conservative chars-to-tokens ratio
    return prompt.length > maxChars ? prompt.substring(0, maxChars) : prompt;
  }

  // Instruction formatting methods
  formatAsNarrative(prompt, rules) {
    // Convert structured instructions to flowing narrative
    let narrative = prompt;

    // Replace bullet points with flowing sentences
    narrative = narrative.replace(/^- /gm, 'Additionally, ');
    narrative = narrative.replace(/^\d+\. /gm, 'Next, ');

    // Add narrative connectors
    narrative = narrative.replace(/\n\n/g, '\n\nFurthermore, ');

    return narrative;
  }

  formatAsStructured(prompt, rules) {
    // Ensure clear structure with bullet points and sections
    let structured = prompt;

    // Add clear section headers
    structured = structured.replace(/^([A-Z][A-Z\s]+):$/gm, '## $1');

    // Ensure bullet points for lists
    structured = structured.replace(/^([^-•\d].*):$/gm, '- $1:');

    return structured;
  }

  formatAsSimple(prompt, rules) {
    // Simplify language and structure
    let simple = prompt;

    // Replace complex words with simpler alternatives
    const simplifications = {
      utilize: 'use',
      implement: 'do',
      generate: 'make',
      sophisticated: 'advanced',
      comprehensive: 'complete',
    };

    Object.entries(simplifications).forEach(([complex, simple_word]) => {
      simple = simple.replace(new RegExp(complex, 'gi'), simple_word);
    });

    // Simplify sentence structure
    simple = simple.replace(/,\s*which\s+/g, '. This ');
    simple = simple.replace(/;\s*/g, '. ');

    return simple;
  }

  generateOutputInstructions(rules, profile) {
    switch (rules.format) {
      case 'rich_json':
        return `OUTPUT FORMAT REQUIREMENTS:
- Generate detailed, well-structured JSON with rich descriptions
- Include all optional fields when relevant
- Use descriptive property names and nested structures
- Ensure JSON is valid but prioritize content richness over strict formatting`;

      case 'strict_json':
        return `OUTPUT FORMAT REQUIREMENTS:
- Generate valid JSON that strictly follows the expected schema
- Include all required fields without exception
- Use consistent property naming and data types
- Validate JSON structure before output`;

      case 'simple_structure':
        return `OUTPUT FORMAT REQUIREMENTS:
- Generate simple, easy-to-parse output
- Use basic key-value pairs when possible
- Avoid complex nested structures
- Focus on essential information only`;

      default:
        return 'Generate output in the most appropriate format for the content.';
    }
  }

  // Provider-specific enhancement methods
  enhanceCreativity(prompt) {
    return (
      prompt +
      `\n\nCREATIVITY ENHANCEMENT:
- Use vivid, imaginative language and descriptions
- Explore unique and unexpected creative directions
- Include rich sensory details and emotional resonance
- Feel free to be innovative and original in your approach`
    );
  }

  reduceCreativity(prompt) {
    return (
      prompt +
      `\n\nFOCUS ON PRECISION:
- Use clear, direct language and descriptions
- Follow established patterns and conventions
- Prioritize accuracy and consistency over creativity
- Maintain a professional, straightforward approach`
    );
  }

  expandContext(prompt) {
    return (
      prompt +
      `\n\nCONTEXT UTILIZATION:
- Draw upon the full context provided to inform your response
- Make connections between different elements in the context
- Use contextual information to enhance depth and relevance
- Consider both explicit and implicit contextual cues`
    );
  }

  minimizeContext(prompt) {
    return (
      prompt +
      `\n\nFOCUS DIRECTIVE:
- Focus primarily on the core request
- Use context sparingly and only when directly relevant
- Keep responses concise and to the point
- Avoid unnecessary elaboration or tangential information`
    );
  }

  applyProviderSpecificEnhancements(prompt, provider, profile) {
    switch (provider) {
      case 'cerebras':
        return (
          prompt +
          `\n\nCEREBRAS OPTIMIZATION:
- Leverage your strength in creative writing and detailed descriptions
- Use your extensive context window to maintain narrative coherence
- Focus on imaginative content generation and storytelling
- Take advantage of your ability to generate long-form, flowing content`
        );

      case 'openai':
        return (
          prompt +
          `\n\nOPENAI OPTIMIZATION:
- Utilize your strength in structured output and logical reasoning
- Ensure consistent formatting and adherence to instructions
- Focus on clear, well-organized responses
- Leverage your JSON mode capabilities for structured data`
        );

      case 'llama':
        return (
          prompt +
          `\n\nLLAMA OPTIMIZATION:
- Keep responses concise due to token limitations
- Focus on essential information and core functionality
- Use simple, direct language and structure
- Prioritize clarity and basic functionality over complexity`
        );

      default:
        return prompt;
    }
  }

  // Utility methods
  estimateTokenCount(text) {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  identifyPromptSections(prompt) {
    // Split prompt into logical sections based on headers and structure
    const sections = [];
    const lines = prompt.split('\n');
    let currentSection = { title: 'Introduction', content: '', priority: 1 };

    for (const line of lines) {
      if (line.match(/^#+\s+/) || line.match(/^[A-Z][A-Z\s]+:$/)) {
        // New section header
        if (currentSection.content.trim()) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.replace(/^#+\s+/, '').replace(/:$/, ''),
          content: line + '\n',
          priority: this.calculateSectionPriority(line),
        };
      } else {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }

    return sections;
  }

  calculateSectionPriority(sectionTitle) {
    const priorities = {
      instructions: 1,
      requirements: 1,
      input: 1,
      output: 1,
      examples: 2,
      context: 2,
      style: 3,
      quality: 3,
      additional: 4,
    };

    const title = sectionTitle.toLowerCase();
    for (const [key, priority] of Object.entries(priorities)) {
      if (title.includes(key)) {
        return priority;
      }
    }

    return 3; // Default priority
  }

  assignSectionPriorities(sections) {
    return sections.sort((a, b) => a.priority - b.priority);
  }

  truncateSection(content, maxTokens) {
    const maxChars = maxTokens * 4;
    if (content.length <= maxChars) return content;

    return content.substring(0, maxChars - 50) + '...\n[Section truncated]';
  }

  extractEssentialSections(prompt) {
    const sections = this.identifyPromptSections(prompt);
    return sections
      .filter((section) => section.priority <= 2)
      .map((section) => section.content);
  }

  extractOptionalSections(prompt) {
    const sections = this.identifyPromptSections(prompt);
    return sections
      .filter((section) => section.priority > 2)
      .map((section) => section.content);
  }

  getAppliedAdaptations(provider) {
    return [
      'token_management',
      'instruction_formatting',
      'output_formatting',
      'provider_optimizations',
    ];
  }

  calculateOptimizationLevel(provider, options) {
    let level = 1;

    if (options.creativity) level += 1;
    if (options.streaming) level += 1;
    if (options.max_length) level += 1;

    const profile = this.providerProfiles[provider];
    if (profile && profile.strengths.length > 4) level += 1;

    return Math.min(5, level);
  }

  getProviderCapabilities(provider) {
    return this.providerProfiles[provider]?.capabilities || null;
  }

  getProviderStrengths(provider) {
    return this.providerProfiles[provider]?.strengths || [];
  }

  getProviderLimitations(provider) {
    return this.providerProfiles[provider]?.limitations || [];
  }

  compareProviders(providers) {
    return providers.map((provider) => ({
      name: provider,
      profile: this.providerProfiles[provider],
      suitability_score: this.calculateSuitabilityScore(provider),
    }));
  }

  calculateSuitabilityScore(provider) {
    const profile = this.providerProfiles[provider];
    if (!profile) return 0;

    let score = 0;
    score += profile.capabilities.max_tokens / 1000; // Token capacity
    score += profile.strengths.length * 2; // Strength count
    score -= profile.limitations.length; // Limitation penalty

    return Math.max(0, score);
  }
}

module.exports = ProviderCapabilityAdapter;
