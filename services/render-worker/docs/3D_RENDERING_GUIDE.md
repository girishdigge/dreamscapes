# 3D Rendering Usage Guide

## Overview

The Enhanced 3D Renderer transforms JSON dream data into cinematic 3D visualizations using Three.js and WebGL. This guide covers the complete dream JSON schema, structure types, animations, cinematography, and performance tuning.

## Quick Start

To render a scene in 3D, set `renderMode: "3d"` in your dream JSON:

```json
{
  "title": "My 3D Dream",
  "renderMode": "3d",
  "environment": {
    "preset": "space"
  },
  "structures": [
    {
      "id": "star1",
      "type": "star",
      "pos": [0, 0, 0],
      "scale": 5
    }
  ]
}
```

## Dream JSON Schema

### Root Properties

```json
{
  "title": "Dream Title",
  "renderMode": "3d",
  "style": "ethereal|cyberpunk|surreal|fantasy|nightmare",
  "environment": {
    /* Environment configuration */
  },
  "structures": [
    /* 3D objects */
  ],
  "entities": [
    /* Particle systems */
  ],
  "cinematography": {
    /* Camera shots */
  }
}
```

## Environment Configuration

The environment defines the overall atmosphere, lighting, and skybox.

### Environment Schema

```json
{
  "environment": {
    "preset": "space|underwater|forest|desert|city|dusk|dawn|night|void",
    "skybox": "galaxy|nebula|sunset|underwater|void",
    "lighting": {
      "ambient": 0.4,
      "directional": {
        "intensity": 1.0,
        "position": [100, 100, 50],
        "color": "#ffffff"
      }
    },
    "fog": 0.5,
    "skyColor": "#404040"
  }
}
```

### Environment Presets

| Preset       | Skybox     | Ambient Light | Fog  | Description               |
| ------------ | ---------- | ------------- | ---- | ------------------------- |
| `space`      | galaxy     | 0.2           | none | Deep space with stars     |
| `underwater` | underwater | 0.3           | 0.6  | Blue-tinted with caustics |
| `sunset`     | sunset     | 0.5           | 0.3  | Orange-pink gradient      |
| `forest`     | void       | 0.4           | 0.4  | Green-tinted natural      |
| `void`       | void       | 0.1           | none | Dark empty space          |

### Skybox Types

- **galaxy**: Spiral galaxy with stars and nebula clouds
- **nebula**: Volumetric nebula formations
- **sunset**: Gradient sky with sun
- **underwater**: Blue water with light rays
- **void**: Deep space with distant stars

## Structure Types

Structures are 3D objects in your scene. The renderer supports 50+ types.

### Structure Schema

```json
{
  "id": "unique_id",
  "type": "structure_type",
  "pos": [x, y, z],
  "scale": 1.0,
  "rotation": [rx, ry, rz],
  "features": ["glowing_edges", "emissive", "particle_trail", "animated"],
  "material": {
    "color": "#ffffff",
    "opacity": 0.8,
    "metalness": 0.5,
    "roughness": 0.2,
    "emissiveIntensity": 0.5
  },
  "animation": {
    "type": "orbit|float|pulse|rotate",
    "speed": 1.0,
    "amplitude": 2.0,
    "axis": "x|y|z"
  }
}
```

### Celestial Objects

#### Star

```json
{
  "type": "star",
  "scale": 5,
  "material": {
    "color": "#ffff00",
    "emissiveIntensity": 1.0
  }
}
```

Creates a glowing sphere with corona effects and point light.

#### Planet

```json
{
  "type": "planet",
  "scale": 10,
  "material": {
    "color": "#4488ff"
  }
}
```

Creates a textured sphere with atmospheric glow.

#### Galaxy

```json
{
  "type": "galaxy",
  "scale": 50,
  "material": {
    "color": "#8844ff"
  }
}
```

Creates a spiral particle system with thousands of stars.

#### Nebula

```json
{
  "type": "nebula",
  "scale": 30,
  "material": {
    "color": "#ff44ff",
    "opacity": 0.6
  }
}
```

Creates volumetric cloud formations.

### Natural Elements

#### Water/Ocean

