# PostProcessing Component

## Overview

The `PostProcessing` component provides cinematic post-processing effects for the 3D dream rendering system. It includes depth of field, bloom, color grading, vignette, chromatic aberration, and film grain effects.

## Features

### Implemented Effects

1. **Depth of Field (DOF)** - Simulates camera focus with bokeh blur
2. **Bloom** - Adds glow to bright elements
3. **Color Grading** - Adjusts exposure, contrast, saturation, and temperature
4. **Tone Mapping** - ACES Filmic tone mapping for cinematic look
5. **Vignette** - Darkens edges for cinematic framing
6. **Chromatic Aberration** - Simulates lens color separation
7. **Film Grain** - Adds texture and film-like quality

### Quality Presets

Three predefined quality levels are available:

- **Cinematic** - All effects enabled, maximum quality (high multisampling)
- **Balanced** - Selective effects, moderate quality (medium multisampling)
- **Performance** - Minimal/no effects for best performance

## Usage

### Basic Usage

The component is automatically integrated into `DreamScene.tsx` and uses the quality setting from the dream's render configuration:

```tsx
import PostProcessing, { getPresetFromQuality } from './PostProcessing';

// In DreamScene component
const postProcessingConfig = getPresetFromQuality(
  renderConfig.quality || 'medium'
);

<PostProcessing config={postProcessingConfig} />;
```

### Custom Configuration

You can create custom configurations by merging with presets:

```tsx
import { BALANCED_PRESET, mergeWithPreset } from './PostProcessing';

const customConfig = mergeWithPreset(BALANCED_PRESET, {
  effects: {
    bloom: {
      enabled: true,
      intensity: 0.8,
      threshold: 0.85,
      radius: 1.0,
    },
    depthOfField: {
      enabled: true,
      focusDistance: 0.15,
      focalLength: 0.08,
      bokehScale: 3.0,
    },
  },
});

<PostProcessing config={customConfig} />;
```

### Using Presets Directly

```tsx
import { CINEMATIC_PRESET, BALANCED_PRESET, PERFORMANCE_PRESET } from './PostProcessing';

// Use cinematic preset
<PostProcessing config={CINEMATIC_PRESET} />

// Use balanced preset
<PostProcessing config={BALANCED_PRESET} />

// Use performance preset (effects disabled)
<PostProcessing config={PERFORMANCE_PRESET} />
```

## Configuration Interface

```typescript
interface PostProcessingConfig {
  enabled: boolean;
  quality: 'draft' | 'medium' | 'high';
  effects: {
    depthOfField?: {
      enabled: boolean;
      focusDistance: number; // 0.0 - 1.0
      focalLength: number; // 0.0 - 1.0
      bokehScale: number; // 0.0 - 10.0
    };
    bloom?: {
      enabled: boolean;
      intensity: number; // 0.0 - 2.0
      threshold: number; // 0.0 - 1.0
      radius: number; // 0.0 - 1.0
    };
    colorGrading?: {
      enabled: boolean;
      exposure: number; // 0.5 - 2.0
      contrast: number; // 0.5 - 2.0
      saturation: number; // 0.0 - 2.0
      temperature: number; // -100 to 100 (negative = cool, positive = warm)
    };
    vignette?: {
      enabled: boolean;
      darkness: number; // 0.0 - 1.0
      offset: number; // 0.0 - 1.0
    };
    chromaticAberration?: {
      enabled: boolean;
      offset: number; // 0.0 - 0.01
    };
    filmGrain?: {
      enabled: boolean;
      intensity: number; // 0.0 - 0.2
    };
  };
}
```

## Quality Preset Details

### Cinematic Preset

- **Quality**: High (8x multisampling)
- **Effects**: All enabled
- **Use Case**: Final renders, high-end hardware
- **Performance**: ~30-60 FPS on high-end GPUs

### Balanced Preset

- **Quality**: Medium (4x multisampling)
- **Effects**: Bloom, color grading, vignette
- **Use Case**: Real-time preview, mid-range hardware
- **Performance**: ~30-60 FPS on mid-range GPUs

### Performance Preset

- **Quality**: Draft (no multisampling)
- **Effects**: All disabled
- **Use Case**: Low-end hardware, maximum FPS
- **Performance**: 60+ FPS on most hardware

## Integration with Dream Schema

The post-processing quality is automatically determined from the dream's render configuration:

```json
{
  "render": {
    "quality": "high" // Maps to CINEMATIC_PRESET
  }
}
```

Quality mapping:

- `"high"` → Cinematic Preset
- `"medium"` → Balanced Preset
- `"draft"` or `"low"` → Performance Preset

## Performance Considerations

### Effect Performance Impact

From most to least expensive:

1. Depth of Field (DOF) - High impact
2. Bloom - Medium-high impact
3. Chromatic Aberration - Medium impact
4. Color Grading - Low-medium impact
5. Vignette - Low impact
6. Film Grain - Low impact

### Optimization Tips

1. **Disable DOF** for better performance while keeping other effects
2. **Reduce multisampling** from 8 to 4 or 0 for significant FPS boost
3. **Lower bloom radius** to reduce blur passes
4. **Disable chromatic aberration** on lower-end hardware

## Future Enhancements

Potential additions for future tasks:

- Motion blur
- Ambient occlusion (SSAO)
- Screen space reflections (SSR)
- Lens flares
- God rays (volumetric lighting)
- LUT-based color grading

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **Requirement 5.1**: Color grading with exposure, contrast, saturation
- **Requirement 5.2**: Quality-based effect toggling
- **Requirement 5.3**: Depth of field with focus distance control
- **Requirement 5.4**: Bloom for glowing elements
- **Requirement 5.5**: ACES tone mapping
- **Requirement 5.6**: Vignette effect
- **Requirement 5.7**: Film grain effect
- **Requirement 5.8**: Chromatic aberration
- **Requirement 5.10**: Anti-aliasing through multisampling
- **Requirement 6.3**: Cinematic quality preset
- **Requirement 6.4**: Balanced quality preset
- **Requirement 6.5**: Performance quality preset
- **Requirement 8.2**: Quality preset selection
- **Requirement 8.3**: Individual effect toggles
- **Requirement 8.4**: Quality-based configuration

## Testing

To test the post-processing effects:

1. Load a dream with `render.quality` set to `"high"`
2. Verify all effects are visible (bloom on bright objects, vignette on edges, etc.)
3. Change quality to `"medium"` and verify selective effects
4. Change quality to `"draft"` and verify effects are disabled
5. Monitor FPS to ensure performance targets are met

## Dependencies

- `@react-three/postprocessing`: ^3.0.4
- `postprocessing`: ^6.37.8
- `@react-three/fiber`: ^9.3.0
- `three`: ^0.180.0
