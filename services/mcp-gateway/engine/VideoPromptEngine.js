// engine/VideoPromptEngine.js
// Specialized prompt engine for video generation with cinematography guidance

class VideoPromptEngine {
  constructor() {
    this.cinematographyStyles = {
      cinematic: {
        name: 'cinematic',
        description: 'Professional cinematic style with film-like quality',
        camera_techniques: [
          'establishing_shots',
          'close_ups',
          'medium_shots',
          'tracking_shots',
          'crane_shots',
          'dolly_movements',
        ],
        lighting_setup: 'three_point_lighting',
        color_grading: 'cinematic_luts',
        frame_rate: '24fps',
        aspect_ratio: '16:9',
        depth_of_field: 'shallow_focus',
      },
      documentary: {
        name: 'documentary',
        description: 'Natural, observational documentary style',
        camera_techniques: [
          'handheld_shots',
          'natural_movements',
          'observational_angles',
          'wide_establishing',
          'intimate_close_ups',
        ],
        lighting_setup: 'natural_lighting',
        color_grading: 'natural_tones',
        frame_rate: '30fps',
        aspect_ratio: '16:9',
        depth_of_field: 'deep_focus',
      },
      dreamlike: {
        name: 'dreamlike',
        description: 'Surreal, flowing dream-like cinematography',
        camera_techniques: [
          'floating_movements',
          'morphing_transitions',
          'impossible_angles',
          'time_distortion',
          'reality_bending',
        ],
        lighting_setup: 'ethereal',
        color_grading: 'surreal_palette',
        frame_rate: 'variable',
        aspect_ratio: 'dynamic',
        depth_of_field: 'selective_focus',
      },
      music_video: {
        name: 'music_video',
        description: 'Dynamic, rhythm-driven music video style',
        camera_techniques: [
          'quick_cuts',
          'dynamic_movements',
          'rhythm_sync',
          'creative_angles',
          'visual_effects',
        ],
        lighting_setup: 'dramatic_lighting',
        color_grading: 'high_contrast',
        frame_rate: '60fps',
        aspect_ratio: '16:9',
        depth_of_field: 'variable_focus',
      },
    };

    this.shotTypes = {
      establishing: {
        name: 'establishing_shot',
        description: 'Wide shot that establishes the scene and location',
        typical_duration: '3-5 seconds',
        camera_distance: 'far',
        movement: 'slow_pan_or_static',
        purpose: 'context_setting',
      },
      wide: {
        name: 'wide_shot',
        description: 'Shows the full subject and surrounding environment',
        typical_duration: '2-4 seconds',
        camera_distance: 'medium_far',
        movement: 'gentle_movement',
        purpose: 'spatial_context',
      },
      medium: {
        name: 'medium_shot',
        description:
          'Shows subject from waist up, balancing detail and context',
        typical_duration: '2-3 seconds',
        camera_distance: 'medium',
        movement: 'subtle_movement',
        purpose: 'character_focus',
      },
      close_up: {
        name: 'close_up',
        description: 'Tight shot focusing on specific details or emotions',
        typical_duration: '1-3 seconds',
        camera_distance: 'close',
        movement: 'minimal_movement',
        purpose: 'emotional_impact',
      },
      extreme_close_up: {
        name: 'extreme_close_up',
        description: 'Very tight shot on specific details',
        typical_duration: '1-2 seconds',
        camera_distance: 'very_close',
        movement: 'static_or_micro',
        purpose: 'detail_emphasis',
      },
      aerial: {
        name: 'aerial_shot',
        description: 'High-angle shot from above, often drone-like',
        typical_duration: '3-6 seconds',
        camera_distance: 'far_elevated',
        movement: 'smooth_aerial',
        purpose: 'grand_perspective',
      },
    };

    this.transitionTypes = {
      cut: {
        name: 'cut',
        description: 'Direct transition between shots',
        duration: '0 seconds',
        style: 'instant',
        best_for: 'maintaining_pace',
      },
      fade: {
        name: 'fade',
        description: 'Gradual transition through black or white',
        duration: '0.5-2 seconds',
        style: 'gradual',
        best_for: 'time_passage',
      },
      dissolve: {
        name: 'dissolve',
        description: 'Gradual blend between two shots',
        duration: '1-3 seconds',
        style: 'smooth_blend',
        best_for: 'dream_sequences',
      },
      wipe: {
        name: 'wipe',
        description: 'One shot replaces another with a moving line',
        duration: '0.5-1.5 seconds',
        style: 'directional',
        best_for: 'location_changes',
      },
      morph: {
        name: 'morph',
        description: 'Seamless transformation between elements',
        duration: '1-4 seconds',
        style: 'fluid_transformation',
        best_for: 'surreal_sequences',
      },
    };

    this.lightingSetups = {
      three_point: {
        name: 'three_point_lighting',
        description: 'Classic setup with key, fill, and rim lights',
        components: ['key_light', 'fill_light', 'rim_light'],
        mood: 'professional',
        complexity: 'standard',
      },
      natural: {
        name: 'natural_lighting',
        description: 'Using available natural light sources',
        components: ['sun_light', 'sky_light', 'reflected_light'],
        mood: 'realistic',
        complexity: 'simple',
      },
      dramatic: {
        name: 'dramatic_lighting',
        description: 'High contrast lighting for dramatic effect',
        components: ['strong_key', 'minimal_fill', 'deep_shadows'],
        mood: 'intense',
        complexity: 'advanced',
      },
      ethereal: {
        name: 'ethereal_lighting',
        description: 'Soft, diffused lighting with magical quality',
        components: ['soft_key', 'ambient_glow', 'particle_lights'],
        mood: 'mystical',
        complexity: 'advanced',
      },
    };
  }

