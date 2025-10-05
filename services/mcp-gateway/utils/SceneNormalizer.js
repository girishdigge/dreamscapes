/**
 * SceneNormalizer
 * Transforms any raw scene JSON into strict, minimal, animation-ready format
 */

class SceneNormalizer {
  static normalize(rawScene) {
    const normalized = {
      id: rawScene.id || this.generateId(),
      title: rawScene.title || 'Untitled Scene',
      structures: this.normalizeStructures(rawScene.structures || []),
      entities: this.normalizeEntities(rawScene.entities || []),
      camera: this.normalizeCamera(rawScene),
      environment: this.normalizeEnvironment(rawScene.environment || {}),
      render: this.normalizeRender(rawScene.render || {}),
      metadata: this.normalizeMetadata(rawScene),
    };
    return normalized;
  }

  static toRenderableFormat(normalizedScene) {
    const fps = normalizedScene.render?.fps || 30;
    const seed = normalizedScene.metadata?.seed || 12345;

    // Compute scene duration from camera shots
    const sceneDuration = this.computeSceneDuration(normalizedScene.camera);

    // Expand entities with motion interpolation
    const expandedEntities = this.expandEntities(
      normalizedScene.entities,
      seed
    );
    const entitiesWithMotion = expandedEntities.map((e) =>
      this.expandEntityMotion(e, fps, sceneDuration)
    );

    // Expand camera timeline with orbit refinement
    const cameraTimeline = this.expandCameraTimeline(
      normalizedScene.camera,
      fps,
      normalizedScene.structures,
      normalizedScene.entities
    );

    return {
      id: normalizedScene.id,
      title: normalizedScene.title,
      sceneDuration,
      structures: this.structuresToArrays(normalizedScene.structures),
      entities: entitiesWithMotion,
      camera: cameraTimeline,
      environment: this.expandEnvironmentTimeline(
        normalizedScene.environment,
        sceneDuration
      ),
      render: normalizedScene.render,
      metadata: normalizedScene.metadata,
    };
  }

  static computeSceneDuration(shots) {
    if (!shots || shots.length === 0) return 10;
    return Math.max(
      ...shots.map((s) => (s.startTime || 0) + (s.duration || 0))
    );
  }

  static structuresToArrays(structures) {
    return structures.map((s) => ({
      id: s.id,
      type: s.type,
      pos: [s.pos.x, s.pos.y, s.pos.z],
      scale: s.scale,
      rotation: s.rotation,
      features: s.features,
    }));
  }

  static expandEntities(entities, seed) {
    const expanded = [];
    let rng = this.seededRandom(seed);

    for (const entity of entities) {
      if (entity.count > 1) {
        for (let i = 0; i < entity.count; i++) {
          expanded.push({
            id: `${entity.id}_${i}`,
            type: entity.type,
            count: 1,
            params: entity.params,
            motion: entity.motion,
            offset: this.randomOffset(i, entity.count, rng),
          });
        }
      } else {
        expanded.push({ ...entity, offset: [0, 0, 0] });
      }
    }
    return expanded;
  }

