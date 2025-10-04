// providers/ProviderSelector.js
// Enhanced provider selection and load balancing logic

const EventEmitter = require('events');

/**
 * Provider Selection Strategies
 */
class ProviderSelectionStrategies {
  /**
   * Weighted selection based on performance metrics and availability
   * @param {Array} providers - Available providers with metrics
   * @param {Object} requirements - Selection requirements
   * @returns {Object} Selected provider
   */
  static weighted(providers, requirements = {}) {
    if (!providers || providers.length === 0) {
      throw new Error('No providers available for weighted selection');
    }

    // Calculate weighted scores for each provider
    const scoredProviders = providers.map((provider) => {
      const score = this.calculateProviderScore(provider, requirements);
      return { ...provider, selectionScore: score };
    });

    // Sort by score (highest first)
    scoredProviders.sort((a, b) => b.selectionScore - a.selectionScore);

    // Use weighted random selection from top providers
    const totalScore = scoredProviders.reduce(
      (sum, p) => sum + Math.max(p.selectionScore, 1),
      0
    );
    let random = Math.random() * totalScore;

    for (const provider of scoredProviders) {
      random -= Math.max(provider.selectionScore, 1);
      if (random <= 0) {
        return provider;
      }
    }

    // Fallback to highest scored provider
    return scoredProviders[0];
  }

  /**
   * Round-robin selection with performance awareness
   * @param {Array} providers - Available providers
   * @param {Object} state - Round-robin state
   * @returns {Object} Selected provider
   */
  static roundRobin(providers, state = {}) {
    if (!providers || providers.length === 0) {
      throw new Error('No providers available for round-robin selection');
    }

    // Filter out unhealthy providers
    const healthyProviders = providers.filter(
      (p) => p.health?.isHealthy !== false && p.metrics?.successRate > 0.5
    );

    if (healthyProviders.length === 0) {
      // Fallback to all providers if none are healthy
      return providers[state.roundRobinIndex % providers.length];
    }

    const selectedProvider =
      healthyProviders[state.roundRobinIndex % healthyProviders.length];
    state.roundRobinIndex = (state.roundRobinIndex || 0) + 1;

    return selectedProvider;
  }

  /**
   * Least connections selection
   * @param {Array} providers - Available providers
   * @returns {Object} Selected provider
   */
  static leastConnections(providers) {
    if (!providers || providers.length === 0) {
      throw new Error('No providers available for least connections selection');
    }

    return providers.reduce((best, current) => {
      const bestConnections = best.metrics?.activeConnections || 0;
      const currentConnections = current.metrics?.activeConnections || 0;

      return currentConnections < bestConnections ? current : best;
    });
  }

  /**
   * Response time based selection (fastest first)
   * @param {Array} providers - Available providers
   * @returns {Object} Selected provider
   */
  static fastestResponse(providers) {
    if (!providers || providers.length === 0) {
      throw new Error('No providers available for fastest response selection');
    }

    return providers.reduce((best, current) => {
      const bestTime = best.metrics?.avgResponseTime || Infinity;
      const currentTime = current.metrics?.avgResponseTime || Infinity;

      return currentTime < bestTime ? current : best;
    });
  }

  /**
   * Priority-based selection with fallback
   * @param {Array} providers - Available providers
   * @param {Object} requirements - Selection requirements
   * @returns {Object} Selected provider
   */
  static priority(providers, requirements = {}) {
    if (!providers || providers.length === 0) {
      throw new Error('No providers available for priority selection');
    }

    // Sort by priority (higher priority first)
    const sortedProviders = [...providers].sort((a, b) => {
      const aPriority = a.config?.priority || 0;
      const bPriority = b.config?.priority || 0;
      return bPriority - aPriority;
    });

    // Apply requirements filtering
    let candidates = sortedProviders;

    if (requirements.preferredProviders?.length > 0) {
      const preferred = candidates.filter((p) =>
        requirements.preferredProviders.includes(p.name)
      );
      if (preferred.length > 0) {
        candidates = preferred;
      }
    }

    if (requirements.excludeProviders?.length > 0) {
      candidates = candidates.filter(
        (p) => !requirements.excludeProviders.includes(p.name)
      );
    }

    if (candidates.length === 0) {
      throw new Error('No providers match the specified requirements');
    }

    return candidates[0];
  }

