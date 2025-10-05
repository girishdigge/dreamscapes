# Cinematic Quality Enhancement Examples

This directory contains example dream configurations demonstrating the cinematic quality enhancement features.

## Examples

### 1. Cinematic Space Scene (`cinematic-space-scene.json`)

A high-quality space scene showcasing:

- **Quality Preset**: Cinematic (high)
- **Camera Work**: Establish shot → Orbit → Dolly in
- **Effects**: Full post-processing with depth of field
- **Lighting**: Night environment with emissive materials
- **Performance**: 30 FPS target, high-end hardware recommended

**Use Case**: Professional-quality space visualization with dramatic camera movements.

**Key Features**:

- Multiple camera shot types with smooth transitions
- Metallic ship with emissive glow
- Particle asteroid field
- Cinematic FOV (35-40)

### 2. Underwater Dream (`underwater-dream.json`)

A surreal underwater scene featuring:

- **Quality Preset**: Balanced (medium)
- **Camera Work**: Handheld camera with subtle shake
- **Effects**: Cool color grading, bloom, vignette, film grain
- **Lighting**: City environment with fog
- **Performance**: 30 FPS target, adaptive quality enabled

**Use Case**: Atmospheric underwater scene with mood-appropriate color grading.

**Key Features**:

- Cool blue color temperature (-20)
- Handheld camera shake for realism
- Flocking fish with separation/alignment/cohesion
- Rising bubble particles
- Emissive coral structures

### 3. Performance Optimized (`performance-optimized.json`)

A lightweight scene optimized for performance:

- **Quality Preset**: Performance (draft)
- **Camera Work**: Fast flythrough
- **Effects**: Post-processing disabled
- **Lighting**: Forest environment with basic lighting
- **Performance**: 60 FPS target, low-end hardware compatible

**Use Case**: Maximum performance for complex scenes or lower-end hardware.

**Key Features**:

- Minimal post-processing overhead
- Low-resolution shadows
- Reduced geometry detail
- Adaptive quality for stability
- Simple materials without metalness

## How to Use

### Loading Examples in the Frontend

1. Copy the example JSON file to your dreams directory
2. Load the dream through the frontend UI
3. Adjust quality settings based on your hardware

### Testing Examples

```bash
# From the frontend directory
npm run dev

# Navigate to the dream viewer
# Load one of the example configurations
```

### Modifying Examples

Each example can be customized by editing the JSON:

```json
{
  "render": {
    "qualityPreset": "cinematic" | "balanced" | "performance"
  },
  "cinematography": {
    "shots": [
      // Add or modify camera shots
    ]
  }
}
```

## Quality Preset Comparison

| Feature           | Cinematic | Balanced   | Performance |
| ----------------- | --------- | ---------- | ----------- |
| Post-Processing   | Full      | Essential  | Disabled    |
| Shadow Resolution | 4096x4096 | 2048x2048  | 1024x1024   |
| Geometry Detail   | High      | Medium     | Low         |
| Antialiasing      | 8x MSAA   | 4x MSAA    | None        |
| Depth of Field    | Yes       | No         | No          |
| Bloom             | Full      | Simplified | No          |
| Film Grain        | Yes       | No         | No          |
| Target FPS        | 30-60     | 30-60      | 60+         |
| Hardware          | High-end  | Mid-range  | Low-end     |

## Camera Shot Types Reference

### Establish

Wide shot that sets the scene. Slow, gradual movement.

```json
{
  "type": "establish",
  "duration": 5,
  "position": [0, 100, 200],
  "fov": 40,
  "easing": "ease-in-out"
}
```

### Orbit

Circular movement around a target object.

```json
{
  "type": "orbit",
  "duration": 10,
  "target": "ship_1",
  "fov": 35,
  "speed": 1.5
}
```

### Dolly In/Out

Move toward or away from subject while maintaining focus.

```json
{
  "type": "dolly_in",
  "duration": 5,
  "position": [20, 20, 40],
  "lookAt": [0, 10, 0],
  "focusDistance": 0.1
}
```

### Handheld

Adds realistic camera shake for documentary feel.

```json
{
  "type": "handheld",
  "duration": 20,
  "shake": 0.3,
  "fov": 45
}
```

### Flythrough

Smooth path following with look-ahead.

```json
{
  "type": "flythrough",
  "duration": 15,
  "speed": 2.0,
  "fov": 45
}
```

## Post-Processing Effect Examples

### Cinematic Look (Film-like)

```json
{
  "postProcessing": {
    "enabled": true,
    "effects": {
      "depthOfField": {
        "enabled": true,
        "focusDistance": 0.1,
        "bokehScale": 2.0
      },
      "bloom": {
        "enabled": true,
        "intensity": 0.5,
        "threshold": 0.9
      },
      "vignette": {
        "enabled": true,
        "darkness": 0.5
      },
      "filmGrain": {
        "enabled": true,
        "intensity": 0.05
      },
      "chromaticAberration": {
        "enabled": true,
        "offset": 0.001
      }
    }
  }
}
```

### Dreamy/Ethereal Look

```json
{
  "postProcessing": {
    "enabled": true,
    "effects": {
      "bloom": {
        "enabled": true,
        "intensity": 0.8,
        "threshold": 0.7,
        "radius": 1.0
      },
      "colorGrading": {
        "enabled": true,
        "exposure": 1.3,
        "saturation": 1.2,
        "temperature": 10
      },
      "vignette": {
        "enabled": true,
        "darkness": 0.3
      }
    }
  }
}
```

### Dark/Moody Look

```json
{
  "postProcessing": {
    "enabled": true,
    "effects": {
      "colorGrading": {
        "enabled": true,
        "exposure": 0.8,
        "contrast": 1.3,
        "saturation": 0.9,
        "temperature": -10
      },
      "vignette": {
        "enabled": true,
        "darkness": 0.7,
        "offset": 0.3
      },
      "filmGrain": {
        "enabled": true,
        "intensity": 0.08
      }
    }
  }
}
```

## Performance Tips

### For High-End Hardware

- Use "cinematic" preset
- Enable all post-processing effects
- Increase particle counts
- Use high-resolution shadows (4096)
- Enable depth of field and bloom

### For Mid-Range Hardware

- Use "balanced" preset
- Enable essential effects only (bloom, vignette)
- Moderate particle counts
- Use medium-resolution shadows (2048)
- Enable adaptive quality

### For Low-End Hardware

- Use "performance" preset
- Disable post-processing
- Minimize particle counts
- Use low-resolution shadows (1024)
- Reduce geometry detail
- Enable adaptive quality with 60 FPS target

## Troubleshooting

### Low Frame Rate

1. Switch to lower quality preset
2. Enable adaptive quality
3. Reduce particle counts
4. Disable expensive effects (DOF, bloom)

### Effects Not Working

1. Check browser console for warnings
2. Verify WebGL 2.0 support
3. Update graphics drivers
4. Try different browser

### Visual Artifacts

1. Reduce shadow quality
2. Disable chromatic aberration
3. Lower geometry detail
4. Check WebGL errors

## Further Reading

- [Cinematic Features Documentation](../CINEMATIC_FEATURES.md)
- [Dream Schema Reference](../../docs/dream-schema.json)
- [Quality Presets Guide](../../docs/quality-presets.md)
