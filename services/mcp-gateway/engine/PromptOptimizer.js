// engine/PromptOptimizer.js
// Prompt optimization and A/B testing framework

class PromptOptimizer {
  constructor(options = {}) {
    this.options = {
      min_test_samples: 10,
      confidence_threshold: 0.95,
      max_variants: 5,
      optimization_cycles: 3,
      quality_weight: 0.4,
      performance_weight: 0.3,
      user_satisfaction_weight: 0.3,
      ...options,
    };

    this.experiments = new Map();
    this.results = new Map();
    this.optimizationHistory = [];
    this.performanceMetrics = new Map();

    this.optimizationStrategies = {
      length_optimization: {
        name: 'length_optimization',
        description: 'Optimize prompt length for better performance',
        variations: ['shorter', 'longer', 'balanced'],
        apply: (prompt, variation) =>
          this.applyLengthOptimization(prompt, variation),
      },
      instruction_clarity: {
        name: 'instruction_clarity',
        description: 'Optimize instruction clarity and specificity',
        variations: ['more_specific', 'more_general', 'structured'],
        apply: (prompt, variation) =>
          this.applyInstructionClarity(prompt, variation),
      },
      context_emphasis: {
        name: 'context_emphasis',
        description: 'Optimize context usage and emphasis',
        variations: ['high_context', 'low_context', 'selective_context'],
        apply: (prompt, variation) =>
          this.applyContextEmphasis(prompt, variation),
      },
      output_formatting: {
        name: 'output_formatting',
        description: 'Optimize output format specifications',
        variations: ['strict_format', 'flexible_format', 'example_driven'],
        apply: (prompt, variation) =>
          this.applyOutputFormatting(prompt, variation),
      },
      creativity_balance: {
        name: 'creativity_balance',
        description: 'Balance creativity vs. consistency',
        variations: ['high_creativity', 'balanced', 'high_consistency'],
        apply: (prompt, variation) =>
          this.applyCreativityBalance(prompt, variation),
      },
    };

    this.qualityMetrics = {
      relevance: {
        name: 'relevance',
        description: 'How well the output matches the input requirements',
        weight: 0.25,
        calculate: (output, input, expected) =>
          this.calculateRelevance(output, input, expected),
      },
      completeness: {
        name: 'completeness',
        description: 'How complete the generated output is',
        weight: 0.2,
        calculate: (output, input, expected) =>
          this.calculateCompleteness(output, input, expected),
      },
      creativity: {
        name: 'creativity',
        description: 'How creative and original the output is',
        weight: 0.15,
        calculate: (output, input, expected) =>
          this.calculateCreativity(output, input, expected),
      },
      coherence: {
        name: 'coherence',
        description: 'How coherent and well-structured the output is',
        weight: 0.2,
        calculate: (output, input, expected) =>
          this.calculateCoherence(output, input, expected),
      },
      format_compliance: {
        name: 'format_compliance',
        description: 'How well the output follows format requirements',
        weight: 0.2,
        calculate: (output, input, expected) =>
          this.calculateFormatCompliance(output, input, expected),
      },
    };
  }

  createExperiment(experimentId, basePrompt, options = {}) {
    const {
      strategies = ['length_optimization', 'instruction_clarity'],
      target_metrics = ['relevance', 'completeness'],
      sample_size = this.options.min_test_samples,
      duration_hours = 24,
      auto_optimize = true,
    } = options;

    const experiment = {
      id: experimentId,
      base_prompt: basePrompt,
      strategies,
      target_metrics,
      sample_size,
      duration_hours,
      auto_optimize,
      created_at: new Date().toISOString(),
      status: 'created',
      variants: this.generateVariants(basePrompt, strategies),
      results: {
        total_tests: 0,
        variant_performance: {},
        statistical_significance: {},
        winner: null,
        confidence: 0,
      },
    };

    this.experiments.set(experimentId, experiment);
    return experiment;
  }

