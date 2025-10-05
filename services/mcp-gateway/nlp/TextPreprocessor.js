/**
 * Text Preprocessor
 * Handles text normalization, punctuation, and tokenization
 */

class TextPreprocessor {
  constructor() {
    // Common stop words to filter out (optional)
    this.stopWords = new Set([
      'a',
      'an',
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'should',
      'could',
      'may',
      'might',
      'must',
      'can',
    ]);
  }

  /**
   * Normalize text - lowercase, trim, remove extra spaces
   * @param {string} text - Text to normalize
   * @returns {string} - Normalized text
   */
  normalize(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text.trim().toLowerCase().replace(/\s+/g, ' '); // Replace multiple spaces with single space
  }

  /**
   * Remove punctuation from text
   * @param {string} text - Text to clean
   * @param {boolean} keepHyphens - Whether to keep hyphens (default: true)
   * @returns {string} - Text without punctuation
   */
  removePunctuation(text, keepHyphens = true) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    if (keepHyphens) {
      // Remove all punctuation except hyphens
      return text.replace(/[^\w\s-]/g, '');
    } else {
      // Remove all punctuation including hyphens
      return text.replace(/[^\w\s]/g, '');
    }
  }

  /**
   * Handle capitalization - convert to title case, sentence case, etc.
   * @param {string} text - Text to process
   * @param {string} style - 'title', 'sentence', 'lower', 'upper'
   * @returns {string} - Text with specified capitalization
   */
  handleCapitalization(text, style = 'lower') {
    if (!text || typeof text !== 'string') {
      return '';
    }

    switch (style) {
      case 'title':
        // Title Case: Capitalize First Letter Of Each Word
        return text.replace(/\b\w/g, (char) => char.toUpperCase());

      case 'sentence':
        // Sentence case: Capitalize first letter only
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

      case 'upper':
        return text.toUpperCase();

      case 'lower':
      default:
        return text.toLowerCase();
    }
  }

  /**
   * Tokenize text into words
   * @param {string} text - Text to tokenize
   * @param {boolean} removeStopWords - Whether to remove stop words
   * @returns {Array<string>} - Array of tokens
   */
  tokenize(text, removeStopWords = false) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Split on whitespace and punctuation
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter((token) => token.length > 0);

    if (removeStopWords) {
      return tokens.filter((token) => !this.stopWords.has(token));
    }

    return tokens;
  }

  /**
   * Tokenize into sentences
   * @param {string} text - Text to tokenize
   * @returns {Array<string>} - Array of sentences
   */
  tokenizeSentences(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Split on sentence boundaries (., !, ?)
    return text
      .split(/[.!?]+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
  }

  /**
   * Clean and normalize text for NLP processing
   * @param {string} text - Text to clean
   * @param {Object} options - Cleaning options
   * @returns {string} - Cleaned text
   */
  clean(text, options = {}) {
    const {
      lowercase = true,
      removePunctuation = false,
      removeExtraSpaces = true,
      keepHyphens = true,
    } = options;

    if (!text || typeof text !== 'string') {
      return '';
    }

    let cleaned = text.trim();

    if (lowercase) {
      cleaned = cleaned.toLowerCase();
    }

    if (removePunctuation) {
      cleaned = this.removePunctuation(cleaned, keepHyphens);
    }

    if (removeExtraSpaces) {
      cleaned = cleaned.replace(/\s+/g, ' ');
    }

    return cleaned;
  }

  /**
   * Extract quoted phrases from text
   * @param {string} text - Text to process
   * @returns {Array<string>} - Array of quoted phrases
   */
  extractQuotedPhrases(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const singleQuotes = text.match(/'([^']+)'/g) || [];
    const doubleQuotes = text.match(/"([^"]+)"/g) || [];

    return [...singleQuotes, ...doubleQuotes].map((phrase) =>
      phrase.replace(/['"]/g, '')
    );
  }

  /**
   * Remove extra whitespace and normalize line breaks
   * @param {string} text - Text to process
   * @returns {string} - Text with normalized whitespace
   */
  normalizeWhitespace(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\t/g, ' ') // Replace tabs with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  /**
   * Expand contractions (e.g., "don't" -> "do not")
   * @param {string} text - Text to process
   * @returns {string} - Text with expanded contractions
   */
  expandContractions(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const contractions = {
      "won't": 'will not',
      "can't": 'cannot',
      "n't": ' not',
      "'re": ' are',
      "'s": ' is',
      "'d": ' would',
      "'ll": ' will',
      "'ve": ' have',
      "'m": ' am',
    };

    let expanded = text;
    for (const [contraction, expansion] of Object.entries(contractions)) {
      const regex = new RegExp(contraction, 'gi');
      expanded = expanded.replace(regex, expansion);
    }

    return expanded;
  }

  /**
   * Remove numbers from text
   * @param {string} text - Text to process
   * @returns {string} - Text without numbers
   */
  removeNumbers(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text.replace(/\d+/g, '');
  }

  /**
   * Get word count
   * @param {string} text - Text to count
   * @returns {number} - Number of words
   */
  wordCount(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    return this.tokenize(text).length;
  }
}

module.exports = TextPreprocessor;
