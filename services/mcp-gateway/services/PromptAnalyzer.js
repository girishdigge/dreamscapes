// services/mcp-gateway/services/PromptAnalyzer.js
// Analyzes user prompts to extract semantic information for scene generation

/**
 * Keyword mappings for entity extraction
 */
const ENTITY_KEYWORDS = {
  animals: [
    'horse',
    'horses',
    'bird',
    'birds',
    'fish',
    'dragon',
    'dragons',
    'butterfly',
    'butterflies',
    'cat',
    'cats',
    'dog',
    'dogs',
    'eagle',
    'eagles',
    'dolphin',
    'dolphins',
    'whale',
    'whales',
    'lion',
    'lions',
    'tiger',
    'tigers',
    'bear',
    'bears',
    'wolf',
    'wolves',
    'deer',
    'rabbit',
    'rabbits',
    'fox',
    'foxes',
    'owl',
    'owls',
    'crow',
    'crows',
    'raven',
    'ravens',
    'snake',
    'snakes',
    'lizard',
    'lizards',
    'frog',
    'frogs',
    'bee',
    'bees',
    'ant',
    'ants',
    'spider',
    'spiders',
  ],
  structures: [
    'house',
    'houses',
    'tower',
    'towers',
    'castle',
    'castles',
    'building',
    'buildings',
    'bridge',
    'bridges',
    'temple',
    'temples',
    'library',
    'libraries',
    'palace',
    'palaces',
    'fortress',
    'fortresses',
    'cathedral',
    'cathedrals',
    'pyramid',
    'pyramids',
    'monument',
    'monuments',
    'statue',
    'statues',
    'arch',
    'arches',
    'gate',
    'gates',
    'wall',
    'walls',
    'fence',
    'fences',
    'pillar',
    'pillars',
  ],
  objects: [
    'book',
    'books',
    'chair',
    'chairs',
    'table',
    'tables',
    'car',
    'cars',
    'boat',
    'boats',
    'ship',
    'ships',
    'flower',
    'flowers',
    'tree',
    'trees',
    'rock',
    'rocks',
    'crystal',
    'crystals',
    'orb',
    'orbs',
    'sphere',
    'spheres',
    'cube',
    'cubes',
    'star',
    'stars',
    'moon',
    'cloud',
    'clouds',
    'lamp',
    'lamps',
    'candle',
    'candles',
    'torch',
    'torches',
    'sword',
    'swords',
    'shield',
    'shields',
    'staff',
    'staffs',
  ],
  people: [
    'person',
    'people',
    'wizard',
    'wizards',
    'knight',
    'knights',
    'dancer',
    'dancers',
    'warrior',
    'warriors',
    'mage',
    'mages',
    'priest',
    'priests',
    'monk',
    'monks',
    'king',
    'queen',
    'prince',
    'princess',
    'child',
    'children',
    'figure',
    'figures',
    'silhouette',
    'silhouettes',
    'shadow',
    'shadows',
  ],
};

/**
 * Keyword mappings for action extraction
 */
const ACTION_KEYWORDS = {
  movement: [
    'run',
    'running',
    'walk',
    'walking',
    'fly',
    'flying',
    'swim',
    'swimming',
    'dance',
    'dancing',
    'jump',
    'jumping',
    'leap',
    'leaping',
    'glide',
    'gliding',
    'soar',
    'soaring',
    'crawl',
    'crawling',
    'climb',
    'climbing',
    'dive',
    'diving',
    'roll',
    'rolling',
    'slide',
    'sliding',
    'drift',
    'drifting',
    'collide',
    'colliding',
    'crash',
    'crashing',
    'impact',
    'impacting',
  ],
  states: [
    'float',
    'floating',
    'spin',
    'spinning',
    'glow',
    'glowing',
    'pulse',
    'pulsing',
    'shimmer',
    'shimmering',
    'flicker',
    'flickering',
    'rotate',
    'rotating',
    'hover',
    'hovering',
    'sway',
    'swaying',
    'vibrate',
    'vibrating',
    'oscillate',
    'oscillating',
    'twinkle',
    'twinkling',
    'sparkle',
    'sparkling',
  ],
};

/**
 * Keyword mappings for location extraction
 */
