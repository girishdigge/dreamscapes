const PromptAnalyzer = require('./PromptAnalyzer');

/**
 * Cerebras Service for dream generation
 *
 * NOTE: This is currently a mock implementation that generates dreams based on prompts
 * without making actual API calls to Cerebras. In production, this should be replaced
 * with real Cerebras API integration.
 */
class CerebrasService {
  constructor(config = {}) {
    if (!config.apiKey) {
      throw new Error('Cerebras API key is required');
    }
    this.config = config;
    this.promptAnalyzer = new PromptAnalyzer();
  }

  getConfig() {
    return this.config;
  }

  /**
   * Generate dream content with robust response processing pipeline
   * @param {string} prompt - The prompt for dream generation
   * @param {Object} options - Generation options
   * @returns {string} Consistent string content
   */
  async generateDream(prompt, options = {}) {
    try {
      // Validate input
      if (!prompt || typeof prompt !== 'string') {
        throw new Error('Invalid prompt: must be a non-empty string');
      }

      // TODO: Replace this mock implementation with actual Cerebras API call
      // For now, we'll simulate the AI generating a dream based on the prompt
      const generatedDream = await this._generateDreamFromPrompt(
        prompt,
        options
      );

      // Parse and validate the generated dream
      let dreamObject;
      try {
        dreamObject = await JSON.parse(generatedDream);
      } catch (parseError) {
        console.error(
          '❌ Failed to parse generated dream:',
          parseError.message
        );
        throw new Error(
          `Generated dream is not valid JSON: ${parseError.message}`
        );
      }

      // Validate the dream object
      const validationResult = await this._validateGeneratedDream(
        dreamObject,
        prompt
      );

      if (!validationResult.valid) {
        console.warn(
          '⚠️ Generated dream has validation errors, applying repair...'
        );

        // Apply content repair if validation failed
        const repairedDream = await this._repairGeneratedDream(
          dreamObject,
          prompt,
          options
        );

        // Log repair results
        console.log('🔧 Dream repair completed:', {
          originalErrors: validationResult.errorCount,
          remainingErrors: repairedDream.validationResult.errorCount,
          repairApplied: repairedDream.repairApplied,
        });

        return JSON.stringify(repairedDream.dream);
      }

      console.log('✅ Generated dream passed validation');

      return generatedDream;
    } catch (error) {
      throw new Error(`Cerebras dream generation failed: ${error.message}`);
    }
  }

  /**
   * Generate dream content based on the prompt (mock implementation)
   * This should be replaced with actual Cerebras API call
   * @param {string} prompt - The prompt for dream generation
   * @param {Object} options - Generation options
   * @returns {string} Generated dream JSON string
   * @private
   */
  async _generateDreamFromPrompt(prompt, options = {}) {
    const { v4: uuidv4 } = require('uuid');
    const { EnumMapper, ParameterValidator } = require('../../../shared');

    // Extract style from options or prompt
    const requestedStyle = options.style || 'ethereal';

    // Use the prompt directly as the dream description
    // Remove any "User dream:" or "style:" prefixes if present
    let dreamDescription = prompt.trim();

    // Remove "User dream:" prefix if present
    const dreamMatch = dreamDescription.match(/User dream:\s*(.+?)(?:\n|$)/i);
    if (dreamMatch) {
      dreamDescription = dreamMatch[1].trim();
    }

    // Remove "style:" suffix if present
    dreamDescription = dreamDescription
      .replace(/\s*style:\s*\w+\s*$/i, '')
      .trim();

    // Generate title from description (first 50 chars)
    const title =
      dreamDescription.length > 50
        ? dreamDescription.substring(0, 47) + '...'
        : dreamDescription;

    // Validate style
    const validatedStyle = this._validateStyle(requestedStyle);

    // Extract keywords from prompt for intelligent generation using PromptAnalyzer
    const analysis = this.promptAnalyzer.analyze(dreamDescription);

    console.log('🔍 Extracted keywords from prompt:', {
      entities: analysis.entities,
      actions: analysis.actions,
      locations: analysis.locations,
      quantities: analysis.quantities,
      mood: analysis.mood,
      timeOfDay: analysis.timeOfDay,
      confidence: analysis.confidence,
    });

    // Generate structures and entities first
    const structures = this._generateStructuresFromPrompt(
      dreamDescription,
      validatedStyle,
      analysis
    );
    const entities = this._generateEntitiesFromPrompt(
      dreamDescription,
      validatedStyle,
      analysis
    );

    // Create a dream structure based on the prompt content
    const dreamData = {
      id: uuidv4(), // Use UUID format
      title: title,
      style: validatedStyle,
      structures: structures,
      entities: entities,
      cinematography: this._generateCinematographyFromPrompt(
        dreamDescription,
        options,
        structures,
        entities
      ),
      environment: this._generateEnvironmentFromPrompt(
        dreamDescription,
        validatedStyle
      ),
      render: {
        res: [1280, 720],
        fps: 30,
        quality: 'medium',
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        source: 'cerebras', // Valid source enum
        version: '1.0.0',
        originalText: dreamDescription,
        requestedStyle: validatedStyle,
      },
      created: new Date().toISOString(),
      source: 'cerebras', // Valid source enum
    };

    // Validate and clamp all entity parameters
    const paramRepairResult =
      ParameterValidator.repairDreamParameters(dreamData);
    if (paramRepairResult.repaired) {
      console.log('✅ Entity parameters validated and clamped:', {
        repairCount: paramRepairResult.repairs.length,
        repairs: paramRepairResult.repairs,
      });
    }

    console.log('✅ Generated complete dream:', {
      structures: dreamData.structures.length,
      entities: dreamData.entities.length,
      shots: dreamData.cinematography.shots.length,
      duration: dreamData.cinematography.durationSec,
    });

    return JSON.stringify(dreamData);
  }

