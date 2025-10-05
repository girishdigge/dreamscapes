# Environmental System Quick Reference

## Skybox Types

### Galaxy

```json
{ "environment": { "skybox": "galaxy" } }
```

- Spiral arms with stars
- Purple/blue nebula clouds
- Animated shader effects
- Best for: Space scenes, cosmic environments

### Nebula

```json
{ "environment": { "skybox": "nebula" } }
```

- Volumetric cloud formations
- Pink to purple to blue gradient
- Multi-octave noise
- Best for: Dreamy space scenes, ethereal environments

### Sunset

```json
{ "environment": { "skybox": "sunset" } }
```

- Orange-pink horizon gradient
- Visible sun with glow
- Dark blue sky
- Best for: Dusk/dawn scenes, warm atmospheres

### Underwater

```json
{ "environment": { "skybox": "underwater" } }
```

- Blue-green gradient
- Animated caustics (light patterns)
- Floating bubbles
- Best for: Ocean scenes, underwater environments

### Void

```json
{ "environment": { "skybox": "void" } }
```

- Deep space darkness
- Dense star field (multiple layers)
- Distant nebula hints
- Best for: Night scenes, minimal environments

## Environment Presets

Quick presets that automatically configure skybox and lighting:

| Preset       | Skybox     | Use Case                   |
| ------------ | ---------- | -------------------------- |
| `space`      | galaxy     | Outer space, cosmic scenes |
| `underwater` | underwater | Ocean, underwater scenes   |
| `forest`     | void       | Forest, nature scenes      |
| `desert`     | sunset     | Desert, arid landscapes    |
| `city`       | void       | Urban, city scenes         |
| `dusk`       | sunset     | Evening, twilight          |
| `dawn`       | sunset     | Morning, sunrise           |
| `night`      | void       | Night, dark scenes         |
| `void`       | void       | Minimal, abstract          |

## Lighting Configuration

### Ambient Light

```json
{
  "environment": {
    "lighting": {
      "ambient": 0.4 // 0.0 to 1.0
    }
  }
}
```

- Provides base illumination
- No shadows
- Affects all objects equally

### Directional Light

```json
{
  "environment": {
    "lighting": {
      "directional": {
        "intensity": 1.0, // 0.0 to 2.0+
        "position": [100, 100, 50], // [x, y, z]
        "color": "#ffffff" // Hex color
      }
    }
  }
}
```

- Sun-like lighting
- Casts shadows (if enabled)
- Parallel rays

### Shadow Quality by Quality Level

| Quality | Shadow Map Size | Performance  |
| ------- | --------------- | ------------ |
| Draft   | 1024x1024       | Fast         |
| Medium  | 2048x2048       | Balanced     |
| High    | 4096x4096       | Best quality |

## Fog Configuration

```json
{
  "environment": {
    "fog": 0.7, // 0.0 to 1.0 (density)
    "skyColor": "#334455" // Fog color (optional)
  }
}
```

### Fog Density Guide

| Density | Near Distance | Far Distance | Effect       |
| ------- | ------------- | ------------ | ------------ |
| 0.0     | N/A           | N/A          | No fog       |
| 0.3     | 38            | 850          | Light haze   |
| 0.5     | 30            | 750          | Moderate fog |
| 0.7     | 22            | 650          | Heavy fog    |
| 1.0     | 10            | 500          | Very dense   |

## Complete Examples

### Example 1: Ethereal Space Scene

```json
{
  "environment": {
    "skybox": "nebula",
    "fog": 0.2,
    "skyColor": "#1a0a2e",
    "lighting": {
      "ambient": 0.5,
      "directional": {
        "intensity": 0.8,
        "position": [100, 150, 100],
        "color": "#9966ff"
      }
    }
  }
}
```

### Example 2: Underwater Exploration

```json
{
  "environment": {
    "preset": "underwater",
    "fog": 0.6,
    "lighting": {
      "ambient": 0.6,
      "directional": {
        "intensity": 0.7,
        "position": [0, 100, 0],
        "color": "#4488ff"
      }
    }
  }
}
```

### Example 3: Desert Sunset

```json
{
  "environment": {
    "preset": "desert",
    "fog": 0.3,
    "lighting": {
      "ambient": 0.7,
      "directional": {
        "intensity": 1.5,
        "position": [100, 30, -80],
        "color": "#ffaa66"
      }
    }
  }
}
```

### Example 4: Mysterious Night

```json
{
  "environment": {
    "preset": "night",
    "fog": 0.8,
    "skyColor": "#0a0a15",
    "lighting": {
      "ambient": 0.2,
      "directional": {
        "intensity": 0.5,
        "position": [50, 100, 50],
        "color": "#6688cc"
      }
    }
  }
}
```

### Example 5: Bright Day Scene

```json
{
  "environment": {
    "skybox": "void",
    "skyColor": "#87ceeb",
    "fog": 0.1,
    "lighting": {
      "ambient": 0.8,
      "directional": {
        "intensity": 1.2,
        "position": [100, 100, 50],
        "color": "#ffffee"
      }
    }
  }
}
```

## Tips and Best Practices

### Lighting

- **Ambient + Directional**: Use both for realistic scenes
- **Ambient only**: For flat, stylized looks
- **Low ambient**: For dramatic, high-contrast scenes
- **High ambient**: For bright, cheerful scenes

### Fog

- **Match fog color to skybox**: Creates seamless blending
- **Low fog for clarity**: Use 0.1-0.3 for distant visibility
- **High fog for mystery**: Use 0.6-1.0 for close, mysterious feel
- **No fog for space**: Space scenes typically don't need fog

### Shadows

- **Enable for realism**: Adds depth and grounding
- **Disable for performance**: If frame rate is low
- **Adjust light position**: Position affects shadow direction
- **Use shadow bias**: Already configured to prevent artifacts

### Color Harmony

- **Warm scenes**: Orange/yellow lights (#ffaa66, #ffffee)
- **Cool scenes**: Blue/purple lights (#4488ff, #9966ff)
- **Neutral scenes**: White light (#ffffff)
- **Match environment**: Light color should complement skybox

## Default Values

If not specified, these defaults are used:

```json
{
  "environment": {
    "skybox": "void",
    "skyColor": "#000011",
    "fog": 0,
    "lighting": {
      "ambient": 0.4,
      "directional": {
        "intensity": 0.8,
        "position": [100, 100, 50],
        "color": "#ffffff"
      }
    }
  }
}
```

## Error Handling

The system gracefully handles:

- ✓ Missing environment config (uses defaults)
- ✓ Invalid skybox types (falls back to 'void')
- ✓ Invalid colors (falls back to white/default)
- ✓ Out-of-range values (clamps to valid range)
- ✓ Missing lighting config (creates default lights)

All errors are logged with warnings, but rendering continues.
