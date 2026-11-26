import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GRID, SOLID_CELLS, cellCenter } from "../level/layout.js";
import { VIEWMODEL_CONFIG } from "../config/viewmodel.js";
import { LIGHT_CONFIG, FEATURE_CONFIG } from "../config/lighting.js";

function makeNoiseTexture(base, speckle, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9500; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const a = Math.random() * 0.16;
    ctx.fillStyle = speckle;
    ctx.globalAlpha = a;
    ctx.fillRect(x, y, Math.random() * 3 + 1, Math.random() * 3 + 1);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090d0e);
    this.scene.fog = new THREE.FogExp2(0x111819, 0.038);
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.05, 90);
    this.camera.position.set(0, 1.62, 7.5);
    this.camera.rotation.order = "YXZ";

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: "high-performance",
      alpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = FEATURE_CONFIG.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.82;

    this.elapsed = 0;
    this.flickerValue = 0;
    this.dipTimer = 0;
    this.flashlightEnabled = true;
    this.beamDirection = new THREE.Vector3(0, 0, -1);
    this._lightWorldPosition = new THREE.Vector3();
    this._beamTargetWorld = new THREE.Vector3();
    this.levelRoot = null;
    this.buildWorld();
    this.buildViewModel();
    this.buildFlashlight();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  box(parent, size, position, material, cast = true, receive = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  }

  buildWorld() {
    this.levelRoot = new THREE.Group();
    this.scene.add(this.levelRoot);
    const world = this.levelRoot;
    const wallTex = makeNoiseTexture("#343a36", "#c0b69a");
    const floorTex = makeNoiseTexture("#242827", "#8d8878");
    const plaster = new THREE.MeshStandardMaterial({ map: wallTex, color: 0x777b70, roughness: 0.96 });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, color: 0x77756b, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x171d1b, roughness: 0.94 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x393b34, roughness: 0.86 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x292b27, roughness: 0.82 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x252b28, roughness: 1 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x555b55, metalness: 0.62, roughness: 0.5 });

    // Narrow residential passage: deliberately imperfect, not a clean game corridor.
    this.box(world, [5.8, 0.22, 39], [0, -0.12, -10], floorMat);
    this.box(world, [5.8, 0.18, 39], [0, 3.45, -10], ceilingMat, false);
    // Build visible wall geometry from the exact same solid cells used by collision.
    const wallGeometry = new THREE.BoxGeometry(GRID.cellSize, 3.5, GRID.cellSize);
    const wallInstances = new THREE.InstancedMesh(wallGeometry, plaster, SOLID_CELLS.length);
    const wallMatrix = new THREE.Matrix4();
    SOLID_CELLS.forEach((cell, index) => {
      const center = cellCenter(cell.x, cell.z);
      wallMatrix.makeTranslation(center.x, 1.62, center.z);
      wallInstances.setMatrixAt(index, wallMatrix);
    });
    wallInstances.instanceMatrix.needsUpdate = true;
    wallInstances.castShadow = true;
    wallInstances.receiveShadow = true;
    world.add(wallInstances);

    // Skirting and ceiling seams.
    for (const x of [-2.77, 2.77]) {
      this.box(world, [0.06, 0.22, 38.5], [x, 0.12, -10], trim, false);
      this.box(world, [0.08, 0.12, 38.5], [x * 0.985, 3.32, -10], dark, false);
    }

    // Repeating doors, each with slightly different proportions and details.
    for (let i = 0; i < 6; i++) {
      const z = 4 - i * 5.8;
      for (const side of [-1, 1]) {
        const x = side * 2.78;
        const door = this.box(world, [0.10, 2.35 + (i % 2) * 0.12, 1.18], [x, 1.18, z], doorMat);
        door.rotation.y = side < 0 ? 0.015 : -0.015;
        this.box(world, [0.13, 0.12, 1.42], [x, 2.43, z], trim, false);
        this.box(world, [0.13, 2.5, 0.12], [x, 1.22, z - 0.65], trim, false);
        this.box(world, [0.13, 2.5, 0.12], [x, 1.22, z + 0.65], trim, false);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), metal);
        knob.position.set(side * 2.67, 1.05, z + (side > 0 ? -0.35 : 0.35));
        world.add(knob);
        // A dark recess behind the door frame.
        this.box(world, [0.025, 2.18, 0.94], [side * 2.66, 1.16, z], dark, false);
      }
    }

    // A distant doorway that is subtly too tall.
    this.box(world, [1.65, 2.95, 0.16], [0, 1.48, -27.8], dark);
    this.box(world, [0.12, 3.2, 0.2], [-0.88, 1.58, -27.7], trim, false);
    this.box(world, [0.12, 3.2, 0.2], [0.88, 1.58, -27.7], trim, false);
    this.box(world, [1.9, 0.12, 0.2], [0, 3.12, -27.7], trim, false);

    // Water stains, exposed pipes and small architectural irregularities.
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x303a37, metalness: 0.72, roughness: 0.58 });
    for (const side of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 37, 8), pipeMat);
      pipe.position.set(side * 2.55, 2.72, -10);
      world.add(pipe);
      for (let i = 0; i < 13; i++) {
        const stain = new THREE.Mesh(
          new THREE.BoxGeometry(0.018, 0.45 + Math.random() * 1.1, 0.12 + Math.random() * 0.22),
          new THREE.MeshStandardMaterial({ color: 0x202b27, transparent: true, opacity: 0.22, roughness: 1 })
        );
        stain.position.set(side * (2.775 + Math.random() * 0.004), 0.6 + Math.random() * 2.4, 6 - Math.random() * 34);
        world.add(stain);
      }
    }

    // Ceiling fixtures with restrained, cold light and occasional flicker.
    world.add(new THREE.HemisphereLight(0x9caeaa, 0x171a17, 0.055));
    world.add(new THREE.AmbientLight(0x71817c, 0.025));
    for (let i = 0; i < 5; i++) {
      const z = 5 - i * 7;
      this.box(world, [0.78, 0.045, 0.22], [0, 3.32, z], new THREE.MeshStandardMaterial({
        color: 0x899b91, emissive: 0x61786d, emissiveIntensity: 0.22
      }), false);
    }

    // One crooked ceiling panel and a small floor obstruction give the space scale.
    const panel = this.box(world, [1.25, 0.07, 1.7], [1.1, 3.28, -13.5], trim);
    panel.rotation.z = 0.035;
    const debris = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.36), dark);
    debris.position.set(-1.25, 0.02, -5.2);
    debris.rotation.y = 0.45;
    world.add(debris);
  }

  buildViewModel() {
    const cfg = VIEWMODEL_CONFIG;
    this.viewModel = new THREE.Group();
    this.viewModel.position.set(cfg.position.x, cfg.position.y, cfg.position.z);
    this.viewModel.rotation.set(cfg.rotation.x, cfg.rotation.y, cfg.rotation.z);
    this.viewModel.scale.setScalar(cfg.handScale);
    this.viewModel.frustumCulled = false;

    const sleeve = new THREE.MeshStandardMaterial({
      color: 0x252c29, roughness: 0.96, metalness: 0.02,
      depthTest: false, depthWrite: false
    });
    const glove = new THREE.MeshStandardMaterial({
      color: 0x62564b, roughness: 0.98, metalness: 0,
      depthTest: false, depthWrite: false
    });
    const seam = new THREE.MeshStandardMaterial({
      color: 0x111715, roughness: 1,
      depthTest: false, depthWrite: false
    });

    const addPart = (geometry, material, position, rotation = [0, 0, 0]) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      mesh.renderOrder = cfg.renderOrder;
      mesh.frustumCulled = false;
      this.viewModel.add(mesh);
      return mesh;
    };

    addPart(new THREE.BoxGeometry(0.17, 0.16, 0.39), sleeve,
      [-0.015, -0.025, 0.17], [-0.18, 0.02, -0.20]);
    addPart(new THREE.BoxGeometry(0.178, 0.17, 0.055), seam,
      [-0.01, -0.02, -0.015], [-0.18, 0.02, -0.20]);
    addPart(new THREE.BoxGeometry(0.145, 0.085, 0.145), glove,
      [0.018, -0.005, -0.105], [-0.12, 0.04, -0.12]);
    for (let i = 0; i < 4; i++) {
      addPart(new THREE.BoxGeometry(0.031, 0.045, 0.105 - i * 0.006), glove,
        [-0.032 + i * 0.034, -0.025, -0.205], [-0.12, 0.02, -0.10]);
    }
    addPart(new THREE.BoxGeometry(0.045, 0.05, 0.105), glove,
      [0.105, 0.018, -0.105], [0.12, 0.02, -0.62]);

    this.camera.add(this.viewModel);
  }

  buildFlashlight() {
    const cfg = VIEWMODEL_CONFIG;
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x202725, metalness: 0.72, roughness: 0.38,
      depthTest: false, depthWrite: false
    });
    const rubber = new THREE.MeshStandardMaterial({
      color: 0x101614, roughness: 0.92,
      depthTest: false, depthWrite: false
    });
    const lens = new THREE.MeshStandardMaterial({
      color: 0x8b9d91, emissive: 0x526b5c, emissiveIntensity: 0.35,
      metalness: 0.18, roughness: 0.24,
      depthTest: false, depthWrite: false
    });
    const add = (geometry, material, position, rotation = [-Math.PI / 2, 0, 0]) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      mesh.renderOrder = cfg.renderOrder + 1;
      mesh.frustumCulled = false;
      this.viewModel.add(mesh);
      return mesh;
    };
    add(new THREE.CylinderGeometry(0.043, 0.043, 0.34, 12), darkMetal, [0.035, 0.045, -0.25]);
    add(new THREE.CylinderGeometry(0.061, 0.047, 0.075, 12), darkMetal, [0.035, 0.045, -0.445]);
    add(new THREE.CylinderGeometry(0.047, 0.047, 0.012, 12), rubber, [0.035, 0.045, -0.49]);
    add(new THREE.CylinderGeometry(0.039, 0.039, 0.008, 12), lens, [0.035, 0.045, -0.501]);
    add(new THREE.BoxGeometry(0.035, 0.018, 0.045), rubber, [0.075, 0.09, -0.24], [0, 0, 0]);

    this.flashlight = new THREE.SpotLight(
      0xe0eadf, cfg ? LIGHT_CONFIG.intensity : LIGHT_CONFIG.intensity,
      LIGHT_CONFIG.distance, LIGHT_CONFIG.angle, LIGHT_CONFIG.penumbra, LIGHT_CONFIG.decay
    );
    this.flashlight.position.set(0.425, -0.385, -1.205);
    this.flashlight.castShadow = false;
    this.flashlight.shadow.autoUpdate = false;
    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0.425, -0.43, -9.5);
    this.flashlight.target = this.flashlightTarget;
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlightTarget);
    this.beamDirection.copy(this.camera.getWorldDirection(new THREE.Vector3()));
    this.flashlight.visible = this.flashlightEnabled;
  }

  setFlashlightEnabled(enabled) {
    this.flashlightEnabled = Boolean(enabled);
    this.flashlight.visible = this.flashlightEnabled;
    return this.flashlightEnabled;
  }

  toggleFlashlight() {
    return this.setFlashlightEnabled(!this.flashlightEnabled);
  }


  disposeWorld() {
    if (!this.levelRoot) return;
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    this.levelRoot.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) {
            if (value && value.isTexture) textures.add(value);
          }
        }
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    this.scene.remove(this.levelRoot);
    this.levelRoot = null;

  }

  rebuildWorld() {
    this.disposeWorld();
    this.buildWorld();
  }


  update(deltaSeconds = 0) {
    const dt = Math.max(0, Math.min(deltaSeconds, 0.05));
    this.elapsed += dt;
    if (!this.flashlight) return;

    const wave = Math.sin(this.elapsed * 1.37 + 0.7) * 0.55 +
      Math.sin(this.elapsed * 2.91 + 1.9) * 0.28 +
      Math.sin(this.elapsed * 0.63 + 2.4) * 0.17;
    const smoothAlpha = 1 - Math.exp(-dt * LIGHT_CONFIG.flickerSmoothing);
    this.flickerValue += (wave - this.flickerValue) * smoothAlpha;

    if (this.dipTimer > 0) {
      this.dipTimer = Math.max(0, this.dipTimer - dt);
    } else if (Math.random() < LIGHT_CONFIG.flickerRate * dt) {
      this.dipTimer = LIGHT_CONFIG.dipMinSeconds +
        Math.random() * (LIGHT_CONFIG.dipMaxSeconds - LIGHT_CONFIG.dipMinSeconds);
    }
    const dip = this.dipTimer > 0 ? LIGHT_CONFIG.dipIntensity : 1;
    this.flashlight.intensity = this.flashlightEnabled
      ? LIGHT_CONFIG.intensity * (1 + this.flickerValue * LIGHT_CONFIG.flickerStrength) * dip
      : 0;

    this.camera.updateMatrixWorld(true);
    const desiredDirection = this.camera.getWorldDirection(new THREE.Vector3());
    const beamAlpha = 1 - Math.exp(-dt * LIGHT_CONFIG.beamFollow);
    this.beamDirection.lerp(desiredDirection, beamAlpha).normalize();
    this.flashlight.getWorldPosition(this._lightWorldPosition);
    this._beamTargetWorld.copy(this._lightWorldPosition)
      .addScaledVector(this.beamDirection, 9);
    this.camera.worldToLocal(this._beamTargetWorld);
    this.flashlightTarget.position.copy(this._beamTargetWorld);
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render(deltaSeconds = 0) {
    this.update(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.disposeWorld();
    this.camera.remove(this.flashlight);
    this.camera.remove(this.flashlightTarget);
    if (this.viewModel) {
      this.camera.remove(this.viewModel);
      this.viewModel.traverse(object => {
        object.geometry?.dispose();
        if (object.material) {
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            material.dispose();
          }
        }
      });
    }
    this.renderer.dispose();
  }
}
