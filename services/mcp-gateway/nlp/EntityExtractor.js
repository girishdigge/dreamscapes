/**
 * Entity Extractor
 * Extracts and classifies entities (nouns) from text
 * Identifies singular/plural, proper nouns, and collective nouns
 */

const NLPWrapper = require('./NLPWrapper');
const TextPreprocessor = require('./TextPreprocessor');

class EntityExtractor {
  constructor() {
    this.nlp = new NLPWrapper();
    this.preprocessor = new TextPreprocessor();

    // Collective nouns with typical counts
    this.collectiveNouns = {
      // Animals
      herd: { type: 'animal', count: [6, 10] },
      flock: { type: 'bird', count: [10, 20] },
      swarm: { type: 'insect', count: [20, 50] },
      pack: { type: 'animal', count: [5, 10] },
      pride: { type: 'animal', count: [5, 8] },
      school: { type: 'fish', count: [10, 30] },
      pod: { type: 'marine', count: [5, 15] },
      colony: { type: 'animal', count: [20, 100] },
      gaggle: { type: 'bird', count: [8, 15] },
      murder: { type: 'bird', count: [10, 20] },

      // People
      crowd: { type: 'person', count: [20, 50] },
      group: { type: 'person', count: [5, 15] },
      team: { type: 'person', count: [5, 12] },
      army: { type: 'person', count: [50, 200] },
      crew: { type: 'person', count: [5, 20] },

      // Objects
      fleet: { type: 'vehicle', count: [5, 15] },
      armada: { type: 'ship', count: [10, 30] },
      squadron: { type: 'vehicle', count: [5, 12] },
      cluster: { type: 'object', count: [5, 15] },
      collection: { type: 'object', count: [5, 20] },
      set: { type: 'object', count: [3, 10] },
      bunch: { type: 'object', count: [5, 15] },
      pile: { type: 'object', count: [5, 20] },
    };

    // Quantifiers with approximate counts
    this.quantifiers = {
      few: [2, 3],
      several: [4, 6],
      some: [3, 7],
      many: [10, 15],
      numerous: [15, 25],
      countless: [30, 50],
      multiple: [3, 5],
      various: [4, 8],
    };
  }

  /**
   * Extract all entities from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of entity objects
   */
  extractEntities(text) {
    const nouns = this.nlp.extractNouns(text);
    const numbers = this.nlp.extractNumbers(text);

    return nouns.map((noun) => {
      const entity = {
        text: noun.text,
        isPlural: noun.isPlural,
        isSingular: noun.isSingular,
        isProper: noun.isProper,
        count: this.inferCount(noun, text, numbers),
        type: this.classifyEntity(noun.text),
        isCollective: this.isCollectiveNoun(noun.text),
      };

      return entity;
    });
  }

  /**
   * Infer count from entity and context
   * @param {Object} noun - Noun object from NLP
   * @param {string} text - Full text for context
   * @param {Array} numbers - Extracted numbers
   * @returns {number|Array} - Inferred count or range
   */
  inferCount(noun, text, numbers) {
    const nounText = noun.text.toLowerCase();

    // Check for explicit numbers
    for (const num of numbers) {
      if (nounText.includes(num.text.toLowerCase())) {
        return num.value?.num || 1;
      }
    }

    // Check for collective nouns
    const words = this.preprocessor.tokenize(nounText);
    for (const word of words) {
      if (this.collectiveNouns[word]) {
        const range = this.collectiveNouns[word].count;
        return Math.floor((range[0] + range[1]) / 2); // Return average
      }
    }

    // Check for quantifiers
    const textLower = text.toLowerCase();
    for (const [quantifier, range] of Object.entries(this.quantifiers)) {
      if (textLower.includes(quantifier) && textLower.includes(nounText)) {
        return Math.floor((range[0] + range[1]) / 2); // Return average
      }
    }

    // Default inference based on singular/plural
    if (noun.isSingular) {
      return 1;
    } else if (noun.isPlural) {
      // Default plural count
      return 3;
    }

    return 1; // Default fallback
  }

