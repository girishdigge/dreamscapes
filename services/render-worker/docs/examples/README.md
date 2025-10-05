# 3D Rendering Example Dreams

This directory contains example dream JSON files demonstrating various features of the 3D renderer.

## Examples Overview

### 1. Simple Scene (`simple_scene.json`)

**Purpose**: Introduction to basic 3D rendering

**Features**:

- Basic solar system with sun and two planets
- Simple orbital animations
- Two camera shots (establish and orbital)
- Minimal complexity for quick rendering

**Duration**: 15 seconds

**Use Case**: Learning the basics, testing setup, quick previews

**Key Concepts**:

- Environment setup with space preset
- Basic structure creation (star, planet)
- Simple orbit animation
- Basic cinematography

---

### 2. Complex Scene (`complex_scene.json`)

**Purpose**: Showcase advanced features and complex compositions

**Features**:

- Underwater city environment with multiple towers
- Bridges connecting structures
- Multiple animated crystals with different effects
- Swimming fish with orbital animations
- Three types of particle systems (bubbles, light particles, butterflies)
- Five different camera shots including flythrough
- Fog and atmospheric effects

**Duration**: 30 seconds

**Use Case**: Production-quality renders, testing performance, learning advanced techniques

**Key Concepts**:

- Complex environment with fog
- Multiple structure types working together
- Combining animations (rotate, pulse, orbit)
- Visual features (glowing edges, emissive)
- Advanced cinematography with flythrough paths
- Multiple particle systems
- Material properties (metalness, opacity)

---

### 3. Showcase All Types (`showcase_all_types.json`)

**Purpose**: Demonstrate all available structure types in one scene

**Features**:

- Celestial objects: star, planet, galaxy, nebula
- Natural elements: water, mountains, fire, clouds
- Living beings: horse, bird, fish, human
- Architectural: tower, bridge, crystals
- Multiple animation types
- Three particle system types
- Long orbital camera shot to view everything

**Duration**: 40 seconds

**Use Case**: Reference for structure types, testing all generators, visual catalog

**Key Concepts**:

- Complete structure type reference
- Different animation types on different objects
- Mixing organic and geometric forms
- Particle variety

**Structure Types Demonstrated**:

- `star` - Glowing sun with emissive properties
- `planet` - Rotating sphere
- `galaxy` - Spiral particle system
- `nebula` - Volumetric cloud formation
- `water` - Animated water surface
- `mountain` - Terrain structures
- `fire` - Particle-based flames
- `cloud` - Floating cloud formations
- `horse` - Simplified animal model
- `bird` - Flying creature with orbit animation
- `fish` - Swimming creature with float animation
- `human` - Humanoid figure
- `tower` - Vertical architecture
- `bridge` - Spanning structure
- `crystal` - Transparent geometric forms

---

### 4. Cinematography Demo (`cinematography_demo.json`)

**Purpose**: Showcase all camera shot types and smooth transitions

**Features**:

- Central crystal monument surrounded by four towers
- Connecting bridges forming a cross pattern
- Orbiting glowing orbs
- Flying birds
- Seven different camera shots demonstrating all shot types
- Smooth transitions with easing functions
- Particle effects throughout

**Duration**: 45 seconds

**Use Case**: Learning cinematography, planning camera movements, creating cinematic sequences

**Key Concepts**:

- All shot types: establish, orbital, flythrough, close-up, pull-back
- Shot timing and sequencing
- Easing functions for smooth transitions
- Camera targeting (structures and coordinates)
- Creating narrative flow with camera movement

**Shot Breakdown**:

1. **Establish** (0-6s): Wide view from above, ease in
2. **Orbital** (6-16s): Circle around center crystal
3. **Flythrough** (16-24s): Figure-8 path around the scene
4. **Close-up** (24-30s): Focus on center crystal
5. **Close-up** (30-34s): Focus on orbiting orb
6. **Close-up** (34-38s): Focus on north tower
7. **Pull-back** (38-45s): Zoom out reveal, ease out

---

## How to Use These Examples

### Testing an Example

1. Copy the JSON file content
2. Send it to the render service API
3. Wait for video generation
4. Review the output

### Modifying Examples

Feel free to modify these examples to learn:

- Change `pos` values to reposition objects
- Adjust `scale` to resize structures
- Modify `material.color` to change colors
- Tweak `animation.speed` and `animation.amplitude`
- Add or remove structures
- Change camera shot timings and types
- Adjust quality settings

