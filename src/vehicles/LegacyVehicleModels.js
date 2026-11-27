import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
let aimTargets=[]; let showToast=()=>{}; let enterVehicle=()=>{};
export function createLegacyFleet(context={}) { aimTargets=context.aimTargets||[]; showToast=context.showToast||(()=>{}); enterVehicle=context.enterVehicle||(()=>{}); const sedan=buildDetailedSedan(); const truck=buildCargoTruck(); const bike=buildRebelBike(); return {sedan,truck,bike,aimTargets}; }
function buildDetailedSedan(paintHex = 0x8b1e24) {
  const car = new THREE.Group();
  const paintMat = new THREE.MeshStandardMaterial({ color: paintHex, metalness: 0.58, roughness: 0.24 });
  const darkTrim = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.65 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdce3ea, metalness: 0.9, roughness: 0.18 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xb8e2f4, transparent: true, opacity: 0.32, roughness: 0.08, side: THREE.DoubleSide });

  const W = 1.84, WR = 0.35;

  // Hollow Interior Floorpan (z from -0.95 to +1.08)
  const floorPan = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 0.12, 2.04), darkTrim);
  floorPan.position.set(0, 0.35, 0.06); floorPan.castShadow = true; floorPan.receiveShadow = true;
  car.add(floorPan);

  // Rocker panels under door hinges
  for (const s of [-1, 1]) {
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.14, 2.02), paintMat);
    sill.position.set(s * (W / 2 - 0.05), 0.36, 0.06); sill.castShadow = true;
    car.add(sill);
  }

  // Front Engine Bay & Engine Components
  const engineBay = new THREE.Mesh(new THREE.BoxGeometry(W - 0.10, 0.52, 1.18), darkTrim);
  engineBay.position.set(0, 0.62, -1.56); engineBay.castShadow = true; car.add(engineBay);
  const frontFenderWall = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.12, 1.18), paintMat);
  frontFenderWall.position.set(0, 0.88, -1.56); frontFenderWall.castShadow = true; car.add(frontFenderWall);

  const engBlock = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.34, 0.62), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.75, roughness: 0.32 }));
  engBlock.position.set(0, 0.96, -1.55);
  const battery = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.20, 0.18), new THREE.MeshStandardMaterial({ color: 0x2980b9 }));
  battery.position.set(0.46, 0.96, -1.78);
  car.add(engBlock, battery);

  const fBumper = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.26, 0.24), darkTrim); fBumper.position.set(0, 0.42, -2.18);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.18, 0.08), chromeMat); grille.position.set(0, 0.66, -2.15);
  car.add(fBumper, grille);

  const headLights = [];
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), new THREE.MeshStandardMaterial({ color: 0xfffae6, emissive: 0xffeaa7, emissiveIntensity: 1.5 }));
    hl.position.set(s * 0.66, 0.68, -2.15); car.add(hl); headLights.push(hl);
  }

  const carSpotL = new THREE.SpotLight(0xfff4d6, 0, 68, 0.6, 0.45, 1);
  carSpotL.position.set(-0.66, 0.70, -2.2); carSpotL.target.position.set(-0.66, 0.3, -16);
  const carSpotR = new THREE.SpotLight(0xfff4d6, 0, 68, 0.6, 0.45, 1);
  carSpotR.position.set(0.66, 0.70, -2.2); carSpotR.target.position.set(0.66, 0.3, -16);
  car.add(carSpotL, carSpotL.target, carSpotR, carSpotR.target);

  // Rear Cargo Trunk Tub + Items
  const trunkFloor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 0.12, 1.04), darkTrim); trunkFloor.position.set(0, 0.46, 1.64);
  const trunkWallL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 1.04), paintMat); trunkWallL.position.set(-W / 2 + 0.07, 0.67, 1.64);
  const trunkWallR = trunkWallL.clone(); trunkWallR.position.x = W / 2 - 0.07;
  const trunkWallB = new THREE.Mesh(new THREE.BoxGeometry(W, 0.44, 0.14), paintMat); trunkWallB.position.set(0, 0.67, 2.12);
  const rBumper = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.26, 0.22), darkTrim); rBumper.position.set(0, 0.42, 2.18);
  const jerryCan = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.18), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.4 })); jerryCan.position.set(-0.42, 0.68, 1.66);
  const toolBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.24), new THREE.MeshStandardMaterial({ color: 0x2980b9, metalness: 0.5 })); toolBox.position.set(0.35, 0.61, 1.64);
  car.add(trunkFloor, trunkWallL, trunkWallR, trunkWallB, rBumper, jerryCan, toolBox);

  const tailMats = [];
  for (const s of [-1, 1]) {
    const tm = new THREE.MeshStandardMaterial({ color: 0x900, emissive: 0xff0000, emissiveIntensity: 0.35 });
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tm); tl.position.set(s * 0.68, 0.76, 2.18);
    car.add(tl); tailMats.push(tm);
  }

  // Roof & Pillars (Connected cleanly with no floating parts)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W - 0.24, 0.08, 1.64), paintMat);
  roof.position.set(0, 1.44, 0.12); roof.castShadow = true; car.add(roof);

  for (const s of [-1, 1]) {
    const aPil = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.62, 0.08), paintMat); aPil.position.set(s * (W / 2 - 0.12), 1.16, -0.82); aPil.rotation.x = -0.44;
    const bPil = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.56, 0.10), darkTrim); bPil.position.set(s * (W / 2 - 0.10), 1.16, 0.08);
    const cPil = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.12), paintMat); cPil.position.set(s * (W / 2 - 0.12), 1.16, 0.98); cPil.rotation.x = 0.46;
    car.add(aPil, bPil, cPil);
  }

  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.26, 0.68), glassMat); windshield.position.set(0, 1.17, -0.84); windshield.rotation.x = -Math.PI / 2 + 0.45;
  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.26, 0.66), glassMat); rearGlass.position.set(0, 1.17, 1.00); rearGlass.rotation.x = Math.PI / 2 - 0.47;
  car.add(windshield, rearGlass);

  // Dashboard, Steering Wheel & 4 Seats
  const dash = new THREE.Mesh(new THREE.BoxGeometry(W - 0.22, 0.36, 0.42), darkTrim); dash.position.set(0, 0.76, -0.84);
  const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.024, 10, 24), darkTrim); steerWheel.position.set(-0.44, 0.94, -0.58); steerWheel.rotation.x = -0.45;
  car.add(dash, steerWheel);

  function makeSeat(x, z) {
    const sg = new THREE.Group(); sg.position.set(x, 0.41, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.52), seatMat); base.position.y = 0.08;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.58, 0.12), seatMat); back.position.set(0, 0.38, 0.22); back.rotation.x = -0.14;
    const headR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.10), seatMat); headR.position.set(0, 0.74, 0.26);
    sg.add(base, back, headR); car.add(sg);
  }
  makeSeat(-0.44, -0.22); makeSeat(0.44, -0.22); makeSeat(-0.44, 0.62); makeSeat(0.44, 0.62);

  // Fixed Hinged Doors: Hinge at front (-0.76 for front, +0.12 for rear), panel extends cleanly along +Z with proper side orientation
  const parts = {};
  function createDoor(name, side, zHinge, zLen, isFront, label) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (W / 2 - 0.04), 0.42, zHinge);
    car.add(pivot);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.50, zLen), paintMat);
    panel.position.set(0, 0.25, zLen / 2); panel.castShadow = true;

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.14), chromeMat);
    handle.position.set(side * 0.05, 0.42, zLen - 0.16);

    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, zLen - 0.06), darkTrim);
    frameTop.position.set(0, 0.96, zLen / 2);
    const frameRear = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.48, 0.05), darkTrim);
    frameRear.position.set(0, 0.73, zLen - 0.03);

    const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(zLen - 0.08, 0.44), glassMat);
    winGlass.rotation.y = Math.PI / 2; winGlass.position.set(0, 0.73, zLen / 2);

    pivot.add(panel, handle, frameTop, frameRear, winGlass);
    if (isFront) {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.08), darkTrim);
      mirror.position.set(side * 0.11, 0.54, 0.10);
      pivot.add(mirror);
    }

    // Swings outward away from cabin (side = -1 left swings -Y, side = +1 right swings +Y)
    const doorPart = { pivot, open: false, angle: 0, maxAngle: side * -1.05, winGlass, winDown: false, label };
    parts[name] = doorPart;

    aimTargets.push({
      mesh: panel,
      maxDist: 3.4,
      getLabel: () => {
        if (name === 'doorFL' && doorPart.open) return "Get In Driver Seat";
        return doorPart.open ? `Close ${label}` : `Open ${label}`;
      },
      onInteract: () => {
        if (name === 'doorFL' && doorPart.open) {
          enterVehicle('car');
        } else {
          doorPart.open = !doorPart.open;
          showToast(`${doorPart.open ? 'Opened' : 'Closed'} ${label}`);
        }
      }
    });
    return doorPart;
  }

  createDoor('doorFL', -1, -0.76, 0.86, true, "Sedan Driver Door");
  createDoor('doorFR',  1, -0.76, 0.86, true, "Sedan Passenger Door");
  createDoor('doorRL', -1,  0.12, 0.84, false, "Sedan Rear Left Door");
  createDoor('doorRR',  1,  0.12, 0.84, false, "Sedan Rear Right Door");

  // Openable Bonnet / Hood
  const hoodPivot = new THREE.Group(); hoodPivot.position.set(0, 0.92, -0.98);
  const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(W - 0.10, 0.06, 1.18), paintMat);
  hoodMesh.position.set(0, 0, -0.59); hoodMesh.castShadow = true;
  hoodPivot.add(hoodMesh); car.add(hoodPivot);
  parts.hood = { pivot: hoodPivot, open: false, angle: 0, maxAngle: 0.78 };
  aimTargets.push({
    mesh: hoodMesh, maxDist: 3.6,
    getLabel: () => (parts.hood.open ? "Close Sedan Bonnet" : "Open Sedan Bonnet"),
    onInteract: () => { parts.hood.open = !parts.hood.open; showToast(`${parts.hood.open ? 'Opened' : 'Closed'} Sedan Bonnet`); }
  });

  // Openable Trunk Lid
  const trunkPivot = new THREE.Group(); trunkPivot.position.set(0, 0.92, 1.12);
  const trunkMesh = new THREE.Mesh(new THREE.BoxGeometry(W - 0.10, 0.06, 1.04), paintMat);
  trunkMesh.position.set(0, 0, 0.52); trunkMesh.castShadow = true;
  trunkPivot.add(trunkMesh); car.add(trunkPivot);
  parts.trunk = { pivot: trunkPivot, open: false, angle: 0, maxAngle: -0.92 };
  aimTargets.push({
    mesh: trunkMesh, maxDist: 3.6,
    getLabel: () => (parts.trunk.open ? "Close Sedan Trunk" : "Open Sedan Trunk"),
    onInteract: () => { parts.trunk.open = !parts.trunk.open; showToast(`${parts.trunk.open ? 'Opened' : 'Closed'} Sedan Trunk`); }
  });

  // 4 Wheels
  const wheels = [];
  function makeWheel(x, z, isFront) {
    const steerGrp = new THREE.Group(); steerGrp.position.set(x, WR, z); car.add(steerGrp);
    const spinGrp = new THREE.Group(); steerGrp.add(spinGrp);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(WR, WR, 0.23, 24), new THREE.MeshStandardMaterial({ color: 0x151619, roughness: 0.85 }));
    tire.rotation.z = Math.PI / 2; tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(WR * 0.62, WR * 0.62, 0.24, 16), chromeMat); rim.rotation.z = Math.PI / 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.25, WR * 1.15, 0.05), darkTrim);
    const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, WR * 1.15), darkTrim);
    spinGrp.add(tire, rim, spoke, spoke2);
    wheels.push({ steerGrp, spinGrp, isFront });
  }
  makeWheel(-0.84, -1.42, true); makeWheel(0.84, -1.42, true); makeWheel(-0.84, 1.42, false); makeWheel(0.84, 1.42, false);

  car.userData = { parts, wheels, headLights, carSpotL, carSpotR, tailMats, WR };
  return car;
}

