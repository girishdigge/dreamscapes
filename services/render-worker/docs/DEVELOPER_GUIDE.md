# 3D Renderer Developer Guide

## Overview

This guide explains how to extend the 3D renderer by adding new structure types, animation types, camera shots, and other features. The renderer is designed with modularity and extensibility in mind.

## Architecture Overview

The renderer consists of five main modules:

```
SceneRenderer (Core)
├── AssetLibrary (Structure Generation)
├── MaterialSystem (Materials & Shaders)
├── AnimationController (Motion & Transforms)
└── CameraController (Cinematography)
```

Each module is independent and can be extended without affecting others.

## File Structure

```
services/render-worker/puppeteer/
├── templates/
│   └── render_template_3d.html    # Main template with embedded modules
├── engine/
│   ├── SceneRenderer.js           # Core engine
│   ├── AssetLibrary.js            # Structure generators
│   ├── MaterialSystem.js          # Materials and shaders
│   ├── AnimationController.js     # Animation system
│   └── CameraController.js        # Camera control
└── shaders/
    ├── galaxy.vert                # Galaxy vertex shader
    ├── galaxy.frag                # Galaxy fragment shader
    └── ...                        # Other shaders
```

## Adding New Structure Types

Structure types are 3D objects that can be placed in the scene.

### Step 1: Add to AssetLibrary

Open `puppeteer/engine/AssetLibrary.js` and add your structure type to the `createStructure` method:

```javascript
createStructure(structure) {
  switch (structure.type) {
    // ... existing cases
    case 'my_new_type':
      return this.createMyNewType(structure);
    default:
      return this.createGenericStructure(structure);
  }
}
```

### Step 2: Implement the Creator Method

Add a new method to create your structure:

```javascript
createMyNewType(structure) {
  // Create geometry
  const geometry = new THREE.BoxGeometry(10, 10, 10);

  // Create material
  const material = new THREE.MeshStandardMaterial({
    color: structure.material?.color || '#ffffff',
    metalness: structure.material?.metalness || 0.5,
    roughness: structure.material?.roughness || 0.5,
  });

  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);

  // Apply transforms
  if (structure.pos) {
    mesh.position.set(...structure.pos);
  }
  if (structure.scale) {
    mesh.scale.setScalar(structure.scale);
  }
  if (structure.rotation) {
    mesh.rotation.set(...structure.rotation);
  }

  // Enable shadows
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
```

### Step 3: Use Geometry Caching (Optional)

For better performance, cache reusable geometries:

```javascript
createMyNewType(structure) {
  const scale = structure.scale || 1;
  const cacheKey = `my_new_type_${scale}`;

  const geometry = this.getCachedGeometry(cacheKey, () => {
    return new THREE.BoxGeometry(10 * scale, 10 * scale, 10 * scale);
  });

  // ... rest of implementation
}
```

### Step 4: Add Complex Structures with Groups

For multi-part structures, use THREE.Group:

```javascript
createMyComplexType(structure) {
  const group = new THREE.Group();

  // Create parts
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 10, 16),
    new THREE.MeshStandardMaterial({ color: '#888888' })
  );

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(3, 16, 16),
    new THREE.MeshStandardMaterial({ color: '#aaaaaa' })
  );
  head.position.y = 8;

  // Add to group
  group.add(body);
  group.add(head);

  // Apply transforms to group
  if (structure.pos) {
    group.position.set(...structure.pos);
  }
  if (structure.scale) {
    group.scale.setScalar(structure.scale);
  }

  return group;
}
```

### Step 5: Update the Template

Rebuild the template to include your changes:

```bash
cd services/render-worker/puppeteer
node build-template.js
```

### Example: Adding a Pyramid Structure

