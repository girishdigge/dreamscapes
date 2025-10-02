// engine/PromptEngine.js
// Context-aware prompt generation engine

const {
  BaseTemplates,
  StyleTemplates,
  QualityTemplates,
  ContextTemplates,
  TemplateComposer,
} = require('../templates');

class PromptEngine {
  constructor(options = {}) {
    this.baseTemplates = new BaseTemplates();
    this.styleTemplates = new StyleTemplates();
    this.qualityTemplates = new QualityTemplates();
    this.contextTemplates = new ContextTemplates();
    this.composer = new TemplateComposer(
      this.baseTemplates,
      this.styleTemplates,
      this.qualityTemplates,
      this.contextTemplates
    );

    this.options = {
      default_quality: 'standard',
      default_style: null,
      enable_caching: true,
      max_context_depth: 5,
      ...options,
    };

    this.providerCapabilities = {
      cerebras: {
        max_tokens: 32768,
        supports_streaming: true,
        supports_json_mode: true,
        optimal_temperature: 0.6,
        strengths: [
          'creative_writing',
          'detailed_descriptions',
          'narrative_flow',
        ],
        limitations: ['complex_reasoning', 'mathematical_operations'],
      },
      openai: {
        max_tokens: 4096,
        supports_streaming: true,
        supports_json_mode: true,
        optimal_temperature: 0.7,
        strengths: ['structured_output', 'complex_reasoning', 'consistency'],
        limitations: ['very_long_content', 'creative_narrative'],
      },
      llama: {
        max_tokens: 2048,
        supports_streaming: false,
        supports_json_mode: false,
        optimal_temperature: 0.8,
        strengths: ['local_processing', 'privacy', 'customization'],
        limitations: [
          'output_length',
          'complex_instructions',
          'json_formatting',
        ],
      },
    };

    this.contextHistory = new Map();
  }

  async buildDreamPrompt(dreamText, style = null, context = {}) {
    // Handle both old and new parameter formats
    let options = {};
    if (typeof style === 'object' && style !== null) {
      // New format: buildDreamPrompt(dreamText, options)
      options = style;
      style = options.style || this.options.default_style;
    } else {
      // Old format: buildDreamPrompt(dreamText, style, context)
      options = {
        style: style || this.options.default_style,
        user_context: context,
        session_context: context.sessionContext || {},
      };
    }

    const {
      quality = this.options.default_quality,
      provider = 'cerebras',
      user_context = {},
      session_context = {},
      cinematography_focus = true,
      video_generation = true,
    } = options;

    try {
      // Build a comprehensive prompt string
      let promptContent = `Generate a detailed dream scene in JSON format for: "${dreamText}"\n\n`;

      // Add style guidance
      if (style) {
        promptContent += `STYLE: ${style}\n`;
        promptContent +=
          this.buildCinematographyGuidance(dreamText, style) + '\n\n';
      }

      // Add context information
      if (user_context && Object.keys(user_context).length > 0) {
        if (user_context.userPreferences) {
          const prefs = user_context.userPreferences;
          if (prefs.mood) promptContent += `Mood: ${prefs.mood}\n`;
          if (prefs.lighting) promptContent += `Lighting: ${prefs.lighting}\n`;
        }
        if (user_context.sessionContext?.theme) {
          promptContent += `Theme: ${user_context.sessionContext.theme}\n`;
        }
      }

      // Add JSON structure requirements
      promptContent += `\nRequired JSON structure:
{
  "title": "Dream title",
  "description": "Detailed description",
  "scenes": [
    {
      "type": "environment",
      "description": "Scene description",
      "mood": "emotional tone",
      "lighting": "lighting description",
      "objects": [{"type": "object_type", "position": {"x": 0, "y": 0, "z": 0}}]
    }
  ],
  "style": "${style || 'ethereal'}"
}

Generate rich, vivid descriptions that capture the dream's essence and emotional impact.`;

      // Store in context history for future reference
      this.updateContextHistory(dreamText, { content: promptContent }, options);

      return promptContent;
    } catch (error) {
      throw new Error(`Dream prompt generation failed: ${error.message}`);
    }
  }