function buildCargoTruck() {
  const truck = new THREE.Group();
  const cabMat = new THREE.MeshStandardMaterial({ color: 0xd9771c, metalness: 0.45, roughness: 0.32 });
  const cargoMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d5, roughness: 0.72 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.7 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdce3ea, metalness: 0.88, roughness: 0.2 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xb8e2f4, transparent: true, opacity: 0.32, roughness: 0.08, side: THREE.DoubleSide });

  const W = 2.36, WR = 0.52;

  // Main Steel Chassis Frame (z from -3.4 to +3.6)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.24, 7.0), darkMat);
  chassis.position.set(0, 0.62, 0.1); chassis.castShadow = true; truck.add(chassis);

  // Cab Floor & Engine Bay (z from -3.35 to -1.35)
  const cabFloor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.14, 0.14, 1.9), darkMat);
  cabFloor.position.set(0, 0.76, -1.75); truck.add(cabFloor);

  // Engine Block under Bonnet (z = -2.85)
  const engBay = new THREE.Mesh(new THREE.BoxGeometry(W - 0.24, 0.68, 1.15), darkMat);
  engBay.position.set(0, 1.12, -2.82); truck.add(engBay);
  const truckEngine = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.46, 0.78), new THREE.MeshStandardMaterial({ color: 0x2c7873, metalness: 0.65, roughness: 0.35 }));
  truckEngine.position.set(0, 1.56, -2.82); truck.add(truckEngine);

  // Front Bumper, Grille & Headlights
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.34, 0.32), darkMat); bumper.position.set(0, 0.66, -3.45);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.48, 0.1), chromeMat); grille.position.set(0, 1.18, -3.38);
  truck.add(bumper, grille);

  const headLights = [];
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.1), new THREE.MeshStandardMaterial({ color: 0xfffae6, emissive: 0xffeaa7, emissiveIntensity: 1.5 }));
    hl.position.set(s * 0.88, 0.96, -3.38); truck.add(hl); headLights.push(hl);
  }

  const tSpotL = new THREE.SpotLight(0xfff4d6, 0, 80, 0.62, 0.45, 1);
  tSpotL.position.set(-0.88, 0.98, -3.42); tSpotL.target.position.set(-0.88, 0.3, -20);
  const tSpotR = new THREE.SpotLight(0xfff4d6, 0, 80, 0.62, 0.45, 1);
  tSpotR.position.set(0.88, 0.98, -3.42); tSpotR.target.position.set(0.88, 0.3, -20);
  truck.add(tSpotL, tSpotL.target, tSpotR, tSpotR.target);

  // Cab Upper Roof, Windshield & Driver Seat
  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, 0.12, 1.45), cabMat);
  cabRoof.position.set(0, 2.38, -1.52); cabRoof.castShadow = true; truck.add(cabRoof);
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.24, 0.86), glassMat);
  windshield.position.set(0, 1.92, -2.25); windshield.rotation.x = -Math.PI / 2 + 0.12; truck.add(windshield);

  const steerWheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 10, 24), darkMat);
  steerWheel.position.set(-0.56, 1.48, -1.92); steerWheel.rotation.x = -0.5; truck.add(steerWheel);
  const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.68, 0.58), new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8 }));
  driverSeat.position.set(-0.56, 1.15, -1.48); truck.add(driverSeat);

  // Openable Truck Bonnet (Hinged at windshield base z = -2.25)
  const bonnetPivot = new THREE.Group(); bonnetPivot.position.set(0, 1.48, -2.25);
  const bonnetMesh = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, 0.08, 1.16), cabMat);
  bonnetMesh.position.set(0, 0, -0.58); bonnetMesh.castShadow = true;
  bonnetPivot.add(bonnetMesh); truck.add(bonnetPivot);
  const bonnetPart = { pivot: bonnetPivot, open: false, angle: 0, maxAngle: 0.72 };
  aimTargets.push({
    mesh: bonnetMesh, maxDist: 4.0,
    getLabel: () => (bonnetPart.open ? "Close Truck Bonnet" : "Open Truck Bonnet"),
    onInteract: () => { bonnetPart.open = !bonnetPart.open; showToast(`${bonnetPart.open ? 'Opened' : 'Closed'} Truck Bonnet`); }
  });

  // Openable Truck Driver Door
  const doorPivot = new THREE.Group(); doorPivot.position.set(-W / 2 + 0.06, 0.82, -2.15);
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.48, 1.12), cabMat);
  doorPanel.position.set(0, 0.74, 0.56); doorPanel.castShadow = true;
  const doorWin = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.52), glassMat);
  doorWin.rotation.y = Math.PI / 2; doorWin.position.set(0, 1.16, 0.56);
  doorPivot.add(doorPanel, doorWin); truck.add(doorPivot);
  const doorPart = { pivot: doorPivot, open: false, angle: 0, maxAngle: 1.02 };
  aimTargets.push({
    mesh: doorPanel, maxDist: 3.8,
    getLabel: () => (doorPart.open ? "Get In Truck Cab" : "Open Truck Door"),
    onInteract: () => {
      if (doorPart.open) enterVehicle('truck');
      else { doorPart.open = true; showToast("Opened Truck Driver Door — Aim & Press E to Get In"); }
    }
  });

  // Hollow Cargo Box Body (z from -0.75 to +3.45, y from 0.82 to 2.75)
  const cargoFloor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 0.12, 4.2), darkMat);
  cargoFloor.position.set(0, 0.82, 1.35); cargoFloor.receiveShadow = true;
  const cargoRoof = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 0.12, 4.24), cargoMat);
  cargoRoof.position.set(0, 2.78, 1.35); cargoRoof.castShadow = true;
  const cargoWallL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.92, 4.2), cargoMat);
  cargoWallL.position.set(-W / 2 + 0.09, 1.80, 1.35); cargoWallL.castShadow = true;
  const cargoWallR = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.92, 4.2), cargoMat);
  cargoWallR.position.set(W / 2 - 0.09, 1.80, 1.35); cargoWallR.castShadow = true;
  const cargoFront = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 1.92, 0.12), cargoMat);
  cargoFront.position.set(0, 1.80, -0.72);
  truck.add(cargoFloor, cargoRoof, cargoWallL, cargoWallR, cargoFront);

  // Rear Roll-Up / Hinged Shutter at z = +3.45 (Slides UP/opens when interacted with!)
  const shutterPivot = new THREE.Group();
  shutterPivot.position.set(0, 2.72, 3.45);
  const shutterMesh = new THREE.Mesh(new THREE.BoxGeometry(W - 0.24, 1.84, 0.08), new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.6, roughness: 0.4 }));
  shutterMesh.position.set(0, -0.92, 0);
  shutterPivot.add(shutterMesh); truck.add(shutterPivot);

  // Shutter swings upward like a rear cargo shutter/door
  const shutterPart = { pivot: shutterPivot, open: false, angle: 0, maxAngle: -1.35 };
  aimTargets.push({
    mesh: shutterMesh, maxDist: 4.2,
    getLabel: () => (shutterPart.open ? "Close Truck Rear Shutter" : "Open Truck Rear Shutter"),
    onInteract: () => {
      shutterPart.open = !shutterPart.open;
      showToast(`${shutterPart.open ? 'Opened' : 'Closed'} Truck Rear Shutter — Aim at Cartons inside to Carry!`);
    }
  });

  // 4 Carryable Delivery Cartons inside Cargo Bay
  const cartonCoords = [
    [-0.52, 1.15, 2.55],
    [ 0.52, 1.15, 2.55],
    [-0.52, 1.15, 1.65],
    [ 0.52, 1.15, 1.65]
  ];
  cartonCoords.forEach(([cx_, cy_, cz_], idx) => {
    const cMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.52, 0.58),
      new THREE.MeshStandardMaterial({ map: cartonTex, roughness: 0.78 })
    );
    cMesh.position.set(cx_, cy_, cz_);
    cMesh.castShadow = true;
    truck.add(cMesh);

    const cObj = { id: idx + 1, mesh: cMesh, carried: false, delivered: false, localPos: new THREE.Vector3(cx_, cy_, cz_) };
    truckCartons.push(cObj);

    aimTargets.push({
      mesh: cMesh,
      maxDist: 4.4,
      getLabel: () => {
        if (!shutterPart.open && !cObj.carried && !cObj.delivered) return "Open Rear Shutter First";
        if (cObj.delivered) return `Carton #${cObj.id} Delivered`;
        return state.carryingCarton ? "Already Carrying a Carton" : `Carry Carton #${cObj.id}`;
      },
      onInteract: () => {
        if (cObj.delivered) return;
        if (!cObj.carried && !shutterPart.open) {
          showToast("Open the Truck Rear Shutter first!");
          return;
        }
        if (state.carryingCarton) {
          showToast("You are already carrying a carton! Deliver it to the Haveli Porch.");
          return;
        }
        cObj.carried = true;
        cObj.mesh.visible = false;
        state.carryingCarton = cObj;
        carriedCartonMesh.visible = true;
        $('carry-badge').classList.add('show');
        showToast(`Picked up Carton #${cObj.id} — Walk to Haveli Porch & press E to deliver!`);
      }
    });
  });

  // 6 Heavy Truck Wheels (Front steer, Rear dual/big wheels)
  const wheels = [];
  function makeTruckWheel(x, z, isFront) {
    const steerGrp = new THREE.Group(); steerGrp.position.set(x, WR, z); truck.add(steerGrp);
    const spinGrp = new THREE.Group(); steerGrp.add(spinGrp);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(WR, WR, 0.36, 24), new THREE.MeshStandardMaterial({ color: 0x151619, roughness: 0.85 }));
    tire.rotation.z = Math.PI / 2; tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(WR * 0.56, WR * 0.56, 0.38, 16), chromeMat); rim.rotation.z = Math.PI / 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.4, WR * 1.05, 0.07), darkMat);
    spinGrp.add(tire, rim, spoke);
    wheels.push({ steerGrp, spinGrp, isFront });
  }
  makeTruckWheel(-1.12, -2.55, true); makeTruckWheel(1.12, -2.55, true);
  makeTruckWheel(-1.12,  1.95, false); makeTruckWheel(1.12,  1.95, false);

  truck.userData = { bonnetPart, doorPart, shutterPart, wheels, headLights, tSpotL, tSpotR, WR };
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

  bike.userData = { forkPivot, wheels, WR };
  return bike;
}
