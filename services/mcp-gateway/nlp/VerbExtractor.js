/**
 * Verb Extractor
 * Extracts and classifies action verbs from text
 * Identifies verb tense and categorizes by motion type
 */

const NLPWrapper = require('./NLPWrapper');
const TextPreprocessor = require('./TextPreprocessor');

class VerbExtractor {
  constructor() {
    this.nlp = new NLPWrapper();
    this.preprocessor = new TextPreprocessor();

    // Motion verb categories
    this.motionVerbs = {
      // Aerial motion
      aerial: [
        'flying',
        'soaring',
        'hovering',
        'gliding',
        'swooping',
        'diving',
        'ascending',
        'descending',
        'floating',
        'levitating',
      ],

      // Ground motion
      ground: [
        'running',
        'walking',
        'galloping',
        'trotting',
        'sprinting',
        'jogging',
        'crawling',
        'marching',
        'striding',
        'pacing',
      ],

      // Water motion
      water: [
        'sailing',
        'swimming',
        'diving',
        'floating',
        'drifting',
        'surfing',
        'rowing',
        'paddling',
        'cruising',
      ],

      // Circular motion
      circular: [
        'circling',
        'orbiting',
        'spinning',
        'rotating',
        'revolving',
        'swirling',
        'spiraling',
        'whirling',
        'twirling',
      ],

      // Vertical motion
      vertical: [
        'rising',
        'falling',
        'climbing',
        'descending',
        'ascending',
        'dropping',
        'plummeting',
        'sinking',
        'lifting',
        'elevating',
      ],

      // Event verbs
      event: [
        'exploding',
        'erupting',
        'colliding',
        'crashing',
        'bursting',
        'shattering',
        'transforming',
        'morphing',
        'appearing',
        'disappearing',
        'vanishing',
      ],

      // Idle/subtle motion
      idle: [
        'floating',
        'swaying',
        'pulsating',
        'glowing',
        'shimmering',
        'flickering',
        'breathing',
        'resting',
        'waiting',
        'hovering',
      ],

      // Interaction verbs
      interaction: [
        'chasing',
        'following',
        'pursuing',
        'fleeing',
        'escaping',
        'approaching',
        'avoiding',
        'meeting',
        'joining',
        'separating',
      ],
    };

    // Verb intensity (speed/energy level)
    this.verbIntensity = {
      low: [
        'floating',
        'drifting',
        'hovering',
        'swaying',
        'gliding',
        'resting',
      ],
      medium: ['walking', 'sailing', 'swimming', 'circling', 'flying'],
      high: [
        'running',
        'sprinting',
        'galloping',
        'diving',
        'swooping',
        'exploding',
      ],
    };
  }

  /**
   * Extract all verbs from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of verb objects with metadata
   */
  extractVerbs(text) {
    const verbs = this.nlp.extractVerbs(text);

    return verbs.map((verb) => ({
      text: verb.text,
      isGerund: verb.isGerund,
      isPastTense: verb.isPastTense,
      isPresentTense: verb.isPresentTense,
      isInfinitive: verb.isInfinitive,
      category: this.categorizeVerb(verb.text),
      intensity: this.getVerbIntensity(verb.text),
      isMotionVerb: this.isMotionVerb(verb.text),
      isEventVerb: this.isEventVerb(verb.text),
    }));
  }