  /**
   * Validate generated dream object
   * @param {Object} dream - Generated dream object
   * @param {string} originalPrompt - Original user prompt
   * @returns {Object} Validation result
   * @private
   */
  async _validateGeneratedDream(dream, originalPrompt) {
    try {
      // Import validator
      const { UnifiedValidator } = require('../../../shared');
      const validator = new UnifiedValidator({ logErrors: false });

      // Validate the dream object
      const validationResult = validator.validateDreamObject(dream);

      // Log validation results
      if (!validationResult.valid) {
        console.warn('🔍 Dream validation failed:', {
          errorCount: validationResult.errorCount,
          criticalErrors: validationResult.criticalCount || 0,
          errors: validationResult.errors.slice(0, 5), // Log first 5 errors
        });
      }

      return validationResult;
    } catch (error) {
      console.error('❌ Validation error:', error.message);
      // Return a failed validation result
      return {
        valid: false,
        errors: [{ message: `Validation failed: ${error.message}` }],
        errorCount: 1,
      };
    }
  }

  /**
   * Repair generated dream object if validation fails
   * @param {Object} dream - Dream object to repair
   * @param {string} originalPrompt - Original user prompt
   * @param {Object} options - Generation options
   * @returns {Object} Repaired dream and validation result
   * @private
   */
  async _repairGeneratedDream(dream, originalPrompt, options) {
    try {
      // Import content repair from shared module
      const { EnhancedContentRepair } = require('../../../shared');
      const contentRepair = new EnhancedContentRepair();

      // Wrap dream in expected format for repair
      const wrappedContent = {
        data: dream,
        metadata: dream.metadata || {},
      };

      // Apply repair
      const repairResult = await contentRepair.repairContent(
        wrappedContent,
        [],
        { originalPrompt, ...options }
      );

      // Extract repaired dream
      const repairedDream = repairResult.content.data;

      // Validate repaired dream
      const validationResult = await this._validateGeneratedDream(
        repairedDream,
        originalPrompt
      );

      return {
        dream: repairedDream,
        validationResult,
        repairApplied: repairResult.success,
        appliedStrategies: repairResult.appliedStrategies || [],
      };
    } catch (error) {
      console.error('❌ Dream repair failed:', error.message);
      // Return original dream if repair fails
      return {
        dream,
        validationResult: {
          valid: false,
          errors: [{ message: error.message }],
          errorCount: 1,
        },
        repairApplied: false,
        appliedStrategies: [],
      };
    }
  }

  /**
   * Validate and normalize style
   * @param {string} style - Requested style
   * @returns {string} Valid style
   * @private
   */
  _validateStyle(style) {
    const validStyles = [
      'ethereal',
      'cyberpunk',
      'surreal',
      'fantasy',
      'nightmare',
    ];
    return validStyles.includes(style) ? style : 'ethereal';
  }

  /**
   * Generate environment based on prompt content
   * @param {string} description - Dream description
   * @param {string} style - Dream style
   * @returns {Object} Environment configuration
   * @private
   */
  _generateEnvironmentFromPrompt(description, style) {
    const lowerDesc = description.toLowerCase();

    // Detect environment keywords
    let preset = 'dusk'; // default
    if (lowerDesc.includes('night') || lowerDesc.includes('dark'))
      preset = 'night';
    if (lowerDesc.includes('dawn') || lowerDesc.includes('morning'))
      preset = 'dawn';
    if (lowerDesc.includes('void') || lowerDesc.includes('space'))
      preset = 'void';
    if (lowerDesc.includes('underwater') || lowerDesc.includes('ocean'))
      preset = 'underwater';

    const styleConfigs = {
      ethereal: { fog: 0.4, skyColor: '#a6d8ff', ambientLight: 0.9 },
      cyberpunk: { fog: 0.2, skyColor: '#001133', ambientLight: 0.4 },
      surreal: { fog: 0.6, skyColor: '#2d1a4a', ambientLight: 0.6 },
      fantasy: { fog: 0.3, skyColor: '#ffb347', ambientLight: 1.1 },
      nightmare: { fog: 0.7, skyColor: '#1a0d1a', ambientLight: 0.2 },
    };

    const config = styleConfigs[style] || styleConfigs.ethereal;

    return {
      preset,
      ...config,
    };
  }

