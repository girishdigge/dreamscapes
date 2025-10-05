# 3D Renderer Documentation

Welcome to the Enhanced 3D Renderer documentation. This system transforms JSON dream data into cinematic 3D visualizations using Three.js and WebGL.

## Documentation Overview

### For Users

**[3D Rendering Guide](./3D_RENDERING_GUIDE.md)** - Complete usage documentation

- Dream JSON schema reference
- All structure types with examples
- Animation system guide
- Cinematography and camera control
- Material properties and visual effects
- Environment configuration
- Quality levels and performance tuning
- Troubleshooting and best practices

**[Example Dreams](./examples/README.md)** - Ready-to-use example scenes

- Simple scene (learning basics)
- Complex scene (production-quality)
- Showcase of all structure types
- Cinematography demonstration
- Usage instructions and tips

### For Developers

**[Developer Guide](./DEVELOPER_GUIDE.md)** - Extending the renderer

- Architecture overview
- Adding new structure types
- Adding new animation types
- Adding new camera shot types
- Creating custom materials and shaders
- Adding particle system types
- Testing and debugging
- Best practices and patterns

## Quick Start

### Rendering Your First 3D Scene

1. Create a dream JSON file with `renderMode: "3d"`:

```json
{
  "title": "My First 3D Scene",
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
  ],
  "cinematography": {
    "durationSec": 10,
    "shots": [
      {
        "type": "orbital",
        "startTime": 0,
        "duration": 10,
        "target": "star1",
        "distance": 30
      }
    ]
  }
}
```

2. Send to the render service API
3. Wait for video generation
4. Download your rendered video

### Learning Path

1. **Start Here**: Read the [3D Rendering Guide](./3D_RENDERING_GUIDE.md) introduction
2. **Try Examples**: Test the [simple scene example](./examples/simple_scene.json)
3. **Explore Features**: Review the [showcase example](./examples/showcase_all_types.json)
4. **Master Camera**: Study the [cinematography demo](./examples/cinematography_demo.json)
5. **Extend**: Read the [Developer Guide](./DEVELOPER_GUIDE.md) to add features

## Key Features

### 50+ Structure Types

- **Celestial**: stars, planets, galaxies, nebulae
- **Natural**: water, mountains, fire, clouds
- **Living**: horses, birds, fish, humans
- **Architectural**: towers, bridges, crystals
- **And many more...**

### Animation System

- **Orbit**: Circular motion around points
- **Float**: Sine wave vertical movement
- **Pulse**: Rhythmic scaling
- **Rotate**: Spinning around axis
- **Extensible**: Add custom animations

### Cinematography

- **Orbital**: Circle around targets
- **Flythrough**: Move along paths
- **Establish**: Static wide views
- **Close-up**: Focus on objects
- **Pull-back**: Zoom out reveals
- **Smooth Transitions**: Easing functions

### Advanced Materials

- **PBR**: Physically-based rendering
- **Transparency**: Glass and crystal effects
- **Emissive**: Glowing materials
- **Custom Shaders**: GLSL support
- **Skyboxes**: Galaxy, nebula, sunset, underwater

### Particle Systems

- **Particle Streams**: Flowing effects
- **Floating Orbs**: Glowing spheres
- **Light Butterflies**: Flocking behavior
- **Custom Systems**: Create your own

### Performance

- **Quality Levels**: Draft, medium, high
- **Geometry Caching**: Reuse common shapes
- **Instanced Rendering**: Efficient duplicates
- **Frustum Culling**: Skip off-screen objects
- **LOD Support**: Distance-based detail

## Architecture

```
SceneRenderer (Core Engine)
├── AssetLibrary (Procedural Generation)
│   ├── 50+ structure type generators
│   └── Geometry caching system
├── MaterialSystem (Visual Quality)
│   ├── PBR materials
│   ├── Custom GLSL shaders
│   └── Skybox generation
├── AnimationController (Motion)
│   ├── Transform animations
│   └── Particle updates
└── CameraController (Cinematography)
    ├── Shot types
    └── Smooth transitions
```

## File Structure

```
services/render-worker/
├── docs/
│   ├── README.md                    # This file
│   ├── 3D_RENDERING_GUIDE.md       # User documentation
│   ├── DEVELOPER_GUIDE.md          # Developer documentation
│   └── examples/
│       ├── README.md               # Example documentation
│       ├── simple_scene.json       # Basic example
│       ├── complex_scene.json      # Advanced example
│       ├── showcase_all_types.json # All structure types
│       └── cinematography_demo.json # Camera showcase
├── puppeteer/
│   ├── templates/
│   │   └── render_template_3d.html # 3D rendering template
│   ├── engine/
│   │   ├── SceneRenderer.js        # Core engine
│   │   ├── AssetLibrary.js         # Structure generators
│   │   ├── MaterialSystem.js       # Materials & shaders
│   │   ├── AnimationController.js  # Animation system
│   │   └── CameraController.js     # Camera control
│   └── shaders/
│       └── *.vert, *.frag          # GLSL shaders
└── package.json                     # Dependencies (three.js)
```

