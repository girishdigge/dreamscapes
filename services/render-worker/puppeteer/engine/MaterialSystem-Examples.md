# MaterialSystem Usage Examples

## Basic Setup

```javascript
// Create MaterialSystem instance
const materialSystem = new MaterialSystem();

// In render loop
function animate(time) {
  // Update all shader uniforms
  materialSystem.updateShaderUniforms(time);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// On cleanup
materialSystem.dispose();
```

## Creating Materials

### 1. PBR Material (Metallic Objects)

```javascript
// Shiny metal
const metalMaterial = materialSystem.createPBRMaterial({
  color: '#888888',
  metalness: 0.9,
  roughness: 0.1,
});

// Rough metal
const roughMetalMaterial = materialSystem.createPBRMaterial({
  color: '#664422',
  metalness: 0.8,
  roughness: 0.6,
});

// Plastic-like
const plasticMaterial = materialSystem.createPBRMaterial({
  color: '#ff0000',
  metalness: 0.0,
  roughness: 0.4,
});
```

### 2. Emissive Material (Glowing Objects)

```javascript
// Bright glow
const glowMaterial = materialSystem.createEmissiveMaterial({
  color: '#00ff00',
  emissiveColor: '#00ff00',
  emissiveIntensity: 1.5,
});

// Subtle glow
const subtleGlowMaterial = materialSystem.createEmissiveMaterial({
  color: '#ffffff',
  emissiveColor: '#ffaa00',
  emissiveIntensity: 0.3,
});

// Neon effect
const neonMaterial = materialSystem.createEmissiveMaterial({
  color: '#ff00ff',
  emissiveIntensity: 2.0,
});
```

### 3. Transparent Material (Glass/Crystal)

```javascript
// Clear glass
const glassMaterial = materialSystem.createTransparentMaterial({
  color: '#ffffff',
  opacity: 0.3,
  transmission: 0.95,
  roughness: 0.0,
  ior: 1.5,
});

// Colored crystal
const crystalMaterial = materialSystem.createTransparentMaterial({
  color: '#0088ff',
  opacity: 0.6,
  transmission: 0.8,
  roughness: 0.1,
  ior: 2.4,
});

// Frosted glass
const frostedMaterial = materialSystem.createTransparentMaterial({
  color: '#ffffff',
  opacity: 0.5,
  transmission: 0.7,
  roughness: 0.5,
});
```

### 4. Water Material (Animated Surface)

```javascript
// Ocean water
const oceanMaterial = materialSystem.createWaterMaterial({
  color: '#0066aa',
  opacity: 0.8,
});

// Pool water
const poolMaterial = materialSystem.createWaterMaterial({
  color: '#00aaff',
  opacity: 0.7,
});

// Murky water
const murkyMaterial = materialSystem.createWaterMaterial({
  color: '#446655',
  opacity: 0.9,
});
```

## Creating Skyboxes

### 1. Galaxy Skybox

```javascript
const galaxyMaterial = materialSystem.createGalaxySkybox();
const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
const skybox = new THREE.Mesh(skyboxGeometry, galaxyMaterial);
scene.add(skybox);
```

### 2. Nebula Skybox

```javascript
const nebulaMaterial = materialSystem.createNebulaSkybox();
const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
const skybox = new THREE.Mesh(skyboxGeometry, nebulaMaterial);
scene.add(skybox);
```

### 3. Sunset Skybox

```javascript
const sunsetMaterial = materialSystem.createSunsetSkybox();
const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
const skybox = new THREE.Mesh(skyboxGeometry, sunsetMaterial);
scene.add(skybox);
```

### 4. Underwater Skybox

```javascript
const underwaterMaterial = materialSystem.createUnderwaterSkybox();
const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
const skybox = new THREE.Mesh(skyboxGeometry, underwaterMaterial);
scene.add(skybox);
```

### 5. Void Skybox

```javascript
const voidMaterial = materialSystem.createVoidSkybox();
const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
const skybox = new THREE.Mesh(skyboxGeometry, voidMaterial);
scene.add(skybox);
```