  /**
   * Map keywords to structure types
   * @param {Object} keywords - Extracted keywords
   * @param {string} style - Dream style
   * @returns {Array} Structure type mappings
   * @private
   */
  _mapAnalysisToStructures(analysis, style) {
    const structureTypes = [];

    // Use entities that could be structures (like stars, buildings, etc.)
    for (const entity of analysis.entities) {
      // Check if this entity could be a structure
      if (this._isStructuralEntity(entity)) {
        structureTypes.push(entity);
      }
    }

    // Use locations as structure inspiration
    for (const location of analysis.locations) {
      structureTypes.push(location);
    }

    // If we have specific structure types, use them
    if (structureTypes.length > 0) {
      return structureTypes.slice(0, 3); // Limit to 3 structures
    }

    // Otherwise, use style-based defaults
    const styleDefaults = {
      ethereal: ['floating_platform', 'crystal_spire', 'organic_tree'],
      cyberpunk: ['geometric_form', 'crystal_tower', 'abstract_sculpture'],
      surreal: ['twisted_house', 'infinite_staircase', 'portal_arch'],
      fantasy: ['floating_library', 'crystal_tower', 'organic_tree'],
      nightmare: ['twisted_house', 'portal_arch', 'abstract_sculpture'],
    };

    return styleDefaults[style] || styleDefaults.ethereal;
  }

  /**
   * Check if an entity could be used as a structure
   * @param {string} entity - Entity name
   * @returns {boolean} True if entity could be a structure
   * @private
   */
  _isStructuralEntity(entity) {
    const structuralEntities = [
      'star',
      'stars',
      'planet',
      'planets',
      'moon',
      'moons',
      'house',
      'houses',
      'tower',
      'towers',
      'castle',
      'castles',
      'building',
      'buildings',
      'library', // ✅ Added library
      'libraries',
      'tree',
      'trees',
      'rock',
      'rocks',
      'crystal',
      'crystals',
      'mountain',
      'mountains',
      'temple',
      'temples',
      'palace',
      'palaces',
      'bridge',
      'bridges',
      'arch',
      'arches',
      'gate',
      'gates',
      'pillar',
      'pillars',
      'statue',
      'statues',
      'monument',
      'monuments',
    ];
    return structuralEntities.includes(entity);
  }

  /**
   * Generate structures based on prompt content with intelligent keyword extraction
   * @param {string} description - Dream description
   * @param {string} style - Dream style
   * @param {Object} analysis - Extracted analysis (optional)
   * @returns {Array} Structures array
   * @private
   */
  _generateStructuresFromPrompt(
    description,
    style = 'ethereal',
    analysis = null
  ) {
    // Extract analysis if not provided
    if (!analysis) {
      analysis = this.promptAnalyzer.analyze(description);
    }

    // Map analysis to structure types - use entities that could be structures
    const structureTypes = this._mapAnalysisToStructures(analysis, style);

    // Determine structure count based on quantities in prompt
    let structureCount = 1; // Default to 1

    // Check if we have explicit quantities for structural entities
    if (analysis.quantities && Object.keys(analysis.quantities).length > 0) {
      // Sum up quantities for structural entities
      let totalStructuralCount = 0;
      for (const [entity, count] of Object.entries(analysis.quantities)) {
        if (this._isStructuralEntity(entity)) {
          totalStructuralCount += count;
        }
      }

      if (totalStructuralCount > 0) {
        structureCount = Math.min(totalStructuralCount, 10); // Cap at 10 structures
        console.log(
          `🔢 Using quantity from prompt: ${structureCount} structures`
        );
      }
    }

    // If no quantities found, use word count heuristic
    if (structureCount === 1 && !analysis.quantities) {
      const wordCount = description.split(/\s+/).length;
      const baseCount = Math.min(Math.max(1, Math.floor(wordCount / 10)), 5);
      structureCount = Math.min(structureTypes.length, baseCount);
    }

    const structures = [];

    // Generate structures based on count
    for (let i = 0; i < structureCount; i++) {
      const type =
        structureTypes[i % structureTypes.length] || structureTypes[0];

      // Position structures in a circle or pattern
      const angle = (i / Math.max(structureCount, 2)) * Math.PI * 2;
      const distance = structureCount > 1 ? 20 + Math.random() * 15 : 0;

      // Generate style-appropriate features
      const features = this._generateStructureFeatures(type, style);

      structures.push({
        id: `s${i + 1}`,
        type,
        pos: [
          Math.cos(angle) * distance,
          10 + Math.random() * 20,
          Math.sin(angle) * distance,
        ],
        scale: 0.8 + Math.random() * 0.4,
        rotation: [0, Math.random() * Math.PI * 2, 0],
        features,
      });
    }

    // Ensure at least one structure
    if (structures.length === 0) {
      structures.push({
        id: 's1',
        type: 'floating_platform',
        pos: [0, 20, 0],
        scale: 1.0,
        rotation: [0, 0, 0],
        features: ['glowing_edges'],
      });
    }

    console.log(`✅ Generated ${structures.length} structures from prompt`);
    return structures;
  }