  generateVideoPrompt(sceneData, options = {}) {
    const {
      cinematography_style = 'dreamlike',
      target_duration = 60,
      quality_level = 'high',
      emphasis = 'emotional_impact',
      pacing = 'medium',
    } = options;

    try {
      const cinematography = this.cinematographyStyles[cinematography_style];
      if (!cinematography) {
        throw new Error(
          `Unknown cinematography style: ${cinematography_style}`
        );
      }

      const shotSequence = this.generateShotSequence(sceneData, {
        style: cinematography,
        duration: target_duration,
        quality_level,
        emphasis,
        pacing,
      });

      const lightingPlan = this.generateLightingPlan(sceneData, cinematography);
      const transitionPlan = this.generateTransitionPlan(
        shotSequence,
        cinematography
      );
      const colorGrading = this.generateColorGrading(sceneData, cinematography);

      const videoPrompt = this.composeVideoPrompt({
        scene_data: sceneData,
        cinematography,
        shot_sequence: shotSequence,
        lighting_plan: lightingPlan,
        transition_plan: transitionPlan,
        color_grading: colorGrading,
        options,
      });

      return {
        prompt: videoPrompt,
        metadata: {
          cinematography_style,
          total_shots: shotSequence.length,
          estimated_duration: target_duration,
          complexity_score: this.calculateComplexity(
            shotSequence,
            lightingPlan
          ),
          generation_timestamp: new Date().toISOString(),
        },
        technical_specs: {
          frame_rate: cinematography.frame_rate,
          aspect_ratio: cinematography.aspect_ratio,
          depth_of_field: cinematography.depth_of_field,
          lighting_setup: cinematography.lighting_setup,
          color_grading: cinematography.color_grading,
        },
      };
    } catch (error) {
      throw new Error(`Video prompt generation failed: ${error.message}`);
    }
  }

  generateShotSequence(sceneData, options) {
    const { style, duration, quality_level, emphasis, pacing } = options;

    const shotCount = this.calculateOptimalShotCount(
      duration,
      quality_level,
      pacing
    );
    const shotDuration = duration / shotCount;

    const sequence = [];

    // Always start with establishing shot
    sequence.push(
      this.createShot('establishing', {
        duration: Math.min(shotDuration * 1.5, 5),
        scene_data: sceneData,
        style,
        purpose: 'scene_introduction',
      })
    );

    // Add variety of shots based on scene content
    const remainingDuration = duration - sequence[0].duration;
    const remainingShots = shotCount - 1;
    const avgRemainingDuration = remainingDuration / remainingShots;

    for (let i = 1; i < shotCount; i++) {
      const shotType = this.selectShotType(i, shotCount, sceneData, emphasis);
      const shot = this.createShot(shotType, {
        duration: avgRemainingDuration,
        scene_data: sceneData,
        style,
        sequence_position: i,
        total_shots: shotCount,
      });
      sequence.push(shot);
    }

    return this.optimizeShotSequence(sequence, style);
  }