  static seededRandom(seed) {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  static randomOffset(index, total, rng) {
    const angle = (index / total) * Math.PI * 2;
    const radius = 5 + rng() * 10;
    return [
      Math.cos(angle) * radius,
      (rng() - 0.5) * 5,
      Math.sin(angle) * radius,
    ];
  }

  static expandEntityMotion(entity, fps, duration) {
    const motion = entity.motion;
    const frameCount = Math.ceil(duration * fps);
    const frames = [];
    const offset = entity.offset || [0, 0, 0];

    for (let i = 0; i <= frameCount; i++) {
      const time = i / fps;
      const t = time * motion.speed;

      let pos, rot;

      switch (motion.type) {
        case 'orbit':
          pos = this.computeOrbitPosition(t, motion, offset);
          rot = [0, t * Math.PI * 2, 0];
          break;

        case 'float':
          pos = this.computeFloatPosition(t, motion, offset);
          rot = [Math.sin(t * 0.5) * 0.1, Math.cos(t * 0.3) * 0.1, 0];
          break;

        case 'vertical':
          pos = this.computeVerticalPosition(t, motion, offset);
          rot = [0, 0, 0];
          break;

        case 'wander':
          pos = this.computeWanderPosition(t, motion, offset);
          rot = [0, Math.sin(t) * 0.5, 0];
          break;

        case 'swarm':
          pos = this.computeSwarmPosition(t, motion, offset);
          rot = [
            Math.sin(t * 2) * 0.2,
            Math.cos(t * 1.5) * 0.3,
            Math.sin(t * 1.2) * 0.1,
          ];
          break;

        default:
          pos = offset;
          rot = [0, 0, 0];
      }

      frames.push({
        time,
        position: pos,
        rotation: rot,
      });
    }

    return {
      id: entity.id,
      type: entity.type,
      params: entity.params,
      motion: motion,
      frames,
    };
  }

  static computeOrbitPosition(t, motion, offset) {
    const radius = motion.radius || 10;
    const randomness = motion.randomness || 0;
    const angle = t * Math.PI * 2;

    return [
      offset[0] + Math.cos(angle) * radius + Math.sin(t * 3) * randomness,
      offset[1] + Math.sin(t * 2) * randomness,
      offset[2] + Math.sin(angle) * radius + Math.cos(t * 3) * randomness,
    ];
  }

  static computeFloatPosition(t, motion, offset) {
    const amplitude = motion.amplitude || 3;
    const randomness = motion.randomness || 0;

    return [
      offset[0] + Math.sin(t * 0.5) * randomness,
      offset[1] + Math.sin(t) * amplitude,
      offset[2] + Math.cos(t * 0.7) * randomness,
    ];
  }

  static computeVerticalPosition(t, motion, offset) {
    const amplitude = motion.amplitude || 5;
    const randomness = motion.randomness || 0;

    return [
      offset[0] + Math.sin(t * 2) * randomness,
      offset[1] + (t % 1) * amplitude,
      offset[2] + Math.cos(t * 2) * randomness,
    ];
  }

  static computeWanderPosition(t, motion, offset) {
    const radius = motion.radius || 15;
    const randomness = motion.randomness || 0.5;

    return [
      offset[0] +
        Math.sin(t * 0.3) * radius +
        Math.sin(t * 2.1) * randomness * 5,
      offset[1] + Math.sin(t * 0.5) * 3,
      offset[2] +
        Math.cos(t * 0.4) * radius +
        Math.cos(t * 1.7) * randomness * 5,
    ];
  }

  static computeSwarmPosition(t, motion, offset) {
    const radius = motion.radius || 12;
    const randomness = motion.randomness || 0.4;

    return [
      offset[0] + Math.sin(t * 1.2) * radius + Math.sin(t * 5) * randomness * 3,
      offset[1] + Math.cos(t * 1.5) * 5 + Math.sin(t * 4) * randomness * 2,
      offset[2] + Math.cos(t * 0.9) * radius + Math.cos(t * 6) * randomness * 3,
    ];
  }

  static expandCameraTimeline(shots, fps, structures, entities) {
    return shots.map((shot) => {
      const expanded = {
        startTime: shot.startTime,
        duration: shot.duration,
        endTime: shot.startTime + shot.duration,
        position: [shot.position.x, shot.position.y, shot.position.z],
        lookAt: [shot.lookAt.x, shot.lookAt.y, shot.lookAt.z],
        fov: shot.fov,
        movement: this.normalizeMovementType(shot.movement),
        easing: shot.easing,
        transition: shot.transition,
      };

      if (expanded.movement === 'orbit') {
        const lookAt = [shot.lookAt.x, shot.lookAt.y, shot.lookAt.z];
        const nearestTarget = this.findNearestTarget(
          lookAt,
          structures,
          entities
        );

        if (nearestTarget) {
          expanded.orbitCenter = nearestTarget;
        } else {
          expanded.orbitCenter = lookAt;
        }

        const dx = shot.position.x - expanded.orbitCenter[0];
        const dy = shot.position.y - expanded.orbitCenter[1];
        const dz = shot.position.z - expanded.orbitCenter[2];
        expanded.orbitRadius = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }

      expanded.frames = this.expandTimingCurve(expanded, fps);
      return expanded;
    });
  }

  static findNearestTarget(lookAt, structures, entities) {
    let nearest = null;
    let minDist = Infinity;

    // Check structures
    for (const s of structures || []) {
      const pos = s.pos;
      const dx = lookAt[0] - pos.x;
      const dy = lookAt[1] - pos.y;
      const dz = lookAt[2] - pos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < minDist && dist < 20) {
        minDist = dist;
        nearest = [pos.x, pos.y, pos.z];
      }
    }

    return nearest;
  }

