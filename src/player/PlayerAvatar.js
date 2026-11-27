import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { createCharacter } from "../characters/CharacterFactory.js";

/**
 * A world-space player representation.
 *
 * The local first-person avatar uses layer 1 so the first-person camera does
 * not render its own body. Remote avatars can use layer 0 and remain visible
 * to the normal game camera. The same class is used for both.
 */
export class PlayerAvatar {
  constructor(model, { renderLayer = 1, facingOffset = 0 } = {}) {
    this.root = new THREE.Group();
    this.root.name = "PlayerAvatar";
    this.model = model;
    this.renderLayer = renderLayer;
    this.facingOffset = facingOffset;
    this.root.add(model);
    this.root.traverse(object => object.layers.set(renderLayer));
    this.root.traverse(object => {
      if (object.isMesh) {
        object.frustumCulled = false;
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    this.walkPhase = 0;
    this.bob = 0;
  }

  static async create(options = {}) {
    const model = await createCharacter({
      gender: options.gender ?? "male",
      height: options.height ?? 1.72
    });
    return new PlayerAvatar(model, options);
  }

  addTo(scene) {
    scene.add(this.root);
    return this;
  }

  update({ x = 0, z = 0, yaw = 0, speed = 0, delta = 0 } = {}) {
    const dt = Math.max(0, Math.min(delta, 0.05));
    const moving = speed > 0.08;
    if (moving) this.walkPhase += dt * Math.min(speed / 2.15, 1) * 9;
    const targetBob = moving ? Math.abs(Math.sin(this.walkPhase * 2)) * 0.025 : 0;
    const alpha = 1 - Math.exp(-dt * 10);
    this.bob += (targetBob - this.bob) * alpha;

    this.root.position.set(x, this.bob, z);
    this.root.rotation.set(0, yaw + this.facingOffset, 0);
  }

  dispose() {
    this.root.traverse(object => {
      if (object.isMesh) {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material?.dispose());
      }
    });
    this.root.removeFromParent();
  }
}