## Material Caching

### Basic Caching

```javascript
// First call creates material
const material1 = materialSystem.getCachedMaterial('red_metal', () =>
  materialSystem.createPBRMaterial({
    color: '#ff0000',
    metalness: 0.9,
    roughness: 0.1,
  })
);

// Second call returns cached material (same instance)
const material2 = materialSystem.getCachedMaterial('red_metal', () =>
  materialSystem.createPBRMaterial({
    color: '#0000ff', // This won't be used
    metalness: 0.5,
    roughness: 0.5,
  })
);

console.log(material1 === material2); // true
```

### Caching Strategy for Repeated Objects

```javascript
// Create 100 identical spheres efficiently
for (let i = 0; i < 100; i++) {
  const material = materialSystem.getCachedMaterial('sphere_material', () =>
    materialSystem.createPBRMaterial({
      color: '#00ff00',
      metalness: 0.5,
      roughness: 0.5,
    })
  );

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 32),
    material // All spheres share the same material instance
  );

  sphere.position.set(
    Math.random() * 100 - 50,
    Math.random() * 100 - 50,
    Math.random() * 100 - 50
  );

  scene.add(sphere);
}
```

## Texture Loading

```javascript
// Load and cache texture
const texture = materialSystem.loadTexture('/textures/wood.jpg');

// Use texture in material
const material = materialSystem.createPBRMaterial({
  color: '#ffffff',
  metalness: 0.0,
  roughness: 0.8,
});
material.map = texture;

// Second load returns cached texture
const sameTexture = materialSystem.loadTexture('/textures/wood.jpg');
console.log(texture === sameTexture); // true
```

## Shader Uniform Updates

### Automatic Updates (Recommended)

```javascript
let time = 0;

function animate() {
  requestAnimationFrame(animate);

  time += 0.016; // ~60fps

  // Updates all shader materials (skyboxes, water, etc.)
  materialSystem.updateShaderUniforms(time);

  renderer.render(scene, camera);
}

animate();
```

### Manual Updates (Advanced)

```javascript
// Update specific material
const waterMaterial = materialSystem.createWaterMaterial({ color: '#0077be' });
const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100, 64, 64),
  waterMaterial
);

function animate(time) {
  // Update only this material
  materialSystem.updateMaterialUniforms(waterMaterial, time);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

## Integration with Dream JSON

### From Structure Definition

```javascript
function createStructureMaterial(structure) {
  const materialParams = structure.material || {};

  // Determine material type based on features
  if (materialParams.emissiveIntensity > 0) {
    return materialSystem.createEmissiveMaterial({
      color: materialParams.color || '#ffffff',
      emissiveIntensity: materialParams.emissiveIntensity,
    });
  }

  if (materialParams.transmission > 0) {
    return materialSystem.createTransparentMaterial({
      color: materialParams.color || '#ffffff',
      opacity: materialParams.opacity || 0.5,
      transmission: materialParams.transmission,
      roughness: materialParams.roughness || 0.1,
    });
  }

  // Default to PBR
  return materialSystem.createPBRMaterial({
    color: materialParams.color || '#ffffff',
    metalness: materialParams.metalness || 0.5,
    roughness: materialParams.roughness || 0.5,
    opacity: materialParams.opacity || 1.0,
  });
}

// Usage
const structure = {
  type: 'crystal',
  material: {
    color: '#00ffff',
    transmission: 0.9,
    opacity: 0.3,
    roughness: 0.0,
  },
};

const material = createStructureMaterial(structure);
```

### From Environment Definition

```javascript
function createSkyboxFromEnvironment(environment) {
  const skyboxType = environment.skybox || 'void';

  switch (skyboxType) {
    case 'galaxy':
      return materialSystem.createGalaxySkybox();
    case 'nebula':
      return materialSystem.createNebulaSkybox();
    case 'sunset':
      return materialSystem.createSunsetSkybox();
    case 'underwater':
      return materialSystem.createUnderwaterSkybox();
    case 'void':
    default:
      return materialSystem.createVoidSkybox();
  }
}

