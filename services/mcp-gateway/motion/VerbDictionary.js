/**
 * Verb Dictionary
 * Comprehensive verb-to-animation mappings with motion parameters
 */

class VerbDictionary {
  constructor() {
    // Main verb dictionary with animation mappings
    this.verbs = {
      // ===== AERIAL MOTION =====
      flying: {
        type: 'path',
        pattern: 'aerial',
        speed: 1.5,
        altitude: [20, 50],
        variation: 'smooth',
        pathType: 'bezier',
        banking: true,
        synonyms: ['fly', 'flies', 'flew'],
      },
      soaring: {
        type: 'path',
        pattern: 'aerial',
        speed: 1.0,
        altitude: [30, 60],
        variation: 'gentle',
        pathType: 'bezier',
        banking: true,
        synonyms: ['soar', 'soars', 'soared'],
      },
      hovering: {
        type: 'idle',
        pattern: 'float',
        speed: 0.3,
        altitude: [10, 30],
        amplitude: 2,
        frequency: 0.5,
        synonyms: ['hover', 'hovers', 'hovered'],
      },
      gliding: {
        type: 'path',
        pattern: 'aerial',
        speed: 1.2,
        altitude: [25, 45],
        variation: 'smooth',
        pathType: 'linear',
        banking: false,
        synonyms: ['glide', 'glides', 'glided'],
      },
      swooping: {
        type: 'path',
        pattern: 'aerial',
        speed: 2.0,
        altitude: [5, 40],
        variation: 'dramatic',
        pathType: 'bezier',
        banking: true,
        dive: true,
        synonyms: ['swoop', 'swoops', 'swooped'],
      },
      diving: {
        type: 'path',
        pattern: 'vertical',
        speed: 2.5,
        direction: 'down',
        acceleration: 1.5,
        synonyms: ['dive', 'dives', 'dived'],
      },
      ascending: {
        type: 'path',
        pattern: 'vertical',
        speed: 1.0,
        direction: 'up',
        synonyms: ['ascend', 'ascends', 'ascended'],
      },
      descending: {
        type: 'path',
        pattern: 'vertical',
        speed: 1.2,
        direction: 'down',
        synonyms: ['descend', 'descends', 'descended'],
      },

      // ===== GROUND MOTION =====
      running: {
        type: 'path',
        pattern: 'ground',
        speed: 2.0,
        terrain: 'follow',
        bobbing: true,
        bobbingAmplitude: 0.5,
        synonyms: ['run', 'runs', 'ran'],
      },
      galloping: {
        type: 'path',
        pattern: 'ground',
        speed: 2.5,
        terrain: 'follow',
        bobbing: true,
        bobbingAmplitude: 1.0,
        synonyms: ['gallop', 'gallops', 'galloped'],
      },
      walking: {
        type: 'path',
        pattern: 'ground',
        speed: 0.5,
        terrain: 'follow',
        bobbing: true,
        bobbingAmplitude: 0.2,
        synonyms: ['walk', 'walks', 'walked'],
      },
      trotting: {
        type: 'path',
        pattern: 'ground',
        speed: 1.2,
        terrain: 'follow',
        bobbing: true,
        bobbingAmplitude: 0.4,
        synonyms: ['trot', 'trots', 'trotted'],
      },
      sprinting: {
        type: 'path',
        pattern: 'ground',
        speed: 3.0,
        terrain: 'follow',
        bobbing: true,
        bobbingAmplitude: 0.7,
        synonyms: ['sprint', 'sprints', 'sprinted'],
      },
      crawling: {
        type: 'path',
        pattern: 'ground',
        speed: 0.3,
        terrain: 'follow',
        bobbing: false,
        synonyms: ['crawl', 'crawls', 'crawled'],
      },
      marching: {
        type: 'path',
        pattern: 'ground',
        speed: 0.8,
        terrain: 'follow',
        bobbing: true,
        bobbingAmplitude: 0.3,
        synchronized: true,
        synonyms: ['march', 'marches', 'marched'],
      },

      // ===== WATER MOTION =====
      sailing: {
        type: 'path',
        pattern: 'water',
        speed: 1.0,
        surface: 'water',
        bobbing: true,
        bobbingAmplitude: 0.5,
        bobbingFrequency: 0.3,
        synonyms: ['sail', 'sails', 'sailed'],
      },
      swimming: {
        type: 'path',
        pattern: 'water',
        speed: 0.8,
        surface: 'water',
        depth: 'variable',
        bobbing: true,
        bobbingAmplitude: 0.3,
        synonyms: ['swim', 'swims', 'swam'],
      },
      floating: {
        type: 'idle',
        pattern: 'float',
        speed: 0.2,
        amplitude: 1.5,
        frequency: 0.4,
        drift: true,
        synonyms: ['float', 'floats', 'floated'],
      },
      drifting: {
        type: 'path',
        pattern: 'water',
        speed: 0.3,
        surface: 'water',
        bobbing: true,
        bobbingAmplitude: 0.4,
        random: true,
        synonyms: ['drift', 'drifts', 'drifted'],
      },
      rowing: {
        type: 'path',
        pattern: 'water',
        speed: 0.7,
        surface: 'water',
        bobbing: true,
        bobbingAmplitude: 0.3,
        rhythmic: true,
        synonyms: ['row', 'rows', 'rowed'],
      },

      // ===== CIRCULAR MOTION =====
      circling: {
        type: 'orbit',
        pattern: 'circular',
        speed: 1.0,
        radius: 30,
        axis: 'y',
        clockwise: true,
        synonyms: ['circle', 'circles', 'circled'],
      },
      orbiting: {
        type: 'orbit',
        pattern: 'circular',
        speed: 0.8,
        radius: 50,
        axis: 'y',
        clockwise: true,
        elliptical: true,
        synonyms: ['orbit', 'orbits', 'orbited'],
      },
      spinning: {
        type: 'rotate',
        pattern: 'rotation',
        speed: 2.0,
        axis: 'y',
        continuous: true,
        synonyms: ['spin', 'spins', 'spun'],
      },
      rotating: {
        type: 'rotate',
        pattern: 'rotation',
        speed: 1.0,
        axis: 'y',
        continuous: true,
        synonyms: ['rotate', 'rotates', 'rotated'],
      },
      revolving: {
        type: 'orbit',
        pattern: 'circular',
        speed: 0.9,
        radius: 40,
        axis: 'y',
        synonyms: ['revolve', 'revolves', 'revolved'],
      },
      swirling: {
        type: 'orbit',
        pattern: 'spiral',
        speed: 1.5,
        radius: 25,
        axis: 'y',
        spiralIn: false,
        synonyms: ['swirl', 'swirls', 'swirled'],
      },
      spiraling: {
        type: 'orbit',
        pattern: 'spiral',
        speed: 1.2,
        radius: 35,
        axis: 'y',
        spiralIn: true,
        synonyms: ['spiral', 'spirals', 'spiraled'],
      },
      whirling: {
        type: 'rotate',
        pattern: 'rotation',
        speed: 2.5,
        axis: 'y',
        continuous: true,
        synonyms: ['whirl', 'whirls', 'whirled'],
      },

      // ===== VERTICAL MOTION =====
      rising: {
        type: 'path',
        pattern: 'vertical',
        speed: 1.0,
        direction: 'up',
        synonyms: ['rise', 'rises', 'rose'],
      },
      falling: {
        type: 'path',
        pattern: 'vertical',
        speed: 1.5,
        direction: 'down',
        gravity: true,
        acceleration: 1.2,
        synonyms: ['fall', 'falls', 'fell'],
      },
      climbing: {
        type: 'path',
        pattern: 'vertical',
        speed: 0.6,
        direction: 'up',
        synonyms: ['climb', 'climbs', 'climbed'],
      },
      dropping: {
        type: 'path',
        pattern: 'vertical',
        speed: 2.0,
        direction: 'down',
        gravity: true,
        synonyms: ['drop', 'drops', 'dropped'],
      },
      plummeting: {
        type: 'path',
        pattern: 'vertical',
        speed: 3.0,
        direction: 'down',
        gravity: true,
        acceleration: 2.0,
        synonyms: ['plummet', 'plummets', 'plummeted'],
      },

      // ===== EVENT VERBS =====
      exploding: {
        type: 'event',
        event: 'explosion',
        timing: 'mid',
        duration: 2.0,
        intensity: 1.0,
        particles: true,
        particleCount: 500,
        synonyms: ['explode', 'explodes', 'exploded'],
      },
      erupting: {
        type: 'event',
        event: 'eruption',
        timing: 'start',
        duration: 5.0,
        intensity: 1.0,
        particles: true,
        particleCount: 1000,
        direction: 'up',
        synonyms: ['erupt', 'erupts', 'erupted'],
      },
      colliding: {
        type: 'event',
        event: 'collision',
        timing: 'mid',
        duration: 1.0,
        intensity: 0.8,
        particles: true,
        particleCount: 200,
        synonyms: ['collide', 'collides', 'collided'],
      },
      bursting: {
        type: 'event',
        event: 'burst',
        timing: 'mid',
        duration: 1.5,
        intensity: 0.9,
        particles: true,
        particleCount: 300,
        synonyms: ['burst', 'bursts', 'bursted'],
      },
      shattering: {
        type: 'event',
        event: 'shatter',
        timing: 'mid',
        duration: 2.0,
        intensity: 1.0,
        particles: true,
        particleCount: 400,
        synonyms: ['shatter', 'shatters', 'shattered'],
      },
      crashing: {
        type: 'event',
        event: 'crash',
        timing: 'mid',
        duration: 1.5,
        intensity: 0.9,
        particles: true,
        particleCount: 250,
        synonyms: ['crash', 'crashes', 'crashed'],
      },

      // ===== IDLE ANIMATIONS =====
      swaying: {
        type: 'idle',
        pattern: 'sway',
        speed: 0.5,
        amplitude: 1.0,
        frequency: 0.3,
        axis: 'x',
        synonyms: ['sway', 'sways', 'swayed'],
      },
      pulsating: {
        type: 'idle',
        pattern: 'pulse',
        speed: 1.0,
        amplitude: 0.2,
        frequency: 0.8,
        scaleChange: true,
        synonyms: ['pulsate', 'pulsates', 'pulsated'],
      },
      glowing: {
        type: 'idle',
        pattern: 'glow',
        speed: 0.8,
        amplitude: 0.3,
        frequency: 0.5,
        emissive: true,
        synonyms: ['glow', 'glows', 'glowed'],
      },
      shimmering: {
        type: 'idle',
        pattern: 'shimmer',
        speed: 1.5,
        amplitude: 0.15,
        frequency: 1.0,
        opacity: true,
        synonyms: ['shimmer', 'shimmers', 'shimmered'],
      },
      flickering: {
        type: 'idle',
        pattern: 'flicker',
        speed: 2.0,
        amplitude: 0.4,
        frequency: 2.0,
        random: true,
        synonyms: ['flicker', 'flickers', 'flickered'],
      },
      breathing: {
        type: 'idle',
        pattern: 'breathe',
        speed: 0.4,
        amplitude: 0.1,
        frequency: 0.2,
        scaleChange: true,
        synonyms: ['breathe', 'breathes', 'breathed'],
      },

      // ===== INTERACTION VERBS =====
      chasing: {
        type: 'path',
        pattern: 'follow',
        speed: 1.8,
        target: 'dynamic',
        distance: 10,
        synonyms: ['chase', 'chases', 'chased'],
      },
      following: {
        type: 'path',
        pattern: 'follow',
        speed: 1.0,
        target: 'dynamic',
        distance: 15,
        synonyms: ['follow', 'follows', 'followed'],
      },
      pursuing: {
        type: 'path',
        pattern: 'follow',
        speed: 2.0,
        target: 'dynamic',
        distance: 8,
        synonyms: ['pursue', 'pursues', 'pursued'],
      },
      fleeing: {
        type: 'path',
        pattern: 'flee',
        speed: 2.2,
        target: 'away',
        distance: 20,
        synonyms: ['flee', 'flees', 'fled'],
      },
      escaping: {
        type: 'path',
        pattern: 'flee',
        speed: 2.5,
        target: 'away',
        distance: 25,
        synonyms: ['escape', 'escapes', 'escaped'],
      },
    };

    // Build synonym lookup table
    this.synonymLookup = this.buildSynonymLookup();
  }

