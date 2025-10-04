// services/express/utils/fallbackGenerator.js
const { v4: uuidv4 } = require('uuid');
const EnumMapper = require('../../../shared/validators/EnumMapper');
const ParameterValidator = require('../../../shared/validators/ParameterValidator');

// Style-specific configurations
const STYLE_CONFIGS = {
  ethereal: {
    environment: {
      preset: 'dusk',
      fog: 0.4,
      skyColor: '#a6d8ff',
      ambientLight: 0.9,
    },
    entityDefaults: {
      speed: 1.0,
      glow: 0.7,
      color: '#ffffff',
    },
    cameraDefaults: {
      startPos: [0, 30, 50],
      endPos: [0, 20, -30],
    },
  },
  cyberpunk: {
    environment: {
      preset: 'night',
      fog: 0.2,
      skyColor: '#001133',
      ambientLight: 0.4,
    },
    entityDefaults: {
      speed: 2.0,
      glow: 1.0,
      color: '#00ffff',
    },
    cameraDefaults: {
      startPos: [0, 15, 40],
      endPos: [0, 25, -25],
    },
  },
  surreal: {
    environment: {
      preset: 'void',
      fog: 0.6,
      skyColor: '#2d1a4a',
      ambientLight: 0.6,
    },
    entityDefaults: {
      speed: 1.5,
      glow: 0.9,
      color: '#ff0080',
    },
    cameraDefaults: {
      startPos: [30, 40, 30],
      endPos: [-30, 10, -30],
    },
  },
  fantasy: {
    environment: {
      preset: 'dawn',
      fog: 0.3,
      skyColor: '#ffb347',
      ambientLight: 1.1,
    },
    entityDefaults: {
      speed: 0.8,
      glow: 0.6,
      color: '#ffd700',
    },
    cameraDefaults: {
      startPos: [0, 35, 45],
      endPos: [0, 20, -25],
    },
  },
  nightmare: {
    environment: {
      preset: 'night',
      fog: 0.7,
      skyColor: '#1a0d1a',
      ambientLight: 0.2,
    },
    entityDefaults: {
      speed: 0.6,
      glow: 0.3,
      color: '#800020',
    },
    cameraDefaults: {
      startPos: [0, 10, 60],
      endPos: [0, 5, -40],
    },
  },
};

// Template structures for different themes
const STRUCTURE_TEMPLATES = {
  library: {
    template: 'floating_library',
    baseScale: 1.0,
    features: ['infinite_stair', 'glowing_books'],
  },
  tower: {
    template: 'crystal_tower',
    baseScale: 1.2,
    features: ['energy_rings', 'crystal_formations'],
  },
  house: {
    template: 'twisted_house',
    baseScale: 0.9,
    features: ['impossible_windows', 'shifting_rooms'],
  },
  arch: {
    template: 'portal_arch',
    baseScale: 1.1,
    features: ['portal_energy', 'ancient_runes'],
  },
  island: {
    template: 'floating_island',
    baseScale: 0.8,
    features: ['floating_rocks', 'ethereal_trees'],
  },
};

// Entity type mappings based on keywords
const ENTITY_KEYWORDS = {
  book: 'book_swarm',
  books: 'book_swarm',
  library: 'book_swarm',
  read: 'book_swarm',
  orb: 'floating_orbs',
  orbs: 'floating_orbs',
  sphere: 'floating_orbs',
  ball: 'floating_orbs',
  butterfly: 'light_butterflies',
  butterflies: 'light_butterflies',
  moth: 'light_butterflies',
  particle: 'particle_stream',
  particles: 'particle_stream',
  dust: 'particle_stream',
  shadow: 'shadow_figures',
  shadows: 'shadow_figures',
  figure: 'shadow_figures',
  memory: 'memory_fragments',
  memories: 'memory_fragments',
  fragment: 'memory_fragments',
};

// Structure keywords mapping
const STRUCTURE_KEYWORDS = {
  library: 'library',
  book: 'library',
  books: 'library',
  tower: 'tower',
  spire: 'tower',
  building: 'tower',
  house: 'house',
  home: 'house',
  building: 'house',
  arch: 'arch',
  portal: 'arch',
  gate: 'arch',
  island: 'island',
  land: 'island',
  ground: 'island',
};

