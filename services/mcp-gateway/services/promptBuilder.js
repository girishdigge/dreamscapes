// services/mcp-gateway/services/promptBuilder.js
// Builds structured prompts using centralized templates from config/prompts.js

const PROMPTS = require('../config/prompts');

/**
 * Build a "parse dream" prompt
 * @param {string} description - raw user dream text
 * @param {string} style - requested style
 * @param {Object} options - additional options
 * @returns {string} formatted prompt
 */
function buildDreamParsePrompt(description, style = 'ethereal', options = {}) {
  return `${PROMPTS.parse}\n\nUser dream:\n${description}\n\nRequested style: ${style}`;
}

/**
 * Build a "patch dream" prompt
 * @param {Object} baseDream - existing dream JSON
 * @param {string} editInstruction - modification request
 * @param {Object} options - additional options
 * @returns {string} formatted prompt
 */
function buildPatchPrompt(baseDream, editInstruction, options = {}) {
  return `${PROMPTS.patch}\n\nBase Dream JSON:\n${JSON.stringify(
    baseDream,
    null,
    2
  )}\n\nEdit Instruction:\n${editInstruction}`;
}

/**
 * Build a "style enrichment" prompt
 * @param {Object} baseDream - existing dream JSON
 * @param {string} style - requested style (ethereal, noir, cyberpunk, etc.)
 * @param {Object} options - additional options
 * @returns {string} formatted prompt
 */
function buildStyleEnrichmentPrompt(baseDream, style, options = {}) {
  return `${PROMPTS.styleEnrich}\n\nBase Dream JSON:\n${JSON.stringify(
    baseDream,
    null,
    2
  )}\n\nRequested Style:\n${style}`;
}

// Legacy function names for backward compatibility
function buildParsePrompt(description) {
  return buildDreamParsePrompt(description);
}

function buildStylePrompt(baseDream, style) {
  return buildStyleEnrichmentPrompt(baseDream, style);
}

module.exports = {
  buildDreamParsePrompt,
  buildPatchPrompt,
  buildStyleEnrichmentPrompt,
  // Legacy exports
  buildParsePrompt,
  buildStylePrompt,
};
