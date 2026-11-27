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
      const target = active.find(item => item.object === hit.object || item.object.getObjectById(hit.object.id));
      if (target && hit.distance <= target.maxDistance) { this.current = target; break; }
    }
    return this.current;
  }
  getCurrent() { return this.current; }
  dispose() { this.targets.length = 0; this.current = null; }
}