function createFallbackDream(text, style = 'ethereal', options = {}) {
  const config = STYLE_CONFIGS[style] || STYLE_CONFIGS.ethereal;
  const dreamId = uuidv4();

  // Analyze text for keywords
  const lowerText = text.toLowerCase();
  const detectedStructures = detectStructures(lowerText);
  const detectedEntities = detectEntities(lowerText);

  // Generate title from text
  const title = generateTitle(text);

  // Create base dream structure
  const dream = {
    id: dreamId,
    title,
    style,
    source: 'express', // Required by schema
    seed: Math.floor(Math.random() * 1000000),
    environment: { ...config.environment },
    structures: generateStructures(detectedStructures, style, options),
    entities: generateEntities(detectedEntities, style, options),
    cinematography: generateCinematography(style, options),
    render: generateRenderConfig(options),
    assumptions: generateAssumptions(
      text,
      style,
      detectedStructures,
      detectedEntities
    ),
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'fallback_generator',
      version: '1.0.0',
      originalText: text,
      detectedKeywords: {
        structures: detectedStructures,
        entities: detectedEntities,
      },
    },
    created: new Date().toISOString(),
  };

  return dream;
}

function detectStructures(text) {
  const detected = [];

  for (const [keyword, structure] of Object.entries(STRUCTURE_KEYWORDS)) {
    if (text.includes(keyword)) {
      detected.push(structure);
    }
  }

  // Default to library if nothing detected
  if (detected.length === 0) {
    detected.push('library');
  }

  // Remove duplicates and limit to 3
  return [...new Set(detected)].slice(0, 3);
}

function detectEntities(text) {
  const detected = [];

  for (const [keyword, entity] of Object.entries(ENTITY_KEYWORDS)) {
    if (text.includes(keyword)) {
      detected.push(entity);
    }
  }

  // Default entities based on style if nothing detected
  if (detected.length === 0) {
    detected.push('book_swarm'); // Default
  }

  return [...new Set(detected)].slice(0, 3);
}

function generateTitle(text) {
  // Extract first meaningful phrase or use first 50 characters
  const sentences = text.split(/[.!?]+/);
  const firstSentence = sentences[0].trim();

  if (firstSentence.length <= 50) {
    return firstSentence;
  }

  // Take first 47 characters and add ellipsis
  return text.substring(0, 47).trim() + '...';
}

function generateStructures(detectedTypes, style, options) {
  const structures = [];
  const config = STYLE_CONFIGS[style];

  detectedTypes.forEach((type, index) => {
    const template = STRUCTURE_TEMPLATES[type];
    if (!template) return;

    // Position structures around the scene
    const angle = (index / detectedTypes.length) * Math.PI * 2;
    const distance = 20 + Math.random() * 30;

    structures.push({
      id: `s${index + 1}`,
      type: template.template, // Changed from 'template' to 'type' to match schema
      pos: [
        Math.cos(angle) * distance,
        10 + Math.random() * 20,
        Math.sin(angle) * distance,
      ],
      scale: template.baseScale * (0.8 + Math.random() * 0.4),
      rotation: [0, Math.random() * Math.PI * 2, 0],
      features: template.features || [],
    });
  });

  // Ensure at least one structure
  if (structures.length === 0) {
    structures.push({
      id: 's1',
      type: 'floating_library', // Changed from 'template' to 'type'
      pos: [0, 20, 0],
      scale: 1.0,
      features: ['infinite_stair'],
    });
  }

  return structures;
}

