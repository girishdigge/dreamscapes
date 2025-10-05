# 3D Rendering Engine

This directory contains the modular 3D rendering engine built on Three.js for the Enhanced 3D Renderer feature.

## Architecture

The engine is composed of five main modules:

### Core Modules

1. **SceneRenderer.js** - Main rendering engine

   - Initializes Three.js scene, camera, and renderer
   - Manages render loop and frame timing
   - Coordinates all subsystems
   - Implements Puppeteer integration interface

2. **AssetLibrary.js** - Procedural asset generation

   - Creates 50+ structure types (stars, planets, water, mountains, etc.)
   - Generates particle systems and entities
   - Manages geometry caching for performance

3. **MaterialSystem.js** - Advanced materials and shaders

   - Creates PBR materials with metalness, roughness, transmission
   - Implements custom GLSL shaders for skyboxes
   - Manages material and texture caching

4. **AnimationController.js** - Object animation

   - Handles orbit, float, pulse, rotate animations
   - Updates particle systems
   - Ensures deterministic time-based animations

5. **CameraController.js** - Cinematic camera control
   - Implements multiple shot types (orbital, flythrough, establish, close-up, pull-back)
   - Smoothly interpolates between camera positions
   - Manages shot timing and transitions

## Browser Compatibility

All modules are designed to work in browser environments:

- Each module exports itself to `window` object
- No Node.js-specific dependencies
- Compatible with Puppeteer's page.evaluate() context

## Usage

Modules are loaded in the HTML template via script tags:

```html
<script src="engine/SceneRenderer.js"></script>
<script src="engine/AssetLibrary.js"></script>
<script src="engine/MaterialSystem.js"></script>
<script src="engine/AnimationController.js"></script>
<script src="engine/CameraController.js"></script>
```

Then initialized:

```javascript
const renderer = new SceneRenderer(canvas, options);
renderer.initWithDream(dreamData, width, height);
renderer.seek(timeSec);
```

## Development Status

- ✅ Task 1: Project structure and dependencies set up
- ⏳ Task 2: Core SceneRenderer implementation (pending)
- ⏳ Task 3: AssetLibrary implementation (pending)
- ⏳ Task 4: MaterialSystem implementation (pending)
- ⏳ Task 5: AnimationController implementation (pending)
- ⏳ Task 6: CameraController implementation (pending)

## Dependencies

- Three.js ^0.160.0 (installed in parent package.json)
