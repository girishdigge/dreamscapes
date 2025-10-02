// routes/providers.js
// API endpoints for provider status, metrics, and management

const express = require('express');
const { logger } = require('../utils/logger');

const router = express.Router();

// Get provider status and health information
router.get('/status', async (req, res) => {
  try {
    const providerManager = req.app.locals.providerManager;

    if (!providerManager) {
      return res.status(503).json({
        success: false,
        error: 'ProviderManager not available',
        message: 'Provider management system is not initialized',
      });
    }

    const healthResults = await providerManager.healthCheck();
    const availableProviders = providerManager.getAvailableProviders();
    const allProviders = providerManager.getProviders();

    res.json({
      success: true,
      data: {
        summary: {
          totalProviders: allProviders.length,
          healthyProviders: availableProviders.length,
          unhealthyProviders: allProviders.length - availableProviders.length,
        },
        providers: healthResults,
        availableProviders: availableProviders.map((p) => ({
          name: p.name,
          score: p.score,
          priority: p.config.priority,
          enabled: p.config.enabled,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting provider status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider status',
      message: error.message,
    });
  }
});

// Get detailed provider metrics
router.get('/metrics', async (req, res) => {
  try {
    const providerManager = req.app.locals.providerManager;

    if (!providerManager) {
      return res.status(503).json({
        success: false,
        error: 'ProviderManager not available',
      });
    }

    const { provider } = req.query;
    const metrics = providerManager.getProviderMetrics(provider || null);

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting provider metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider metrics',
      message: error.message,
    });
  }
});

// Get provider performance analytics
router.get('/analytics', async (req, res) => {
  try {
    const providerManager = req.app.locals.providerManager;

    if (!providerManager) {
      return res.status(503).json({
        success: false,
        error: 'ProviderManager not available',
      });
    }

    const metrics = providerManager.getProviderMetrics();
    const analytics = {};

    // Calculate analytics for each provider
    for (const [providerName, providerMetrics] of Object.entries(metrics)) {
      analytics[providerName] = {
        performance: {
          successRate: providerMetrics.successRate,
          failureRate: providerMetrics.failureRate,
          avgResponseTime: providerMetrics.avgResponseTime,
          totalRequests: providerMetrics.requests,
        },
        health: {
          isHealthy: providerMetrics.isHealthy,
          consecutiveFailures: providerMetrics.consecutiveFailures,
          lastHealthCheck: providerMetrics.lastHealthCheck,
        },
        configuration: {
          enabled: providerMetrics.enabled,
          priority: providerMetrics.priority,
        },
        trends: {
          // Add trend analysis if available
          recentPerformance: 'stable', // This would be calculated from historical data
        },
      };
    }

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting provider analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve provider analytics',
      message: error.message,
    });
  }
});

// Perform health check on specific provider or all providers
router.post('/health-check', async (req, res) => {
  try {
    const providerManager = req.app.locals.providerManager;

    if (!providerManager) {
      return res.status(503).json({
        success: false,
        error: 'ProviderManager not available',
      });
    }

    const { provider } = req.body;
    const startTime = Date.now();

    const healthResults = await providerManager.healthCheck(provider || null);
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      data: healthResults,
      metadata: {
        responseTime,
        checkedProvider: provider || 'all',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error performing health check:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message,
    });
  }
});

// Get provider selection recommendations
router.post('/recommend', async (req, res) => {
  try {
    const providerManager = req.app.locals.providerManager;

    if (!providerManager) {
      return res.status(503).json({
        success: false,
        error: 'ProviderManager not available',
      });
    }

    const requirements = req.body || {};

    try {
      const selectedProvider = await providerManager.selectProvider(
        requirements
      );
      const availableProviders =
        providerManager.getAvailableProvidersWithPreferences(requirements);

      res.json({
        success: true,
        data: {
          recommended: {
            name: selectedProvider.name,
            score: selectedProvider.score,
            selectionMetadata: selectedProvider.selectionMetadata,
          },
          alternatives: availableProviders.slice(1, 4).map((p) => ({
            name: p.name,
            score: p.score,
            priority: p.config.priority,
          })),
          totalAvailable: availableProviders.length,
        },
        requirements,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.json({
        success: false,
        error: 'No providers available',
        message: error.message,
        requirements,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Error getting provider recommendation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get provider recommendation',
      message: error.message,
    });
  }
});

// Submit quality feedback for provider performance
router.post('/feedback', async (req, res) => {
  try {
    const providerManager = req.app.locals.providerManager;

    if (!providerManager) {
      return res.status(503).json({
        success: false,
        error: 'ProviderManager not available',
      });
    }

    const {
      provider,
      quality,
      responseTime,
      contentQuality,
      userSatisfaction,
      comments,
    } = req.body;

    if (!provider || quality === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'provider and quality are required',
      });
    }

    // Process feedback through preference manager if available
    if (providerManager.preferenceManager) {
      providerManager.preferenceManager.updateProviderPerformance(provider, {
        success: quality >= 7, // Consider 7+ as success
        responseTime: responseTime || 0,
        userFeedback: {
          quality,
          contentQuality,
          userSatisfaction,
          comments,
        },
      });
    }

    logger.info('Provider feedback received', {
      provider,
      quality,
      responseTime,
      contentQuality,
      userSatisfaction,
    });

    res.json({
      success: true,
      message: 'Feedback processed successfully',
      data: {
        provider,
        quality,
        processedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error processing provider feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process feedback',
      message: error.message,
    });
  }
});

module.exports = router;
