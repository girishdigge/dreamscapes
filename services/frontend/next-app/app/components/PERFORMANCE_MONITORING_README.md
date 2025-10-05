# Performance Monitoring and Adaptive Quality System

This document describes the performance monitoring and adaptive quality system implemented for the cinematic quality enhancement feature.

## Overview

The system consists of three main components:

1. **PerformanceMonitor** - Tracks FPS, memory usage, and performance degradation
2. **AdaptiveQualityManager** - Automatically adjusts quality based on performance
3. **QualitySettings** - UI component for quality controls and performance metrics

## Components

### 1. PerformanceMonitor (`utils/performanceMonitor.ts`)

Tracks real-time performance metrics:

- **FPS tracking**: Current, average, min, and max FPS
- **Memory monitoring**: JavaScript heap usage (when available)
- **Frame time**: Time taken to render each frame
- **Degradation detection**: Identifies when performance drops below thresholds

#### Usage

```typescript
import {
  getGlobalPerformanceMonitor,
  usePerformanceMonitor,
} from '@/utils/performanceMonitor';

// In a component
function MyComponent() {
  const metrics = usePerformanceMonitor({
    targetFPS: 30,
    minAcceptableFPS: 20,
    maxMemoryMB: 2048,
    degradationThreshold: 0.7,
  });

  return (
    <div>
      <p>FPS: {metrics.fps}</p>
      <p>Memory: {metrics.memoryUsageMB} MB</p>
      {metrics.isPerformanceDegraded && <p>⚠️ Performance degraded!</p>}
    </div>
  );
}

// Or use the singleton directly
const monitor = getGlobalPerformanceMonitor();
monitor.start();
monitor.subscribe((metrics) => {
  console.log('FPS:', metrics.fps);
});
```

### 2. AdaptiveQualityManager (`utils/adaptiveQuality.ts`)

Automatically adjusts rendering quality based on performance:

- **Auto-reduce**: Lowers quality when FPS drops below threshold
- **Auto-restore**: Increases quality when performance improves
- **Quality levels**: Performance → Balanced → Cinematic
- **User notifications**: Alerts when quality changes

#### Usage

```typescript
import { useAdaptiveQuality } from '@/utils/adaptiveQuality';
import { getGlobalPerformanceMonitor } from '@/utils/performanceMonitor';

function MyScene() {
  const monitor = getGlobalPerformanceMonitor();

  const { currentQuality, notifications, setQuality, getPostProcessingConfig } =
    useAdaptiveQuality(monitor, 'balanced', {
      enabled: true,
      autoReduce: true,
      autoRestore: true,
      minQuality: 'performance',
      notifyUser: true,
    });

  const postProcessingConfig = getPostProcessingConfig();

  return (
    <Canvas>
      <PostProcessing config={postProcessingConfig} />
      {/* ... rest of scene */}
    </Canvas>
  );
}
```

### 3. QualitySettings Component (`components/QualitySettings.tsx`)

UI component for quality controls and performance metrics:

- **Quality preset selector**: Performance, Balanced, Cinematic
- **Performance metrics display**: FPS, memory, frame time
- **Adaptive quality toggle**: Enable/disable automatic adjustments
- **Notifications**: Recent quality changes
- **Recommendations**: Suggested quality based on performance

#### Usage

```typescript
import QualitySettings, { PerformanceHUD } from '@/components/QualitySettings';

function App() {
  return (
    <div>
      {/* Full quality settings panel */}
      <QualitySettings
        initialQuality='balanced'
        onQualityChange={(quality) => console.log('Quality changed:', quality)}
        showAdvanced={true}
      />

      {/* Or use minimal HUD */}
      <PerformanceHUD />

      {/* Your scene */}
      <DreamScene dream={dream} />
    </div>
  );
}
```

## Integration with DreamScene

To integrate the performance monitoring system with DreamScene:

