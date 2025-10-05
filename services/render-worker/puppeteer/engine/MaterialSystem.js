/**
 * MaterialSystem - Advanced material creation and shader management
 * Creates PBR materials, custom shaders, and skyboxes
 */

class MaterialSystem {
  constructor(options = {}) {
    this.options = options;
    this.materialCache = new Map();
    this.textureCache = new Map();
    this.textureLoader = new THREE.TextureLoader();
    this.shaderMaterials = new Set(); // Track materials with uniforms to update
  }

  // ============================================================================
  // TASK 4.1: Material Caching and Texture Loading
  // ============================================================================

  /**
   * Get cached material or create new one
   * @param {string} key - Cache key
   * @param {Function} createFn - Function to create material if not cached
   * @returns {THREE.Material} - Cached or new material
   */
  getCachedMaterial(key, createFn) {
    if (!this.materialCache.has(key)) {
      this.materialCache.set(key, createFn());
    }
    return this.materialCache.get(key);
  }

  /**
   * Load texture with caching
   * @param {string} url - Texture URL
   * @returns {THREE.Texture} - Loaded texture
   */
  loadTexture(url) {
    if (!this.textureCache.has(url)) {
      const texture = this.textureLoader.load(url);
      this.textureCache.set(url, texture);
    }
    return this.textureCache.get(url);
  }

  /**
   * Dispose all cached materials and textures
   */
  dispose() {
    this.materialCache.forEach((material) => material.dispose());
    this.materialCache.clear();
    this.textureCache.forEach((texture) => texture.dispose());
    this.textureCache.clear();
    this.shaderMaterials.clear();
  }

  // ============================================================================
  // TASK 4.2: Skybox Materials with Custom Shaders
  // ============================================================================

  /**
   * Create skybox based on type
   * @param {string} type - Skybox type (galaxy, nebula, sunset, underwater, void)
   * @returns {THREE.Mesh} - Skybox mesh with material
   */
  createSkybox(type) {
    let material;

    switch (type) {
      case 'galaxy':
        material = this.createGalaxySkybox();
        break;
      case 'nebula':
        material = this.createNebulaSkybox();
        break;
      case 'sunset':
        material = this.createSunsetSkybox();
        break;
      case 'underwater':
        material = this.createUnderwaterSkybox();
        break;
      case 'void':
        material = this.createVoidSkybox();
        break;
      default:
        console.warn(`Unknown skybox type: ${type}, using void`);
        material = this.createVoidSkybox();
    }

    // Create skybox geometry (large sphere)
    const geometry = new THREE.SphereGeometry(5000, 32, 32);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `skybox-${type}`;

    return mesh;
  }

  /**
   * Create galaxy skybox with spiral arms and stars (GLSL shader)
   * @returns {THREE.ShaderMaterial} - Galaxy skybox material
   */
  createGalaxySkybox() {
    const vertexShader = `
      // Galaxy Skybox Vertex Shader
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      // Galaxy Skybox Fragment Shader
      uniform float time;
      varying vec3 vWorldPosition;

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      void main() {
        vec3 direction = normalize(vWorldPosition);
        float angle = atan(direction.x, direction.z);
        float radius = length(direction.xz);
        
        // Spiral arms pattern
        float spiral = sin(angle * 3.0 + radius * 10.0 + time * 0.1) * 0.5 + 0.5;
        
        // Star field
        vec2 starCoord = direction.xy * 100.0;
        float stars = step(0.99, random(floor(starCoord)));
        
        // Nebula base color (purple/blue gradient)
        vec3 nebulaColor = mix(vec3(0.1, 0.05, 0.2), vec3(0.8, 0.4, 0.9), spiral * 0.3);
        
        // Add stars
        vec3 color = nebulaColor + stars * vec3(1.0, 0.9, 0.8);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.shaderMaterials.add(material);
    return material;
  }

  /**
   * Create nebula skybox with volumetric clouds (GLSL shader)
   * @returns {THREE.ShaderMaterial} - Nebula skybox material
   */
  createNebulaSkybox() {
    const vertexShader = `
      // Nebula Skybox Vertex Shader
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      // Nebula Skybox Fragment Shader
      uniform float time;
      varying vec3 vWorldPosition;

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float n = i.x + i.y * 57.0 + i.z * 113.0;
        return mix(
          mix(
            mix(fract(sin(n) * 43758.5453), fract(sin(n + 1.0) * 43758.5453), f.x),
            mix(fract(sin(n + 57.0) * 43758.5453), fract(sin(n + 58.0) * 43758.5453), f.x),
            f.y
          ),
          mix(
            mix(fract(sin(n + 113.0) * 43758.5453), fract(sin(n + 114.0) * 43758.5453), f.x),
            mix(fract(sin(n + 170.0) * 43758.5453), fract(sin(n + 171.0) * 43758.5453), f.x),
            f.y
          ),
          f.z
        );
      }

