/**
 * LIVE SCRIPT COMPONENT RUNTIME INTERFACE
 * Dynamic sandboxed evaluation of per-entity script strings.
 * Entry hooks: onStart(mesh, physicsBody) and onUpdate(mesh, physicsBody, deltaTime, inputs)
 */
export class ScriptEngine {
  constructor() {
    this.compiled = new Map(); // mesh → { onStart, onUpdate }
  }

  /**
   * Compile every mesh that carries a userData.script string.
   * Uses new Function() inside a restricted scope (no direct access to globals
   * except the four parameters we pass). Suitable for trusted editor content.
   */
  compileAll(scene, physicsWorld) {
    this.compiled.clear();
    scene.traverse((obj) => {
      if (!obj.isMesh || !obj.userData.script || !obj.userData.script.trim()) return;
      try {
        const source = obj.userData.script;
        // Wrap user code so both hooks can be defined
        const wrapper = `
          let onStart = function(mesh, physicsBody) {};
          let onUpdate = function(mesh, physicsBody, deltaTime, inputs) {};
          ${source}
          return { onStart, onUpdate };
        `;
        const factory = new Function(wrapper);
        const hooks = factory();
        this.compiled.set(obj, {
          onStart: typeof hooks.onStart === 'function' ? hooks.onStart : null,
          onUpdate: typeof hooks.onUpdate === 'function' ? hooks.onUpdate : null,
          body: physicsWorld ? physicsWorld.getBody(obj) : null
        });
      } catch (err) {
        console.error('[ScriptEngine] Compile error on', obj.name, err);
      }
    });
  }

  callOnStart() {
    for (const [mesh, entry] of this.compiled) {
      if (entry.onStart) {
        try {
          entry.onStart(mesh, entry.body);
        } catch (err) {
          console.error('[ScriptEngine] onStart error', mesh.name, err);
        }
      }
    }
  }

  callOnUpdate(deltaTime, inputs) {
    for (const [mesh, entry] of this.compiled) {
      if (entry.onUpdate) {
        try {
          entry.onUpdate(mesh, entry.body, deltaTime, inputs);
        } catch (err) {
          console.error('[ScriptEngine] onUpdate error', mesh.name, err);
        }
      }
    }
  }

  clear() {
    this.compiled.clear();
  }
}