  /**
   * Categorize verb by motion type
   * @param {string} verb - Verb to categorize
   * @returns {string} - Category name
   */
  categorizeVerb(verb) {
    const verbLower = verb.toLowerCase();

    for (const [category, verbs] of Object.entries(this.motionVerbs)) {
      if (verbs.some((v) => verbLower.includes(v))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Get verb intensity level
   * @param {string} verb - Verb to analyze
   * @returns {string} - Intensity level (low, medium, high)
   */
  getVerbIntensity(verb) {
    const verbLower = verb.toLowerCase();

    for (const [intensity, verbs] of Object.entries(this.verbIntensity)) {
      if (verbs.some((v) => verbLower.includes(v))) {
        return intensity;
      }
    }

    return 'medium'; // Default
  }

  /**
   * Check if verb is a motion verb
   * @param {string} verb - Verb to check
   * @returns {boolean} - True if motion verb
   */
  isMotionVerb(verb) {
    const verbLower = verb.toLowerCase();
    const allMotionVerbs = Object.values(this.motionVerbs).flat();
    return allMotionVerbs.some((v) => verbLower.includes(v));
  }

  /**
   * Check if verb is an event verb
   * @param {string} verb - Verb to check
   * @returns {boolean} - True if event verb
   */
  isEventVerb(verb) {
    const verbLower = verb.toLowerCase();
    return this.motionVerbs.event.some((v) => verbLower.includes(v));
  }

  /**
   * Extract action verbs only (motion + event verbs)
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of action verbs
   */
  extractActionVerbs(text) {
    const verbs = this.extractVerbs(text);
    return verbs.filter((verb) => verb.isMotionVerb || verb.isEventVerb);
  }

  /**
   * Extract motion verbs by category
   * @param {string} text - Text to analyze
   * @param {string} category - Category to filter by
   * @returns {Array} - Array of verbs in category
   */
  extractVerbsByCategory(text, category) {
    const verbs = this.extractVerbs(text);
    return verbs.filter((verb) => verb.category === category);
  }

  /**
   * Get dominant motion type from text
   * @param {string} text - Text to analyze
   * @returns {string|null} - Dominant motion category
   */
  getDominantMotionType(text) {
    const verbs = this.extractActionVerbs(text);

    if (verbs.length === 0) {
      return null;
    }

    // Count verbs by category
    const categoryCounts = {};
    verbs.forEach((verb) => {
      categoryCounts[verb.category] = (categoryCounts[verb.category] || 0) + 1;
    });

    // Find category with most verbs
    let maxCount = 0;
    let dominantCategory = null;

    for (const [category, count] of Object.entries(categoryCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantCategory = category;
      }
    }

    return dominantCategory;
  }

  /**
   * Check if text contains high-intensity action
   * @param {string} text - Text to analyze
   * @returns {boolean} - True if high-intensity verbs found
   */
  hasHighIntensityAction(text) {
    const verbs = this.extractVerbs(text);
    return verbs.some((verb) => verb.intensity === 'high');
  }

  /**
   * Extract verb phrases (verb + modifiers)
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of verb phrases
   */
  extractVerbPhrases(text) {
    const doc = this.nlp.parse(text);
    const structure = this.nlp.getSentenceStructure(text);

    // Get verbs with their context
    return structure.verbs.map((verb) => {
      // Find adverbs near the verb
      const words = this.preprocessor.tokenize(text);
      const verbIndex = words.indexOf(verb);

      let phrase = verb;

      // Check for adverbs before/after
      if (verbIndex > 0) {
        const prevWord = words[verbIndex - 1];
        if (this.isAdverb(prevWord)) {
          phrase = `${prevWord} ${phrase}`;
        }
      }

      if (verbIndex < words.length - 1) {
        const nextWord = words[verbIndex + 1];
        if (this.isAdverb(nextWord)) {
          phrase = `${phrase} ${nextWord}`;
        }
      }

      return phrase;
    });
  }

  /**
   * Simple adverb check
   * @param {string} word - Word to check
   * @returns {boolean} - True if likely an adverb
   */
  isAdverb(word) {
    // Simple heuristic: words ending in -ly are often adverbs
    return word.endsWith('ly');
  }

  /**
   * Get verb tense distribution
   * @param {string} text - Text to analyze
   * @returns {Object} - Tense counts
   */
  getVerbTenseDistribution(text) {
    const verbs = this.extractVerbs(text);

    return {
      present: verbs.filter((v) => v.isPresentTense).length,
      past: verbs.filter((v) => v.isPastTense).length,
      gerund: verbs.filter((v) => v.isGerund).length,
      infinitive: verbs.filter((v) => v.isInfinitive).length,
    };
  }

  /**
   * Check if text describes static scene (no motion verbs)
   * @param {string} text - Text to analyze
   * @returns {boolean} - True if static
   */
  isStaticScene(text) {
    const actionVerbs = this.extractActionVerbs(text);
    return actionVerbs.length === 0;
  }

  /**
   * Suggest default motion for static entities
   * @param {string} entityType - Type of entity
   * @returns {string} - Suggested motion verb
   */
  suggestDefaultMotion(entityType) {
    const defaults = {
      living_creature: 'floating',
      vehicle: 'drifting',
      celestial: 'rotating',
      natural_element: 'swaying',
      structure: 'standing',
    };

    return defaults[entityType] || 'floating';
  }
}

module.exports = VerbExtractor;