### Performance Testing

Use these examples to test performance on your hardware:

- **Simple Scene**: Should run at 60 FPS on most hardware
- **Complex Scene**: Tests medium-high complexity (30-45 FPS target)
- **Showcase**: Tests many different structure types
- **Cinematography**: Tests camera movement performance

### Learning Path

Recommended order for learning:

1. Start with **Simple Scene** to understand basics
2. Study **Showcase All Types** to see what's available
3. Explore **Complex Scene** to learn composition
4. Master **Cinematography Demo** for camera control

---

## Creating Your Own Dreams

### Starting Template

```json
{
  "title": "My Dream",
  "renderMode": "3d",
  "quality": "medium",

  "environment": {
    "preset": "space"
  },

  "structures": [
    {
      "id": "obj1",
      "type": "star",
      "pos": [0, 0, 0],
      "scale": 5
    }
  ],

  "cinematography": {
    "durationSec": 10,
    "shots": [
      {
        "type": "orbital",
        "startTime": 0,
        "duration": 10,
        "target": "obj1",
        "distance": 30
      }
    ]
  }
}
```

### Tips for Creating Dreams

1. **Start Simple**: Begin with a few objects and add complexity gradually
2. **Test Frequently**: Render short clips to test before creating long sequences
3. **Plan Camera Movement**: Sketch out camera paths before implementing
4. **Balance Performance**: Keep object counts reasonable (< 1000 structures)
5. **Use Presets**: Environment presets provide good starting points
6. **Layer Effects**: Combine structures, animations, and particles for depth
7. **Time Your Shots**: Plan cinematography timing to match your narrative

### Common Patterns

**Orbital System**:

```json
{
  "structures": [
    { "id": "center", "type": "star", "pos": [0, 0, 0] },
    {
      "id": "orbiter",
      "type": "planet",
      "pos": [30, 0, 0],
      "animation": { "type": "orbit", "amplitude": 30 }
    }
  ]
}
```

**Floating Islands**:

```json
{
  "structures": [
    {
      "type": "mountain",
      "pos": [0, 0, 0],
      "animation": { "type": "float", "amplitude": 5 }
    }
  ]
}
```

**Glowing Crystals**:

```json
{
  "structures": [
    {
      "type": "crystal",
      "material": { "opacity": 0.7, "metalness": 0.9 },
      "animation": { "type": "rotate", "axis": "y" },
      "features": ["glowing_edges", "emissive"]
    }
  ]
}
```

---

## Troubleshooting Examples

### Example Won't Render

- Check JSON syntax is valid
- Verify `renderMode: "3d"` is set
- Ensure all required fields are present
- Check structure IDs are unique

### Low Performance

- Reduce particle counts
- Lower quality setting to "draft"
- Reduce number of structures
- Simplify animations

### Objects Not Visible

- Check `pos` coordinates are reasonable
- Verify `scale` is appropriate
- Ensure camera can see the objects
- Check `opacity` is not 0

### Camera Issues

- Verify `target` references valid structure ID
- Check `distance` is appropriate for scale
- Ensure shot times don't overlap
- Verify total duration matches last shot end time

---

## Additional Resources

- [3D Rendering Guide](../3D_RENDERING_GUIDE.md) - Complete usage documentation
- [Developer Guide](../DEVELOPER_GUIDE.md) - Extending the renderer
- [API Reference](../API_REFERENCE.md) - Technical details

---

## Contributing Examples

If you create interesting dream scenes, consider contributing them:

1. Ensure JSON is valid and well-formatted
2. Test the example renders correctly
3. Add comments explaining unique features
4. Document any special requirements
5. Submit via pull request

---

## Example Statistics

| Example             | Structures | Entities | Particles | Duration | Complexity  |
| ------------------- | ---------- | -------- | --------- | -------- | ----------- |
| Simple Scene        | 3          | 0        | 0         | 15s      | Low         |
| Complex Scene       | 11         | 3        | 750       | 30s      | High        |
| Showcase All Types  | 18         | 3        | 1180      | 40s      | Medium-High |
| Cinematography Demo | 12         | 2        | 950       | 45s      | Medium      |

---

## License

These examples are provided as reference material for the 3D renderer. Feel free to use, modify, and build upon them for your own projects.
