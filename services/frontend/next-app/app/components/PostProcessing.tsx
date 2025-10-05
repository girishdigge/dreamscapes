// services/frontend/next-app/app/components/PostProcessing.tsx
'use client';

import { useMemo, ReactElement, useEffect, useState } from 'react';
import {
  EffectComposer,
  DepthOfField,
  Bloom,
  Vignette,
  ChromaticAberration,
  Noise,
  HueSaturation,
  BrightnessContrast,
  ToneMapping,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import {
  detectWebGLCapabilities,
  getFeatureSupport,
  getCapabilityWarnings,
} from '../utils/webglCapabilities';

// Export presets for easy access
export * from './postProcessingPresets';

/**
 * Post-processing configuration interface
 * Defines all available cinematic effects and their parameters
 */
export interface PostProcessingConfig {
  enabled: boolean;
  quality: 'draft' | 'medium' | 'high';
  effects: {
    depthOfField?: {
      enabled: boolean;
      focusDistance: number;
      focalLength: number;
      bokehScale: number;
    };
    bloom?: {
      enabled: boolean;
      intensity: number;
      threshold: number;
      radius: number;
    };
    colorGrading?: {
      enabled: boolean;
      exposure: number;
      contrast: number;
      saturation: number;
      temperature: number;
    };
    vignette?: {
      enabled: boolean;
      darkness: number;
      offset: number;
    };
    chromaticAberration?: {
      enabled: boolean;
      offset: number;
    };
    filmGrain?: {
      enabled: boolean;
      intensity: number;
    };
  };
}

interface PostProcessingProps {
  config: PostProcessingConfig;
  cameraTarget?: [number, number, number];
}

/**
 * PostProcessing Component
 *
 * Provides cinematic post-processing effects for the 3D scene including:
 * - Depth of Field (DOF) for focus control
 * - Bloom for glowing elements
 * - Color grading for mood and atmosphere
 * - Vignette for cinematic framing
 * - Chromatic aberration for lens realism
 * - Film grain for texture
 *
 * Effects are quality-aware and can be toggled individually.
 */
export default function PostProcessing({
  config,
  cameraTarget,
}: PostProcessingProps) {
  // Detect WebGL capabilities
  const [capabilities, setCapabilities] = useState<ReturnType<
    typeof detectWebGLCapabilities
  > | null>(null);
  const [featureSupport, setFeatureSupport] = useState<ReturnType<
    typeof getFeatureSupport
  > | null>(null);
  const [warningsShown, setWarningsShown] = useState(false);

  useEffect(() => {
    // Detect capabilities on mount
    const caps = detectWebGLCapabilities();
    const features = getFeatureSupport(caps);
    setCapabilities(caps);
    setFeatureSupport(features);

    // Show warnings once
    if (!warningsShown) {
      const warnings = getCapabilityWarnings(caps);
      if (warnings.length > 0) {
        console.group('⚠️ Post-Processing Capability Warnings');
        warnings.forEach((warning) => console.warn(warning));
        console.groupEnd();
      }
      setWarningsShown(true);
    }
  }, [warningsShown]);

  // Don't render if post-processing is disabled
  if (!config.enabled) {
    return null;
  }

  // Don't render if capabilities not yet detected
  if (!capabilities || !featureSupport) {
    return null;
  }

  // Don't render if post-processing not supported
  if (!featureSupport.postProcessing) {
    console.warn(
      'Post-processing not supported on this device. Rendering without effects.'
    );
    return null;
  }

  // Calculate multisampling based on quality
  const multisampling = useMemo(() => {
    switch (config.quality) {
      case 'high':
        return 8;
      case 'medium':
        return 4;
      case 'draft':
      default:
        return 0;
    }
  }, [config.quality]);

  // Calculate focus distance from camera target if available
  const focusDistance = useMemo(() => {
    if (config.effects.depthOfField?.enabled && cameraTarget) {
      // Calculate distance from camera to target
      // This will be updated dynamically by the camera controller
      return config.effects.depthOfField.focusDistance;
    }
    return config.effects.depthOfField?.focusDistance || 0.1;
  }, [config.effects.depthOfField, cameraTarget]);

  // Build effects array
  const effects: ReactElement[] = [];

  // Depth of Field Effect (requires depth texture support)
  if (config.effects.depthOfField?.enabled && featureSupport.depthOfField) {
    effects.push(
      <DepthOfField
        key='dof'
        focusDistance={focusDistance}
        focalLength={config.effects.depthOfField.focalLength}
        bokehScale={config.effects.depthOfField.bokehScale}
        height={480}
      />
    );
  } else if (
    config.effects.depthOfField?.enabled &&
    !featureSupport.depthOfField
  ) {
    console.warn(
      'Depth of Field not supported on this device. Effect disabled.'
    );
  }

  // Bloom Effect (requires float textures)
  if (config.effects.bloom?.enabled && featureSupport.bloom) {
    effects.push(
      <Bloom
        key='bloom'
        intensity={config.effects.bloom.intensity}
        luminanceThreshold={config.effects.bloom.threshold}
        luminanceSmoothing={0.9}
        radius={config.effects.bloom.radius}
        mipmapBlur
      />
    );
  } else if (config.effects.bloom?.enabled && !featureSupport.bloom) {
    console.warn('Bloom effect not supported on this device. Effect disabled.');
  }

  // Color Grading Effects
  if (config.effects.colorGrading?.enabled) {
    effects.push(
      <HueSaturation
        key='hue-saturation'
        saturation={(config.effects.colorGrading.saturation - 1.0) * 0.5}
        hue={config.effects.colorGrading.temperature * 0.01}
      />
    );
    effects.push(
      <BrightnessContrast
        key='brightness-contrast'
        brightness={(config.effects.colorGrading.exposure - 1.0) * 0.1}
        contrast={(config.effects.colorGrading.contrast - 1.0) * 0.5}
      />
    );
    effects.push(
      <ToneMapping key='tone-mapping' mode={ToneMappingMode.ACES_FILMIC} />
    );
  }

  // Vignette Effect
  if (config.effects.vignette?.enabled) {
    effects.push(
      <Vignette
        key='vignette'
        darkness={config.effects.vignette.darkness}
        offset={config.effects.vignette.offset}
      />
    );
  }

  // Chromatic Aberration Effect
  if (config.effects.chromaticAberration?.enabled) {
    effects.push(
      <ChromaticAberration
        key='chromatic-aberration'
        offset={[
          config.effects.chromaticAberration.offset,
          config.effects.chromaticAberration.offset,
        ]}
      />
    );
  }

  // Film Grain Effect
  if (config.effects.filmGrain?.enabled) {
    effects.push(
      <Noise
        key='film-grain'
        opacity={config.effects.filmGrain.intensity}
        blendFunction={BlendFunction.OVERLAY}
      />
    );
  }

  return (
    <EffectComposer multisampling={multisampling}>{effects}</EffectComposer>
  );
}