  /**
   * Generate appropriate features for structure based on type and style
   * @param {string} type - Structure type
   * @param {string} style - Dream style
   * @returns {Array} Features array
   * @private
   */
  _generateStructureFeatures(type, style) {
    const styleFeatures = {
      ethereal: ['glowing_edges', 'particle_effects', 'transparent'],
      cyberpunk: ['glowing_edges', 'emissive', 'animated_textures'],
      surreal: ['animated_textures', 'pulsating', 'rotating'],
      fantasy: ['glowing_edges', 'particle_effects', 'reflective_surface'],
      nightmare: ['emissive', 'pulsating', 'animated_textures'],
    };

    const features = styleFeatures[style] || styleFeatures.ethereal;

    // Return 1-2 random features
    const count = Math.random() > 0.5 ? 2 : 1;
    const shuffled = [...features].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Map keywords to entity types
   * @param {Object} keywords - Extracted keywords
   * @param {string} style - Dream style
   * @returns {Array} Entity type mappings
   * @private
   */
  _mapAnalysisToEntities(analysis, style) {
    const entityTypes = [];

    // Check for action-specific entities first (for better context)
    if (analysis.actions && analysis.actions.length > 0) {
      if (
        analysis.actions.includes('collid') ||
        analysis.actions.includes('explod')
      ) {
        // For collisions/explosions, use particle effects
        return ['particle_stream', 'particle_swarm'];
      }
      if (
        analysis.actions.includes('fly') ||
        analysis.actions.includes('soar')
      ) {
        // For flying, use appropriate entities
        return ['light_butterfly', 'particle_stream'];
      }
      if (
        analysis.actions.includes('orbit') ||
        analysis.actions.includes('spin')
      ) {
        // For orbiting, use orbital particles
        return ['floating_orb', 'particle_stream'];
      }
    }

    // Entity type mappings for better 3D representation
    const entityMappings = {
      book: 'book_swarm',
      books: 'book_swarm',
      bird: 'light_butterfly',
      birds: 'light_butterfly',
      butterfly: 'light_butterfly',
      butterflies: 'light_butterfly',
      particle: 'particle_stream',
      particles: 'particle_stream',
      orb: 'floating_orb',
      orbs: 'floating_orbs',
      shadow: 'shadow_figure',
      shadows: 'shadow_figure',
      memory: 'memory_fragment',
      memories: 'memory_fragment',
      light: 'light_particle',
      lights: 'light_particle',
      fish: 'particle_swarm',
      cloud: 'particle_stream',
      clouds: 'particle_stream',
    };

    // Use entities that are not structures
    for (const entity of analysis.entities) {
      if (!this._isStructuralEntity(entity)) {
        // Map to appropriate 3D entity type
        const mappedType = entityMappings[entity] || entity;
        entityTypes.push(mappedType);
      }
    }

    // If we have specific entity types, use them
    if (entityTypes.length > 0) {
      return entityTypes.slice(0, 2); // Limit to 2 entity types
    }

    // Otherwise, use style-based defaults
    const styleDefaults = {
      ethereal: ['floating_orb', 'light_particle'],
      cyberpunk: ['particle_stream', 'geometric_shape'],
      surreal: ['memory_fragment', 'shadow_figure'],
      fantasy: ['light_butterfly', 'floating_orb'],
      nightmare: ['shadow_figure', 'particle_swarm'],
    };

    return styleDefaults[style] || styleDefaults.ethereal;
  }

  /**
   * Generate entity parameters based on style and actions
   * @param {string} style - Dream style
   * @param {string[]} actions - Actions from prompt analysis
   * @returns {Object} Entity parameters
   * @private
   */
  _generateEntityParams(style, actions = []) {
    const { ParameterValidator } = require('../../../shared');

    // Generate raw parameters based on style
    const styleParams = {
      ethereal: {
        speed: 0.5 + Math.random() * 1.0,
        glow: 0.6 + Math.random() * 0.4,
        size: 0.8 + Math.random() * 0.4,
        color: '#a6d8ff',
      },
      cyberpunk: {
        speed: 1.5 + Math.random() * 2.0,
        glow: 0.8 + Math.random() * 0.2,
        size: 0.6 + Math.random() * 0.6,
        color: '#00ffff',
      },
      surreal: {
        speed: 0.3 + Math.random() * 1.5,
        glow: 0.4 + Math.random() * 0.6,
        size: 0.5 + Math.random() * 1.0,
        color: '#9966ff',
      },
      fantasy: {
        speed: 0.8 + Math.random() * 1.2,
        glow: 0.7 + Math.random() * 0.3,
        size: 0.9 + Math.random() * 0.3,
        color: '#ffb347',
      },
      nightmare: {
        speed: 0.2 + Math.random() * 0.8,
        glow: 0.2 + Math.random() * 0.4,
        size: 0.7 + Math.random() * 0.5,
        color: '#660000',
      },
    };

    const rawParams = styleParams[style] || styleParams.ethereal;

    // Modify parameters based on actions
    if (actions.includes('colliding') || actions.includes('collision')) {
      rawParams.speed *= 2.0; // Increase speed for collisions
      rawParams.glow *= 1.5; // Increase glow for impact
    }
    if (actions.includes('running') || actions.includes('moving')) {
      rawParams.speed *= 1.5;
    }
    if (actions.includes('flying') || actions.includes('soaring')) {
      rawParams.speed *= 1.2;
    }
    if (actions.includes('glowing') || actions.includes('shining')) {
      rawParams.glow *= 1.3;
    }

    // Validate and clamp parameters to ensure they're within valid ranges
    // Using default entity type constraints since we don't know the specific type yet
    const glowConstraints = ParameterValidator.getParameterConstraints(
      'default',
      'glow'
    );
    const speedConstraints = ParameterValidator.getParameterConstraints(
      'default',
      'speed'
    );
    const sizeConstraints = ParameterValidator.getParameterConstraints(
      'default',
      'size'
    );

    const validatedParams = {
      speed: ParameterValidator.validateAndClamp(
        'speed',
        rawParams.speed,
        speedConstraints
      ).value,
      glow: ParameterValidator.validateAndClamp(
        'glow',
        rawParams.glow,
        glowConstraints
      ).value,
      size: ParameterValidator.validateAndClamp(
        'size',
        rawParams.size,
        sizeConstraints
      ).value,
      color: rawParams.color,
    };

    return validatedParams;
  }

  /**
   * Generate entities based on prompt content with intelligent keyword extraction
   * @param {string} description - Dream description
   * @param {string} style - Dream style
   * @param {Object} keywords - Extracted keywords (optional)
   * @returns {Array} Entities array
   * @private
   */
  _generateEntitiesFromPrompt(
    description,
    style = 'ethereal',
    analysis = null
  ) {
    // Extract analysis if not provided
    if (!analysis) {
      analysis = this.promptAnalyzer.analyze(description);
    }

    // Map analysis to entity types - use entities that are not structures
    const entityTypes = this._mapAnalysisToEntities(analysis, style);

    // Determine entity count based on prompt complexity
    const wordCount = description.split(/\s+/).length;
    const baseCount = Math.min(Math.max(1, Math.floor(wordCount / 15)), 3);
    const entityCount = Math.min(entityTypes.length, baseCount);

    const entities = [];

    for (let i = 0; i < entityCount; i++) {
      const type = entityTypes[i] || entityTypes[0];
      const params = this._generateEntityParams(style, analysis.actions);

      // Use quantity from analysis if available, otherwise use defaults
      let count = analysis.quantities[type] || 1;

      // If no specific quantity, use reasonable defaults based on entity type
      if (count === 1 && !analysis.quantities[type]) {
        const defaultCounts = {
          star: 2, // For "stars" plural
          book_swarm: 25, // Books floating around
          particle_stream: 50,
          particle_swarm: 40,
          floating_orb: 20,
          floating_orbs: 20,
          light_butterfly: 15,
          light_particle: 30,
          shadow_figure: 8,
          memory_fragment: 12,
          geometric_shape: 15,
        };
        count = defaultCounts[type] || Math.floor(Math.random() * 20) + 10;
      }

      entities.push({
        id: `e${i + 1}`,
        type,
        count,
        params,
      });
    }

    // Ensure at least one entity
    if (entities.length === 0) {
      entities.push({
        id: 'e1',
        type: 'floating_orbs',
        count: 20,
        params: this._generateEntityParams(style),
      });
    }

    return entities;
  }

  /**
   * Generate cinematography based on prompt content with complete shot configuration
   * @param {string} description - Dream description
   * @param {Object} options - Generation options
   * @param {Array} structures - Generated structures for targeting
   * @param {Array} entities - Generated entities for targeting
   * @returns {Object} Cinematography configuration
   * @private
   */
  _generateCinematographyFromPrompt(
    description,
    options,
    structures = [],
    entities = []
  ) {
    const { EnumMapper } = require('../../../shared');
    const duration = options.duration || 30;
    const shots = [];

    // Ensure we have valid targets
    const structureTargets =
      structures.length > 0 ? structures.map((s) => s.id) : ['s1'];
    const entityTargets =
      entities.length > 0 ? entities.map((e) => e.id) : ['e1'];

    // Analyze description for action keywords
    const lowerDesc = description.toLowerCase();
    const hasOrbiting =
      lowerDesc.includes('orbit') || lowerDesc.includes('orbiting');
    const hasColliding =
      lowerDesc.includes('collid') || lowerDesc.includes('crash');
    const hasExploding =
      lowerDesc.includes('explod') || lowerDesc.includes('explosion');
    const hasFlying = lowerDesc.includes('fly') || lowerDesc.includes('flying');

    // Choose cinematography based on action keywords
    if (hasOrbiting && structures.length >= 2) {
      // For orbiting objects, use orbit shots to show the motion
      const orbitDuration = Math.floor(duration * 0.6);
      const establishDuration = duration - orbitDuration;

      shots.push({
        type: EnumMapper.mapShotType('establish'),
        target: structureTargets[0],
        duration: establishDuration,
        startPos: [0, 40, 60],
        endPos: [0, 30, 40],
      });

      shots.push({
        type: EnumMapper.mapShotType('orbit'),
        target: structureTargets[0],
        duration: orbitDuration,
        startPos: [50, 25, 0],
        endPos: [-50, 25, 0],
      });
    } else if (hasColliding || hasExploding) {
      // For collisions/explosions, use close-up and pull-back
      const closeupDuration = Math.floor(duration * 0.4);
      const pullbackDuration = duration - closeupDuration;

      shots.push({
        type: EnumMapper.mapShotType('close_up'),
        target: structureTargets[0],
        duration: closeupDuration,
        startPos: [15, 15, 15],
        endPos: [5, 10, 5],
      });

      shots.push({
        type: EnumMapper.mapShotType('pull_back'),
        target: structureTargets[0],
        duration: pullbackDuration,
        startPos: [5, 10, 5],
        endPos: [0, 50, 80],
      });
    } else if (hasFlying) {
      // For flying, use flythrough shots
      const flythroughDuration = Math.floor(duration * 0.7);
      const establishDuration = duration - flythroughDuration;

      shots.push({
        type: EnumMapper.mapShotType('establish'),
        target: structureTargets[0],
        duration: establishDuration,
        startPos: [0, 30, 50],
        endPos: [0, 25, 30],
      });

      shots.push({
        type: EnumMapper.mapShotType('flythrough'),
        target: entityTargets[0],
        duration: flythroughDuration,
        startPos: [0, 25, 30],
        endPos: [40, 15, -30],
      });
    } else if (duration <= 20) {
      // Short sequence - single establishing shot
      shots.push({
        type: EnumMapper.mapShotType('establish'),
        target: structureTargets[0],
        duration: duration,
        startPos: [0, 30, 50],
        endPos: [0, 20, 30],
      });
    } else if (duration <= 40) {
      // Medium sequence - establish + flythrough
      const establishDuration = Math.floor(duration * 0.4);
      const flythroughDuration = duration - establishDuration;

      shots.push({
        type: EnumMapper.mapShotType('establish'),
        target: structureTargets[0],
        duration: establishDuration,
        startPos: [0, 30, 50],
        endPos: [0, 25, 20],
      });

      shots.push({
        type: EnumMapper.mapShotType('flythrough'),
        target: entityTargets[0],
        duration: flythroughDuration,
        startPos: [0, 25, 20],
        endPos: [30, 20, -20],
      });
    } else {
      // Long sequence - establish + orbit + close_up
      const establishDuration = Math.floor(duration * 0.3);
      const orbitDuration = Math.floor(duration * 0.4);
      const closeupDuration = duration - establishDuration - orbitDuration;

      shots.push({
        type: EnumMapper.mapShotType('establish'),
        target: structureTargets[0],
        duration: establishDuration,
        startPos: [0, 30, 50],
        endPos: [0, 25, 20],
      });

      shots.push({
        type: EnumMapper.mapShotType('orbit'),
        target: structureTargets[0],
        duration: orbitDuration,
        startPos: [40, 20, 0],
        endPos: [-40, 20, 0],
      });

      shots.push({
        type: EnumMapper.mapShotType('close_up'),
        target: entityTargets[0],
        duration: closeupDuration,
        startPos: [10, 15, 10],
        endPos: [5, 15, 5],
      });
    }

    console.log(
      `🎬 Generated cinematography with ${shots.length} shots (${shots
        .map((s) => s.type)
        .join(', ')})`
    );

    return {
      durationSec: duration,
      shots,
    };
  }

  /**
   * Generate streaming dream content with robust response processing pipeline
   * @param {string} prompt - The prompt for dream generation
   * @param {Object} options - Generation options
   * @returns {string} Consistent string content
   */
  async generateDreamStream(prompt, options = {}) {
    try {
      // Validate input
      if (!prompt || typeof prompt !== 'string') {
        throw new Error('Invalid prompt: must be a non-empty string');
      }

      // Generate dream content based on prompt (same as regular generation)
      const generatedDream = await this._generateDreamFromPrompt(prompt, {
        ...options,
        streaming: true,
      });

      // Wrap in streaming response format
      const mockStreamData = {
        success: true,
        data: JSON.parse(generatedDream),
        metadata: {
          source: 'cerebras',
          model: 'cerebras',
          processingTime: Math.floor(Math.random() * 1500) + 300,
          quality: 'high',
          tokens: {
            input: Math.ceil(prompt.length / 4),
            output: Math.ceil(generatedDream.length / 4),
            total: Math.ceil((prompt.length + generatedDream.length) / 4),
          },
          confidence: 0.92,
          cacheHit: false,
          streaming: true,
        },
      };

      const mockStreamResponse = {
        content: JSON.stringify(mockStreamData),
      };

      // Return the generated dream content directly to avoid pipeline issues
      return JSON.stringify(mockStreamData);
    } catch (error) {
      throw new Error(`Cerebras streaming generation failed: ${error.message}`);
    }
  }

  async testConnection() {
    return {
      status: 'healthy',
      latency: Math.random() * 100,
      timestamp: Date.now(),
    };
  }

  getConnectionPool() {
    return {
      maxConnections: 10,
      activeConnections: 0,
      keepAlive: true,
    };
  }

  async batchGenerateDreams(requests, options = {}) {
    const results = [];
    for (const request of requests) {
      const result = await this.generateDream(request, options);
      results.push(result);
    }
    return results;
  }

  optimizePrompt(prompt) {
    if (prompt.length > 2000) {
      return prompt.substring(0, 2000) + '...';
    }
    return prompt;
  }

  getMetrics() {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      averageResponseTime: 0,
      errorRate: 0,
    };
  }

