# Backend Integration Guide for 3D Renderer

Quick reference for backend developers generating dream JSON for the 3D renderer.

## Supported Structure Types

### Celestial Objects

- `star` - Glowing sphere with corona
- `planet` - Textured sphere with atmosphere
- `galaxy` - Spiral particle system
- `nebula` - Volumetric particle clouds

### Natural Elements

- `water`, `ocean`, `sea` - Animated water surface
- `fire` - Particle-based flames
- `cloud`, `clouds` - Volumetric cloud formations
- `mountain`, `mountains` - Cone-based terrain

### Living Beings

- `horse` - Simplified horse model
- `bird` - Basic bird with wings
- `fish` - Streamlined fish shape
- `human`, `person` - Humanoid figure

### Architectural

- `tower` - Vertical structure with spire
- `bridge` - Spanning structure with pillars
- `crystal` - Transparent geometric form

### Vehicles

- `ship`, `boat` - Sailing vessel with mast and sail

## Supported Entity Types

- `particle_stream` - Flowing particles with velocity
- `floating_orbs` - Glowing spheres that float
- `light_butterflies` - Animated fluttering particles
- `ship`, `boat` - Multiple ship instances (use for fleets)

## Supported Features

- `glowing_edges` - Rim lighting effect
- `emissive` - Object emits light
- `particle_trail` - Leaves trail of particles
- `particle_effects` - Combined trail + glow
- `rotating`, `animated` - Auto-rotation
- `pulsating` - Scale pulsing animation

## Structure vs Entity: When to Use What

### Use Structure When:

```json
{
  "structures": [
    {
      "id": "s1",
      "type": "ship",
      "pos": [0, 0, 0],
      "scale": 1.0
    }
  ]
}
```

- You need ONE object at a specific position
- Object should be static or have simple animation
- Precise placement is important

### Use Entity When:

```json
{
  "entities": [
    {
      "id": "e1",
      "type": "ship",
      "count": 27,
      "params": {
        "speed": 1.0,
        "size": 1.0,
        "color": "#ffffff"
      }
    }
  ]
}
```

- You need MULTIPLE instances
- Objects should be scattered/distributed
- Exact positions don't matter

## Common Patterns

### Single Large Object

```json
{
  "structures": [
    {
      "id": "s1",
      "type": "star",
      "pos": [0, 0, 0],
      "scale": 2.0,
      "features": ["emissive", "particle_effects"]
    }
  ]
}
```

### Multiple Small Objects

```json
{
  "entities": [
    {
      "id": "e1",
      "type": "floating_orbs",
      "count": 100,
      "params": {
        "speed": 1.0,
        "size": 0.5,
        "color": "#ffaa00",
        "glow": 0.8
      }
    }
  ]
}
```

### Ocean Scene with Ships

```json
{
  "structures": [
    {
      "id": "ocean",
      "type": "ocean",
      "pos": [0, 0, 0],
      "scale": 1.0,
      "features": ["glowing_edges"]
    }
  ],
  "entities": [
    {
      "id": "ships",
      "type": "ship",
      "count": 10,
      "params": {
        "speed": 0.5,
        "size": 1.0,
        "color": "#8b4513"
      }
    }
  ]
}
```

### Colliding Stars with Explosion

```json
{
  "structures": [
    {
      "id": "star1",
      "type": "star",
      "pos": [20, 0, 0],
      "scale": 1.5,
      "features": ["particle_effects"],
      "animation": {
        "type": "orbit",
        "speed": 1.0,
        "amplitude": 20
      }
    },
    {
      "id": "star2",
      "type": "star",
      "pos": [-20, 0, 0],
      "scale": 1.5,
      "features": ["particle_effects"],
      "animation": {
        "type": "orbit",
        "speed": 1.0,
        "amplitude": 20
      }
    }
  ],
  "entities": [
    {
      "id": "explosion",
      "type": "particle_stream",
      "count": 500,
      "params": {
        "speed": 2.0,
        "size": 1.5,
        "color": "#ff6600",
        "glow": 1.0
      }
    }
  ]
}
```

## Parameter Ranges

### Structure Parameters

