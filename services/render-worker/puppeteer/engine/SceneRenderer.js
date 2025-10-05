/**
 * SceneRenderer - Main 3D rendering engine
 * Manages Three.js scene, camera, renderer, and coordinates all subsystems
 */

class SceneRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = {
      quality: options.quality || 'medium',
      enableShadows: options.enableShadows !== false,
      enablePostProcessing: options.enablePostProcessing !== false,
      ...options,
    };

    // Three.js core objects (will be initialized)
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Subsystems (will be initialized)
    this.assetLibrary = null;
    this.materialSystem = null;
    this.animationController = null;
    this.cameraController = null;

    // State
    this.renderObjects = new Map();
    this.isAnimating = false;
    this.currentTime = 0;
    this.dreamData = null;
    this.animationFrameId = null;
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fpsWarningThreshold = 20;

    // Performance monitoring
    this.performanceStats = {
      fps: 60,
      frameTime: 0,
      memoryUsage: 0,
      lowFpsCount: 0,
      lastMemoryCheck: 0,
    };
    this.performanceCheckInterval = 60; // Check every 60 frames
    this.autoQualityAdjustment = options.autoQualityAdjustment !== false;

    // Initialize Three.js
    this._initThreeJS();

    // Set up resize handler
    this._setupResizeHandler();
  }

  /**
   * Initialize Three.js scene, camera, and renderer
   * @private
   */
  _initThreeJS() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000011);

    // Create camera
    const aspect = this.canvas.width / this.canvas.height;
    this.camera = new THREE.PerspectiveCamera(
      75, // FOV
      aspect, // Aspect ratio
      0.1, // Near plane
      10000 // Far plane
    );
    this.camera.position.set(0, 50, 100);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this._getQualitySetting('antialias'),
      alpha: true,
      powerPreference: 'high-performance',
    });

    // Configure renderer based on quality level
    this._configureRenderer();

    // Set initial size
    this.renderer.setSize(this.canvas.width, this.canvas.height);
    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        this._getQualitySetting('maxPixelRatio')
      )
    );

    console.log(
      `SceneRenderer initialized with quality: ${this.options.quality}`
    );
  }

  /**
   * Configure renderer settings based on quality level
   * @private
   */
  _configureRenderer() {
    // Shadow settings
    if (this.options.enableShadows && this._getQualitySetting('shadows')) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // Tone mapping
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Color encoding
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    // Additional settings
    this.renderer.physicallyCorrectLights = true;
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
        antialias: false,
        maxPixelRatio: 1,
        shadows: false,
        shadowMapSize: 1024,
        geometrySegments: 8,
        maxParticles: 1000,
        postProcessing: false,
      },
      medium: {
        antialias: true,
        maxPixelRatio: 2,
        shadows: true,
        shadowMapSize: 2048,
        geometrySegments: 16,
        maxParticles: 5000,
        postProcessing: true,
      },
      high: {
        antialias: true,
        maxPixelRatio: 2,
        shadows: true,
        shadowMapSize: 4096,
        geometrySegments: 32,
        maxParticles: 10000,
        postProcessing: true,
      },
    };

    const quality = this.options.quality || 'medium';
    return (
      qualitySettings[quality]?.[setting] ?? qualitySettings.medium[setting]
    );
  }

  /**
   * Set up viewport resize handler
   * @private
   */
  _setupResizeHandler() {
    this._resizeHandler = () => {
      if (!this.camera || !this.renderer) return;

      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;

      // Update camera aspect ratio
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      // Update renderer size
      this.renderer.setSize(width, height, false);

      console.log(`Viewport resized to ${width}x${height}`);
    };

    window.addEventListener('resize', this._resizeHandler);

    // Set up visibility change handler to pause/resume
    this._visibilityHandler = () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    };

    document.addEventListener('visibilitychange', this._visibilityHandler);
  }

  /**
   * Initialize Three.js scene from dream JSON
   * @param {Object} dreamData - Dream JSON specification
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  initWithDream(dreamData, width, height) {
    console.log('Initializing scene with dream data...');

    // Store dream data
    this.dreamData = dreamData;

    // Set canvas size
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderer.setSize(width, height, false);

    // Update camera aspect ratio
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Load the scene
    this.loadScene(dreamData);

    console.log(`Scene initialized: ${width}x${height}`);
  }

  /**
   * Render scene at specific time (for deterministic frame generation)
   * @param {number} timeSec - Time in seconds
   */
  seek(timeSec) {
    // Update current time
    this.currentTime = timeSec;

    // Update animations
    if (this.animationController) {
      this.animationController.update(timeSec, this.renderObjects);
    }

    // Update camera
    if (this.cameraController) {
      this.cameraController.update(timeSec);
    }

    // Update shader uniforms (for animated materials)
    if (this.materialSystem) {
      this.materialSystem.updateShaderUniforms(timeSec);
    }

    // Render the frame
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Load scene from dream data
   * @param {Object} dreamData - Dream JSON specification
   */
  loadScene(dreamData) {
    console.log('Loading scene...');

    // Clear existing scene
    this.clearScene();

    // Initialize subsystems
    if (!this.assetLibrary) {
      this.assetLibrary = new AssetLibrary(this.scene, this.options);
    }
    if (!this.materialSystem) {
      this.materialSystem = new MaterialSystem(this.options);
    }
    if (!this.animationController) {
      this.animationController = new AnimationController();
    }

    // Initialize structure and entity renderers
    this.structureRenderer = new StructureRenderer(
      this.scene,
      this.assetLibrary,
      this.materialSystem,
      this.options
    );
    this.entityRenderer = new EntityRenderer(this.scene, this.options);

    // Set up environment
    if (dreamData.environment) {
      this.setupEnvironment(dreamData.environment);
    }

    // Create structures
    if (dreamData.structures && Array.isArray(dreamData.structures)) {
      this.structureRenderer.createStructures(dreamData.structures);
      // Store structures in renderObjects for compatibility
      dreamData.structures.forEach((spec) => {
        const structureData = this.structureRenderer.getStructure(spec.id);
        if (structureData) {
          this.renderObjects.set(spec.id, structureData);
        }
      });
    }

    // Create entities
    if (dreamData.entities && Array.isArray(dreamData.entities)) {
      this.entityRenderer.createEntities(
        dreamData.entities,
        this.structureRenderer.structures
      );
    }

    // Set up camera - support both new and legacy schemas
    if (dreamData.camera && Array.isArray(dreamData.camera)) {
      // New camera schema
      this.setupCamera(dreamData.camera);
    } else if (dreamData.cinematography) {
      // Legacy cinematography schema
      this.setupCinematography(dreamData.cinematography);
    } else {
      // Initialize camera controller with default orbital view
      if (!this.cameraController) {
        this.cameraController = new CameraController(this.camera, this.scene);
      }
      this.cameraController.setupShots([]);
    }

    console.log(`Scene loaded with ${this.renderObjects.size} objects`);
  }

  /**
   * Clear scene and dispose of all objects
   */
  clearScene() {
    console.log('Clearing scene...');

    // Remove all objects from scene
    while (this.scene.children.length > 0) {
      const object = this.scene.children[0];

      // Dispose geometry and materials
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose());
        } else {
          object.material.dispose();
        }
      }

      this.scene.remove(object);
    }

    // Clear render objects map
    this.renderObjects.clear();

    // Reset subsystems
    if (this.animationController) {
      this.animationController = null;
    }
    if (this.cameraController) {
      this.cameraController = null;
    }

    console.log('Scene cleared');
  }

  /**
   * Set up environment with skybox, lighting, and atmospheric effects
   * @param {Object} environment - Environment configuration
   */
  setupEnvironment(environment) {
    console.log('Setting up environment...', environment);

    if (!environment) {
      console.warn('No environment configuration provided, using defaults');
      environment = {};
    }

    // Initialize material system if not already created
    if (!this.materialSystem) {
      this.materialSystem = new MaterialSystem(this.options);
    }

    // Set up skybox
    this._setupSkybox(environment);

    // Set up lighting
    this._setupLighting(environment);

    // Set up atmospheric effects (fog)
    this._setupAtmosphere(environment);

    console.log('Environment setup complete');
  }

  /**
   * Set up skybox based on environment configuration
   * @private
   * @param {Object} environment - Environment configuration
   */
  _setupSkybox(environment) {
    // Determine skybox type from environment preset or explicit skybox setting
    let skyboxType = environment.skybox;

    // Map environment presets to skybox types if no explicit skybox specified
    if (!skyboxType && environment.preset) {
      const presetToSkybox = {
        space: 'galaxy',
        underwater: 'underwater',
        forest: 'void', // Forest uses simple void with green tint
        desert: 'sunset',
        city: 'void',
        dusk: 'sunset',
        dawn: 'sunset',
        night: 'void',
        void: 'void',
      };
      skyboxType = presetToSkybox[environment.preset] || 'void';
    }

    // Default to void if nothing specified
    skyboxType = skyboxType || 'void';

    console.log(`Creating skybox: ${skyboxType}`);

    // Create skybox geometry (large sphere)
    const skyboxGeometry = new THREE.SphereGeometry(5000, 32, 32);

    // Create skybox material based on type
    let skyboxMaterial;
    switch (skyboxType.toLowerCase()) {
      case 'galaxy':
        skyboxMaterial = this.materialSystem.createGalaxySkybox();
        break;
      case 'nebula':
        skyboxMaterial = this.materialSystem.createNebulaSkybox();
        break;
      case 'sunset':
        skyboxMaterial = this.materialSystem.createSunsetSkybox();
        break;
      case 'underwater':
        skyboxMaterial = this.materialSystem.createUnderwaterSkybox();
        break;
      case 'void':
      default:
        skyboxMaterial = this.materialSystem.createVoidSkybox();
        break;
    }

    // Create skybox mesh
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    skybox.name = 'skybox';

    // Add to scene
    this.scene.add(skybox);

    // Update scene background color if specified
    if (environment.skyColor) {
      try {
        this.scene.background = new THREE.Color(environment.skyColor);
      } catch (error) {
        console.warn(
          `Invalid skyColor: ${environment.skyColor}, using default`
        );
        this.scene.background = new THREE.Color(0x000011);
      }
    }

    console.log(`Skybox created: ${skyboxType}`);
  }

  /**
   * Set up lighting based on environment configuration
   * @private
   * @param {Object} environment - Environment configuration
   */
  _setupLighting(environment) {
    const lighting = environment.lighting || {};

    // Create ambient light
    const ambientIntensity =
      lighting.ambient !== undefined ? lighting.ambient : 0.4;
    const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
    ambientLight.name = 'ambientLight';
    this.scene.add(ambientLight);
    console.log(`Ambient light created with intensity: ${ambientIntensity}`);

    // Create directional light (sun-like)
    if (lighting.directional) {
      const dirLight = lighting.directional;
      const intensity =
        dirLight.intensity !== undefined ? dirLight.intensity : 1.0;
      const position = dirLight.position || [100, 100, 50];
      const color = dirLight.color || '#ffffff';

      let lightColor;
      try {
        lightColor = new THREE.Color(color);
      } catch (error) {
        console.warn(`Invalid light color: ${color}, using white`);
        lightColor = new THREE.Color(0xffffff);
      }

      const directionalLight = new THREE.DirectionalLight(
        lightColor,
        intensity
      );
      directionalLight.position.set(position[0], position[1], position[2]);
      directionalLight.name = 'directionalLight';

      // Configure shadows if enabled
      if (this.options.enableShadows && this._getQualitySetting('shadows')) {
        directionalLight.castShadow = true;

        // Shadow map settings based on quality
        const shadowMapSize = this._getQualitySetting('shadowMapSize') || 2048;
        directionalLight.shadow.mapSize.width = shadowMapSize;
        directionalLight.shadow.mapSize.height = shadowMapSize;

        // Shadow camera bounds
        const shadowCameraBounds = 100;
        directionalLight.shadow.camera.left = -shadowCameraBounds;
        directionalLight.shadow.camera.right = shadowCameraBounds;
        directionalLight.shadow.camera.top = shadowCameraBounds;
        directionalLight.shadow.camera.bottom = -shadowCameraBounds;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;

        // Shadow bias to prevent artifacts
        directionalLight.shadow.bias = -0.0001;

        console.log(
          `Directional light shadows enabled (${shadowMapSize}x${shadowMapSize})`
        );
      }

      this.scene.add(directionalLight);
      console.log(`Directional light created at [${position.join(', ')}]`);
    } else {
      // Add default directional light if none specified
      const defaultLight = new THREE.DirectionalLight(0xffffff, 0.8);
      defaultLight.position.set(100, 100, 50);
      defaultLight.name = 'directionalLight';

      if (this.options.enableShadows && this._getQualitySetting('shadows')) {
        defaultLight.castShadow = true;
        defaultLight.shadow.mapSize.width = 2048;
        defaultLight.shadow.mapSize.height = 2048;
        defaultLight.shadow.camera.left = -100;
        defaultLight.shadow.camera.right = 100;
        defaultLight.shadow.camera.top = 100;
        defaultLight.shadow.camera.bottom = -100;
        defaultLight.shadow.camera.near = 0.5;
        defaultLight.shadow.camera.far = 500;
        defaultLight.shadow.bias = -0.0001;
      }

      this.scene.add(defaultLight);
      console.log('Default directional light created');
    }
  }

  /**
   * Set up atmospheric effects (fog)
   * @private
   * @param {Object} environment - Environment configuration
   */
  _setupAtmosphere(environment) {
    // Set up fog if specified
    if (environment.fog !== undefined && environment.fog > 0) {
      const fogDensity = Math.max(0, Math.min(1, environment.fog));

      // Calculate fog distances based on density
      // Higher density = closer fog
      const near = 50 * (1 - fogDensity * 0.8);
      const far = 1000 * (1 - fogDensity * 0.5);

      // Determine fog color
      let fogColor;
      if (environment.skyColor) {
        try {
          fogColor = new THREE.Color(environment.skyColor);
        } catch (error) {
          console.warn(
            `Invalid fog color: ${environment.skyColor}, using default`
          );
          fogColor = new THREE.Color(0x000011);
        }
      } else {
        // Use scene background color or default
        fogColor = this.scene.background || new THREE.Color(0x000011);
      }

      // Create fog
      this.scene.fog = new THREE.Fog(fogColor, near, far);
      console.log(
        `Fog created with density: ${fogDensity} (near: ${near.toFixed(
          1
        )}, far: ${far.toFixed(1)})`
      );
    } else {
      // Remove fog if it exists
      this.scene.fog = null;
      console.log('No fog applied');
    }
  }

  /**
   * Set up camera with new schema
   * @param {Array} cameraShots - Array of camera shot specifications
   */
  setupCamera(cameraShots) {
    console.log('Setting up camera...', cameraShots);

    // Initialize camera controller if not already created
    if (!this.cameraController) {
      this.cameraController = new CameraController(this.camera, this.scene);
    }

    // Convert new camera schema to format expected by CameraController
    const shots = cameraShots.map((shot) => {
      return {
        type: shot.movement,
        target: shot.target || null,
        lookAt: shot.lookAt || null,
        duration: shot.duration,
        startPos: shot.position,
        endPos: shot.position, // Will be calculated by controller
        fov: shot.fov,
        easing: shot.easing,
        transition: shot.transition,
        startTime: shot.startTime,
      };
    });

    this.cameraController.setupShots(shots);
  }

  /**
   * Set up cinematography (legacy support)
   * @param {Object} cinematography - Cinematography configuration
   */
  setupCinematography(cinematography) {
    console.log('Setting up cinematography (legacy)...', cinematography);

    // Initialize camera controller if not already created
    if (!this.cameraController) {
      this.cameraController = new CameraController(this.camera, this.scene);
    }

    // Set up shots from cinematography configuration
    if (cinematography.shots && Array.isArray(cinematography.shots)) {
      this.cameraController.setupShots(cinematography.shots);
    } else {
      // No shots specified, will use default orbital view
      this.cameraController.setupShots([]);
    }
  }

  /**
   * Start animation loop
   */
  startAnimation() {
    if (this.isAnimating) {
      console.log('Animation already running');
      return;
    }

    console.log('Starting animation loop...');
    this.isAnimating = true;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this._animate();
  }

  /**
   * Animation loop (internal)
   * @private
   */
  _animate() {
    if (!this.isAnimating) return;

    // Request next frame
    this.animationFrameId = requestAnimationFrame(() => this._animate());

    // Calculate delta time
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = currentTime;

    // Update current time
    this.currentTime += deltaTime;

    // Performance monitoring
    this.frameCount++;
    this._updatePerformanceStats(deltaTime);

    // Check performance periodically
    if (this.frameCount % this.performanceCheckInterval === 0) {
      this._checkPerformance();
    }

    // Update subsystems
    this._updateSubsystems(this.currentTime);

    // Render the scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Update all subsystems
   * @private
   * @param {number} time - Current time in seconds
   */
  _updateSubsystems(time) {
    // Update structures
    if (this.structureRenderer) {
      this.structureRenderer.update(time);
    }

    // Update entities
    if (this.entityRenderer) {
      this.entityRenderer.update(
        time,
        this.structureRenderer?.structures || new Map()
      );
    }

    // Update animations
    if (this.animationController) {
      this.animationController.update(time, this.renderObjects);
    }

    // Update camera
    if (this.cameraController) {
      this.cameraController.update(time);
    }

    // Update shader uniforms (for animated materials)
    if (this.materialSystem) {
      this.materialSystem.updateShaderUniforms(time);
    }

    // Handle events
    if (this.dreamData?.events) {
      this._handleEvents(time);
    }
  }

  /**
   * Handle timed events
   * @private
   * @param {number} time - Current time in seconds
   */
  _handleEvents(time) {
    if (!this.dreamData?.events) return;

    this.dreamData.events.forEach((event) => {
      // Check if event should trigger (within 0.1s window)
      if (Math.abs(time - event.timeSec) < 0.1 && !event._triggered) {
        event._triggered = true;
        this._triggerEvent(event);
      }
    });
  }

  /**
   * Trigger an event
   * @private
   * @param {Object} event - Event specification
   */
  _triggerEvent(event) {
    console.log(`Triggering event at ${event.timeSec}s:`, event.type);

    switch (event.type) {
      case 'spawn_entity':
        if (this.entityRenderer) {
          this.entityRenderer.spawnEntity(
            event,
            this.structureRenderer?.structures || new Map()
          );
        }
        break;
      case 'explosion':
        this._handleExplosion(event);
        break;
      case 'environment_change':
        this._handleEnvironmentChange(event);
        break;
      default:
        console.warn(`Unknown event type: ${event.type}`);
    }
  }

  /**
   * Handle explosion event
   * @private
   */
  _handleExplosion(event) {
    // Create explosion particles
    const particleCount = event.particleCount || 500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    // Get explosion center from targets
    let centerX = 0,
      centerY = 0,
      centerZ = 0;
    if (event.targets && event.targets.length > 0) {
      const target = this.renderObjects.get(event.targets[0]);
      if (target?.object) {
        centerX = target.object.position.x;
        centerY = target.object.position.y;
        centerZ = target.object.position.z;
      }
    }

    // Create explosion particles
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = centerX + (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = centerY + (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = centerZ + (Math.random() - 0.5) * 10;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 2.0,
      color: '#FF6600',
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const explosionParticles = new THREE.Points(geometry, material);
    this.scene.add(explosionParticles);

    // Remove after a short time
    setTimeout(() => {
      this.scene.remove(explosionParticles);
      geometry.dispose();
      material.dispose();
    }, 2000);

    // Light flash
    if (event.lightFlash) {
      const flash = new THREE.PointLight('#FFFFFF', 10, 100);
      flash.position.set(centerX, centerY, centerZ);
      this.scene.add(flash);

      setTimeout(() => {
        this.scene.remove(flash);
      }, 200);
    }
  }

  /**
   * Handle environment change event
   * @private
   */
  _handleEnvironmentChange(event) {
    if (!event.params) return;

    // Gradually change environment settings
    const duration = event.params.duration || 1;
    const startTime = this.currentTime;

    // Store original values
    const originalAmbient = this.scene.children.find(
      (c) => c.name === 'ambientLight'
    )?.intensity;
    const originalFog = this.scene.fog?.far;

    // Animate changes (simplified - would need proper tweening in production)
    if (event.params.ambientLight !== undefined) {
      const ambientLight = this.scene.children.find(
        (c) => c.name === 'ambientLight'
      );
      if (ambientLight) {
        ambientLight.intensity = event.params.ambientLight;
      }
    }

    if (event.params.fog !== undefined && this.scene.fog) {
      const fogDensity = event.params.fog;
      const near = 50 * (1 - fogDensity * 0.8);
      const far = 1000 * (1 - fogDensity * 0.5);
      this.scene.fog.near = near;
      this.scene.fog.far = far;
    }
  }

  /**
   * Pause rendering
   */
  pause() {
    if (!this.isAnimating) return;

    console.log('Pausing animation...');
    this.isAnimating = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Resume rendering
   */
  resume() {
    if (this.isAnimating) return;

    console.log('Resuming animation...');
    this.isAnimating = true;
    this.lastFrameTime = performance.now();
    this._animate();
  }

  /**
   * Update performance statistics
   * @private
   * @param {number} deltaTime - Time since last frame in seconds
   */
  _updatePerformanceStats(deltaTime) {
    // Calculate FPS
    const fps = 1 / deltaTime;
    this.performanceStats.fps = fps;
    this.performanceStats.frameTime = deltaTime * 1000; // Convert to ms

    // Track low FPS occurrences
    if (fps < this.fpsWarningThreshold) {
      this.performanceStats.lowFpsCount++;
    }
  }

  /**
   * Check performance and log warnings or adjust quality
   * @private
   */
  _checkPerformance() {
    const stats = this.performanceStats;

    // Log FPS warning if below threshold
    if (stats.fps < this.fpsWarningThreshold) {
      console.warn(
        `Low FPS detected: ${stats.fps.toFixed(
          1
        )} FPS (frame time: ${stats.frameTime.toFixed(2)}ms)`
      );
    }

    // Check memory usage if available
    if (performance.memory) {
      const memoryMB = performance.memory.usedJSHeapSize / (1024 * 1024);
      stats.memoryUsage = memoryMB;

      // Log memory warning if usage is high
      if (memoryMB > 512) {
        console.warn(`High memory usage detected: ${memoryMB.toFixed(1)} MB`);
      }

      // Auto-adjust quality if enabled and performance is poor
      if (
        this.autoQualityAdjustment &&
        stats.lowFpsCount > 10 &&
        this.options.quality !== 'draft'
      ) {
        this._adjustQualityDown();
      }
    }

    // Log performance stats periodically
    if (this.frameCount % (this.performanceCheckInterval * 10) === 0) {
      console.log(
        `Performance Stats - FPS: ${stats.fps.toFixed(
          1
        )}, Frame Time: ${stats.frameTime.toFixed(
          2
        )}ms, Memory: ${stats.memoryUsage.toFixed(1)}MB`
      );
    }

    // Reset low FPS counter periodically
    if (this.frameCount % (this.performanceCheckInterval * 5) === 0) {
      stats.lowFpsCount = 0;
    }
  }

  /**
   * Automatically reduce quality level to improve performance
   * @private
   */
  _adjustQualityDown() {
    const currentQuality = this.options.quality;
    let newQuality;

    if (currentQuality === 'high') {
      newQuality = 'medium';
    } else if (currentQuality === 'medium') {
      newQuality = 'draft';
    } else {
      // Already at lowest quality
      console.warn(
        'Performance issues detected but already at lowest quality level'
      );
      return;
    }

    console.warn(
      `Auto-adjusting quality from ${currentQuality} to ${newQuality} due to performance issues`
    );

    // Update quality setting
    this.options.quality = newQuality;

    // Reconfigure renderer with new quality settings
    this._configureRenderer();

    // Reset low FPS counter
    this.performanceStats.lowFpsCount = 0;

    // Note: Existing objects won't be updated, but new objects will use the new quality
    // For a full quality change, the scene would need to be reloaded
  }

  /**
   * Get current performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    return {
      fps: this.performanceStats.fps,
      frameTime: this.performanceStats.frameTime,
      memoryUsage: this.performanceStats.memoryUsage,
      quality: this.options.quality,
      objectCount: this.renderObjects.size,
    };
  }

  /**
   * Clean up all resources
   */
  dispose() {
    console.log('Disposing SceneRenderer resources...');

    // Stop animation
    this.pause();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Remove resize handler
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }

    // Remove visibility handler
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }

    // Dispose subsystems
    if (this.assetLibrary && typeof this.assetLibrary.dispose === 'function') {
      this.assetLibrary.dispose();
    }
    if (
      this.materialSystem &&
      typeof this.materialSystem.dispose === 'function'
    ) {
      this.materialSystem.dispose();
    }

    // Dispose scene objects
    if (this.scene) {
      this.scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      this.scene.clear();
    }

    // Dispose renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    // Clear state
    this.renderObjects.clear();
    this.dreamData = null;

    console.log('SceneRenderer disposed');
  }
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.SceneRenderer = SceneRenderer;
}