  getPerformanceAnalytics() {
    return {
      responseTimePercentiles: { p50: 100, p95: 150, p99: 200 },
      tokenUsageStats: { totalTokens: 0, averageTokensPerRequest: 0 },
      errorBreakdown: { totalErrors: 0, errorRate: 0 },
      throughputMetrics: { requestsPerSecond: 0, successRate: 1 },
    };
  }

  updateConfig(newConfig) {
    if (
      newConfig.temperature &&
      (newConfig.temperature < 0 || newConfig.temperature > 1)
    ) {
      throw new Error(
        'Invalid configuration: temperature must be between 0 and 1'
      );
    }
    if (newConfig.maxTokens && newConfig.maxTokens < 0) {
      throw new Error('Invalid configuration: maxTokens must be positive');
    }
    Object.assign(this.config, newConfig);
  }

  async shutdown() {
    // Mock shutdown
  }

  getCacheStats() {
    return { size: 0, keys: [] };
  }

  /**
   * Process response using robust processing pipeline
   * @param {any} response - Raw response from Cerebras API
   * @param {string} operationType - Type of operation for context
   * @param {Object} options - Processing options
   * @returns {string} Processed content string
   * @private
   */
  async _processResponseWithPipeline(
    response,
    operationType = 'unknown',
    options = {}
  ) {
    try {
      // Import processing pipeline
      const { processingPipeline } = require('../utils/responseParser');

      const result = await processingPipeline.processResponse(
        response,
        'cerebras',
        operationType,
        {
          timestamp: Date.now(),
          options,
          serviceVersion: '1.0.0',
        }
      );
      console.log(
        '---XXXXXXX---services/cerebrasService result:',
        result.success,
        result.content
      );
      if (result.success && result.content) {
        return result.content;
      }

      // Fallback to legacy extraction if pipeline fails
      console.warn(
        `Processing pipeline failed for Cerebras ${operationType}, falling back to legacy extraction`
      );
      return this._extractContentFromResponse(response, operationType);
    } catch (error) {
      // Fallback to legacy extraction on any error
      console.warn(
        `Pipeline processing error for Cerebras ${operationType}:`,
        error.message
      );
      return this._extractContentFromResponse(response, operationType);
    }
  }

