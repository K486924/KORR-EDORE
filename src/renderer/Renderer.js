import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GRID, SOLID_CELLS, cellCenter } from "../level/layout.js";
import { VIEWMODEL_CONFIG } from "../config/viewmodel.js";
import { LIGHT_CONFIG, FEATURE_CONFIG } from "../config/lighting.js";
import { PLAYER_CONFIG } from "../config/physics.js";
import { PlayerAvatar } from "../player/PlayerAvatar.js";

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
    // Layer 0 is the first-person world; the local body is kept on layer 1.
    // Keep camera-attached viewmodel meshes and flashlight in the scene traversal.
    this.camera.layers.set(0);
    this.scene.add(this.camera);

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
    this.noisePhase = 0;
    this.noiseCurrent = 0;
    this.noiseNext = Math.random() * 2 - 1;
    this.dipTimer = 0;
    this.flashlightEnabled = false;
    this.beamDirection = new THREE.Vector3(0, 0, -1);
    this._lightWorldPosition = new THREE.Vector3();
    this._beamTargetWorld = new THREE.Vector3();
    this.levelRoot = null;
    this.localAvatar = null;
    this.avatarLoadError = null;
    this.disposed = false;
    this.buildWorld();
    this.buildViewModel();
    this.buildFlashlight();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  async loadLocalAvatar(options = {}) {
    try {
      const avatar = await PlayerAvatar.create({ ...options, renderLayer: 1 });
      if (this.disposed) {
        avatar.dispose();
        return null;
      }
      this.localAvatar?.dispose();
      this.localAvatar = avatar.addTo(this.scene);
      return avatar;
    } catch (error) {
      this.avatarLoadError = error;
      console.warn("Player avatar could not be loaded; continuing in first person.", error);
      return null;
    }
  }

  updateLocalAvatar({ x, z, yaw, speed, delta }) {
    this.localAvatar?.update({ x, z, yaw, speed, delta });
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

    // A bright, quiet afternoon. The house should feel like somewhere people
    // would genuinely want to spend a weekend.
    this.scene.background = new THREE.Color(0xc4d3d0);
    this.scene.fog = new THREE.Fog(0xc4d3d0, 42, 115);
    this.renderer.toneMappingExposure = 1.12;

    const mat = (color, roughness = 0.9, extra = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    const plaster = mat(0xd7cbb3);
    const stone = mat(0x827d6d);
    const roofMat = mat(0x424b43);
    const wood = mat(0x573c2b);
    const trim = mat(0xf0e5d0);
    const darkMetal = mat(0x303a36, 0.55, { metalness: 0.65 });
    const grass = mat(0x55734a);
    const pathMat = mat(0xb3a48a);
    const glass = mat(0xffdca1, 0.28, { emissive: 0x8b6331, emissiveIntensity: 0.28 });
    const leafMats = [mat(0x3d633f), mat(0x527747), mat(0x647d4c)];

    const box = (size, position, material, parent = world, cast = true) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...position);
      mesh.castShadow = cast;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const cylinder = (radiusTop, radiusBottom, height, position, material, segments = 12) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
      mesh.position.set(...position);
      mesh.castShadow = true;
      world.add(mesh);
      return mesh;
    };

    // Grounds and the broad stone drive.
    box([180, 0.25, 180], [0, -0.2, -35], grass, world, false);
    box([5.2, 0.035, 31], [0, -0.045, 1.5], pathMat, world, false);
    box([22, 0.04, 7], [0, -0.04, 17], pathMat, world, false);
    box([19, 0.05, 3.2], [0, -0.01, -0.1], pathMat, world, false);

    // The farmhouse: a broad two-storey country home, not a horror corridor.
    box([16, 0.35, 15.5], [0, 0.0, -6.25], stone);
    box([15.8, 0.16, 15.25], [0, 0.25, -6.25], mat(0x9b927f), world, false);
    const wallY = 1.98;
    const wallH = 3.45;
    // Front wall is split around the open double-door entrance.
    box([6.65, wallH, 0.42], [-4.675, wallY, 1.5], plaster);
    box([6.65, wallH, 0.42], [4.675, wallY, 1.5], plaster);
    box([0.42, wallH, 15.5], [-7.9, wallY, -6.25], plaster);
    box([0.42, wallH, 15.5], [7.9, wallY, -6.25], plaster);
    box([16.2, wallH, 0.42], [0, wallY, -14.0], plaster);
    // Upper floor band and a shallow, pitched roof.
    box([16.25, 0.24, 15.8], [0, 3.68, -6.25], trim);
    const roofLeft = box([8.9, 0.34, 17.2], [-4.0, 4.25, -6.25], roofMat);
    roofLeft.rotation.z = -0.32;
    const roofRight = box([8.9, 0.34, 17.2], [4.0, 4.25, -6.25], roofMat);
    roofRight.rotation.z = 0.32;
    box([0.42, 0.5, 17.4], [0, 5.0, -6.25], roofMat);

    // Front porch, open double doors and welcoming windows.
    box([5.2, 0.22, 2.4], [0, 0.32, 2.55], stone);
    for (const x of [-2.15, 2.15]) {
      box([0.24, 3.0, 0.24], [x, 1.8, 2.95], trim);
      box([0.28, 0.22, 0.28], [x, 3.32, 2.95], stone);
    }
    box([5.0, 0.2, 0.28], [0, 3.32, 2.95], trim);
    for (const side of [-1, 1]) {
      const door = box([1.05, 2.65, 0.14], [side * 0.62, 1.65, 1.48], wood);
      door.rotation.y = side * 0.55;
      box([0.78, 1.75, 0.035], [side * 0.62, 1.75, 1.39], mat(0x76563b), world, false);
      cylinder(0.035, 0.035, 0.04, [side * 0.22, 1.5, 1.31], darkMetal, 8).rotation.z = Math.PI / 2;
    }
    // Front windows with cream frames and warm glass.
    for (const x of [-5.0, -3.2, 3.2, 5.0]) {
      box([1.15, 1.35, 0.12], [x, 2.05, 1.25], trim, world, false);
      box([0.92, 1.12, 0.08], [x, 2.05, 1.17], glass, world, false);
      box([0.07, 1.12, 0.08], [x, 2.05, 1.1], wood, world, false);
      box([0.92, 0.07, 0.08], [x, 2.05, 1.1], wood, world, false);
    }
    // Side windows give the mansion depth from the approach.
    for (const z of [-2.2, -8.3, -11.2]) {
      for (const side of [-1, 1]) {
        box([0.12, 1.25, 1.45], [side * 7.68, 2.0, z], trim, world, false);
        box([0.08, 1.02, 1.2], [side * 7.6, 2.0, z], glass, world, false);
      }
    }
    // A subtle balcony above the entrance.
    box([5.2, 0.18, 1.1], [0, 3.95, 2.0], stone);
    box([5.2, 0.12, 0.1], [0, 4.55, 2.5], trim, world, false);
    for (let x = -2.4; x <= 2.41; x += 0.6) {
      box([0.055, 0.58, 0.055], [x, 4.27, 2.5], trim, world, false);
    }

    // Gate pillars and a pair of dark iron swing gates.
    for (const x of [-3.15, 3.15]) {
      box([0.72, 2.8, 0.72], [x, 1.4, 8.4], stone);
      box([0.92, 0.22, 0.92], [x, 2.88, 8.4], trim);
      box([0.55, 0.18, 0.55], [x, 3.08, 8.4], stone);
    }
    for (const side of [-1, 1]) {
      const gate = new THREE.Group();
      gate.position.set(side * 3.15, 0.18, 8.4);
      const leafWidth = 3.0;
      box([leafWidth, 0.16, 0.14], [-side * 1.5, 2.0, 0], darkMetal, gate);
      box([leafWidth, 0.16, 0.14], [-side * 1.5, 0.35, 0], darkMetal, gate);
      box([0.14, 1.75, 0.14], [-side * 2.95, 1.15, 0], darkMetal, gate);
      box([0.14, 1.75, 0.14], [-side * 0.05, 1.15, 0], darkMetal, gate);
      for (let i = 1; i < 12; i++) {
        box([0.055, 1.55, 0.07], [-side * (i * 0.25), 1.17, 0], darkMetal, gate);
      }
      world.add(gate);
    }

    // A parked family saloon, ready for the arrival sequence to be added.
    const car = new THREE.Group();
    const carPaint = mat(0x354c50, 0.38, { metalness: 0.48 });
    const tyre = mat(0x171a19, 0.95);
    box([2.0, 0.62, 4.05], [0, 0.82, 0], carPaint, car);
    box([1.72, 0.78, 2.05], [0, 1.43, -0.22], mat(0x263c40, 0.32, { metalness: 0.3 }), car);
    box([1.55, 0.52, 1.82], [0, 1.48, -0.24], mat(0x8ea6a5, 0.25, { transparent: true, opacity: 0.7 }), car, false);
    box([1.82, 0.12, 0.12], [0, 0.98, -2.04], trim, car, false);
    for (const x of [-0.83, 0.83]) {
      for (const z of [-1.35, 1.35]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.2, 16), tyre);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.48, z);
        car.add(wheel);
      }
      box([0.18, 0.22, 0.12], [x, 0.9, -2.08], mat(0xf3d9a2, 0.4, { emissive: 0x9b7138, emissiveIntensity: 0.2 }), car, false);
    }
    car.position.set(-5.0, 0, 12.8);
    car.rotation.y = 0.08;
    world.add(car);
    this.arrivalCar = car;

    // Garden beds, low hedges, lanterns and mature trees around the property.
    for (const side of [-1, 1]) {
      box([1.2, 0.42, 10], [side * 5.1, 0.18, 1.5], mat(0x3c5b36));
      for (let i = 0; i < 5; i++) {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.42 + (i % 2) * 0.08, 10, 8), leafMats[i % leafMats.length]);
        bush.position.set(side * (4.9 + (i % 2) * 0.35), 0.45, -2.2 + i * 1.65);
        bush.scale.y = 0.72;
        world.add(bush);
      }
      for (const z of [-5.0, 3.5, 12.0]) {
        cylinder(0.055, 0.075, 1.0, [side * 6.5, 0.5, z], darkMetal, 8);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0xffe2a9, 0.3, { emissive: 0xffc66f, emissiveIntensity: 0.5 }));
        lamp.position.set(side * 6.5, 1.12, z);
        world.add(lamp);
      }
    }
    const makeTree = (x, z, scale = 1) => {
      cylinder(0.22 * scale, 0.34 * scale, 3.2 * scale, [x, 1.6 * scale, z], mat(0x594832), 9);
      for (let i = 0; i < 3; i++) {
        const crown = new THREE.Mesh(new THREE.SphereGeometry((1.35 - i * 0.12) * scale, 11, 9), leafMats[(i + Math.abs(Math.round(x))) % leafMats.length]);
        crown.position.set(x + (i - 1) * 0.25 * scale, (3.25 + i * 0.65) * scale, z + (i % 2) * 0.25 * scale);
        crown.castShadow = true;
        world.add(crown);
      }
    };
    [[-13,-5,1.15],[13,-8,1.25],[-15,8,1.1],[15,10,1.2],[-10,-22,1.4],[11,-24,1.35],[-20,2,1.5],[20,-2,1.45],[-8,18,1.1],[9,20,1.1]].forEach(p => makeTree(...p));

    // Soft daylight and a little warm light inside the front rooms.
    this.scene.add(new THREE.HemisphereLight(0xe8f2ee, 0x65704f, 1.55));
    this.scene.add(new THREE.AmbientLight(0xffe7c6, 0.42));
    const sun = new THREE.DirectionalLight(0xffe5bd, 2.0);
    sun.position.set(-18, 28, 16);
    sun.castShadow = false;
    this.scene.add(sun);
    for (const x of [-4.2, 4.2]) {
      const windowGlow = new THREE.PointLight(0xffd59b, 2.0, 5, 2);
      windowGlow.position.set(x, 2.1, 0.8);
      world.add(windowGlow);
    }

    // Keep the spawn outside the gate, facing the house and the parked car.
    this.camera.position.set(0, 1.62, 15.5);
    this.camera.rotation.set(0, 0, 0, "YXZ");
  }

  buildViewModel() {
    const cfg = VIEWMODEL_CONFIG;
    this.viewModel = new THREE.Group();
    this.viewModel.position.set(cfg.position.x, cfg.position.y, cfg.position.z);
    this.viewModel.rotation.set(cfg.rotation.x, cfg.rotation.y, cfg.rotation.z);
    this.viewModel.scale.setScalar(cfg.handScale);
    this.viewModel.frustumCulled = false;
    this.viewModelBasePosition = this.viewModel.position.clone();
    this.viewModelBaseRotation = this.viewModel.rotation.clone();
    this.bobPhase = 0;
    this.swayAmplitude = 0;
    this.lookLag = { x: 0, y: 0 };

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


  updateViewModel(deltaSeconds, movementSpeed, lookDeltaYaw = 0, lookDeltaPitch = 0) {
    if (!this.viewModel) return;
    const dt = Math.max(0, Math.min(deltaSeconds, 0.05));
    const cfg = VIEWMODEL_CONFIG;
    const speed = Math.max(0, movementSpeed);

    this.bobPhase += speed * dt * cfg.swayFrequency;
    const targetAmplitude = speed > 0.025
      ? cfg.swayAmount * Math.min(speed / PLAYER_CONFIG.moveSpeed, 1)
      : 0;
    const swayAlpha = 1 - Math.exp(-dt * cfg.swayBlendSpeed);
    this.swayAmplitude += (targetAmplitude - this.swayAmplitude) * swayAlpha;

    const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
    const targetLagX = clamp(-lookDeltaYaw * cfg.lookLagYawScale, cfg.lookLagLimit);
    const targetLagY = clamp(-lookDeltaPitch * cfg.lookLagPitchScale, cfg.lookLagLimit);
    const lagAlpha = 1 - Math.exp(-dt * cfg.lookLagReturnSpeed);
    this.lookLag.x += (targetLagX - this.lookLag.x) * lagAlpha;
    this.lookLag.y += (targetLagY - this.lookLag.y) * lagAlpha;

    const amp = this.swayAmplitude;
    this.viewModel.position.set(
      this.viewModelBasePosition.x + Math.sin(this.bobPhase) * amp + this.lookLag.x,
      this.viewModelBasePosition.y + Math.sin(this.bobPhase * 2) * amp + this.lookLag.y,
      this.viewModelBasePosition.z
    );
    this.viewModel.rotation.set(
      this.viewModelBaseRotation.x + this.lookLag.y * 0.55,
      this.viewModelBaseRotation.y + this.lookLag.x * 0.4,
      this.viewModelBaseRotation.z
    );
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
      0xe0eadf, LIGHT_CONFIG.intensity,
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

    this.noisePhase += dt;
    while (this.noisePhase >= 0.18) {
      this.noisePhase -= 0.18;
      this.noiseCurrent = this.noiseNext;
      this.noiseNext = Math.random() * 2 - 1;
    }
    const noiseT = this.noisePhase / 0.18;
    const smoothT = noiseT * noiseT * (3 - 2 * noiseT);
    const noise = this.noiseCurrent + (this.noiseNext - this.noiseCurrent) * smoothT;
    const smoothAlpha = 1 - Math.exp(-dt * LIGHT_CONFIG.flickerSmoothing);
    this.flickerValue += (noise - this.flickerValue) * smoothAlpha;

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
    this.disposed = true;
    this.localAvatar?.dispose();
    this.localAvatar = null;
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