  calculateOptimalShotCount(duration, qualityLevel, pacing) {
    const baseShotsPerSecond = {
      slow: 0.1,
      medium: 0.15,
      fast: 0.25,
      very_fast: 0.4,
    };

    const qualityMultiplier = {
      draft: 0.7,
      standard: 1.0,
      high: 1.3,
      cinematic: 1.6,
    };

    const baseRate = baseShotsPerSecond[pacing] || baseShotsPerSecond.medium;
    const multiplier =
      qualityMultiplier[qualityLevel] || qualityMultiplier.standard;

    return Math.max(
      3,
      Math.min(15, Math.round(duration * baseRate * multiplier))
    );
  }

  selectShotType(position, totalShots, sceneData, emphasis) {
    const progressRatio = position / totalShots;

    // Shot selection based on sequence position and emphasis
    if (progressRatio < 0.3) {
      // Early shots: establish context
      return Math.random() > 0.5 ? 'wide' : 'medium';
    } else if (progressRatio < 0.7) {
      // Middle shots: focus on content based on emphasis
      switch (emphasis) {
        case 'emotional_impact':
          return Math.random() > 0.6 ? 'close_up' : 'medium';
        case 'environmental_detail':
          return Math.random() > 0.4 ? 'wide' : 'aerial';
        case 'character_focus':
          return Math.random() > 0.5 ? 'medium' : 'close_up';
        default:
          return 'medium';
      }
    } else {
      // Final shots: dramatic conclusion
      return Math.random() > 0.7 ? 'extreme_close_up' : 'close_up';
    }
  }

  createShot(shotType, options) {
    const { duration, scene_data, style, purpose, sequence_position } = options;
    const shotTemplate = this.shotTypes[shotType];

    if (!shotTemplate) {
      throw new Error(`Unknown shot type: ${shotType}`);
    }

    return {
      type: shotType,
      duration: Math.max(1, Math.min(duration, 8)), // Clamp between 1-8 seconds
      camera: this.generateCameraInstructions(shotTemplate, scene_data, style),
      focus: this.generateFocusInstructions(shotTemplate, scene_data),
      movement: this.generateMovementInstructions(shotTemplate, style),
      composition: this.generateCompositionInstructions(
        shotTemplate,
        scene_data
      ),
      purpose: purpose || shotTemplate.purpose,
      sequence_position: sequence_position || 0,
      technical_notes: this.generateTechnicalNotes(shotTemplate, style),
    };
  }

  generateCameraInstructions(shotTemplate, sceneData, style) {
    const baseInstructions = {
      distance: shotTemplate.camera_distance,
      angle: this.selectCameraAngle(shotTemplate, sceneData),
      height: this.selectCameraHeight(shotTemplate, sceneData),
      lens: this.selectLensType(shotTemplate, style),
    };

    return {
      ...baseInstructions,
      position_description: this.describeCameraPosition(
        baseInstructions,
        sceneData
      ),
      framing_notes: this.generateFramingNotes(shotTemplate, sceneData),
    };
  }

  generateMovementInstructions(shotTemplate, style) {
    const baseMovement = shotTemplate.movement;
    const styleMovements = style.camera_techniques;

    // Select appropriate movement based on shot type and style
    const movement = this.selectMovementType(baseMovement, styleMovements);

    return {
      type: movement,
      speed: this.selectMovementSpeed(movement, style),
      direction: this.selectMovementDirection(movement),
      easing: this.selectMovementEasing(movement, style),
      description: this.describeMovement(movement, style),
    };
  }

