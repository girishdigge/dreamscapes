// services/frontend/next-app/app/components/postProcessingPresets.ts

import { PostProcessingConfig } from './PostProcessing';

/**
 * Quality Presets for Post-Processing
 *
 * Three predefined quality levels that balance visual quality with performance:
 * - Cinematic: Maximum quality with all effects enabled
 * - Balanced: Moderate quality with selective effects
 * - Performance: Minimal effects for best performance
 */

export const CINEMATIC_PRESET: PostProcessingConfig = {
  enabled: true,
  quality: 'high',
  effects: {
    depthOfField: {
      enabled: true,
      focusDistance: 0.1,
      focalLength: 0.05,
      bokehScale: 2.0,
    },
    bloom: {
      enabled: true,
      intensity: 0.5,
      threshold: 0.9,
      radius: 0.8,
    },
    colorGrading: {
      enabled: true,
      exposure: 1.2,
      contrast: 1.1,
      saturation: 1.1,
      temperature: 0,
    },
    vignette: {
      enabled: true,
      darkness: 0.5,
      offset: 0.5,
    },
    chromaticAberration: {
      enabled: true,
      offset: 0.001,
    },
    filmGrain: {
      enabled: true,
      intensity: 0.05,
    },
  },
};

export const BALANCED_PRESET: PostProcessingConfig = {
  enabled: true,
  quality: 'medium',
  effects: {
    depthOfField: {
      enabled: false,
      focusDistance: 0.1,
      focalLength: 0.05,
      bokehScale: 1.5,
    },
    bloom: {
      enabled: true,
      intensity: 0.3,
      threshold: 0.95,
      radius: 0.5,
    },
    colorGrading: {
      enabled: true,
      exposure: 1.1,
      contrast: 1.05,
      saturation: 1.0,
      temperature: 0,
    },
    vignette: {
      enabled: true,
      darkness: 0.3,
      offset: 0.5,
    },
    chromaticAberration: {
      enabled: false,
      offset: 0.001,
    },
    filmGrain: {
      enabled: false,
      intensity: 0.03,
    },
  },
};

export const PERFORMANCE_PRESET: PostProcessingConfig = {
  enabled: false,
  quality: 'draft',
  effects: {
    depthOfField: {
      enabled: false,
      focusDistance: 0.1,
      focalLength: 0.05,
      bokehScale: 1.0,
    },
    bloom: {
      enabled: false,
      intensity: 0.2,
      threshold: 0.98,
      radius: 0.3,
    },
    colorGrading: {
      enabled: false,
      exposure: 1.0,
      contrast: 1.0,
      saturation: 1.0,
      temperature: 0,
    },
    vignette: {
      enabled: false,
      darkness: 0.2,
      offset: 0.5,
    },
    chromaticAberration: {
      enabled: false,
      offset: 0.0,
    },
    filmGrain: {
      enabled: false,
      intensity: 0.0,
    },
  },
};

/**
 * Get a preset configuration by name
 */
export function getPreset(
  presetName: 'cinematic' | 'balanced' | 'performance'
): PostProcessingConfig {
  switch (presetName) {
    case 'cinematic':
      return CINEMATIC_PRESET;
    case 'balanced':
      return BALANCED_PRESET;
    case 'performance':
      return PERFORMANCE_PRESET;
    default:
      return BALANCED_PRESET;
  }
}

/**
 * Get preset based on render quality setting
 */
export function getPresetFromQuality(
  quality: 'draft' | 'low' | 'medium' | 'high'
): PostProcessingConfig {
  switch (quality) {
    case 'high':
      return CINEMATIC_PRESET;
    case 'medium':
      return BALANCED_PRESET;
    case 'draft':
    case 'low':
    default:
      return PERFORMANCE_PRESET;
  }
}

/**
 * Merge custom config with a preset
 */
export function mergeWithPreset(
  preset: PostProcessingConfig,
  customConfig: Partial<PostProcessingConfig>
): PostProcessingConfig {
  return {
    ...preset,
    ...customConfig,
    effects: {
      ...preset.effects,
      ...customConfig.effects,
    },
  };
}
