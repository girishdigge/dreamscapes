# Performance Monitoring Integration Example

This document shows how to integrate the performance monitoring and adaptive quality system into the existing DreamScene component.

## Quick Integration

### Step 1: Add QualitySettings to DreamScene

Add the QualitySettings component to your DreamScene:

```typescript
// In DreamScene.tsx
import QualitySettings from './QualitySettings';

export default function DreamScene({
  dream,
  isPlaying,
  currentTime,
  onTimeUpdate,
}) {
  // ... existing code ...

  return (
    <div className='w-full h-full relative'>
      {/* Add Quality Settings UI */}
      <QualitySettings
        initialQuality={renderConfig.quality || 'balanced'}
        showAdvanced={true}
      />

      <Canvas>{/* ... existing scene content ... */}</Canvas>

      {/* ... existing overlays ... */}
    </div>
  );
}
```

### Step 2: Use Adaptive Quality (Optional)

For automatic quality adjustment based on performance:

```typescript
// In DreamScene.tsx
import { getGlobalPerformanceMonitor } from '../utils/performanceMonitor';
import { useAdaptiveQuality } from '../utils/adaptiveQuality';

export default function DreamScene({
  dream,
  isPlaying,
  currentTime,
  onTimeUpdate,
}) {
  const monitor = getGlobalPerformanceMonitor();

  // Use adaptive quality
  const { currentQuality, getPostProcessingConfig } = useAdaptiveQuality(
    monitor,
    dream.render?.quality || 'balanced',
    {
      enabled: true,
      autoReduce: true,
      autoRestore: true,
      minQuality: 'performance',
    }
  );

  // Get post-processing config based on current quality
  const postProcessingConfig = getPostProcessingConfig();

  return (
    <div className='w-full h-full relative'>
      <Canvas>
        {/* Use adaptive post-processing config */}
        <PostProcessing config={postProcessingConfig} />
        {/* ... rest of scene ... */}
      </Canvas>
    </div>
  );
}
```

### Step 3: Add Performance HUD (Optional)

For a minimal always-on performance display:

```typescript
import { PerformanceHUD } from './QualitySettings';

export default function DreamScene({
  dream,
  isPlaying,
  currentTime,
  onTimeUpdate,
}) {
  return (
    <div className='w-full h-full relative'>
      {/* Add minimal performance HUD */}
      <PerformanceHUD />

      <Canvas>{/* ... scene content ... */}</Canvas>
    </div>
  );
}
```

## Full Integration Example

Here's a complete example with all features:

