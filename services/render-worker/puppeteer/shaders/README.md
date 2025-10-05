# GLSL Shaders

This directory contains custom GLSL shaders for advanced visual effects in the 3D renderer.

## Shader Files

### Galaxy Skybox

- **galaxy.vert** - Vertex shader for galaxy skybox
- **galaxy.frag** - Fragment shader creating spiral galaxy with stars

Creates a procedural galaxy skybox with:

- Spiral arm patterns
- Star field generation
- Nebula color gradients (purple/blue)
- Time-based animation

### Nebula Skybox

- **nebula.vert** - Vertex shader for nebula skybox
- **nebula.frag** - Fragment shader creating volumetric nebula clouds

Creates a procedural nebula skybox with:

- Multi-octave noise for volumetric appearance
- Color gradients (pink → purple → blue)
- Time-based cloud movement
- Brightness variation

### Water Surface

- **water.vert** - Vertex shader with wave displacement
- **water.frag** - Fragment shader for water appearance

Creates realistic water with:

- Animated wave displacement
- Fresnel effect (reflectivity at grazing angles)
- Shimmer and highlights
- Configurable water color

## Usage

Shaders are loaded by the MaterialSystem and compiled into ShaderMaterial:

```javascript
const material = new THREE.ShaderMaterial({
  vertexShader: galaxyVertexShader,
  fragmentShader: galaxyFragmentShader,
  uniforms: {
    time: { value: 0.0 },
  },
});
```

## Shader Uniforms

Common uniforms used across shaders:

- `time` - Current time in seconds (for animation)
- `waterColor` - Base color for water (vec3)

## Future Shaders

Additional shaders to be added:

- Fire particle shader
- Crystal refraction shader
- Atmospheric scattering shader
- Post-processing shaders (bloom, DOF, motion blur)

## GLSL Version

All shaders use GLSL ES 1.0 (WebGL 1.0 compatible) for maximum browser compatibility.
