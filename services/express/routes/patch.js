// services/express/routes/patch.js
const express = require('express');
const fetch = require('node-fetch');
const { getFromCache, setToCache } = require('../middleware/cache');
const { validateDream } = require('../middleware/validation');
const { logger } = require('../utils/logger');

const router = express.Router();
const MCP_GATEWAY_URL =
  process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8080';

// Apply modifications to existing dream
router.post('/patch-dream', async (req, res) => {
  const startTime = Date.now();

  try {
    const { dreamId, editText, options = {} } = req.body;

    // Input validation
    if (!dreamId || typeof dreamId !== 'string') {
      return res.status(400).json({
        error: 'Dream ID is required',
        details: 'Provide the ID of the dream to modify',
      });
    }

    if (
      !editText ||
      typeof editText !== 'string' ||
      editText.trim().length === 0
    ) {
      return res.status(400).json({
        error: 'Edit text is required',
        details: 'Describe what changes you want to make',
        examples: [
          'make the books glow blue',
          'add more floating islands',
          'make the camera move faster',
          'change to nighttime',
        ],
      });
    }

    if (editText.length > 500) {
      return res.status(400).json({
        error: 'Edit text too long',
        details: 'Maximum 500 characters allowed',
        currentLength: editText.length,
      });
    }

    logger.info(`Patching dream ${dreamId}: "${editText}"`);

    // Find the original dream
    const originalDream = getFromCache(dreamId);
    if (!originalDream) {
      return res.status(404).json({
        error: 'Dream not found',
        dreamId,
        suggestion: 'Check /api/dreams for available dreams',
      });
    }

    let patchedDream = null;
    let patchSource = 'unknown';

    try {
      // Try MCP Gateway first for AI-powered patching
      logger.info('Attempting AI-powered dream patching...');

      const response = await fetch(`${MCP_GATEWAY_URL}/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseJson: originalDream,
          editText: editText.trim(),
          options,
        }),
        timeout: 20000,
      });

      if (response.ok) {
        const result = await response.json();
        patchedDream = result.data || result.fallback;
        patchSource = result.data ? 'ai' : 'ai_fallback';

        if (patchedDream) {
          logger.info(`✅ AI patching successful (source: ${patchSource})`);
        }
      } else {
        const errorText = await response.text();
        throw new Error(
          `MCP Gateway returned ${response.status}: ${errorText}`
        );
      }
    } catch (mcpError) {
      logger.warn('AI patching failed:', mcpError.message);
      patchedDream = null;
    }

    // Fallback to rule-based patching
    if (!patchedDream) {
      logger.info('Using rule-based dream patching');
      patchedDream = applyRuleBasedPatch(originalDream, editText.trim());
      patchSource = 'rule_based';
    }

    // Validate the patched dream
    const validation = validateDream(patchedDream);
    if (!validation.valid) {
      logger.warn('Patched dream validation failed, using safe patch');
      patchedDream = applySafePatch(originalDream, editText.trim());
      patchSource = 'safe_fallback';
    }

    // Update metadata
    patchedDream.id = originalDream.id; // Keep same ID
    patchedDream.modified = new Date().toISOString();
    patchedDream.patchHistory = originalDream.patchHistory || [];
    patchedDream.patchHistory.push({
      editText: editText.trim(),
      appliedAt: new Date().toISOString(),
      source: patchSource,
      processingTime: Date.now() - startTime,
    });

    // Update assumptions
    if (!patchedDream.assumptions) {
      patchedDream.assumptions = [];
    }
    patchedDream.assumptions.push(
      `Applied edit: "${editText.trim()}" (${patchSource})`
    );

    // Cache the updated dream
    setToCache(dreamId, patchedDream);

    // Update in all_dreams cache
    const allDreams = getFromCache('all_dreams') || [];
    const dreamIndex = allDreams.findIndex((d) => d.id === dreamId);
    if (dreamIndex >= 0) {
      allDreams[dreamIndex] = patchedDream;
      setToCache('all_dreams', allDreams);
    }

    logger.info(
      `✅ Dream patched successfully (${patchSource}) in ${
        Date.now() - startTime
      }ms`
    );

    res.json({
      success: true,
      data: patchedDream,
      metadata: {
        processingTime: Date.now() - startTime,
        patchSource,
        editText: editText.trim(),
        patchesApplied: patchedDream.patchHistory.length,
      },
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Dream patching error:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      metadata: {
        processingTime,
        errorOccurred: true,
      },
    });
  }
});

// Rule-based patching for reliable fallback
function applyRuleBasedPatch(baseDream, editText) {
  const patched = JSON.parse(JSON.stringify(baseDream)); // Deep copy
  const edit = editText.toLowerCase();
  const appliedChanges = [];

  // Color modifications
  const colorMap = {
    red: '#ff0000',
    blue: '#0000ff',
    green: '#00ff00',
    yellow: '#ffff00',
    purple: '#800080',
    pink: '#ff69b4',
    orange: '#ffa500',
    white: '#ffffff',
    black: '#000000',
    gold: '#ffd700',
    silver: '#c0c0c0',
    cyan: '#00ffff',
  };

  Object.entries(colorMap).forEach(([colorName, colorHex]) => {
    if (edit.includes(colorName)) {
      // Update entity colors
      if (patched.entities) {
        patched.entities.forEach((entity) => {
          if (!entity.params) entity.params = {};
          entity.params.color = colorHex;
        });
        appliedChanges.push(`Changed entity colors to ${colorName}`);
      }

      // Update environment colors
      if (edit.includes('sky') && patched.environment) {
        patched.environment.skyColor = colorHex;
        appliedChanges.push(`Changed sky color to ${colorName}`);
      }
    }
  });

  // Glow/brightness modifications
  if (
    edit.includes('glow') ||
    edit.includes('bright') ||
    edit.includes('luminous')
  ) {
    if (patched.entities) {
      patched.entities.forEach((entity) => {
        if (!entity.params) entity.params = {};
        entity.params.glow = Math.min(1.0, (entity.params.glow || 0.5) + 0.4);
      });
      appliedChanges.push('Increased glow effects');
    }
  }

  if (edit.includes('dim') || edit.includes('darker')) {
    if (patched.entities) {
      patched.entities.forEach((entity) => {
        if (!entity.params) entity.params = {};
        entity.params.glow = Math.max(0.0, (entity.params.glow || 0.5) - 0.3);
      });
      appliedChanges.push('Decreased brightness');
    }

    if (patched.environment) {
      patched.environment.ambientLight = Math.max(
        0.1,
        (patched.environment.ambientLight || 0.8) - 0.4
      );
      appliedChanges.push('Darkened environment');
    }
  }

  // Size modifications
  if (
    edit.includes('bigger') ||
    edit.includes('larger') ||
    edit.includes('huge')
  ) {
    if (patched.structures) {
      patched.structures.forEach((structure) => {
        structure.scale = (structure.scale || 1.0) * 1.5;
      });
      appliedChanges.push('Increased structure sizes');
    }

    if (patched.entities) {
      patched.entities.forEach((entity) => {
        entity.count = Math.min(100, Math.floor((entity.count || 10) * 1.3));
      });
      appliedChanges.push('Increased entity counts');
    }
  }

  if (
    edit.includes('smaller') ||
    edit.includes('tiny') ||
    edit.includes('mini')
  ) {
    if (patched.structures) {
      patched.structures.forEach((structure) => {
        structure.scale = Math.max(0.1, (structure.scale || 1.0) * 0.7);
      });
      appliedChanges.push('Decreased structure sizes');
    }
  }

  // Speed modifications
  if (
    edit.includes('faster') ||
    edit.includes('quick') ||
    edit.includes('speed up')
  ) {
    if (patched.entities) {
      patched.entities.forEach((entity) => {
        if (!entity.params) entity.params = {};
        entity.params.speed = (entity.params.speed || 1.0) * 1.5;
      });
      appliedChanges.push('Increased movement speed');
    }

    // Speed up camera if mentioned
    if (edit.includes('camera')) {
      if (patched.cinematography && patched.cinematography.shots) {
        patched.cinematography.shots.forEach((shot) => {
          shot.duration = Math.max(2, shot.duration * 0.8);
        });
        appliedChanges.push('Sped up camera movement');
      }
    }
  }

  if (
    edit.includes('slower') ||
    edit.includes('gentle') ||
    edit.includes('calm')
  ) {
    if (patched.entities) {
      patched.entities.forEach((entity) => {
        if (!entity.params) entity.params = {};
        entity.params.speed = Math.max(0.1, (entity.params.speed || 1.0) * 0.7);
      });
      appliedChanges.push('Slowed down movement');
    }
  }

  // Quantity modifications
  if (edit.includes('more') && !edit.includes('slower')) {
    if (patched.entities) {
      patched.entities.forEach((entity) => {
        entity.count = Math.min(100, Math.floor((entity.count || 10) * 1.6));
      });
      appliedChanges.push('Added more entities');
    }
  }

  if (edit.includes('less') || edit.includes('fewer')) {
    if (patched.entities) {
      patched.entities.forEach((entity) => {
        entity.count = Math.max(1, Math.floor((entity.count || 10) * 0.6));
      });
      appliedChanges.push('Reduced entity count');
    }
  }

  // Environment modifications
  if (edit.includes('fog') || edit.includes('misty') || edit.includes('hazy')) {
    if (!patched.environment) patched.environment = {};
    patched.environment.fog = 0.7;
    appliedChanges.push('Added fog effect');
  }

  if (edit.includes('clear') && patched.environment) {
    patched.environment.fog = 0.1;
    appliedChanges.push('Cleared atmosphere');
  }

  // Time of day modifications
  if (edit.includes('night') || edit.includes('dark')) {
    if (!patched.environment) patched.environment = {};
    patched.environment.preset = 'night';
    patched.environment.ambientLight = 0.3;
    patched.environment.skyColor = '#0a0a2e';
    appliedChanges.push('Changed to nighttime');
  }

  if (
    edit.includes('day') ||
    edit.includes('bright') ||
    edit.includes('sunny')
  ) {
    if (!patched.environment) patched.environment = {};
    patched.environment.preset = 'dawn';
    patched.environment.ambientLight = 1.2;
    patched.environment.skyColor = '#87ceeb';
    appliedChanges.push('Changed to daytime');
  }

  // Camera modifications
  if (edit.includes('closer') || edit.includes('zoom in')) {
    if (patched.cinematography && patched.cinematography.shots) {
      patched.cinematography.shots.forEach((shot) => {
        if (shot.startPos) {
          shot.startPos = shot.startPos.map((coord) => coord * 0.8);
        }
        if (shot.endPos) {
          shot.endPos = shot.endPos.map((coord) => coord * 0.8);
        }
      });
      appliedChanges.push('Moved camera closer');
    }
  }

  if (
    edit.includes('further') ||
    edit.includes('zoom out') ||
    edit.includes('pull back')
  ) {
    if (patched.cinematography && patched.cinematography.shots) {
      patched.cinematography.shots.forEach((shot) => {
        if (shot.startPos) {
          shot.startPos = shot.startPos.map((coord) => coord * 1.3);
        }
        if (shot.endPos) {
          shot.endPos = shot.endPos.map((coord) => coord * 1.3);
        }
      });
      appliedChanges.push('Moved camera further back');
    }
  }

  // Add new structures
  if (
    edit.includes('add') &&
    (edit.includes('tower') || edit.includes('building'))
  ) {
    if (!patched.structures) patched.structures = [];
    patched.structures.push({
      id: `added_${Date.now()}`,
      template: 'crystal_tower',
      pos: [Math.random() * 40 - 20, 20, Math.random() * 40 - 20],
      scale: 1,
      features: [],
    });
    appliedChanges.push('Added new tower structure');
  }

  if (edit.includes('add') && edit.includes('island')) {
    if (!patched.structures) patched.structures = [];
    patched.structures.push({
      id: `island_${Date.now()}`,
      template: 'floating_island',
      pos: [Math.random() * 60 - 30, 15, Math.random() * 60 - 30],
      scale: 0.8,
      features: [],
    });
    appliedChanges.push('Added floating island');
  }

  // Style changes
  const styleKeywords = {
    cyberpunk: ['neon', 'digital', 'cyber', 'tech'],
    ethereal: ['dreamy', 'soft', 'gentle', 'light'],
    surreal: ['weird', 'impossible', 'strange', 'abstract'],
    fantasy: ['magical', 'mystical', 'enchanted', 'fairy'],
    nightmare: ['dark', 'scary', 'creepy', 'shadow'],
  };

  Object.entries(styleKeywords).forEach(([style, keywords]) => {
    if (keywords.some((keyword) => edit.includes(keyword))) {
      patched.style = style;
      appliedChanges.push(`Changed style to ${style}`);
    }
  });

  // Record what changes were applied
  patched.lastPatchChanges = appliedChanges;

  return patched;
}

// Safe patching that only modifies assumptions (guaranteed to work)
function applySafePatch(baseDream, editText) {
  const safe = JSON.parse(JSON.stringify(baseDream));

  if (!safe.assumptions) {
    safe.assumptions = [];
  }

  safe.assumptions.push(`Requested edit: "${editText}"`);
  safe.assumptions.push('Applied as safe patch (original dream preserved)');
  safe.lastPatchChanges = ['Edit recorded in assumptions'];

  return safe;
}

// Batch patch endpoint for multiple edits
router.post('/patch-dream/batch', async (req, res) => {
  try {
    const { dreamId, edits } = req.body;

    if (!dreamId || !Array.isArray(edits) || edits.length === 0) {
      return res.status(400).json({
        error: 'Invalid batch patch request',
        details: 'Provide dreamId and array of edit texts',
      });
    }

    if (edits.length > 10) {
      return res.status(400).json({
        error: 'Too many edits',
        details: 'Maximum 10 edits per batch',
        provided: edits.length,
      });
    }

    let currentDream = getFromCache(dreamId);
    if (!currentDream) {
      return res.status(404).json({ error: 'Dream not found' });
    }

    const results = [];

    for (const editText of edits) {
      try {
        const patched = applyRuleBasedPatch(currentDream, editText);
        currentDream = patched;
        results.push({
          editText,
          success: true,
          changes: patched.lastPatchChanges || [],
        });
      } catch (error) {
        results.push({
          editText,
          success: false,
          error: error.message,
        });
      }
    }

    // Update cache with final result
    setToCache(dreamId, currentDream);

    res.json({
      success: true,
      data: currentDream,
      batchResults: results,
      totalEdits: edits.length,
      successfulEdits: results.filter((r) => r.success).length,
    });
  } catch (error) {
    logger.error('Batch patch error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
