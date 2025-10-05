// services/frontend/next-app/app/components/EnhancedLighting.tsx
'use client';

import * as THREE from 'three';

export interface LightingConfig {
  threePoint: {
    enabled: boolean;
    keyLight: {
      intensity: number;
      position: [number, number, number];
      color: string;
      castShadow: boolean;
    };
    fillLight: {
      intensity: number;
      position: [number, number, number];
      color: string;
    };
    rimLight: {
      intensity: number;
      position: [number, number, number];
      color: string;
    };
  };
  ambient: {
    intensity: number;
    color: string;
  };
  hemisphere: {
    enabled: boolean;
    skyColor: string;
    groundColor: string;
    intensity: number;
  };
  shadows: {
    enabled: boolean;
    quality: 'low' | 'medium' | 'high';
    softness: number;
  };
}

interface EnhancedLightingProps {
  config: LightingConfig;
  style?: string;
}

// Environment-based lighting presets
export const getEnvironmentLightingConfig = (
  environment?: string,
  style?: string,
  quality: 'low' | 'medium' | 'high' = 'medium'
): LightingConfig => {
  // Base configuration
  const baseConfig: LightingConfig = {
    threePoint: {
      enabled: true,
      keyLight: {
        intensity: 1.5,
        position: [100, 100, 50],
        color: '#ffffff',
        castShadow: true,
      },
      fillLight: {
        intensity: 0.5,
        position: [-50, 50, -50],
        color: '#4488ff',
      },
      rimLight: {
        intensity: 1.0,
        position: [-100, 50, 100],
        color: '#ffaa88',
      },
    },
    ambient: {
      intensity: 0.6,
      color: '#2d4a6b',
    },
    hemisphere: {
      enabled: true,
      skyColor: '#87CEEB',
      groundColor: '#1A4D6D',
      intensity: 0.4,
    },
    shadows: {
      enabled: quality !== 'low',
      quality,
      softness: quality === 'high' ? 3 : quality === 'medium' ? 2 : 1,
    },
  };

  // Style-specific adjustments
  switch (style) {
    case 'cyberpunk':
      return {
        ...baseConfig,
        threePoint: {
          ...baseConfig.threePoint,
          keyLight: {
            ...baseConfig.threePoint.keyLight,
            intensity: 2.0,
            color: '#00ffff',
          },
          fillLight: {
            ...baseConfig.threePoint.fillLight,
            intensity: 0.8,
            color: '#ff00ff',
          },
          rimLight: {
            ...baseConfig.threePoint.rimLight,
            intensity: 1.5,
            color: '#ff0080',
          },
        },
        ambient: {
          intensity: 0.4,
          color: '#004466',
        },
        hemisphere: {
          ...baseConfig.hemisphere,
          skyColor: '#001133',
          groundColor: '#000022',
          intensity: 0.3,
        },
      };

    case 'nightmare':
      return {
        ...baseConfig,
        threePoint: {
          ...baseConfig.threePoint,
          keyLight: {
            ...baseConfig.threePoint.keyLight,
            intensity: 0.8,
            color: '#660000',
            position: [80, 60, 40],
          },
          fillLight: {
            ...baseConfig.threePoint.fillLight,
            intensity: 0.2,
            color: '#330033',
          },
          rimLight: {
            ...baseConfig.threePoint.rimLight,
            intensity: 0.6,
            color: '#440044',
          },
        },
        ambient: {
          intensity: 0.3,
          color: '#4d2d4d',
        },
        hemisphere: {
          ...baseConfig.hemisphere,
          skyColor: '#1a0d1a',
          groundColor: '#0a0a0a',
          intensity: 0.2,
        },
      };

    case 'fantasy':
      return {
        ...baseConfig,
        threePoint: {
          ...baseConfig.threePoint,
          keyLight: {
            ...baseConfig.threePoint.keyLight,
            intensity: 1.8,
            color: '#ffd700',
            position: [120, 120, 60],
          },
          fillLight: {
            ...baseConfig.threePoint.fillLight,
            intensity: 0.7,
            color: '#9d4edd',
          },
          rimLight: {
            ...baseConfig.threePoint.rimLight,
            intensity: 1.2,
            color: '#ff6b4a',
          },
        },
        ambient: {
          intensity: 0.5,
          color: '#6b4226',
        },
        hemisphere: {
          ...baseConfig.hemisphere,
          skyColor: '#4a2d1a',
          groundColor: '#2d1810',
          intensity: 0.5,
        },
      };

    case 'surreal':
      return {
        ...baseConfig,
        threePoint: {
          ...baseConfig.threePoint,
          keyLight: {
            ...baseConfig.threePoint.keyLight,
            intensity: 1.6,
            color: '#ff0080',
            position: [90, 110, 70],
          },
          fillLight: {
            ...baseConfig.threePoint.fillLight,
            intensity: 0.6,
            color: '#80ff00',
          },
          rimLight: {
            ...baseConfig.threePoint.rimLight,
            intensity: 1.1,
            color: '#0080ff',
          },
        },
        ambient: {
          intensity: 0.4,
          color: '#0f3460',
        },
        hemisphere: {
          ...baseConfig.hemisphere,
          skyColor: '#16213e',
          groundColor: '#1a1a2e',
          intensity: 0.4,
        },
      };

    default: // ethereal
      return baseConfig;
  }
};

export default function EnhancedLighting({
  config,
  style = 'ethereal',
}: EnhancedLightingProps) {
  const shadowMapSize = {
    low: 1024,
    medium: 2048,
    high: 4096,
  }[config.shadows.quality];

  return (
    <group name='enhanced-lighting'>
      {/* Ambient Light */}
      <ambientLight
        intensity={config.ambient.intensity}
        color={config.ambient.color}
      />

      {/* Hemisphere Light for sky/ground color */}
      {config.hemisphere.enabled && (
        <hemisphereLight
          args={[
            config.hemisphere.skyColor,
            config.hemisphere.groundColor,
            config.hemisphere.intensity,
          ]}
        />
      )}

      {/* Three-Point Lighting Setup */}
      {config.threePoint.enabled && (
        <>
          {/* Key Light (Main Light) */}
          <directionalLight
            position={config.threePoint.keyLight.position}
            intensity={config.threePoint.keyLight.intensity}
            color={config.threePoint.keyLight.color}
            castShadow={
              config.shadows.enabled && config.threePoint.keyLight.castShadow
            }
            shadow-mapSize-width={shadowMapSize}
            shadow-mapSize-height={shadowMapSize}
            shadow-camera-far={500}
            shadow-camera-left={-200}
            shadow-camera-right={200}
            shadow-camera-top={200}
            shadow-camera-bottom={-200}
            shadow-bias={-0.0001}
            shadow-radius={config.shadows.softness}
          />

          {/* Fill Light (Soften Shadows) */}
          <directionalLight
            position={config.threePoint.fillLight.position}
            intensity={config.threePoint.fillLight.intensity}
            color={config.threePoint.fillLight.color}
          />

          {/* Rim Light (Edge Highlight) */}
          <directionalLight
            position={config.threePoint.rimLight.position}
            intensity={config.threePoint.rimLight.intensity}
            color={config.threePoint.rimLight.color}
          />
        </>
      )}
    </group>
  );
}
