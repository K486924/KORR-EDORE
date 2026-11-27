import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { VIEWMODEL_CONFIG } from "../config/viewmodel.js";
import { LIGHT_CONFIG, FEATURE_CONFIG } from "../config/lighting.js";
import { PLAYER_CONFIG } from "../config/physics.js";
import { PlayerAvatar } from "../player/PlayerAvatar.js";
import { createMaterialLibrary } from "../procedural/materials/MaterialLibrary.js";

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
    const materials = createMaterialLibrary();
    this.materialLibrary = materials;

    // A bright, quiet afternoon. The house should feel like somewhere people
    // would genuinely want to spend a weekend.
    this.scene.background = new THREE.Color(0xc4d3d0);
    this.scene.fog = new THREE.Fog(0xc4d3d0, 42, 115);
    this.renderer.toneMappingExposure = 1.12;

    const mat = (color, roughness = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    const plaster = materials.plaster(0xe4dac8);
    const foundation = materials.plaster(0xb9ad98);
    const roofMat = materials.darkWood(0x424a43);
    const wood = materials.darkWood(0x60452f);
    const trim = materials.paint(0xf4ecdd);
    const darkMetal = materials.metal(0x303a36, 0.78);
    const grass = materials.grass(0x6d8049);
    const pathMat = materials.soil(0x806a4c);
    const glass = new THREE.MeshStandardMaterial({ color: 0xffdca1, roughness: 0.28, emissive: 0x8b6331, emissiveIntensity: 0.28 });
    const leafMats = [materials.leaf(0x3d633f), materials.leaf(0x527747), materials.leaf(0x647d4c)];
    const fabric = materials.fabric(0xb9aa94);
    const paleFabric = materials.fabric(0xd4c7b1);
    const floorWood = materials.wood(0xc09a6c);

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

    // Grounds and the compacted-earth driveway.
    box([180, 0.25, 180], [0, -0.2, -35], grass, world, false);
    box([5.2, 0.035, 31], [0, -0.045, 1.5], pathMat, world, false);
    box([22, 0.04, 7], [0, -0.04, 17], pathMat, world, false);
    box([19, 0.05, 3.2], [0, -0.01, -0.1], pathMat, world, false);

    // The farmhouse: a broad two-storey country home, not a horror corridor.
    box([16, 0.35, 15.5], [0, 0.0, -6.25], foundation);
    box([15.8, 0.16, 15.25], [0, 0.25, -6.25], mat(0x9b927f), world, false);
    const wallY = 1.98;
    const wallH = 3.45;
    // Front wall is split around the open double-door entrance.
    box([6.65, wallH, 0.42], [-4.675, wallY, 1.5], plaster);
    box([6.65, wallH, 0.42], [4.675, wallY, 1.5], plaster);
    box([0.42, wallH, 15.5], [-7.9, wallY, -6.25], plaster);
    box([0.42, wallH, 15.5], [7.9, wallY, -6.25], plaster);
    box([16.2, wallH, 0.42], [0, wallY, -14.0], plaster);
    // Interior partitions: broad openings keep the central hall connected to each room.\n    const innerWall = plaster;\n    const iw = 0.16, ih = 3.05;\n    for (const x of [-2.05, 2.05]) {\n      for (const [z, length] of [[-12.0, 3.0], [-8.1, 3.1], [-3.0, 4.0]]) {\n        box([iw, ih, length], [x, 1.78, z], innerWall);\n      }\n    }\n    // Front bedroom/reception partition with two generous door openings.\n    for (const [x, length] of [[-5.3, 4.6], [0, 1.2], [5.3, 4.6]]) {\n      box([length, ih, iw], [x, 1.78, -4.65], innerWall);\n    }\n    // Ceiling is intentionally omitted in this first interior pass so the roofline and room layout remain readable.\n\n    // Upper floor band and a shallow, pitched roof.
    box([16.25, 0.24, 15.8], [0, 3.68, -6.25], trim);
    const roofLeft = box([8.9, 0.34, 17.2], [-4.0, 4.25, -6.25], roofMat);
    roofLeft.rotation.z = -0.32;
    const roofRight = box([8.9, 0.34, 17.2], [4.0, 4.25, -6.25], roofMat);
    roofRight.rotation.z = 0.32;
    box([0.42, 0.5, 17.4], [0, 5.0, -6.25], roofMat);

    // Front porch, open double doors and welcoming windows.
    box([5.2, 0.22, 2.4], [0, 0.32, 2.55], foundation);
    for (const x of [-2.15, 2.15]) {
      box([0.24, 3.0, 0.24], [x, 1.8, 2.95], trim);
      box([0.28, 0.22, 0.28], [x, 3.32, 2.95], foundation);
    }
    box([5.0, 0.2, 0.28], [0, 3.32, 2.95], trim);
    for (const side of [-1, 1]) {
      const door = box([1.05, 2.65, 0.14], [side * 1.15, 1.65, 1.48], wood);
      door.rotation.y = side * 1.35;
      box([0.78, 1.75, 0.035], [side * 1.15, 1.75, 1.39], mat(0x76563b), world, false);
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
    box([5.2, 0.18, 1.1], [0, 3.95, 2.0], foundation);
    box([5.2, 0.12, 0.1], [0, 4.55, 2.5], trim, world, false);
    for (let x = -2.4; x <= 2.41; x += 0.6) {
      box([0.055, 0.58, 0.055], [x, 4.27, 2.5], trim, world, false);
    }

    // Gate pillars and a pair of dark iron swing gates.
    for (const x of [-3.15, 3.15]) {
      box([0.72, 2.8, 0.72], [x, 1.4, 8.4], foundation);
      box([0.92, 0.22, 0.92], [x, 2.88, 8.4], trim);
      box([0.55, 0.18, 0.55], [x, 3.08, 8.4], foundation);
    }
    this.gateLeaves = [];
    this.gateCollisionCells = new Set();
    for (let x = 14; x <= 25; x++) this.gateCollisionCells.add(x + ",48");
    this.gateOpenAmount = 0;
    this.gateTargetOpen = 0;
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
      this.gateLeaves.push({ group: gate, side });
    }

    // A parked family saloon, ready for the arrival sequence to be added.
    const car = new THREE.Group();
    const carPaint = mat(0x354c50, 0.38, { metalness: 0.48 });
    const tyre = mat(0x171a19, 0.95);
    box([2.0, 0.62, 4.05], [0, 0.82, 0], carPaint, car);
    box([1.72, 0.78, 2.05], [0, 1.43, -0.22], mat(0x263c40, 0.32, { metalness: 0.3 }), car);
    box([1.55, 0.52, 1.82], [0, 1.48, -0.24], mat(0x8ea6a5, 0.25, { transparent: true, opacity: 0.7 }), car, false);
    box([1.82, 0.12, 0.12], [0, 0.98, -2.04], trim, car, false);
    this.carWheels = [];
    for (const x of [-0.83, 0.83]) {
      for (const z of [-1.35, 1.35]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.2, 16), tyre);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.48, z);
        car.add(wheel);
        this.carWheels.push(wheel);
      }
      box([0.18, 0.22, 0.12], [x, 0.9, -2.08], mat(0xf3d9a2, 0.4, { emissive: 0x9b7138, emissiveIntensity: 0.2 }), car, false);
    }
    car.position.set(-5.0, 0, 12.8);
    car.rotation.y = 0.08;
    world.add(car);
    this.arrivalCar = car;

    // Garden beds, low hedges, lanterns and mature trees around the property.
    for (const side of [-1, 1]) {
      box([1.2, 0.42, 10], [side * 10.1, 0.18, 1.5], mat(0x3c5b36));
      for (let i = 0; i < 5; i++) {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.42 + (i % 2) * 0.08, 10, 8), leafMats[i % leafMats.length]);
        bush.position.set(side * (9.9 + (i % 2) * 0.35), 0.45, -2.2 + i * 1.65);
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

    // Furnish the ground floor: living room, dining/kitchen, bedrooms and reception.\n    const rug = materials.fabric(0x8d7860);\n    box([4.0, 0.035, 3.1], [-5.0, 0.36, -9.1], rug, world, false);\n    // Living room sofa and cushions.\n    box([3.5, 0.62, 0.92], [-5.0, 0.72, -7.2], wood);\n    box([3.25, 0.72, 0.22], [-5.0, 1.12, -7.62], fabric);\n    for (const x of [-6.35, -5.45, -4.55, -3.65]) box([0.78, 0.42, 0.7], [x, 1.02, -7.12], paleFabric);\n    box([1.8, 0.28, 1.0], [-5.0, 0.52, -10.0], wood);\n    box([2.4, 0.18, 0.5], [-7.25, 0.42, -8.9], wood);\n    box([0.18, 1.15, 2.2], [-7.35, 0.85, -9.0], darkMetal);\n    // Dining table, six chairs and a simple kitchen island.\n    box([2.6, 0.16, 1.35], [5.0, 1.02, -9.7], wood);\n    for (const x of [4.0, 5.0, 6.0]) for (const z of [-8.7, -10.7]) {\n      box([0.72, 0.14, 0.72], [x, 0.68, z], wood);\n      box([0.72, 0.62, 0.12], [x, 1.0, z + (z < -9 ? -0.28 : 0.28)], fabric);\n    }\n    box([3.7, 0.88, 0.72], [5.1, 0.78, -5.9], paleFabric);\n    box([3.7, 0.1, 0.72], [5.1, 1.25, -5.9], wood);\n    for (const x of [3.6, 5.0, 6.4]) box([0.08, 0.55, 0.58], [x, 1.56, -5.9], trim);\n    // Uncle’s bedroom: double bed, bedside tables, wardrobe and writing desk.\n    box([3.3, 0.28, 2.35], [-5.0, 0.53, -1.45], wood);\n    box([3.1, 0.32, 2.12], [-5.0, 0.78, -1.45], paleFabric);\n    box([3.1, 0.28, 0.58], [-5.0, 1.02, -2.15], fabric);\n    for (const x of [-6.0, -4.0]) box([0.72, 0.78, 0.68], [x, 0.74, 0.25], wood);\n    box([1.65, 2.35, 0.72], [-7.0, 1.45, -2.0], wood);\n    box([1.8, 0.12, 0.85], [-3.0, 1.0, -0.6], wood);\n    box([0.62, 0.82, 0.62], [-3.0, 0.75, 0.25], fabric);\n    // Reception console and a few lived-in details.\n    box([2.8, 0.9, 0.62], [5.0, 0.82, -1.7], wood);\n    box([2.9, 0.1, 0.68], [5.0, 1.32, -1.7], paleFabric);\n    for (const x of [4.1, 5.0, 5.9]) box([0.42, 0.42, 0.42], [x, 1.58, -1.7], materials.plaster(0xc9bba4));\n\n    // Soft daylight and a little warm light inside the front rooms.
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
    this.viewModel.visible = this.flashlightEnabled;
  }

  toggleGate() {
    this.gateTargetOpen = this.gateTargetOpen > 0.5 ? 0 : 1;
    return this.gateTargetOpen > 0.5;
  }

  getGateCollisionCells() {
    return this.gateOpenAmount < 0.9 ? this.gateCollisionCells : null;
  }

  setFlashlightEnabled(enabled) {
    this.flashlightEnabled = Boolean(enabled);
    this.flashlight.visible = this.flashlightEnabled;
    this.viewModel.visible = this.flashlightEnabled;
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
    textures.forEach(texture => texture.dispose());\n    this.materialLibrary?.dispose();\n    this.materialLibrary = null;
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
    if (this.gateLeaves) {
      const gateAlpha = 1 - Math.exp(-dt * 2.4);
      this.gateOpenAmount += (this.gateTargetOpen - this.gateOpenAmount) * gateAlpha;
      for (const leaf of this.gateLeaves) {
        leaf.group.rotation.y = leaf.side * this.gateOpenAmount * 1.08;
      }
    }
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
