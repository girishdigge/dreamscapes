// templates/ContextTemplates.js
// Context-aware templates for situational prompt enhancement

class ContextTemplates {
  constructor() {
    this.contexts = {
      user_preferences: {
        name: 'user_preferences',
        description: 'User-specific preferences and history',
        template_additions: (preferences) => `
USER PREFERENCES CONTEXT:
- Preferred visual styles: ${
          preferences.preferred_styles?.join(', ') || 'not specified'
        }
- Favorite themes: ${preferences.favorite_themes?.join(', ') || 'not specified'}
- Quality preference: ${preferences.quality_preference || 'standard'}
- Previous dream patterns: ${
          preferences.dream_patterns?.join(', ') || 'none recorded'
        }
- Avoid elements: ${preferences.avoid_elements?.join(', ') || 'none specified'}

Incorporate these preferences while maintaining the dream's core essence.`,
      },

      session_context: {
        name: 'session_context',
        description: 'Current session context and conversation flow',
        template_additions: (context) => `
SESSION CONTEXT:
- Previous dreams in session: ${context.previous_dreams?.length || 0}
- Current theme focus: ${context.theme_focus || 'general'}
- Session mood: ${context.mood || 'neutral'}
- Refinement iterations: ${context.refinement_count || 0}
- User feedback patterns: ${context.feedback_patterns?.join(', ') || 'none yet'}

Build upon the session's established themes and user interactions.`,
      },

      temporal_context: {
        name: 'temporal_context',
        description: 'Time-based context for seasonal or temporal relevance',
        template_additions: (temporal) => `
TEMPORAL CONTEXT:
- Current season: ${temporal.season || 'unknown'}
- Time of day preference: ${temporal.time_preference || 'any'}
- Cultural/seasonal events: ${temporal.events?.join(', ') || 'none'}
- Weather influence: ${temporal.weather_mood || 'neutral'}

Incorporate appropriate temporal elements that enhance the dream's atmosphere.`,
      },

      technical_context: {
        name: 'technical_context',
        description: 'Technical constraints and capabilities',
        template_additions: (technical) => `
TECHNICAL CONTEXT:
- Target platform: ${technical.platform || 'web'}
- Performance constraints: ${technical.performance_level || 'standard'}
- Available effects: ${
          technical.available_effects?.join(', ') || 'standard set'
        }
- Rendering capabilities: ${technical.rendering_level || 'standard'}
- Output format requirements: ${technical.output_format || 'standard JSON'}

Optimize the dream design for the specified technical constraints.`,
      },

      narrative_context: {
        name: 'narrative_context',
        description: 'Narrative and storytelling context',
        template_additions: (narrative) => `
NARRATIVE CONTEXT:
- Story arc position: ${narrative.arc_position || 'standalone'}
- Character presence: ${narrative.characters?.join(', ') || 'none specified'}
- Emotional journey: ${narrative.emotional_arc || 'neutral'}
- Symbolic elements: ${narrative.symbols?.join(', ') || 'none specified'}
- Narrative themes: ${narrative.themes?.join(', ') || 'general'}

Enhance the dream's narrative elements and emotional resonance.`,
      },

      collaborative_context: {
        name: 'collaborative_context',
        description: 'Multi-user or collaborative dream building context',
        template_additions: (collaborative) => `
COLLABORATIVE CONTEXT:
- Contributors: ${collaborative.contributors?.length || 1} user(s)
- Shared themes: ${
          collaborative.shared_themes?.join(', ') || 'none established'
        }
- Collaboration style: ${collaborative.style || 'individual'}
- Merged elements: ${collaborative.merged_elements?.join(', ') || 'none yet'}
- Group preferences: ${
          collaborative.group_preferences?.join(', ') || 'none specified'
        }

Balance individual vision with collaborative elements and shared themes.`,
      },
    };
  }

  getContext(name) {
    return this.contexts[name] || null;
  }

  getAllContexts() {
    return Object.keys(this.contexts);
  }