  /**
   * Classify entity type
   * @param {string} text - Entity text
   * @returns {string} - Entity type
   */
  classifyEntity(text) {
    const textLower = text.toLowerCase();

    // Animal keywords
    if (
      /dragon|bird|fish|animal|creature|beast|horse|dog|cat|lion|tiger|bear|wolf|eagle|hawk|butterfly|bee|whale|dolphin|shark/.test(
        textLower
      )
    ) {
      return 'living_creature';
    }

    // Person keywords
    if (
      /person|people|human|man|woman|child|warrior|knight|wizard|mage|hero/.test(
        textLower
      )
    ) {
      return 'person';
    }

    // Vehicle keywords
    if (
      /ship|boat|car|vehicle|plane|aircraft|spaceship|rocket|submarine/.test(
        textLower
      )
    ) {
      return 'vehicle';
    }

    // Structure keywords
    if (
      /castle|tower|building|house|temple|palace|fortress|wall|gate|bridge/.test(
        textLower
      )
    ) {
      return 'structure';
    }

    // Natural elements
    if (
      /mountain|ocean|sea|river|lake|forest|tree|cloud|sky|sun|moon|star|planet/.test(
        textLower
      )
    ) {
      return 'natural_element';
    }

    // Celestial objects
    if (
      /star|planet|moon|comet|asteroid|galaxy|nebula|cosmos/.test(textLower)
    ) {
      return 'celestial';
    }

    return 'generic';
  }

  /**
   * Check if text contains a collective noun
   * @param {string} text - Text to check
   * @returns {boolean} - True if collective noun found
   */
  isCollectiveNoun(text) {
    const words = this.preprocessor.tokenize(text.toLowerCase());
    return words.some((word) => this.collectiveNouns.hasOwnProperty(word));
  }

  /**
   * Extract proper nouns (names, places)
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of proper nouns
   */
  extractProperNouns(text) {
    const entities = this.extractEntities(text);
    return entities.filter((entity) => entity.isProper);
  }

  /**
   * Extract plural entities
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of plural entities
   */
  extractPluralEntities(text) {
    const entities = this.extractEntities(text);
    return entities.filter((entity) => entity.isPlural);
  }

  /**
   * Extract singular entities
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of singular entities
   */
  extractSingularEntities(text) {
    const entities = this.extractEntities(text);
    return entities.filter((entity) => entity.isSingular);
  }

  /**
   * Get total entity count from text
   * @param {string} text - Text to analyze
   * @returns {number} - Total count of all entities
   */
  getTotalEntityCount(text) {
    const entities = this.extractEntities(text);
    return entities.reduce((total, entity) => {
      const count = Array.isArray(entity.count)
        ? Math.floor((entity.count[0] + entity.count[1]) / 2)
        : entity.count;
      return total + count;
    }, 0);
  }

  /**
   * Group entities by type
   * @param {string} text - Text to analyze
   * @returns {Object} - Entities grouped by type
   */
  groupEntitiesByType(text) {
    const entities = this.extractEntities(text);
    const grouped = {};

    entities.forEach((entity) => {
      if (!grouped[entity.type]) {
        grouped[entity.type] = [];
      }
      grouped[entity.type].push(entity);
    });

    return grouped;
  }

  /**
   * Extract main subject from text
   * @param {string} text - Text to analyze
   * @returns {Object|null} - Main subject entity
   */
  extractMainSubject(text) {
    const entities = this.extractEntities(text);

    // Return first entity as main subject
    // In future, could use more sophisticated logic
    return entities.length > 0 ? entities[0] : null;
  }

  /**
   * Check if text contains multiple entities
   * @param {string} text - Text to analyze
   * @returns {boolean} - True if multiple entities found
   */
  hasMultipleEntities(text) {
    const entities = this.extractEntities(text);
    return entities.length > 1;
  }
}

module.exports = EntityExtractor;
