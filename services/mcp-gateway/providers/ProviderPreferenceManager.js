// providers/ProviderPreferenceManager.js
// Provider priority and preference management system

const EventEmitter = require('events');

/**
 * Provider Preference Manager
 * Manages provider priorities, preferences, and dynamic adjustments
 */
class ProviderPreferenceManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.preferences = new Map(); // provider_name -> preference_config
    this.priorities = new Map(); // provider_name -> priority_value
    this.dynamicAdjustments = new Map(); // provider_name -> adjustment_data
    this.userPreferences = new Map(); // user_id -> user_preferences
    this.contextualRules = []; // Array of contextual preference rules

    // Configuration
    this.config = {
      defaultPriority: options.defaultPriority || 50,
      maxPriority: options.maxPriority || 100,
      minPriority: options.minPriority || 0,
      dynamicAdjustmentEnabled: options.dynamicAdjustmentEnabled !== false,
      adjustmentDecayRate: options.adjustmentDecayRate || 0.1, // Per hour
      contextualRulesEnabled: options.contextualRulesEnabled !== false,
      ...options,
    };

    // Start dynamic adjustment decay if enabled
    if (this.config.dynamicAdjustmentEnabled) {
      this.startAdjustmentDecay();
    }

    console.log('Provider Preference Manager initialized');
  }

  /**
   * Set provider priority
   * @param {string} providerName - Provider name
   * @param {number} priority - Priority value (0-100)
   * @param {Object} options - Priority options
   */
  setProviderPriority(providerName, priority, options = {}) {
    if (
      priority < this.config.minPriority ||
      priority > this.config.maxPriority
    ) {
      throw new Error(
        `Priority must be between ${this.config.minPriority} and ${this.config.maxPriority}`
      );
    }

    const oldPriority =
      this.priorities.get(providerName) || this.config.defaultPriority;
    this.priorities.set(providerName, priority);

    // Record priority change
    this.emit('priorityChanged', {
      provider: providerName,
      oldPriority,
      newPriority: priority,
      reason: options.reason || 'manual',
      timestamp: Date.now(),
    });

    console.log(
      `Provider ${providerName} priority changed from ${oldPriority} to ${priority}`
    );
  }

  /**
   * Get provider priority
   * @param {string} providerName - Provider name
   * @returns {number} Provider priority
   */
  getProviderPriority(providerName) {
    const basePriority =
      this.priorities.get(providerName) || this.config.defaultPriority;
    const adjustment = this.getDynamicAdjustment(providerName);

    return Math.max(
      this.config.minPriority,
      Math.min(this.config.maxPriority, basePriority + adjustment)
    );
  }

  /**
   * Set provider preferences
   * @param {string} providerName - Provider name
   * @param {Object} preferences - Provider preferences
   */
  setProviderPreferences(providerName, preferences) {
    const existingPrefs = this.preferences.get(providerName) || {};
    const updatedPrefs = {
      ...existingPrefs,
      ...preferences,
      lastUpdated: Date.now(),
    };

    this.preferences.set(providerName, updatedPrefs);

    this.emit('preferencesUpdated', {
      provider: providerName,
      preferences: updatedPrefs,
      timestamp: Date.now(),
    });

    console.log(`Provider ${providerName} preferences updated`);
  }

  /**
   * Get provider preferences
   * @param {string} providerName - Provider name
   * @returns {Object} Provider preferences
   */
  getProviderPreferences(providerName) {
    return this.preferences.get(providerName) || {};
  }

  /**
   * Set user-specific provider preferences
   * @param {string} userId - User identifier
   * @param {Object} preferences - User preferences
   */
  setUserPreferences(userId, preferences) {
    const existingPrefs = this.userPreferences.get(userId) || {};
    const updatedPrefs = {
      ...existingPrefs,
      ...preferences,
      lastUpdated: Date.now(),
    };

    this.userPreferences.set(userId, updatedPrefs);

    this.emit('userPreferencesUpdated', {
      userId,
      preferences: updatedPrefs,
      timestamp: Date.now(),
    });

    console.log(`User ${userId} preferences updated`);
  }

  /**
   * Get user-specific provider preferences
   * @param {string} userId - User identifier
   * @returns {Object} User preferences
   */
  getUserPreferences(userId) {
    return this.userPreferences.get(userId) || {};
  }

  /**
   * Apply dynamic adjustment to provider priority
   * @param {string} providerName - Provider name
   * @param {number} adjustment - Adjustment value (-50 to +50)
   * @param {Object} options - Adjustment options
   */
  applyDynamicAdjustment(providerName, adjustment, options = {}) {
    if (!this.config.dynamicAdjustmentEnabled) {
      return;
    }

    const currentAdjustment = this.dynamicAdjustments.get(providerName) || {
      value: 0,
      lastUpdated: Date.now(),
      reason: '',
    };

    const newAdjustment = {
      value: Math.max(-50, Math.min(50, currentAdjustment.value + adjustment)),
      lastUpdated: Date.now(),
      reason: options.reason || 'performance',
      history: [
        ...(currentAdjustment.history || []).slice(-9), // Keep last 10 entries
        {
          adjustment,
          timestamp: Date.now(),
          reason: options.reason || 'performance',
        },
      ],
    };

    this.dynamicAdjustments.set(providerName, newAdjustment);

    this.emit('dynamicAdjustmentApplied', {
      provider: providerName,
      adjustment,
      totalAdjustment: newAdjustment.value,
      reason: options.reason,
      timestamp: Date.now(),
    });

    console.log(
      `Dynamic adjustment applied to ${providerName}: ${adjustment} (total: ${newAdjustment.value})`
    );
  }

  /**
   * Get dynamic adjustment for provider
   * @param {string} providerName - Provider name
   * @returns {number} Current dynamic adjustment
   */
  getDynamicAdjustment(providerName) {
    if (!this.config.dynamicAdjustmentEnabled) {
      return 0;
    }

    const adjustment = this.dynamicAdjustments.get(providerName);
    return adjustment ? adjustment.value : 0;
  }

  /**
   * Add contextual preference rule
   * @param {Object} rule - Contextual rule
   */
  addContextualRule(rule) {
    if (!this.config.contextualRulesEnabled) {
      return;
    }

    const ruleWithId = {
      id:
        rule.id ||
        `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...rule,
      created: Date.now(),
    };

    this.contextualRules.push(ruleWithId);

    this.emit('contextualRuleAdded', {
      rule: ruleWithId,
      timestamp: Date.now(),
    });

    console.log(`Contextual rule added: ${ruleWithId.id}`);
    return ruleWithId.id;
  }

  /**
   * Remove contextual preference rule
   * @param {string} ruleId - Rule identifier
   */
  removeContextualRule(ruleId) {
    const index = this.contextualRules.findIndex((rule) => rule.id === ruleId);
    if (index !== -1) {
      const removedRule = this.contextualRules.splice(index, 1)[0];

      this.emit('contextualRuleRemoved', {
        rule: removedRule,
        timestamp: Date.now(),
      });

      console.log(`Contextual rule removed: ${ruleId}`);
      return true;
    }
    return false;
  }

  /**
   * Apply contextual preferences based on request context
   * @param {Object} context - Request context
   * @returns {Object} Contextual preferences
   */
  applyContextualPreferences(context = {}) {
    if (
      !this.config.contextualRulesEnabled ||
      this.contextualRules.length === 0
    ) {
      return {};
    }

    const contextualPrefs = {
      providerAdjustments: {},
      preferredProviders: [],
      excludedProviders: [],
    };

    for (const rule of this.contextualRules) {
      if (this.evaluateRuleCondition(rule.condition, context)) {
        // Apply rule actions
        if (rule.actions) {
          if (rule.actions.adjustPriority) {
            Object.entries(rule.actions.adjustPriority).forEach(
              ([provider, adjustment]) => {
                contextualPrefs.providerAdjustments[provider] =
                  (contextualPrefs.providerAdjustments[provider] || 0) +
                  adjustment;
              }
            );
          }

          if (rule.actions.preferProviders) {
            contextualPrefs.preferredProviders.push(
              ...rule.actions.preferProviders
            );
          }

          if (rule.actions.excludeProviders) {
            contextualPrefs.excludedProviders.push(
              ...rule.actions.excludeProviders
            );
          }
        }
      }
    }

    return contextualPrefs;
  }

  /**
   * Evaluate rule condition against context
   * @param {Object} condition - Rule condition
   * @param {Object} context - Request context
   * @returns {boolean} Whether condition is met
   */
  evaluateRuleCondition(condition, context) {
    if (!condition) return true;

    // Simple condition evaluation - can be enhanced
    if (condition.quality && context.quality !== condition.quality) {
      return false;
    }

    if (
      condition.streaming !== undefined &&
      context.streaming !== condition.streaming
    ) {
      return false;
    }

    if (condition.timeOfDay) {
      const hour = new Date().getHours();
      const [start, end] = condition.timeOfDay;
      if (hour < start || hour > end) {
        return false;
      }
    }

    if (condition.userType && context.userType !== condition.userType) {
      return false;
    }

    if (
      condition.requestType &&
      context.requestType !== condition.requestType
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get comprehensive provider preferences for selection
   * @param {string} providerName - Provider name
   * @param {Object} context - Request context
   * @param {string} userId - User identifier (optional)
   * @returns {Object} Comprehensive preferences
   */
  getComprehensivePreferences(providerName, context = {}, userId = null) {
    const basePrefs = this.getProviderPreferences(providerName);
    const userPrefs = userId ? this.getUserPreferences(userId) : {};
    const contextualPrefs = this.applyContextualPreferences(context);

    const priority = this.getProviderPriority(providerName);
    const contextualAdjustment =
      contextualPrefs.providerAdjustments[providerName] || 0;

    return {
      basePriority:
        this.priorities.get(providerName) || this.config.defaultPriority,
      dynamicAdjustment: this.getDynamicAdjustment(providerName),
      contextualAdjustment,
      finalPriority: Math.max(
        this.config.minPriority,
        Math.min(this.config.maxPriority, priority + contextualAdjustment)
      ),
      preferences: {
        ...basePrefs,
        ...userPrefs.providerPreferences?.[providerName],
      },
      isPreferred:
        contextualPrefs.preferredProviders.includes(providerName) ||
        userPrefs.preferredProviders?.includes(providerName),
      isExcluded:
        contextualPrefs.excludedProviders.includes(providerName) ||
        userPrefs.excludedProviders?.includes(providerName),
    };
  }

  /**
   * Update provider performance and adjust preferences
   * @param {string} providerName - Provider name
   * @param {Object} performanceData - Performance metrics
   */
  updateProviderPerformance(providerName, performanceData) {
    if (!this.config.dynamicAdjustmentEnabled) {
      return;
    }

    const { success, responseTime, errorType } = performanceData;

    // Calculate adjustment based on performance
    let adjustment = 0;

    if (success) {
      // Positive adjustment for successful requests
      if (responseTime < 1000) {
        adjustment = 2; // Fast response bonus
      } else if (responseTime < 3000) {
        adjustment = 1; // Normal response
      }
    } else {
      // Negative adjustment for failures
      if (errorType === 'timeout') {
        adjustment = -3;
      } else if (errorType === 'rate_limit') {
        adjustment = -2;
      } else {
        adjustment = -1;
      }
    }

    if (adjustment !== 0) {
      this.applyDynamicAdjustment(providerName, adjustment, {
        reason: `performance_${success ? 'success' : 'failure'}`,
      });
    }
  }

  /**
   * Start dynamic adjustment decay process
   * @private
   */
  startAdjustmentDecay() {
    this.decayInterval = setInterval(() => {
      this.applyAdjustmentDecay();
    }, 3600000); // Every hour

    console.log('Dynamic adjustment decay started');
  }

  /**
   * Apply decay to dynamic adjustments
   * @private
   */
  applyAdjustmentDecay() {
    for (const [providerName, adjustment] of this.dynamicAdjustments) {
      const decayAmount = adjustment.value * this.config.adjustmentDecayRate;

      if (Math.abs(decayAmount) > 0.1) {
        const newValue = adjustment.value - decayAmount;

        this.dynamicAdjustments.set(providerName, {
          ...adjustment,
          value: Math.abs(newValue) < 0.1 ? 0 : newValue,
          lastUpdated: Date.now(),
        });
      }
    }
  }

  /**
   * Stop dynamic adjustment decay
   */
  stopAdjustmentDecay() {
    if (this.decayInterval) {
      clearInterval(this.decayInterval);
      this.decayInterval = null;
      console.log('Dynamic adjustment decay stopped');
    }
  }

  /**
   * Get preference statistics
   * @returns {Object} Preference statistics
   */
  getPreferenceStats() {
    const stats = {
      totalProviders: this.priorities.size,
      averagePriority: 0,
      dynamicAdjustments: this.dynamicAdjustments.size,
      contextualRules: this.contextualRules.length,
      userPreferences: this.userPreferences.size,
      priorityDistribution: {},
    };

    // Calculate average priority
    if (this.priorities.size > 0) {
      const totalPriority = Array.from(this.priorities.values()).reduce(
        (sum, p) => sum + p,
        0
      );
      stats.averagePriority = totalPriority / this.priorities.size;
    }

    // Priority distribution
    for (const priority of this.priorities.values()) {
      const bucket = Math.floor(priority / 10) * 10;
      stats.priorityDistribution[bucket] =
        (stats.priorityDistribution[bucket] || 0) + 1;
    }

    return stats;
  }

  /**
   * Export preferences configuration
   * @returns {Object} Exportable preferences data
   */
  exportPreferences() {
    return {
      priorities: Object.fromEntries(this.priorities),
      preferences: Object.fromEntries(this.preferences),
      dynamicAdjustments: Object.fromEntries(this.dynamicAdjustments),
      contextualRules: this.contextualRules,
      config: this.config,
      timestamp: Date.now(),
    };
  }

  /**
   * Import preferences configuration
   * @param {Object} data - Preferences data to import
   */
  importPreferences(data) {
    if (data.priorities) {
      this.priorities = new Map(Object.entries(data.priorities));
    }

    if (data.preferences) {
      this.preferences = new Map(Object.entries(data.preferences));
    }

    if (data.dynamicAdjustments) {
      this.dynamicAdjustments = new Map(
        Object.entries(data.dynamicAdjustments)
      );
    }

    if (data.contextualRules) {
      this.contextualRules = data.contextualRules;
    }

    this.emit('preferencesImported', {
      timestamp: Date.now(),
      dataTimestamp: data.timestamp,
    });

    console.log('Preferences imported successfully');
  }

  /**
   * Reset all preferences to defaults
   */
  resetPreferences() {
    this.priorities.clear();
    this.preferences.clear();
    this.dynamicAdjustments.clear();
    this.userPreferences.clear();
    this.contextualRules = [];

    this.emit('preferencesReset', {
      timestamp: Date.now(),
    });

    console.log('All preferences reset to defaults');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopAdjustmentDecay();
    this.removeAllListeners();
    this.priorities.clear();
    this.preferences.clear();
    this.dynamicAdjustments.clear();
    this.userPreferences.clear();
    this.contextualRules = [];
    console.log('Provider Preference Manager destroyed');
  }
}

module.exports = ProviderPreferenceManager;