```javascript
// In AssetLibrary.js

createStructure(structure) {
  switch (structure.type) {
    // ... existing cases
    case 'pyramid':
      return this.createPyramid(structure);
    // ...
  }
}

createPyramid(structure) {
  const size = structure.scale || 10;

  // Create pyramid geometry
  const geometry = new THREE.ConeGeometry(size, size * 1.5, 4);
  geometry.rotateY(Math.PI / 4); // Align to square base

  // Create material
  const material = new THREE.MeshStandardMaterial({
    color: structure.material?.color || '#d4af37',
    metalness: structure.material?.metalness || 0.3,
    roughness: structure.material?.roughness || 0.7,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Apply transforms
  if (structure.pos) {
    mesh.position.set(...structure.pos);
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
```

Usage in dream JSON:

```json
{
  "structures": [
    {
      "id": "pyramid1",
      "type": "pyramid",
      "pos": [0, 0, 0],
      "scale": 15,
      "material": {
        "color": "#d4af37"
      }
    }
  ]
}
```

## Adding New Animation Types

Animation types control how objects move and transform over time.

### Step 1: Add to AnimationController

Open `puppeteer/engine/AnimationController.js` and add your animation type:

```javascript
update(time, renderObjects) {
  for (const [id, obj] of renderObjects) {
    const anim = this.animations.get(id);
    if (!anim) continue;

    switch (anim.type) {
      // ... existing cases
      case 'my_animation':
        this.applyMyAnimation(obj.mesh, time, anim.params);
        break;
    }
  }
}
```

### Step 2: Implement the Animation Method

Add a method that applies the animation:

```javascript
applyMyAnimation(object, time, params) {
  const speed = params.speed || 1.0;
  const amplitude = params.amplitude || 1.0;

  // Example: Spiral motion
  const angle = time * speed;
  const radius = amplitude * (1 + Math.sin(time * speed * 0.5));

  object.position.x += Math.cos(angle) * radius * 0.01;
  object.position.z += Math.sin(angle) * radius * 0.01;
  object.position.y += Math.sin(time * speed * 2) * amplitude * 0.01;
}
```

### Step 3: Ensure Deterministic Behavior

Animations must be deterministic (same time = same result):

```javascript
applyMyAnimation(object, time, params) {
  const speed = params.speed || 1.0;
  const amplitude = params.amplitude || 1.0;

  // Store initial position if not stored
  if (!object.userData.initialPos) {
    object.userData.initialPos = object.position.clone();
  }

  // Calculate position from initial position + time
  const angle = time * speed;
  object.position.x = object.userData.initialPos.x + Math.cos(angle) * amplitude;
  object.position.z = object.userData.initialPos.z + Math.sin(angle) * amplitude;
}
```

### Step 4: Update the Template

Rebuild the template:

```bash
cd services/render-worker/puppeteer
node build-template.js
```

### Example: Adding a Bounce Animation

```javascript
// In AnimationController.js

update(time, renderObjects) {
  for (const [id, obj] of renderObjects) {
    const anim = this.animations.get(id);
    if (!anim) continue;

    switch (anim.type) {
      // ... existing cases
      case 'bounce':
        this.applyBounceAnimation(obj.mesh, time, anim.params);
        break;
    }
  }
}

applyBounceAnimation(object, time, params) {
  const speed = params.speed || 1.0;
  const amplitude = params.amplitude || 5.0;

  // Store initial Y position
  if (!object.userData.initialY) {
    object.userData.initialY = object.position.y;
  }

  // Bounce with gravity-like acceleration
  const t = (time * speed) % 2; // 2-second cycle
  let height;

  if (t < 1) {
    // Going up
    height = amplitude * (t - t * t);
  } else {
    // Coming down
    const t2 = t - 1;
    height = amplitude * (t2 - t2 * t2);
  }

  object.position.y = object.userData.initialY + height;
}
```

Usage in dream JSON:

```json
{
  "structures": [
    {
      "id": "ball",
      "type": "planet",
      "pos": [0, 5, 0],
      "scale": 3,
      "animation": {
        "type": "bounce",
        "speed": 1.5,
        "amplitude": 10
      }
    }
  ]
}
```

## Adding New Camera Shot Types

Camera shots control how the camera moves through the scene.

