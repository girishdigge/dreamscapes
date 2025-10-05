/**
 * StructureRenderer - Handles rendering of static and animated structures
 * Supports various structure types and motion/animation definitions
 */

class StructureRenderer {
  constructor(scene, assetLibrary, materialSystem, options = {}) {
    this.scene = scene;
    this.assetLibrary = assetLibrary;
    this.materialSystem = materialSystem;
    this.options = options;
    this.structures = new Map(); // id -> structure object
  }

  /**
   * Create structures from dream data
   * @param {Array} structuresData - Array of structure specifications
   */
  createStructures(structuresData) {
    console.log(`Creating ${structuresData.length} structures...`);

    structuresData.forEach((structureSpec) => {
      try {
        const structure = this._createStructure(structureSpec);
        if (structure) {
          this.structures.set(structureSpec.id, {
            spec: structureSpec,
            object: structure,
            initialScale: structureSpec.scale || 1.0,
            initialPosition: structureSpec.pos || [0, 0, 0],
          });
          this.scene.add(structure);
        }
      } catch (error) {
        console.error(`Failed to create structure ${structureSpec.id}:`, error);
      }
    });

    console.log(`Created ${this.structures.size} structures`);
  }

  /**
   * Create a single structure based on type
   * @private
   */
  _createStructure(spec) {
    const type = (spec.type || spec.template || 'generic').toLowerCase();
    const pos = spec.pos || [0, 0, 0];
    const scale = spec.scale || 1.0;
    const rotation = spec.rotation || [0, 0, 0];

    // Create structure based on type
    let structure;
    switch (type) {
      case 'star':
        structure = this._createStar(spec);
        break;
      case 'planet':
        structure = this._createPlanet(spec);
        break;
      case 'ship':
      case 'titanic_ship':
        structure = this._createShip(spec);
        break;
      case 'volcano':
        structure = this._createVolcano(spec);
        break;
      case 'library':
      case 'floating_library':
        structure = this._createLibrary(spec);
        break;
      case 'organic_house':
      case 'house':
      case 'twisted_house':
        structure = this._createHouse(spec);
        break;
      case 'crystal':
      case 'crystal_tower':
      case 'crystal_spire':
        structure = this._createCrystal(spec);
        break;
      case 'tree':
      case 'organic_tree':
      case 'data_tree':
        structure = this._createTree(spec);
        break;
      case 'energy_nexus':
      case 'portal_arch':
        structure = this._createEnergyStructure(spec);
        break;
      case 'floating_platform':
      case 'floating_island':
        structure = this._createPlatform(spec);
        break;
      case 'galaxy':
        structure = this._createGalaxy(spec);
        break;
      default:
        structure = this._createGenericStructure(spec);
        break;
    }

    if (!structure) return null;

    // Set position, scale, and rotation
    structure.position.set(pos[0], pos[1], pos[2]);
    structure.scale.setScalar(scale);
    structure.rotation.set(rotation[0], rotation[1], rotation[2]);
    structure.name = spec.id;

    return structure;
  }

  /**
   * Create star structure
   * @private
   */
  _createStar(spec) {
    const scale = spec.scale || 6.0;
    const material = spec.material || {};

    const geometry = new THREE.SphereGeometry(scale, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: material.color || '#FFD700',
      emissive: material.color || '#FFD700',
      emissiveIntensity: material.emissiveIntensity || 2.0,
    });

    const star = new THREE.Mesh(geometry, mat);

    // Add point light for glow effect
    const light = new THREE.PointLight(
      material.color || '#FFD700',
      material.emissiveIntensity || 2.0,
      scale * 20
    );
    star.add(light);

