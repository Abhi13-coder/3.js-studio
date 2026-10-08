/**
 * RUNTIME SIMULATION STEP PHYSICS WORLD
 * Rapier (asm.js / pure JS fallback) + bi-directional sync map
 */
export class PhysicsWorld {
  constructor() {
    this.world = null;
    this.physicsMap = new Map(); // Mesh → { rigidBody, collider }
    this.gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.RAPIER = null;
    this._ready = false;
  }

  async init() {
    // Rapier compat build exposes init() that loads the pure-JS / asm.js path
    // (no .wasm required – safe for older 32-bit WebViews)
    if (typeof RAPIER === 'undefined') {
      throw new Error('RAPIER global not found – check CDN script tag');
    }
    this.RAPIER = RAPIER;
    await this.RAPIER.init();
    this.world = new this.RAPIER.World(this.gravity);
    this._ready = true;
    console.info('[Physics] Rapier world ready (asm.js path)');
  }

  setGravity(x, y, z) {
    this.gravity = { x, y, z };
    if (this.world) {
      this.world.gravity = this.gravity;
    }
  }

  /**
   * Create a rigid body + collider from a Three.js Mesh
   * and register in the bi-directional map.
   */
  addRigidBody(mesh, options = {}) {
    if (!this._ready) return null;
    const type = options.type || 'dynamic'; // dynamic | fixed | kinematic
    const mass = options.mass ?? 1.0;

    const desc = type === 'fixed'
      ? this.RAPIER.RigidBodyDesc.fixed()
      : type === 'kinematic'
        ? this.RAPIER.RigidBodyDesc.kinematicPositionBased()
        : this.RAPIER.RigidBodyDesc.dynamic().setAdditionalMass(mass);

    desc.setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
    const q = mesh.quaternion;
    desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

    const rigidBody = this.world.createRigidBody(desc);

    // Collider from geometry bounds
    let colliderDesc;
    if (mesh.geometry.type === 'BoxGeometry' || mesh.geometry.parameters?.width) {
      const p = mesh.geometry.parameters;
      const hx = (p.width || 1) * 0.5 * mesh.scale.x;
      const hy = (p.height || 1) * 0.5 * mesh.scale.y;
      const hz = (p.depth || 1) * 0.5 * mesh.scale.z;
      colliderDesc = this.RAPIER.ColliderDesc.cuboid(hx, hy, hz);
    } else if (mesh.geometry.type === 'SphereGeometry') {
      const r = (mesh.geometry.parameters.radius || 0.5) * mesh.scale.x;
      colliderDesc = this.RAPIER.ColliderDesc.ball(r);
    } else {
      // Fallback AABB
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      const hx = (bb.max.x - bb.min.x) * 0.5 * mesh.scale.x;
      const hy = (bb.max.y - bb.min.y) * 0.5 * mesh.scale.y;
      const hz = (bb.max.z - bb.min.z) * 0.5 * mesh.scale.z;
      colliderDesc = this.RAPIER.ColliderDesc.cuboid(Math.max(hx, 0.05), Math.max(hy, 0.05), Math.max(hz, 0.05));
    }

    if (type === 'dynamic') {
      colliderDesc.setDensity(1.0);
      colliderDesc.setFriction(0.6);
      colliderDesc.setRestitution(0.2);
    }

    const collider = this.world.createCollider(colliderDesc, rigidBody);
    this.physicsMap.set(mesh, { rigidBody, collider });
    return rigidBody;
  }

  /**
   * Heightfield collider from terrain generator data
   */
  addHeightfield(terrainData) {
    if (!this._ready) return;
    const { heights, nrows, ncols, scale } = terrainData;
    // Rapier heightfield expects a flat Float32Array of heights
    const desc = this.RAPIER.ColliderDesc.heightfield(nrows, ncols, heights, scale);
    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed();
    const body = this.world.createRigidBody(bodyDesc);
    this.world.createCollider(desc, body);
    // Store a sentinel so we can clear later
    this.physicsMap.set(terrainData.mesh, { rigidBody: body, collider: null });
  }

  /**
   * Project Rapier state → Three.js every frame (Play mode)
   */
  step(deltaTime) {
    if (!this._ready || !this.world) return;
    // Rapier internal timestep is fixed; we call step multiple times if needed
    // but for mobile we keep it simple: one step per frame with clamped dt
    this.world.timestep = Math.min(deltaTime, 1 / 30);
    this.world.step();

    for (const [mesh, entry] of this.physicsMap) {
      if (!entry.rigidBody || entry.rigidBody.isFixed()) continue;
      const t = entry.rigidBody.translation();
      const r = entry.rigidBody.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  /**
   * Freeze all dynamic bodies (Edit mode)
   */
  freezeAll() {
    for (const [, entry] of this.physicsMap) {
      if (entry.rigidBody && !entry.rigidBody.isFixed()) {
        entry.rigidBody.sleep();
      }
    }
  }

  /**
   * Push Three.js transform back into Rapier (after editor moves)
   */
  syncFromMesh(mesh) {
    const entry = this.physicsMap.get(mesh);
    if (!entry || !entry.rigidBody) return;
    entry.rigidBody.setTranslation({ x: mesh.position.x, y: mesh.position.y, z: mesh.position.z }, true);
    const q = mesh.quaternion;
    entry.rigidBody.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    entry.rigidBody.wakeUp();
  }

  getBody(mesh) {
    const e = this.physicsMap.get(mesh);
    return e ? e.rigidBody : null;
  }

  clear() {
    if (!this.world) return;
    // Remove all bodies
    for (const [, entry] of this.physicsMap) {
      if (entry.rigidBody) {
        this.world.removeRigidBody(entry.rigidBody);
      }
    }
    this.physicsMap.clear();
  }
}