      void main() {
        vec3 direction = normalize(vWorldPosition);
        
        // Multi-octave noise for volumetric clouds
        float n = 0.0;
        n += noise(direction * 2.0 + time * 0.05) * 0.5;
        n += noise(direction * 4.0 + time * 0.1) * 0.25;
        n += noise(direction * 8.0 + time * 0.15) * 0.125;
        
        // Color gradient (pink to purple to blue)
        vec3 color1 = vec3(0.8, 0.2, 0.5); // Pink
        vec3 color2 = vec3(0.4, 0.1, 0.8); // Purple
        vec3 color3 = vec3(0.1, 0.3, 0.9); // Blue
        
        vec3 color = mix(color1, color2, n);
        color = mix(color, color3, n * n);
        
        // Add some brightness variation
        color *= 0.5 + n * 0.5;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.shaderMaterials.add(material);
    return material;
  }

  /**
   * Create sunset skybox with gradient and sun
   * @returns {THREE.ShaderMaterial} - Sunset skybox material
   */
  createSunsetSkybox() {
    const vertexShader = `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float time;
      varying vec3 vWorldPosition;

      void main() {
        vec3 direction = normalize(vWorldPosition);
        
        // Vertical gradient from horizon to sky
        float height = direction.y;
        
        // Sunset colors
        vec3 skyColor = vec3(0.1, 0.2, 0.4); // Dark blue
        vec3 horizonColor = vec3(1.0, 0.6, 0.3); // Orange
        vec3 sunColor = vec3(1.0, 0.9, 0.7); // Yellow-white
        
        // Gradient from sky to horizon
        float gradientFactor = smoothstep(-0.2, 0.3, height);
        vec3 color = mix(horizonColor, skyColor, gradientFactor);
        
        // Add sun
        vec3 sunDirection = normalize(vec3(0.5, -0.1, -1.0));
        float sunDot = dot(direction, sunDirection);
        float sun = smoothstep(0.995, 0.998, sunDot);
        float sunGlow = smoothstep(0.95, 0.998, sunDot) * 0.3;
        
        color = mix(color, sunColor, sun + sunGlow);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.shaderMaterials.add(material);
    return material;
  }

  /**
   * Create underwater skybox with caustics and bubbles
   * @returns {THREE.ShaderMaterial} - Underwater skybox material
   */
  createUnderwaterSkybox() {
    const vertexShader = `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float time;
      varying vec3 vWorldPosition;

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      void main() {
        vec3 direction = normalize(vWorldPosition);
        
        // Base underwater blue-green color
        vec3 deepColor = vec3(0.0, 0.1, 0.3); // Deep blue
        vec3 shallowColor = vec3(0.0, 0.4, 0.6); // Lighter blue
        
        // Vertical gradient
        float depth = direction.y * 0.5 + 0.5;
        vec3 color = mix(deepColor, shallowColor, depth);
        
        // Caustics effect (animated light patterns)
        vec2 causticsCoord = direction.xz * 5.0 + time * 0.1;
        float caustics = sin(causticsCoord.x * 3.0) * cos(causticsCoord.y * 3.0);
        caustics += sin(causticsCoord.x * 5.0 + time * 0.2) * cos(causticsCoord.y * 5.0 + time * 0.2);
        caustics = caustics * 0.1 + 0.9;
        
        color *= caustics;
        
        // Add some bubbles
        vec2 bubbleCoord = direction.xy * 50.0;
        float bubbles = step(0.995, random(floor(bubbleCoord + time * 0.5)));
        color += bubbles * vec3(0.3, 0.5, 0.7);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.shaderMaterials.add(material);
    return material;
  }

  /**
   * Create void skybox with deep space and stars
   * @returns {THREE.ShaderMaterial} - Void skybox material
   */
  createVoidSkybox() {
    const vertexShader = `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float time;
      varying vec3 vWorldPosition;

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      void main() {
        vec3 direction = normalize(vWorldPosition);
        
        // Very dark space background
        vec3 color = vec3(0.01, 0.01, 0.02);
        
        // Dense star field with varying sizes
        vec2 starCoord1 = direction.xy * 100.0;
        float stars1 = step(0.99, random(floor(starCoord1)));
        
        vec2 starCoord2 = direction.yz * 150.0;
        float stars2 = step(0.995, random(floor(starCoord2))) * 0.7;
        
        vec2 starCoord3 = direction.xz * 200.0;
        float stars3 = step(0.997, random(floor(starCoord3))) * 0.5;
        
        // Add stars with slight color variation
        float starBrightness = stars1 + stars2 + stars3;
        vec3 starColor = vec3(1.0, 0.95, 0.9);
        color += starBrightness * starColor;
        
        // Add some distant nebula hints
        float nebula = random(floor(direction.xy * 10.0)) * 0.05;
        color += vec3(0.1, 0.05, 0.15) * nebula;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.shaderMaterials.add(material);
    return material;
  }

  // ============================================================================
  // TASK 4.3: Standard Material Creators
  // ============================================================================

  /**
   * Create PBR material with metalness, roughness, transmission
   * @param {Object} params - Material parameters
   * @param {string} params.color - Base color (hex string)
   * @param {number} params.metalness - Metalness value (0-1)
   * @param {number} params.roughness - Roughness value (0-1)
   * @param {number} params.transmission - Transmission value (0-1)
   * @param {number} params.opacity - Opacity value (0-1)
   * @returns {THREE.MeshStandardMaterial} - PBR material
   */
  createPBRMaterial(params = {}) {
    const color = params.color || '#ffffff';
    const metalness = params.metalness !== undefined ? params.metalness : 0.5;
    const roughness = params.roughness !== undefined ? params.roughness : 0.5;
    const transmission =
      params.transmission !== undefined ? params.transmission : 0.0;
    const opacity = params.opacity !== undefined ? params.opacity : 1.0;

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      metalness: Math.max(0, Math.min(1, metalness)),
      roughness: Math.max(0, Math.min(1, roughness)),
      transparent: opacity < 1.0 || transmission > 0,
      opacity: Math.max(0, Math.min(1, opacity)),
    });

    // Add transmission if supported (Three.js r128+)
    if (transmission > 0 && material.transmission !== undefined) {
      material.transmission = Math.max(0, Math.min(1, transmission));
      material.thickness = params.thickness || 0.5;
    }

    return material;
  }

  /**
   * Create emissive (glowing) material
   * @param {Object} params - Material parameters
   * @param {string} params.color - Base color (hex string)
   * @param {string} params.emissiveColor - Emissive color (hex string)
   * @param {number} params.emissiveIntensity - Glow intensity (0-1)
   * @returns {THREE.MeshStandardMaterial} - Emissive material
   */
  createEmissiveMaterial(params = {}) {
    const color = params.color || '#ffffff';
    const emissiveColor = params.emissiveColor || params.color || '#ffffff';
    const emissiveIntensity =
      params.emissiveIntensity !== undefined ? params.emissiveIntensity : 0.5;

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(emissiveColor),
      emissiveIntensity: Math.max(0, Math.min(2, emissiveIntensity)),
    });

    return material;
  }

  /**
   * Create transparent material for glass/crystal
   * @param {Object} params - Material parameters
   * @param {string} params.color - Base color (hex string)
   * @param {number} params.opacity - Opacity value (0-1)
   * @param {number} params.transmission - Transmission value (0-1)
   * @param {number} params.roughness - Roughness value (0-1)
   * @returns {THREE.MeshPhysicalMaterial} - Transparent material
   */
  createTransparentMaterial(params = {}) {
    const color = params.color || '#ffffff';
    const opacity = params.opacity !== undefined ? params.opacity : 0.5;
    const transmission =
      params.transmission !== undefined ? params.transmission : 0.9;
    const roughness = params.roughness !== undefined ? params.roughness : 0.1;

    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      metalness: 0.0,
      roughness: Math.max(0, Math.min(1, roughness)),
      transparent: true,
      opacity: Math.max(0, Math.min(1, opacity)),
      transmission: Math.max(0, Math.min(1, transmission)),
      thickness: params.thickness || 0.5,
      ior: params.ior || 1.5, // Index of refraction
    });

    return material;
  }

  /**
   * Create water material with animated normals
   * @param {Object} params - Material parameters
   * @param {string} params.color - Water color (hex string)
   * @param {number} params.opacity - Opacity value (0-1)
   * @returns {THREE.ShaderMaterial} - Water material
   */
  createWaterMaterial(params = {}) {
    const color = params.color || '#0077be';
    const opacity = params.opacity !== undefined ? params.opacity : 0.8;

    const vertexShader = `
      uniform float time;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        
        // Animated wave displacement
        vec3 pos = position;
        float wave = sin(pos.x * 0.1 + time) * cos(pos.y * 0.1 + time) * 2.0;
        pos.z += wave;
        
        vPosition = pos;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float time;
      uniform vec3 waterColor;
      uniform float opacity;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        // Fresnel effect (more reflective at grazing angles)
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        float fresnel = pow(1.0 - dot(viewDirection, vNormal), 3.0);
        
        // Base water color
        vec3 color = waterColor;
        
        // Add some shimmer
        float shimmer = sin(vPosition.x * 0.5 + time * 2.0) * cos(vPosition.y * 0.5 + time * 2.0);
        shimmer = shimmer * 0.1 + 0.9;
        
        // Mix with white for highlights
        color = mix(color, vec3(1.0), fresnel * 0.3);
        color *= shimmer;
        
        gl_FragColor = vec4(color, opacity);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time: { value: 0.0 },
        waterColor: { value: new THREE.Color(color) },
        opacity: { value: Math.max(0, Math.min(1, opacity)) },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.shaderMaterials.add(material);
    return material;
  }

  // ============================================================================
  // TASK 4.4: Shader Uniform Updates
  // ============================================================================

  /**
   * Update shader uniforms for all animated materials
   * @param {number} time - Current time in seconds
   */
  updateShaderUniforms(time) {
    this.shaderMaterials.forEach((material) => {
      if (material.uniforms && material.uniforms.time) {
        material.uniforms.time.value = time;
      }
    });
  }

  /**
   * Update specific material's shader uniforms
   * @param {THREE.Material} material - Material with shader
   * @param {number} time - Current time in seconds
   */
  updateMaterialUniforms(material, time) {
    if (material.uniforms && material.uniforms.time) {
      material.uniforms.time.value = time;
    }
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.MaterialSystem = MaterialSystem;
}