    return star;
  }

  /**
   * Create planet structure
   * @private
   */
  _createPlanet(spec) {
    const scale = spec.scale || 4.0;
    const material = spec.material || {};

    const geometry = new THREE.SphereGeometry(scale, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: material.color || '#4488FF',
      metalness: material.metalness || 0.3,
      roughness: material.roughness || 0.7,
    });

    const planet = new THREE.Mesh(geometry, mat);
    planet.castShadow = true;
    planet.receiveShadow = true;

    return planet;
  }

  /**
   * Create ship structure
   * @private
   */
  _createShip(spec) {
    const scale = spec.scale || 2.0;
    const material = spec.material || {};

    // Create ship hull (elongated box)
    const hullGeometry = new THREE.BoxGeometry(scale * 4, scale, scale * 1.5);
    const hullMaterial = new THREE.MeshStandardMaterial({
      color: material.color || '#8B4513',
      metalness: material.metalness || 0.6,
      roughness: material.roughness || 0.4,
    });

    const hull = new THREE.Mesh(hullGeometry, hullMaterial);
    hull.castShadow = true;
    hull.receiveShadow = true;

    // Create ship group
    const ship = new THREE.Group();
    ship.add(hull);

    // Add masts (simple cylinders)
    const mastGeometry = new THREE.CylinderGeometry(
      0.1 * scale,
      0.1 * scale,
      scale * 3,
      8
    );
    const mastMaterial = new THREE.MeshStandardMaterial({ color: '#654321' });

    const mast1 = new THREE.Mesh(mastGeometry, mastMaterial);
    mast1.position.set(-scale, scale * 1.5, 0);
    ship.add(mast1);

    const mast2 = new THREE.Mesh(mastGeometry, mastMaterial);
    mast2.position.set(scale, scale * 1.5, 0);
    ship.add(mast2);

    return ship;
  }

  /**
   * Create volcano structure
   * @private
   */
  _createVolcano(spec) {
    const scale = spec.scale || 3.0;
    const material = spec.material || {};

    // Create cone for volcano
    const geometry = new THREE.ConeGeometry(scale * 2, scale * 3, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: material.color || '#3A3A3A',
      roughness: material.roughness || 0.9,
      metalness: 0.1,
    });

    const volcano = new THREE.Mesh(geometry, mat);
    volcano.castShadow = true;
    volcano.receiveShadow = true;

    // Add glow at top if emissive
    if (material.emissive) {
      const glowGeometry = new THREE.CylinderGeometry(
        scale * 0.5,
        scale * 0.8,
        scale * 0.5,
        16
      );
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: '#FF4500',
        emissive: '#FF4500',
        emissiveIntensity: 1.5,
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      glow.position.y = scale * 1.5;
      volcano.add(glow);
    }

    return volcano;
  }

  /**
   * Create library structure
   * @private
   */
  _createLibrary(spec) {
    const scale = spec.scale || 1.2;
    const material = spec.material || {};

    // Create main building
    const buildingGeometry = new THREE.BoxGeometry(
      scale * 8,
      scale * 6,
      scale * 6
    );
    const buildingMaterial = new THREE.MeshStandardMaterial({
      color: material.color || '#D4AF37',
      transparent: material.opacity !== undefined,
      opacity: material.opacity || 1.0,
      metalness: 0.3,
      roughness: 0.6,
    });

    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.castShadow = true;
    building.receiveShadow = true;

    // Create library group
    const library = new THREE.Group();
    library.add(building);

    // Add columns
    const columnGeometry = new THREE.CylinderGeometry(
      scale * 0.3,
      scale * 0.3,
      scale * 6,
      8
    );
    const columnMaterial = new THREE.MeshStandardMaterial({ color: '#F5F5DC' });

    for (let i = -1; i <= 1; i++) {
      const column = new THREE.Mesh(columnGeometry, columnMaterial);
      column.position.set(i * scale * 3, 0, scale * 3);
      library.add(column);
    }

    // Add emissive glow if specified
    if (material.emissive) {
      buildingMaterial.emissive = new THREE.Color(material.emissive);
      buildingMaterial.emissiveIntensity = material.emissiveIntensity || 0.4;
    }

    return library;
  }

  /**
   * Create house structure
   * @private
   */
  _createHouse(spec) {
    const scale = spec.scale || 1.0;
    const material = spec.material || {};

    // Create house base
    const baseGeometry = new THREE.BoxGeometry(scale * 4, scale * 3, scale * 4);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: material.color || '#8B7355',
      roughness: material.roughness || 0.7,
      metalness: material.metalness || 0.1,
    });

    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.castShadow = true;
    base.receiveShadow = true;

    // Create roof
    const roofGeometry = new THREE.ConeGeometry(scale * 3, scale * 2, 4);
    const roofMaterial = new THREE.MeshStandardMaterial({ color: '#654321' });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = scale * 2.5;
    roof.rotation.y = Math.PI / 4;

    // Create house group
    const house = new THREE.Group();
    house.add(base);
    house.add(roof);

    return house;
  }

  /**
   * Create crystal structure
   * @private
   */
  _createCrystal(spec) {
    const scale = spec.scale || 3.0;
    const material = spec.material || {};

    // Create crystal geometry (octahedron)
    const geometry = new THREE.OctahedronGeometry(scale, 0);
    const mat = new THREE.MeshPhysicalMaterial({
      color: material.color || '#FF00FF',
      transparent: true,
      opacity: material.opacity || 0.7,
      transmission: material.transmission || 0.9,
      roughness: 0.1,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });

    const crystal = new THREE.Mesh(geometry, mat);

    // Add emissive glow
    if (material.emissive || spec.features?.includes('glowing_edges')) {
      mat.emissive = new THREE.Color(material.color || '#FF00FF');
      mat.emissiveIntensity = 0.5;
    }

    return crystal;
  }

  /**
   * Create tree structure
   * @private
   */
  _createTree(spec) {
    const scale = spec.scale || 3.0;

    // Create trunk
    const trunkGeometry = new THREE.CylinderGeometry(
      scale * 0.3,
      scale * 0.5,
      scale * 4,
      8
    );
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#654321' });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.castShadow = true;

    // Create foliage
    const foliageGeometry = new THREE.SphereGeometry(scale * 2, 16, 16);
    const foliageMaterial = new THREE.MeshStandardMaterial({
      color: '#228B22',
    });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = scale * 3;
    foliage.castShadow = true;

    // Create tree group
    const tree = new THREE.Group();
    tree.add(trunk);
    tree.add(foliage);

    return tree;
  }

  /**
   * Create energy structure (nexus, portal, etc.)
   * @private
   */
  _createEnergyStructure(spec) {
    const scale = spec.scale || 4.0;
    const material = spec.material || {};

    // Create torus for portal/nexus
    const geometry = new THREE.TorusGeometry(scale, scale * 0.3, 16, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: material.color || '#00FFFF',
      emissive: material.color || '#00FFFF',
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.8,
    });

    const structure = new THREE.Mesh(geometry, mat);

    // Add point light
    const light = new THREE.PointLight(
      material.color || '#00FFFF',
      2,
      scale * 10
    );
    structure.add(light);

    return structure;
  }

  /**
   * Create platform structure
   * @private
   */
  _createPlatform(spec) {
    const scale = spec.scale || 2.0;
    const material = spec.material || {};

    // Create flat cylinder for platform
    const geometry = new THREE.CylinderGeometry(
      scale * 2,
      scale * 2,
      scale * 0.2,
      32
    );
    const mat = new THREE.MeshStandardMaterial({
      color: material.color || '#D4AF37',
      transparent: spec.features?.includes('transparent'),
      opacity: spec.features?.includes('transparent') ? 0.5 : 1.0,
      metalness: 0.5,
      roughness: 0.3,
    });

    const platform = new THREE.Mesh(geometry, mat);
    platform.castShadow = true;
    platform.receiveShadow = true;

    return platform;
  }

  /**
   * Create galaxy structure
   * @private
   */
  _createGalaxy(spec) {
    const scale = spec.scale || 10.0;

    // Create spiral galaxy using particles
    const particleCount = 5000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 4;
      const radius = (i / particleCount) * scale;
      const height = (Math.random() - 0.5) * scale * 0.2;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      // Color gradient from center to edge
      const colorMix = i / particleCount;
      colors[i * 3] = 0.5 + colorMix * 0.5; // R
      colors[i * 3 + 1] = 0.3 + colorMix * 0.3; // G
      colors[i * 3 + 2] = 1.0; // B
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const galaxy = new THREE.Points(geometry, material);
    return galaxy;
  }

  /**
   * Create generic structure
   * @private
   */
  _createGenericStructure(spec) {
    const scale = spec.scale || 1.0;
    const material = spec.material || {};

    const geometry = new THREE.BoxGeometry(scale * 2, scale * 2, scale * 2);
    const mat = new THREE.MeshStandardMaterial({
      color: material.color || '#888888',
      metalness: material.metalness || 0.5,
      roughness: material.roughness || 0.5,
    });

    const structure = new THREE.Mesh(geometry, mat);
    structure.castShadow = true;
    structure.receiveShadow = true;

    return structure;
  }

  /**
   * Update structures based on motion and animation
   * @param {number} time - Current time in seconds
   */
  update(time) {
    this.structures.forEach((structureData, id) => {
      const { spec, object, initialPosition, initialScale } = structureData;

      // Update motion
      if (spec.motion) {
        this._updateMotion(object, spec.motion, time, initialPosition);
      }

      // Update animation
      if (spec.animation) {
        this._updateAnimation(object, spec.animation, time, initialScale);
      }
    });
  }

  /**
   * Update structure motion
   * @private
   */
  _updateMotion(object, motion, time, initialPosition) {
    switch (motion.type) {
      case 'move_to':
        this._updateMoveTo(object, motion, time, initialPosition);
        break;
      case 'move_along':
        this._updateMoveAlong(object, motion, time);
        break;
      default:
        break;
    }
  }

  /**
   * Update move_to motion
   * @private
   */
  _updateMoveTo(object, motion, time, initialPosition) {
    const duration = motion.duration || 10;
    const progress = Math.min(time / duration, 1.0);

    // Apply easing
    const easedProgress = this._applyEasing(
      progress,
      motion.easing || 'linear'
    );

    // Interpolate position
    const from = initialPosition;
    const to = motion.to;

    object.position.set(
      from[0] + (to[0] - from[0]) * easedProgress,
      from[1] + (to[1] - from[1]) * easedProgress,
      from[2] + (to[2] - from[2]) * easedProgress
    );
  }

  /**
   * Update move_along motion
   * @private
   */
  _updateMoveAlong(object, motion, time) {
    if (!motion.path || motion.path.length < 2) return;

    const duration = motion.duration || 10;
    const progress = Math.min(time / duration, 1.0);
    const easedProgress = this._applyEasing(
      progress,
      motion.easing || 'linear'
    );

    // Calculate position along path
    const pathLength = motion.path.length - 1;
    const pathProgress = easedProgress * pathLength;
    const segmentIndex = Math.floor(pathProgress);
    const segmentProgress = pathProgress - segmentIndex;

    if (segmentIndex >= pathLength) {
      // End of path
      const lastPoint = motion.path[motion.path.length - 1];
      object.position.set(lastPoint[0], lastPoint[1], lastPoint[2]);
    } else {
      // Interpolate between path points
      const from = motion.path[segmentIndex];
      const to = motion.path[segmentIndex + 1];

      object.position.set(
        from[0] + (to[0] - from[0]) * segmentProgress,
        from[1] + (to[1] - from[1]) * segmentProgress,
        from[2] + (to[2] - from[2]) * segmentProgress
      );
    }
  }

  /**
   * Update structure animation
   * @private
   */
  _updateAnimation(object, animation, time, initialScale) {
    switch (animation.type) {
      case 'scale':
        this._updateScaleAnimation(object, animation, time, initialScale);
        break;
      case 'rotate':
        this._updateRotateAnimation(object, animation, time);
        break;
      case 'orbit':
        this._updateOrbitAnimation(object, animation, time);
        break;
      default:
        break;
    }
  }

  /**
   * Update scale animation
   * @private
   */
  _updateScaleAnimation(object, animation, time, initialScale) {
    const duration = animation.duration || 10;
    const progress = Math.min(time / duration, 1.0);
    const easedProgress = this._applyEasing(
      progress,
      animation.easing || 'linear'
    );

    const from = animation.from || initialScale;
    const to = animation.to || 1.0;
    const scale = from + (to - from) * easedProgress;

    object.scale.setScalar(scale);
  }

  /**
   * Update rotate animation
   * @private
   */
  _updateRotateAnimation(object, animation, time) {
    const speed = animation.speed || 1.0;
    object.rotation.y = time * speed;
  }

  /**
   * Update orbit animation
   * @private
   */
  _updateOrbitAnimation(object, animation, time) {
    const speed = animation.speed || 0.3;
    const amplitude = animation.amplitude || 40;

    const angle = time * speed;
    object.position.x = Math.cos(angle) * amplitude;
    object.position.z = Math.sin(angle) * amplitude;
  }

  /**
   * Apply easing function
   * @private
   */
  _applyEasing(t, easing) {
    switch (easing) {
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return t * (2 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      case 'linear':
      default:
        return t;
    }
  }

  /**
   * Get structure object by ID
   * @param {string} id - Structure ID
   * @returns {Object|null} Structure data
   */
  getStructure(id) {
    return this.structures.get(id) || null;
  }

  /**
   * Dispose of all structures
   */
  dispose() {
    this.structures.forEach((structureData) => {
      const { object } = structureData;
      object.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.scene.remove(object);
    });

    this.structures.clear();
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.StructureRenderer = StructureRenderer;
}