const LOCATION_KEYWORDS = {
  natural: [
    'beach',
    'beaches',
    'forest',
    'forests',
    'ocean',
    'oceans',
    'mountain',
    'mountains',
    'desert',
    'deserts',
    'sky',
    'skies',
    'valley',
    'valleys',
    'canyon',
    'canyons',
    'cave',
    'caves',
    'river',
    'rivers',
    'lake',
    'lakes',
    'pond',
    'ponds',
    'meadow',
    'meadows',
    'field',
    'fields',
    'jungle',
    'jungles',
    'island',
    'islands',
    'cliff',
    'cliffs',
    'waterfall',
    'waterfalls',
    'garden',
    'gardens',
    'grove',
    'groves',
  ],
  built: [
    'city',
    'cities',
    'room',
    'rooms',
    'castle',
    'castles',
    'library',
    'libraries',
    'temple',
    'temples',
    'palace',
    'palaces',
    'cathedral',
    'cathedrals',
    'tower',
    'towers',
    'dungeon',
    'dungeons',
    'hall',
    'halls',
    'chamber',
    'chambers',
    'courtyard',
    'courtyards',
    'street',
    'streets',
    'alley',
    'alleys',
    'plaza',
    'plazas',
    'arena',
    'arenas',
    'stadium',
    'stadiums',
    'theater',
    'theaters',
  ],
  abstract: [
    'void',
    'space',
    'dimension',
    'dimensions',
    'realm',
    'realms',
    'dreamscape',
    'dreamscapes',
    'limbo',
    'abyss',
    'nexus',
    'portal',
    'portals',
    'rift',
    'rifts',
    'plane',
    'planes',
  ],
};

/**
 * Patterns for quantity extraction
 */
const QUANTITY_PATTERNS = {
  numbers: {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    dozen: 12,
    twenty: 20,
    hundred: 100,
    thousand: 1000,
  },
  quantifiers: {
    a: 1,
    an: 1,
    single: 1,
    pair: 2,
    couple: 2,
    few: 3,
    several: 5,
    many: 10,
    numerous: 15,
    countless: 20,
    swarm: 20,
    flock: 15,
    herd: 10,
    group: 5,
    crowd: 20,
    multitude: 30,
  },
};

/**
 * Keyword mappings for mood inference
 */
const MOOD_KEYWORDS = {
  peaceful: [
    'calm',
    'serene',
    'gentle',
    'soft',
    'quiet',
    'tranquil',
    'peaceful',
    'relaxing',
    'soothing',
    'harmonious',
    'still',
  ],
  dramatic: [
    'intense',
    'powerful',
    'stormy',
    'dark',
    'dramatic',
    'epic',
    'fierce',
    'violent',
    'turbulent',
    'chaotic',
    'wild',
    'harsh',
  ],
  magical: [
    'mystical',
    'ethereal',
    'glowing',
    'enchanted',
    'magical',
    'mysterious',
    'arcane',
    'supernatural',
    'otherworldly',
    'luminous',
    'radiant',
    'shimmering',
    'sparkling',
  ],
  melancholic: [
    'sad',
    'melancholic',
    'lonely',
    'somber',
    'gloomy',
    'dreary',
    'desolate',
    'forlorn',
    'wistful',
    'nostalgic',
    'mournful',
  ],
  joyful: [
    'happy',
    'joyful',
    'cheerful',
    'bright',
    'vibrant',
    'lively',
    'playful',
    'energetic',
    'exuberant',
    'jubilant',
    'festive',
  ],
  mysterious: [
    'mysterious',
    'enigmatic',
    'cryptic',
    'obscure',
    'hidden',
    'secret',
    'shadowy',
    'veiled',
    'unknown',
    'strange',
    'eerie',
  ],
};

/**
 * Keyword mappings for time of day inference
 */
const TIME_KEYWORDS = {
  dawn: ['dawn', 'sunrise', 'morning', 'daybreak', 'early'],
  day: ['day', 'daytime', 'noon', 'midday', 'afternoon', 'bright'],
  dusk: ['dusk', 'sunset', 'evening', 'twilight', 'golden hour'],
  night: [
    'night',
    'nighttime',
    'midnight',
    'dark',
    'nocturnal',
    'moonlit',
    'starry',
  ],
};

/**
 * PromptAnalyzer class for extracting semantic information from user prompts
 */
class PromptAnalyzer {
  constructor() {
    this.entityKeywords = ENTITY_KEYWORDS;
    this.actionKeywords = ACTION_KEYWORDS;
    this.locationKeywords = LOCATION_KEYWORDS;
    this.quantityPatterns = QUANTITY_PATTERNS;
    this.moodKeywords = MOOD_KEYWORDS;
    this.timeKeywords = TIME_KEYWORDS;
  }