  generateLightingPlan(sceneData, cinematography) {
    const lightingSetup = this.lightingSetups[cinematography.lighting_setup];

    if (!lightingSetup) {
      throw new Error(
        `Unknown lighting setup: ${cinematography.lighting_setup}`
      );
    }

    return {
      setup_type: lightingSetup.name,
      mood: lightingSetup.mood,
      components: lightingSetup.components.map((component) => ({
        type: component,
        intensity: this.calculateLightIntensity(component, sceneData),
        color: this.selectLightColor(component, sceneData, cinematography),
        position: this.calculateLightPosition(component, sceneData),
        animation: this.generateLightAnimation(component, cinematography),
      })),
      ambient_lighting: this.generateAmbientLighting(sceneData, cinematography),
      special_effects: this.generateLightingEffects(sceneData, cinematography),
    };
  }

  generateTransitionPlan(shotSequence, cinematography) {
    const transitions = [];

    for (let i = 0; i < shotSequence.length - 1; i++) {
      const currentShot = shotSequence[i];
      const nextShot = shotSequence[i + 1];

      const transitionType = this.selectTransitionType(
        currentShot,
        nextShot,
        cinematography
      );
      const transition = this.createTransition(
        transitionType,
        currentShot,
        nextShot
      );

      transitions.push(transition);
    }

    return transitions;
  }

  selectTransitionType(currentShot, nextShot, cinematography) {
    // Transition selection based on shot types and cinematography style
    const shotTypeTransitions = {
      establishing: { wide: 'cut', medium: 'dissolve', close_up: 'fade' },
      wide: { medium: 'cut', close_up: 'dissolve', aerial: 'wipe' },
      medium: { close_up: 'cut', wide: 'dissolve', extreme_close_up: 'morph' },
      close_up: { extreme_close_up: 'cut', medium: 'dissolve', wide: 'fade' },
      extreme_close_up: { close_up: 'cut', medium: 'morph', wide: 'fade' },
      aerial: { wide: 'wipe', establishing: 'dissolve', medium: 'cut' },
    };

    const stylePreferences = {
      cinematic: ['cut', 'dissolve', 'fade'],
      documentary: ['cut', 'fade'],
      dreamlike: ['dissolve', 'morph', 'fade'],
      music_video: ['cut', 'wipe', 'morph'],
    };

    const suggestedTransition =
      shotTypeTransitions[currentShot.type]?.[nextShot.type] || 'cut';
    const styleTransitions = stylePreferences[cinematography.name] || ['cut'];

    // Use suggested transition if it fits the style, otherwise pick from style preferences
    return styleTransitions.includes(suggestedTransition)
      ? suggestedTransition
      : styleTransitions[Math.floor(Math.random() * styleTransitions.length)];
  }

  createTransition(transitionType, currentShot, nextShot) {
    const transitionTemplate = this.transitionTypes[transitionType];

    return {
      type: transitionType,
      duration: this.calculateTransitionDuration(
        transitionTemplate,
        currentShot,
        nextShot
      ),
      style: transitionTemplate.style,
      description: this.generateTransitionDescription(
        transitionTemplate,
        currentShot,
        nextShot
      ),
      technical_parameters:
        this.generateTransitionParameters(transitionTemplate),
    };
  }

  generateColorGrading(sceneData, cinematography) {
    const gradingStyle = cinematography.color_grading;

    const colorProfiles = {
      cinematic_luts: {
        highlights: 'warm_tones',
        shadows: 'cool_tones',
        saturation: 'enhanced',
        contrast: 'high',
      },
      natural_tones: {
        highlights: 'neutral',
        shadows: 'neutral',
        saturation: 'natural',
        contrast: 'medium',
      },
      surreal_palette: {
        highlights: 'ethereal_glow',
        shadows: 'deep_mystery',
        saturation: 'selective_enhancement',
        contrast: 'dynamic',
      },
      high_contrast: {
        highlights: 'blown_highlights',
        shadows: 'crushed_blacks',
        saturation: 'vibrant',
        contrast: 'extreme',
      },
    };

    const profile = colorProfiles[gradingStyle] || colorProfiles.natural_tones;

    return {
      style: gradingStyle,
      profile,
      mood_enhancement: this.generateMoodEnhancement(sceneData, profile),
      color_temperature: this.calculateColorTemperature(
        sceneData,
        cinematography
      ),
      special_effects: this.generateColorEffects(sceneData, cinematography),
    };
  }

