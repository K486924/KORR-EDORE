import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
let aimTargets = [];
let showToast = () => {};
let enterVehicle = () => {};

export function createLegacyFleet(context = {}) {
  aimTargets = context.aimTargets || [];
  showToast = context.showToast || (() => {});
  enterVehicle = context.enterVehicle || (() => {});
  const sedan = buildDetailedSedan();
  const truck = buildCargoTruck();
  const bike = buildRebelBike();
  return { sedan, truck, bike, aimTargets };
}

function makeVehicleGlass() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xa9c8d1, transparent: true, opacity: 0.34,
    roughness: 0.1, metalness: 0.05, side: THREE.DoubleSide,
    depthWrite: false
  });
}

function buildDetailedSedan(paintHex = 0x8b1e24) {
  // Vehicle-local origin is the chassis centre. +Z is the front of the car.
  const car = new THREE.Group();
  car.name = "KORR_RED_SEDAN";
  const paint = new THREE.MeshStandardMaterial({ color: paintHex, metalness: 0.52, roughness: 0.28 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x171a1d, roughness: 0.72 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd4d9d8, metalness: 0.88, roughness: 0.22 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x38291f, roughness: 0.86 });
  const glass = makeVehicleGlass();
  const headLampMat = new THREE.MeshStandardMaterial({ color: 0xfff4d5, emissive: 0xffe4a3, emissiveIntensity: 1.15 });
  const tailLampMat = new THREE.MeshStandardMaterial({ color: 0x8f1618, emissive: 0xff1515, emissiveIntensity: 0.55 });
  const box = (parent, size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const W = 1.84, wheelRadius = 0.35;

  // Chassis and four distinct, non-intersecting exterior body sections.
  box(car, [1.58, 0.16, 3.72], [0, 0.43, 0], trim);
  box(car, [1.84, 0.48, 1.86], [0, 0.77, 0], paint);             // lower body
  // Hood and trunk are the hinged panels created below, not duplicate fixed body slabs.
  box(car, [1.90, 0.22, 0.18], [0, 0.43, 2.04], trim);
  box(car, [1.90, 0.22, 0.18], [0, 0.43, -2.04], trim);
  box(car, [0.84, 0.18, 0.07], [0, 0.80, 2.00], chrome);
  for (const side of [-1, 1]) {
    box(car, [0.06, 0.18, 0.28], [side * 0.68, 0.84, 2.02], chrome);
    box(car, [0.12, 0.15, 1.78], [side * 0.86, 0.48, 0], paint);
  }

  // Engine sits below the closed bonnet; no loose parts protrude through it.
  box(car, [0.78, 0.30, 0.66], [0, 0.78, 1.43], trim);
  box(car, [0.36, 0.12, 0.34], [-0.38, 0.91, 1.38], chrome);

  // Cabin shell, pillars and roof.
  box(car, [1.56, 0.10, 1.68], [0, 1.72, 0], paint);
  for (const side of [-1, 1]) {
    const frontPillar = box(car, [0.085, 0.66, 0.10], [side * 0.78, 1.39, 0.80], paint);
    frontPillar.rotation.x = -0.16;
    const rearPillar = box(car, [0.085, 0.66, 0.10], [side * 0.78, 1.39, -0.80], paint);
    rearPillar.rotation.x = 0.16;
    box(car, [0.075, 0.62, 0.09], [side * 0.78, 1.38, 0], trim);
  }
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.55), glass);
  windshield.position.set(0, 1.39, 0.885);
  windshield.rotation.x = -0.12;
  car.add(windshield);
  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.54), glass);
  rearGlass.position.set(0, 1.39, -0.885);
  rearGlass.rotation.set(0.12, Math.PI, 0);
  car.add(rearGlass);

  // Interior details stay below the glass line.
  box(car, [1.56, 0.20, 0.22], [0, 1.02, 0.78], trim);
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 10, 20), trim);
  steering.position.set(-0.42, 1.10, 0.57);
  steering.rotation.x = -0.35;
  car.add(steering);
  for (const x of [-0.43, 0.43]) {
    for (const z of [-0.34, 0.42]) {
      box(car, [0.48, 0.13, 0.48], [x, 0.67, z], leather);
      const back = box(car, [0.46, 0.52, 0.12], [x, 0.98, z - 0.16], leather);
      back.rotation.x = -0.12;
    }
  }

  const parts = {};
  function createDoor(name, side, frontHinge, label) {
    const length = 0.82;
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.91, 0.52, frontHinge ? 0.94 : -0.94);
    car.add(pivot);
    const centerZ = frontHinge ? -length / 2 : length / 2;
    const panel = box(pivot, [0.075, 0.50, length], paint, [0, 0.25, centerZ]);
    box(pivot, [0.055, 0.055, length - 0.07], trim, [side * 0.018, 0.98, centerZ]);
    const window = new THREE.Mesh(new THREE.PlaneGeometry(length - 0.12, 0.43), glass);
    window.rotation.y = side * Math.PI / 2;
    window.position.set(side * 0.052, 0.76, centerZ);
    pivot.add(window);
    box(pivot, [0.045, 0.045, length - 0.10], paint, [side * 0.035, 0.53, centerZ]);
    const handle = box(pivot, [0.035, 0.045, 0.13], chrome,
      [side * 0.065, 0.43, centerZ + (frontHinge ? 0.20 : -0.20)]);
    const maxAngle = (frontHinge ? -side : side) * (Math.PI / 3);
    const part = { pivot, panel, window, open: false, angle: 0, maxAngle, label };
    parts[name] = part;
    aimTargets.push({
      mesh: panel, maxDist: 3.6,
      getLabel: () => name === "doorFL" && part.open ? "ENTER SEDAN" : (part.open ? "CLOSE " : "OPEN ") + label,
      onInteract: () => {
        if (name === "doorFL" && part.open) enterVehicle("car");
        else { part.open = !part.open; showToast((part.open ? "Opened " : "Closed ") + label); }
      }
    });
  }
  createDoor("doorFL", -1, true, "DRIVER DOOR");
  createDoor("doorFR", 1, true, "PASSENGER DOOR");
  createDoor("doorRL", -1, false, "REAR LEFT DOOR");
  createDoor("doorRR", 1, false, "REAR RIGHT DOOR");

  const hoodPivot = new THREE.Group();
  hoodPivot.position.set(0, 1.08, 0.94);
  const hoodMesh = box(hoodPivot, [1.72, 0.06, 1.02], paint, [0, 0, 0.51]);
  car.add(hoodPivot);
  parts.hood = { pivot: hoodPivot, open: false, angle: 0, maxAngle: -50 * Math.PI / 180 };
  aimTargets.push({ mesh: hoodMesh, maxDist: 3.8,
    getLabel: () => parts.hood.open ? "CLOSE SEDAN HOOD" : "OPEN SEDAN HOOD",
    onInteract: () => { parts.hood.open = !parts.hood.open; showToast(parts.hood.open ? "Opened sedan hood" : "Closed sedan hood"); }
  });

  const trunkPivot = new THREE.Group();
  trunkPivot.position.set(0, 1.08, -0.94);
  const trunkMesh = box(trunkPivot, [1.72, 0.06, 1.00], paint, [0, 0, -0.50]);
  car.add(trunkPivot);
  parts.trunk = { pivot: trunkPivot, open: false, angle: 0, maxAngle: 55 * Math.PI / 180 };
  aimTargets.push({ mesh: trunkMesh, maxDist: 3.8,
    getLabel: () => parts.trunk.open ? "CLOSE SEDAN TRUNK" : "OPEN SEDAN TRUNK",
    onInteract: () => { parts.trunk.open = !parts.trunk.open; showToast(parts.trunk.open ? "Opened sedan trunk" : "Closed sedan trunk"); }
  });

  const headLights = [], tailMats = [];
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.07), headLampMat);
    head.position.set(side * 0.65, 0.82, 2.04); car.add(head); headLights.push(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.07), tailLampMat);
    tail.position.set(side * 0.65, 0.80, -2.04); car.add(tail); tailMats.push(tailLampMat);
  }
  const carSpotL = new THREE.SpotLight(0xfff1ce, 0, 58, 0.52, 0.48, 1);
  const carSpotR = new THREE.SpotLight(0xfff1ce, 0, 58, 0.52, 0.48, 1);
  carSpotL.position.set(-0.64, 0.82, 2.05); carSpotR.position.set(0.64, 0.82, 2.05);
  carSpotL.target.position.set(-0.64, 0.25, 17); carSpotR.target.position.set(0.64, 0.25, 17);
  car.add(carSpotL, carSpotL.target, carSpotR, carSpotR.target);

  const wheels = [];
  function makeWheel(x, z, isFront) {
    const steerGrp = new THREE.Group();
    steerGrp.position.set(x, wheelRadius, z);
    car.add(steerGrp);
    const spinGrp = new THREE.Group();
    steerGrp.add(spinGrp);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.24, 28), new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.9 }));
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.62, wheelRadius * 0.62, 0.25, 18), chrome);
    rim.rotation.z = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.26, 16), trim);
    cap.rotation.z = Math.PI / 2;
    spinGrp.add(tire, rim, cap);
    wheels.push({ steerGrp, spinGrp, isFront, tireMesh: tire, mesh: steerGrp, health: 1, blown: false });
  }
  makeWheel(-0.88, 1.38, true); makeWheel(0.88, 1.38, true);
  makeWheel(-0.88, -1.38, false); makeWheel(0.88, -1.38, false);

  car.userData = { parts, wheels, headLights, carSpotL, carSpotR, tailMats, WR: wheelRadius, forwardSign: 1 };
  aimTargets.push({ mesh: car, maxDist: 4.2, getLabel: () => "ENTER SEDAN", onInteract: () => enterVehicle("car") });
  return car;
}