  /**
   * Extract content consistently from Cerebras response formats (legacy fallback)
   * @param {any} response - Raw response from Cerebras API
   * @param {string} operationType - Type of operation for context
   * @returns {string} Extracted content string
   * @private
   */
  _extractContentFromResponse(response, operationType = 'unknown') {
    try {
      // Handle null/undefined responses
      if (!response) {
        throw new Error('Response is null or undefined');
      }

      // If response is already a string, return it
      if (typeof response === 'string') {
        return this._validateContent(response, operationType);
      }

      // Handle Cerebras streaming format
      if (response.content && typeof response.content === 'string') {
        return this._validateContent(response.content, operationType);
      }

      // Handle standard chat completion format
      if (
        response.choices &&
        Array.isArray(response.choices) &&
        response.choices.length > 0
      ) {
        const choice = response.choices[0];

        // Chat completion format
        if (choice.message && choice.message.content) {
          return this._validateContent(choice.message.content, operationType);
        }

        // Delta format (streaming)
        if (choice.delta && choice.delta.content) {
          return this._validateContent(choice.delta.content, operationType);
        }

        // Legacy text format
        if (choice.text) {
          return this._validateContent(choice.text, operationType);
        }
      }

      // Handle other common response formats
      if (response.output && typeof response.output === 'string') {
        return this._validateContent(response.output, operationType);
      }

      if (response.data && typeof response.data === 'string') {
        return this._validateContent(response.data, operationType);
      }

      if (response.text && typeof response.text === 'string') {
        return this._validateContent(response.text, operationType);
      }

      // If response is an object that looks like a complete result, stringify it
      if (
        typeof response === 'object' &&
        this._looksLikeCompleteObject(response)
      ) {
        return this._validateContent(JSON.stringify(response), operationType);
      }

      throw new Error(
        `Unable to extract content from response format: ${typeof response}`
      );
    } catch (error) {
      throw new Error(`Content extraction failed: ${error.message}`);
    }
  }