  composeVideoPrompt(components) {
    const {
      scene_data,
      cinematography,
      shot_sequence,
      lighting_plan,
      transition_plan,
      color_grading,
      options,
    } = components;

    return `# Professional Video Generation Instructions

## Scene Overview
${this.formatSceneDescription(scene_data)}

## Cinematography Style: ${cinematography.name}
${cinematography.description}

**Technical Specifications:**
- Frame Rate: ${cinematography.frame_rate}
- Aspect Ratio: ${cinematography.aspect_ratio}
- Depth of Field: ${cinematography.depth_of_field}

## Shot Sequence (${shot_sequence.length} shots, ~${
      options.target_duration || 60
    }s total)

${shot_sequence
  .map((shot, index) => this.formatShotInstructions(shot, index + 1))
  .join('\n\n')}

## Lighting Plan
**Setup:** ${lighting_plan.setup_type} (${lighting_plan.mood} mood)

**Lighting Components:**
${lighting_plan.components
  .map(
    (light) =>
      `- ${light.type}: ${light.intensity} intensity, ${light.color} color, positioned ${light.position}`
  )
  .join('\n')}

**Ambient Lighting:** ${lighting_plan.ambient_lighting}

## Transition Plan
${transition_plan
  .map(
    (transition, index) =>
      `**Transition ${index + 1}:** ${transition.type} (${
        transition.duration
      }s) - ${transition.description}`
  )
  .join('\n')}

## Color Grading
**Style:** ${color_grading.style}
- Highlights: ${color_grading.profile.highlights}
- Shadows: ${color_grading.profile.shadows}
- Saturation: ${color_grading.profile.saturation}
- Contrast: ${color_grading.profile.contrast}
- Color Temperature: ${color_grading.color_temperature}

## Final Output Requirements
Generate a cohesive video sequence that:
1. Maintains visual continuity throughout all shots
2. Supports the emotional narrative of the dream
3. Uses the specified cinematography techniques effectively
4. Applies consistent lighting and color grading
5. Creates smooth, professional transitions between shots
6. Delivers the intended mood and atmosphere

**Quality Level:** ${options.quality_level || 'high'}
**Emphasis:** ${options.emphasis || 'emotional_impact'}
**Pacing:** ${options.pacing || 'medium'}`;
  }

  formatSceneDescription(sceneData) {
    if (typeof sceneData === 'string') {
      return sceneData;
    }

    return `**Environment:** ${sceneData.environment || 'Not specified'}
**Key Objects:** ${
      sceneData.objects?.map((obj) => obj.type).join(', ') || 'None specified'
    }
**Atmosphere:** ${sceneData.atmosphere || 'Not specified'}
**Lighting:** ${sceneData.lighting?.type || 'Not specified'}`;
  }

  formatShotInstructions(shot, shotNumber) {
    return `### Shot ${shotNumber}: ${shot.type.toUpperCase()} (${
      shot.duration
    }s)

**Camera:**
- Distance: ${shot.camera.distance}
- Angle: ${shot.camera.angle}
- Height: ${shot.camera.height}
- Lens: ${shot.camera.lens}
- Position: ${shot.camera.position_description}

**Movement:**
- Type: ${shot.movement.type}
- Speed: ${shot.movement.speed}
- Direction: ${shot.movement.direction}
- Easing: ${shot.movement.easing}
- Description: ${shot.movement.description}

**Composition:** ${shot.composition}
**Purpose:** ${shot.purpose}
**Technical Notes:** ${shot.technical_notes}`;
  }

  // Helper methods for generating specific components
  selectCameraAngle(shotTemplate, sceneData) {
    const angles = [
      'eye_level',
      'low_angle',
      'high_angle',
      'dutch_angle',
      'overhead',
    ];
    return angles[Math.floor(Math.random() * angles.length)];
  }