function buildCargoTruck() {
  // Same convention as the sedan: origin at chassis centre, +Z is forward.
  const truck = new THREE.Group();
  truck.name = "KORR_CREAM_BOX_TRUCK";
  const cabPaint = new THREE.MeshStandardMaterial({ color: 0xe0d6c4, metalness: 0.22, roughness: 0.48 });
  const cargoPaint = new THREE.MeshStandardMaterial({ color: 0xe9e3d8, roughness: 0.76 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x191d1e, roughness: 0.78 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcbd1cf, metalness: 0.84, roughness: 0.24 });
  const glass = makeVehicleGlass();
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4d5, emissive: 0xffe4a3, emissiveIntensity: 1.15 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x8f1618, emissive: 0xff1515, emissiveIntensity: 0.5 });
  const box = (parent, size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  };
  const W = 2.36, wheelRadius = 0.52;

  // Chassis and cargo compartment are independent; cargo ends behind the cab.
  box(truck, [2.05, 0.22, 6.85], [0, 0.58, -0.02], dark);
  box(truck, [2.18, 0.12, 4.00], [0, 0.83, -1.43], dark);             // cargo floor
  box(truck, [2.18, 0.12, 4.00], [0, 2.79, -1.43], cargoPaint);       // cargo roof
  box(truck, [0.10, 1.88, 4.00], [-1.13, 1.82, -1.43], cargoPaint);   // left wall
  box(truck, [0.10, 1.88, 4.00], [1.13, 1.82, -1.43], cargoPaint);    // right wall
  box(truck, [2.18, 1.88, 0.10], [0, 1.82, 0.57], cargoPaint);        // front wall
  // The rear opening is clear when the top-hinged cargo door is raised.

  // Cab floor and separate engine bay at the forward end.
  box(truck, [2.18, 0.14, 1.55], [0, 0.80, 1.55], dark);
  box(truck, [1.72, 0.42, 0.76], [0, 0.91, 2.92], dark);
  box(truck, [0.92, 0.30, 0.55], [0, 1.05, 2.88], dark);
  box(truck, [2.44, 0.26, 0.18], [0, 0.68, 3.42], dark);            // front bumper
  box(truck, [1.08, 0.42, 0.08], [0, 1.06, 3.39], chrome);          // grille

  // Cab rear bulkhead leaves a small expansion seam before the cargo front wall.
  box(truck, [2.18, 1.62, 0.08], [0, 1.75, 0.78], cabPaint);

  // Cab roof, pillars and flush glazing.
  box(truck, [2.16, 0.14, 1.58], [0, 2.56, 1.62], cabPaint);
  for (const side of [-1, 1]) {
    const front = box(truck, [0.10, 1.06, 0.10], [side * 1.06, 2.00, 2.39], cabPaint);
    front.rotation.x = -0.05;
    box(truck, [0.10, 1.06, 0.10], [side * 1.06, 2.00, 0.90], cabPaint);
    box(truck, [0.09, 0.88, 0.08], [side * 1.06, 1.96, 1.62], cabPaint);
  }
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 0.78), glass);
  windshield.position.set(0, 1.98, 2.435); windshield.rotation.x = -0.05; truck.add(windshield);
  const rearCabGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 0.70), glass);
  rearCabGlass.position.set(0, 1.98, 0.735); rearCabGlass.rotation.set(0.05, Math.PI, 0); truck.add(rearCabGlass);

  const driverSeat = box(truck, [0.62, 0.62, 0.58], new THREE.Vector3(-0.52, 1.16, 1.34).toArray(), dark);
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.026, 10, 22), dark);
  steering.position.set(-0.55, 1.55, 2.00); steering.rotation.x = -0.42; truck.add(steering);

  const bonnetPivot = new THREE.Group();
  bonnetPivot.position.set(0, 1.38, 2.48);
  const bonnetMesh = box(bonnetPivot, [2.12, 0.07, 0.88], cabPaint, [0, 0, 0.44]);
  truck.add(bonnetPivot);
  const bonnetPart = { pivot: bonnetPivot, open: false, angle: 0, maxAngle: -50 * Math.PI / 180 };
  aimTargets.push({ mesh: bonnetMesh, maxDist: 4.0,
    getLabel: () => bonnetPart.open ? "CLOSE TRUCK HOOD" : "OPEN TRUCK HOOD",
    onInteract: () => { bonnetPart.open = !bonnetPart.open; showToast(bonnetPart.open ? "Opened truck hood" : "Closed truck hood"); }
  });

  const doorParts = [];
  function createTruckDoor(side, label) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 1.17, 0.78, 2.34);
    truck.add(pivot);
    const centerZ = -0.70;
    const panel = box(pivot, [0.08, 0.72, 1.38], cabPaint, [0, 0.36, centerZ]);
    const window = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.54), glass);
    window.rotation.y = side * Math.PI / 2;
    window.position.set(side * 0.052, 1.05, centerZ);
    pivot.add(window);
    box(pivot, [0.06, 0.06, 1.28], cabPaint, [0, 1.38, centerZ]);
    box(pivot, [0.06, 0.06, 1.28], dark, [0, 0.74, centerZ]);
    const part = { pivot, panel, window, open: false, angle: 0, maxAngle: -side * (Math.PI / 3), label };
    doorParts.push(part);
    aimTargets.push({
      mesh: panel, maxDist: 4.0,
      getLabel: () => side === -1 && part.open ? "ENTER TRUCK" : (part.open ? "CLOSE " : "OPEN ") + label,
      onInteract: () => {
        if (side === -1 && part.open) enterVehicle("truck");
        else { part.open = !part.open; showToast((part.open ? "Opened " : "Closed ") + label); }
      }
    });
  }
  createTruckDoor(-1, "TRUCK DRIVER DOOR");
  createTruckDoor(1, "TRUCK PASSENGER DOOR");
  const doorPart = doorParts[0];

  const shutterPivot = new THREE.Group();
  shutterPivot.position.set(0, 2.72, -3.49);
  const shutterMesh = box(shutterPivot, [2.12, 1.82, 0.08], chrome, [0, -0.91, 0]);
  truck.add(shutterPivot);
  const shutterPart = { pivot: shutterPivot, open: false, angle: 0, maxAngle: 1.48 };
  aimTargets.push({ mesh: shutterMesh, maxDist: 4.2,
    getLabel: () => shutterPart.open ? "CLOSE REAR CARGO DOOR" : "OPEN REAR CARGO DOOR",
    onInteract: () => { shutterPart.open = !shutterPart.open; showToast(shutterPart.open ? "Rear cargo door raised" : "Rear cargo door closed"); }
  });

  // Cargo remains inside the compartment and below the roofline.
  const cartonMat = new THREE.MeshStandardMaterial({ color: 0xb9834c, roughness: 0.86 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x80603b, roughness: 0.92 });
  for (const [x, z] of [[-0.52, -0.65], [0.52, -0.65], [-0.52, -1.55], [0.52, -1.55]]) {
    const carton = box(truck, [0.60, 0.50, 0.56], [x, 1.16, z], cartonMat);
    box(truck, [0.075, 0.505, 0.565], [x, 1.16, z], tapeMat);
  }

  const headLights = [], tailLights = [];
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.20, 0.08), headMat);
    head.position.set(side * 0.88, 1.00, 3.42); truck.add(head); headLights.push(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.42, 0.08), tailMat);
    tail.position.set(side * 1.02, 1.10, -3.50); truck.add(tail); tailLights.push(tail);
  }
  const tSpotL = new THREE.SpotLight(0xfff1ce, 0, 78, 0.58, 0.48, 1);
  const tSpotR = new THREE.SpotLight(0xfff1ce, 0, 78, 0.58, 0.48, 1);
  tSpotL.position.set(-0.88, 1.0, 3.44); tSpotR.position.set(0.88, 1.0, 3.44);
  tSpotL.target.position.set(-0.88, 0.25, 22); tSpotR.target.position.set(0.88, 0.25, 22);
  truck.add(tSpotL, tSpotL.target, tSpotR, tSpotR.target);

  const wheels = [];
  function makeTruckWheel(x, z, isFront) {
    const steerGrp = new THREE.Group();
    steerGrp.position.set(x, wheelRadius, z); truck.add(steerGrp);
    const spinGrp = new THREE.Group(); steerGrp.add(spinGrp);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.38, 26), new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.9 }));
    tire.rotation.z = Math.PI / 2; tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * 0.56, wheelRadius * 0.56, 0.40, 18), chrome);
    rim.rotation.z = Math.PI / 2;
    spinGrp.add(tire, rim);
    wheels.push({ steerGrp, spinGrp, isFront });
  }
  makeTruckWheel(-1.16, 2.28, true); makeTruckWheel(1.16, 2.28, true);
  makeTruckWheel(-1.16, -1.62, false); makeTruckWheel(1.16, -1.62, false);
  makeTruckWheel(-1.16, -2.55, false); makeTruckWheel(1.16, -2.55, false);

  truck.userData = { bonnetPart, doorPart, doorParts, shutterPart, wheels, headLights, tailMats: tailLights.map(light => light.material), tSpotL, tSpotR, WR: wheelRadius, forwardSign: 1 };
  return truck;
}