  async buildComprehensiveContext(options) {
    const {
      user_context,
      session_context,
      dream_text,
      provider,
      cinematography_focus,
      video_generation,
    } = options;

    const contexts = {};

    // User preferences context
    if (user_context && Object.keys(user_context).length > 0) {
      contexts.user_preferences = this.enrichUserContext(user_context);
    }

    // Session context
    if (session_context && Object.keys(session_context).length > 0) {
      contexts.session_context = this.enrichSessionContext(session_context);
    }

    // Technical context based on provider capabilities
    contexts.technical_context = this.buildTechnicalContext(provider, {
      cinematography_focus,
      video_generation,
    });

    // Narrative context extracted from dream text
    contexts.narrative_context = await this.extractNarrativeContext(dream_text);

    // Temporal context (current time, season, etc.)
    contexts.temporal_context = this.buildTemporalContext();

    return contexts;
  }

  selectOptimalTemplate(dreamText, options) {
    const { provider, video_generation, cinematography_focus } = options;

    // Analyze dream text complexity
    const complexity = this.analyzeDreamComplexity(dreamText);

    if (video_generation && cinematography_focus) {
      return 'video_generation';
    }

    if (complexity.refinement_needed) {
      return 'scene_refinement';
    }

    return 'dream_generation';
  }

  buildProviderContext(provider) {
    const capabilities = this.providerCapabilities[provider];
    if (!capabilities) return '';

    return `
PROVIDER OPTIMIZATION CONTEXT:
- Provider: ${provider}
- Max tokens: ${capabilities.max_tokens}
- Optimal temperature: ${capabilities.optimal_temperature}
- Strengths: ${capabilities.strengths.join(', ')}
- Streaming support: ${capabilities.supports_streaming ? 'Yes' : 'No'}
- JSON mode: ${capabilities.supports_json_mode ? 'Yes' : 'No'}

Optimize output for this provider's capabilities and strengths.`;
  }

  buildCinematographyGuidance(dreamText, style) {
    const cinematographyRules = {
      ethereal: {
        camera_movement: 'Slow, floating movements with gentle drifts',
        shot_types: 'Wide establishing shots, close-ups on ethereal details',
        transitions: 'Soft dissolves and fade transitions',
        lighting: 'Soft, diffused lighting with gentle color gradients',
      },
      cyberpunk: {
        camera_movement: 'Dynamic, angular movements with quick cuts',
        shot_types: 'Dramatic angles, neon-lit close-ups, urban wide shots',
        transitions: 'Sharp cuts and glitch transitions',
        lighting: 'High contrast neon lighting with deep shadows',
      },
      surreal: {
        camera_movement: 'Impossible movements that defy physics',
        shot_types: 'Unconventional angles, reality-bending perspectives',
        transitions: 'Morphing and reality-distortion transitions',
        lighting: 'Impossible lighting scenarios with multiple sources',
      },
      natural: {
        camera_movement: 'Organic, flowing movements following natural rhythms',
        shot_types: 'Natural perspectives, environmental establishing shots',
        transitions: 'Organic transitions following natural flow',
        lighting: 'Natural lighting with golden hour tones',
      },
    };

    const rules = cinematographyRules[style] || cinematographyRules.natural;

    return `
CINEMATOGRAPHY GUIDANCE:
- Camera Movement: ${rules.camera_movement}
- Shot Types: ${rules.shot_types}
- Transitions: ${rules.transitions}
- Lighting Style: ${rules.lighting}

Create detailed camera instructions that enhance the dream's emotional impact and visual storytelling.`;
  }