  generateVariants(basePrompt, strategies) {
    const variants = [
      {
        id: 'control',
        name: 'Control (Original)',
        prompt: basePrompt,
        modifications: [],
        strategy: 'none',
      },
    ];

    strategies.forEach((strategyName) => {
      const strategy = this.optimizationStrategies[strategyName];
      if (!strategy) return;

      strategy.variations.forEach((variation) => {
        const variantId = `${strategyName}_${variation}`;
        const modifiedPrompt = strategy.apply(basePrompt, variation);

        variants.push({
          id: variantId,
          name: `${strategy.name} - ${variation}`,
          prompt: modifiedPrompt,
          modifications: [{ strategy: strategyName, variation }],
          strategy: strategyName,
        });
      });
    });

    // Limit to max variants
    return variants.slice(0, this.options.max_variants);
  }

  async runExperiment(experimentId, testCases) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.status = 'running';
    experiment.started_at = new Date().toISOString();

    const results = {
      variant_results: {},
      test_case_results: [],
      performance_metrics: {},
      quality_scores: {},
    };

    // Run tests for each variant
    for (const variant of experiment.variants) {
      console.log(`Testing variant: ${variant.name}`);

      const variantResults = await this.testVariant(
        variant,
        testCases,
        experiment.target_metrics
      );
      results.variant_results[variant.id] = variantResults;

      // Update experiment results
      experiment.results.variant_performance[variant.id] =
        variantResults.summary;
    }

    // Analyze results and determine winner
    const analysis = this.analyzeExperimentResults(experiment, results);
    experiment.results = { ...experiment.results, ...analysis };
    experiment.status = 'completed';
    experiment.completed_at = new Date().toISOString();

    // Auto-optimize if enabled
    if (
      experiment.auto_optimize &&
      analysis.winner &&
      analysis.confidence > this.options.confidence_threshold
    ) {
      await this.applyOptimization(experimentId, analysis.winner);
    }