  selectCameraHeight(shotTemplate, sceneData) {
    const heights = [
      'ground_level',
      'eye_level',
      'elevated',
      'high_angle',
      'aerial',
    ];
    return heights[Math.floor(Math.random() * heights.length)];
  }

  selectLensType(shotTemplate, style) {
    const lenses = {
      cinematic: ['35mm', '50mm', '85mm'],
      documentary: ['24mm', '35mm', '50mm'],
      dreamlike: ['wide_angle', 'fisheye', 'macro'],
      music_video: ['wide_angle', '35mm', 'telephoto'],
    };

    const styleLenses = lenses[style.name] || lenses.cinematic;
    return styleLenses[Math.floor(Math.random() * styleLenses.length)];
  }

  describeCameraPosition(instructions, sceneData) {
    return `${instructions.height} position at ${instructions.distance} distance, ${instructions.angle} angle`;
  }

  generateFramingNotes(shotTemplate, sceneData) {
    return `Frame composition optimized for ${shotTemplate.purpose}`;
  }

  selectMovementType(baseMovement, styleMovements) {
    // Combine base movement with style-specific movements
    const movements = [...styleMovements, baseMovement];
    return movements[Math.floor(Math.random() * movements.length)];
  }

  selectMovementSpeed(movement, style) {
    const speeds = {
      cinematic: 'slow_deliberate',
      documentary: 'natural_pace',
      dreamlike: 'floating_ethereal',
      music_video: 'dynamic_rhythmic',
    };
    return speeds[style.name] || 'medium_pace';
  }

  selectMovementDirection(movement) {
    const directions = [
      'forward',
      'backward',
      'left',
      'right',
      'up',
      'down',
      'circular',
      'spiral',
    ];
    return directions[Math.floor(Math.random() * directions.length)];
  }

  selectMovementEasing(movement, style) {
    const easings = [
      'linear',
      'ease_in',
      'ease_out',
      'ease_in_out',
      'bounce',
      'elastic',
    ];
    return easings[Math.floor(Math.random() * easings.length)];
  }

  describeMovement(movement, style) {
    return `${movement} movement with ${style.name} characteristics`;
  }

  calculateComplexity(shotSequence, lightingPlan) {
    let complexity = 0;
    complexity += shotSequence.length * 2; // Base complexity from shot count
    complexity += lightingPlan.components.length * 3; // Lighting complexity
    complexity +=
      shotSequence.filter((shot) => shot.movement.type !== 'static').length * 2; // Movement complexity
    return Math.min(100, complexity);
  }

  // Additional helper methods would be implemented here...
  calculateLightIntensity(component, sceneData) {
    return 'medium';
  }
  selectLightColor(component, sceneData, cinematography) {
    return 'warm_white';
  }
  calculateLightPosition(component, sceneData) {
    return 'optimal_position';
  }
  generateLightAnimation(component, cinematography) {
    return 'subtle_variation';
  }
  generateAmbientLighting(sceneData, cinematography) {
    return 'soft_ambient_glow';
  }
  generateLightingEffects(sceneData, cinematography) {
    return [];
  }
  calculateTransitionDuration(template, currentShot, nextShot) {
    return parseFloat(template.duration.split('-')[0]) || 1;
  }
  generateTransitionDescription(template, currentShot, nextShot) {
    return template.description;
  }
  generateTransitionParameters(template) {
    return {};
  }
  generateMoodEnhancement(sceneData, profile) {
    return 'enhanced_emotional_resonance';
  }
  calculateColorTemperature(sceneData, cinematography) {
    return '5600K';
  }
  generateColorEffects(sceneData, cinematography) {
    return [];
  }
  generateCompositionInstructions(shotTemplate, sceneData) {
    return 'Rule of thirds composition';
  }
  generateFocusInstructions(shotTemplate, sceneData) {
    return 'Sharp focus on main subject';
  }
  generateTechnicalNotes(shotTemplate, style) {
    return 'Standard technical execution';
  }
  optimizeShotSequence(sequence, style) {
    return sequence;
  }
}

module.exports = VideoPromptEngine;
