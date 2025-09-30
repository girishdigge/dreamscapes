// services/express/routes/export.js
const express = require('express');
const fetch = require('node-fetch');
const { getFromCache } = require('../middleware/cache');
const { logger } = require('../utils/logger');

const router = express.Router();
const RENDER_WORKER_URL =
  process.env.RENDER_WORKER_URL || 'http://render-worker:8001';

// Export dream as video
router.post('/export', async (req, res) => {
  try {
    const {
      dreamId,
      format = 'webm',
      quality = 'medium',
      options = {},
    } = req.body;

    // Input validation
    if (!dreamId || typeof dreamId !== 'string') {
      return res.status(400).json({
        error: 'Dream ID is required',
        details: 'Provide the ID of the dream to export',
      });
    }

    const validFormats = ['webm', 'mp4', 'gif'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        details: `Format must be one of: ${validFormats.join(', ')}`,
        provided: format,
      });
    }

    const validQualities = ['draft', 'medium', 'high'];
    if (!validQualities.includes(quality)) {
      return res.status(400).json({
        error: 'Invalid quality',
        details: `Quality must be one of: ${validQualities.join(', ')}`,
        provided: quality,
      });
    }

    logger.info(`Export request: ${dreamId} -> ${format} (${quality})`);

    // Find the dream
    const dream = getFromCache(dreamId);
    if (!dream) {
      return res.status(404).json({
        error: 'Dream not found',
        dreamId,
        suggestion: 'Check /api/dreams for available dreams',
      });
    }

    // Calculate export parameters
    const duration = dream.cinematography?.durationSec || 30;
    const resolution = getResolutionForQuality(quality);
    const fps = getFpsForQuality(quality);

    const exportConfig = {
      dreamId,
      format,
      quality,
      duration,
      resolution,
      fps,
      estimatedSize: estimateFileSize(duration, resolution, fps, format),
      estimatedTime: estimateRenderTime(duration, quality),
      clientSideRecommended: shouldUseClientSide(quality, duration),
    };

    // Try server-side rendering if render worker is available
    if (options.serverSide !== false) {
      try {
        const renderResult = await attemptServerSideRender(dream, exportConfig);
        if (renderResult.success) {
          return res.json({
            success: true,
            method: 'server_side',
            config: exportConfig,
            renderJob: renderResult.job,
            downloadUrl: renderResult.downloadUrl,
            message: 'Server-side rendering initiated',
          });
        }
      } catch (renderError) {
        logger.warn('Server-side rendering failed:', renderError.message);
      }
    }

    // Fallback to client-side recording instructions
    logger.info('Recommending client-side recording');

    res.json({
      success: true,
      method: 'client_side',
      config: exportConfig,
      instructions: {
        steps: [
          'Ensure the 3D scene is visible and loaded',
          'Click the "Record" button in the dream controls',
          'Play the dream animation',
          'Recording will automatically stop after the duration',
          'Video file will be downloaded to your device',
        ],
        requirements: [
          'Modern browser with MediaRecorder API support',
          'Canvas element must be visible during recording',
          'Sufficient device storage space',
        ],
        tips: [
          'Close other applications for better performance',
          'Use fullscreen mode for higher quality',
          'Ensure stable internet connection during playback',
        ],
      },
      message: 'Client-side recording ready',
    });
  } catch (error) {
    logger.error('Export error:', error);
    res.status(500).json({
      error: 'Export failed',
      details: error.message,
    });
  }
});

// Get export status
router.get('/export/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!RENDER_WORKER_URL) {
      return res.status(404).json({
        error: 'Server-side rendering not available',
        details: 'Render worker service is not configured',
      });
    }

    const response = await fetch(`${RENDER_WORKER_URL}/job/${jobId}/status`, {
      timeout: 5000,
    });

    if (response.ok) {
      const status = await response.json();
      res.json(status);
    } else {
      throw new Error(`Render worker returned ${response.status}`);
    }
  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({
      error: 'Failed to check export status',
      details: error.message,
    });
  }
});

// Cancel export job
router.delete('/export/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!RENDER_WORKER_URL) {
      return res.status(404).json({
        error: 'Server-side rendering not available',
      });
    }

    const response = await fetch(`${RENDER_WORKER_URL}/job/${jobId}`, {
      method: 'DELETE',
      timeout: 5000,
    });

    if (response.ok) {
      res.json({ success: true, message: 'Export job cancelled' });
    } else {
      throw new Error(`Render worker returned ${response.status}`);
    }
  } catch (error) {
    logger.error('Cancel export error:', error);
    res.status(500).json({
      error: 'Failed to cancel export',
      details: error.message,
    });
  }
});