  /**
   * Validate extracted content
   * @param {string} content - Content to validate
   * @param {string} operationType - Operation type for context
   * @returns {string} Validated content
   * @private
   */
  _validateContent(content, operationType) {
    if (!content || typeof content !== 'string') {
      throw new Error('Content is not a valid string');
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new Error('Content is empty after trimming');
    }

    // For JSON operations, validate JSON structure
    if (
      [
        'generateDream',
        'generateDreamStream',
        'patchDream',
        'enrichStyle',
      ].includes(operationType)
    ) {
      try {
        JSON.parse(trimmed);
      } catch (jsonError) {
        // Log warning but don't fail - downstream parser can handle non-JSON
        console.warn(
          `Cerebras content validation: JSON parsing failed for ${operationType}:`,
          jsonError.message
        );
      }
    }

    return trimmed;
  }

  /**
   * Check if object looks like a complete response object
   * @param {any} obj - Object to check
   * @returns {boolean} True if looks complete
   * @private
   */
  _looksLikeCompleteObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return false;
    }

    // Check for common dream object fields
    const dreamFields = [
      'structures',
      'entities',
      'cinematography',
      'id',
      'title',
      'description',
    ];
    const hasDreamFields = dreamFields.some((field) =>
      obj.hasOwnProperty(field)
    );

    if (hasDreamFields) return true;

    // Check for reasonable object size (not empty, not too large)
    const keys = Object.keys(obj);
    return keys.length > 0 && keys.length < 100;
  }
}

