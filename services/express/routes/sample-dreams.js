// services/express/routes/sample-dreams.js
const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

// Security: Only allow specific JSON files
const ALLOWED_FILES = [
  'star_collision.json',
  'titanic_ocean_voyage.json',
  'volcano_eruption.json',
  'floating_library_books.json',
  'growing_house_tree.json',
  'cosmic_voyage_3d.json',
  'cyberpunk_garden.json',
  'ethereal_library.json',
  'surreal_house.json',
];

router.get('/sample-dreams/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Security check
    if (!ALLOWED_FILES.includes(filename)) {
      logger.warn(`Attempted access to unauthorized file: ${filename}`);
      return res.status(404).json({ error: 'File not found' });
    }

    // Try multiple possible paths since the directory might be mounted differently
    const possiblePaths = [
      // When running in Docker with volume mount
      path.join('/app/sample_dreams', filename),
      // When running locally from project root
      path.join(process.cwd(), '..', '..', 'sample_dreams', filename),
      // When running from services/express
      path.join(process.cwd(), '..', '..', 'sample_dreams', filename),
    ];

    logger.info(`Loading sample dream: ${filename}`);
    logger.debug(`Trying paths: ${possiblePaths.join(', ')}`);

    // Try each path until we find one that works
    let fileContent = null;
    let successfulPath = null;

    for (const filePath of possiblePaths) {
      try {
        fileContent = await fs.readFile(filePath, 'utf-8');
        successfulPath = filePath;
        logger.info(`✅ Successfully loaded from: ${filePath}`);
        break;
      } catch (err) {
        logger.debug(`❌ Failed to load from: ${filePath}`);
        continue;
      }
    }

    if (!fileContent || !successfulPath) {
      logger.error(`File not found in any location: ${filename}`);
      return res.status(404).json({
        error: 'Sample dream file not found',
        filename,
        triedPaths: possiblePaths,
      });
    }

    const dreamData = JSON.parse(fileContent);

    logger.info(`✅ Successfully served sample dream: ${filename}`);

    // Return the dream data with caching headers
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    });

    res.json(dreamData);
  } catch (error) {
    logger.error('Error loading sample dream:', {
      error: error.message,
      filename: req.params.filename,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Failed to load sample dream',
      details: error.message,
    });
  }
});

module.exports = router;