```json
{
  "type": "water",
  "scale": 50,
  "material": {
    "color": "#0088ff",
    "opacity": 0.7
  }
}
```

Creates animated water surface with wave effects.

#### Fire

```json
{
  "type": "fire",
  "scale": 5,
  "material": {
    "color": "#ff4400"
  }
}
```

Creates particle-based flame effects.

#### Cloud

```json
{
  "type": "cloud",
  "scale": 20,
  "material": {
    "color": "#ffffff",
    "opacity": 0.8
  }
}
```

Creates volumetric cloud formations.

#### Mountain

```json
{
  "type": "mountain",
  "scale": 30,
  "material": {
    "color": "#886644"
  }
}
```

Creates cone-based terrain structure.

### Living Beings

#### Horse

```json
{
  "type": "horse",
  "scale": 5,
  "material": {
    "color": "#8B4513"
  }
}
```

Simplified geometric horse with body, head, legs, and tail.

#### Bird

```json
{
  "type": "bird",
  "scale": 2,
  "material": {
    "color": "#4488ff"
  }
}
```

Basic bird with body and wing geometry.

#### Fish

```json
{
  "type": "fish",
  "scale": 3,
  "material": {
    "color": "#ff8844"
  }
}
```

Streamlined fish body shape.

#### Human

```json
{
  "type": "human",
  "scale": 6,
  "material": {
    "color": "#ffccaa"
  }
}
```

Simplified humanoid figure.

### Architectural Structures

#### Tower

```json
{
  "type": "tower",
  "scale": 20,
  "material": {
    "color": "#888888",
    "metalness": 0.8
  }
}
```

Cylindrical tower with spire.

#### Bridge

```json
{
  "type": "bridge",
  "scale": 30,
  "material": {
    "color": "#666666"
  }
}
```

Spanning bridge structure.

#### Crystal

```json
{
  "type": "crystal",
  "scale": 10,
  "material": {
    "color": "#88ffff",
    "opacity": 0.6,
    "metalness": 0.9
  }
}
```

Transparent geometric crystal form.

### Material Properties

| Property            | Type   | Range     | Description                           |
| ------------------- | ------ | --------- | ------------------------------------- |
| `color`             | string | hex color | Base color of the object              |
| `opacity`           | number | 0.0-1.0   | Transparency (0=invisible, 1=opaque)  |
| `metalness`         | number | 0.0-1.0   | How metallic the surface is           |
| `roughness`         | number | 0.0-1.0   | Surface roughness (0=mirror, 1=matte) |
| `emissiveIntensity` | number | 0.0-2.0   | Glow intensity                        |

### Visual Features

Add special effects to structures using the `features` array:

```json
{
  "features": ["glowing_edges", "emissive", "particle_trail", "animated"]
}
```

- **glowing_edges**: Adds rim lighting effect
- **emissive**: Makes object emit light
- **particle_trail**: Leaves particle trail when moving
- **animated**: Adds automatic rotation/pulse

## Animation System

Animate structures over time with various motion types.

### Animation Schema

```json
{
  "animation": {
    "type": "orbit|float|pulse|rotate",
    "speed": 1.0,
    "amplitude": 2.0,
    "axis": "x|y|z"
  }
}
```

### Animation Types

#### Orbit

```json
{
  "animation": {
    "type": "orbit",
    "speed": 0.5,
    "amplitude": 20
  }
}
```

Rotates around a center point in a circular path.

#### Float

```json
{
  "animation": {
    "type": "float",
    "speed": 1.0,
    "amplitude": 5
  }
}
```

Moves up and down with sine wave motion.

#### Pulse

```json
{
  "animation": {
    "type": "pulse",
    "speed": 2.0,
    "amplitude": 0.3
  }
}
```

Scales in and out rhythmically.

#### Rotate

```json
{
  "animation": {
    "type": "rotate",
    "speed": 1.0,
    "axis": "y"
  }
}
```

Spins around its own axis.

### Animation Parameters

- **speed**: Multiplier for animation rate (default: 1.0)
- **amplitude**: Scale of movement/rotation (default: 1.0)
- **axis**: Rotation axis for rotate animation (x, y, or z)

## Particle Systems (Entities)

