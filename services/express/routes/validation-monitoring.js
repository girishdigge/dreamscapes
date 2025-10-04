// services/express/routes/validation-monitoring.js
const express = require('express');
const { validationMonitor } = require('@dreamscapes/shared');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * Get overall validation metrics
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = validationMonitor.getOverallMetrics();

    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get validation metrics', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve validation metrics',
      details: error.message,
    });
  }
});

/**
 * Get service-specific validation metrics
 */
router.get('/metrics/:service', (req, res) => {
  try {
    const { service } = req.params;
    const metrics = validationMonitor.getServiceMetrics(service);

    res.json({
      success: true,
      service,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get service validation metrics', {
      service: req.params.service,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve service validation metrics',
      details: error.message,
    });
  }
});

/**
 * Get validation health report
 */
router.get('/health', (req, res) => {
  try {
    const healthReport = validationMonitor.getHealthReport();

    const statusCode = healthReport.overallStatus === 'critical' ? 503 : 200;

    res.status(statusCode).json({
      success: true,
      health: healthReport,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get validation health report', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve validation health report',
      details: error.message,
    });
  }
});

/**
 * Get recent validation failures
 */
router.get('/failures/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const failures = validationMonitor.getRecentFailures(limit);

    res.json({
      success: true,
      failures,
      count: failures.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get recent validation failures', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent validation failures',
      details: error.message,
    });
  }
});

/**
 * Get validation history for a service
 */
router.get('/history/:service', (req, res) => {
  try {
    const { service } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const history = validationMonitor.getServiceHistory(service, limit);

    res.json({
      success: true,
      service,
      history,
      count: history.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get validation history', {
      service: req.params.service,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve validation history',
      details: error.message,
    });
  }
});

/**
 * Clear validation history
 */
router.post('/history/clear', (req, res) => {
  try {
    const { service } = req.body;

    validationMonitor.clearHistory(service);

    logger.info('Validation history cleared', {
      service: service || 'all',
    });

    res.json({
      success: true,
      message: `Validation history cleared for ${service || 'all services'}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to clear validation history', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to clear validation history',
      details: error.message,
    });
  }
});

module.exports = router;