  buildVideoSpecifications(quality) {
    const videoSpecs = {
      draft: {
        duration: '15-30 seconds',
        shots: '2-3 key shots',
        effects: 'Basic transitions',
        detail_level: 'Essential elements only',
      },
      standard: {
        duration: '30-60 seconds',
        shots: '4-6 varied shots',
        effects: 'Standard transitions and effects',
        detail_level: 'Balanced detail and performance',
      },
      high: {
        duration: '60-120 seconds',
        shots: '6-10 dynamic shots',
        effects: 'Advanced effects and transitions',
        detail_level: 'Rich visual detail',
      },
      cinematic: {
        duration: '120-300 seconds',
        shots: '10-15 professional shots',
        effects: 'Professional-grade effects and post-processing',
        detail_level: 'Ultra-detailed cinematic quality',
      },
    };

    const specs = videoSpecs[quality] || videoSpecs.standard;

    return `
VIDEO GENERATION SPECIFICATIONS:
- Target Duration: ${specs.duration}
- Shot Count: ${specs.shots}
- Effects Level: ${specs.effects}
- Detail Level: ${specs.detail_level}

Generate video parameters optimized for ${quality} quality output.`;
  }

  enrichUserContext(userContext) {
    return {
      ...userContext,
      context_strength: this.calculateContextStrength(userContext),
      preference_patterns: this.extractPreferencePatterns(userContext),
      adaptation_suggestions: this.generateAdaptationSuggestions(userContext),
    };
  }

  enrichSessionContext(sessionContext) {
    return {
      ...sessionContext,
      session_progression: this.analyzeSessionProgression(sessionContext),
      theme_evolution: this.trackThemeEvolution(sessionContext),
      quality_trends: this.analyzeQualityTrends(sessionContext),
    };
  }

  buildTechnicalContext(provider, options) {
    const capabilities = this.providerCapabilities[provider];

    return {
      platform: 'web',
      performance_level: this.determinePerformanceLevel(provider),
      available_effects: this.getAvailableEffects(provider),
      rendering_level: capabilities?.supports_json_mode
        ? 'advanced'
        : 'standard',
      output_format: 'structured_json',
      provider_optimization: {
        max_tokens: capabilities?.max_tokens || 2048,
        streaming_enabled: capabilities?.supports_streaming || false,
        temperature_optimized: capabilities?.optimal_temperature || 0.7,
      },
    };
  }

  async extractNarrativeContext(dreamText) {
    // Simple narrative analysis - could be enhanced with NLP
    const analysis = {
      emotional_tone: this.detectEmotionalTone(dreamText),
      narrative_elements: this.extractNarrativeElements(dreamText),
      symbolic_content: this.identifySymbolicContent(dreamText),
      scene_complexity: this.analyzeDreamComplexity(dreamText),
      character_presence: this.detectCharacters(dreamText),
    };

    return {
      arc_position: 'standalone',
      characters: analysis.character_presence,
      emotional_arc: analysis.emotional_tone,
      symbols: analysis.symbolic_content,
      themes: analysis.narrative_elements,
      complexity_level: analysis.scene_complexity.level,
    };
  }

  buildTemporalContext() {
    const now = new Date();
    const season = this.getCurrentSeason(now);
    const timeOfDay = this.getTimeOfDay(now);

    return {
      season,
      time_preference: timeOfDay,
      events: this.getCurrentEvents(now),
      weather_mood: this.getWeatherMood(season),
    };
  }

  optimizeForProvider(prompt, provider) {
    const capabilities = this.providerCapabilities[provider];
    if (!capabilities) return prompt;

    let optimizedContent = prompt.content;

    // Token limit optimization
    if (this.estimateTokenCount(optimizedContent) > capabilities.max_tokens) {
      optimizedContent = this.truncateToTokenLimit(
        optimizedContent,
        capabilities.max_tokens
      );
    }

    // Provider-specific optimizations
    switch (provider) {
      case 'cerebras':
        optimizedContent = this.optimizeForCerebras(optimizedContent);
        break;
      case 'openai':
        optimizedContent = this.optimizeForOpenAI(optimizedContent);
        break;
      case 'llama':
        optimizedContent = this.optimizeForLlama(optimizedContent);
        break;
    }

    return {
      ...prompt,
      content: optimizedContent,
      provider_optimizations: {
        provider,
        token_limit_applied:
          this.estimateTokenCount(prompt.content) > capabilities.max_tokens,
        provider_specific_optimizations: true,
      },
    };
  }

