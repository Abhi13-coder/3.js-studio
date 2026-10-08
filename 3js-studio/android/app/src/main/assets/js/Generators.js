/**
 * PROCEDURAL WORLD SCAPE METRICS
 * Fast heightmap terrain + mobile-friendly sine-wave water (no custom shaders)
 */

export class TerrainGenerator {
  /**
   * Create a visual PlaneGeometry + height array for Rapier heightfield.
   * @param {number} widthSegments
   * @param {number} depthSegments
   * @param {number} size – world size in meters
   * @param {number} heightScale – vertical amplitude
   */
  static create(widthSegments = 64, depthSegments = 64, size = 40, heightScale = 4) {
    const geo = new THREE.PlaneGeometry(size, size, widthSegments, depthSegments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const heights = new Float32Array((widthSegments + 1) * (depthSegments + 1));

    // Simple value-noise style heightmap (fast, no external lib)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // layered noise
      let h = 0;
      h += Math.sin(x * 0.15) * Math.cos(z * 0.12) * 0.6;
      h += Math.sin(x * 0.35 + 1.7) * Math.cos(z * 0.28) * 0.25;
      h += Math.sin(x * 0.8) * Math.sin(z * 0.7) * 0.08;
      h *= heightScale;
      pos.setY(i, h);
      heights[i] = h;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'Terrain';
    mesh.userData.isStatic = true;

    // Rapier heightfield scale: (x-scale, y-scale, z-scale)
    const scale = { x: size, y: 1.0, z: size };

    return {
      mesh,
      heights,
      nrows: depthSegments,
      ncols: widthSegments,
      scale
    };
  }
}

/**
 * Mobile-friendly water – CPU vertex waves, no shader compilation cost
 */
export class WaterMesh {
  static _instances = [];

  static create(width = 40, depth = 40, segments = 32) {
    const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
    geo.rotateX(-Math.PI / 2);

    // Store original Y so we can wave around it
    const pos = geo.attributes.position;
    const baseY = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      baseY[i] = pos.getY(i);
    }

    const mat = new THREE.MeshStandardMaterial({
      color: 0x1e90ff,
      transparent: true,
      opacity: 0.72,
      roughness: 0.15,
      metalness: 0.3,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.15;
    mesh.name = 'Water';
    mesh.userData.isWater = true;
    mesh.userData.baseY = baseY;
    mesh.userData.time = 0;
    mesh.userData.segments = segments;
    mesh.receiveShadow = true;

    WaterMesh._instances.push(mesh);
    return mesh;
  }

  static updateAll(deltaTime) {
    for (const mesh of WaterMesh._instances) {
      if (!mesh.parent) continue; // removed from scene
      mesh.userData.time += deltaTime;
      const t = mesh.userData.time;
      const pos = mesh.geometry.attributes.position;
      const baseY = mesh.userData.baseY;

      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        // cheap multi-wave
        const wave =
          Math.sin(x * 0.4 + t * 1.6) * 0.12 +
          Math.cos(z * 0.35 + t * 1.2) * 0.09 +
          Math.sin((x + z) * 0.25 + t * 0.9) * 0.06;
        pos.setY(i, baseY[i] + wave);
      }
      pos.needsUpdate = true;
      // normals every few frames would be nicer but costly; skip for mobile
    }
  }
}

// Expose for Engine loop
window.WaterMesh = WaterMesh;
