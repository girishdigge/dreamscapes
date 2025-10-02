// routes/quality.js
// API endpoints for quality feedback and continuous improvement

const express = require('express');
const { logger } = require('../utils/logger');
const { getCacheService } = require('../services/cacheService');

const router = express.Router();

// Submit quality feedback for generated content
router.post('/feedback', async (req, res) => {
  try {
    const {
      dreamId,
      contentId,
      provider,
      quality,
      contentQuality,
      userSatisfaction,
      responseTime,
      issues,
      suggestions,
      metadata = {},
    } = req.body;

    // Basic validation
    if (!dreamId && !contentId) {
      return res.status(400).json({
        success: false,
        error: 'Either dreamId or contentId is required',
      });
    }

    if (quality === undefined || quality < 1 || quality > 10) {
      return res.status(400).json({
        success: false,
        error: 'Quality rating must be between 1 and 10',
      });
    }

    const providerManager = req.app.locals.providerManager;
    const cacheService = getCacheService();

    // Process feedback through ProviderManager if available
    if (providerManager && provider) {
      try {
        // Update provider performance metrics
        if (providerManager.preferenceManager) {
          providerManager.preferenceManager.updateProviderPerformance(
            provider,
            {
              success: quality >= 7, // Consider 7+ as success
              responseTime: responseTime || 0,
              userFeedback: {
                quality,
                contentQuality,
                userSatisfaction,
                issues,
                suggestions,
              },
            }
          );
        }

        logger.info('Provider feedback processed', {
          provider,
          quality,
          contentQuality,
          userSatisfaction,
          dreamId: dreamId || contentId,
        });
      } catch (error) {
        logger.warn('Failed to process provider feedback:', error.message);
      }
    }

    // Process feedback through cache service for content management
    if (cacheService && cacheService.isAvailable()) {
      try {
        await cacheService.processFeedback(dreamId || contentId, {
          quality,
          contentQuality,
          userSatisfaction,
          issues,
          suggestions,
          provider,
          responseTime,
          metadata,
        });

        logger.info('Cache feedback processed', {
          dreamId: dreamId || contentId,
          quality,
        });
      } catch (error) {
        logger.warn('Failed to process cache feedback:', error.message);
      }
    }

    // Store feedback for analytics (this could be expanded to use a proper analytics service)
    const feedbackRecord = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dreamId: dreamId || contentId,
      provider,
      quality,
      contentQuality,
      userSatisfaction,
      responseTime,
      issues: Array.isArray(issues) ? issues : [],
      suggestions: Array.isArray(suggestions) ? suggestions : [],
      metadata,
      timestamp: new Date().toISOString(),
      processed: {
        providerManager: !!providerManager,
        cacheService: !!(cacheService && cacheService.isAvailable()),
      },
    };

    logger.info('Quality feedback received and processed', feedbackRecord);

    res.json({
      success: true,
      message: 'Quality feedback processed successfully',
      data: {
        feedbackId: feedbackRecord.id,
        dreamId: dreamId || contentId,
        quality,
        processedAt: new Date().toISOString(),
        processed: feedbackRecord.processed,
      },
    });
  } catch (error) {
    logger.error('Error processing quality feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process quality feedback',
      message: error.message,
    });
  }
});