```typescript
// DreamScene.tsx
import { useState } from 'react';
import { getGlobalPerformanceMonitor } from '@/utils/performanceMonitor';
import { useAdaptiveQuality } from '@/utils/adaptiveQuality';
import QualitySettings from '@/components/QualitySettings';

export default function DreamScene({
  dream,
  isPlaying,
  currentTime,
  onTimeUpdate,
}) {
  const monitor = getGlobalPerformanceMonitor();
  const [showQualitySettings, setShowQualitySettings] = useState(true);

  const { currentQuality, getPostProcessingConfig, getRenderingSettings } =
    useAdaptiveQuality(monitor, dream.render?.quality || 'balanced');

  const postProcessingConfig = getPostProcessingConfig();
  const renderSettings = getRenderingSettings();

  return (
    <div className='w-full h-full relative'>
      {/* Quality Settings UI */}
      {showQualitySettings && (
        <QualitySettings
          initialQuality={dream.render?.quality || 'balanced'}
          showAdvanced={true}
        />
      )}

      <Canvas
        shadows={renderSettings.shadows}
        gl={{
          antialias: renderSettings.antialias,
          // ... other settings
        }}
      >
        {/* Scene content */}
        <CinematicCamera dream={dream} />
        <DreamStructures structures={dream.structures} />
        <DreamEntities entities={dream.entities} />

        {/* Post-processing with adaptive quality */}
        <PostProcessing config={postProcessingConfig} />
      </Canvas>
    </div>
  );
}
```

## Quality Levels

### Performance

- **Target**: 60+ FPS
- **Post-processing**: Disabled
- **Shadows**: Disabled
- **Geometry**: Low detail
- **Particles**: 40% of normal count

### Balanced

- **Target**: 30-60 FPS
- **Post-processing**: Basic (bloom, color grading, vignette)
- **Shadows**: Medium quality (2048x2048)
- **Geometry**: Medium detail
- **Particles**: 70% of normal count

### Cinematic

- **Target**: 30+ FPS
- **Post-processing**: Full (DOF, bloom, color grading, vignette, chromatic aberration, film grain)
- **Shadows**: High quality (4096x4096)
- **Geometry**: High detail
- **Particles**: 100% of normal count

## Performance Thresholds

Default thresholds:

```typescript
{
  targetFPS: 30,           // Target frame rate
  minAcceptableFPS: 20,    // Below this triggers degradation
  maxMemoryMB: 2048,       // Maximum memory usage
  degradationThreshold: 0.7 // 70% of target FPS triggers reduction
}
```

## Adaptive Quality Behavior

### Quality Reduction

- Triggered after **3 consecutive** low FPS readings
- Reduces quality by **one level** at a time
- Waits **3 seconds** between changes
- Won't go below configured `minQuality`

### Quality Restoration

- Triggered after **5 consecutive** good FPS readings
- Increases quality by **one level** at a time
- Waits **3 seconds** between changes
- Won't exceed user's target quality

## API Reference

### PerformanceMonitor

```typescript
class PerformanceMonitor {
  start(): void;
  stop(): void;
  getMetrics(): PerformanceMetrics;
  subscribe(callback: PerformanceCallback): () => void;
  setThresholds(thresholds: Partial<PerformanceThresholds>): void;
  reset(): void;
}
```

### AdaptiveQualityManager

```typescript
class AdaptiveQualityManager {
  start(): void;
  stop(): void;
  setQuality(quality: QualityLevel): void;
  getCurrentQuality(): QualityLevel;
  getPostProcessingConfig(): PostProcessingConfig;
  getRenderingSettings(): RenderingSettings;
  subscribe(callback: QualityChangeCallback): () => void;
}
```

## Requirements Satisfied

- ✅ **6.7**: Performance monitoring with FPS tracking and adaptive quality
- ✅ **6.10**: Memory usage monitoring
- ✅ **8.5**: Quality preset selector UI
- ✅ **8.7**: Auto-reduce and restore quality based on performance
- ✅ **8.8**: Individual effect toggles (via quality presets)
- ✅ **8.9**: Display current FPS and performance metrics

## Testing

To test the performance monitoring system:

1. **Start monitoring**: The system starts automatically when using the hooks
2. **Trigger degradation**: Add many objects to the scene to lower FPS
3. **Observe adaptation**: Watch quality automatically reduce
4. **Remove objects**: See quality gradually restore
5. **Manual override**: Use QualitySettings UI to manually set quality

## Notes

- Performance monitoring uses `requestAnimationFrame` for accurate FPS tracking
- Memory monitoring requires Chrome/Edge (uses `performance.memory` API)
- Adaptive quality changes are rate-limited to prevent thrashing
- All components are SSR-safe (return defaults during server rendering)
