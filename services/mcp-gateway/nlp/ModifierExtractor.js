/**
 * Modifier Extractor
 * Extracts adjectives, colors, sizes, and mood descriptors from text
 */

const NLPWrapper = require('./NLPWrapper');
const TextPreprocessor = require('./TextPreprocessor');

class ModifierExtractor {
  constructor() {
    this.nlp = new NLPWrapper();
    this.preprocessor = new TextPreprocessor();

    // Mood/atmosphere adjectives
    this.moodWords = {
      ethereal: [
        'ethereal',
        'mystical',
        'magical',
        'enchanted',
        'otherworldly',
        'supernatural',
      ],
      dark: [
        'dark',
        'gloomy',
        'ominous',
        'sinister',
        'shadowy',
        'murky',
        'dim',
      ],
      bright: [
        'bright',
        'luminous',
        'radiant',
        'brilliant',
        'glowing',
        'shining',
      ],
      dreamlike: [
        'dreamlike',
        'surreal',
        'fantastical',
        'whimsical',
        'imaginative',
      ],
      peaceful: ['peaceful', 'serene', 'calm', 'tranquil', 'quiet', 'still'],
      dramatic: [
        'dramatic',
        'intense',
        'powerful',
        'striking',
        'bold',
        'vivid',
      ],
      mysterious: ['mysterious', 'enigmatic', 'cryptic', 'obscure', 'hidden'],
      epic: [
        'epic',
        'grand',
        'majestic',
        'magnificent',
        'monumental',
        'imposing',
      ],
    };

    // Color words
    this.colors = [
      'red',
      'blue',
      'green',
      'yellow',
      'orange',
      'purple',
      'pink',
      'brown',
      'black',
      'white',
      'gray',
      'grey',
      'silver',
      'gold',
      'golden',
      'bronze',
      'crimson',
      'scarlet',
      'azure',
      'emerald',
      'amber',
      'violet',
      'indigo',
      'turquoise',
      'cyan',
      'magenta',
      'maroon',
      'navy',
      'teal',
      'olive',
      'coral',
      'ivory',
      'pearl',
      'ebony',
      'jade',
      'ruby',
      'sapphire',
    ];

    // Size modifiers
    this.sizeWords = {
      tiny: [
        'tiny',
        'minuscule',
        'microscopic',
        'miniature',
        'small',
        'little',
      ],
      small: ['small', 'little', 'petite', 'compact', 'modest'],
      medium: ['medium', 'average', 'moderate', 'normal', 'regular'],
      large: [
        'large',
        'big',
        'huge',
        'enormous',
        'massive',
        'giant',
        'gigantic',
      ],
      colossal: [
        'colossal',
        'titanic',
        'monumental',
        'immense',
        'vast',
        'tremendous',
      ],
    };

    // Speed/intensity modifiers
    this.speedWords = {
      slow: ['slow', 'sluggish', 'leisurely', 'gradual', 'gentle'],
      moderate: ['moderate', 'steady', 'regular', 'normal'],
      fast: ['fast', 'quick', 'rapid', 'swift', 'speedy', 'hasty'],
      extreme: ['extreme', 'blazing', 'lightning', 'breakneck', 'furious'],
    };

    // Weather/atmospheric descriptors
    this.weatherWords = [
      'stormy',
      'foggy',
      'misty',
      'cloudy',
      'clear',
      'sunny',
      'rainy',
      'snowy',
      'windy',
      'humid',
      'dry',
      'hazy',
      'overcast',
    ];

    // Time descriptors
    this.timeWords = [
      'dawn',
      'sunrise',
      'morning',
      'noon',
      'afternoon',
      'sunset',
      'dusk',
      'twilight',
      'evening',
      'night',
      'midnight',
      'nocturnal',
    ];
  }

  /**
   * Extract all adjectives from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of adjectives
   */
  extractAdjectives(text) {
    return this.nlp.extractAdjectives(text);
  }

  /**
   * Extract mood words from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of mood descriptors with categories
   */
  extractMoodWords(text) {
    const textLower = text.toLowerCase();
    const foundMoods = [];

    for (const [mood, words] of Object.entries(this.moodWords)) {
      for (const word of words) {
        if (textLower.includes(word)) {
          foundMoods.push({
            word,
            mood,
            category: 'mood',
          });
        }
      }
    }

    return foundMoods;
  }

  /**
   * Extract color words from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of color words
   */
  extractColors(text) {
    const textLower = text.toLowerCase();
    const tokens = this.preprocessor.tokenize(textLower);

    return tokens.filter((token) => this.colors.includes(token));
  }

  /**
   * Extract size modifiers from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of size descriptors with categories
   */
  extractSizeModifiers(text) {
    const textLower = text.toLowerCase();
    const foundSizes = [];

    for (const [size, words] of Object.entries(this.sizeWords)) {
      for (const word of words) {
        if (textLower.includes(word)) {
          foundSizes.push({
            word,
            size,
            category: 'size',
          });
        }
      }
    }

    return foundSizes;
  }

  /**
   * Extract speed/intensity modifiers
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of speed descriptors
   */
  extractSpeedModifiers(text) {
    const textLower = text.toLowerCase();
    const foundSpeeds = [];

    for (const [speed, words] of Object.entries(this.speedWords)) {
      for (const word of words) {
        if (textLower.includes(word)) {
          foundSpeeds.push({
            word,
            speed,
            category: 'speed',
          });
        }
      }
    }

    return foundSpeeds;
  }