```typescript
// DreamScene.tsx
'use client';

import { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Stars } from '@react-three/drei';
import * as THREE from 'three';
import CinematicCamera from './CinematicCamera';
import DreamEnvironment from './DreamEnvironment';
import DreamStructures from './DreamStructures';
import DreamEntities from './DreamEntities';
import LoadingFallback from './LoadingFallback';
import PostProcessing from './PostProcessing';
import EnhancedLighting, {
  getEnvironmentLightingConfig,
} from './EnhancedLighting';
import QualitySettings, { PerformanceHUD } from './QualitySettings';
import { getGlobalPerformanceMonitor } from '../utils/performanceMonitor';
import { useAdaptiveQuality } from '../utils/adaptiveQuality';
import { Dream } from '../types/dream';

interface DreamSceneProps {
  dream: Dream;
  isPlaying: boolean;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
}

export default function DreamScene({
  dream,
  isPlaying,
  currentTime,
  onTimeUpdate,
}: DreamSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showQualitySettings, setShowQualitySettings] = useState(true);
  const [useAdaptive, setUseAdaptive] = useState(true);

  // Performance monitoring
  const monitor = getGlobalPerformanceMonitor();

  // Adaptive quality (optional)
  const adaptiveQuality = useAdaptiveQuality(
    monitor,
    dream.render?.quality || 'balanced',
    {
      enabled: useAdaptive,
      autoReduce: true,
      autoRestore: true,
      minQuality: 'performance',
      notifyUser: true,
    }
  );

  // Canvas settings
  const renderConfig = dream.render || {
    res: [1280, 720],
    fps: 30,
    quality: 'draft',
  };

  // Get post-processing config (adaptive or static)
  const postProcessingConfig = useAdaptive
    ? adaptiveQuality.getPostProcessingConfig()
    : getPresetFromQuality(renderConfig.quality || 'medium');

  // Get rendering settings
  const renderSettings = useAdaptive
    ? adaptiveQuality.getRenderingSettings()
    : {
        antialias: renderConfig.quality !== 'draft',
        shadows: renderConfig.quality !== 'draft',
        shadowQuality: renderConfig.quality === 'high' ? 'high' : 'medium',
      };

  // Environment and lighting setup
  const validPresets = [
    'night',
    'apartment',
    'city',
    'dawn',
    'forest',
    'lobby',
    'park',
    'studio',
    'sunset',
    'warehouse',
  ] as const;
  type ValidPreset = (typeof validPresets)[number];

  const getValidPreset = (preset?: string): ValidPreset => {
    if (preset && validPresets.includes(preset as ValidPreset)) {
      return preset as ValidPreset;
    }
    return 'sunset';
  };

  const environmentPreset = getValidPreset(dream.environment?.preset);

  const getStyleColors = (style: string) => {
    switch (style) {
      case 'cyberpunk':
        return { bg: '#0a0a0a', fog: '#001122', ambient: '#004466' };
      case 'nightmare':
        return { bg: '#1a0d1a', fog: '#2d1b2d', ambient: '#4d2d4d' };
      case 'fantasy':
        return { bg: '#2d1810', fog: '#4a2d1a', ambient: '#6b4226' };
      case 'surreal':
        return { bg: '#1a1a2e', fog: '#16213e', ambient: '#0f3460' };
      default:
        return { bg: '#0f1419', fog: '#1a2b3d', ambient: '#2d4a6b' };
    }
  };

  const styleColors = getStyleColors(dream.style);

  const qualityLevel =
    renderConfig.quality === 'draft'
      ? 'low'
      : renderConfig.quality === 'high'
      ? 'high'
      : 'medium';
  const lightingConfig = getEnvironmentLightingConfig(
    environmentPreset,
    dream.style,
    qualityLevel
  );

  return (
    <div className='w-full h-full relative'>
      {/* Quality Settings UI */}
      {showQualitySettings && (
        <QualitySettings
          initialQuality={dream.render?.quality || 'balanced'}
          onQualityChange={(quality) => {
            console.log('Quality changed to:', quality);
          }}
          showAdvanced={true}
        />
      )}

      {/* Performance HUD (minimal) */}
      {!showQualitySettings && <PerformanceHUD />}

      <Canvas
        ref={canvasRef}
        camera={{ position: [0, 50, 100], fov: 40, near: 0.1, far: 5000 }}
        gl={{
          preserveDrawingBuffer: true,
          antialias: renderSettings.antialias,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        shadows={renderSettings.shadows}
        style={{ background: styleColors.bg }}
      >
        {/* Enhanced Lighting System */}
        <EnhancedLighting config={lightingConfig} style={dream.style} />

        {/* Environment Effects */}
        <Suspense fallback={null}>
          {dream.environment?.fog && (
            <fog attach='fog' args={[styleColors.fog, 20, 200]} />
          )}

          {environmentPreset === 'night' && (
            <Stars
              radius={300}
              depth={60}
              count={2000}
              factor={6}
              saturation={0.8}
              fade={true}
            />
          )}

          <Environment preset={environmentPreset} />
        </Suspense>

        {/* Cinematic Camera Controller */}
        <CinematicCamera
          dream={dream}
          isPlaying={isPlaying}
          currentTime={currentTime}
          onTimeUpdate={onTimeUpdate}
        />

        {/* Dream Environment */}
        <Suspense fallback={<LoadingFallback />}>
          <DreamEnvironment
            environment={dream.environment}
            style={dream.style}
          />
        </Suspense>

        {/* Dream Structures */}
        <Suspense fallback={<LoadingFallback />}>
          <DreamStructures
            structures={dream.structures || []}
            style={dream.style}
          />
        </Suspense>

        {/* Dream Entities */}
        <Suspense fallback={<LoadingFallback />}>
          <DreamEntities
            entities={dream.entities || []}
            style={dream.style}
            isPlaying={isPlaying}
            currentTime={currentTime}
          />
        </Suspense>

        {/* Post-Processing Effects (with adaptive quality) */}
        <PostProcessing config={postProcessingConfig} />
      </Canvas>

      {/* Existing overlays */}
      <div className='absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white text-sm'>
        <div className='space-y-1'>
          <div className='flex items-center space-x-2'>
            <div
              className={`w-2 h-2 rounded-full ${
                isPlaying ? 'bg-red-500 animate-pulse' : 'bg-green-500'
              }`}
            />
            <span>{isPlaying ? 'Playing' : 'Paused'}</span>
          </div>
          <div>
            Time: {Math.round(currentTime)}s /{' '}
            {dream.cinematography?.durationSec || 30}s
          </div>
          <div>Style: {dream.style}</div>
          <div>
            Quality:{' '}
            {useAdaptive
              ? adaptiveQuality.currentQuality
              : renderConfig.quality}
          </div>
        </div>
      </div>

      {/* Toggle buttons */}
      <div className='absolute bottom-4 right-4 flex space-x-2'>
        <button
          onClick={() => setShowQualitySettings(!showQualitySettings)}
          className='bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs hover:bg-black/70'
        >
          {showQualitySettings ? 'Hide' : 'Show'} Settings
        </button>
        <button
          onClick={() => setUseAdaptive(!useAdaptive)}
          className='bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs hover:bg-black/70'
        >
          Adaptive: {useAdaptive ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}
```

## Configuration Options

### QualitySettings Props

```typescript
interface QualitySettingsProps {
  initialQuality?: QualityLevel; // 'performance' | 'balanced' | 'cinematic'
  onQualityChange?: (quality: QualityLevel) => void;
  showAdvanced?: boolean; // Show advanced settings
}
```

### AdaptiveQuality Config

```typescript
interface AdaptiveQualityConfig {
  enabled: boolean; // Enable adaptive quality
  autoReduce: boolean; // Auto-reduce on performance drop
  autoRestore: boolean; // Auto-restore when performance improves
  minQuality: QualityLevel; // Minimum quality level
  notifyUser: boolean; // Show notifications
}
```

## Tips

1. **Start with balanced quality**: It provides good visuals with reasonable performance
2. **Enable adaptive quality**: Let the system automatically adjust based on hardware
3. **Monitor FPS**: Keep an eye on the performance metrics to understand your scene's demands
4. **Test on target hardware**: Performance varies significantly across devices
5. **Use PerformanceHUD in production**: Minimal overhead, helpful for debugging

## Troubleshooting

### Performance still poor after reduction

- Check if you're at minimum quality already
- Reduce particle counts manually
- Simplify geometry in your structures
- Disable shadows completely

### Quality changes too frequently

- Increase `qualityChangeDelay` in AdaptiveQualityManager
- Adjust `degradationThreshold` to be more lenient
- Set a higher `minQuality` to prevent going too low

### Memory usage high

- Dispose of unused geometries and materials
- Reduce texture sizes
- Limit particle counts
- Use geometry instancing for repeated objects
