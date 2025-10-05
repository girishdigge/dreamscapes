/**
 * Semantic Analyzer
 * Comprehensive semantic understanding of prompts
 * Combines all NLP extractors to provide rich scene analysis
 */

const EntityExtractor = require('./EntityExtractor');
const VerbExtractor = require('./VerbExtractor');
const ModifierExtractor = require('./ModifierExtractor');
const TextPreprocessor = require('./TextPreprocessor');
const NLPWrapper = require('./NLPWrapper');

class SemanticAnalyzer {
  constructor() {
    this.entityExtractor = new EntityExtractor();
    this.verbExtractor = new VerbExtractor();
    this.modifierExtractor = new ModifierExtractor();
    this.preprocessor = new TextPreprocessor();
    this.nlp = new NLPWrapper();

    // Environment presets mapping
    this.environmentPresets = {
      // Time-based
      dawn: {
        skybox: 'dawn',
        ambientLight: 0.5,
        fog: 0.2,
        colorTint: '#ffa07a',
      },
      sunrise: {
        skybox: 'sunrise',
        ambientLight: 0.6,
        fog: 0.2,
        colorTint: '#ff8c69',
      },
      morning: {
        skybox: 'morning',
        ambientLight: 0.8,
        fog: 0.1,
        colorTint: '#fffacd',
      },
      noon: {
        skybox: 'noon',
        ambientLight: 1.0,
        fog: 0.0,
        colorTint: '#ffffff',
      },
      afternoon: {
        skybox: 'afternoon',
        ambientLight: 0.9,
        fog: 0.1,
        colorTint: '#ffd700',
      },
      sunset: {
        skybox: 'sunset',
        ambientLight: 0.7,
        fog: 0.3,
        colorTint: '#ff6347',
      },
      dusk: {
        skybox: 'dusk',
        ambientLight: 0.4,
        fog: 0.4,
        colorTint: '#9370db',
      },
      twilight: {
        skybox: 'twilight',
        ambientLight: 0.3,
        fog: 0.5,
        colorTint: '#483d8b',
      },
      evening: {
        skybox: 'evening',
        ambientLight: 0.3,
        fog: 0.4,
        colorTint: '#191970',
      },
      night: {
        skybox: 'night',
        ambientLight: 0.2,
        fog: 0.3,
        colorTint: '#000033',
      },
      midnight: {
        skybox: 'midnight',
        ambientLight: 0.1,
        fog: 0.2,
        colorTint: '#000000',
      },

      // Weather-based
      clear: { skybox: 'clear', ambientLight: 1.0, fog: 0.0, weather: 'clear' },
      sunny: { skybox: 'sunny', ambientLight: 1.0, fog: 0.0, weather: 'sunny' },
      cloudy: {
        skybox: 'cloudy',
        ambientLight: 0.7,
        fog: 0.2,
        weather: 'cloudy',
      },
      overcast: {
        skybox: 'overcast',
        ambientLight: 0.6,
        fog: 0.3,
        weather: 'overcast',
      },
      foggy: { skybox: 'foggy', ambientLight: 0.5, fog: 0.8, weather: 'foggy' },
      misty: { skybox: 'misty', ambientLight: 0.6, fog: 0.6, weather: 'misty' },
      stormy: {
        skybox: 'stormy',
        ambientLight: 0.4,
        fog: 0.4,
        weather: 'stormy',
      },
      rainy: { skybox: 'rainy', ambientLight: 0.5, fog: 0.3, weather: 'rainy' },
      snowy: { skybox: 'snowy', ambientLight: 0.8, fog: 0.2, weather: 'snowy' },

      // Location-based
      space: {
        skybox: 'space',
        ambientLight: 0.2,
        fog: 0.0,
        location: 'space',
      },
      ocean: {
        skybox: 'ocean',
        ambientLight: 0.8,
        fog: 0.2,
        location: 'ocean',
      },
      underwater: {
        skybox: 'underwater',
        ambientLight: 0.4,
        fog: 0.6,
        location: 'underwater',
      },
      forest: {
        skybox: 'forest',
        ambientLight: 0.6,
        fog: 0.3,
        location: 'forest',
      },
      desert: {
        skybox: 'desert',
        ambientLight: 1.0,
        fog: 0.1,
        location: 'desert',
      },
      mountain: {
        skybox: 'mountain',
        ambientLight: 0.9,
        fog: 0.2,
        location: 'mountain',
      },
      cave: { skybox: 'cave', ambientLight: 0.2, fog: 0.4, location: 'cave' },
      sky: { skybox: 'sky', ambientLight: 0.9, fog: 0.1, location: 'sky' },
    };
  }