  optimizeForCerebras(content) {
    // Cerebras excels at creative, narrative content
    return (
      content +
      `\n\nFOCUS ON CREATIVE NARRATIVE:
- Emphasize vivid, imaginative descriptions
- Use flowing, narrative language
- Create rich sensory details
- Build emotional resonance through storytelling`
    );
  }

  optimizeForOpenAI(content) {
    // OpenAI excels at structured, consistent output
    return (
      content +
      `\n\nFOCUS ON STRUCTURED OUTPUT:
- Ensure consistent JSON formatting
- Maintain logical structure throughout
- Use clear, precise language
- Validate all required fields are present`
    );
  }

  optimizeForLlama(content) {
    // Local Llama models need simpler, more direct instructions
    return (
      content.replace(/\n\n/g, '\n') +
      `\n\nSIMPLIFIED INSTRUCTIONS:
- Keep descriptions concise but vivid
- Use clear, direct language
- Focus on essential elements
- Ensure output is properly formatted JSON`
    );
  }

  // Analysis helper methods
  analyzeDreamComplexity(dreamText) {
    const wordCount = dreamText.split(' ').length;
    const sentenceCount = dreamText.split(/[.!?]+/).length;
    const complexWords = dreamText
      .split(' ')
      .filter((word) => word.length > 6).length;

    const complexity = {
      word_count: wordCount,
      sentence_count: sentenceCount,
      complex_words: complexWords,
      level: wordCount > 50 ? 'high' : wordCount > 20 ? 'medium' : 'low',
      refinement_needed: wordCount < 10 || sentenceCount < 2,
    };

    return complexity;
  }