Entities are dynamic particle effects.

### Entity Schema

```json
{
  "id": "unique_id",
  "type": "particle_stream|floating_orbs|light_butterflies",
  "count": 100,
  "params": {
    "speed": 2.0,
    "size": 1.0,
    "color": "#00ffff",
    "glow": 0.6,
    "behavior": "swarm|flow|explode|orbit"
  }
}
```

### Entity Types

#### Particle Stream

```json
{
  "type": "particle_stream",
  "count": 500,
  "params": {
    "speed": 3.0,
    "color": "#00ffff",
    "glow": 0.8
  }
}
```

Flowing particles with velocity-based movement.

#### Floating Orbs

```json
{
  "type": "floating_orbs",
  "count": 50,
  "params": {
    "size": 2.0,
    "color": "#ffff00",
    "glow": 1.0
  }
}
```

Glowing spheres with floating animation.

#### Light Butterflies

```json
{
  "type": "light_butterflies",
  "count": 100,
  "params": {
    "speed": 1.5,
    "color": "#ff88ff",
    "behavior": "swarm"
  }
}
```

Animated particles with flocking behavior.

## Cinematography

Control camera movement with sophisticated shot types.

### Cinematography Schema

```json
{
  "cinematography": {
    "durationSec": 30,
    "shots": [
      {
        "type": "orbital|flythrough|establish|close_up|pull_back",
        "startTime": 0,
        "duration": 10,
        "target": "structure_id",
        "distance": 50,
        "speed": 1.0,
        "easing": "linear|ease_in|ease_out|ease_in_out"
      }
    ]
  }
}
```

### Shot Types

#### Orbital

```json
{
  "type": "orbital",
  "startTime": 0,
  "duration": 10,
  "target": "star1",
  "distance": 50,
  "speed": 1.0
}
```

Camera circles around the target.

#### Flythrough

```json
{
  "type": "flythrough",
  "startTime": 10,
  "duration": 8,
  "path": [
    [0, 0, 100],
    [50, 20, 50],
    [100, 0, 0]
  ],
  "speed": 1.0
}
```

Camera moves along a defined path.

#### Establish

```json
{
  "type": "establish",
  "startTime": 18,
  "duration": 5,
  "position": [0, 50, 100],
  "target": [0, 0, 0]
}
```

Static wide view of the scene.

#### Close-up

```json
{
  "type": "close_up",
  "startTime": 23,
  "duration": 4,
  "target": "crystal1",
  "distance": 10
}
```

Focuses tightly on a specific object.

#### Pull-back

```json
{
  "type": "pull_back",
  "startTime": 27,
  "duration": 3,
  "target": [0, 0, 0],
  "startDistance": 10,
  "endDistance": 100
}
```

Zooms out to reveal the full scene.

### Camera Targeting

The `target` parameter can be:

- **Structure ID**: `"star1"` - Camera looks at that structure
- **Coordinates**: `[x, y, z]` - Camera looks at that point

## Quality Levels

Configure rendering quality to balance visual fidelity and performance.

### Quality Settings

Add to your dream JSON:

```json
{
  "quality": "draft|medium|high"
}
```

### Quality Comparison

| Feature         | Draft               | Medium         | High                      |
| --------------- | ------------------- | -------------- | ------------------------- |
| Geometry Detail | Low (8-16 segments) | Medium (16-32) | High (32-64)              |
| Materials       | Basic Lambert       | PBR            | Full PBR + Effects        |
| Max Particles   | 1,000               | 5,000          | 10,000                    |
| Shadows         | Disabled            | Enabled        | High-res                  |
| Post-processing | None                | Basic bloom    | Bloom + DOF + Motion blur |
| Target FPS      | 30                  | 30             | 60                        |
| Resolution      | 1280x720            | 1920x1080      | 2560x1440+                |

### Performance Tuning

#### Reduce Object Count

```json
{
  "structures": [
    // Keep under 1000 objects for best performance
  ]
}
```

#### Limit Particle Count

```json
{
  "entities": [
    {
      "type": "particle_stream",
      "count": 500 // Lower for better performance
    }
  ]
}
```

#### Simplify Materials