function generateEntities(detectedTypes, style, options) {
  const entities = [];
  const config = STYLE_CONFIGS[style];

  detectedTypes.forEach((type, index) => {
    const count = calculateEntityCount(type, style, options);

    // Calculate raw parameter values
    const rawSpeed = config.entityDefaults.speed * (0.7 + Math.random() * 0.6);
    const rawGlow = config.entityDefaults.glow * (0.8 + Math.random() * 0.4);
    const rawSize = 1.0 * (0.8 + Math.random() * 0.4);

    // Get constraints and validate/clamp parameters
    const speedConstraints = ParameterValidator.getParameterConstraints(
      type,
      'speed'
    );
    const glowConstraints = ParameterValidator.getParameterConstraints(
      type,
      'glow'
    );
    const sizeConstraints = ParameterValidator.getParameterConstraints(
      type,
      'size'
    );

    const speedResult = ParameterValidator.validateAndClamp(
      'speed',
      rawSpeed,
      speedConstraints
    );
    const glowResult = ParameterValidator.validateAndClamp(
      'glow',
      rawGlow,
      glowConstraints
    );
    const sizeResult = ParameterValidator.validateAndClamp(
      'size',
      rawSize,
      sizeConstraints
    );

    entities.push({
      id: `e${index + 1}`,
      type,
      count,
      params: {
        speed: speedResult.value,
        glow: glowResult.value,
        size: sizeResult.value,
        color: config.entityDefaults.color,
      },
    });
  });

  // Ensure at least one entity
  if (entities.length === 0) {
    const defaultType = 'book_swarm';
    const speedConstraints = ParameterValidator.getParameterConstraints(
      defaultType,
      'speed'
    );
    const glowConstraints = ParameterValidator.getParameterConstraints(
      defaultType,
      'glow'
    );
    const sizeConstraints = ParameterValidator.getParameterConstraints(
      defaultType,
      'size'
    );

    const speedResult = ParameterValidator.validateAndClamp(
      'speed',
      config.entityDefaults.speed,
      speedConstraints
    );
    const glowResult = ParameterValidator.validateAndClamp(
      'glow',
      config.entityDefaults.glow,
      glowConstraints
    );
    const sizeResult = ParameterValidator.validateAndClamp(
      'size',
      1.0,
      sizeConstraints
    );

    entities.push({
      id: 'e1',
      type: defaultType,
      count: 25,
      params: {
        speed: speedResult.value,
        glow: glowResult.value,
        size: sizeResult.value,
        color: config.entityDefaults.color,
      },
    });
  }

  return entities;
}

function calculateEntityCount(entityType, style, options) {
  const baseCounts = {
    book_swarm: 25,
    floating_orbs: 15,
    particle_stream: 50,
    shadow_figures: 8,
    light_butterflies: 20,
    memory_fragments: 12,
  };

  const baseCount = baseCounts[entityType] || 20;

  // Adjust based on style
  const styleMultipliers = {
    ethereal: 1.0,
    cyberpunk: 1.3,
    surreal: 0.8,
    fantasy: 1.1,
    nightmare: 0.7,
  };

  const multiplier = styleMultipliers[style] || 1.0;
  const count = Math.floor(baseCount * multiplier);

  return Math.max(5, Math.min(100, count)); // Clamp between 5 and 100
}

function generateCinematography(style, options) {
  const config = STYLE_CONFIGS[style];
  const duration = options.duration || 30;

  // Create shots based on duration
  const shots = [];

  if (duration <= 20) {
    // Short sequence - single shot
    shots.push({
      type: EnumMapper.mapShotType('establish'),
      target: 's1',
      duration: duration,
      startPos: config.cameraDefaults.startPos,
      endPos: config.cameraDefaults.endPos,
    });
  } else if (duration <= 40) {
    // Medium sequence - establish + flythrough
    const establishDuration = Math.floor(duration * 0.4);
    const flythroughDuration = duration - establishDuration;

    shots.push({
      type: EnumMapper.mapShotType('establish'),
      target: 's1',
      duration: establishDuration,
      startPos: config.cameraDefaults.startPos,
      endPos: [0, 25, 20],
    });

    shots.push({
      type: EnumMapper.mapShotType('flythrough'),
      target: 'e1',
      duration: flythroughDuration,
      startPos: [0, 25, 20],
      endPos: config.cameraDefaults.endPos,
    });
  } else {
    // Long sequence - establish + orbit + close_up
    const establishDuration = Math.floor(duration * 0.3);
    const orbitDuration = Math.floor(duration * 0.5);
    const closeupDuration = duration - establishDuration - orbitDuration;

    shots.push({
      type: EnumMapper.mapShotType('establish'),
      target: 's1',
      duration: establishDuration,
      startPos: config.cameraDefaults.startPos,
      endPos: [0, 25, 20],
    });

    shots.push({
      type: EnumMapper.mapShotType('orbit'),
      target: 's1',
      duration: orbitDuration,
    });

    shots.push({
      type: EnumMapper.mapShotType('close_up'),
      target: 'e1',
      duration: closeupDuration,
    });
  }

  return {
    durationSec: duration,
    shots,
  };
}

