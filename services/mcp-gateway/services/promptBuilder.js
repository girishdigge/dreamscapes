// services/mcp-gateway/services/promptBuilder.js
// Builds structured prompts using centralized templates from config/prompts.js

const PROMPTS = require('../config/prompts');
const PromptAnalyzer = require('./PromptAnalyzer');

/**
 * PromptBuilder class for building context-aware prompts with analysis
 */
class PromptBuilder {
  constructor() {
    this.analyzer = new PromptAnalyzer();
  }

  /**
   * Build a "parse dream" prompt with analysis integration
   * @param {string} description - raw user dream text
   * @param {string} style - requested style
   * @param {Object} options - additional options
   * @returns {Object} Object containing prompt, analysis, and expectedElements
   */
  buildPrompt(description, style = 'ethereal', options = {}) {
    // Analyze the user's prompt
    const analysis = this.analyzer.analyze(description);

    // Build the base prompt
    let prompt = `${PROMPTS.parse}\n\n`;

    // Add analysis context if we found meaningful information
    if (analysis.confidence > 0) {
      prompt += this.addAnalysisContext(analysis, description);
    }

    // Add the original user input and style
    prompt += `User dream:\n${description}\n\nRequested style: ${style}`;

    // Extract expected elements for validation
    const expectedElements = this.getExpectedElements(analysis);

    return {
      prompt,
      analysis,
      expectedElements,
      metadata: {
        originalPrompt: description,
        style,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Add analysis context to inject specific requirements into the prompt
   * @param {Object} analysis - Analysis results from PromptAnalyzer
   * @param {string} originalText - Original user prompt
   * @returns {string} Formatted analysis context section
   */
  addAnalysisContext(analysis, originalText) {
    let context = '\n--- SPECIFIC REQUIREMENTS FOR THIS PROMPT ---\n';
    context += `User said: "${originalText}"\n\n`;
    context += 'You MUST include:\n';

    // Add required entities
    if (analysis.entities.length > 0) {
      context += '\nEntities/Structures:\n';
      analysis.entities.forEach((entity) => {
        // Check if we have a specific quantity for this entity
        const quantity = analysis.quantities[entity];
        if (quantity) {
          context += `- Exactly ${quantity} entity/structure with type: "${entity}"\n`;
        } else {
          context += `- Entity or structure with type: "${entity}"\n`;
        }
      });
    }

    // Add required environment based on locations
    if (analysis.locations.length > 0) {
      context += '\nEnvironment:\n';
      context += `- Environment matching: ${analysis.locations.join(' or ')}\n`;
      context += `- Choose appropriate preset (ocean, forest, dusk, etc.) that matches these locations\n`;
    }

    // Add action-based requirements
    if (analysis.actions.length > 0) {
      context += '\nEntity Behaviors:\n';
      analysis.actions.forEach((action) => {
        context += `- Configure entity params for "${action}" behavior (adjust speed, movement patterns)\n`;
      });
    }

    // Add mood and time of day requirements
    if (analysis.mood || analysis.timeOfDay) {
      context += '\nAtmosphere:\n';
      if (analysis.mood) {
        context += `- Set mood to: ${analysis.mood}\n`;
      }
      if (analysis.timeOfDay) {
        context += `- Set time of day to: ${analysis.timeOfDay}\n`;
        context += `- Adjust lighting and colors accordingly\n`;
      }
    }

    // Add descriptors if present
    if (analysis.descriptors.length > 0) {
      context += '\nStyle Notes:\n';
      context += `- Incorporate these qualities: ${analysis.descriptors.join(
        ', '
      )}\n`;
    }

    context += '\n--- END SPECIFIC REQUIREMENTS ---\n\n';

    return context;
  }

  /**
   * Extract expected elements from analysis for validation
   * @param {Object} analysis - Analysis results from PromptAnalyzer
   * @returns {Object} Expected elements (entities, structures, environment)
   */
  getExpectedElements(analysis) {
    const expectedElements = {
      entities: [],
      structures: [],
      environment: null,
    };

    // Categorize entities into entities vs structures
    // Simple heuristic: structures are typically buildings/large objects
    const structureKeywords = [
      'house',
      'tower',
      'castle',
      'building',
      'bridge',
      'temple',
      'library',
      'palace',
      'fortress',
      'cathedral',
      'pyramid',
      'monument',
      'statue',
      'arch',
      'gate',
      'wall',
      'fence',
      'pillar',
    ];

    analysis.entities.forEach((entity) => {
      if (structureKeywords.includes(entity)) {
        expectedElements.structures.push(entity);
      } else {
        expectedElements.entities.push(entity);
      }
    });

    // Set expected environment based on locations
    if (analysis.locations.length > 0) {
      expectedElements.environment = analysis.locations[0]; // Use first location as primary
    }

    return expectedElements;
  }

  /**
   * Build a "patch dream" prompt
   * @param {Object} baseDream - existing dream JSON
   * @param {string} editInstruction - modification request
   * @param {Object} options - additional options
   * @returns {string} formatted prompt
   */
  buildPatchPrompt(baseDream, editInstruction, options = {}) {
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
  buildStyleEnrichmentPrompt(baseDream, style, options = {}) {
    return `${PROMPTS.styleEnrich}\n\nBase Dream JSON:\n${JSON.stringify(
      baseDream,
      null,
      2
    )}\n\nRequested Style:\n${style}`;
  }
}

// Create singleton instance
const promptBuilder = new PromptBuilder();

/**
 * Build a "parse dream" prompt (backward compatible function)
 * @param {string} description - raw user dream text
 * @param {string} style - requested style
 * @param {Object} options - additional options
 * @returns {string} formatted prompt (for backward compatibility, returns just the prompt string)
 */
function buildDreamParsePrompt(description, style = 'ethereal', options = {}) {
  const result = promptBuilder.buildPrompt(description, style, options);
  // For backward compatibility, return just the prompt string
  return result.prompt;
}

/**
 * Build a "patch dream" prompt (backward compatible function)
 * @param {Object} baseDream - existing dream JSON
 * @param {string} editInstruction - modification request
 * @param {Object} options - additional options
 * @returns {string} formatted prompt
 */
function buildPatchPrompt(baseDream, editInstruction, options = {}) {
  return promptBuilder.buildPatchPrompt(baseDream, editInstruction, options);
}

/**
 * Build a "style enrichment" prompt (backward compatible function)
 * @param {Object} baseDream - existing dream JSON
 * @param {string} style - requested style (ethereal, noir, cyberpunk, etc.)
 * @param {Object} options - additional options
 * @returns {string} formatted prompt
 */
function buildStyleEnrichmentPrompt(baseDream, style, options = {}) {
  return promptBuilder.buildStyleEnrichmentPrompt(baseDream, style, options);
}

// Legacy function names for backward compatibility
function buildParsePrompt(description) {
  return buildDreamParsePrompt(description);
}

function buildStylePrompt(baseDream, style) {
  return buildStyleEnrichmentPrompt(baseDream, style);
}

module.exports = {
  // Main class export for advanced usage
  PromptBuilder,
  promptBuilder, // Singleton instance
  // Function exports for backward compatibility
  buildDreamParsePrompt,
  buildPatchPrompt,
  buildStyleEnrichmentPrompt,
  // Legacy exports
  buildParsePrompt,
  buildStylePrompt,
};
