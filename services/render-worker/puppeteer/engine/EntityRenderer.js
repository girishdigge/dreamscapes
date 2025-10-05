/**
 * EntityRenderer - Handles rendering of dynamic entities (particles, swarms, etc.)
 * Supports attachment to moving structures and various motion types
 */

class EntityRenderer {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.options = options;
    this.entities = new Map(); // id -> entity object
    this.particleSystems = new Map(); // id -> particle system
  }

  /**
   * Create entities from dream data
   * @param {Array} entitiesData - Array of entity specifications
   * @param {Map} structures - Map of structure objects for attachment
   */
  createEntities(entitiesData, structures) {
    console.log(`Creating ${entitiesData.length} entities...`);

    entitiesData.forEach((entitySpec) => {
      try {
        const entity = this._createEntity(entitySpec, structures);
        if (entity) {
          this.entities.set(entitySpec.id, {
            spec: entitySpec,
            object: entity,
            attachedTo: entitySpec.motion?.attachTo || null,
          });
          this.scene.add(entity);
        }
      } catch (error) {
        console.error(`Failed to create entity ${entitySpec.id}:`, error);
      }
    });

    console.log(`Created ${this.entities.size} entities`);
  }

  /**
   * Create a single entity based on type
   * @private
   */
  _createEntity(spec, structures) {
    const type = spec.type.toLowerCase();

    // Determine entity type and create appropriate object
    if (
      type.includes('particle') ||
      type.includes('stream') ||
      type.includes('swarm')
    ) {
      return this._createParticleSystem(spec, structures);
    } else if (
      type.includes('butterfly') ||
      type.includes('bird') ||
      type.includes('seagull')
    ) {
      return this._createSwarmEntity(spec, structures);
    } else if (type.includes('orb') || type.includes('light')) {
      return this._createOrbEntity(spec, structures);
    } else {
      // Generic entity
      return this._createGenericEntity(spec, structures);
    }
  }

  /**
   * Create particle system
   * @private
   */
  _createParticleSystem(spec, structures) {
    const count = spec.count || 100;
    const params = spec.params || {};

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    // Parse color
    const color = new THREE.Color(params.color || '#ffffff');

    // Initialize particles
    for (let i = 0; i < count; i++) {
      // Random initial positions
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

      // Colors
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      // Sizes
      sizes[i] = (params.size || 1.0) * (0.5 + Math.random() * 0.5);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Create material
    const material = new THREE.PointsMaterial({
      size: params.size || 1.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Add glow if specified
    if (params.glow && params.glow > 0) {
      material.emissive = color;
      material.emissiveIntensity = params.glow;
    }

    // Create points
    const particles = new THREE.Points(geometry, material);
    particles.name = spec.id;

    // Store particle system data
    this.particleSystems.set(spec.id, {
      particles,
      count,
      params,
      motion: spec.motion,
      velocities: new Float32Array(count * 3), // For motion simulation
    });

    return particles;
  }

  /**
   * Create swarm entity (butterflies, birds, etc.)
   * @private
   */
  _createSwarmEntity(spec, structures) {
    const count = spec.count || 10;
    const params = spec.params || {};

    // Create group to hold all swarm members
    const swarmGroup = new THREE.Group();
    swarmGroup.name = spec.id;

    // Create individual swarm members
    for (let i = 0; i < count; i++) {
      const member = this._createSwarmMember(spec.type, params);

      // Random initial position within radius
      const radius = spec.motion?.radius || 10;
      const angle = (i / count) * Math.PI * 2;
      member.position.set(
        Math.cos(angle) * radius * Math.random(),
        (Math.random() - 0.5) * radius,
        Math.sin(angle) * radius * Math.random()
      );

      swarmGroup.add(member);
    }

    return swarmGroup;
  }

  /**
   * Create individual swarm member
   * @private
   */
  _createSwarmMember(type, params) {
    const size = params.size || 0.5;
    const color = new THREE.Color(params.color || '#ffffff');

    // Create simple geometry (triangle for butterfly/bird)
    const geometry = new THREE.ConeGeometry(size * 0.5, size, 3);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
    });

    if (params.glow && params.glow > 0) {
      material.emissive = color;
      material.emissiveIntensity = params.glow;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = Math.PI / 2; // Point forward

    return mesh;
  }

  /**
   * Create orb entity
   * @private
   */
  _createOrbEntity(spec, structures) {
    const count = spec.count || 10;
    const params = spec.params || {};
    const size = params.size || 1.0;
    const color = new THREE.Color(params.color || '#ffffff');

    // Create group for orbs
    const orbGroup = new THREE.Group();
    orbGroup.name = spec.id;

    // Create individual orbs
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.SphereGeometry(size * 0.5, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
      });

      if (params.glow && params.glow > 0) {
        material.emissive = color;
        material.emissiveIntensity = params.glow;
      }

      const orb = new THREE.Mesh(geometry, material);

      // Random initial position
      const radius = spec.motion?.radius || 15;
      const angle = (i / count) * Math.PI * 2;
      orb.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * radius,
        Math.sin(angle) * radius
      );

      orbGroup.add(orb);
    }

    return orbGroup;
  }

  /**
   * Create generic entity
   * @private
   */
  _createGenericEntity(spec, structures) {
    const params = spec.params || {};
    const size = params.size || 1.0;
    const color = new THREE.Color(params.color || '#ffffff');

    // Create simple cube as placeholder
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.8,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = spec.id;

    return mesh;
  }

  /**
   * Update entities based on motion and time
   * @param {number} time - Current time in seconds
   * @param {Map} structures - Map of structure objects for attachment
   */
  update(time, structures) {
    this.entities.forEach((entityData, id) => {
      const { spec, object, attachedTo } = entityData;
      const motion = spec.motion;

      if (!motion) return;

      // Get attached structure if specified
      let attachedStructure = null;
      if (attachedTo && structures.has(attachedTo)) {
        attachedStructure = structures.get(attachedTo).object;
      }

      // Update based on motion type
      switch (motion.type) {
        case 'wander':
          this._updateWanderMotion(object, motion, time, attachedStructure);
          break;
        case 'swarm':
          this._updateSwarmMotion(object, motion, time, attachedStructure);
          break;
        case 'trail':
          this._updateTrailMotion(object, motion, time, attachedStructure);
          break;
        case 'flow_between':
          this._updateFlowBetweenMotion(object, motion, time, structures);
          break;
        default:
          break;
      }

      // Update particle systems
      if (this.particleSystems.has(id)) {
        this._updateParticleSystem(id, time, attachedStructure);
      }
    });
  }

  /**
   * Update wander motion
   * @private
   */
  _updateWanderMotion(object, motion, time, attachedStructure) {
    const radius = motion.radius || 10;
    const frequency = motion.frequency || 0.5;
    const offset = motion.offset || [0, 0, 0];

    // Calculate base position (attached structure or center)
    let baseX = 0,
      baseY = 0,
      baseZ = 0;
    if (attachedStructure) {
      baseX = attachedStructure.position.x;
      baseY = attachedStructure.position.y;
      baseZ = attachedStructure.position.z;
    } else if (motion.center) {
      [baseX, baseY, baseZ] = motion.center;
    }

    // Add offset
    baseX += offset[0];
    baseY += offset[1];
    baseZ += offset[2];

    // Wander pattern using sine waves
    const wanderX = Math.sin(time * frequency) * radius;
    const wanderY = Math.sin(time * frequency * 0.7) * radius * 0.5;
    const wanderZ = Math.cos(time * frequency) * radius;

    object.position.set(baseX + wanderX, baseY + wanderY, baseZ + wanderZ);
  }

  /**
   * Update swarm motion
   * @private
   */
  _updateSwarmMotion(object, motion, time, attachedStructure) {
    const radius = motion.radius || 15;
    const frequency = motion.frequency || 0.5;
    const offset = motion.offset || [0, 0, 0];

    // Calculate base position
    let baseX = 0,
      baseY = 0,
      baseZ = 0;
    if (attachedStructure) {
      baseX = attachedStructure.position.x;
      baseY = attachedStructure.position.y;
      baseZ = attachedStructure.position.z;
    } else if (motion.center) {
      [baseX, baseY, baseZ] = motion.center;
    }

    // Add offset
    baseX += offset[0];
    baseY += offset[1];
    baseZ += offset[2];

    // Update each child in the swarm
    object.children.forEach((child, index) => {
      const phase = (index / object.children.length) * Math.PI * 2;
      const swarmX = Math.cos(time * frequency + phase) * radius;
      const swarmY = Math.sin(time * frequency * 0.5 + phase) * radius * 0.3;
      const swarmZ = Math.sin(time * frequency + phase) * radius;

      child.position.set(swarmX, swarmY, swarmZ);

      // Rotate to face movement direction
      child.lookAt(
        swarmX + Math.cos(time * frequency + phase),
        swarmY,
        swarmZ + Math.sin(time * frequency + phase)
      );
    });

    // Position the group at base location
    object.position.set(baseX, baseY, baseZ);
  }

  /**
   * Update trail motion
   * @private
   */
  _updateTrailMotion(object, motion, time, attachedStructure) {
    if (!attachedStructure) return;

    const offset = motion.offset || [0, 0, 0];

    // Position at attached structure with offset
    object.position.set(
      attachedStructure.position.x + offset[0],
      attachedStructure.position.y + offset[1],
      attachedStructure.position.z + offset[2]
    );
  }

  /**
   * Update flow between motion
   * @private
   */
  _updateFlowBetweenMotion(object, motion, time, structures) {
    if (!motion.targets || motion.targets.length < 2) return;

    const target1 = structures.get(motion.targets[0])?.object;
    const target2 = structures.get(motion.targets[1])?.object;

    if (!target1 || !target2) return;

    // Position between the two targets
    const progress = (Math.sin(time * 0.5) + 1) / 2; // Oscillate between 0 and 1
    object.position.lerpVectors(target1.position, target2.position, progress);
  }

  /**
   * Update particle system
   * @private
   */
  _updateParticleSystem(id, time, attachedStructure) {
    const system = this.particleSystems.get(id);
    if (!system) return;

    const { particles, motion, params } = system;
    const positions = particles.geometry.attributes.position.array;

    // Update particle positions based on motion
    for (let i = 0; i < system.count; i++) {
      const i3 = i * 3;

      // Simple animation - particles float and swirl
      const speed = params.speed || 1.0;
      const phase = i / system.count;

      positions[i3] += Math.sin(time * speed + phase) * 0.1;
      positions[i3 + 1] += Math.cos(time * speed * 0.7 + phase) * 0.1;
      positions[i3 + 2] += Math.sin(time * speed * 0.5 + phase) * 0.1;

      // Keep particles within bounds
      const maxDist = motion?.radius || 20;
      const dist = Math.sqrt(
        positions[i3] ** 2 + positions[i3 + 1] ** 2 + positions[i3 + 2] ** 2
      );
      if (dist > maxDist) {
        const scale = maxDist / dist;
        positions[i3] *= scale;
        positions[i3 + 1] *= scale;
        positions[i3 + 2] *= scale;
      }
    }

    particles.geometry.attributes.position.needsUpdate = true;

    // Position particle system at attached structure if specified
    if (attachedStructure && motion?.attachTo) {
      const offset = motion.offset || [0, 0, 0];
      particles.position.set(
        attachedStructure.position.x + offset[0],
        attachedStructure.position.y + offset[1],
        attachedStructure.position.z + offset[2]
      );
    }
  }

  /**
   * Spawn entity at runtime (for events)
   * @param {Object} entitySpec - Entity specification
   * @param {Map} structures - Map of structure objects
   */
  spawnEntity(entitySpec, structures) {
    console.log(`Spawning entity: ${entitySpec.entityId}`);

    const entity = this._createEntity(entitySpec.params, structures);
    if (entity) {
      this.entities.set(entitySpec.entityId, {
        spec: entitySpec.params,
        object: entity,
        attachedTo: entitySpec.params.motion?.attachTo || null,
      });
      this.scene.add(entity);
    }
  }

  /**
   * Dispose of all entities
   */
  dispose() {
    this.entities.forEach((entityData) => {
      const { object } = entityData;
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose());
        } else {
          object.material.dispose();
        }
      }
      this.scene.remove(object);
    });

    this.entities.clear();
    this.particleSystems.clear();
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.EntityRenderer = EntityRenderer;
}
