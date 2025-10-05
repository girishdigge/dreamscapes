/**
 * NLP Wrapper for Compromise.js
 * Provides a unified interface for natural language processing operations
 */

const nlp = require('compromise');

class NLPWrapper {
  constructor() {
    this.nlp = nlp;
  }

  /**
   * Parse text and return NLP document
   * @param {string} text - Text to parse
   * @returns {Object} - Compromise document object
   */
  parse(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input: text must be a non-empty string');
    }
    return this.nlp(text);
  }

  /**
   * Extract nouns from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of noun objects with metadata
   */
  extractNouns(text) {
    const doc = this.parse(text);
    const nouns = doc.nouns().out('array');

    return nouns.map((noun) => {
      const nounDoc = this.nlp(noun);
      return {
        text: noun,
        isPlural: nounDoc.has('#Plural'),
        isSingular: nounDoc.has('#Singular'),
        isProper: nounDoc.has('#ProperNoun'),
      };
    });
  }

  /**
   * Extract verbs from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of verb objects with metadata
   */
  extractVerbs(text) {
    const doc = this.parse(text);
    const verbs = doc.verbs().json();

    return verbs.map((verb) => {
      const verbDoc = this.nlp(verb.text);
      return {
        text: verb.text,
        isGerund: verbDoc.has('#Gerund'),
        isPastTense: verbDoc.has('#PastTense'),
        isPresentTense: verbDoc.has('#PresentTense'),
        isInfinitive: verbDoc.has('#Infinitive'),
      };
    });
  }

  /**
   * Extract adjectives from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of adjectives
   */
  extractAdjectives(text) {
    const doc = this.parse(text);
    return doc.adjectives().out('array');
  }

  /**
   * Extract numbers from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of number objects
   */
  extractNumbers(text) {
    const doc = this.parse(text);
    const numbers = doc.numbers().json();

    return numbers.map((num) => ({
      text: num.text,
      value: num.number || null,
    }));
  }

  /**
   * Extract prepositions from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of prepositions
   */
  extractPrepositions(text) {
    const doc = this.parse(text);
    return doc.match('#Preposition').out('array');
  }

  /**
   * Get sentence structure
   * @param {string} text - Text to analyze
   * @returns {Object} - Sentence structure with subjects, verbs, objects
   */
  getSentenceStructure(text) {
    const doc = this.parse(text);

    return {
      subjects: doc.match('#Noun+').out('array'),
      verbs: doc.verbs().out('array'),
      objects: doc.match('#Determiner? #Adjective* #Noun+').out('array'),
      adjectives: doc.adjectives().out('array'),
      prepositions: doc.match('#Preposition').out('array'),
    };
  }

  /**
   * Normalize text (lowercase, trim)
   * @param {string} text - Text to normalize
   * @returns {string} - Normalized text
   */
  normalize(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    return text.trim().toLowerCase();
  }

  /**
   * Check if text contains specific pattern
   * @param {string} text - Text to check
   * @param {string} pattern - Pattern to match
   * @returns {boolean} - True if pattern found
   */
  hasPattern(text, pattern) {
    const doc = this.parse(text);
    return doc.has(pattern);
  }

  /**
   * Get all terms with their tags
   * @param {string} text - Text to analyze
   * @returns {Array} - Array of terms with POS tags
   */
  getTermsWithTags(text) {
    const doc = this.parse(text);
    return doc
      .json()
      .map((sentence) =>
        sentence.terms.map((term) => ({
          text: term.text,
          tags: term.tags,
        }))
      )
      .flat();
  }
}

module.exports = NLPWrapper;