  detectEmotionalTone(text) {
    const emotionalWords = {
      positive: [
        'beautiful',
        'peaceful',
        'joy',
        'happy',
        'wonderful',
        'amazing',
        'bright',
      ],
      negative: [
        'dark',
        'scary',
        'fear',
        'nightmare',
        'terrible',
        'sad',
        'lost',
      ],
      neutral: ['walking', 'seeing', 'moving', 'looking', 'going', 'standing'],
    };

    const words = text.toLowerCase().split(/\W+/);
    let positiveCount = 0,
      negativeCount = 0,
      neutralCount = 0;

    words.forEach((word) => {
      if (emotionalWords.positive.includes(word)) positiveCount++;
      else if (emotionalWords.negative.includes(word)) negativeCount++;
      else if (emotionalWords.neutral.includes(word)) neutralCount++;
    });

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  extractNarrativeElements(text) {
    const elements = [];
    const patterns = {
      nature: /\b(tree|forest|mountain|ocean|sky|cloud|flower|garden)\b/gi,
      architecture: /\b(building|house|castle|bridge|tower|city|room)\b/gi,
      movement: /\b(flying|walking|running|floating|swimming|climbing)\b/gi,
      fantasy: /\b(magic|dragon|fairy|wizard|spell|enchanted|mystical)\b/gi,
    };

    Object.entries(patterns).forEach(([element, pattern]) => {
      if (pattern.test(text)) {
        elements.push(element);
      }
    });

    return elements;
  }

  identifySymbolicContent(text) {
    const symbols = [];
    const symbolPatterns = {
      water: /\b(water|ocean|river|lake|rain|tears)\b/gi,
      light: /\b(light|sun|moon|star|glow|bright|shine)\b/gi,
      journey: /\b(path|road|journey|travel|quest|adventure)\b/gi,
      transformation: /\b(change|transform|become|grow|evolve)\b/gi,
    };

    Object.entries(symbolPatterns).forEach(([symbol, pattern]) => {
      if (pattern.test(text)) {
        symbols.push(symbol);
      }
    });

    return symbols;
  }

  detectCharacters(text) {
    const characters = [];
    const characterPatterns = {
      self: /\b(I|me|my|myself)\b/gi,
      people: /\b(person|people|man|woman|child|friend|stranger)\b/gi,
      animals: /\b(cat|dog|bird|horse|dragon|creature|animal)\b/gi,
    };

    Object.entries(characterPatterns).forEach(([character, pattern]) => {
      if (pattern.test(text)) {
        characters.push(character);
      }
    });

    return characters;
  }

  // Utility methods
  estimateTokenCount(text) {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  truncateToTokenLimit(text, maxTokens) {
    const maxChars = maxTokens * 4;
    if (text.length <= maxChars) return text;

    return (
      text.substring(0, maxChars - 100) +
      '\n\n[Content truncated to fit token limit]'
    );
  }

  getCurrentSeason(date) {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  getTimeOfDay(date) {
    const hour = date.getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  getCurrentEvents(date) {
    // Simple event detection - could be enhanced with real calendar integration
    const month = date.getMonth();
    const day = date.getDate();

    const events = [];
    if (month === 11 && day >= 20) events.push('winter_solstice_approaching');
    if (month === 2 && day >= 15) events.push('spring_equinox_approaching');
    if (month === 9) events.push('autumn_season');

    return events;
  }

  getWeatherMood(season) {
    const moods = {
      spring: 'renewal',
      summer: 'vibrant',
      autumn: 'contemplative',
      winter: 'introspective',
    };
    return moods[season] || 'neutral';
  }

  calculateContextStrength(context) {
    const factors = [
      context.preferred_styles?.length || 0,
      context.favorite_themes?.length || 0,
      context.dream_patterns?.length || 0,
      context.quality_preference ? 1 : 0,
    ];

    return factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
  }

  extractPreferencePatterns(context) {
    return {
      style_consistency: context.preferred_styles?.length === 1,
      theme_diversity: (context.favorite_themes?.length || 0) > 3,
      quality_preference: context.quality_preference || 'standard',
    };
  }

  generateAdaptationSuggestions(context) {
    const suggestions = [];

    if (!context.preferred_styles?.length) {
      suggestions.push('Consider exploring different visual styles');
    }

    if ((context.favorite_themes?.length || 0) < 2) {
      suggestions.push('Try incorporating more diverse themes');
    }

    return suggestions;
  }

  analyzeSessionProgression(sessionContext) {
    return {
      dream_count: sessionContext.previous_dreams?.length || 0,
      theme_evolution: sessionContext.theme_focus !== 'general',
      refinement_trend: (sessionContext.refinement_count || 0) > 2,
    };
  }

  trackThemeEvolution(sessionContext) {
    const themes =
      sessionContext.previous_dreams?.map((d) => d.theme).filter(Boolean) || [];
    return {
      theme_consistency: new Set(themes).size <= 2,
      theme_progression: themes.length > 1,
      dominant_theme: this.findMostFrequent(themes),
    };
  }

  analyzeQualityTrends(sessionContext) {
    const qualities =
      sessionContext.previous_dreams?.map((d) => d.quality).filter(Boolean) ||
      [];
    return {
      quality_progression: this.detectQualityProgression(qualities),
      preferred_quality: this.findMostFrequent(qualities) || 'standard',
    };
  }

  determinePerformanceLevel(provider) {
    const levels = {
      cerebras: 'high',
      openai: 'standard',
      llama: 'basic',
    };
    return levels[provider] || 'standard';
  }

  getAvailableEffects(provider) {
    const effects = {
      cerebras: [
        'advanced_lighting',
        'particle_systems',
        'dynamic_cameras',
        'post_processing',
      ],
      openai: [
        'standard_lighting',
        'basic_particles',
        'smooth_cameras',
        'basic_effects',
      ],
      llama: ['basic_lighting', 'simple_transitions', 'static_cameras'],
    };
    return effects[provider] || effects.openai;
  }

  findMostFrequent(array) {
    if (!array.length) return null;

    const frequency = {};
    array.forEach((item) => {
      frequency[item] = (frequency[item] || 0) + 1;
    });

    return Object.entries(frequency).sort(([, a], [, b]) => b - a)[0]?.[0];
  }

  detectQualityProgression(qualities) {
    if (qualities.length < 2) return 'insufficient_data';

    const qualityLevels = { draft: 1, standard: 2, high: 3, cinematic: 4 };
    const levels = qualities.map((q) => qualityLevels[q] || 2);

    const trend = levels[levels.length - 1] - levels[0];
    if (trend > 0) return 'improving';
    if (trend < 0) return 'simplifying';
    return 'stable';
  }

  updateContextHistory(dreamText, prompt, options) {
    const historyEntry = {
      dream_text: dreamText,
      prompt_metadata: prompt.metadata,
      options,
      timestamp: new Date().toISOString(),
    };

    // Keep last 10 entries per session
    const sessionKey = options.session_id || 'default';
    if (!this.contextHistory.has(sessionKey)) {
      this.contextHistory.set(sessionKey, []);
    }

    const history = this.contextHistory.get(sessionKey);
    history.push(historyEntry);

    if (history.length > 10) {
      history.shift();
    }
  }

  getContextHistory(sessionId = 'default') {
    return this.contextHistory.get(sessionId) || [];
  }

  clearContextHistory(sessionId = null) {
    if (sessionId) {
      this.contextHistory.delete(sessionId);
    } else {
      this.contextHistory.clear();
    }
  }

  // Additional methods expected by tests
  buildVideoPrompt(sceneData, quality = 'standard') {
    let prompt = `Generate video content for: ${
      sceneData.title || 'Untitled Scene'
    }\n\n`;

    prompt += `Quality Level: ${quality}\n`;
    prompt += this.buildVideoSpecifications(quality) + '\n\n';

    if (sceneData.scenes) {
      prompt += 'Scenes:\n';
      sceneData.scenes.forEach((scene, index) => {
        prompt += `${index + 1}. ${scene.description || scene.type}\n`;
        if (scene.mood) prompt += `   Mood: ${scene.mood}\n`;
        if (scene.lighting) prompt += `   Lighting: ${scene.lighting}\n`;
        if (scene.camera)
          prompt += `   Camera: ${scene.camera.angle} ${scene.camera.movement}\n`;
      });
    }

    if (sceneData.transitions) {
      prompt += '\nTransitions:\n';
      sceneData.transitions.forEach((transition) => {
        prompt += `- ${transition.type} (${transition.duration}s)\n`;
      });
    }

    prompt +=
      '\nGenerate detailed cinematography instructions for video production.';

    return prompt;
  }

  buildRefinementPrompt(content, feedback) {
    let prompt = `Refine the following dream content based on feedback:\n\n`;

    prompt += `Original Content:\n${JSON.stringify(content, null, 2)}\n\n`;

    prompt += 'Feedback:\n';
    if (Array.isArray(feedback)) {
      feedback.forEach((item, index) => {
        prompt += `${index + 1}. ${item}\n`;
      });
    } else {
      prompt += feedback + '\n';
    }

    prompt +=
      '\nPlease refine the content while preserving the original structure and incorporating the feedback.';

    return prompt;
  }

  getTemplate(type, style = null) {
    // Simple template system for testing
    const templates = {
      dream: {
        ethereal:
          'Generate an ethereal dream with {text} including {style} elements and JSON structure.',
        cyberpunk:
          'Generate a cyberpunk dream with {text} including {style} elements and JSON structure.',
        surreal:
          'Generate a surreal dream with {text} including {style} elements and JSON structure.',
        default:
          'Generate a dream with {text} including {style} elements and JSON structure.',
      },
    };

    if (templates[type]) {
      return (
        templates[type][style] ||
        templates[type].default ||
        templates[type].ethereal
      );
    }

    return 'Generate content with {text} and {style} elements.';
  }

  buildOptimizedPrompt(text, style) {
    return this.buildDreamPrompt(text, style, {});
  }

  generatePromptVariation(text, style, variationIndex = 0) {
    const variations = [
      `Create a ${style} dream scene: ${text}`,
      `Generate a ${style} dreamscape featuring: ${text}`,
      `Build a ${style} dream environment with: ${text}`,
    ];

    return variations[variationIndex % variations.length] || variations[0];
  }

  updatePerformanceData(data) {
    // Store performance data for optimization
    this.performanceData = data;
  }

  recordPromptPerformance(promptId, metrics) {
    if (!this.promptPerformance) {
      this.promptPerformance = new Map();
    }
    this.promptPerformance.set(promptId, metrics);
  }

  getPromptPerformance(promptId) {
    return this.promptPerformance?.get(promptId) || null;
  }
}

module.exports = PromptEngine;