function buildRebelBike() {
  const bike = new THREE.Group();
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x1e272e, metalness: 0.65, roughness: 0.25 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, metalness: 0.5, roughness: 0.3 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdce3ea, metalness: 0.9, roughness: 0.18 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x2c1e16, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 0.75 });

  const WR = 0.34;

  // Lower Frame & Engine V-Twin / Block
  const frameRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.35), darkMat);
  frameRail.position.set(0, 0.42, 0.05); frameRail.castShadow = true; bike.add(frameRail);

  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.34), chromeMat);
  engine.position.set(0, 0.46, -0.05); engine.castShadow = true; bike.add(engine);

  // Dual Chrome Exhaust Pipes
  for (const s of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 1.15, 12), chromeMat);
    pipe.rotation.x = Math.PI / 2 - 0.06;
    pipe.position.set(s * 0.20, 0.32, 0.25); pipe.castShadow = true; bike.add(pipe);
  }

  // Sculpted Fuel Tank & Low Cruiser Seat
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.54), tankMat);
  tank.position.set(0, 0.72, -0.24); tank.castShadow = true;
  const tankStripe = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.05, 0.44), accentMat);
  tankStripe.position.set(0, 0.74, -0.24);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.10, 0.56), leatherMat);
  seat.position.set(0, 0.62, 0.30); seat.castShadow = true;
  const rearFender = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.42), tankMat);
  rearFender.position.set(0, 0.56, 0.72);
  bike.add(tank, tankStripe, seat, rearFender);

  // Front Fork, Headlight & Cruiser Handlebars (Steers with front wheel!)
  const forkPivot = new THREE.Group();
  forkPivot.position.set(0, 0.66, -0.56);
  bike.add(forkPivot);

  const forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.64, 10), chromeMat);
  forkL.position.set(-0.09, -0.22, -0.14); forkL.rotation.x = 0.42;
  const forkR = forkL.clone(); forkR.position.x = 0.09;

  const hBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.76, 10), chromeMat);
  hBar.rotation.z = Math.PI / 2; hBar.position.set(0, 0.22, -0.04);

  const headLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xfff8dc, emissive: 0xffeaa7, emissiveIntensity: 1.4 }));
  headLamp.rotation.x = Math.PI / 2; headLamp.position.set(0, 0.12, -0.26);

  forkPivot.add(forkL, forkR, hBar, headLamp);

  // Front & Rear Spoked Wheels
  const wheels = [];
  function makeBikeWheel(z, isFront) {
    const grp = new THREE.Group(); grp.position.set(0, WR, z); bike.add(grp);
    const spin = new THREE.Group(); grp.add(spin);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(WR - 0.04, 0.065, 12, 24), new THREE.MeshStandardMaterial({ color: 0x151619, roughness: 0.85 }));
    tire.rotation.y = Math.PI / 2; tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), chromeMat); hub.rotation.z = Math.PI / 2;
    const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, WR * 1.75, 0.02), chromeMat);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, WR * 1.75), chromeMat);
    spin.add(tire, hub, bar1, bar2);
    wheels.push({ grp, spin, isFront });
  }
  makeBikeWheel(-0.88, true);
  makeBikeWheel( 0.78, false);

  aimTargets.push({
    mesh: tank,
    maxDist: 3.4,
    getLabel: () => "Mount Rebel Bike",
    onInteract: () => enterVehicle('bike')
  });

  bike.userData = { forkPivot, wheels, WR, forwardSign: -1 };
  return bike;
}