    this.results.set(experimentId, results);
    return {
      experiment,
      results,
      analysis,
    };
  }

  async testVariant(variant, testCases, targetMetrics) {
    const results = {
      variant_id: variant.id,
      test_results: [],
      performance_metrics: {
        avg_response_time: 0,
        success_rate: 0,
        error_rate: 0,
      },
      quality_scores: {},
      summary: {
        total_tests: 0,
        passed_tests: 0,
        avg_quality_score: 0,
        performance_score: 0,
      },
    };

    let totalResponseTime = 0;
    let successCount = 0;
    let totalQualityScore = 0;

    for (const testCase of testCases) {
      const testResult = await this.runSingleTest(
        variant,
        testCase,
        targetMetrics
      );
      results.test_results.push(testResult);

      if (testResult.success) {
        successCount++;
        totalQualityScore += testResult.quality_score;
      }

      totalResponseTime += testResult.response_time;
    }

    // Calculate summary metrics
    results.summary.total_tests = testCases.length;
    results.summary.passed_tests = successCount;
    results.summary.avg_quality_score =
      successCount > 0 ? totalQualityScore / successCount : 0;

    results.performance_metrics.avg_response_time =
      totalResponseTime / testCases.length;
    results.performance_metrics.success_rate = successCount / testCases.length;
    results.performance_metrics.error_rate =
      1 - results.performance_metrics.success_rate;

    // Calculate performance score
    results.summary.performance_score = this.calculatePerformanceScore(
      results.performance_metrics
    );

    return results;
  }

  async runSingleTest(variant, testCase, targetMetrics) {
    const startTime = Date.now();

    try {
      // Simulate AI provider call - in real implementation, this would call the actual provider
      const mockOutput = await this.simulateAIResponse(
        variant.prompt,
        testCase.input
      );
      const responseTime = Date.now() - startTime;

      // Calculate quality metrics
      const qualityScores = {};
      let totalQualityScore = 0;
      let totalWeight = 0;

      for (const metricName of targetMetrics) {
        const metric = this.qualityMetrics[metricName];
        if (metric) {
          const score = metric.calculate(
            mockOutput,
            testCase.input,
            testCase.expected
          );
          qualityScores[metricName] = score;
          totalQualityScore += score * metric.weight;
          totalWeight += metric.weight;
        }
      }

      const avgQualityScore =
        totalWeight > 0 ? totalQualityScore / totalWeight : 0;

      return {
        test_case_id: testCase.id,
        variant_id: variant.id,
        success: true,
        response_time: responseTime,
        quality_score: avgQualityScore,
        quality_breakdown: qualityScores,
        output: mockOutput,
        error: null,
      };
    } catch (error) {
      return {
        test_case_id: testCase.id,
        variant_id: variant.id,
        success: false,
        response_time: Date.now() - startTime,
        quality_score: 0,
        quality_breakdown: {},
        output: null,
        error: error.message,
      };
    }
  }

  analyzeExperimentResults(experiment, results) {
    const analysis = {
      winner: null,
      confidence: 0,
      statistical_significance: {},
      recommendations: [],
      insights: [],
    };

    // Calculate overall scores for each variant
    const variantScores = {};
    Object.entries(results.variant_results).forEach(
      ([variantId, variantResult]) => {
        const qualityScore = variantResult.summary.avg_quality_score;
        const performanceScore = variantResult.summary.performance_score;

        const overallScore =
          qualityScore * this.options.quality_weight +
          performanceScore * this.options.performance_weight;

        variantScores[variantId] = {
          overall_score: overallScore,
          quality_score: qualityScore,
          performance_score: performanceScore,
          success_rate: variantResult.performance_metrics.success_rate,
        };
      }
    );

    // Find the best performing variant
    const sortedVariants = Object.entries(variantScores).sort(
      ([, a], [, b]) => b.overall_score - a.overall_score
    );

    if (sortedVariants.length > 0) {
      analysis.winner = sortedVariants[0][0];

      // Calculate confidence based on score difference
      if (sortedVariants.length > 1) {
        const winnerScore = sortedVariants[0][1].overall_score;
        const runnerUpScore = sortedVariants[1][1].overall_score;
        const scoreDifference = winnerScore - runnerUpScore;

        // Simple confidence calculation - could be enhanced with proper statistical tests
        analysis.confidence = Math.min(0.99, scoreDifference / winnerScore);
      } else {
        analysis.confidence = 1.0;
      }
    }

    // Generate insights and recommendations
    analysis.insights = this.generateInsights(variantScores, experiment);
    analysis.recommendations = this.generateRecommendations(
      variantScores,
      experiment
    );

    return analysis;
  }

  generateInsights(variantScores, experiment) {
    const insights = [];

    // Performance insights
    const scores = Object.values(variantScores);
    const avgScore =
      scores.reduce((sum, s) => sum + s.overall_score, 0) / scores.length;
    const bestScore = Math.max(...scores.map((s) => s.overall_score));

    if (bestScore > avgScore * 1.1) {
      insights.push(
        `Best variant performs ${Math.round(
          (bestScore / avgScore - 1) * 100
        )}% better than average`
      );
    }

    // Strategy insights
    const strategyPerformance = {};
    Object.entries(variantScores).forEach(([variantId, scores]) => {
      const variant = experiment.variants.find((v) => v.id === variantId);
      if (variant && variant.strategy !== 'none') {
        if (!strategyPerformance[variant.strategy]) {
          strategyPerformance[variant.strategy] = [];
        }
        strategyPerformance[variant.strategy].push(scores.overall_score);
      }
    });

    Object.entries(strategyPerformance).forEach(([strategy, scores]) => {
      const avgStrategyScore =
        scores.reduce((sum, s) => sum + s, 0) / scores.length;
      if (avgStrategyScore > avgScore * 1.05) {
        insights.push(`${strategy} strategy shows promising results`);
      }
    });

    return insights;
  }

  generateRecommendations(variantScores, experiment) {
    const recommendations = [];

    const winner = Object.entries(variantScores).sort(
      ([, a], [, b]) => b.overall_score - a.overall_score
    )[0];

    if (winner) {
      const [winnerId, winnerScores] = winner;
      const winnerVariant = experiment.variants.find((v) => v.id === winnerId);

      if (winnerVariant && winnerVariant.strategy !== 'none') {
        recommendations.push(
          `Adopt ${winnerVariant.strategy} optimization strategy`
        );
        recommendations.push(
          `Apply ${winnerVariant.modifications[0]?.variation} variation`
        );
      }

      if (winnerScores.quality_score < 0.8) {
        recommendations.push('Consider additional quality improvements');
      }

      if (winnerScores.performance_score < 0.8) {
        recommendations.push('Focus on performance optimization');
      }
    }

    return recommendations;
  }

  async applyOptimization(experimentId, winnerVariantId) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    const winnerVariant = experiment.variants.find(
      (v) => v.id === winnerVariantId
    );
    if (!winnerVariant) return;

    const optimization = {
      experiment_id: experimentId,
      original_prompt: experiment.base_prompt,
      optimized_prompt: winnerVariant.prompt,
      strategy: winnerVariant.strategy,
      modifications: winnerVariant.modifications,
      performance_improvement: this.calculateImprovement(
        experiment,
        winnerVariantId
      ),
      applied_at: new Date().toISOString(),
    };

    this.optimizationHistory.push(optimization);
    return optimization;
  }

  // Optimization strategy implementations
  applyLengthOptimization(prompt, variation) {
    switch (variation) {
      case 'shorter':
        return this.shortenPrompt(prompt);
      case 'longer':
        return this.expandPrompt(prompt);
      case 'balanced':
        return this.balancePromptLength(prompt);
      default:
        return prompt;
    }
  }

  applyInstructionClarity(prompt, variation) {
    switch (variation) {
      case 'more_specific':
        return this.makeInstructionsMoreSpecific(prompt);
      case 'more_general':
        return this.makeInstructionsMoreGeneral(prompt);
      case 'structured':
        return this.structureInstructions(prompt);
      default:
        return prompt;
    }
  }

  applyContextEmphasis(prompt, variation) {
    switch (variation) {
      case 'high_context':
        return (
          prompt +
          '\n\nIMPORTANT: Pay close attention to all contextual information provided.'
        );
      case 'low_context':
        return (
          prompt +
          '\n\nFOCUS: Concentrate on the core request, using context minimally.'
        );
      case 'selective_context':
        return (
          prompt +
          '\n\nCONTEXT USAGE: Use contextual information selectively where most relevant.'
        );
      default:
        return prompt;
    }
  }

  applyOutputFormatting(prompt, variation) {
    switch (variation) {
      case 'strict_format':
        return (
          prompt +
          '\n\nFORMAT REQUIREMENT: Follow the output format exactly as specified.'
        );
      case 'flexible_format':
        return (
          prompt +
          '\n\nFORMAT GUIDANCE: Use the suggested format as a guide, adapt as needed.'
        );
      case 'example_driven':
        return (
          prompt +
          '\n\nFORMAT EXAMPLE: Follow the pattern shown in examples provided.'
        );
      default:
        return prompt;
    }
  }

  applyCreativityBalance(prompt, variation) {
    switch (variation) {
      case 'high_creativity':
        return (
          prompt +
          '\n\nCREATIVITY: Be highly creative and original in your response.'
        );
      case 'balanced':
        return (
          prompt +
          '\n\nBALANCE: Balance creativity with accuracy and consistency.'
        );
      case 'high_consistency':
        return (
          prompt +
          '\n\nCONSISTENCY: Prioritize consistency and reliability over creativity.'
        );
      default:
        return prompt;
    }
  }

  // Helper methods for prompt modifications
  shortenPrompt(prompt) {
    // Remove redundant phrases and simplify language
    let shortened = prompt
      .replace(/\b(please|kindly|if you would|if possible)\b/gi, '')
      .replace(/\b(very|quite|rather|extremely)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove less critical sections
    shortened = shortened.replace(/\n\n.*?ADDITIONAL.*?(?=\n\n|$)/gs, '');

    return shortened;
  }

  expandPrompt(prompt) {
    // Add more detailed instructions and examples
    return (
      prompt +
      `\n\nADDITIONAL GUIDANCE:
- Provide comprehensive and detailed responses
- Include relevant examples and explanations
- Consider edge cases and alternative approaches
- Ensure thorough coverage of all aspects`
    );
  }

  balancePromptLength(prompt) {
    // Optimize for balanced length - not too short, not too long
    const words = prompt.split(' ').length;
    if (words < 100) {
      return this.expandPrompt(prompt);
    } else if (words > 300) {
      return this.shortenPrompt(prompt);
    }
    return prompt;
  }

  makeInstructionsMoreSpecific(prompt) {
    return (
      prompt.replace(
        /generate|create|make/gi,
        (match) => `${match} specifically and precisely`
      ) +
      '\n\nSPECIFICITY: Be as specific and detailed as possible in your response.'
    );
  }

  makeInstructionsMoreGeneral(prompt) {
    return (
      prompt.replace(/specifically|precisely|exactly/gi, '') +
      '\n\nFLEXIBILITY: Interpret instructions broadly and adapt as appropriate.'
    );
  }

  structureInstructions(prompt) {
    // Add clear structure with numbered steps
    const sections = prompt.split('\n\n');
    const structured = sections
      .map((section, index) => {
        if (
          section.includes('INSTRUCTION') ||
          section.includes('REQUIREMENT')
        ) {
          return `${index + 1}. ${section}`;
        }
        return section;
      })
      .join('\n\n');

    return (
      structured + '\n\nFOLLOW STEPS: Complete each numbered step in order.'
    );
  }

  // Quality metric calculations
  calculateRelevance(output, input, expected) {
    // Simple relevance calculation - could be enhanced with NLP
    if (!output || !input) return 0;

    const inputWords = input.toLowerCase().split(/\W+/);
    const outputWords = output.toLowerCase().split(/\W+/);

    const commonWords = inputWords.filter(
      (word) => word.length > 3 && outputWords.includes(word)
    );

    return Math.min(
      1,
      commonWords.length / Math.max(inputWords.length * 0.3, 1)
    );
  }

  calculateCompleteness(output, input, expected) {
    // Check if output contains expected elements
    if (!output) return 0;

    const requiredElements = ['title', 'description', 'scenes'];
    const foundElements = requiredElements.filter((element) =>
      output.toLowerCase().includes(element)
    );

    return foundElements.length / requiredElements.length;
  }

  calculateCreativity(output, input, expected) {
    // Simple creativity measure based on unique words and concepts
    if (!output) return 0;

    const words = output.toLowerCase().split(/\W+/);
    const uniqueWords = new Set(words);
    const creativityScore = Math.min(1, uniqueWords.size / words.length);

    return creativityScore;
  }

  calculateCoherence(output, input, expected) {
    // Simple coherence check - could be enhanced with NLP
    if (!output) return 0;

    const sentences = output.split(/[.!?]+/);
    const avgSentenceLength =
      sentences.reduce((sum, s) => sum + s.split(' ').length, 0) /
      sentences.length;

    // Coherence based on sentence length consistency
    return Math.min(1, 1 - Math.abs(avgSentenceLength - 15) / 15);
  }

  calculateFormatCompliance(output, input, expected) {
    // Check JSON format compliance
    try {
      JSON.parse(output);
      return 1.0;
    } catch {
      // Check for basic structure elements
      const hasStructure = output.includes('{') && output.includes('}');
      return hasStructure ? 0.5 : 0;
    }
  }

  calculatePerformanceScore(metrics) {
    const responseTimeScore = Math.max(
      0,
      1 - metrics.avg_response_time / 10000
    ); // 10s baseline
    const successRateScore = metrics.success_rate;
    const errorRateScore = 1 - metrics.error_rate;

    return (responseTimeScore + successRateScore + errorRateScore) / 3;
  }

  calculateImprovement(experiment, winnerVariantId) {
    const controlResult = experiment.results.variant_performance['control'];
    const winnerResult =
      experiment.results.variant_performance[winnerVariantId];

    if (!controlResult || !winnerResult) return 0;

    return (
      (winnerResult.avg_quality_score - controlResult.avg_quality_score) /
      controlResult.avg_quality_score
    );
  }

  // Simulation method for testing
  async simulateAIResponse(prompt, input) {
    // Simulate AI response based on prompt characteristics
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 1000 + 500)
    );

    const mockResponse = {
      title: `Dream: ${input.substring(0, 30)}...`,
      description: `Enhanced description based on: ${input}`,
      scenes: [
        {
          id: 'scene_1',
          environment: 'simulated environment',
          objects: [{ type: 'test_object', position: { x: 0, y: 0, z: 0 } }],
        },
      ],
    };

    return JSON.stringify(mockResponse);
  }

  // Utility methods
  getExperimentStatus(experimentId) {
    const experiment = this.experiments.get(experimentId);
    return experiment ? experiment.status : 'not_found';
  }

  getExperimentResults(experimentId) {
    return this.results.get(experimentId) || null;
  }

  getOptimizationHistory() {
    return this.optimizationHistory;
  }

  getPerformanceMetrics() {
    return Object.fromEntries(this.performanceMetrics);
  }

  exportExperiment(experimentId) {
    const experiment = this.experiments.get(experimentId);
    const results = this.results.get(experimentId);

    return {
      experiment,
      results,
      export_timestamp: new Date().toISOString(),
    };
  }
}

module.exports = PromptOptimizer;