  /**
   * Extract weather descriptors
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of weather words
   */
  extractWeatherWords(text) {
    const textLower = text.toLowerCase();
    const tokens = this.preprocessor.tokenize(textLower);

    return tokens.filter((token) => this.weatherWords.includes(token));
  }

  /**
   * Extract time descriptors
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of time words
   */
  extractTimeWords(text) {
    const textLower = text.toLowerCase();
    const tokens = this.preprocessor.tokenize(textLower);

    return tokens.filter((token) => this.timeWords.includes(token));
  }

  /**
   * Extract all modifiers (comprehensive)
   * @param {string} text - Text to analyze
   * @returns {Object} - All modifiers categorized
   */
  extractAllModifiers(text) {
    return {
      adjectives: this.extractAdjectives(text),
      moods: this.extractMoodWords(text),
      colors: this.extractColors(text),
      sizes: this.extractSizeModifiers(text),
      speeds: this.extractSpeedModifiers(text),
      weather: this.extractWeatherWords(text),
      time: this.extractTimeWords(text),
    };
  }

  /**
   * Get dominant mood from text
   * @param {string} text - Text to analyze
   * @returns {string|null} - Dominant mood category
   */
  getDominantMood(text) {
    const moods = this.extractMoodWords(text);

    if (moods.length === 0) {
      return null;
    }

    // Count moods by category
    const moodCounts = {};
    moods.forEach((mood) => {
      moodCounts[mood.mood] = (moodCounts[mood.mood] || 0) + 1;
    });

    // Find most common mood
    let maxCount = 0;
    let dominantMood = null;

    for (const [mood, count] of Object.entries(moodCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantMood = mood;
      }
    }

    return dominantMood;
  }

  /**
   * Get visual style hints from modifiers
   * @param {string} text - Text to analyze
   * @returns {Object} - Visual style recommendations
   */
  getVisualStyleHints(text) {
    const modifiers = this.extractAllModifiers(text);
    const dominantMood = this.getDominantMood(text);

    const hints = {
      lighting: 'neutral',
      atmosphere: 'clear',
      colorPalette: [],
      effects: [],
      mood: dominantMood,
    };

    // Determine lighting based on mood and time
    if (modifiers.moods.some((m) => m.mood === 'dark')) {
      hints.lighting = 'dark';
      hints.effects.push('shadows', 'fog');
    } else if (modifiers.moods.some((m) => m.mood === 'bright')) {
      hints.lighting = 'bright';
      hints.effects.push('bloom', 'glow');
    } else if (modifiers.moods.some((m) => m.mood === 'ethereal')) {
      hints.lighting = 'soft';
      hints.effects.push('glow', 'particles', 'mist');
    }

    // Set atmosphere based on weather
    if (modifiers.weather.length > 0) {
      hints.atmosphere = modifiers.weather[0];
    }

    // Add color palette
    hints.colorPalette = modifiers.colors;

    // Add dramatic effects
    if (modifiers.moods.some((m) => m.mood === 'dramatic')) {
      hints.effects.push('camera_shake', 'motion_blur');
    }

    return hints;
  }

  /**
   * Check if text has descriptive richness
   * @param {string} text - Text to analyze
   * @returns {boolean} - True if rich in descriptors
   */
  hasRichDescription(text) {
    const modifiers = this.extractAllModifiers(text);
    const totalModifiers =
      modifiers.adjectives.length +
      modifiers.moods.length +
      modifiers.colors.length +
      modifiers.sizes.length;

    return totalModifiers >= 3;
  }

  /**
   * Get modifier density (modifiers per word)
   * @param {string} text - Text to analyze
   * @returns {number} - Modifier density ratio
   */
  getModifierDensity(text) {
    const wordCount = this.preprocessor.wordCount(text);
    const modifiers = this.extractAllModifiers(text);
    const totalModifiers =
      modifiers.adjectives.length +
      modifiers.moods.length +
      modifiers.colors.length +
      modifiers.sizes.length;

    return wordCount > 0 ? totalModifiers / wordCount : 0;
  }

  /**
   * Suggest enhancements based on modifiers
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of enhancement suggestions
   */
  suggestEnhancements(text) {
    const modifiers = this.extractAllModifiers(text);
    const suggestions = [];

    // Suggest lighting effects
    if (
      modifiers.moods.some((m) => m.mood === 'ethereal' || m.mood === 'magical')
    ) {
      suggestions.push({
        type: 'lighting',
        effect: 'soft_glow',
        reason: 'ethereal/magical mood detected',
      });
    }

    // Suggest particle effects
    if (modifiers.moods.some((m) => m.mood === 'dreamlike')) {
      suggestions.push({
        type: 'particles',
        effect: 'floating_particles',
        reason: 'dreamlike atmosphere',
      });
    }

    // Suggest color grading
    if (modifiers.colors.length > 0) {
      suggestions.push({
        type: 'color_grading',
        colors: modifiers.colors,
        reason: 'specific colors mentioned',
      });
    }

    // Suggest atmospheric effects
    if (modifiers.weather.length > 0) {
      suggestions.push({
        type: 'atmosphere',
        effect: modifiers.weather[0],
        reason: 'weather condition specified',
      });
    }

    return suggestions;
  }
}

module.exports = ModifierExtractor;