```json
{
  "material": {
    "metalness": 0, // Disable expensive effects
    "roughness": 1
  }
}
```

#### Disable Features

```json
{
  "features": [] // Remove expensive visual features
}
```

## Complete Example

Here's a complete dream JSON showcasing multiple features:

```json
{
  "title": "Cosmic Journey",
  "renderMode": "3d",
  "style": "ethereal",
  "quality": "medium",

  "environment": {
    "preset": "space",
    "skybox": "galaxy",
    "lighting": {
      "ambient": 0.3,
      "directional": {
        "intensity": 0.8,
        "position": [100, 100, 50],
        "color": "#ffffff"
      }
    },
    "fog": 0.2
  },

  "structures": [
    {
      "id": "sun",
      "type": "star",
      "pos": [0, 0, 0],
      "scale": 10,
      "material": {
        "color": "#ffff00",
        "emissiveIntensity": 1.5
      },
      "features": ["emissive"]
    },
    {
      "id": "planet1",
      "type": "planet",
      "pos": [50, 0, 0],
      "scale": 5,
      "material": {
        "color": "#4488ff"
      },
      "animation": {
        "type": "orbit",
        "speed": 0.5,
        "amplitude": 50
      }
    },
    {
      "id": "crystal",
      "type": "crystal",
      "pos": [0, 20, 30],
      "scale": 8,
      "material": {
        "color": "#88ffff",
        "opacity": 0.7,
        "metalness": 0.9
      },
      "animation": {
        "type": "rotate",
        "speed": 0.3,
        "axis": "y"
      },
      "features": ["glowing_edges"]
    }
  ],

  "entities": [
    {
      "id": "stars",
      "type": "particle_stream",
      "count": 1000,
      "params": {
        "speed": 2.0,
        "color": "#ffffff",
        "glow": 0.5
      }
    }
  ],

  "cinematography": {
    "durationSec": 20,
    "shots": [
      {
        "type": "establish",
        "startTime": 0,
        "duration": 5,
        "position": [0, 50, 150],
        "target": [0, 0, 0]
      },
      {
        "type": "orbital",
        "startTime": 5,
        "duration": 10,
        "target": "sun",
        "distance": 80,
        "speed": 0.5
      },
      {
        "type": "close_up",
        "startTime": 15,
        "duration": 5,
        "target": "crystal",
        "distance": 15
      }
    ]
  }
}
```

## Troubleshooting

### Low Frame Rate

- Reduce object count
- Lower particle counts
- Use "draft" quality
- Disable shadows and post-processing

### Objects Not Appearing

- Check `pos` coordinates are within view
- Verify `scale` is appropriate
- Ensure `opacity` is not 0

### Animation Not Working

- Verify `animation.type` is valid
- Check `speed` and `amplitude` values
- Ensure time is progressing in cinematography

### Camera Issues

- Verify `target` references valid structure ID
- Check camera `distance` is appropriate
- Ensure shot times don't overlap

## API Reference

### Puppeteer Integration

```javascript
// Initialize scene
await page.evaluate(
  (dreamJSON, width, height) => {
    window.initWithDream(dreamJSON, width, height);
  },
  dream,
  1920,
  1080
);

// Render at specific time
await page.evaluate((time) => {
  window.seek(time);
}, 5.0);

// Capture frame
await page.screenshot({
  path: 'frame.png',
  clip: { x: 0, y: 0, width: 1920, height: 1080 },
});
```

## Best Practices

1. **Start Simple**: Begin with few objects and add complexity gradually
2. **Test Performance**: Monitor FPS and adjust quality accordingly
3. **Use Presets**: Environment presets provide good starting points
4. **Limit Particles**: Keep particle counts under 5000 for best performance
5. **Cache Geometries**: Reuse structure types for better performance
6. **Plan Cinematography**: Sketch camera movements before implementing
7. **Validate JSON**: Ensure JSON is valid before rendering

## Next Steps

- See [Example Dreams](./EXAMPLE_DREAMS.md) for complete scene examples
- Read [Developer Guide](./DEVELOPER_GUIDE.md) to extend the renderer
- Check [API Reference](./API_REFERENCE.md) for detailed technical docs