  /**
   * Main analysis method - extracts all semantic information from a prompt
   * @param {string} userPrompt - The user's input prompt
   * @returns {Object} Analysis results containing entities, actions, locations, etc.
   */
  analyze(userPrompt) {
    if (!userPrompt || typeof userPrompt !== 'string') {
      return this._getEmptyAnalysis();
    }

    const normalizedPrompt = userPrompt.toLowerCase().trim();
    const words = normalizedPrompt.split(/\s+/);

    const entities = this.extractEntities(words);
    const actions = this.extractActions(words);
    const locations = this.extractLocations(words);
    const quantities = this.extractQuantities(normalizedPrompt);
    const descriptors = this.extractDescriptors(words);
    const mood = this.inferMood(words);
    const timeOfDay = this.inferTimeOfDay(words);

    // Calculate confidence based on how much information we extracted
    const confidence = this._calculateConfidence({
      entities,
      actions,
      locations,
      quantities,
      descriptors,
      mood,
      timeOfDay,
    });

    return {
      entities,
      actions,
      locations,
      quantities,
      descriptors,
      mood,
      timeOfDay,
      confidence,
    };
  }

  /**
   * Extract entities (animals, structures, objects, people) from words
   * @param {string[]} words - Array of words from the prompt
   * @returns {string[]} Array of found entity types
   */
  extractEntities(words) {
    const foundEntities = new Set();

    // Check all entity categories
    for (const category of Object.values(this.entityKeywords)) {
      for (const keyword of category) {
        if (words.includes(keyword)) {
          // Normalize to singular form for consistency
          const normalized = this._normalizePlural(keyword);
          foundEntities.add(normalized);
        }
      }
    }

    return Array.from(foundEntities);
  }

  /**
   * Extract actions (movement and state verbs) from words
   * @param {string[]} words - Array of words from the prompt
   * @returns {string[]} Array of found actions
   */
  extractActions(words) {
    const foundActions = new Set();

    // Check all action categories
    for (const category of Object.values(this.actionKeywords)) {
      for (const keyword of category) {
        if (words.includes(keyword)) {
          // Normalize to base form (e.g., "running" -> "run")
          const normalized = this._normalizeVerb(keyword);
          foundActions.add(normalized);
        }
      }
    }

    return Array.from(foundActions);
  }

  /**
   * Extract locations (natural, built, abstract) from words
   * @param {string[]} words - Array of words from the prompt
   * @returns {string[]} Array of found locations
   */
  extractLocations(words) {
    const foundLocations = new Set();

    // Check all location categories
    for (const category of Object.values(this.locationKeywords)) {
      for (const keyword of category) {
        if (words.includes(keyword)) {
          // Normalize to singular form
          const normalized = this._normalizePlural(keyword);
          foundLocations.add(normalized);
        }
      }
    }

    return Array.from(foundLocations);
  }

  /**
   * Extract quantities from text (numbers and quantity words)
   * @param {string} text - The full prompt text
   * @returns {Object} Map of entity to quantity
   */
  extractQuantities(text) {
    const quantities = {};
    const words = text.toLowerCase().split(/\s+/);

    // Look for number patterns (e.g., "2 horses", "three birds")
    for (let i = 0; i < words.length - 1; i++) {
      const currentWord = words[i];
      const nextWord = words[i + 1];

      // Check for numeric digits
      if (/^\d+$/.test(currentWord)) {
        const count = parseInt(currentWord, 10);
        const entity = this._normalizePlural(nextWord);
        if (this._isEntity(nextWord)) {
          quantities[entity] = count;
        }
      }

      // Check for number words
      if (this.quantityPatterns.numbers[currentWord]) {
        const count = this.quantityPatterns.numbers[currentWord];
        const entity = this._normalizePlural(nextWord);
        if (this._isEntity(nextWord)) {
          quantities[entity] = count;
        }
      }

      // Check for quantifiers
      if (this.quantityPatterns.quantifiers[currentWord]) {
        const count = this.quantityPatterns.quantifiers[currentWord];
        const entity = this._normalizePlural(nextWord);
        if (this._isEntity(nextWord)) {
          quantities[entity] = count;
        }
      }
    }

    return quantities;
  }

  /**
   * Extract descriptive adjectives from words
   * @param {string[]} words - Array of words from the prompt
   * @returns {string[]} Array of descriptive words
   */
  extractDescriptors(words) {
    const descriptors = new Set();

    // Collect all mood-related descriptors
    for (const moodWords of Object.values(this.moodKeywords)) {
      for (const word of moodWords) {
        if (words.includes(word)) {
          descriptors.add(word);
        }
      }
    }

    // Add common descriptive adjectives
    const commonDescriptors = [
      'beautiful',
      'stunning',
      'amazing',
      'incredible',
      'gorgeous',
      'ancient',
      'modern',
      'futuristic',
      'medieval',
      'rustic',
      'large',
      'small',
      'huge',
      'tiny',
      'massive',
      'miniature',
      'colorful',
      'monochrome',
      'vivid',
      'pale',
      'bright',
      'dim',
      'fast',
      'slow',
      'quick',
      'gradual',
      'sudden',
    ];

    for (const descriptor of commonDescriptors) {
      if (words.includes(descriptor)) {
        descriptors.add(descriptor);
      }
    }

    return Array.from(descriptors);
  }

