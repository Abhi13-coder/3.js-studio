/**
 * HARDWARE-ACCELERATED VISUAL LAYER
 * Optimized for 32-bit Android WebView / low-tier mobile GPUs
 */
export class Engine {
  constructor(container) {
    this.container = container;
    this.fps = 0;
    this._frameCount = 0;
    this._lastFpsTime = performance.now();
    this._lastTime = performance.now();
    this._raf = null;
    this._running = false;

    // Renderer – explicit low-tier mobile flags
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
      precision: 'mediump',
      stencil: false,
      depth: true,
      logarithmicDepthBuffer: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.physicallyCorrectLights = true;
    container.appendChild(this.renderer.domElement);

    // Canvas-loss recovery
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('[Engine] WebGL context lost – pausing');
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
    }, false);

    this.renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.info('[Engine] WebGL context restored – re-initializing');
      this._reinitAfterContextLoss();
      this.start();
    }, false);

    // Scene + Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1220);
    this.scene.fog = new THREE.Fog(0x0b1220, 40, 120);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(8, 6, 12);
    this.camera.lookAt(0, 0, 0);

    // Orbit controls (edit mode navigation)
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 80;
    this.controls.target.set(0, 1, 0);

    // Transform gizmos
    this.transformControls = new THREE.TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.setSize(0.85);
    this.transformControls.addEventListener('dragging-changed', (e) => {
      this.controls.enabled = !e.value;
    });
    this.scene.add(this.transformControls);

    this.setupDefaultLighting();
    this._addGround();

    window.addEventListener('resize', () => this._onResize());
  }

  setupDefaultLighting() {
    // Remove previous lights if any
    const toRemove = this.scene.children.filter(c => c.isLight);
    toRemove.forEach(l => this.scene.remove(l));

    const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x1a1a2e, 0.55);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xfff4e0, 1.1);
    dir.position.set(12, 22, 8);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 1024;
    dir.shadow.mapSize.height = 1024;
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 60;
    dir.shadow.camera.left = -20;
    dir.shadow.camera.right = 20;
    dir.shadow.camera.top = 20;
    dir.shadow.camera.bottom = -20;
    dir.shadow.bias = -0.0005;
    this.scene.add(dir);

    const amb = new THREE.AmbientLight(0x404060, 0.25);
    this.scene.add(amb);
  }

  _addGround() {
    const geo = new THREE.PlaneGeometry(80, 80);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.name = 'Ground';
    ground.userData.isStatic = true;
    this.scene.add(ground);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _reinitAfterContextLoss() {
    // Re-create renderer if needed (rare on modern WebView)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._loop();
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  /**
   * Frame-clamped animation loop.
   * DeltaTime is clamped to avoid spiral-of-death on low-end devices.
   */
  _loop = () => {
    if (!this._running) return;
    this._raf = requestAnimationFrame(this._loop);

    const now = performance.now();
    let deltaTime = (now - this._lastTime) / 1000;
    this._lastTime = now;

    // Clamp delta (max 33 ms ≈ 30 fps floor)
    if (deltaTime > 0.033) deltaTime = 0.033;
    if (deltaTime < 0) deltaTime = 0.016;

    // FPS counter
    this._frameCount++;
    if (now - this._lastFpsTime >= 1000) {
      this.fps = this._frameCount;
      this._frameCount = 0;
      this._lastFpsTime = now;
    }

    // Controls
    this.controls.update();

    // Physics step (only in Play mode)
    if (window.mode === 'play' && window.physics) {
      window.physics.step(deltaTime);
    }

    // Script updates
    if (window.mode === 'play' && window.scriptEngine) {
      window.scriptEngine.callOnUpdate(deltaTime, window.inputs || { x: 0, y: 0 });
    }

    // Water animation
    if (window.WaterMesh && window.WaterMesh.updateAll) {
      window.WaterMesh.updateAll(deltaTime);
    }

    this.renderer.render(this.scene, this.camera);
  };
}