// Get export history
router.get('/exports', (req, res) => {
  try {
    const { page = 1, limit = 10, dreamId } = req.query;

    // This would typically come from a database
    // For now, return mock data
    const mockExports = [
      {
        id: 'export_1',
        dreamId: dreamId || 'dream_1',
        format: 'webm',
        quality: 'medium',
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        downloadUrl: '/downloads/export_1.webm',
      },
      {
        id: 'export_2',
        dreamId: dreamId || 'dream_2',
        format: 'mp4',
        quality: 'high',
        status: 'processing',
        progress: 45,
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      },
    ];

    res.json({
      exports: mockExports,
      pagination: {
        currentPage: parseInt(page),
        totalItems: mockExports.length,
        totalPages: 1,
      },
    });
  } catch (error) {
    logger.error('Export history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export dream bundle (scene + assets)
router.post('/export-bundle', async (req, res) => {
  try {
    const { dreamId, includeAssets = true, includeSource = false } = req.body;

    if (!dreamId) {
      return res.status(400).json({ error: 'Dream ID is required' });
    }

    const dream = getFromCache(dreamId);
    if (!dream) {
      return res.status(404).json({ error: 'Dream not found' });
    }

    // Create exportable bundle
    const bundle = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      dream: dream,
      metadata: {
        title: dream.title,
        style: dream.style,
        duration: dream.cinematography?.durationSec || 30,
        structures: dream.structures?.length || 0,
        entities: dream.entities?.length || 0,
      },
    };

    if (includeSource) {
      bundle.sourceCode = {
        components: [
          'DreamScene.js',
          'CinematicCamera.js',
          'DreamEnvironment.js',
          'DreamStructures.js',
          'DreamEntities.js',
        ],
        instructions: 'See README.md for setup instructions',
      };
    }

    if (includeAssets) {
      bundle.assets = {
        textures: [],
        models: [],
        sounds: [],
        note: 'Assets would be included in production version',
      };
    }

    // In production, this would create a zip file
    res.json({
      success: true,
      bundle,
      downloadInstructions:
        'Copy this JSON to recreate the dream in another environment',
      size: JSON.stringify(bundle).length,
      format: 'json',
    });
  } catch (error) {
    logger.error('Bundle export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Utility functions
function getResolutionForQuality(quality) {
  switch (quality) {
    case 'draft':
      return [854, 480]; // 480p
    case 'medium':
      return [1280, 720]; // 720p
    case 'high':
      return [1920, 1080]; // 1080p
    default:
      return [1280, 720];
  }
}

function getFpsForQuality(quality) {
  switch (quality) {
    case 'draft':
      return 24;
    case 'medium':
      return 30;
    case 'high':
      return 60;
    default:
      return 30;
  }
}

function estimateFileSize(duration, resolution, fps, format) {
  // Rough estimates in MB
  const pixelCount = resolution[0] * resolution[1];
  const baseSize = (pixelCount * duration * fps) / 1000000;

  const formatMultiplier = {
    webm: 0.8,
    mp4: 1.0,
    gif: 2.5,
  };

  return Math.round(baseSize * (formatMultiplier[format] || 1.0));
}

function estimateRenderTime(duration, quality) {
  // Rough estimates in seconds
  const baseTime = duration * 0.5; // 0.5x real-time for basic rendering

  const qualityMultiplier = {
    draft: 1.0,
    medium: 2.0,
    high: 4.0,
  };

  return Math.round(baseTime * (qualityMultiplier[quality] || 2.0));
}

function shouldUseClientSide(quality, duration) {
  // Recommend client-side for quick exports
  return quality === 'draft' || duration <= 30;
}

async function attemptServerSideRender(dream, config) {
  if (!RENDER_WORKER_URL) {
    throw new Error('Render worker not configured');
  }

  try {
    const response = await fetch(`${RENDER_WORKER_URL}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dream,
        config,
        priority: 'normal',
      }),
      timeout: 10000,
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        job: result.job,
        downloadUrl: result.downloadUrl,
      };
    } else {
      throw new Error(`Render service returned ${response.status}`);
    }
  } catch (error) {
    logger.warn('Server-side render attempt failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = router;