  /**
   * Infer mood from descriptive words
   * @param {string[]} words - Array of words from the prompt
   * @returns {string|null} Inferred mood or null
   */
  inferMood(words) {
    const moodScores = {};

    // Score each mood based on keyword matches
    for (const [mood, keywords] of Object.entries(this.moodKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (words.includes(keyword)) {
          score++;
        }
      }
      if (score > 0) {
        moodScores[mood] = score;
      }
    }

    // Return the mood with the highest score
    if (Object.keys(moodScores).length === 0) {
      return null;
    }

    return Object.entries(moodScores).sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Infer time of day from temporal indicators
   * @param {string[]} words - Array of words from the prompt
   * @returns {string|null} Inferred time of day or null
   */
  inferTimeOfDay(words) {
    // Check each time period
    for (const [timeOfDay, keywords] of Object.entries(this.timeKeywords)) {
      for (const keyword of keywords) {
        if (words.includes(keyword)) {
          return timeOfDay;
        }
      }
    }

    return null;
  }

  /**
   * Helper: Get empty analysis structure
   * @private
   */
  _getEmptyAnalysis() {
    return {
      entities: [],
      actions: [],
      locations: [],
      quantities: {},
      descriptors: [],
      mood: null,
      timeOfDay: null,
      confidence: 0,
    };
  }

  /**
   * Helper: Calculate confidence score based on extracted information
   * @private
   */
  _calculateConfidence(analysis) {
    let score = 0;
    const weights = {
      entities: 0.3,
      actions: 0.15,
      locations: 0.2,
      quantities: 0.1,
      descriptors: 0.1,
      mood: 0.075,
      timeOfDay: 0.075,
    };

    if (analysis.entities.length > 0) score += weights.entities;
    if (analysis.actions.length > 0) score += weights.actions;
    if (analysis.locations.length > 0) score += weights.locations;
    if (Object.keys(analysis.quantities).length > 0)
      score += weights.quantities;
    if (analysis.descriptors.length > 0) score += weights.descriptors;
    if (analysis.mood) score += weights.mood;
    if (analysis.timeOfDay) score += weights.timeOfDay;

    return Math.min(score, 1.0);
  }

  /**
   * Helper: Normalize plural forms to singular
   * @private
   */
  _normalizePlural(word) {
    // Handle special cases first
    const specialCases = {
      horses: 'horse',
      wolves: 'wolf',
      knives: 'knife',
      lives: 'life',
      leaves: 'leaf',
      thieves: 'thief',
    };

    if (specialCases[word]) {
      return specialCases[word];
    }

    // Simple pluralization rules
    if (word.endsWith('ies')) {
      return word.slice(0, -3) + 'y';
    }
    if (word.endsWith('ves')) {
      return word.slice(0, -3) + 'f';
    }
    if (word.endsWith('es') && word.length > 3) {
      // Check if it's a word that just adds 'es' (like 'boxes', 'churches')
      const base = word.slice(0, -2);
      if (
        base.endsWith('x') ||
        base.endsWith('ch') ||
        base.endsWith('sh') ||
        base.endsWith('s')
      ) {
        return base;
      }
      return word.slice(0, -2);
    }
    if (word.endsWith('s') && !word.endsWith('ss')) {
      return word.slice(0, -1);
    }
    return word;
  }

  /**
   * Helper: Normalize verb forms to base form
   * @private
   */
  _normalizeVerb(word) {
    // Simple verb normalization
    if (word.endsWith('ing')) {
      // Handle doubling (running -> run)
      const base = word.slice(0, -3);
      if (base.length >= 2 && base[base.length - 1] === base[base.length - 2]) {
        return base.slice(0, -1);
      }
      return base;
    }
    return word;
  }

  /**
   * Helper: Check if a word is a known entity
   * @private
   */
  _isEntity(word) {
    for (const category of Object.values(this.entityKeywords)) {
      if (
        category.includes(word) ||
        category.includes(this._normalizePlural(word))
      ) {
        return true;
      }
    }
    return false;
  }
}

module.exports = PromptAnalyzer;