### Step 1: Add to CameraController

Open `puppeteer/engine/CameraController.js` and add your shot type:

```javascript
update(time) {
  const currentShot = this.getCurrentShot(time);
  if (!currentShot) return;

  switch (currentShot.type) {
    // ... existing cases
    case 'my_shot':
      this.applyMyShot(time, currentShot);
      break;
  }
}
```

### Step 2: Implement the Shot Method

Add a method that positions the camera:

```javascript
applyMyShot(time, shot) {
  const t = (time - shot.startTime) / shot.duration;
  const eased = this.easeInOut(t);

  // Calculate camera position
  const distance = shot.distance || 50;
  const angle = eased * Math.PI * 2;

  this.camera.position.x = Math.cos(angle) * distance;
  this.camera.position.y = 20 + Math.sin(eased * Math.PI) * 10;
  this.camera.position.z = Math.sin(angle) * distance;

  // Look at target
  const target = this.getTargetPosition(shot.target);
  this.camera.lookAt(target);
}
```

### Step 3: Use Helper Methods

The CameraController provides helper methods:

```javascript
applyMyShot(time, shot) {
  // Get normalized time (0-1) within shot
  const t = (time - shot.startTime) / shot.duration;

  // Apply easing
  const eased = this.applyEasing(t, shot.easing || 'linear');

  // Get target position (handles structure ID or coordinates)
  const target = this.getTargetPosition(shot.target);

  // Interpolate between positions
  const startPos = new THREE.Vector3(0, 50, 100);
  const endPos = new THREE.Vector3(100, 50, 0);
  const currentPos = this.interpolatePosition(startPos, endPos, eased);

  this.camera.position.copy(currentPos);
  this.camera.lookAt(target);
}
```

### Step 4: Update the Template

Rebuild the template:

```bash
cd services/render-worker/puppeteer
node build-template.js
```

### Example: Adding a Spiral Shot

```javascript
// In CameraController.js

update(time) {
  const currentShot = this.getCurrentShot(time);
  if (!currentShot) return;

  switch (currentShot.type) {
    // ... existing cases
    case 'spiral':
      this.applySpiralShot(time, currentShot);
      break;
  }
}

applySpiralShot(time, shot) {
  const t = (time - shot.startTime) / shot.duration;
  const eased = this.applyEasing(t, shot.easing || 'linear');

  const startDistance = shot.startDistance || 100;
  const endDistance = shot.endDistance || 20;
  const distance = startDistance + (endDistance - startDistance) * eased;

  const rotations = shot.rotations || 2;
  const angle = eased * Math.PI * 2 * rotations;

  const startHeight = shot.startHeight || 50;
  const endHeight = shot.endHeight || 10;
  const height = startHeight + (endHeight - startHeight) * eased;

  this.camera.position.x = Math.cos(angle) * distance;
  this.camera.position.y = height;
  this.camera.position.z = Math.sin(angle) * distance;

  const target = this.getTargetPosition(shot.target || [0, 0, 0]);
  this.camera.lookAt(target);
}
```

Usage in dream JSON:

```json
{
  "cinematography": {
    "shots": [
      {
        "type": "spiral",
        "startTime": 0,
        "duration": 10,
        "target": "center_object",
        "startDistance": 100,
        "endDistance": 20,
        "startHeight": 80,
        "endHeight": 10,
        "rotations": 3,
        "easing": "ease_in_out"
      }
    ]
  }
}
```

## Adding New Material Types

Materials control the visual appearance of objects.

### Step 1: Add to MaterialSystem

Open `puppeteer/engine/MaterialSystem.js` and add your material creator:

```javascript
createCustomMaterial(params) {
  const material = new THREE.MeshPhysicalMaterial({
    color: params.color || '#ffffff',
    metalness: params.metalness || 0.5,
    roughness: params.roughness || 0.5,
    // Add custom properties
    clearcoat: params.clearcoat || 0.0,
    clearcoatRoughness: params.clearcoatRoughness || 0.0,
  });

  return material;
}
```