  static normalizeMovementType(movement) {
    const map = {
      slow_orbit: 'orbit',
      fast_orbit: 'orbit',
      orbit: 'orbit',
      slow_push: 'push',
      fast_push: 'push',
      push: 'push',
      push_in: 'push',
      slow_pull: 'pull',
      fast_pull: 'pull',
      pull: 'pull',
      pull_back: 'pull',
      smooth_pull: 'pull',
      dolly: 'dolly',
      follow: 'dolly',
      track: 'dolly',
      pan: 'dolly',
      static: 'static',
      establishing: 'orbit',
      tracking: 'dolly',
      close_up: 'push',
      flythrough: 'dolly',
    };
    return map[movement] || 'static';
  }

  static expandTimingCurve(shot, fps) {
    const frameCount = Math.ceil(shot.duration * fps);
    const frames = [];
    for (let i = 0; i <= frameCount; i++) {
      const t = i / frameCount;
      const easedT = this.applyEasing(t, shot.easing);
      frames.push({
        time: shot.startTime + t * shot.duration,
        progress: easedT,
        frame: i,
      });
    }
    return frames;
  }

  static applyEasing(t, easing) {
    switch (easing) {
      case 'linear':
        return t;
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return t * (2 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      default:
        return t;
    }
  }

  static expandEnvironmentTimeline(env, duration) {
    const timeline = env.timeline || [];

    // If no timeline, create static environment
    if (timeline.length === 0) {
      return {
        preset: env.preset,
        fog: env.fog,
        skyColor: env.skyColor,
        ambientLight: env.ambientLight,
        timeline: [
          { time: 0, fog: env.fog, ambientLight: env.ambientLight },
          { time: duration, fog: env.fog, ambientLight: env.ambientLight },
        ],
      };
    }

    // Ensure timeline is sorted and has start/end
    const sorted = [...timeline].sort((a, b) => a.time - b.time);
    if (sorted[0].time > 0) {
      sorted.unshift({ time: 0, ...sorted[0] });
    }
    if (sorted[sorted.length - 1].time < duration) {
      sorted.push({ time: duration, ...sorted[sorted.length - 1] });
    }

    return {
      preset: env.preset,
      fog: env.fog,
      skyColor: env.skyColor,
      ambientLight: env.ambientLight,
      timeline: sorted,
    };
  }

  static normalizeStructures(structures) {
    return structures.map((s, index) => ({
      id: s.id || `s${index + 1}`,
      type: s.type || 'generic',
      pos: this.normalizePosition(s.pos || s.position),
      scale: typeof s.scale === 'number' ? s.scale : 1.0,
      rotation: this.normalizeRotation(s.rotation),
      features: Array.isArray(s.features) ? s.features : [],
    }));
  }

  static normalizeEntities(entities) {
    return entities.map((e, index) => ({
      id: e.id || `e${index + 1}`,
      type: e.type || 'generic',
      count: typeof e.count === 'number' ? e.count : 1,
      params: this.normalizeParams(e.params || {}),
      motion: this.inferMotion(e),
    }));
  }

  static inferMotion(entity) {
    if (
      entity.motion &&
      typeof entity.motion === 'object' &&
      entity.motion.type
    ) {
      return this.cleanMotion(entity.motion);
    }

    const type = entity.type || 'generic';
    const rules = {
      floating_orb: { type: 'orbit', speed: 0.5, radius: 10, randomness: 0.2 },
      orb: { type: 'orbit', speed: 0.5, radius: 10, randomness: 0.2 },
      sphere: { type: 'orbit', speed: 0.4, radius: 8, randomness: 0.15 },
      book_swarm: { type: 'swarm', speed: 0.8, radius: 15, randomness: 0.4 },
      butterfly_swarm: {
        type: 'swarm',
        speed: 1.2,
        radius: 12,
        randomness: 0.5,
      },
      particle_swarm: {
        type: 'swarm',
        speed: 1.0,
        radius: 10,
        randomness: 0.3,
      },
      particle_stream: {
        type: 'vertical',
        speed: 1.5,
        amplitude: 5,
        randomness: 0.3,
      },
      fountain: { type: 'vertical', speed: 2.0, amplitude: 8, randomness: 0.4 },
      light_butterfly: {
        type: 'wander',
        speed: 0.6,
        radius: 20,
        randomness: 0.6,
      },
      firefly: { type: 'wander', speed: 0.5, radius: 15, randomness: 0.7 },
      cloud: { type: 'float', speed: 0.3, amplitude: 2, randomness: 0.2 },
      mist: { type: 'float', speed: 0.2, amplitude: 3, randomness: 0.3 },
    };

    if (rules[type]) return rules[type];

    const lower = type.toLowerCase();
    for (const [key, motion] of Object.entries(rules)) {
      if (lower.includes(key) || key.includes(lower)) return motion;
    }

    if (lower.includes('swarm') || lower.includes('flock')) {
      return { type: 'swarm', speed: 1.0, radius: 12, randomness: 0.4 };
    }
    if (lower.includes('float') || lower.includes('hover')) {
      return { type: 'float', speed: 0.4, amplitude: 3, randomness: 0.2 };
    }
    if (lower.includes('orbit') || lower.includes('circle')) {
      return { type: 'orbit', speed: 0.5, radius: 10, randomness: 0.2 };
    }
    if (lower.includes('stream') || lower.includes('rise')) {
      return { type: 'vertical', speed: 1.5, amplitude: 5, randomness: 0.3 };
    }
    if (lower.includes('wander') || lower.includes('butterfly')) {
      return { type: 'wander', speed: 0.6, radius: 15, randomness: 0.5 };
    }

    return { type: 'float', speed: 0.5, amplitude: 2, randomness: 0.2 };
  }

  static cleanMotion(motion) {
    const cleaned = { type: motion.type || 'float' };
    if (typeof motion.speed === 'number') cleaned.speed = motion.speed;
    if (typeof motion.radius === 'number') cleaned.radius = motion.radius;
    if (typeof motion.amplitude === 'number')
      cleaned.amplitude = motion.amplitude;
    if (typeof motion.randomness === 'number')
      cleaned.randomness = motion.randomness;

    if (!cleaned.speed) cleaned.speed = 0.5;
    if (cleaned.type === 'orbit' && !cleaned.radius) cleaned.radius = 10;
    if (cleaned.type === 'swarm' && !cleaned.radius) cleaned.radius = 12;
    if (
      (cleaned.type === 'float' || cleaned.type === 'vertical') &&
      !cleaned.amplitude
    ) {
      cleaned.amplitude = 3;
    }
    if (!cleaned.randomness) cleaned.randomness = 0.2;

    return cleaned;
  }

  static normalizeCamera(rawScene) {
    let shots = [];

    if (Array.isArray(rawScene.camera) && rawScene.camera.length > 0) {
      shots = rawScene.camera.map((shot) => this.normalizeCameraShot(shot));
    } else if (
      rawScene.cinematography &&
      Array.isArray(rawScene.cinematography.shots)
    ) {
      shots = rawScene.cinematography.shots.map((shot) =>
        this.convertCinematographyShot(shot)
      );
    } else {
      shots = this.createDefaultCameraSequence();
    }

    shots.sort((a, b) => a.startTime - b.startTime);
    return this.deduplicateShots(shots);
  }

  static normalizeCameraShot(shot) {
    return {
      startTime: typeof shot.startTime === 'number' ? shot.startTime : 0,
      duration: typeof shot.duration === 'number' ? shot.duration : 3,
      position: this.extractPosition(shot),
      lookAt: this.extractLookAt(shot),
      fov: typeof shot.fov === 'number' ? shot.fov : 60,
      movement: shot.movement || this.normalizeMovementType(shot.type),
      easing: shot.easing || 'ease-in-out',
      transition: shot.transition || 'smooth',
    };
  }

  static convertCinematographyShot(shot) {
    return {
      startTime: typeof shot.startTime === 'number' ? shot.startTime : 0,
      duration: typeof shot.duration === 'number' ? shot.duration : 3,
      position: this.normalizePosition(shot.startPos),
      lookAt: this.normalizePosition(shot.target) || { x: 0, y: 0, z: 0 },
      fov: typeof shot.fov === 'number' ? shot.fov : 60,
      movement: this.normalizeMovementType(shot.type),
      easing: 'ease-in-out',
      transition: 'smooth',
    };
  }

  static extractPosition(shot) {
    if (shot.camera && shot.camera.position)
      return this.normalizePosition(shot.camera.position);
    if (shot.camera && shot.camera.startPosition)
      return this.normalizePosition(shot.camera.startPosition);
    if (shot.position) return this.normalizePosition(shot.position);
    if (shot.startPos) return this.normalizePosition(shot.startPos);
    return { x: 0, y: 10, z: 20 };
  }

  static extractLookAt(shot) {
    if (shot.camera && shot.camera.lookAt)
      return this.normalizePosition(shot.camera.lookAt);
    if (shot.lookAt) return this.normalizePosition(shot.lookAt);
    if (shot.target && typeof shot.target === 'object') {
      if (shot.target.text || shot.target.type) return { x: 0, y: 0, z: 0 };
      return this.normalizePosition(shot.target);
    }
    return { x: 0, y: 0, z: 0 };
  }

  static createDefaultCameraSequence() {
    return [
      {
        startTime: 0,
        duration: 4,
        position: { x: 0, y: 20, z: 40 },
        lookAt: { x: 0, y: 0, z: 0 },
        fov: 60,
        movement: 'orbit',
        easing: 'ease-in-out',
        transition: 'cut',
      },
      {
        startTime: 4,
        duration: 3,
        position: { x: 5, y: 5, z: 15 },
        lookAt: { x: 0, y: 0, z: 0 },
        fov: 45,
        movement: 'push',
        easing: 'ease-in-out',
        transition: 'smooth',
      },
      {
        startTime: 7,
        duration: 3,
        position: { x: 0, y: 30, z: 50 },
        lookAt: { x: 0, y: 0, z: 0 },
        fov: 70,
        movement: 'pull',
        easing: 'ease-in-out',
        transition: 'smooth',
      },
    ];
  }

  static deduplicateShots(shots) {
    const unique = [];
    let lastEndTime = 0;
    for (const shot of shots) {
      if (shot.startTime < lastEndTime) continue;
      unique.push(shot);
      lastEndTime = shot.startTime + shot.duration;
    }
    return unique;
  }

  static normalizeEnvironment(env) {
    return {
      preset: env.preset || 'day',
      fog: typeof env.fog === 'number' ? env.fog : 0.3,
      skyColor: env.skyColor || '#87ceeb',
      ambientLight:
        typeof env.ambientLight === 'number' ? env.ambientLight : 0.8,
      timeline: env.timeline || [],
    };
  }

  static normalizeRender(render) {
    return {
      res: Array.isArray(render.res) ? render.res : [1280, 720],
      fps: typeof render.fps === 'number' ? render.fps : 30,
      quality: render.quality || 'medium',
    };
  }

  static normalizeMetadata(rawScene) {
    return {
      seed:
        rawScene.seed ||
        rawScene.metadata?.seed ||
        Math.floor(Math.random() * 100000),
      originalText:
        rawScene.originalText || rawScene.metadata?.originalText || '',
    };
  }

  static normalizeParams(params) {
    return {
      speed: typeof params.speed === 'number' ? params.speed : 1.0,
      glow: typeof params.glow === 'number' ? params.glow : 0.5,
      size: typeof params.size === 'number' ? params.size : 1.0,
      color: params.color || '#ffffff',
    };
  }

  static normalizePosition(pos) {
    if (!pos) return { x: 0, y: 0, z: 0 };
    if (Array.isArray(pos)) {
      return {
        x: typeof pos[0] === 'number' ? pos[0] : 0,
        y: typeof pos[1] === 'number' ? pos[1] : 0,
        z: typeof pos[2] === 'number' ? pos[2] : 0,
      };
    }
    if (typeof pos === 'object') {
      return {
        x: typeof pos.x === 'number' ? pos.x : 0,
        y: typeof pos.y === 'number' ? pos.y : 0,
        z: typeof pos.z === 'number' ? pos.z : 0,
      };
    }
    return { x: 0, y: 0, z: 0 };
  }

  static normalizeRotation(rot) {
    if (!rot) return [0, 0, 0];
    if (Array.isArray(rot)) {
      return [
        typeof rot[0] === 'number' ? rot[0] : 0,
        typeof rot[1] === 'number' ? rot[1] : 0,
        typeof rot[2] === 'number' ? rot[2] : 0,
      ];
    }
    return [0, 0, 0];
  }

  static generateId() {
    return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = SceneNormalizer;