  applyContextToTemplate(templateContent, contextName, contextData = {}) {
    const context = this.getContext(contextName);
    if (!context) {
      return templateContent;
    }

    const contextAdditions = context.template_additions(contextData);
    const contextualContent = templateContent + '\n\n' + contextAdditions;

    return {
      content: contextualContent,
      context: contextName,
      context_data: contextData,
    };
  }

  applyMultipleContexts(templateContent, contexts = {}) {
    let enhancedContent = templateContent;
    const appliedContexts = [];

    Object.entries(contexts).forEach(([contextName, contextData]) => {
      const context = this.getContext(contextName);
      if (context && contextData) {
        const contextAdditions = context.template_additions(contextData);
        enhancedContent += '\n\n' + contextAdditions;
        appliedContexts.push({
          name: contextName,
          data: contextData,
        });
      }
    });

    return {
      content: enhancedContent,
      applied_contexts: appliedContexts,
    };
  }

  buildContextFromHistory(userHistory = {}) {
    const context = {};

    // Extract user preferences from history
    if (userHistory.dreams && userHistory.dreams.length > 0) {
      const dreams = userHistory.dreams;
      context.user_preferences = {
        preferred_styles: this.extractPreferredStyles(dreams),
        favorite_themes: this.extractFavoriteThemes(dreams),
        quality_preference: this.extractQualityPreference(dreams),
        dream_patterns: this.extractDreamPatterns(dreams),
      };
    }

    // Extract session context
    if (userHistory.current_session) {
      context.session_context = {
        previous_dreams: userHistory.current_session.dreams || [],
        theme_focus: userHistory.current_session.theme || 'general',
        mood: userHistory.current_session.mood || 'neutral',
        refinement_count: userHistory.current_session.refinements || 0,
      };
    }

    return context;
  }

  extractPreferredStyles(dreams) {
    const styleCount = {};
    dreams.forEach((dream) => {
      if (dream.style) {
        styleCount[dream.style] = (styleCount[dream.style] || 0) + 1;
      }
    });

    return Object.entries(styleCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([style]) => style);
  }

  extractFavoriteThemes(dreams) {
    const themes = new Set();
    dreams.forEach((dream) => {
      if (dream.themes) {
        dream.themes.forEach((theme) => themes.add(theme));
      }
    });
    return Array.from(themes).slice(0, 5);
  }

  extractQualityPreference(dreams) {
    const qualityCount = {};
    dreams.forEach((dream) => {
      if (dream.quality) {
        qualityCount[dream.quality] = (qualityCount[dream.quality] || 0) + 1;
      }
    });

    const mostUsed = Object.entries(qualityCount).sort(
      ([, a], [, b]) => b - a
    )[0];

    return mostUsed ? mostUsed[0] : 'standard';
  }

  extractDreamPatterns(dreams) {
    const patterns = new Set();
    dreams.forEach((dream) => {
      if (dream.description) {
        // Simple pattern extraction - could be enhanced with NLP
        const words = dream.description.toLowerCase().split(' ');
        words.forEach((word) => {
          if (
            word.length > 4 &&
            !['dream', 'dreamed', 'dreaming'].includes(word)
          ) {
            patterns.add(word);
          }
        });
      }
    });
    return Array.from(patterns).slice(0, 10);
  }

  validateContext(contextName, contextData) {
    const context = this.getContext(contextName);
    if (!context) return false;

    // Basic validation - could be enhanced based on specific context requirements
    return typeof contextData === 'object' && contextData !== null;
  }

  getContextPriority(contextName) {
    const priorities = {
      user_preferences: 1,
      session_context: 2,
      narrative_context: 3,
      technical_context: 4,
      temporal_context: 5,
      collaborative_context: 6,
    };
    return priorities[contextName] || 10;
  }

  mergeContexts(contexts = {}) {
    // Sort contexts by priority
    const sortedContexts = Object.entries(contexts).sort(
      ([a], [b]) => this.getContextPriority(a) - this.getContextPriority(b)
    );

    let mergedContext = {};
    sortedContexts.forEach(([contextName, contextData]) => {
      mergedContext[contextName] = contextData;
    });

    return mergedContext;
  }
}

module.exports = ContextTemplates;