### Step 2: Use in AssetLibrary

Reference your material in structure creators:

```javascript
createMyStructure(structure) {
  const geometry = new THREE.BoxGeometry(10, 10, 10);

  const material = this.materialSystem.createCustomMaterial({
    color: structure.material?.color,
    metalness: structure.material?.metalness,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });

  return new THREE.Mesh(geometry, material);
}
```

### Example: Adding a Holographic Material

```javascript
// In MaterialSystem.js

createHolographicMaterial(params) {
  const material = new THREE.MeshPhysicalMaterial({
    color: params.color || '#00ffff',
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: params.opacity || 0.6,
    transmission: 0.9,
    thickness: 0.5,
    emissive: params.color || '#00ffff',
    emissiveIntensity: 0.3,
  });

  // Add time-based animation
  material.userData.isHolographic = true;

  return material;
}

// Update shader uniforms for animated materials
updateShaderUniforms(time) {
  this.scene.traverse((object) => {
    if (object.material?.userData?.isHolographic) {
      // Animate opacity for flickering effect
      object.material.opacity = 0.5 + Math.sin(time * 5) * 0.1;
    }
  });
}
```

## Adding Custom Shaders

For advanced visual effects, create custom GLSL shaders.

### Step 1: Create Shader Files

Create vertex and fragment shader files in `puppeteer/shaders/`:

**my_shader.vert**:

```glsl
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

**my_shader.frag**:

```glsl
uniform float time;
uniform vec3 color;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  // Custom shader logic
  vec3 finalColor = color * (0.5 + 0.5 * sin(time + vWorldPosition.y));
  gl_FragColor = vec4(finalColor, 1.0);
}
```

### Step 2: Load and Use Shader

In MaterialSystem.js:

```javascript
createMyShaderMaterial(params) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      color: { value: new THREE.Color(params.color || '#ffffff') },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vNormal;

      void main() {
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;

      void main() {
        vec3 finalColor = color * (0.5 + 0.5 * sin(time + vWorldPosition.y));
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });

  return material;
}
```

### Step 3: Update Uniforms

Update time-based uniforms in the render loop:

```javascript
// In SceneRenderer.js
animate(time) {
  // Update shader uniforms
  this.materialSystem.updateShaderUniforms(time);

  // ... rest of render loop
}

