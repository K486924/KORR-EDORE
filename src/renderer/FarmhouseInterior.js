import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export function createFarmhouseInterior(scene, interactions) {
  const root = new THREE.Group();
  root.name = "KORR_EDORE_FARMHOUSE_INTERIOR";
  scene.add(root);
  const solidMeshes = [];
  const mat = (color, roughness = 0.88, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const plaster = mat(0xe2d8c8), trim = mat(0xf1e8d8), wood = mat(0x60452f);
  const floor = mat(0x9b7956), darkWood = mat(0x3c3026), fabric = mat(0xb8aa96);
  const pale = mat(0xd5c9b5), metal = mat(0x343c38, 0.55, 0.55);
  const brass = mat(0xb58a43, 0.35, 0.65), glass = mat(0x87968d, 0.25, 0.12);
  const box = (size, pos, material, parent = root, solid = false) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (solid) { mesh.userData.collisionEnabled = true; solidMeshes.push(mesh); }
    return mesh;
  };

  // The interior is a separate level. Its wall meshes and collision boxes are
  // deliberately the same objects, so visible architecture and collision agree.
  box([36.0, 0.30, 20.0], [0, 0.10, -8.4], floor, root, false);
  const wallH = 3.35, wallY = 1.925, thick = 0.28;
  box([15.45, wallH, thick], [-10.25, wallY, 1.25], plaster, root, true);
  box([15.45, wallH, thick], [10.25, wallY, 1.25], plaster, root, true);
  // Wide passages connect the central hall to both mansion wings.
  box([thick, wallH, 7.0], [-18.0, wallY, -2.4], plaster, root, true);
  box([thick, wallH, 7.0], [-18.0, wallY, -14.4], plaster, root, true);
  // Wide passages connect the central hall to both mansion wings.
  box([thick, wallH, 7.0], [18.0, wallY, -2.4], plaster, root, true);
  box([thick, wallH, 7.0], [18.0, wallY, -14.4], plaster, root, true);
  box([36.0, wallH, thick], [0, wallY, -17.9], plaster, root, true);

  // Internal room dividers leave proper doorways and a clear central hall.
  for (const x of [-2.25, 2.25]) {
    box([thick, wallH, 1.5], [x, wallY, -0.9], plaster, root, true);
    box([thick, wallH, 1.5], [x, wallY, -4.4], plaster, root, true);
    box([thick, wallH, 1.8], [x, wallY, -8.5], plaster, root, true);
    box([thick, wallH, 2.0], [x, wallY, -12.7], plaster, root, true);
  }
  for (const x of [-6.65, -3.45, 3.45, 6.65])
    box([1.75, wallH, thick], [x, wallY, -4.1], plaster, root, true);
  // Door headers frame the openings without blocking them.
  for (const x of [-2.25, 2.25]) box([1.15, 0.22, 0.32], [x, 3.05, -6.0], trim);

  // Upper floor with a deliberately open stairwell.
  const upperY = 3.55;
  box([7.6, 0.22, 19.5], [-3.8, upperY, -8.4], floor);
  box([4.0, 0.22, 19.5], [2.0, upperY, -8.4], floor);
  box([1.6, 0.22, 19.5], [6.8, upperY, -8.4], floor);
  // Upper-floor side wings make the second storey a full mansion level.
  box([10.0, 0.22, 19.5], [-12.8, upperY, -8.4], floor);
  box([10.0, 0.22, 19.5], [12.8, upperY, -8.4], floor);
  box([2.0, 0.22, 6.0], [5.0, upperY, -10.75], floor);
  box([2.0, 0.22, 2.7], [5.0, upperY, -0.35], floor);
  const upperSolidStart = solidMeshes.length;
  // Upper-storey perimeter walls keep the landing and bedrooms enclosed.
  box([thick, 2.85, 7.0], [-18.0, 5.05, -2.4], plaster, root, true);
  box([thick, 2.85, 7.0], [-18.0, 5.05, -14.4], plaster, root, true);
  box([thick, 2.85, 7.0], [18.0, 5.05, -2.4], plaster, root, true);
  box([thick, 2.85, 7.0], [18.0, 5.05, -14.4], plaster, root, true);
  box([36.0, 2.85, thick], [0, 5.05, -17.9], plaster, root, true);
  box([15.45, 2.85, thick], [-10.25, 5.05, 1.25], plaster, root, true);
  box([15.45, 2.85, thick], [10.25, 5.05, 1.25], plaster, root, true);
  // The central upper landing stays open above the grand entrance.
  // Upstairs partitions and bedroom openings.
  for (const x of [-2.15, 2.15]) {
    box([thick, 2.85, 1.2], [x, 5.05, -8.0], plaster, root, true);
    box([thick, 2.85, 2.8], [x, 5.05, -12.0], plaster, root, true);
  }
  for (const x of [-6.5, -3.4, 3.4, 6.5])
    box([1.7, 2.85, thick], [x, 5.05, -7.2], plaster, root, true);
  box([1.3, 2.85, thick], [-1.9, 5.05, -7.2], plaster, root, true);
  box([1.3, 2.85, thick], [1.9, 5.05, -7.2], plaster, root, true);
  box([15.2, 0.18, 15.0], [0, 6.65, -6.25], trim);
  const upperSolidMeshes = solidMeshes.slice(upperSolidStart);
  upperSolidMeshes.forEach(mesh => {
    mesh.userData.floorLevel = 1;
    mesh.userData.collisionEnabled = false;
  });

  // Walkable ramp beneath the timber stair treads. Player height follows this
  // ramp in Game.update(), while the visible treads make it read as stairs.
  const stairX = 5.0, stairStartZ = -2.0, stairEndZ = -7.55;
  const rise = 3.30, run = stairStartZ - stairEndZ;
  const stairAngle = Math.atan2(rise, run);
  const stairSolidMeshes = [];
  const ramp = box([1.65, 0.16, Math.hypot(run, rise)], [stairX, 1.90, (stairStartZ + stairEndZ) / 2], darkWood);
  ramp.rotation.x = stairAngle;
  for (let i = 0; i < 12; i++) {
    const t = (i + 0.5) / 12;
    const z = stairStartZ - t * run;
    const y = 0.25 + t * rise;
    box([1.68, 0.10, 0.34], [stairX, y, z], wood);
    box([1.72, 0.11, 0.06], [stairX, y + 0.07, z - 0.17], trim);
  }
  for (const x of [4.12, 5.88]) {
    const rail = box([0.10, 0.12, Math.hypot(run, rise)], [x, 2.05, (stairStartZ + stairEndZ) / 2], wood, root, true);
    rail.rotation.x = stairAngle;
    stairSolidMeshes.push(rail);
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7;
      const post = box([0.07, 0.82, 0.07], [x, 0.45 + t * rise, stairStartZ - t * run], trim, root, true);
      stairSolidMeshes.push(post);
    }
  }

  // Front entrance: paired hinged leaves, with a usable return interaction.
  const exitHinges = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * 2.525, 0.25, 1.25);
    root.add(hinge);
    const leaf = box([2.525, 2.65, 0.13], [-side * 1.2625, 1.325, 0], wood, hinge, true);
    leaf.userData.isExitDoor = true;
    box([2.18, 1.78, 0.035], [-side * 1.2625, 1.36, side * 0.085], darkWood, hinge);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), brass);
    knob.position.set(-side * 2.28, 1.35, side * 0.12); hinge.add(knob);
    exitHinges.push({ hinge, side, leaf });
    interactions.register(leaf, { id: "interior-exit", label: "OPEN FRONT DOOR", maxDistance: 3.2 });
  }
  const exitState = { hinges: exitHinges, open: false, angle: 0 };

  // Three hidden keys begin the original "three keys, one room" puzzle.
  const ritualKeys = {};
  const keyMaterial = brass;
  const makeKey = (id, position, label) => {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 8, 16), keyMaterial);
    ring.rotation.x = Math.PI / 2;
    const shaft = box([0.30, 0.035, 0.035], [0.18, 0, 0], keyMaterial, group);
    const tooth = box([0.045, 0.085, 0.035], [0.29, -0.045, 0], keyMaterial, group);
    group.add(ring);
    group.position.set(...position);
    group.visible = false;
    root.add(group);
    interactions.register(group, { id, label, maxDistance: 2.4, enabled: () => group.visible });
    ritualKeys[id] = group;
    return group;
  };
  const bedroomDrawer = new THREE.Group();
  box([0.08, 0.72, 0.65], [-7.07, 0.42, -1.25], darkWood, bedroomDrawer);
  box([0.08, 0.72, 0.65], [-6.43, 0.42, -1.25], darkWood, bedroomDrawer);
  box([0.72, 0.08, 0.65], [-6.75, 0.10, -1.25], darkWood, bedroomDrawer);
  box([0.72, 0.08, 0.65], [-6.75, 0.74, -1.25], darkWood, bedroomDrawer);
  box([0.72, 0.72, 0.06], [-6.75, 0.42, -1.55], darkWood, bedroomDrawer);
  box([0.58, 0.07, 0.48], [-6.75, 0.39, -1.18], wood, bedroomDrawer);
  const bedroomDrawerFront = box([0.62, 0.23, 0.035], [-6.75, 0.55, -0.91], wood, bedroomDrawer);
  bedroomDrawerFront.userData.closedZ = bedroomDrawerFront.position.z;
  const bedroomPull = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), brass);
  bedroomPull.position.set(0, 0, 0.05); bedroomDrawerFront.add(bedroomPull);
  root.add(bedroomDrawer);
  interactions.register(bedroomDrawer, { id: "bedroom-drawer", label: "SEARCH BEDROOM DRAWER", maxDistance: 2.5 });
  makeKey("ritual-key-bedroom", [-6.75, 0.48, -1.18], "TAKE FIRST RITUAL KEY");

  const livingMat = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.025, 2.8), fabric);
  livingMat.position.set(-5.0, 0.31, -9.1); root.add(livingMat);
  interactions.register(livingMat, { id: "living-room-mat", label: "LIFT LIVING-ROOM MAT", maxDistance: 2.6 });
  makeKey("ritual-key-mat", [-5.0, 0.265, -9.1], "TAKE SECOND RITUAL KEY");

  const receptionDrawer = new THREE.Group();
  box([0.08, 0.36, 0.52], [1.13, 0.82, -1.65], darkWood, receptionDrawer);
  box([0.08, 0.36, 0.52], [1.77, 0.82, -1.65], darkWood, receptionDrawer);
  box([0.72, 0.07, 0.52], [1.45, 0.65, -1.65], darkWood, receptionDrawer);
  box([0.72, 0.07, 0.52], [1.45, 0.99, -1.65], darkWood, receptionDrawer);
  box([0.72, 0.36, 0.06], [1.45, 0.82, -1.91], darkWood, receptionDrawer);
  box([0.58, 0.06, 0.42], [1.45, 0.70, -1.59], wood, receptionDrawer);
  const receptionDrawerFront = box([0.68, 0.22, 0.035], [1.45, 0.82, -1.36], wood, receptionDrawer);
  receptionDrawerFront.userData.closedZ = receptionDrawerFront.position.z;
  const receptionPull = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), brass);
  receptionPull.position.set(0, 0, 0.05); receptionDrawerFront.add(receptionPull);
  root.add(receptionDrawer);
  interactions.register(receptionDrawer, { id: "reception-drawer", label: "SEARCH RECEPTION DRAWER", maxDistance: 2.5 });
  makeKey("ritual-key-reception", [1.45, 0.76, -1.59], "TAKE THIRD RITUAL KEY");

  const ritualDoorHinges = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side * 1.25, 3.72, -7.18);
    root.add(hinge);
    const leaf = box([1.25, 2.65, 0.16], [-side * 0.625, 1.325, 0], darkWood, hinge, true);
    leaf.userData.floorLevel = 1;
    leaf.userData.isRitualDoorLeaf = true;
    leaf.userData.collisionEnabled = false;
    upperSolidMeshes.push(leaf);
    box([0.94, 1.82, 0.045], [-side * 0.625, 1.34, side * 0.095], wood, hinge);
    const plate = box([0.16, 0.30, 0.045], [-side * 0.625, 1.35, side * 0.13], brass, hinge);
    const lock = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 8, 14), brass);
    lock.position.set(-side * 0.625, 1.28, side * 0.17); hinge.add(lock);
    if (side === -1) {
      const secondLock = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 8, 14), brass);
      secondLock.position.set(-side * 0.625, 1.78, side * 0.17);
      hinge.add(secondLock);
    }
    ritualDoorHinges.push({ hinge, side, leaf });
    interactions.register(leaf, { id: "ritual-room-door", label: "THREE LOCKS · FIND THE KEYS", maxDistance: 3.0 });
  }
  const ritualDoor = { hinges: ritualDoorHinges, open: false, angle: 0 };
  // A salt circle and unlit candles wait behind the three-lock door.
  const ritualChamber = new THREE.Group();
  const saltRing = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.055, 8, 64), mat(0xe5ddc9));
  saltRing.rotation.x = Math.PI / 2;
  saltRing.position.set(0, 3.69, -10.65); ritualChamber.add(saltRing);
  const ritualLight = new THREE.PointLight(0x9b2520, 0, 9, 2);
  ritualLight.position.set(0, 4.4, -10.65); ritualChamber.add(ritualLight);
  const ritualState = { started: false, light: ritualLight, ring: saltRing, chamber: ritualChamber };
  interactions.register(saltRing, { id: "ritual-circle", label: "BEGIN THE CHILLA", maxDistance: 2.8, enabled: () => ritualDoor.open && !ritualChamber.userData.started });
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const candle = box([0.12, 0.32, 0.12], [Math.cos(a) * 1.8, 3.87, -10.65 + Math.sin(a) * 1.8], pale, ritualChamber);
    const wick = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), brass);
    wick.position.set(candle.position.x, 4.05, candle.position.z); ritualChamber.add(wick);
  }
  root.add(ritualChamber);

  // Uncle's bedroom: bed, wardrobe, writing desk, diary and brass key.
  box([3.0, 0.34, 2.15], [-5.15, 0.52, -1.35], darkWood);
  box([2.85, 0.28, 1.95], [-5.15, 0.82, -1.35], pale);
  box([2.85, 0.25, 0.52], [-5.15, 1.02, -2.0], fabric);
  box([1.55, 2.30, 0.68], [-6.7, 1.45, -3.2], wood, root, true);
  box([1.85, 0.13, 0.86], [-3.45, 1.0, -3.1], wood);
  box([0.10, 0.95, 0.10], [-4.2, 0.48, -2.8], darkWood);
  box([0.10, 0.95, 0.10], [-2.7, 0.48, -2.8], darkWood);
  const diary = new THREE.Group();
  box([0.42, 0.055, 0.30], [0, 0, 0], darkWood, diary);
  box([0.39, 0.018, 0.27], [0, 0.036, 0], pale, diary);
  diary.position.set(-3.45, 1.12, -3.1); root.add(diary);
  interactions.register(diary, { id: "story-diary", label: "READ UNCLE'S DIARY", maxDistance: 2.6 });
  const key = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.025, 8, 18), brass);
  ring.rotation.x = Math.PI / 2;
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.045), brass);
  stem.position.x = 0.22;
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.10, 0.045), brass);
  tooth.position.set(0.35, -0.05, 0);
  key.add(ring, stem, tooth); key.position.set(-3.0, 1.15, -3.1); root.add(key);
  interactions.register(key, { id: "generator-key", label: "TAKE BRASS KEY", maxDistance: 2.8, enabled: () => key.visible });

  // Living room, old photograph and reception console.
  box([3.5, 0.62, 0.92], [-5.0, 0.72, -8.0], wood, root, true);
  box([3.25, 0.72, 0.22], [-5.0, 1.12, -8.42], fabric);
  box([1.8, 0.28, 1.0], [-5.0, 0.52, -10.5], wood, root, true);
  const photo = new THREE.Group();
  box([0.34, 0.42, 0.055], [0, 0, 0], wood, photo);
  box([0.28, 0.35, 0.018], [0, 0, 0.037], glass, photo);
  photo.position.set(-5.0, 0.72, -10.5); photo.rotation.x = -0.08; root.add(photo);
  interactions.register(photo, { id: "story-photo", label: "EXAMINE OLD PHOTOGRAPH", maxDistance: 2.4 });

  // Dining area and kitchen island, with walking clearance around every side.
  box([2.6, 0.16, 1.35], [5.0, 1.02, -10.2], wood, root, true);
  for (const x of [4.0, 5.0, 6.0]) for (const z of [-9.2, -11.2]) {
    box([0.72, 0.14, 0.72], [x, 0.68, z], darkWood);
    box([0.72, 0.62, 0.12], [x, 1.0, z + (z < -10 ? -0.28 : 0.28)], fabric);
  }
  box([1.35, 0.88, 0.72], [3.25, 0.78, -5.4], pale, root, true);
  box([1.45, 0.10, 0.78], [3.25, 1.25, -5.4], wood);
  box([2.1, 0.86, 0.58], [3.0, 0.8, -1.65], wood, root, true);
  box([2.2, 0.10, 0.68], [3.0, 1.28, -1.65], pale);
  const ritualBook = new THREE.Group();
  box([0.48, 0.07, 0.34], [0, 0, 0], darkWood, ritualBook);
  box([0.44, 0.025, 0.31], [0, 0.045, 0], pale, ritualBook);
  ritualBook.position.set(3.0, 1.40, -1.65); ritualBook.visible = false; root.add(ritualBook);
  interactions.register(ritualBook, { id: "story-ritual-book", label: "TAKE RITUAL BOOK", maxDistance: 2.8, enabled: () => ritualBook.visible });

  // Upstairs furniture gives the second floor a real destination, not an empty shell.
  box([2.8, 0.32, 2.0], [-5.0, 4.0, -10.2], wood);
  box([2.65, 0.25, 1.8], [-5.0, 4.28, -10.2], pale);
  box([1.25, 0.3, 2.0], [6.8, 4.0, -10.3], wood);
  box([1.15, 0.22, 1.8], [6.8, 4.27, -10.3], fabric);

  // Warm ceiling fixtures and window light; no stone finishes or textures.
  for (const [x, z] of [[-5.2, -6.0], [5.0, -8.0], [0, -11.0], [-5.0, -10.0]]) {
    const lamp = new THREE.PointLight(0xffd5a0, 0.85, 8, 2);
    lamp.position.set(x, 2.95, z); root.add(lamp);
  }
  for (const [x, z] of [[-5.0, -10.0], [5.0, -10.0]]) {
    const window = box([1.25, 1.2, 0.08], [x, 2.1, -13.65], glass);
    window.castShadow = false;
  }

  const groundSolidMeshes = solidMeshes.filter(mesh => mesh.userData.floorLevel !== 1);
  const floorHeightAt = (x, z, currentOffset = 0) => {
    if (x > 4.05 && x < 5.95 && z <= stairStartZ && z >= stairEndZ) {
      const t = THREE.MathUtils.clamp((stairStartZ - z) / run, 0, 1);
      return t * rise;
    }
    return currentOffset > rise * 0.5 ? rise : 0;
  };
  return { root, solidMeshes, groundSolidMeshes, upperSolidMeshes, stairSolidMeshes, exitState, ritualDoor, ritualKeys, ritualChamber, ritualState, livingMat, bedroomDrawerFront, receptionDrawerFront, floorHeightAt, storyDiary: diary, storyPhoto: photo, ritualBook, generatorKey: key };
}