function generateRenderConfig(options) {
  const quality = options.quality || 'draft';

  const configs = {
    draft: {
      res: [854, 480],
      fps: 24,
      quality: 'draft',
    },
    medium: {
      res: [1280, 720],
      fps: 30,
      quality: 'medium',
    },
    high: {
      res: [1920, 1080],
      fps: 60,
      quality: 'high',
    },
  };

  return configs[quality] || configs.draft;
}

function generateAssumptions(text, style, structures, entities) {
  const assumptions = [];

  assumptions.push(
    `Generated fallback dream from text: "${text.substring(0, 100)}${
      text.length > 100 ? '...' : ''
    }"`
  );
  assumptions.push(`Applied ${style} style configuration`);

  if (structures.length > 0) {
    assumptions.push(
      `Detected and created structures: ${structures.join(', ')}`
    );
  } else {
    assumptions.push('No specific structures detected, used default library');
  }

  if (entities.length > 0) {
    assumptions.push(`Detected and created entities: ${entities.join(', ')}`);
  } else {
    assumptions.push('No specific entities detected, used default book swarm');
  }

  assumptions.push(
    'Used rule-based fallback generation due to AI service unavailability'
  );

  return assumptions;
}

// Create emergency dream for critical failures
function createEmergencyDream(originalText = 'Emergency dream') {
  const entityType = 'floating_orbs';

  // Validate and clamp parameters
  const speedConstraints = ParameterValidator.getParameterConstraints(
    entityType,
    'speed'
  );
  const glowConstraints = ParameterValidator.getParameterConstraints(
    entityType,
    'glow'
  );
  const sizeConstraints = ParameterValidator.getParameterConstraints(
    entityType,
    'size'
  );

  const speedResult = ParameterValidator.validateAndClamp(
    'speed',
    1.0,
    speedConstraints
  );
  const glowResult = ParameterValidator.validateAndClamp(
    'glow',
    0.5,
    glowConstraints
  );
  const sizeResult = ParameterValidator.validateAndClamp(
    'size',
    1.0,
    sizeConstraints
  );

  return {
    id: uuidv4(),
    title: 'Emergency Dream Scene',
    style: 'ethereal',
    source: 'express', // Required by schema
    seed: 12345,
    environment: {
      preset: 'dusk',
      fog: 0.3,
      skyColor: '#a6d8ff',
      ambientLight: 0.8,
    },
    structures: [
      {
        id: 'emergency_structure',
        type: 'floating_library', // Changed from 'template' to 'type'
        pos: [0, 20, 0],
        scale: 1.0,
        features: [],
      },
    ],
    entities: [
      {
        id: 'emergency_entity',
        type: entityType,
        count: 10,
        params: {
          speed: speedResult.value,
          glow: glowResult.value,
          size: sizeResult.value,
          color: '#ffffff',
        },
      },
    ],
    cinematography: {
      durationSec: 20,
      shots: [
        {
          type: EnumMapper.mapShotType('establish'),
          target: 'emergency_structure',
          duration: 20,
          startPos: [0, 30, 50],
          endPos: [0, 15, -20],
        },
      ],
    },
    render: {
      res: [1280, 720],
      fps: 30,
      quality: 'draft',
    },
    assumptions: [
      'Emergency fallback dream generated due to system failure',
      `Original request: "${originalText}"`,
      'Minimal safe configuration used',
      'All advanced features disabled for stability',
    ],
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'emergency_fallback',
      version: '1.0.0',
      originalText,
      failsafe: true,
    },
    created: new Date().toISOString(),
  };
}

// Generate themed dream variations
function createThemedDream(theme, style = 'ethereal', options = {}) {
  const themes = {
    ocean: {
      text: 'An underwater palace with floating jellyfish and coral towers',
      structures: ['tower'],
      entities: ['floating_orbs', 'particle_stream'],
    },
    forest: {
      text: 'A magical forest with tree houses and glowing butterflies',
      structures: ['house', 'island'],
      entities: ['light_butterflies', 'floating_orbs'],
    },
    space: {
      text: 'A space station orbiting distant stars with cosmic phenomena',
      structures: ['tower', 'arch'],
      entities: ['particle_stream', 'memory_fragments'],
    },
    desert: {
      text: 'Ancient pyramids rising from endless dunes under twin moons',
      structures: ['tower', 'arch'],
      entities: ['shadow_figures', 'memory_fragments'],
    },
    clouds: {
      text: 'Floating islands connected by rainbow bridges in cotton candy clouds',
      structures: ['island', 'arch'],
      entities: ['light_butterflies', 'floating_orbs'],
    },
  };

  const themeConfig = themes[theme];
  if (!themeConfig) {
    return createFallbackDream('A mysterious dreamscape', style, options);
  }

  return createFallbackDream(themeConfig.text, style, {
    ...options,
    forcedStructures: themeConfig.structures,
    forcedEntities: themeConfig.entities,
  });
}