// In MaterialSystem.js
updateShaderUniforms(time) {
  this.scene.traverse((object) => {
    if (object.material?.uniforms?.time) {
      object.material.uniforms.time.value = time;
    }
  });
}
```

## Adding Particle System Types

Particle systems create dynamic effects with many small objects.

### Step 1: Add to AssetLibrary

```javascript
createEntity(entity) {
  switch (entity.type) {
    // ... existing cases
    case 'my_particles':
      return this.createMyParticles(entity);
  }
}
```

### Step 2: Implement Particle System

```javascript
createMyParticles(entity) {
  const count = entity.count || 100;
  const geometry = new THREE.BufferGeometry();

  // Create particle positions
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Initial positions
    positions[i * 3] = (Math.random() - 0.5) * 50;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

    // Velocities
    velocities[i * 3] = (Math.random() - 0.5) * 2;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 2;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

  // Create material
  const material = new THREE.PointsMaterial({
    size: entity.params?.size || 1.0,
    color: entity.params?.color || '#ffffff',
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(geometry, material);
  particles.userData.isParticleSystem = true;
  particles.userData.params = entity.params || {};

  return particles;
}
```

### Step 3: Update Particles in AnimationController

```javascript
updateParticleSystem(system, time, params) {
  const positions = system.geometry.attributes.position;
  const velocities = system.geometry.attributes.velocity;
  const speed = params.speed || 1.0;

  for (let i = 0; i < positions.count; i++) {
    // Update positions based on velocity
    positions.array[i * 3] += velocities.array[i * 3] * speed * 0.016;
    positions.array[i * 3 + 1] += velocities.array[i * 3 + 1] * speed * 0.016;
    positions.array[i * 3 + 2] += velocities.array[i * 3 + 2] * speed * 0.016;

    // Reset if too far
    const dist = Math.sqrt(
      positions.array[i * 3] ** 2 +
      positions.array[i * 3 + 1] ** 2 +
      positions.array[i * 3 + 2] ** 2
    );

    if (dist > 100) {
      positions.array[i * 3] = 0;
      positions.array[i * 3 + 1] = 0;
      positions.array[i * 3 + 2] = 0;
    }
  }

  positions.needsUpdate = true;
}
```

## Testing Your Extensions

### Unit Testing

Create tests for your new features:

```javascript
// test-my-extension.js
const { AssetLibrary } = require('./puppeteer/engine/AssetLibrary');

describe('My New Structure Type', () => {
  it('should create pyramid structure', () => {
    const assetLibrary = new AssetLibrary(scene);
    const structure = {
      type: 'pyramid',
      pos: [0, 0, 0],
      scale: 10,
    };

    const mesh = assetLibrary.createStructure(structure);

    expect(mesh).toBeDefined();
    expect(mesh.geometry).toBeInstanceOf(THREE.ConeGeometry);
    expect(mesh.position.x).toBe(0);
  });
});
```

### Integration Testing

Test in a complete scene:

```json
{
  "title": "Test My Extension",
  "renderMode": "3d",
  "structures": [
    {
      "id": "test1",
      "type": "my_new_type",
      "pos": [0, 0, 0],
      "scale": 10
    }
  ]
}
```

### Visual Testing

Render a test scene and verify visually:

```bash
node test-my-extension.js
```

## Best Practices

### Performance

1. **Cache Geometries**: Reuse geometries when possible
2. **Limit Particle Counts**: Keep under 10,000 particles
3. **Use Instancing**: For many identical objects
4. **Dispose Resources**: Clean up when objects are removed

### Code Quality

1. **Follow Naming Conventions**: Use camelCase for methods
2. **Add Comments**: Explain complex algorithms
3. **Handle Errors**: Provide fallbacks for invalid input
4. **Validate Parameters**: Check for required fields

### Determinism

1. **Avoid Random**: Use deterministic algorithms
2. **Time-Based**: Calculate from time, not deltas
3. **Store Initial State**: Save starting positions/rotations
4. **Test Consistency**: Verify same input = same output

### Extensibility

1. **Use Switch Statements**: Easy to add new cases
2. **Separate Concerns**: Keep modules independent
3. **Document Parameters**: Explain what each parameter does
4. **Provide Defaults**: Handle missing parameters gracefully

## Debugging Tips

### Enable Debug Logging

```javascript
// In SceneRenderer.js
this.debug = true;

if (this.debug) {
  console.log('Creating structure:', structure);
}
```

### Visualize Helpers

```javascript
// Add axis helper
const axisHelper = new THREE.AxesHelper(50);
scene.add(axisHelper);

// Add grid helper
const gridHelper = new THREE.GridHelper(100, 10);
scene.add(gridHelper);

// Add bounding box helper
const box = new THREE.BoxHelper(mesh, 0xffff00);
scene.add(box);
```

### Monitor Performance

```javascript
// Track frame time
const startTime = performance.now();
renderer.render(scene, camera);
const endTime = performance.now();
console.log(`Frame time: ${endTime - startTime}ms`);

// Track memory
console.log('Memory:', renderer.info.memory);
console.log('Render calls:', renderer.info.render.calls);
```

## Contributing

When contributing extensions:

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Provide example usage
5. Test performance impact
6. Submit pull request with clear description

## Additional Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [WebGL Fundamentals](https://webglfundamentals.org/)
- [GLSL Shader Reference](https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language)
- [3D Rendering Guide](./3D_RENDERING_GUIDE.md)
- [Example Dreams](./examples/README.md)

## Support

For questions or issues:

1. Check existing documentation
2. Review example code
3. Test with simple cases first
4. Open an issue with reproduction steps