## Examples

### Simple Solar System

```json
{
  "renderMode": "3d",
  "environment": { "preset": "space" },
  "structures": [
    {
      "id": "sun",
      "type": "star",
      "pos": [0, 0, 0],
      "scale": 8,
      "features": ["emissive"]
    },
    {
      "id": "planet",
      "type": "planet",
      "pos": [30, 0, 0],
      "scale": 4,
      "animation": {
        "type": "orbit",
        "amplitude": 30
      }
    }
  ]
}
```

### Underwater Scene

```json
{
  "renderMode": "3d",
  "environment": {
    "preset": "underwater",
    "fog": 0.5
  },
  "structures": [
    {
      "type": "crystal",
      "pos": [0, 10, 0],
      "scale": 10,
      "material": {
        "opacity": 0.7,
        "metalness": 0.9
      },
      "animation": { "type": "rotate" },
      "features": ["glowing_edges"]
    }
  ],
  "entities": [
    {
      "type": "floating_orbs",
      "count": 100,
      "params": { "color": "#88ffff" }
    }
  ]
}
```

## Performance Guidelines

### Recommended Limits

| Quality | Structures | Particles | Target FPS | Resolution |
| ------- | ---------- | --------- | ---------- | ---------- |
| Draft   | < 500      | < 1,000   | 30         | 1280x720   |
| Medium  | < 1,000    | < 5,000   | 30         | 1920x1080  |
| High    | < 1,000    | < 10,000  | 60         | 2560x1440+ |

### Optimization Tips

1. **Reduce Object Count**: Keep structures under 1000
2. **Limit Particles**: Stay under 5000 for best performance
3. **Use Caching**: Reuse structure types
4. **Simplify Materials**: Disable expensive effects if needed
5. **Lower Quality**: Use "draft" for previews

## Common Use Cases

### Product Visualization

- Use high quality settings
- Focus on close-up shots
- Enable all material effects
- Use establish and orbital shots

### Abstract Art

- Mix multiple structure types
- Use particle systems heavily
- Experiment with animations
- Try different environments

### Architectural Previews

- Use tower and bridge structures
- Enable shadows and fog
- Use flythrough shots
- Focus on lighting

### Space Scenes

- Use celestial objects
- Space environment preset
- Orbital and establish shots
- Particle effects for stars

## Troubleshooting

### Scene Not Rendering

- Verify `renderMode: "3d"` is set
- Check JSON syntax is valid
- Ensure structure IDs are unique
- Verify required fields are present

### Low Performance

- Reduce particle counts
- Lower quality to "draft"
- Reduce number of structures
- Disable shadows and post-processing

### Objects Not Visible

- Check position coordinates
- Verify scale is appropriate
- Ensure camera can see objects
- Check opacity is not 0

### Animation Issues

- Verify animation type is valid
- Check speed and amplitude values
- Ensure time is progressing
- Test with simple animations first

## API Integration

### Puppeteer Interface

```javascript
// Load template
await page.goto('file://render_template_3d.html');

// Initialize scene
await page.evaluate(
  (dream, width, height) => {
    window.initWithDream(dream, width, height);
  },
  dreamJSON,
  1920,
  1080
);

// Render frame at specific time
await page.evaluate((time) => {
  window.seek(time);
}, 5.0);

// Capture screenshot
await page.screenshot({ path: 'frame.png' });
```

### REST API

```bash
# Submit render job
curl -X POST http://localhost:3002/render \
  -H "Content-Type: application/json" \
  -d @dream.json

# Check status
curl http://localhost:3002/status/{jobId}

# Download video
curl http://localhost:3002/download/{jobId} -o video.mp4
```

## Version History

### v1.0.0 (Current)

- Initial release
- 50+ structure types
- 4 animation types
- 5 camera shot types
- 5 skybox types
- Particle systems
- PBR materials
- Performance optimizations

## Contributing

Contributions are welcome! Please:

1. Read the [Developer Guide](./DEVELOPER_GUIDE.md)
2. Follow existing code style
3. Add tests for new features
4. Update documentation
5. Submit pull request

## Support

- **Documentation**: Start with this README
- **Examples**: Check [examples directory](./examples/)
- **Issues**: Open GitHub issue with reproduction steps
- **Questions**: See [3D Rendering Guide](./3D_RENDERING_GUIDE.md) FAQ

## License

This documentation and the 3D renderer are part of the Dreamscapes project.

## Additional Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [GLSL Reference](https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language)
- [Puppeteer Documentation](https://pptr.dev/)

---

**Ready to create stunning 3D visualizations?** Start with the [3D Rendering Guide](./3D_RENDERING_GUIDE.md) or try an [example scene](./examples/simple_scene.json)!