// Analyze text complexity and suggest appropriate settings
function analyzeTextComplexity(text) {
  const wordCount = text.split(/\s+/).length;
  const sentenceCount = text.split(/[.!?]+/).length;
  const avgWordsPerSentence = wordCount / Math.max(sentenceCount, 1);

  // Count descriptive elements
  const descriptiveWords = [
    'beautiful',
    'mysterious',
    'glowing',
    'floating',
    'ancient',
    'magical',
    'ethereal',
    'dark',
    'bright',
    'colorful',
    'vast',
    'tiny',
    'enormous',
    'swift',
    'slow',
    'gentle',
    'fierce',
  ];

  const descriptiveCount = descriptiveWords.reduce((count, word) => {
    return count + (text.toLowerCase().includes(word) ? 1 : 0);
  }, 0);

  // Determine complexity
  let complexity = 'simple';
  if (wordCount > 50 || descriptiveCount > 5 || avgWordsPerSentence > 15) {
    complexity = 'moderate';
  }
  if (wordCount > 150 || descriptiveCount > 10 || avgWordsPerSentence > 25) {
    complexity = 'complex';
  }

  return {
    wordCount,
    sentenceCount,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    descriptiveCount,
    complexity,
    suggestions: getComplexitySuggestions(complexity),
  };
}

function getComplexitySuggestions(complexity) {
  switch (complexity) {
    case 'simple':
      return [
        'Consider adding more descriptive details',
        'Mention specific colors, sizes, or movements',
        'Include emotional or atmospheric elements',
      ];
    case 'moderate':
      return [
        'Good level of detail for rich 3D generation',
        'Consider specifying camera movements or perspectives',
        'Add temporal elements (day/night, seasons, etc.)',
      ];
    case 'complex':
      return [
        'Rich description detected - expect detailed scene',
        'May take longer to process due to complexity',
        'Consider breaking into multiple shorter dreams',
      ];
    default:
      return [];
  }
}

// Style compatibility checker
function checkStyleCompatibility(text, suggestedStyle) {
  const styleKeywords = {
    ethereal: [
      'dream',
      'soft',
      'gentle',
      'light',
      'peaceful',
      'serene',
      'floating',
    ],
    cyberpunk: [
      'neon',
      'digital',
      'cyber',
      'tech',
      'electronic',
      'virtual',
      'code',
    ],
    surreal: [
      'impossible',
      'strange',
      'weird',
      'abstract',
      'distorted',
      'bizarre',
    ],
    fantasy: [
      'magical',
      'mystical',
      'enchanted',
      'fairy',
      'dragon',
      'castle',
      'quest',
    ],
    nightmare: [
      'dark',
      'scary',
      'shadow',
      'fear',
      'terror',
      'monster',
      'creepy',
    ],
  };

  const lowerText = text.toLowerCase();
  const compatibility = {};

  Object.entries(styleKeywords).forEach(([style, keywords]) => {
    const matches = keywords.filter((keyword) => lowerText.includes(keyword));
    compatibility[style] = {
      score: matches.length,
      matches,
      recommended: matches.length >= 2,
    };
  });

  // Find best match
  const bestMatch = Object.entries(compatibility).sort(
    (a, b) => b[1].score - a[1].score
  )[0];

  return {
    compatibility,
    suggestedStyle: bestMatch[1].score > 0 ? bestMatch[0] : suggestedStyle,
    confidence:
      bestMatch[1].score > 2
        ? 'high'
        : bestMatch[1].score > 0
        ? 'medium'
        : 'low',
  };
}

module.exports = {
  createFallbackDream,
  createEmergencyDream,
  createThemedDream,
  analyzeTextComplexity,
  checkStyleCompatibility,
  STYLE_CONFIGS,
  STRUCTURE_TEMPLATES,
  ENTITY_KEYWORDS,
  STRUCTURE_KEYWORDS,
};