  /**
   * Main analysis method - comprehensive semantic understanding
   * @param {string} prompt - User prompt to analyze
   * @returns {Object} - Complete semantic analysis
   */
  analyze(prompt) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt: must be a non-empty string');
    }

    // Preprocess
    const cleaned = this.preprocessor.clean(prompt);

    // Extract all components
    const entities = this.entityExtractor.extractEntities(prompt);
    const verbs = this.verbExtractor.extractVerbs(prompt);
    const modifiers = this.modifierExtractor.extractAllModifiers(prompt);
    const prepositions = this.nlp.extractPrepositions(prompt);

    // Perform high-level analysis
    const countInference = this.inferCounts(entities, prompt);
    const environment = this.detectEnvironment(modifiers, entities);
    const mood = this.detectMoodAndStyle(modifiers);
    const spatialRelationships = this.extractSpatialRelationships(
      entities,
      prepositions,
      prompt
    );
    const sceneType = this.determineSceneType(entities, verbs, modifiers);

    // Build comprehensive analysis
    return {
      // Original input
      originalPrompt: prompt,
      cleanedPrompt: cleaned,

      // Extracted components
      entities: entities.map((e) => ({
        text: e.text,
        type: e.type,
        count: e.count,
        isPlural: e.isPlural,
        isSingular: e.isSingular,
        isProper: e.isProper,
        isCollective: e.isCollective,
      })),

      verbs: verbs.map((v) => ({
        text: v.text,
        category: v.category,
        intensity: v.intensity,
        isMotionVerb: v.isMotionVerb,
        isEventVerb: v.isEventVerb,
      })),

      modifiers: {
        adjectives: modifiers.adjectives,
        colors: modifiers.colors,
        moods: modifiers.moods,
        sizes: modifiers.sizes,
        speeds: modifiers.speeds,
        weather: modifiers.weather,
        time: modifiers.time,
      },

      // High-level analysis
      countInference,
      environment,
      mood,
      spatialRelationships,
      sceneType,

      // Scene characteristics
      characteristics: {
        isStatic: this.verbExtractor.isStaticScene(prompt),
        hasMultipleEntities: this.entityExtractor.hasMultipleEntities(prompt),
        hasHighIntensity: this.verbExtractor.hasHighIntensityAction(prompt),
        hasRichDescription: this.modifierExtractor.hasRichDescription(prompt),
        dominantMotion: this.verbExtractor.getDominantMotionType(prompt),
        dominantMood: this.modifierExtractor.getDominantMood(prompt),
        totalEntityCount: this.entityExtractor.getTotalEntityCount(prompt),
      },

      // Visual style hints
      visualStyle: this.modifierExtractor.getVisualStyleHints(prompt),

      // Enhancement suggestions
      suggestions: this.modifierExtractor.suggestEnhancements(prompt),

      // Metadata
      metadata: {
        analyzedAt: new Date().toISOString(),
        wordCount: this.preprocessor.wordCount(prompt),
        modifierDensity: this.modifierExtractor.getModifierDensity(prompt),
      },
    };
  }

  /**
   * Infer counts for all entities
   * @param {Array} entities - Extracted entities
   * @param {string} prompt - Original prompt
   * @returns {Object} - Count inference details
   */
  inferCounts(entities, prompt) {
    const inferences = [];

    entities.forEach((entity) => {
      const inference = {
        entity: entity.text,
        inferredCount: entity.count,
        method: 'unknown',
        confidence: 0.5,
      };

      // Determine inference method
      const numbers = this.nlp.extractNumbers(prompt);
      const hasExplicitNumber = numbers.some((n) =>
        entity.text.toLowerCase().includes(n.text.toLowerCase())
      );

      if (hasExplicitNumber) {
        inference.method = 'explicit_number';
        inference.confidence = 1.0;
      } else if (entity.isCollective) {
        inference.method = 'collective_noun';
        inference.confidence = 0.8;
      } else if (entity.isPlural) {
        inference.method = 'plural_form';
        inference.confidence = 0.7;
      } else if (entity.isSingular) {
        inference.method = 'singular_form';
        inference.confidence = 1.0;
      }

      inferences.push(inference);
    });

    return {
      totalInferred: inferences.reduce(
        (sum, inf) => sum + inf.inferredCount,
        0
      ),
      inferences,
      averageConfidence:
        inferences.length > 0
          ? inferences.reduce((sum, inf) => sum + inf.confidence, 0) /
            inferences.length
          : 0,
    };
  }

  /**
   * Detect environment from modifiers and entities
   * @param {Object} modifiers - Extracted modifiers
   * @param {Array} entities - Extracted entities
   * @returns {Object} - Environment details
   */
  detectEnvironment(modifiers, entities) {
    const detected = {
      time: null,
      weather: null,
      location: null,
      preset: null,
      presetConfig: null,
    };

    // Detect time
    if (modifiers.time.length > 0) {
      detected.time = modifiers.time[0];
      if (this.environmentPresets[detected.time]) {
        detected.preset = detected.time;
        detected.presetConfig = this.environmentPresets[detected.time];
      }
    }

    // Detect weather
    if (modifiers.weather.length > 0) {
      detected.weather = modifiers.weather[0];
      if (this.environmentPresets[detected.weather]) {
        detected.preset = detected.weather;
        detected.presetConfig = this.environmentPresets[detected.weather];
      }
    }

    // Detect location from entities
    const locationEntities = entities.filter(
      (e) => e.type === 'natural_element'
    );
    if (locationEntities.length > 0) {
      const locationText = locationEntities[0].text.toLowerCase();
      for (const [key, preset] of Object.entries(this.environmentPresets)) {
        if (locationText.includes(key)) {
          detected.location = key;
          detected.preset = key;
          detected.presetConfig = preset;
          break;
        }
      }
    }

    // Default preset if none detected
    if (!detected.preset) {
      detected.preset = 'clear';
      detected.presetConfig = this.environmentPresets.clear;
    }

    return detected;
  }

  /**
   * Detect mood and style from modifiers
   * @param {Object} modifiers - Extracted modifiers
   * @returns {Object} - Mood and style details
   */
  detectMoodAndStyle(modifiers) {
    const moodCategories = {};

    // Count moods by category
    modifiers.moods.forEach((mood) => {
      moodCategories[mood.mood] = (moodCategories[mood.mood] || 0) + 1;
    });

    // Determine dominant mood
    let dominantMood = null;
    let maxCount = 0;
    for (const [mood, count] of Object.entries(moodCategories)) {
      if (count > maxCount) {
        maxCount = count;
        dominantMood = mood;
      }
    }

    // Map mood to lighting and effects
    const lightingMap = {
      ethereal: 'soft_glow',
      dark: 'low_key',
      bright: 'high_key',
      dreamlike: 'soft_diffuse',
      dramatic: 'high_contrast',
      mysterious: 'low_ambient',
    };

    const effectsMap = {
      ethereal: ['glow', 'particles', 'mist'],
      dark: ['shadows', 'fog', 'vignette'],
      bright: ['bloom', 'lens_flare'],
      dreamlike: ['soft_focus', 'particles', 'color_grade'],
      dramatic: ['high_contrast', 'camera_shake'],
      mysterious: ['fog', 'shadows', 'low_light'],
    };

    return {
      dominantMood,
      moodCategories,
      suggestedLighting: dominantMood ? lightingMap[dominantMood] : 'neutral',
      suggestedEffects: dominantMood ? effectsMap[dominantMood] : [],
      colorPalette: modifiers.colors,
      hasStrongMood: Object.keys(moodCategories).length > 0,
    };
  }

  /**
   * Extract spatial relationships between entities
   * @param {Array} entities - Extracted entities
   * @param {Array} prepositions - Extracted prepositions
   * @param {string} prompt - Original prompt
   * @returns {Array} - Spatial relationships
   */
  extractSpatialRelationships(entities, prepositions, prompt) {
    const relationships = [];
    const promptLower = prompt.toLowerCase();

    // Common spatial prepositions
    const spatialPreps = [
      'in',
      'on',
      'above',
      'below',
      'over',
      'under',
      'near',
      'beside',
      'between',
      'around',
      'through',
    ];

    // Find spatial relationships
    entities.forEach((entity, i) => {
      spatialPreps.forEach((prep) => {
        if (promptLower.includes(prep)) {
          // Find related entities
          entities.forEach((otherEntity, j) => {
            if (i !== j) {
              const pattern = new RegExp(
                `${entity.text.toLowerCase()}.*${prep}.*${otherEntity.text.toLowerCase()}`,
                'i'
              );
              if (pattern.test(promptLower)) {
                relationships.push({
                  subject: entity.text,
                  relation: prep,
                  object: otherEntity.text,
                  type: this.classifySpatialRelation(prep),
                });
              }
            }
          });
        }
      });
    });

    return relationships;
  }

  /**
   * Classify spatial relation type
   * @param {string} preposition - Spatial preposition
   * @returns {string} - Relation type
   */
  classifySpatialRelation(preposition) {
    const types = {
      above: 'vertical',
      below: 'vertical',
      over: 'vertical',
      under: 'vertical',
      on: 'contact',
      in: 'containment',
      near: 'proximity',
      beside: 'proximity',
      around: 'surrounding',
      through: 'traversal',
      between: 'intermediate',
    };

    return types[preposition] || 'general';
  }

  /**
   * Determine overall scene type
   * @param {Array} entities - Extracted entities
   * @param {Array} verbs - Extracted verbs
   * @param {Object} modifiers - Extracted modifiers
   * @returns {Object} - Scene type classification
   */
  determineSceneType(entities, verbs, modifiers) {
    const type = {
      primary: 'static',
      secondary: [],
      complexity: 'simple',
      tags: [],
    };

    // Determine primary type
    if (verbs.some((v) => v.isEventVerb)) {
      type.primary = 'event';
      type.tags.push('dynamic', 'event-driven');
    } else if (verbs.some((v) => v.isMotionVerb)) {
      type.primary = 'motion';
      type.tags.push('animated', 'kinetic');
    } else {
      type.primary = 'static';
      type.tags.push('still', 'contemplative');
    }

    // Determine secondary characteristics
    if (entities.length > 3) {
      type.secondary.push('crowded');
      type.complexity = 'complex';
    }

    if (modifiers.moods.length > 2) {
      type.secondary.push('atmospheric');
    }

    if (verbs.length > 2) {
      type.secondary.push('multi-action');
      type.complexity = 'complex';
    }

    // Add style tags
    if (
      modifiers.moods.some(
        (m) => m.mood === 'ethereal' || m.mood === 'dreamlike'
      )
    ) {
      type.tags.push('surreal', 'fantastical');
    }

    if (
      modifiers.moods.some((m) => m.mood === 'dramatic' || m.mood === 'epic')
    ) {
      type.tags.push('cinematic', 'grand');
    }

    return type;
  }

  /**
   * Get a summary of the analysis
   * @param {Object} analysis - Full analysis object
   * @returns {string} - Human-readable summary
   */
  getSummary(analysis) {
    const parts = [];

    // Entity summary
    const entityCount = analysis.characteristics.totalEntityCount;
    const entityTypes = [...new Set(analysis.entities.map((e) => e.type))];
    parts.push(`${entityCount} entities (${entityTypes.join(', ')})`);

    // Motion summary
    if (!analysis.characteristics.isStatic) {
      const motion = analysis.characteristics.dominantMotion;
      parts.push(`${motion} motion`);
    } else {
      parts.push('static scene');
    }

    // Environment summary
    if (analysis.environment.preset) {
      parts.push(`${analysis.environment.preset} environment`);
    }

    // Mood summary
    if (analysis.characteristics.dominantMood) {
      parts.push(`${analysis.characteristics.dominantMood} mood`);
    }

    return parts.join(', ');
  }
}

module.exports = SemanticAnalyzer;
