import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { VIEWMODEL_CONFIG } from "../config/viewmodel.js";
import { LIGHT_CONFIG, FEATURE_CONFIG } from "../config/lighting.js";
import { PLAYER_CONFIG } from "../config/physics.js";
import { PlayerAvatar } from "../player/PlayerAvatar.js";
import { createMaterialLibrary } from "../procedural/materials/MaterialLibrary.js";
import { InteractionSystem } from "../interaction/InteractionSystem.js?v=8";
import { createLegacyFleet } from "../vehicles/LegacyVehicleModels.js?v=2";
import { createFarmhouseInterior } from "./FarmhouseInterior.js?v=2";

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
    this.interactions = new InteractionSystem(this.camera);
    this.solidMeshes = [];
    this.houseDoors = [];
    this.buildWorld();
    this.outdoorSolidMeshes = this.solidMeshes;
    this.outdoorTargets = this.interactions.targets.slice();
    this.buildInteriorLevel();
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
    this.solidMeshes = [];
    this.houseDoors = [];
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
    const chrome = materials.metal(0xc8c8c8, 0.28);
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
    const solidBox = (size, position, material, parent = world, cast = true) => {
      const mesh = box(size, position, material, parent, cast);
      mesh.userData.collisionEnabled = true;
      this.solidMeshes.push(mesh);
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
    // First-floor structural walls: visible meshes and collision shapes share the same transforms.
    solidBox([6.65, wallH, 0.42], [-4.675, wallY, 1.5], plaster);
    solidBox([6.65, wallH, 0.42], [4.675, wallY, 1.5], plaster);
    solidBox([0.42, wallH, 15.5], [-7.9, wallY, -6.25], plaster);
    solidBox([0.42, wallH, 15.5], [7.9, wallY, -6.25], plaster);
    solidBox([16.2, wallH, 0.42], [0, wallY, -14.0], plaster);
    // Interior partitions are solid only where the plaster actually exists; door gaps stay clear.
    const innerWall = plaster;
    const iw = 0.16, ih = 3.05;
    for (const x of [-2.05, 2.05]) {
      for (const [z, length] of [[-12.0, 3.0], [-8.1, 3.1], [-3.0, 4.0]]) {
        solidBox([iw, ih, length], [x, 1.78, z], innerWall);
      }
    }
    for (const [x, length] of [[-5.3, 4.6], [0, 1.2], [5.3, 4.6]]) {
      solidBox([length, ih, iw], [x, 1.78, -4.65], innerWall);
    }
    // Ceiling is intentionally omitted in this first interior pass so the roofline and room layout remain readable.

    // Upper storey: the tall central block from the architectural sketches.
    box([16.25, 0.24, 15.8], [0, 3.68, -6.25], trim);
    const upperY = 5.05, upperH = 2.55;
    box([15.8, upperH, 0.38], [0, upperY, 1.42], plaster);
    box([15.8, upperH, 0.38], [0, upperY, -13.92], plaster);
    box([0.38, upperH, 15.3], [-7.9, upperY, -6.25], plaster);
    box([0.38, upperH, 15.3], [7.9, upperY, -6.25], plaster);
    // Upper front windows and a shallow central balcony door.
    for (const x of [-5.0, -3.0, 3.0, 5.0]) {
      box([1.18, 1.35, 0.10], [x, 5.25, 1.18], trim, world, false);
      box([0.96, 1.12, 0.06], [x, 5.25, 1.10], glass, world, false);
      box([0.06, 1.12, 0.06], [x, 5.25, 1.06], wood, world, false);
      box([0.96, 0.06, 0.06], [x, 5.25, 1.06], wood, world, false);
    }
    // Main pitched roof, lifted above the upper storey.
    const roofLeft = box([9.1, 0.42, 17.6], [-3.95, 7.0, -6.25], roofMat);
    roofLeft.rotation.z = -0.34;
    const roofRight = box([9.1, 0.42, 17.6], [3.95, 7.0, -6.25], roofMat);
    roofRight.rotation.z = 0.34;
    box([0.48, 0.58, 17.8], [0, 8.35, -6.25], roofMat);

    // Front porch, open double doors and welcoming windows.
    box([5.2, 0.22, 2.4], [0, 0.32, 2.55], foundation);
    for (const x of [-2.15, 2.15]) {
      box([0.24, 3.0, 0.24], [x, 1.8, 2.95], trim);
      box([0.28, 0.22, 0.28], [x, 3.32, 2.95], foundation);
    }
    box([5.0, 0.2, 0.28], [0, 3.32, 2.95], trim);
    // Proper double-leaf entrance: each leaf is hinged on its jamb, raycastable and collidable.
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(side * 1.35, 0.32, 1.5);
      world.add(hinge);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.65, 0.14), wood);
      leaf.position.set(-side * 0.675, 1.325, 0);
      leaf.castShadow = true; leaf.receiveShadow = true;
      hinge.add(leaf);
      const inset = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.75, 0.035), mat(0x76563b));
      inset.position.set(-side * 0.675, 1.38, side * 0.075);
      leaf.add(inset);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), materials.metal(0x9b7b42, 0.35));
      knob.position.set(-side * 1.18, 1.42, side * 0.105);
      leaf.add(knob);
      leaf.userData.collisionEnabled = true;
      this.solidMeshes.push(leaf);
      const doorState = { id: "house-door-" + side, hinge, leaf, side, open: false, angle: 0 };
      this.houseDoors.push(doorState);
      this.interactions.register(leaf, { id: doorState.id, label: "OPEN FRONT DOOR", maxDistance: 3.4 });
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
      this.interactions.register(gate, { id: "farmhouse-gate-" + side, label: "OPEN / CLOSE GATE", maxDistance: 5 });
    }

    // A parked family saloon, ready for the arrival sequence to be added.
    // Detailed models ported from the original KORR EDORE core-world build.
    const legacyTargets = [];
    this.legacyVehicleTargets = legacyTargets;
    this.vehicleFleet = createLegacyFleet({
      aimTargets: legacyTargets,
      showToast: message => { this.lastVehicleToast = message; },
      enterVehicle: type => { this.vehicleMountRequest = type; }
    });
    const { sedan, truck, bike } = this.vehicleFleet;
    sedan.position.set(-5.0, 0, 12.8);
    sedan.rotation.y = 0.08;
    truck.position.set(14.5, 0, 7.5);
    truck.rotation.y = -Math.PI / 2 + 0.15;
    bike.position.set(-1.5, 0, 8.8);
    bike.rotation.y = 0.45;
    world.add(sedan, truck, bike);
    this.arrivalCar = sedan;
    this.carWheels = sedan.userData.wheels.map(w => w.steerGrp);
    this.carTireStates = sedan.userData.wheels.map((wheel, index) => ({ ...wheel, label: ["Front left", "Front right", "Rear left", "Rear right"][index] }));
    this.interactions.register(sedan, { id: "arrival-car", label: "ENTER VEHICLE", maxDistance: 4.2 });
    legacyTargets.forEach((target, index) => {
      if (!target.mesh) return;
      this.interactions.register(target.mesh, {
        id: "legacy-vehicle-part-" + index,
        label: target.getLabel?.() || "INTERACT",
        maxDistance: target.maxDist || 3.5,
        enabled: () => true
      });
      target.mesh.userData.onLegacyInteract = target.onInteract;
    });

    // Spare tyre pickups around the driveway; one can be carried at a time.
    this.spareTirePickups = [];
    for (const [index, position] of [[-8.5, 14.5], [8.5, 14.5], [-15, 4]].entries()) {
      const pickup = new THREE.Group();
      const rubber = mat(0x111412, 0.96);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.105, 10, 22), rubber);
      ring.rotation.y = Math.PI / 2;
      pickup.add(ring);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), chrome);
      hub.rotation.z = Math.PI / 2;
      pickup.add(hub);
      pickup.position.set(position[0], 0.42, position[1]);
      world.add(pickup);
      const item = { mesh: pickup, collected: false };
      this.spareTirePickups.push(item);
      this.interactions.register(pickup, { id: "spare-tire-" + index, label: "PICK UP SPARE TYRE", maxDistance: 2.8, enabled: () => !item.collected });
    }

    // Two lower side wings from the player's farmhouse sketches.
    for (const side of [-1, 1]) {
      const cx = side * 10.35;
      box([5.0, 0.28, 15.0], [cx, 0.18, -6.2], foundation);
      solidBox([4.9, 2.95, 0.30], [cx, 1.72, 1.25], plaster);
      solidBox([4.9, 2.95, 0.30], [cx, 1.72, -13.55], plaster);
      solidBox([0.30, 2.95, 14.8], [side * 12.8, 1.72, -6.2], plaster);
      // Recessed wing windows, timber frames and warm interior glazing.
      for (const z of [-10.8, -6.2, -1.6]) {
        box([0.10, 1.15, 1.35], [side * 12.63, 1.9, z], trim, world, false);
        box([0.06, 0.94, 1.12], [side * 12.57, 1.9, z], glass, world, false);
        box([0.06, 0.94, 0.055], [side * 12.52, 1.9, z], wood, world, false);
        box([0.06, 0.055, 1.12], [side * 12.52, 1.9, z], wood, world, false);
      }
      // Separate lower pitched roof on each wing.
      const wingRoofA = box([3.0, 0.32, 15.8], [cx - side * 1.25, 3.45, -6.2], roofMat);
      wingRoofA.rotation.z = side * 0.38;
      const wingRoofB = box([3.0, 0.32, 15.8], [cx + side * 1.25, 3.45, -6.2], roofMat);
      wingRoofB.rotation.z = -side * 0.38;
      box([0.18, 0.34, 15.9], [cx, 4.02, -6.2], roofMat);
      // Covered side veranda posts and a simple timber fascia.
      for (const z of [-12.4, -8.3, -4.1, 0.0]) {
        box([0.18, 2.7, 0.18], [side * 13.0, 1.42, z], wood);
      }
    }

    // Small detached generator room, with a metal service door and ventilation.
    const genX = -15.7, genZ = -2.8;
    box([4.0, 0.22, 4.8], [genX, 0.02, genZ], foundation);
    solidBox([3.8, 2.65, 0.22], [genX, 1.35, genZ + 2.3], plaster);
    solidBox([3.8, 2.65, 0.22], [genX, 1.35, genZ - 2.3], plaster);
    solidBox([0.22, 2.65, 4.4], [genX - 1.9, 1.35, genZ], plaster);
    solidBox([0.22, 2.65, 4.4], [genX + 1.9, 1.35, genZ], plaster);
    box([4.35, 0.22, 5.15], [genX, 2.75, genZ], roofMat);
    box([1.05, 2.15, 0.10], [genX + 0.9, 1.1, genZ + 2.43], darkMetal);
    box([0.12, 0.12, 0.08], [genX + 0.48, 1.1, genZ + 2.50], trim, world, false);
    for (let i = 0; i < 5; i++) box([0.08, 0.52, 0.08], [genX - 1.05 + i * 0.18, 2.0, genZ + 2.44], darkMetal, world, false);
    // Generator unit, exhaust and fuel can visible through the service-side opening.
    box([1.15, 0.82, 0.72], [genX - 0.35, 0.58, genZ - 0.15], darkMetal);
    box([0.52, 0.12, 0.48], [genX - 0.35, 1.05, genZ - 0.15], wood);
    cylinder(0.07, 0.07, 0.72, [genX - 0.8, 1.65, genZ - 0.75], darkMetal, 8);
    this.generatorSwitch = new THREE.Group();
    const switchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.07), darkMetal);
    const switchLever = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.07), materials.metal(0xb58b43, 0.7));
    switchLever.position.set(0, 0.03, 0.07);
    this.generatorSwitch.add(switchPlate, switchLever);
    this.generatorSwitch.position.set(genX - 0.95, 1.15, genZ + 2.43);
    world.add(this.generatorSwitch);
    this.interactions.register(this.generatorSwitch, { id: "generator-start", label: "START GENERATOR", maxDistance: 2.8 });
    this.generatorSwitchLever = switchLever;

    // Hinged service door and a visible brass padlock.
    this.generatorDoorPivot = new THREE.Group();
    this.generatorDoorPivot.position.set(genX + 0.36, 0.05, genZ + 2.42);
    const generatorDoorLeaf = box([1.05, 2.12, 0.10], [0.53, 1.06, 0], wood, this.generatorDoorPivot);
    generatorDoorLeaf.userData.collisionEnabled = true;
    this.solidMeshes.push(generatorDoorLeaf);
    box([0.20, 0.34, 0.12], [0.82, 1.05, 0.08], darkMetal, this.generatorDoorPivot, false);
    const lockBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.08), materials.metal(0xb58b43, 0.8));
    lockBody.position.set(0.82, 0.86, 0.12); this.generatorDoorPivot.add(lockBody);
    const lockLoop = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 7, 14, Math.PI), materials.metal(0xb58b43, 0.8));
    lockLoop.position.set(0.82, 0.99, 0.12); this.generatorDoorPivot.add(lockLoop);
    world.add(this.generatorDoorPivot);
    this.generatorDoorOpen = false;
    this.interactions.register(this.generatorDoorPivot, { id: "generator-door", label: "GENERATOR ROOM", maxDistance: 3.5 });
    this.generatorDoorPosition = { x: genX + 0.9, z: genZ + 2.5 };

    // The uncle's brass generator key rests on his bedroom writing desk.
    this.generatorKeyMesh = new THREE.Group();
    const brass = materials.metal(0xc49a4b, 0.82);
    const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.025, 8, 18), brass);
    keyRing.rotation.x = Math.PI / 2; keyRing.position.set(-3.0, 1.13, -0.72);
    const keyStem = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.045), brass);
    keyStem.position.set(-2.78, 1.13, -0.72);
    const keyTooth = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.10, 0.045), brass);
    keyTooth.position.set(-2.65, 1.08, -0.72);
    this.generatorKeyMesh.add(keyRing, keyStem, keyTooth);
    world.add(this.generatorKeyMesh);
    this.interactions.register(this.generatorKeyMesh, { id: "generator-key", label: "TAKE BRASS KEY", maxDistance: 3.0, enabled: () => this.generatorKeyMesh.visible });
    this.generatorKeyPosition = { x: -2.8, z: -0.72 };
    // Collision cells keep the shed solid; the front doorway opens only after unlocking.
    this.generatorCollisionCells = new Set();
    const cellKey = (x, z) => Math.floor((x + 10) / 0.5) + "," + Math.floor((z + 16) / 0.5);
    for (let z = -5.05; z <= -0.05; z += 0.5) {
      this.generatorCollisionCells.add(cellKey(-17.62, z));
      this.generatorCollisionCells.add(cellKey(-13.78, z));
    }
    for (let x = -17.55; x <= -13.85; x += 0.5) {
      this.generatorCollisionCells.add(cellKey(x, -5.12));
      if (x < -15.5 || x > -14.2) this.generatorCollisionCells.add(cellKey(x, -0.48));
    }


    // Perimeter fencing: timber posts and rails, with the existing double gate as the entrance.
    const fenceWood = materials.darkWood(0x493a2a);
    const fenceMetal = materials.metal(0x333a35, 0.68);
    const fencePost = (x, z) => {
      box([0.18, 1.65, 0.18], [x, 0.82, z], fenceWood);
      box([0.24, 0.10, 0.24], [x, 1.68, z], trim, world, false);
    };
    for (let z = -24; z <= 8; z += 2.2) {
      fencePost(-19, z); fencePost(19, z);
      box([0.10, 0.12, 2.2], [-19, 0.55, z + 1.1], fenceMetal);
      box([0.10, 0.12, 2.2], [19, 0.55, z + 1.1], fenceMetal);
      for (let y = 0.28; y <= 1.35; y += 0.27) {
        box([0.08, 0.045, 2.2], [-19, y, z + 1.1], fenceWood, world, false);
        box([0.08, 0.045, 2.2], [19, y, z + 1.1], fenceWood, world, false);
      }
    }
    for (let x = -19; x <= 19; x += 2.2) {
      if (Math.abs(x) < 4.0) continue;
      fencePost(x, 8.4);
      box([2.2, 0.12, 0.10], [x + 1.1, 0.55, 8.4], fenceMetal);
      for (let y = 0.28; y <= 1.35; y += 0.27) box([2.2, 0.045, 0.08], [x + 1.1, y, 8.4], fenceWood, world, false);
    }
    for (let x = -19; x <= 19; x += 2.2) {
      fencePost(x, -24);
      box([2.2, 0.12, 0.10], [x + 1.1, 0.55, -24], fenceMetal);
      for (let y = 0.28; y <= 1.35; y += 0.27) box([2.2, 0.045, 0.08], [x + 1.1, y, -24], fenceWood, world, false);
    }

    // Sun, moon, stars and slow cloud banks for a natural day-to-night cycle.
    this.skyCycle = { sun: null, moon: null, stars: null, dayLight: null, hemi: null, phase: 0 };
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(1.45, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe4a6 }));
    sunDisc.position.set(-28, 34, -48); world.add(sunDisc);
    const moonDisc = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe1e8ee }));
    moonDisc.position.set(28, -20, -48); world.add(moonDisc);
    const starPositions = [];
    for (let i = 0; i < 180; i++) {
      const a = Math.random() * Math.PI * 2, r = 48 + Math.random() * 28;
      starPositions.push(Math.cos(a) * r, 18 + Math.random() * 48, Math.sin(a) * r - 42);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xe8e4d8, size: 0.32, transparent: true, opacity: 0 });
    const stars = new THREE.Points(starGeo, starMat); world.add(stars);
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xd8ddd8, roughness: 1, transparent: true, opacity: 0.72 });
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.4 + (j % 2) * 0.35, 10, 8), cloudMat);
        puff.position.set((j - 1.5) * 1.65, Math.sin(j) * 0.18, 0);
        puff.scale.y = 0.35; cloud.add(puff);
      }
      cloud.position.set(-42 + i * 14, 25 + (i % 3) * 2, -35 - (i % 2) * 22);
      this.clouds.push(cloud); world.add(cloud);
    }
    const cycleHemi = new THREE.HemisphereLight(0xe8f2ee, 0x65704f, 1.55);
    this.scene.add(cycleHemi);
    const cycleSun = new THREE.DirectionalLight(0xffe5bd, 2.0);
    cycleSun.position.set(-18, 28, 16); cycleSun.castShadow = false; this.scene.add(cycleSun);
    this.skyCycle.sun = sunDisc; this.skyCycle.moon = moonDisc;
    this.skyCycle.stars = stars; this.skyCycle.dayLight = cycleSun; this.skyCycle.hemi = cycleHemi;

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
      cylinder(0.22 * scale, 0.34 * scale, 3.2 * scale, [x, 1.6 * scale, z], materials.darkWood(0x594832), 9);
      for (let i = 0; i < 3; i++) {
        const crown = new THREE.Mesh(new THREE.SphereGeometry((1.35 - i * 0.12) * scale, 11, 9), leafMats[(i + Math.abs(Math.round(x))) % leafMats.length]);
        crown.position.set(x + (i - 1) * 0.25 * scale, (3.25 + i * 0.65) * scale, z + (i % 2) * 0.25 * scale);
        crown.castShadow = true;
        world.add(crown);
      }
    };
    [[-13,-5,1.15],[13,-8,1.25],[-15,8,1.1],[15,10,1.2],[-10,-22,1.4],[11,-24,1.35],[-20,2,1.5],[20,-2,1.45],[-8,18,1.1],[9,20,1.1]].forEach(p => makeTree(...p));

    // Furnish the ground floor: living room, dining/kitchen, bedrooms and reception.
    const rug = materials.fabric(0x8d7860);
    box([4.0, 0.035, 3.1], [-5.0, 0.36, -9.1], rug, world, false);
    // Living room sofa and cushions.
    solidBox([3.5, 0.62, 0.92], [-5.0, 0.72, -7.2], wood);
    box([3.25, 0.72, 0.22], [-5.0, 1.12, -7.62], fabric);
    for (const x of [-6.35, -5.45, -4.55, -3.65]) box([0.78, 0.42, 0.7], [x, 1.02, -7.12], paleFabric);
    solidBox([1.8, 0.28, 1.0], [-5.0, 0.52, -10.0], wood);
    box([2.4, 0.18, 0.5], [-7.25, 0.42, -8.9], wood);
    box([0.18, 1.15, 2.2], [-7.35, 0.85, -9.0], darkMetal);
    // Dining table, six chairs and a simple kitchen island.
    solidBox([2.6, 0.16, 1.35], [5.0, 1.02, -9.7], wood);
    for (const x of [4.0, 5.0, 6.0]) for (const z of [-8.7, -10.7]) {
      box([0.72, 0.14, 0.72], [x, 0.68, z], wood);
      box([0.72, 0.62, 0.12], [x, 1.0, z + (z < -9 ? -0.28 : 0.28)], fabric);
    }
    solidBox([3.7, 0.88, 0.72], [5.1, 0.78, -5.9], paleFabric);
    box([3.7, 0.1, 0.72], [5.1, 1.25, -5.9], wood);
    for (const x of [3.6, 5.0, 6.4]) box([0.08, 0.55, 0.58], [x, 1.56, -5.9], trim);
    // Uncle’s bedroom: double bed, bedside tables, wardrobe and writing desk.
    solidBox([3.3, 0.28, 2.35], [-5.0, 0.53, -1.45], wood);
    box([3.1, 0.32, 2.12], [-5.0, 0.78, -1.45], paleFabric);
    box([3.1, 0.28, 0.58], [-5.0, 1.02, -2.15], fabric);
    for (const x of [-6.0, -4.0]) box([0.72, 0.78, 0.68], [x, 0.74, 0.25], wood);
    solidBox([1.65, 2.35, 0.72], [-7.0, 1.45, -2.0], wood);
    box([1.8, 0.12, 0.85], [-3.0, 1.0, -0.6], wood);
    box([0.62, 0.82, 0.62], [-3.0, 0.75, 0.25], fabric);
    // Reception console and a few lived-in details.
    solidBox([2.8, 0.9, 0.62], [5.0, 0.82, -1.7], wood);
    box([2.9, 0.1, 0.68], [5.0, 1.32, -1.7], paleFabric);
    for (const x of [4.1, 5.0, 5.9]) box([0.42, 0.42, 0.42], [x, 1.58, -1.7], materials.plaster(0xc9bba4));

    // Story props: the uncle's private diary and an old family photograph.
    this.storyDiary = new THREE.Group();
    const diaryCover = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.30), materials.darkWood(0x493629));
    diaryCover.position.set(0, 0, 0); this.storyDiary.add(diaryCover);
    const diaryPages = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.018, 0.27), materials.fabric(0xd6c9aa));
    diaryPages.position.set(0, 0.036, 0); this.storyDiary.add(diaryPages);
    const diarySpine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.31), materials.darkWood(0x30251e));
    diarySpine.position.set(-0.19, 0.012, 0); this.storyDiary.add(diarySpine);
    this.storyDiary.position.set(-3.0, 1.13, -0.60);
    world.add(this.storyDiary);
    this.interactions.register(this.storyDiary, { id: "story-diary", label: "READ UNCLE'S DIARY", maxDistance: 2.6 });

    this.storyPhotograph = new THREE.Group();
    const photoFrame = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.055), materials.darkWood(0x45382b));
    const photoFace = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 0.018), materials.fabric(0x9b9a80));
    photoFace.position.z = 0.037;
    this.storyPhotograph.add(photoFrame, photoFace);
    this.storyPhotograph.position.set(-5.0, 0.58, -10.0);
    this.storyPhotograph.rotation.x = -0.08;
    world.add(this.storyPhotograph);
    this.interactions.register(this.storyPhotograph, { id: "story-photo", label: "EXAMINE OLD PHOTOGRAPH", maxDistance: 2.4 });

    this.storyRitualBook = new THREE.Group();
    const bookCover = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.34), materials.darkWood(0x241d1a));
    const bookPages = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.025, 0.31), materials.fabric(0xc8bda3));
    bookPages.position.y = 0.045;
    this.storyRitualBook.add(bookCover, bookPages);
    this.storyRitualBook.position.set(5.0, 1.43, -1.7);
    this.storyRitualBook.visible = false;
    world.add(this.storyRitualBook);
    this.interactions.register(this.storyRitualBook, { id: "story-ritual-book", label: "TAKE RITUAL BOOK", maxDistance: 2.8, enabled: () => this.storyRitualBook.visible });

    // Warm interior window glow remains on after sunset.
    for (const x of [-4.2, 4.2]) {
      const windowGlow = new THREE.PointLight(0xffd59b, 2.0, 5, 2);
      windowGlow.position.set(x, 2.1, 0.8);
      world.add(windowGlow);
    }

    // Keep the spawn outside the gate, facing the house and the parked car.
    this.camera.position.set(0, 1.62, 15.5);
    this.camera.rotation.set(0, 0, 0, "YXZ");
  }

  buildInteriorLevel() {
    this.interiorLevel = createFarmhouseInterior(this.scene, this.interactions);
    this.interiorLevel.root.visible = false;
    this.indoorSolidMeshes = this.interiorLevel.solidMeshes;
    this.indoorTargets = this.interactions.targets.slice(this.outdoorTargets.length);
    this.interactions.targets = this.outdoorTargets;
    this.activeLevel = "outdoor";
    this.currentInteriorFloorOffset = 0;
  }

  enterInterior() {
    if (this.activeLevel === "interior" || !this.interiorLevel) return false;
    this.levelRoot.visible = false;
    this.interiorLevel.root.visible = true;
    this.interactions.targets = this.indoorTargets;
    this.interactions.current = null;
    this.solidMeshes = this.indoorSolidMeshes;
    this.activeLevel = "interior";
    this.currentInteriorFloorOffset = 0;
    this.setInteriorFloorLevel(0);
    this.camera.position.set(0, 1.62, 0.25);
    this.camera.rotation.set(0, 0, 0, "YXZ");
    return true;
  }

  exitInterior() {
    if (this.activeLevel !== "interior") return false;
    this.interiorLevel.root.visible = false;
    this.levelRoot.visible = true;
    this.interactions.targets = this.outdoorTargets;
    this.interactions.current = null;
    this.solidMeshes = this.outdoorSolidMeshes;
    this.activeLevel = "outdoor";
    this.currentInteriorFloorOffset = 0;
    this.camera.position.set(0, 1.62, 3.55);
    this.camera.rotation.set(0, 0, 0, "YXZ");
    return true;
  }

  toggleInteriorExitDoor() {
    const state = this.interiorLevel?.exitState;
    if (!state) return false;
    state.open = !state.open;
    return state.open;
  }

  getFloorOffsetAt(x, z) {
    if (this.activeLevel !== "interior") return 0;
    this.currentInteriorFloorOffset = this.interiorLevel.floorHeightAt(x, z, this.currentInteriorFloorOffset);
    return this.currentInteriorFloorOffset;
  }

  setInteriorFloorLevel(offset) {
    if (this.activeLevel !== "interior" || !this.interiorLevel) return;
    const upstairs = offset > 1.65;
    for (const mesh of this.interiorLevel.groundSolidMeshes)
      mesh.userData.collisionEnabled = !upstairs;
    for (const mesh of this.interiorLevel.upperSolidMeshes)
      mesh.userData.collisionEnabled = upstairs;
  }

  disposeInteriorLevel() {
    const root = this.interiorLevel?.root;
    if (!root) return;
    const geometries = new Set(), materials = new Set();
    root.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) {
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          materials.add(material);
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    this.scene.remove(root);
    this.interiorLevel = null;
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

  setGeneratorKeyCollected(collected) {
    if (this.generatorKeyMesh) this.generatorKeyMesh.visible = !collected;
  }

  toggleGeneratorDoor() {
    this.generatorDoorOpen = !this.generatorDoorOpen;
    if (this.generatorDoorPivot) this.generatorDoorPivot.rotation.y = this.generatorDoorOpen ? -1.18 : 0;
    return this.generatorDoorOpen;
  }

  toggleHouseDoor(id) {
    const door = this.houseDoors?.find(item => item.id === id);
    if (!door) return false;
    door.open = !door.open;
    return door.open;
  }

  toggleGate() {
    this.gateTargetOpen = this.gateTargetOpen > 0.5 ? 0 : 1;
    return this.gateTargetOpen > 0.5;
  }

  getGateCollisionCells() {
    const cells = new Set();
    if (this.gateOpenAmount < 0.9) this.gateCollisionCells.forEach(key => cells.add(key));
    if (!this.generatorDoorOpen) this.generatorCollisionCells?.forEach(key => cells.add(key));
    return cells.size ? cells : null;
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
    textures.forEach(texture => texture.dispose());
    this.materialLibrary?.dispose();
    this.materialLibrary = null;
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
    if (this.skyCycle) {
      const phase = (this.elapsed / 240) * Math.PI * 2 + Math.PI / 2;
      const daylight = Math.max(0, Math.sin(phase) * 0.5 + 0.5);
      const night = 1 - daylight;
      const orbit = phase;
      this.skyCycle.sun.position.set(Math.cos(orbit) * 42, Math.sin(orbit) * 38, -48);
      this.skyCycle.moon.position.set(-Math.cos(orbit) * 42, -Math.sin(orbit) * 38, -48);
      this.skyCycle.sun.visible = daylight > 0.08;
      this.skyCycle.moon.visible = night > 0.12;
      this.skyCycle.stars.material.opacity = Math.pow(night, 1.7) * 0.9;
      this.skyCycle.dayLight.intensity = 0.12 + daylight * 2.0;
      this.skyCycle.hemi.intensity = 0.18 + daylight * 1.45;
      this.scene.background.setRGB(0.008 + daylight * 0.76, 0.012 + daylight * 0.82, 0.025 + daylight * 0.78);
      if (this.scene.fog?.color) this.scene.fog.color.copy(this.scene.background);
      if (this.clouds) this.clouds.forEach((cloud, i) => { cloud.position.x += dt * (0.18 + i * 0.012); if (cloud.position.x > 55) cloud.position.x = -55; });
    }
    const animateHingedPart = (part, axis = "y", speed = 8) => {
      if (!part?.pivot || typeof part.maxAngle !== "number") return;
      const targetAngle = part.open ? part.maxAngle : 0;
      part.angle += (targetAngle - part.angle) * (1 - Math.exp(-dt * speed));
      part.pivot.rotation[axis] = part.angle;
    };
    const sedanParts = this.vehicleFleet?.sedan?.userData?.parts;
    if (sedanParts) {
      for (const [name, part] of Object.entries(sedanParts))
        animateHingedPart(part, name === "hood" || name === "trunk" ? "x" : "y");
    }
    const truckData = this.vehicleFleet?.truck?.userData;
    animateHingedPart(truckData?.bonnetPart, "x");
    animateHingedPart(truckData?.doorPart, "y");
    animateHingedPart(truckData?.shutterPart, "x", 5);
    if (this.houseDoors) {
      const doorAlpha = 1 - Math.exp(-dt * 7.5);
      for (const door of this.houseDoors) {
        const targetAngle = door.open ? door.side * 1.28 : 0;
        door.angle += (targetAngle - door.angle) * doorAlpha;
        door.hinge.rotation.y = door.angle;
      }
    }
    const exitState = this.interiorLevel?.exitState;
    if (exitState) {
      exitState.angle += ((exitState.open ? 1.2 : 0) - exitState.angle) * (1 - Math.exp(-dt * 7.5));
      for (const leaf of exitState.hinges) leaf.hinge.rotation.y = leaf.side * exitState.angle;
    }
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
    this.disposeInteriorLevel();
    this.camera.remove(this.flashlight);
    this.camera.remove(this.flashlightTarget);
    this.interactions?.dispose();
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