  /**
   * Calculate provider score for weighted selection
   * @param {Object} provider - Provider with metrics
   * @param {Object} requirements - Selection requirements
   * @returns {number} Provider score
   */
  static calculateProviderScore(provider, requirements = {}) {
    let score = 0;

    // Base priority score (0-100)
    const priority = provider.config?.priority || 1;
    score += priority * 20;

    // Success rate score (0-50)
    const successRate = provider.metrics?.successRate || 0;
    score += successRate * 50;

    // Response time score (0-30, lower time = higher score)
    const avgResponseTime = provider.metrics?.avgResponseTime || 10000;
    const responseTimeScore = Math.max(0, 30 - avgResponseTime / 1000);
    score += responseTimeScore;

    // Health score (0-20)
    if (provider.health?.isHealthy) {
      score += 20;
    }

    // Consecutive failures penalty
    const consecutiveFailures = provider.health?.consecutiveFailures || 0;
    score -= consecutiveFailures * 5;

    // Recent activity bonus (0-10)
    const lastRequestTime = provider.metrics?.lastRequestTime;
    if (lastRequestTime && Date.now() - lastRequestTime < 300000) {
      // 5 minutes
      score += 10;
    }

    // Requirements-based adjustments
    if (requirements.preferredProviders?.includes(provider.name)) {
      score += 25; // Bonus for preferred providers
    }

    if (
      requirements.quality === 'high' &&
      provider.config?.capabilities?.highQuality
    ) {
      score += 15; // Bonus for high-quality capable providers
    }

    if (requirements.streaming && provider.config?.capabilities?.streaming) {
      score += 10; // Bonus for streaming capable providers
    }

    // Load balancing adjustment
    const activeConnections = provider.metrics?.activeConnections || 0;
    const maxConnections = provider.config?.limits?.maxConcurrent || 10;
    const loadRatio = activeConnections / maxConnections;
    score -= loadRatio * 20; // Penalty for high load

    return Math.max(score, 0);
  }
}

/**
 * Enhanced Load Balancer with multiple strategies and performance monitoring
 */