- `pos`: `[x, y, z]` - Any numbers, typically -100 to 100
- `scale`: `0.01` to `1000` (clamped, default: 1.0)
- `rotation`: `[rx, ry, rz]` - Radians, any value

### Entity Parameters

- `count`: `1` to `10000` (limited by quality level)
- `speed`: `0.1` to `10` (clamped, default: 1.0)
- `size`: `0.1` to `10` (clamped, default: 1.0)
- `glow`: `0` to `1` (opacity/intensity)
- `color`: Hex string `#RRGGBB`

### Material Parameters

- `color`: Hex string `#RRGGBB`
- `opacity`: `0` to `1`
- `metalness`: `0` to `1`
- `roughness`: `0` to `1`
- `emissiveIntensity`: `0` to `2`

## Environment Presets

- `space` - Galaxy skybox with stars
- `underwater` - Blue-tinted with caustics
- `sunset` - Orange-pink gradient
- `forest` - Green-tinted ambient
- `dusk` - Twilight atmosphere
- `dawn` - Morning light
- `night` - Dark with stars
- `void` - Deep space

## Cinematography Shot Types

- `orbital` - Circle around target
- `flythrough` - Move along path
- `establish` - Static wide view
- `close_up` - Focus on object
- `pull_back` - Zoom out reveal

## Error Handling

The renderer handles errors gracefully:

### Unknown Structure Type

```json
{ "type": "unknown_thing" }
```

→ Creates generic box, logs warning

### Missing Parameters

```json
{ "type": "star" } // No pos, scale, etc.
```

→ Uses defaults: pos=[0,0,0], scale=1.0

### Invalid Colors

```json
{ "material": { "color": "not_a_color" } }
```

→ Defaults to white (#ffffff)

### Invalid Numbers

```json
{ "scale": "not_a_number" }
```

→ Defaults to 1.0, logs warning

## Best Practices

### 1. Always Specify renderMode

```json
{
  "renderMode": "3d",
  ...
}
```

### 2. Use Appropriate Types

- Ocean scenes → `ocean` structure + `ship` entities
- Space scenes → `star`, `planet`, `galaxy` structures
- Explosions → `particle_stream` entities with high count

### 3. Combine Features Wisely

```json
{
  "features": ["emissive", "particle_trail"] // ✓ Good
}
```

### 4. Set Reasonable Counts

- Particles: 100-1000 for most scenes
- Ships/Objects: 5-50 for good performance
- Stars in galaxy: 1000-5000

### 5. Use Cinematography

```json
{
  "cinematography": {
    "durationSec": 30,
    "shots": [
      {
        "type": "establish",
        "target": [0, 0, 0],
        "duration": 10
      },
      {
        "type": "close_up",
        "target": "s1",
        "duration": 20
      }
    ]
  }
}
```

## Validation Checklist

Before sending dream JSON to renderer:

- [ ] `renderMode` is set to `"3d"`
- [ ] All structure types are from supported list
- [ ] All entity types are from supported list
- [ ] All features are from supported list
- [ ] Colors are valid hex strings
- [ ] Numeric values are reasonable
- [ ] Entity counts are reasonable (< 1000)
- [ ] Cinematography targets exist

## Common Mistakes

### ❌ Wrong: Using unsupported type

```json
{ "type": "spaceship" } // Not supported
```

### ✓ Right: Use supported type

```json
{ "type": "ship" } // Supported
```

### ❌ Wrong: Invalid feature name

```json
{ "features": ["glowing"] } // Wrong name
```

### ✓ Right: Use correct feature name

```json
{ "features": ["glowing_edges"] } // Correct
```

### ❌ Wrong: Entity with single object

```json
{
  "entities": [
    { "type": "ship", "count": 1 } // Use structure instead
  ]
}
```

### ✓ Right: Structure for single object

```json
{
  "structures": [{ "type": "ship", "pos": [0, 0, 0] }]
}
```

## Testing

Test your dream JSON:

```bash
cd services/render-worker
node test-e2e-final.js
```

## Support

For questions or new type requests:

- Check `BACKEND_COMPATIBILITY_FIXES.md`
- Review `3D_RENDERING_GUIDE.md`
- Contact development team

---

**Last Updated:** 2025-10-05  
**Renderer Version:** 1.0.0
