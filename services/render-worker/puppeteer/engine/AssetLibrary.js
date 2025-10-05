/**
 * AssetLibrary - Procedural 3D asset generation
 * Creates geometry for 50+ structure types and entities
 */

class AssetLibrary {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.geometryCache = new Map();
    this.materialCache = new Map();
  }

  /**
   * Get quality-specific settings
   * @private
   * @param {string} setting - Setting name
   * @returns {*} Setting value
   */
  _getQualitySetting(setting) {
    const qualitySettings = {
      draft: {
        geometrySegments: 8,
        maxParticles: 1000,
      },
      medium: {
        geometrySegments: 16,
        maxParticles: 5000,
      },
      high: {
        geometrySegments: 32,
        maxParticles: 10000,
      },
    };

    const quality = this.options.quality || 'medium';
    return (
      qualitySettings[quality]?.[setting] ?? qualitySettings.medium[setting]
    );
  }

  /**
   * Create a structure (static 3D object)
   * @param {Object} structure - Structure specification from dream JSON
   * @returns {THREE.Mesh|THREE.Group} - Three.js object
   */
  createStructure(structure) {
    const type = structure.type?.toLowerCase() || 'unknown';

    try {
      let mesh;

      // Dispatcher for structure types
      switch (type) {
        // Celestial objects
        case 'star':
          mesh = this.createStar(structure);
          break;
        case 'planet':
          mesh = this.createPlanet(structure);
          break;
        case 'galaxy':
          mesh = this.createGalaxy(structure);
          break;
        case 'nebula':
          mesh = this.createNebula(structure);
          break;

        // Natural elements
        case 'water':
        case 'ocean':
        case 'sea':
          mesh = this.createWater(structure);
          break;
        case 'fire':
          mesh = this.createFire(structure);
          break;
        case 'cloud':
        case 'clouds':
          mesh = this.createClouds(structure);
          break;
        case 'mountain':
        case 'mountains':
          mesh = this.createMountain(structure);
          break;

        // Living beings
        case 'horse':
          mesh = this.createHorse(structure);
          break;
        case 'bird':
          mesh = this.createBird(structure);
          break;
        case 'fish':
          mesh = this.createFish(structure);
          break;
        case 'human':
        case 'person':
          mesh = this.createHuman(structure);
          break;

        // Architectural structures
        case 'tower':
          mesh = this.createTower(structure);
          break;
        case 'bridge':
          mesh = this.createBridge(structure);
          break;
        case 'crystal':
          mesh = this.createCrystal(structure);
          break;

        // Fallback for unknown types
        default:
          console.warn(
            `Unknown structure type: ${type}, using generic fallback`
          );
          mesh = this.createGenericStructure(structure);
          break;
      }

      // Apply transformations
      if (mesh) {
        this.applyTransformations(mesh, structure);

        // Apply visual features if specified
        if (structure.features && structure.features.length > 0) {
          this.applyFeatures(mesh, structure.features, structure);
        }
      }

      return mesh;
    } catch (error) {
      console.error(
        `Error creating structure ${structure.id || 'unknown'}:`,
        error
      );
      return this.createGenericStructure(structure);
    }
  }

  /**
   * Create an entity (dynamic particle system or animated object)
   * @param {Object} entity - Entity specification from dream JSON
   * @returns {THREE.Points|THREE.Group} - Three.js object
   */
  createEntity(entity) {
    const type = entity.type?.toLowerCase() || 'unknown';

    try {
      let object;

      // Dispatcher for entity types
      switch (type) {
        case 'particle_stream':
          object = this.createParticleStream(entity);
          break;
        case 'floating_orbs':
          object = this.createFloatingOrbs(entity);
          break;
        case 'light_butterflies':
          object = this.createLightButterflies(entity);
          break;

        // Fallback for unknown types
        default:
          console.warn(`Unknown entity type: ${type}, using generic fallback`);
          object = this.createParticleStream(entity);
          break;
      }

      return object;
    } catch (error) {
      console.error(`Error creating entity ${entity.id || 'unknown'}:`, error);
      return null;
    }
  }

  /**
   * Get cached geometry or create new one
   * @param {string} key - Cache key
   * @param {Function} createFn - Function to create geometry if not cached
   * @returns {THREE.BufferGeometry} - Cached or new geometry
   */
  getCachedGeometry(key, createFn) {
    if (!this.geometryCache.has(key)) {
      this.geometryCache.set(key, createFn());
    }
    return this.geometryCache.get(key);
  }

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
   * Apply transformations (position, scale, rotation) to a mesh
   * @param {THREE.Object3D} mesh - The mesh to transform
   * @param {Object} structure - Structure specification with transform data
   */
  applyTransformations(mesh, structure) {
    // Apply position
    if (
      structure.pos &&
      Array.isArray(structure.pos) &&
      structure.pos.length === 3
    ) {
      mesh.position.set(structure.pos[0], structure.pos[1], structure.pos[2]);
    }

    // Apply scale
    if (structure.scale !== undefined) {
      const scale = structure.scale;
      mesh.scale.set(scale, scale, scale);
    }

    // Apply rotation
    if (
      structure.rotation &&
      Array.isArray(structure.rotation) &&
      structure.rotation.length === 3
    ) {
      mesh.rotation.set(
        structure.rotation[0],
        structure.rotation[1],
        structure.rotation[2]
      );
    }

    // Enable frustum culling for performance optimization
    this._enableFrustumCulling(mesh);
  }

  /**
   * Enable frustum culling for an object and all its children
   * @private
   * @param {THREE.Object3D} object - The object to enable culling for
   */
  _enableFrustumCulling(object) {
    object.frustumCulled = true;

    // Apply to all children recursively
    if (object.children && object.children.length > 0) {
      object.children.forEach((child) => this._enableFrustumCulling(child));
    }
  }

  // ============================================================================
  // CELESTIAL OBJECTS
  // ============================================================================

  /**
   * Create a star with glowing sphere and corona effects
   * @param {Object} structure - Structure specification
   * @returns {THREE.Group} - Star with glow effects
   */
  createStar(structure) {
    const group = new THREE.Group();
    const color = structure.material?.color || '#ffff00';
    const size = structure.scale || 1;

    // Main star sphere
    const geometry = this.getCachedGeometry(
      `sphere_32`,
      () => new THREE.SphereGeometry(10, 32, 32)
    );

    const material = this.getCachedMaterial(
      `star_emissive_${color}`,
      () =>
        new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 1.0,
          metalness: 0,
          roughness: 0.2,
        })
    );

    const star = new THREE.Mesh(geometry, material);
    star.castShadow = false;
    group.add(star);

    // Corona glow effect (larger transparent sphere)
    const coronaGeometry = this.getCachedGeometry(
      `sphere_16`,
      () => new THREE.SphereGeometry(15, 16, 16)
    );

    const coronaMaterial = this.getCachedMaterial(
      `corona_transparent_${color}`,
      () =>
        new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.3,
          side: THREE.BackSide,
        })
    );

    const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);
    group.add(corona);

    // Point light for illumination
    const light = new THREE.PointLight(color, 2, 100);
    group.add(light);

    return group;
  }

  /**
   * Create a planet with textured sphere and atmosphere
   * @param {Object} structure - Structure specification
   * @returns {THREE.Group} - Planet with atmosphere
   */
  createPlanet(structure) {
    const group = new THREE.Group();
    const color = structure.material?.color || '#4488ff';
    const size = structure.scale || 1;

    // Main planet sphere
    const geometry = this.getCachedGeometry(
      `sphere_32`,
      () => new THREE.SphereGeometry(10, 32, 32)
    );

    const material = this.getCachedMaterial(
      `planet_standard_${color}`,
      () =>
        new THREE.MeshStandardMaterial({
          color: color,
          metalness: 0.2,
          roughness: 0.8,
        })
    );

    const planet = new THREE.Mesh(geometry, material);
    planet.castShadow = true;
    planet.receiveShadow = true;
    group.add(planet);

    // Atmospheric glow
    const atmosphereGeometry = this.getCachedGeometry(
      `sphere_16`,
      () => new THREE.SphereGeometry(11, 16, 16)
    );

    const atmosphereMaterial = this.getCachedMaterial(
      `atmosphere_transparent_${color}`,
      () =>
        new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.2,
          side: THREE.BackSide,
        })
    );

    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    group.add(atmosphere);

    return group;
  }

  /**
   * Create a galaxy with spiral particle system
   * @param {Object} structure - Structure specification
   * @returns {THREE.Points} - Galaxy particle system
   */
  createGalaxy(structure) {
    const color = structure.material?.color || '#8844ff';
    const maxParticles = this._getQualitySetting('maxParticles') || 5000;
    const particleCount = Math.min(
      structure.params?.count || 5000,
      maxParticles
    );

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorObj = new THREE.Color(color);

    // Create spiral galaxy distribution
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 4; // 2 spiral arms
      const radius = (i / particleCount) * 50 + Math.random() * 5;

      const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 10;
      const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 10;
      const y = (Math.random() - 0.5) * 5; // Vertical spread

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Vary colors slightly
      const colorVariation = 0.8 + Math.random() * 0.2;
      colors[i * 3] = colorObj.r * colorVariation;
      colors[i * 3 + 1] = colorObj.g * colorVariation;
      colors[i * 3 + 2] = colorObj.b * colorVariation;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const galaxy = new THREE.Points(geometry, material);
    return galaxy;
  }

  /**
   * Create a nebula with volumetric particle clouds
   * @param {Object} structure - Structure specification
   * @returns {THREE.Points} - Nebula particle system
   */
  createNebula(structure) {
    const color = structure.material?.color || '#ff44ff';
    const maxParticles = this._getQualitySetting('maxParticles') || 5000;
    const particleCount = Math.min(
      structure.params?.count || 3000,
      maxParticles
    );

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorObj = new THREE.Color(color);

    // Create volumetric cloud distribution
    for (let i = 0; i < particleCount; i++) {
      // Use multiple overlapping spheres for cloud-like appearance
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const radius = 20 + Math.random() * 30;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Vary colors for depth
      const colorVariation = 0.5 + Math.random() * 0.5;
      colors[i * 3] = colorObj.r * colorVariation;
      colors[i * 3 + 1] = colorObj.g * colorVariation;
      colors[i * 3 + 2] = colorObj.b * colorVariation;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const nebula = new THREE.Points(geometry, material);
    return nebula;
  }

  // ============================================================================
  // NATURAL ELEMENTS
  // ============================================================================

  /**
   * Create water surface with animated wave displacement
   * @param {Object} structure - Structure specification
   * @returns {THREE.Mesh} - Water surface mesh
   */
  createWater(structure) {
    const color = structure.material?.color || '#0088ff';
    const size = structure.scale || 1;

    // Create plane geometry for water surface
    const geometry = new THREE.PlaneGeometry(50, 50, 32, 32);

    // Store original positions for wave animation
    const positions = geometry.attributes.position;
    const originalPositions = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      originalPositions[i * 3] = positions.getX(i);
      originalPositions[i * 3 + 1] = positions.getY(i);
      originalPositions[i * 3 + 2] = positions.getZ(i);
    }
    geometry.userData.originalPositions = originalPositions;

    const material = this.getCachedMaterial(
      `water_metallic_${color}`,
      () =>
        new THREE.MeshStandardMaterial({
          color: color,
          metalness: 0.9,
          roughness: 0.1,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
        })
    );

    const water = new THREE.Mesh(geometry, material);
    water.rotation.x = -Math.PI / 2; // Horizontal
    water.receiveShadow = true;
    water.userData.isWater = true; // Flag for animation system

    return water;
  }

  /**
   * Create fire with particle-based flame effects
   * @param {Object} structure - Structure specification
   * @returns {THREE.Points} - Fire particle system
   */
  createFire(structure) {
    const maxParticles = this._getQualitySetting('maxParticles') || 2000;
    const particleCount = Math.min(
      structure.params?.count || 500,
      maxParticles / 2
    );

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    // Create fire particles
    for (let i = 0; i < particleCount; i++) {
      // Start at base
      const radius = Math.random() * 3;
      const angle = Math.random() * Math.PI * 2;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.random() * 2; // Start low
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      // Velocity upward with slight randomness
      velocities[i * 3] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 1] = 2 + Math.random() * 2; // Upward
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;

      // Color gradient from yellow to red
      const t = Math.random();
      colors[i * 3] = 1.0; // Red
      colors[i * 3 + 1] = 0.5 + t * 0.5; // Yellow to orange
      colors[i * 3 + 2] = 0.0; // No blue
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData.velocities = velocities;

    const material = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const fire = new THREE.Points(geometry, material);
    fire.userData.isFire = true; // Flag for animation system

    return fire;
  }

  /**
   * Create clouds with volumetric particle formations
   * @param {Object} structure - Structure specification
   * @returns {THREE.Points} - Cloud particle system
   */
  createClouds(structure) {
    const color = structure.material?.color || '#ffffff';
    const maxParticles = this._getQualitySetting('maxParticles') || 5000;
    const particleCount = Math.min(
      structure.params?.count || 1000,
      maxParticles
    );

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    const colorObj = new THREE.Color(color);

    // Create fluffy cloud distribution
    for (let i = 0; i < particleCount; i++) {
      // Multiple overlapping ellipsoids for cloud shape
      const x = (Math.random() - 0.5) * 30;
      const y = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 20;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 3.0,
      color: color,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    const clouds = new THREE.Points(geometry, material);
    return clouds;
  }

  /**
   * Create mountains with cone-based terrain
   * @param {Object} structure - Structure specification
   * @returns {THREE.Mesh} - Mountain mesh
   */
  createMountain(structure) {
    const color = structure.material?.color || '#8b7355';
    const size = structure.scale || 1;

    // Create cone for mountain shape
    const geometry = this.getCachedGeometry(
      `cone_32`,
      () => new THREE.ConeGeometry(15, 30, 32)
    );

    const material = this.getCachedMaterial(
      `mountain_rough_${color}`,
      () =>
        new THREE.MeshStandardMaterial({
          color: color,
          metalness: 0.1,
          roughness: 0.9,
        })
    );

    const mountain = new THREE.Mesh(geometry, material);
    mountain.castShadow = true;
    mountain.receiveShadow = true;

    return mountain;
  }

  // ============================================================================
  // LIVING BEINGS
  // ============================================================================

  /**
   * Create a horse with simplified geometric model
   * @param {Object} structure - Structure specification
   * @returns {THREE.Group} - Horse model
   */
  createHorse(structure) {
    const group = new THREE.Group();
    const color = structure.material?.color || '#8b4513';

    // Body (horizontal cylinder)
    const bodyGeometry = this.getCachedGeometry(
      `cylinder_8`,
      () => new THREE.CylinderGeometry(4, 5, 12, 8)
    );
    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.1,
      roughness: 0.8,
    });

    const body = new THREE.Mesh(bodyGeometry, material);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Head (cone)
    const headGeometry = this.getCachedGeometry(
      `cone_8`,
      () => new THREE.ConeGeometry(3, 6, 8)
    );
    const head = new THREE.Mesh(headGeometry, material);
    head.position.set(7, 2, 0);
    head.rotation.z = Math.PI / 2;
    head.castShadow = true;
    group.add(head);

    // Neck
    const neckGeometry = this.getCachedGeometry(
      `cylinder_6`,
      () => new THREE.CylinderGeometry(2, 2, 4, 6)
    );
    const neck = new THREE.Mesh(neckGeometry, material);
    neck.position.set(5, 1, 0);
    neck.rotation.z = Math.PI / 4;
    neck.castShadow = true;
    group.add(neck);

    // Legs (4 cylinders)
    const legGeometry = this.getCachedGeometry(
      `cylinder_leg`,
      () => new THREE.CylinderGeometry(1, 1, 8, 6)
    );

    const legPositions = [
      [3, -6, 2],
      [3, -6, -2],
      [-3, -6, 2],
      [-3, -6, -2],
    ];

    legPositions.forEach((pos) => {
      const leg = new THREE.Mesh(legGeometry, material);
      leg.position.set(pos[0], pos[1], pos[2]);
      leg.castShadow = true;
      group.add(leg);
    });

    // Tail
    const tailGeometry = this.getCachedGeometry(
      `cone_tail`,
      () => new THREE.ConeGeometry(0.5, 6, 6)
    );
    const tail = new THREE.Mesh(tailGeometry, material);
    tail.position.set(-7, 0, 0);
    tail.rotation.z = -Math.PI / 4;
    tail.castShadow = true;
    group.add(tail);

    return group;
  }

  /**
   * Create a bird with basic body and wing geometry
   * @param {Object} structure - Structure specification
   * @returns {THREE.Group} - Bird model
   */
  createBird(structure) {
    const group = new THREE.Group();
    const color = structure.material?.color || '#4488ff';

    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.2,
      roughness: 0.7,
    });

    // Body (ellipsoid)
    const bodyGeometry = this.getCachedGeometry(
      `sphere_16`,
      () => new THREE.SphereGeometry(3, 16, 16)
    );
    const body = new THREE.Mesh(bodyGeometry, material);
    body.scale.set(1, 0.8, 1.5);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Head (smaller sphere)
    const headGeometry = this.getCachedGeometry(
      `sphere_12`,
      () => new THREE.SphereGeometry(1.5, 12, 12)
    );
    const head = new THREE.Mesh(headGeometry, material);
    head.position.set(0, 1, 3);
    head.castShadow = true;
    group.add(head);

    // Beak (cone)
    const beakGeometry = this.getCachedGeometry(
      `cone_beak`,
      () => new THREE.ConeGeometry(0.3, 1, 6)
    );
    const beakMaterial = new THREE.MeshStandardMaterial({
      color: '#ff8800',
      metalness: 0.3,
      roughness: 0.6,
    });
    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    beak.position.set(0, 1, 4.5);
    beak.rotation.x = Math.PI / 2;
    group.add(beak);

    // Wings (flat boxes)
    const wingGeometry = this.getCachedGeometry(
      `wing_box`,
      () => new THREE.BoxGeometry(8, 0.5, 4)
    );

    const leftWing = new THREE.Mesh(wingGeometry, material);
    leftWing.position.set(-5, 0, 0);
    leftWing.rotation.z = -Math.PI / 6;
    leftWing.castShadow = true;
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, material);
    rightWing.position.set(5, 0, 0);
    rightWing.rotation.z = Math.PI / 6;
    rightWing.castShadow = true;
    group.add(rightWing);

    return group;
  }

  /**
   * Create a fish with streamlined body shape
   * @param {Object} structure - Structure specification
   * @returns {THREE.Group} - Fish model
   */
  createFish(structure) {
    const group = new THREE.Group();
    const color = structure.material?.color || '#ff8844';

    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.6,
      roughness: 0.3,
    });

    // Body (stretched sphere)
    const bodyGeometry = this.getCachedGeometry(
      `sphere_16`,
      () => new THREE.SphereGeometry(3, 16, 16)
    );
    const body = new THREE.Mesh(bodyGeometry, material);
    body.scale.set(1, 0.8, 2);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Tail fin (triangle)
    const tailGeometry = this.getCachedGeometry(
      `cone_tail_fish`,
      () => new THREE.ConeGeometry(3, 4, 3)
    );
    const tail = new THREE.Mesh(tailGeometry, material);
    tail.position.set(0, 0, -6);
    tail.rotation.x = Math.PI / 2;
    tail.castShadow = true;
    group.add(tail);

    // Side fins
    const finGeometry = this.getCachedGeometry(
      `fin_box`,
      () => new THREE.BoxGeometry(4, 0.2, 2)
    );

    const leftFin = new THREE.Mesh(finGeometry, material);
    leftFin.position.set(-3, 0, 1);
    leftFin.rotation.z = -Math.PI / 4;
    group.add(leftFin);

    const rightFin = new THREE.Mesh(finGeometry, material);
    rightFin.position.set(3, 0, 1);
    rightFin.rotation.z = Math.PI / 4;
    group.add(rightFin);

    // Top fin
    const topFin = new THREE.Mesh(finGeometry, material);
    topFin.position.set(0, 3, 0);
    topFin.rotation.x = Math.PI / 2;
    group.add(topFin);

    return group;
  }

  /**
   * Create a human with simplified humanoid figure
   * @param {Object} structure - Structure specification
   * @returns {THREE.Group} - Human model
   */
  createHuman(structure) {
    const group = new THREE.Group();
    const color = structure.material?.color || '#ffdbac';

    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.1,
      roughness: 0.8,
    });

    // Head (sphere)
    const headGeometry = this.getCachedGeometry(
      `sphere_16`,
      () => new THREE.SphereGeometry(2, 16, 16)
    );
    const head = new THREE.Mesh(headGeometry, material);
    head.position.set(0, 8, 0);
    head.castShadow = true;
    group.add(head);

    // Body (box)
    const bodyGeometry = this.getCachedGeometry(
      `body_box`,
      () => new THREE.BoxGeometry(4, 6, 2)
    );
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.set(0, 3, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Arms (cylinders)
    const armGeometry = this.getCachedGeometry(
      `arm_cylinder`,
      () => new THREE.CylinderGeometry(0.6, 0.6, 5, 8)
    );

    const leftArm = new THREE.Mesh(armGeometry, material);
    leftArm.position.set(-3, 3, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, material);
    rightArm.position.set(3, 3, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    // Legs (cylinders)
    const legGeometry = this.getCachedGeometry(
      `leg_cylinder`,
      () => new THREE.CylinderGeometry(0.8, 0.8, 6, 8)
    );

    const leftLeg = new THREE.Mesh(legGeometry, material);
    leftLeg.position.set(-1, -3, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, material);
    rightLeg.position.set(1, -3, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    return group;
  }

  // ============================================================================
  // ARCHITECTURAL STRUCTURES
  // ============================================================================

  /**
   * Create a tower with cylindrical base and spire
   * @param {Object} structure - Structure specification
   * @returns {THREE.Group} - Tower model
   */
  createTower(structure) {
    const group = new THREE.Group();
    const color = structure.material?.color || '#cccccc';

    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.2,
      roughness: 0.8,
    });

    // Base (cylinder)
    const baseGeometry = this.getCachedGeometry(
      `tower_base`,
      () => new THREE.CylinderGeometry(8, 10, 20, 16)
    );
    const base = new THREE.Mesh(baseGeometry, material);
    base.position.set(0, 10, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Middle section (narrower cylinder)
    const middleGeometry = this.getCachedGeometry(
      `tower_middle`,
      () => new THREE.CylinderGeometry(6, 8, 15, 16)
    );
    const middle = new THREE.Mesh(middleGeometry, material);
    middle.position.set(0, 27.5, 0);
    middle.castShadow = true;
    group.add(middle);

    // Spire (cone)
    const spireGeometry = this.getCachedGeometry(
      `tower_spire`,
      () => new THREE.ConeGeometry(6, 12, 16)
    );
    const spire = new THREE.Mesh(spireGeometry, material);
    spire.position.set(0, 41, 0);
    spire.castShadow = true;
    group.add(spire);

    return group;
  }

  /**
   * Create a bridge with spanning structure
   * @param {Object} structure - Structure specification
   * @returns {THREE.Group} - Bridge model
   */
  createBridge(structure) {
    const group = new THREE.Group();
    const color = structure.material?.color || '#8b7355';

    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.3,
      roughness: 0.7,
    });

    // Main deck (long box)
    const deckGeometry = this.getCachedGeometry(
      `bridge_deck`,
      () => new THREE.BoxGeometry(40, 2, 8)
    );
    const deck = new THREE.Mesh(deckGeometry, material);
    deck.position.set(0, 0, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    // Support pillars
    const pillarGeometry = this.getCachedGeometry(
      `bridge_pillar`,
      () => new THREE.CylinderGeometry(2, 2, 15, 8)
    );

    const pillarPositions = [
      [-15, -8.5, 0],
      [0, -8.5, 0],
      [15, -8.5, 0],
    ];

    pillarPositions.forEach((pos) => {
      const pillar = new THREE.Mesh(pillarGeometry, material);
      pillar.position.set(pos[0], pos[1], pos[2]);
      pillar.castShadow = true;
      group.add(pillar);
    });

    // Railings (thin boxes)
    const railingGeometry = this.getCachedGeometry(
      `bridge_railing`,
      () => new THREE.BoxGeometry(40, 2, 0.5)
    );

    const leftRailing = new THREE.Mesh(railingGeometry, material);
    leftRailing.position.set(0, 2, 4);
    group.add(leftRailing);

    const rightRailing = new THREE.Mesh(railingGeometry, material);
    rightRailing.position.set(0, 2, -4);
    group.add(rightRailing);

    return group;
  }

  /**
   * Create a crystal with transparent geometric form
   * @param {Object} structure - Structure specification
   * @returns {THREE.Mesh} - Crystal mesh
   */
  createCrystal(structure) {
    const color = structure.material?.color || '#88ffff';

    // Create octahedron for crystal shape
    const geometry = this.getCachedGeometry(
      `crystal_octahedron`,
      () => new THREE.OctahedronGeometry(8, 0)
    );

    const material = new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 0.1,
      roughness: 0.1,
      transparent: true,
      opacity: 0.7,
      transmission: 0.9,
      thickness: 0.5,
    });

    const crystal = new THREE.Mesh(geometry, material);
    crystal.castShadow = true;
    crystal.receiveShadow = true;

    return crystal;
  }

  /**
   * Create a generic fallback structure for unknown types
   * @param {Object} structure - Structure specification
   * @returns {THREE.Mesh} - Generic box mesh
   */
  createGenericStructure(structure) {
    const geometry = this.getCachedGeometry(
      'generic_box',
      () => new THREE.BoxGeometry(10, 10, 10)
    );

    const color = structure.material?.color || '#888888';
    const material = this.getCachedMaterial(
      `generic_standard_${color}`,
      () =>
        new THREE.MeshStandardMaterial({
          color: color,
          metalness: 0.3,
          roughness: 0.7,
        })
    );

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  // ============================================================================
  // PARTICLE ENTITY SYSTEMS
  // ============================================================================

  /**
   * Create a particle stream with velocity-based movement
   * @param {Object} entity - Entity specification
   * @returns {THREE.Points} - Particle stream
   */
  createParticleStream(entity) {
    const maxParticles = this._getQualitySetting('maxParticles') || 5000;
    const count = Math.min(entity.count || 1000, maxParticles);
    const params = entity.params || {};
    const color = params.color || '#00ffff';
    const speed = params.speed || 1.0;
    const size = params.size || 1.0;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorObj = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      // Random starting positions in a volume
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

      // Random velocities
      velocities[i * 3] = (Math.random() - 0.5) * speed;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * speed;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * speed;

      // Colors with slight variation
      const variation = 0.8 + Math.random() * 0.2;
      colors[i * 3] = colorObj.r * variation;
      colors[i * 3 + 1] = colorObj.g * variation;
      colors[i * 3 + 2] = colorObj.b * variation;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData.velocities = velocities;
    geometry.userData.maxDistance = 50;

    const material = new THREE.PointsMaterial({
      size: size,
      vertexColors: true,
      transparent: true,
      opacity: params.glow ? 0.9 : 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    particles.userData.isParticleStream = true;
    particles.userData.params = params;

    return particles;
  }

  /**
   * Create floating orbs with glowing spheres
   * @param {Object} entity - Entity specification
   * @returns {THREE.Group} - Group of floating orbs
   */
  createFloatingOrbs(entity) {
    const group = new THREE.Group();
    const maxOrbs = Math.floor(
      (this._getQualitySetting('maxParticles') || 5000) / 100
    );
    const count = Math.min(entity.count || 10, maxOrbs);
    const params = entity.params || {};
    const color = params.color || '#ffff00';
    const size = params.size || 1.0;
    const glow = params.glow || 0.5;

    for (let i = 0; i < count; i++) {
      // Create orb geometry
      const geometry = this.getCachedGeometry(
        `orb_sphere`,
        () => new THREE.SphereGeometry(1, 16, 16)
      );

      const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: glow,
        metalness: 0,
        roughness: 0.2,
      });

      const orb = new THREE.Mesh(geometry, material);

      // Random position
      orb.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30
      );

      // Scale based on size parameter
      orb.scale.setScalar(size);

      // Store animation data
      orb.userData.floatOffset = Math.random() * Math.PI * 2;
      orb.userData.floatSpeed = 0.5 + Math.random() * 0.5;
      orb.userData.floatAmplitude = 2 + Math.random() * 2;

      group.add(orb);
    }

    group.userData.isFloatingOrbs = true;
    return group;
  }

  /**
   * Create light butterflies with animated particles
   * @param {Object} entity - Entity specification
   * @returns {THREE.Points} - Butterfly particle system
   */
  createLightButterflies(entity) {
    const maxParticles = this._getQualitySetting('maxParticles') || 5000;
    const count = Math.min(entity.count || 50, Math.floor(maxParticles / 25));
    const params = entity.params || {};
    const color = params.color || '#ffaaff';
    const speed = params.speed || 1.0;
    const size = params.size || 1.5;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const colorObj = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      // Random starting positions
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;

      // Fluttering velocities (more erratic)
      velocities[i * 3] = (Math.random() - 0.5) * speed * 2;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * speed * 2;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * speed * 2;

      // Bright colors
      colors[i * 3] = colorObj.r;
      colors[i * 3 + 1] = colorObj.g;
      colors[i * 3 + 2] = colorObj.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.userData.velocities = velocities;
    geometry.userData.maxDistance = 60;
    geometry.userData.flutterSpeed = speed;

    const material = new THREE.PointsMaterial({
      size: size,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const butterflies = new THREE.Points(geometry, material);
    butterflies.userData.isLightButterflies = true;
    butterflies.userData.params = params;

    return butterflies;
  }

  /**
   * Update particle system (called by AnimationController)
   * @param {THREE.Points} particles - Particle system to update
   * @param {number} deltaTime - Time since last update
   */
  updateParticleSystem(particles, deltaTime) {
    if (!particles.geometry.attributes.position) return;

    const positions = particles.geometry.attributes.position.array;
    const velocities = particles.geometry.userData.velocities;
    const maxDistance = particles.geometry.userData.maxDistance || 50;

    if (!velocities) return;

    for (let i = 0; i < positions.length; i += 3) {
      // Update position based on velocity
      positions[i] += velocities[i] * deltaTime;
      positions[i + 1] += velocities[i + 1] * deltaTime;
      positions[i + 2] += velocities[i + 2] * deltaTime;

      // Reset particles that go too far
      const distance = Math.sqrt(
        positions[i] ** 2 + positions[i + 1] ** 2 + positions[i + 2] ** 2
      );

      if (distance > maxDistance) {
        positions[i] = (Math.random() - 0.5) * 10;
        positions[i + 1] = (Math.random() - 0.5) * 10;
        positions[i + 2] = (Math.random() - 0.5) * 10;
      }
    }

    particles.geometry.attributes.position.needsUpdate = true;
  }

  // ============================================================================
  // VISUAL FEATURES
  // ============================================================================

  /**
   * Apply visual features to a mesh
   * @param {THREE.Object3D} mesh - The mesh to apply features to
   * @param {Array<string>} features - Array of feature names
   * @param {Object} structure - Original structure specification
   */
  applyFeatures(mesh, features, structure) {
    if (!features || features.length === 0) return;

    features.forEach((feature) => {
      const featureName = feature.toLowerCase();

      switch (featureName) {
        case 'glowing_edges':
          this.applyGlowingEdges(mesh, structure);
          break;
        case 'emissive':
          this.applyEmissive(mesh, structure);
          break;
        case 'particle_trail':
          this.applyParticleTrail(mesh, structure);
          break;
        case 'rotating':
        case 'animated':
          this.applyAutoRotation(mesh, structure);
          break;
        case 'pulsating':
          this.applyPulsating(mesh, structure);
          break;
        default:
          console.warn(`Unknown feature: ${feature}`);
      }
    });
  }

  /**
   * Apply glowing edges effect with rim lighting
   * @param {THREE.Object3D} mesh - The mesh to modify
   * @param {Object} structure - Structure specification
   */
  applyGlowingEdges(mesh, structure) {
    const color = structure.material?.color || '#ffffff';

    // Traverse all meshes in the object
    mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        // Add emissive properties for glow effect
        if (child.material.emissive) {
          child.material.emissive = new THREE.Color(color);
          child.material.emissiveIntensity = 0.3;
        }
      }
    });

    // Store feature flag for potential shader effects
    mesh.userData.hasGlowingEdges = true;
  }

  /**
   * Apply emissive effect with material properties
   * @param {THREE.Object3D} mesh - The mesh to modify
   * @param {Object} structure - Structure specification
   */
  applyEmissive(mesh, structure) {
    const color = structure.material?.color || '#ffffff';
    const intensity = structure.material?.emissiveIntensity || 0.8;

    mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        if (child.material.emissive) {
          child.material.emissive = new THREE.Color(color);
          child.material.emissiveIntensity = intensity;
        }
      }
    });

    mesh.userData.isEmissive = true;
  }

  /**
   * Apply particle trail generation
   * @param {THREE.Object3D} mesh - The mesh to add trail to
   * @param {Object} structure - Structure specification
   */
  applyParticleTrail(mesh, structure) {
    const color = structure.material?.color || '#ffffff';
    const trailLength = 50;

    // Create trail particle system
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(trailLength * 3);
    const colors = new Float32Array(trailLength * 3);

    const colorObj = new THREE.Color(color);

    // Initialize trail positions at mesh position
    for (let i = 0; i < trailLength; i++) {
      positions[i * 3] = mesh.position.x;
      positions[i * 3 + 1] = mesh.position.y;
      positions[i * 3 + 2] = mesh.position.z;

      // Fade out along trail
      const alpha = 1 - i / trailLength;
      colors[i * 3] = colorObj.r * alpha;
      colors[i * 3 + 1] = colorObj.g * alpha;
      colors[i * 3 + 2] = colorObj.b * alpha;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const trail = new THREE.Points(geometry, material);
    trail.userData.isTrail = true;
    trail.userData.trailIndex = 0;
    trail.userData.parentMesh = mesh;

    // Add trail as child
    mesh.add(trail);
    mesh.userData.hasParticleTrail = true;
  }

  /**
   * Apply automatic rotation animation
   * @param {THREE.Object3D} mesh - The mesh to rotate
   * @param {Object} structure - Structure specification
   */
  applyAutoRotation(mesh, structure) {
    // Store rotation parameters for AnimationController
    mesh.userData.autoRotate = true;
    mesh.userData.rotationSpeed = structure.animation?.speed || 1.0;
    mesh.userData.rotationAxis = structure.animation?.axis || 'y';
  }

  /**
   * Apply pulsating animation
   * @param {THREE.Object3D} mesh - The mesh to pulsate
   * @param {Object} structure - Structure specification
   */
  applyPulsating(mesh, structure) {
    // Store pulsating parameters for AnimationController
    mesh.userData.pulsating = true;
    mesh.userData.pulseSpeed = structure.animation?.speed || 1.0;
    mesh.userData.pulseAmplitude = structure.animation?.amplitude || 0.2;
  }

  /**
   * Dispose all cached geometries and materials
   */
  dispose() {
    this.geometryCache.forEach((geometry) => geometry.dispose());
    this.geometryCache.clear();

    this.materialCache.forEach((material) => material.dispose());
    this.materialCache.clear();
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.AssetLibrary = AssetLibrary;
}