// Usage
const environment = {
  preset: 'space',
  skybox: 'galaxy',
};

const skyboxMaterial = createSkyboxFromEnvironment(environment);
const skybox = new THREE.Mesh(
  new THREE.BoxGeometry(1000, 1000, 1000),
  skyboxMaterial
);
scene.add(skybox);
```

## Complete Scene Example

```javascript
// Initialize
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
const materialSystem = new MaterialSystem();

// Create skybox
const skybox = new THREE.Mesh(
  new THREE.BoxGeometry(1000, 1000, 1000),
  materialSystem.createGalaxySkybox()
);
scene.add(skybox);

// Create glowing star
const star = new THREE.Mesh(
  new THREE.SphereGeometry(10, 32, 32),
  materialSystem.createEmissiveMaterial({
    color: '#ffff00',
    emissiveIntensity: 2.0,
  })
);
star.position.set(0, 20, 0);
scene.add(star);

// Create crystal
const crystal = new THREE.Mesh(
  new THREE.OctahedronGeometry(5),
  materialSystem.createTransparentMaterial({
    color: '#00ffff',
    transmission: 0.95,
    roughness: 0.0,
  })
);
crystal.position.set(-20, 0, 0);
scene.add(crystal);

// Create water surface
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100, 64, 64),
  materialSystem.createWaterMaterial({
    color: '#0077be',
    opacity: 0.8,
  })
);
water.rotation.x = -Math.PI / 2;
water.position.y = -10;
scene.add(water);

// Create metallic sphere
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(5, 32, 32),
  materialSystem.createPBRMaterial({
    color: '#888888',
    metalness: 0.9,
    roughness: 0.1,
  })
);
sphere.position.set(20, 0, 0);
scene.add(sphere);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// Animation loop
let time = 0;
function animate() {
  requestAnimationFrame(animate);

  time += 0.016;

  // Update all shader materials
  materialSystem.updateShaderUniforms(time);

  // Rotate objects
  crystal.rotation.y += 0.01;
  sphere.rotation.y += 0.01;

  renderer.render(scene, camera);
}

camera.position.set(0, 10, 50);
camera.lookAt(0, 0, 0);
animate();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  materialSystem.dispose();
  renderer.dispose();
});
```

## Performance Tips

### 1. Use Material Caching

```javascript
// ❌ Bad: Creates new material for each object
for (let i = 0; i < 1000; i++) {
  const material = materialSystem.createPBRMaterial({ color: '#ff0000' });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
}

// ✅ Good: Reuses cached material
const material = materialSystem.getCachedMaterial('red_pbr', () =>
  materialSystem.createPBRMaterial({ color: '#ff0000' })
);
for (let i = 0; i < 1000; i++) {
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
}
```

### 2. Batch Uniform Updates

```javascript
// ✅ Good: Single call updates all materials
materialSystem.updateShaderUniforms(time);

// ❌ Bad: Individual updates (slower)
materials.forEach((material) => {
  materialSystem.updateMaterialUniforms(material, time);
});
```

### 3. Dispose Properly

```javascript
// Always dispose when done
function cleanup() {
  materialSystem.dispose(); // Cleans up all materials and textures
  renderer.dispose();
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
  });
}
```

## Troubleshooting

### Materials Appear Black

- Ensure scene has lighting (ambient + directional)
- Check material color is not black
- Verify camera is positioned correctly

### Transparent Materials Not Working

- Ensure `opacity < 1.0` or `transmission > 0`
- Check render order for transparency sorting
- Verify `transparent: true` is set

### Shaders Not Animating

- Call `updateShaderUniforms(time)` in render loop
- Ensure time value is increasing
- Check material is in `shaderMaterials` Set

### Performance Issues

- Use material caching for repeated objects
- Reduce shader complexity for low-end devices
- Limit number of transparent objects
- Use simpler materials for distant objects