class EnhancedLoadBalancer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.strategy = options.strategy || 'weighted';
    this.strategies = {
      weighted: ProviderSelectionStrategies.weighted,
      'round-robin': ProviderSelectionStrategies.roundRobin,
      'least-connections': ProviderSelectionStrategies.leastConnections,
      'fastest-response': ProviderSelectionStrategies.fastestResponse,
      priority: ProviderSelectionStrategies.priority,
    };

    // State for stateful strategies
    this.state = {
      roundRobinIndex: 0,
      lastSelectionTime: null,
      selectionHistory: [],
      strategyMetrics: {},
    };

    // Configuration
    this.config = {
      historySize: options.historySize || 100,
      adaptiveStrategy: options.adaptiveStrategy !== false,
      strategyEvaluationInterval: options.strategyEvaluationInterval || 300000, // 5 minutes
      ...options,
    };

    // Start adaptive strategy evaluation if enabled
    if (this.config.adaptiveStrategy) {
      this.startAdaptiveEvaluation();
    }

    console.log(
      `Enhanced Load Balancer initialized with strategy: ${this.strategy}`
    );
  }

  /**
   * Select the best provider using the configured strategy
   * @param {Array} providers - Available providers
   * @param {Object} requirements - Selection requirements
   * @returns {Object} Selected provider with selection metadata
   */
  selectProvider(providers, requirements = {}) {
    if (!providers || providers.length === 0) {
      throw new Error('No providers available for selection');
    }

    const startTime = Date.now();

    try {
      // Apply pre-filtering
      let candidates = this.preFilterProviders(providers, requirements);

      if (candidates.length === 0) {
        throw new Error('No providers match the selection criteria');
      }

      // Use strategy override if specified in requirements
      const strategy = requirements.strategy || this.strategy;
      const selector = this.strategies[strategy];

      if (!selector) {
        throw new Error(`Unknown selection strategy: ${strategy}`);
      }

      // Select provider using the chosen strategy
      const selectedProvider = selector.call(
        ProviderSelectionStrategies,
        candidates,
        this.state
      );

      // Add selection metadata
      const selectionMetadata = {
        strategy: strategy,
        selectionTime: Date.now(),
        responseTime: Date.now() - startTime,
        candidateCount: candidates.length,
        totalProviders: providers.length,
        score: selectedProvider.selectionScore || 0,
      };

      // Record selection in history
      this.recordSelection(selectedProvider, selectionMetadata, requirements);

      // Emit selection event
      this.emit('providerSelected', {
        provider: selectedProvider.name,
        strategy: strategy,
        metadata: selectionMetadata,
      });

      return {
        ...selectedProvider,
        selectionMetadata,
      };
    } catch (error) {
      this.emit('selectionError', {
        error: error.message,
        strategy: this.strategy,
        providerCount: providers.length,
      });
      throw error;
    }
  }

  /**
   * Pre-filter providers based on requirements and health
   * @param {Array} providers - All available providers
   * @param {Object} requirements - Selection requirements
   * @returns {Array} Filtered providers
   */
  preFilterProviders(providers, requirements = {}) {
    let candidates = [...providers];

    // Filter by health status
    if (requirements.requireHealthy !== false) {
      candidates = candidates.filter(
        (p) =>
          p.health?.isHealthy !== false &&
          (p.metrics?.consecutiveFailures || 0) < 5
      );
    }

    // Filter by preferred providers
    if (requirements.preferredProviders?.length > 0) {
      const preferred = candidates.filter((p) =>
        requirements.preferredProviders.includes(p.name)
      );
      if (preferred.length > 0) {
        candidates = preferred;
      }
    }

    // Filter by excluded providers
    if (requirements.excludeProviders?.length > 0) {
      candidates = candidates.filter(
        (p) => !requirements.excludeProviders.includes(p.name)
      );
    }

    // Filter by capabilities
    if (requirements.capabilities) {
      candidates = candidates.filter((p) => {
        const providerCapabilities = p.config?.capabilities || {};
        return Object.entries(requirements.capabilities).every(
          ([capability, required]) => {
            return !required || providerCapabilities[capability];
          }
        );
      });
    }

    // Filter by minimum success rate (but allow new providers with no history)
    const minSuccessRate = requirements.minSuccessRate || 0.5;
    candidates = candidates.filter((p) => {
      const successRate = p.metrics?.successRate || 0;
      const totalRequests = p.metrics?.requests || 0;

      // Allow providers with no request history (new providers)
      if (totalRequests === 0) {
        return true;
      }

      // For providers with history, check success rate
      return successRate >= minSuccessRate;
    });

    // Filter by maximum response time
    if (requirements.maxResponseTime) {
      candidates = candidates.filter(
        (p) => (p.metrics?.avgResponseTime || 0) <= requirements.maxResponseTime
      );
    }

    return candidates;
  }

  /**
   * Record provider selection in history for analysis
   * @param {Object} provider - Selected provider
   * @param {Object} metadata - Selection metadata
   * @param {Object} requirements - Original requirements
   */
  recordSelection(provider, metadata, requirements) {
    const record = {
      providerName: provider.name,
      timestamp: Date.now(),
      strategy: metadata.strategy,
      score: metadata.score,
      responseTime: metadata.responseTime,
      requirements: requirements,
      providerMetrics: {
        successRate: provider.metrics?.successRate || 0,
        avgResponseTime: provider.metrics?.avgResponseTime || 0,
        activeConnections: provider.metrics?.activeConnections || 0,
      },
    };

    this.state.selectionHistory.push(record);

    // Maintain history size limit
    if (this.state.selectionHistory.length > this.config.historySize) {
      this.state.selectionHistory.shift();
    }

    this.state.lastSelectionTime = Date.now();
  }

  /**
   * Get selection statistics and performance metrics
   * @param {Object} options - Query options
   * @returns {Object} Selection statistics
   */
  getSelectionStats(options = {}) {
    const timeRange = options.timeRange || 3600000; // 1 hour default
    const cutoffTime = Date.now() - timeRange;

    const recentSelections = this.state.selectionHistory.filter(
      (s) => s.timestamp >= cutoffTime
    );

    if (recentSelections.length === 0) {
      return {
        totalSelections: 0,
        timeRange: timeRange,
        providers: {},
        strategies: {},
      };
    }

    // Provider statistics
    const providerStats = {};
    const strategyStats = {};

    recentSelections.forEach((selection) => {
      // Provider stats
      if (!providerStats[selection.providerName]) {
        providerStats[selection.providerName] = {
          selections: 0,
          totalScore: 0,
          avgScore: 0,
          totalResponseTime: 0,
          avgResponseTime: 0,
        };
      }

      const pStats = providerStats[selection.providerName];
      pStats.selections++;
      pStats.totalScore += selection.score;
      pStats.avgScore = pStats.totalScore / pStats.selections;
      pStats.totalResponseTime += selection.responseTime;
      pStats.avgResponseTime = pStats.totalResponseTime / pStats.selections;

      // Strategy stats
      if (!strategyStats[selection.strategy]) {
        strategyStats[selection.strategy] = {
          selections: 0,
          totalResponseTime: 0,
          avgResponseTime: 0,
        };
      }

      const sStats = strategyStats[selection.strategy];
      sStats.selections++;
      sStats.totalResponseTime += selection.responseTime;
      sStats.avgResponseTime = sStats.totalResponseTime / sStats.selections;
    });

    return {
      totalSelections: recentSelections.length,
      timeRange: timeRange,
      providers: providerStats,
      strategies: strategyStats,
      currentStrategy: this.strategy,
      lastSelectionTime: this.state.lastSelectionTime,
    };
  }

  /**
   * Change the load balancing strategy
   * @param {string} newStrategy - New strategy name
   * @param {Object} options - Strategy options
   */
  setStrategy(newStrategy, options = {}) {
    if (!this.strategies[newStrategy]) {
      throw new Error(`Unknown strategy: ${newStrategy}`);
    }

    const oldStrategy = this.strategy;
    this.strategy = newStrategy;

    // Reset state for stateful strategies
    if (newStrategy === 'round-robin') {
      this.state.roundRobinIndex = 0;
    }

    console.log(
      `Load balancing strategy changed from ${oldStrategy} to ${newStrategy}`
    );

    this.emit('strategyChanged', {
      oldStrategy,
      newStrategy,
      timestamp: Date.now(),
    });
  }

  /**
   * Start adaptive strategy evaluation
   * @private
   */
  startAdaptiveEvaluation() {
    this.adaptiveInterval = setInterval(() => {
      try {
        this.evaluateAndAdaptStrategy();
      } catch (error) {
        console.error('Adaptive strategy evaluation error:', error.message);
      }
    }, this.config.strategyEvaluationInterval);

    console.log('Adaptive strategy evaluation started');
  }

  /**
   * Stop adaptive strategy evaluation
   * @private
   */
  stopAdaptiveEvaluation() {
    if (this.adaptiveInterval) {
      clearInterval(this.adaptiveInterval);
      this.adaptiveInterval = null;
      console.log('Adaptive strategy evaluation stopped');
    }
  }

  /**
   * Evaluate current strategy performance and adapt if needed
   * @private
   */
  evaluateAndAdaptStrategy() {
    const stats = this.getSelectionStats({
      timeRange: this.config.strategyEvaluationInterval,
    });

    if (stats.totalSelections < 10) {
      return; // Not enough data for evaluation
    }

    const currentStrategyStats = stats.strategies[this.strategy];
    if (!currentStrategyStats) {
      return;
    }

    // Evaluate strategy performance
    const avgResponseTime = currentStrategyStats.avgResponseTime;
    const providerDistribution = Object.keys(stats.providers).length;

    // Simple adaptation logic - can be enhanced
    if (avgResponseTime > 1000 && this.strategy !== 'fastest-response') {
      console.log(
        'Adapting to fastest-response strategy due to high response times'
      );
      this.setStrategy('fastest-response');
    } else if (providerDistribution === 1 && this.strategy !== 'round-robin') {
      console.log('Adapting to round-robin strategy for better distribution');
      this.setStrategy('round-robin');
    }
  }

  /**
   * Stop adaptive strategy evaluation
   */
  stopAdaptiveEvaluation() {
    if (this.adaptiveInterval) {
      clearInterval(this.adaptiveInterval);
      this.adaptiveInterval = null;
      console.log('Adaptive strategy evaluation stopped');
    }
  }

  /**
   * Get available strategies
   * @returns {Array} Available strategy names
   */
  getAvailableStrategies() {
    return Object.keys(this.strategies);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopAdaptiveEvaluation();
    this.removeAllListeners();
    this.state.selectionHistory = [];
    console.log('Enhanced Load Balancer destroyed');
  }
}

module.exports = {
  ProviderSelectionStrategies,
  EnhancedLoadBalancer,
};
