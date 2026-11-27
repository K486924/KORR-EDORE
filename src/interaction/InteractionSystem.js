import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export class InteractionSystem {
  constructor(camera) {
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.center = new THREE.Vector2(0, 0);
    this.targets = [];
    this.current = null;
  }
  register(object, options = {}) {
    const target = { object, id: options.id || object.uuid, label: options.label || "INTERACT",
      maxDistance: options.maxDistance ?? 3.2, enabled: options.enabled || (() => true) };
    this.targets.push(target);
    return target;
  }
  update() {
    this.raycaster.setFromCamera(this.center, this.camera);
    const active = this.targets.filter(target => target.enabled());
    const hits = this.raycaster.intersectObjects(active.map(target => target.object), true);
    this.current = null;
    for (const hit of hits) {
      // Prefer the most specific registered object. A vehicle root is also an
      // ancestor of its doors/bonnet; it must not swallow those part targets.
      let target = null;
      let bestDepth = -1;
      for (const item of active) {
        if (item.object !== hit.object && !item.object.getObjectById(hit.object.id)) continue;
        let depth = 0;
        for (let node = item.object; node; node = node.parent) depth++;
        if (depth > bestDepth) { bestDepth = depth; target = item; }
      }
      if (target && hit.distance <= target.maxDistance) { this.current = target; break; }
    }
    return this.current;
  }
  getCurrent() { return this.current; }
  dispose() { this.targets.length = 0; this.current = null; }
}