  /**
   * Build synonym lookup table for fast verb resolution
   * @returns {Object} - Synonym to base verb mapping
   */
  buildSynonymLookup() {
    const lookup = {};

    for (const [baseVerb, config] of Object.entries(this.verbs)) {
      // Add base verb
      lookup[baseVerb] = baseVerb;

      // Add synonyms
      if (config.synonyms) {
        config.synonyms.forEach((synonym) => {
          lookup[synonym] = baseVerb;
        });
      }
    }

    return lookup;
  }

  /**
   * Get verb configuration
   * @param {string} verb - Verb to look up
   * @returns {Object|null} - Verb configuration or null
   */
  getVerb(verb) {
    const verbLower = verb.toLowerCase().trim();

    // Try direct lookup
    if (this.verbs[verbLower]) {
      return { ...this.verbs[verbLower], baseVerb: verbLower };
    }

    // Try synonym lookup
    const baseVerb = this.synonymLookup[verbLower];
    if (baseVerb && this.verbs[baseVerb]) {
      return { ...this.verbs[baseVerb], baseVerb };
    }

    return null;
  }

  /**
   * Check if verb exists in dictionary
   * @param {string} verb - Verb to check
   * @returns {boolean} - True if verb exists
   */
  hasVerb(verb) {
    return this.getVerb(verb) !== null;
  }

  /**
   * Get all verbs of a specific type
   * @param {string} type - Type to filter by (path, orbit, rotate, event, idle)
   * @returns {Array} - Array of verb names
   */
  getVerbsByType(type) {
    return Object.entries(this.verbs)
      .filter(([_, config]) => config.type === type)
      .map(([verb, _]) => verb);
  }

  /**
   * Get all verbs of a specific pattern
   * @param {string} pattern - Pattern to filter by
   * @returns {Array} - Array of verb names
   */
  getVerbsByPattern(pattern) {
    return Object.entries(this.verbs)
      .filter(([_, config]) => config.pattern === pattern)
      .map(([verb, _]) => verb);
  }

  /**
   * Get default animation for entity type
   * @param {string} entityType - Type of entity
   * @returns {Object} - Default animation configuration
   */
  getDefaultAnimation(entityType) {
    const defaults = {
      living_creature: this.getVerb('floating'),
      vehicle: this.getVerb('drifting'),
      celestial: this.getVerb('rotating'),
      natural_element: this.getVerb('swaying'),
      structure: this.getVerb('swaying'),
      generic: this.getVerb('floating'),
    };

    return defaults[entityType] || defaults['generic'];
  }
}

module.exports = VerbDictionary;