// Get quality analytics and trends
router.get('/analytics', async (req, res) => {
  try {
    const { provider, timeRange = '24h', limit = 100 } = req.query;
    const providerManager = req.app.locals.providerManager;

    let analytics = {
      summary: {
        totalFeedback: 0,
        averageQuality: 0,
        averageContentQuality: 0,
        averageUserSatisfaction: 0,
        commonIssues: [],
        topSuggestions: [],
      },
      providers: {},
      trends: {
        qualityOverTime: [],
        providerComparison: [],
      },
    };

    // Get provider-specific analytics if ProviderManager is available
    if (providerManager) {
      try {
        const providerMetrics = providerManager.getProviderMetrics(
          provider || null
        );

        if (provider && providerMetrics) {
          analytics.providers[provider] = {
            successRate: providerMetrics.successRate,
            avgResponseTime: providerMetrics.avgResponseTime,
            totalRequests: providerMetrics.requests,
            isHealthy: providerMetrics.isHealthy,
          };
        } else if (!provider) {
          // Get all provider metrics
          for (const [providerName, metrics] of Object.entries(
            providerMetrics
          )) {
            analytics.providers[providerName] = {
              successRate: metrics.successRate,
              avgResponseTime: metrics.avgResponseTime,
              totalRequests: metrics.requests,
              isHealthy: metrics.isHealthy,
            };
          }
        }
      } catch (error) {
        logger.warn('Failed to get provider analytics:', error.message);
      }
    }

    // Note: In a real implementation, this would query a database or analytics service
    // For now, we return the structure with placeholder data
    analytics.summary.note =
      'Analytics data would be populated from stored feedback records';

    res.json({
      success: true,
      data: analytics,
      filters: {
        provider: provider || 'all',
        timeRange,
        limit: parseInt(limit),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting quality analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quality analytics',
      message: error.message,
    });
  }
});

// Get quality recommendations for improvement
router.get('/recommendations', async (req, res) => {
  try {
    const { provider } = req.query;
    const providerManager = req.app.locals.providerManager;

    let recommendations = {
      general: [
        'Monitor response times and optimize slow providers',
        'Collect more user feedback to improve quality metrics',
        'Implement A/B testing for prompt variations',
      ],
      providers: {},
    };

    // Get provider-specific recommendations
    if (providerManager) {
      try {
        const providerMetrics = providerManager.getProviderMetrics(
          provider || null
        );

        const generateProviderRecommendations = (name, metrics) => {
          const recs = [];

          if (metrics.successRate < 0.8) {
            recs.push(
              'Success rate is below 80% - investigate common failure patterns'
            );
          }

          if (metrics.avgResponseTime > 10000) {
            recs.push(
              'Average response time is high - consider optimization or load balancing'
            );
          }

          if (metrics.consecutiveFailures > 3) {
            recs.push(
              'Multiple consecutive failures detected - check provider health'
            );
          }

          if (!metrics.isHealthy) {
            recs.push(
              'Provider is currently unhealthy - investigate connectivity issues'
            );
          }

          if (recs.length === 0) {
            recs.push('Provider is performing well - continue monitoring');
          }

          return recs;
        };

        if (provider && providerMetrics) {
          recommendations.providers[provider] = generateProviderRecommendations(
            provider,
            providerMetrics
          );
        } else if (!provider) {
          for (const [providerName, metrics] of Object.entries(
            providerMetrics
          )) {
            recommendations.providers[providerName] =
              generateProviderRecommendations(providerName, metrics);
          }
        }
      } catch (error) {
        logger.warn(
          'Failed to generate provider recommendations:',
          error.message
        );
      }
    }

    res.json({
      success: true,
      data: recommendations,
      provider: provider || 'all',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting quality recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quality recommendations',
      message: error.message,
    });
  }
});

// Report quality issues for immediate attention
router.post('/report-issue', async (req, res) => {
  try {
    const {
      dreamId,
      contentId,
      provider,
      issueType,
      severity = 'medium',
      description,
      reproductionSteps,
      expectedBehavior,
      actualBehavior,
      metadata = {},
    } = req.body;

    // Basic validation
    if (!dreamId && !contentId) {
      return res.status(400).json({
        success: false,
        error: 'Either dreamId or contentId is required',
      });
    }

    if (!issueType || !description) {
      return res.status(400).json({
        success: false,
        error: 'issueType and description are required',
      });
    }

    const issueReport = {
      id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dreamId: dreamId || contentId,
      provider,
      issueType,
      severity,
      description,
      reproductionSteps: Array.isArray(reproductionSteps)
        ? reproductionSteps
        : [],
      expectedBehavior,
      actualBehavior,
      metadata,
      timestamp: new Date().toISOString(),
      status: 'reported',
    };

    // Log the issue for immediate attention
    logger.error('Quality issue reported', issueReport);

    // If it's a critical issue, also emit an event for immediate handling
    if (severity === 'critical' || severity === 'high') {
      const providerManager = req.app.locals.providerManager;
      if (providerManager) {
        providerManager.emit('criticalIssueReported', issueReport);
      }
    }

    res.json({
      success: true,
      message: 'Issue reported successfully',
      data: {
        issueId: issueReport.id,
        dreamId: dreamId || contentId,
        severity,
        status: 'reported',
        reportedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error reporting quality issue:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to report quality issue',
      message: error.message,
    });
  }
});

module.exports = router;