// Create a default instance for backward compatibility
const defaultInstance = new CerebrasService({
  apiKey: process.env.CEREBRAS_API_KEY || 'test-key',
});

// Connection pool implementation
const connectionPool = {
  maxConnections: parseInt(process.env.CEREBRAS_MAX_CONCURRENT) || 3,
  activeConnections: 0,
  clients: new Map(),
  requestQueue: [],
  connectionStats: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
  },
  retryConfig: {
    maxAttempts: parseInt(process.env.CEREBRAS_RETRY_ATTEMPTS) || 2,
    baseDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 30000,
  },

  getStats() {
    return {
      maxConnections: this.maxConnections,
      activeConnections: this.activeConnections,
      queueLength: this.requestQueue.length,
      totalRequests: this.connectionStats.totalRequests,
      successfulRequests: this.connectionStats.successfulRequests,
      failedRequests: this.connectionStats.failedRequests,
      averageResponseTime: this.connectionStats.averageResponseTime,
    };
  },

  cleanup() {
    this.clients.clear();
    this.requestQueue = [];
    this.activeConnections = 0;
  },

  _isNonRetryableError(error) {
    const nonRetryableMessages = [
      'Authentication failed',
      'Invalid API key',
      'Unauthorized',
    ];
    return nonRetryableMessages.some((msg) =>
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  },

  _updateAverageResponseTime(responseTime) {
    const currentCount = this.connectionStats.successfulRequests;
    const currentAverage = this.connectionStats.averageResponseTime;

    this.connectionStats.successfulRequests++;
    this.connectionStats.averageResponseTime =
      (currentAverage * currentCount + responseTime) /
      this.connectionStats.successfulRequests;
  },
};

// Request batcher implementation
const requestBatcher = {
  batchSize: 3,
  batchTimeout: 500,
  pendingRequests: 0,

  getStats() {
    return {
      batchSize: this.batchSize,
      batchTimeout: this.batchTimeout,
      pendingRequests: this.pendingRequests,
    };
  },
};

// Exported functions
async function callCerebras(prompt, options = {}) {
  try {
    connectionPool.connectionStats.totalRequests++;
    const startTime = Date.now();

    const result = await defaultInstance.generateDream(prompt, options);

    const responseTime = Date.now() - startTime;
    connectionPool._updateAverageResponseTime(responseTime);
    connectionPool.connectionStats.successfulRequests++;

    return result;
  } catch (error) {
    connectionPool.connectionStats.failedRequests++;
    throw error;
  }
}

async function processBatchRequests(requests, options = {}) {
  const results = [];
  const errors = [];

  for (let i = 0; i < requests.length; i++) {
    try {
      const result = await callCerebras(
        requests[i].prompt,
        requests[i].options || options
      );
      results.push({
        success: true,
        index: i,
        result: { content: result },
        request: requests[i],
      });
    } catch (error) {
      errors.push({
        success: false,
        index: i,
        error: error.message,
        request: requests[i],
      });
    }
  }

  return {
    results,
    errors,
    totalRequests: requests.length,
    successfulRequests: results.length,
    failedRequests: errors.length,
    successRate: (results.length / requests.length) * 100,
  };
}

function getConnectionPoolStats() {
  return connectionPool.getStats();
}

async function resetConnectionPool() {
  connectionPool.cleanup();
  connectionPool.connectionStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
  };

  return { success: true };
}

function getBatcherStats() {
  return requestBatcher.getStats();
}

async function getPerformanceMetrics() {
  return {
    connectionPool: connectionPool.getStats(),
    requestBatcher: requestBatcher.getStats(),
    timestamp: Date.now(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  };
}

async function healthCheck() {
  try {
    const connectionTest = await defaultInstance.testConnection();
    return {
      success: true,
      connection: connectionTest.status === 'healthy',
      streaming: true,
      connectionPool: {
        healthy: true,
        stats: connectionPool.getStats(),
      },
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      success: false,
      connection: false,
      streaming: false,
      connectionPool: {
        healthy: false,
        stats: connectionPool.getStats(),
      },
      timestamp: Date.now(),
      error: error.message,
    };
  }
}

async function testConnection() {
  return await defaultInstance.testConnection();
}

async function updateRetryConfig(newConfig) {
  Object.assign(connectionPool.retryConfig, newConfig);
  return {
    success: true,
    config: connectionPool.retryConfig,
  };
}

async function cleanupConnections() {
  connectionPool.cleanup();
  return { success: true };
}

// Export both the class and the functions for backward compatibility
module.exports = CerebrasService;
module.exports.callCerebras = callCerebras;
module.exports.processBatchRequests = processBatchRequests;
module.exports.getConnectionPoolStats = getConnectionPoolStats;
module.exports.resetConnectionPool = resetConnectionPool;
module.exports.getBatcherStats = getBatcherStats;
module.exports.getPerformanceMetrics = getPerformanceMetrics;
module.exports.healthCheck = healthCheck;
module.exports.testConnection = testConnection;
module.exports.connectionPool = connectionPool;
module.exports.requestBatcher = requestBatcher;
module.exports.updateRetryConfig = updateRetryConfig;
module.exports.cleanupConnections = cleanupConnections;
