import { Renderer } from "../renderer/Renderer.js?build=22";
import { moveWithCollisions } from "../player/collision.js?v=3";
import { PLAYER_CONFIG, PHYSICS_CONFIG } from "../config/physics.js";

export class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.running = false;
    this.lastTime = 0;
    this.keys = new Set();
    this.move = { x: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.inVehicle = false;
    this.currentVehicle = null;
    this.currentVehicleType = null;
    this.vehicleSpeed = 0;
    this.vehicleYaw = 0;
    this.vehicleGear = 1;
    this.vehicleLightsOn = false;
    this.vehicleInput = { throttle: 0, steering: 0, brake: 0, handbrake: 0, clutch: 0, pedalBrake: 0 };
    this.vehicleButtons = new Set();
    this.vehicleControlMode = "buttons";
    this.hasGeneratorKey = false;
    this.storyStage = 0;
    this.generatorStarted = false;
    this.ritualKeysFound = new Set();
    this.ritualRoomOpened = false;
    this.chillaStarted = false;
    this.hauntNight = 0;
    this.hauntNightTimer = 0;
    this.nextHauntCue = 0;
    this.hauntCueIndex = 0;
    this.hauntAppliedTurnOffset = 0;
    this.stuckPushTimer = 0;
    this.lastCollisionNormal = { x: 0, z: 0 };
    this.carSpeed = 0;
    this.spareTires = 1;
    this.offroadWear = 0;
    this.stamina = 100;
    this.health = 100;
    this.sprintHeld = false;
    this.sprintRegenDelay = 0;
    this.lookDelta = { yaw: 0, pitch: 0 };
    this.frame = this.frame.bind(this);
    this.setupInput(canvas);
    this.updateStoryUI();
    // The optional avatar is loaded after the world starts.
  }

  setupInput(canvas) {
    const camera = this.renderer.camera;
    this.yaw = camera.rotation.y;
    const onKey = (event, down) => {
      const key = event.key.toLowerCase();
      if (key === "shift") this.sprintHeld = down;
      if (down && !event.repeat && key === "f") this.syncFlashlightButton(this.renderer.toggleFlashlight());
      if (down && !event.repeat && key === "l" && this.inVehicle) this.toggleVehicleLights();
      if (down && !event.repeat && key === "e") this.handleContextInteraction();
      if (key === " ") { down ? this.keys.add(" ") : this.keys.delete(" "); event.preventDefault(); }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        event.preventDefault();
        down ? this.keys.add(key) : this.keys.delete(key);
      }
    };
    window.addEventListener("keydown", e => onKey(e, true));
    window.addEventListener("keyup", e => onKey(e, false));

    let lookPointer = null;
    let previous = null;
    canvas.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      lookPointer = event.pointerId;
      previous = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", event => {
      if (event.pointerId !== lookPointer || !previous) return;
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      previous = { x: event.clientX, y: event.clientY };
      const sensitivity = event.pointerType === "mouse" ? 0.0022 : 0.004;
      const previousPitch = this.pitch;
      const yawChange = -dx * sensitivity;
      this.yaw += yawChange;
      this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - dy * sensitivity));
      this.lookDelta.yaw += yawChange;
      this.lookDelta.pitch += this.pitch - previousPitch;
      camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    });
    const endLook = event => {
      if (event.pointerId === lookPointer) { lookPointer = null; previous = null; }
    };
    canvas.addEventListener("pointerup", endLook);
    canvas.addEventListener("pointercancel", endLook);

    const interactionButton = document.querySelector("#interact-button");
    if (interactionButton) {
      interactionButton.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
        this.handleContextInteraction();
      });
    }

    const flashlightButton = document.querySelector("#flashlight-toggle");
    if (flashlightButton) {
      flashlightButton.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
        this.syncFlashlightButton(this.renderer.toggleFlashlight());
      });
    }

    const sprintButton = document.querySelector("#sprint-button");
    if (sprintButton) {
      const setSprint = value => {
        this.sprintHeld = value;
        sprintButton.classList.toggle("is-held", value);
        sprintButton.setAttribute("aria-pressed", String(value));
      };
      sprintButton.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
        sprintButton.setPointerCapture(event.pointerId);
        setSprint(true);
      });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
        sprintButton.addEventListener(type, () => setSprint(false));
      window.addEventListener("blur", () => setSprint(false));
    }

    document.querySelectorAll("[data-move]").forEach(button => {
      const direction = button.dataset.move;
      const set = value => {
        if (direction === "forward") this.move.z = value ? -1 : 0;
        if (direction === "back") this.move.z = value ? 1 : 0;
        if (direction === "left") this.move.x = value ? -1 : 0;
        if (direction === "right") this.move.x = value ? 1 : 0;
      };
      button.addEventListener("pointerdown", e => { e.preventDefault(); button.setPointerCapture(e.pointerId); set(true); });
      button.addEventListener("pointerup", () => set(false));
      button.addEventListener("pointercancel", () => set(false));
      button.addEventListener("lostpointercapture", () => set(false));
    });
    document.querySelectorAll("[data-vehicle-input]").forEach(button => {
      const action = button.dataset.vehicleInput;
      const set = value => {
        if (value) this.vehicleButtons.add(action); else this.vehicleButtons.delete(action);
        button.classList.toggle("is-held", value);
      };
      button.addEventListener("pointerdown", event => { event.preventDefault(); event.stopPropagation(); button.setPointerCapture(event.pointerId); set(true); });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, () => set(false));
    });
    document.querySelector("#gear-up")?.addEventListener("click", () => this.shiftVehicleGear(1));
    document.querySelector("#gear-down")?.addEventListener("click", () => this.shiftVehicleGear(-1));
    document.querySelector("#vehicle-mode-toggle")?.addEventListener("click", () => this.toggleVehicleControlMode());
    document.querySelector("#vehicle-exit")?.addEventListener("click", () => this.exitVehicle());
    document.querySelector("#vehicle-lights")?.addEventListener("click", () => this.toggleVehicleLights());
    const joystick = document.querySelector("#vehicle-joystick");
    const stick = document.querySelector("#vehicle-joystick-stick");
    let joystickPointer = null;
    const updateJoystick = event => {
      if (event.pointerId !== joystickPointer || !joystick || !stick) return;
      const rect = joystick.getBoundingClientRect();
      const radius = Math.max(26, Math.min(rect.width, rect.height) * 0.34);
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const length = Math.hypot(dx, dy), scale = length > radius ? radius / length : 1;
      const x = dx * scale, y = dy * scale;
      stick.style.transform = "translate(" + x + "px," + y + "px)";
      this.vehicleInput.steering = Math.max(-1, Math.min(1, x / radius));
      this.vehicleInput.throttle = Math.max(-1, Math.min(1, -y / radius));
    };
    joystick?.addEventListener("pointerdown", event => {
      if (this.vehicleControlMode !== "joystick") return;
      event.preventDefault(); joystickPointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId); updateJoystick(event);
    });
    joystick?.addEventListener("pointermove", updateJoystick);
    const releaseJoystick = event => {
      if (event.pointerId !== joystickPointer) return;
      joystickPointer = null; this.vehicleInput.steering = 0; this.vehicleInput.throttle = 0;
      if (stick) stick.style.transform = "translate(0,0)";
    };
    joystick?.addEventListener("pointerup", releaseJoystick);
    joystick?.addEventListener("pointercancel", releaseJoystick);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    if (!this.running) return;
    const deltaSeconds = Math.min((now - this.lastTime) / 1000, PHYSICS_CONFIG.maxDeltaSeconds);
    this.lastTime = now;
    this.update(deltaSeconds);
    this.renderer.render(deltaSeconds);
    requestAnimationFrame(this.frame);
  }

  update(delta) {
    if (this.levelTransitioning) return;
    if (this.inVehicle) {
      this.updateVehicle(delta);
      this.updateInteractionUI();
      this.lookDelta.yaw = 0;
      this.lookDelta.pitch = 0;
      return;
    }
    const hauntInfluence = this.updateHaunting(delta);
    const turnOffset = hauntInfluence?.turnOffset || 0;
    this.yaw += turnOffset - this.hauntAppliedTurnOffset;
    this.hauntAppliedTurnOffset = turnOffset;
    this.renderer.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    const forward = (this.keys.has("w") || this.keys.has("arrowup") ? -1 : 0) +
      (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) + this.move.z + (hauntInfluence?.forwardDrift || 0);
    const strafe = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) +
      (this.keys.has("a") || this.keys.has("arrowleft") ? -1 : 0) + this.move.x;
    const length = Math.hypot(forward, strafe) || 1;
    const moving = Math.abs(forward) + Math.abs(strafe) > 0.01;
    const canSprint = this.sprintHeld && moving && this.stamina > 0.5;
    const sprintMultiplier = canSprint ? 1.7 : 1;
    const speed = PLAYER_CONFIG.moveSpeed * sprintMultiplier * delta / length;
    if (canSprint) {
      this.stamina = Math.max(0, this.stamina - 28 * delta);
      this.sprintRegenDelay = 0.65;
    } else {
      this.sprintRegenDelay = Math.max(0, this.sprintRegenDelay - delta);
      if (this.sprintRegenDelay <= 0) this.stamina = Math.min(100, this.stamina + 19 * delta);
    }
    this.updatePlayerStatus();
    const camera = this.renderer.camera;
    const startX = camera.position.x;
    const startZ = camera.position.z;
    const deltaX = (Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) * speed;
    const deltaZ = (Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) * speed;
    const collisionInfo = { normalX: 0, normalZ: 0 };
    moveWithCollisions(camera.position, deltaX, deltaZ, PLAYER_CONFIG.radius,
      this.renderer.getGateCollisionCells(), this.renderer.solidMeshes, collisionInfo);
    const progressX = camera.position.x - startX;
    const progressZ = camera.position.z - startZ;
    const actualMove = Math.hypot(progressX, progressZ);
    const intendedMove = Math.hypot(deltaX, deltaZ);
    const forwardProgress = intendedMove > 1e-6
      ? (progressX * deltaX + progressZ * deltaZ) / intendedMove : 0;
    // Sliding along a wall is not progress if the player is still pushing into it.
    if (moving && intendedMove > 0.0005 && forwardProgress < 0.002) {
      this.stuckPushTimer += delta;
      if (Math.hypot(collisionInfo.normalX, collisionInfo.normalZ) > 0.25) {
        this.lastCollisionNormal.x = collisionInfo.normalX;
        this.lastCollisionNormal.z = collisionInfo.normalZ;
      }
      if (this.stuckPushTimer >= 2) {
        let nx = this.lastCollisionNormal.x, nz = this.lastCollisionNormal.z;
        const normalLength = Math.hypot(nx, nz);
        if (normalLength < 0.25) {
          const inputLength = Math.hypot(deltaX, deltaZ) || 1;
          nx = -deltaX / inputLength; nz = -deltaZ / inputLength;
        } else { nx /= normalLength; nz /= normalLength; }
        const recovery = Math.max(0.42, PLAYER_CONFIG.radius * 1.6);
        const beforeRecovery = { x: camera.position.x, z: camera.position.z };
        moveWithCollisions(camera.position, nx * recovery, nz * recovery,
          PLAYER_CONFIG.radius, this.renderer.getGateCollisionCells(), this.renderer.solidMeshes);
        if (Math.hypot(camera.position.x - beforeRecovery.x, camera.position.z - beforeRecovery.z) < 0.08) {
          for (const scale of [1, 1.5, 2]) {
            const candidate = { x: beforeRecovery.x + nx * recovery * scale, z: beforeRecovery.z + nz * recovery * scale };
            const corrected = { ...candidate };
            moveWithCollisions(corrected, 0, 0, PLAYER_CONFIG.radius,
              this.renderer.getGateCollisionCells(), this.renderer.solidMeshes);
            if (Math.hypot(corrected.x - candidate.x, corrected.z - candidate.z) < 0.08) {
              camera.position.x = candidate.x; camera.position.z = candidate.z; break;
            }
          }
        }
        this.stuckPushTimer = 0;
        this.lastCollisionNormal.x = 0; this.lastCollisionNormal.z = 0;
        this.showGameToast("You were caught against something. You step back to clear it.");
      }
    } else {
      this.stuckPushTimer = 0;
      this.lastCollisionNormal.x = collisionInfo.normalX;
      this.lastCollisionNormal.z = collisionInfo.normalZ;
    }
    const floorOffset = this.renderer.getFloorOffsetAt(camera.position.x, camera.position.z);
    camera.position.y = 1.62 + floorOffset;
    this.renderer.setInteriorFloorLevel(floorOffset);

    const actualX = camera.position.x - startX;
    const actualZ = camera.position.z - startZ;
    const actualSpeed = delta > 0 ? Math.hypot(actualX, actualZ) / delta : 0;
    this.renderer.updateViewModel(
      delta, actualSpeed, this.lookDelta.yaw, this.lookDelta.pitch
    );
    this.renderer.updateLocalAvatar({
      x: camera.position.x,
      z: camera.position.z,
      yaw: this.yaw,
      speed: actualSpeed,
      delta
    });
    this.updateInteractionUI();
    this.lookDelta.yaw = 0;
    this.lookDelta.pitch = 0;
  }

  updatePlayerStatus() {
    const staminaFill = document.querySelector("#stamina-fill");
    const staminaValue = document.querySelector("#stamina-value");
    const healthFill = document.querySelector("#health-fill");
    const healthValue = document.querySelector("#health-value");
    if (staminaFill) staminaFill.style.width = this.stamina + "%";
    if (staminaValue) staminaValue.textContent = Math.ceil(this.stamina) + "%";
    if (healthFill) healthFill.style.width = this.health + "%";
    if (healthValue) healthValue.textContent = Math.ceil(this.health) + "%";
    const sprintButton = document.querySelector("#sprint-button");
    if (sprintButton) sprintButton.disabled = this.stamina <= 0.5;
  }

  isNearCar() {
    const car = this.renderer.arrivalCar;
    return !!car && Math.hypot(this.renderer.camera.position.x - car.position.x, this.renderer.camera.position.z - car.position.z) < 3.2;
  }

  transitionLevel(label, callback) {
    if (this.levelTransitioning) return;
    this.levelTransitioning = true;
    this.keys.clear();
    this.move.x = 0; this.move.z = 0;
    const overlay = document.querySelector("#level-transition");
    const title = document.querySelector("#level-transition-label");
    if (title) title.textContent = label;
    overlay?.classList.add("is-visible");
    window.setTimeout(() => {
      try { callback(); }
      finally {
        this.levelTransitioning = false;
        overlay?.classList.remove("is-visible");
      }
    }, 380);
  }

  handleContextInteraction() {
    if (this.levelTransitioning) return;
    if (this.inVehicle) {
      this.exitVehicle();
      return;
    }
    const target = this.renderer.interactions.update();
    if (!target) return;
    if (target.id.startsWith("house-door-")) {
      const open = this.renderer.toggleHouseDoor(target.id);
      if (open) {
        this.transitionLevel("ENTERING FARMHOUSE", () => {
          this.renderer.enterInterior();
          this.yaw = 0; this.pitch = 0;
          this.showGameToast("You step inside the farmhouse.");
        });
      } else this.showGameToast("Front door closed.");
      return;
    }
    if (target.id === "interior-exit") {
      const open = this.renderer.toggleInteriorExitDoor();
      if (open) {
        this.showGameToast("The front door is open. Step outside.");
      } else {
        this.transitionLevel("LEAVING FARMHOUSE", () => {
          this.renderer.exitInterior();
          this.yaw = 0; this.pitch = 0;
          this.showGameToast("Back in the farmhouse grounds.");
        });
      }
      return;
    }
    if (target.id === "arrival-car") {
      this.mountVehicle(this.renderer.arrivalCar, "car");
      return;
    }
    if (target.id.startsWith("spare-tire-")) {
      const index = Number(target.id.split("-").pop());
      const pickup = this.renderer.spareTirePickups?.[index];
      if (pickup && !pickup.collected) {
        pickup.collected = true;
        pickup.mesh.visible = false;
        this.spareTires++;
        this.showGameToast("Spare tyre collected. Inventory: " + this.spareTires);
      }
      return;
    }
    if (target.id.startsWith("car-tire-")) {
      const index = Number(target.id.split("-").pop()) - 1;
      const tire = this.renderer.carTireStates?.[index];
      if (!tire?.blown) return;
      if (this.spareTires <= 0) {
        this.showGameToast("No spare tyres. Find one around the driveway.");
        return;
      }
      this.spareTires--;
      tire.blown = false;
      tire.health = 1;
      tire.mesh.scale.y = 1;
      tire.tireMesh.material.color.setHex(0x171a19);
      this.showGameToast(tire.label + " tyre replaced. Spares: " + this.spareTires);
      return;
    }
    if (target.id.startsWith("legacy-vehicle-part-")) {
      const index = Number(target.id.split("-").pop());
      const legacy = this.renderer.legacyVehicleTargets?.[index];
      legacy?.onInteract?.();
      const mountType = this.renderer.vehicleMountRequest;
      if (mountType) {
        this.renderer.vehicleMountRequest = null;
        const vehicle = this.renderer.vehicleFleet?.[mountType === "car" ? "sedan" : mountType];
        if (vehicle) this.mountVehicle(vehicle, mountType);
      }
      return;
    }
    if (target.id === "living-room-mat") {
      if (this.storyStage < 6) {
        this.showGameToast("The mat is worn thin in the middle. Something may be hidden beneath it.");
        return;
      }
      const key = this.renderer.interiorLevel?.ritualKeys?.["ritual-key-mat"];
      if (key && !this.ritualKeysFound.has("ritual-key-mat")) {
        this.renderer.liftLivingRoomMat();
        key.visible = true;
        this.showGameToast("You lift the mat. A brass key is pressed into the underside.");
      }
      return;
    }
    if (target.id === "bedroom-drawer" || target.id === "reception-drawer") {
      if (this.storyStage < 6) {
        this.showGameToast("The drawers can wait. First, find the book that appeared after the generator started.");
        return;
      }
      const bedroom = target.id === "bedroom-drawer";
      const keyId = bedroom ? "ritual-key-bedroom" : "ritual-key-reception";
      const key = this.renderer.interiorLevel?.ritualKeys?.[keyId];
      if (!key || this.ritualKeysFound.has(keyId)) {
        this.showGameToast("The drawer is empty.");
        return;
      }
      this.renderer.openInteriorDrawer(bedroom ? "bedroom" : "reception");
      key.visible = true;
      this.showGameToast(bedroom
        ? "The bedroom drawer slides open. Something brass catches the light."
        : "Inside the reception drawer: another cold brass key.");
      return;
    }
    if (target.id.startsWith("ritual-key-")) {
      if (this.storyStage < 6) {
        this.showGameToast("You should read the ritual book before searching for these keys.");
        return;
      }
      const key = this.renderer.interiorLevel?.ritualKeys?.[target.id];
      if (!key?.visible || this.ritualKeysFound.has(target.id)) return;
      key.visible = false;
      this.ritualKeysFound.add(target.id);
      if (this.ritualKeysFound.size === 3) {
        this.storyStage = 7;
        this.updateStoryUI();
        this.showGameToast("Three keys. Three locks. The upstairs room is waiting.");
      } else {
        this.showGameToast("A cold brass key. " + this.ritualKeysFound.size + " of 3 found.");
      }
      return;
    }
    if (target.id === "ritual-room-door") {
      if (this.ritualKeysFound.size < 3) {
        this.showGameToast("Three locks. The keys are hidden in the bedroom drawer, beneath the living-room mat and inside the reception drawer.");
        return;
      }
      if (!this.ritualRoomOpened) {
        this.ritualRoomOpened = true;
        this.renderer.toggleRitualRoomDoor();
        this.storyStage = 8;
        this.updateStoryUI();
        this.showGameToast("The three locks turn one after another. The upstairs door opens by itself.");
      } else {
        this.showGameToast("The ritual chamber stands open. The salt circle waits.");
      }
      return;
    }
    if (target.id === "ritual-circle") {
      if (!this.ritualRoomOpened || this.chillaStarted) return;
      this.chillaStarted = true;
      this.hauntNight = 1;
      this.hauntNightTimer = 0;
      this.nextHauntCue = 9;
      this.hauntCueIndex = 0;
      this.hauntAppliedTurnOffset = 0;
      this.renderer.startChillaSequence();
      this.renderer.setHauntNight(1);
      this.storyStage = 9;
      this.updateStoryUI();
      this.showGameToast("You step into the salt circle. The air turns cold. Three slow knocks answer from inside the walls.");
      this.playDistantKnocks();
      return;
    }
    if (target.id === "story-diary") {
      this.storyStage = Math.max(this.storyStage, 1);
      this.updateStoryUI();
      this.showGameToast("Uncle's diary: “The money came after the first winter. The house must never be left without power after dusk.”");
      return;
    }
    if (target.id === "story-photo") {
      if (this.storyStage < 1) { this.showGameToast("A photograph of your uncle with three strangers. The diary may explain it."); return; }
      this.storyStage = Math.max(this.storyStage, 2);
      this.updateStoryUI();
      this.showGameToast("On the back: “Three keys. One room. Never read the last page aloud.”");
      return;
    }
    if (target.id === "generator-key") {
      if (this.storyStage < 2) { this.showGameToast("The key is tucked away. Find the diary and examine the photograph first."); return; }
      this.hasGeneratorKey = true;
      this.storyStage = Math.max(this.storyStage, 3);
      this.renderer.setGeneratorKeyCollected(true);
      if (this.renderer.interiorLevel?.generatorKey) this.renderer.interiorLevel.generatorKey.visible = false;
      this.updateStoryUI();
      this.showGameToast("You found the brass key. It is unusually cold.");
      return;
    }
    if (target.id === "generator-door") {
      if (!this.hasGeneratorKey) {
        this.showGameToast("The padlock needs the brass key from the uncle's bedroom.");
      } else {
        const open = this.renderer.toggleGeneratorDoor();
        if (open) {
          this.storyStage = Math.max(this.storyStage, 4);
          this.updateStoryUI();
        }
        this.showGameToast(open ? "The lock gives way. The generator is waiting inside." : "Generator room secured.");
      }
      return;
    }
    if (target.id === "generator-start") {
      if (!this.renderer.generatorDoorOpen) { this.showGameToast("The generator room is locked."); return; }
      if (!this.generatorStarted) {
        this.generatorStarted = true;
        this.renderer.generatorSwitchLever.rotation.x = -0.65;
        this.renderer.storyRitualBook.visible = true;
        if (this.renderer.interiorLevel?.ritualBook) this.renderer.interiorLevel.ritualBook.visible = true;
        this.renderer.elapsed = 120;
        this.storyStage = 5;
        this.updateStoryUI();
        this.showGameToast("The generator catches. The farmhouse falls unnaturally quiet. Three slow knocks answer from somewhere inside.");
        this.playDistantKnocks();
      } else {
        this.showGameToast("The generator is running. It sounds strained.");
      }
      return;
    }
    if (target.id === "story-ritual-book") {
      this.renderer.storyRitualBook.visible = false;
      if (this.renderer.interiorLevel?.ritualBook) this.renderer.interiorLevel.ritualBook.visible = false;
      this.storyStage = 6;
      this.updateStoryUI();
      this.showGameToast("The book opens by itself. A page is marked: THE CHILLA MUST BEGIN AT 12:00. Three keys. Three locks.");
      return;
    }
    if (target.id.startsWith("farmhouse-gate-")) {
      this.syncGateButton(this.renderer.toggleGate());
    }
  }

  shiftVehicleGear(direction) {
    this.vehicleGear = Math.max(1, Math.min(6, this.vehicleGear + direction));
    const display = document.querySelector("#vehicle-gear-value");
    if (display) display.textContent = this.vehicleGear + " / 6";
  }

  toggleVehicleControlMode() {
    this.vehicleControlMode = this.vehicleControlMode === "buttons" ? "joystick" : "buttons";
    const buttonMode = document.querySelector("#vehicle-button-controls");
    const joystickMode = document.querySelector("#vehicle-joystick");
    const toggle = document.querySelector("#vehicle-mode-toggle");
    if (buttonMode) buttonMode.hidden = this.vehicleControlMode !== "buttons";
    if (joystickMode) joystickMode.hidden = this.vehicleControlMode !== "joystick";
    if (toggle) {
      toggle.textContent = this.vehicleControlMode === "buttons" ? "BUTTON CONTROLS" : "JOYSTICK";
      toggle.setAttribute("aria-pressed", String(this.vehicleControlMode === "joystick"));
    }
    this.vehicleButtons.clear();
    this.vehicleInput.steering = 0; this.vehicleInput.throttle = 0;
  }

  toggleVehicleLights() {
    if (!this.currentVehicle) return false;
    this.vehicleLightsOn = !this.vehicleLightsOn;
    const data = this.currentVehicle.userData || {};
    for (const light of [data.carSpotL, data.carSpotR, data.tSpotL, data.tSpotR])
      if (light) light.intensity = this.vehicleLightsOn ? (this.currentVehicleType === "truck" ? 78 : 58) : 0;
    for (const lamp of data.headLights || [])
      if (lamp.material?.emissive) lamp.material.emissiveIntensity = this.vehicleLightsOn ? 2.2 : 1.15;
    const button = document.querySelector("#vehicle-lights");
    if (button) { button.textContent = this.vehicleLightsOn ? "LIGHTS ON" : "LIGHTS"; button.classList.toggle("is-held", this.vehicleLightsOn); }
    return this.vehicleLightsOn;
  }

  mountVehicle(vehicle, type) {
    if (!vehicle) return;
    this.currentVehicle = vehicle;
    this.currentVehicleType = type;
    this.inVehicle = true;
    this.vehicleSpeed = 0; this.carSpeed = 0;
    this.stuckPushTimer = 0;
    this.vehicleYaw = vehicle.rotation.y;
    this.vehicleGear = 1; this.vehicleLightsOn = false;
    this.vehicleButtons.clear();
    this.vehicleInput = { throttle: 0, steering: 0, brake: 0, handbrake: 0, clutch: 0, pedalBrake: 0 };
    this.keys.clear(); this.move.x = 0; this.move.z = 0; this.sprintHeld = false;
    this.yaw = this.vehicleYaw + ((vehicle.userData?.forwardSign || -1) > 0 ? Math.PI : 0);
    this.pitch = type === "bike" ? -0.08 : -0.04;
    document.body.classList.add("in-vehicle");
    const hud = document.querySelector("#vehicle-hud");
    const controls = document.querySelector("#vehicle-controls");
    if (hud) {
      hud.hidden = false;
      const name = hud.querySelector("strong");
      if (name) name.textContent = type === "truck" ? "CARGO TRUCK" : type === "bike" ? "REBEL" : "SEDAN";
    }
    if (controls) controls.hidden = false;
    const exitButton = document.querySelector("#vehicle-exit");
    if (exitButton) exitButton.hidden = false;
    const bikeControls = document.querySelector("#bike-levers");
    const carControls = document.querySelector("#car-pedals");
    if (bikeControls) bikeControls.hidden = type !== "bike";
    if (carControls) carControls.hidden = type === "bike";
    const gear = document.querySelector("#vehicle-gear-value");
    if (gear) gear.textContent = "1 / 6";
    this.positionVehicleCamera();
    this.showGameToast(type === "bike" ? "Mounted Rebel bike." : type === "truck" ? "Entered truck cab." : "Entered driver seat.");
  }

  positionVehicleCamera() {
    const v = this.currentVehicle;
    if (!v) return;
    const forwardSign = v.userData?.forwardSign || -1;
    let lx = -0.44, ly = 1.22, lz = 0.42;
    if (this.currentVehicleType === "truck") { lx = -0.56; ly = 2.02; lz = 1.72; }
    if (this.currentVehicleType === "bike") { lx = 0; ly = 1.04; lz = 0.22; }
    const wx = Math.cos(this.vehicleYaw) * lx + Math.sin(this.vehicleYaw) * lz;
    const wz = -Math.sin(this.vehicleYaw) * lx + Math.cos(this.vehicleYaw) * lz;
    this.renderer.camera.position.set(v.position.x + wx, ly, v.position.z + wz);
    this.yaw = this.vehicleYaw + (forwardSign > 0 ? Math.PI : 0);
    this.renderer.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  exitVehicle() {
    const v = this.currentVehicle;
    if (!v) return;
    const yaw = this.vehicleYaw;
    const forwardSign = v.userData?.forwardSign || -1;
    const sideDistance = this.currentVehicleType === "truck" ? 1.7 : this.currentVehicleType === "bike" ? 1.05 : 1.4;
    const offsets = [[sideDistance,0],[-sideDistance,0],[0,-forwardSign*1.8],[0,forwardSign*1.8],
      [sideDistance,-forwardSign*1.2],[-sideDistance,-forwardSign*1.2],
      [sideDistance*1.55,0],[-sideDistance*1.55,0],[0,-forwardSign*2.5],[0,forwardSign*2.5]];
    let safePosition = null;
    for (const [lx,lz] of offsets) {
      const candidate = {
        x: v.position.x + Math.cos(yaw)*lx + Math.sin(yaw)*lz,
        y: 1.62,
        z: v.position.z - Math.sin(yaw)*lx + Math.cos(yaw)*lz
      };
      const original = { x: candidate.x, y: candidate.y, z: candidate.z };
      moveWithCollisions(candidate,0,0,PLAYER_CONFIG.radius,this.renderer.getGateCollisionCells(),this.renderer.solidMeshes);
      if (Math.hypot(candidate.x-original.x,candidate.z-original.z) < 0.08) { safePosition = original; break; }
    }
    if (!safePosition) { this.showGameToast("No safe space to step out here. Move the vehicle first."); return; }
    this.inVehicle = false; this.currentVehicle = null; this.currentVehicleType = null; this.vehicleSpeed = 0;
    this.vehicleButtons.clear();
    this.vehicleInput = { throttle:0, steering:0, brake:0, handbrake:0, clutch:0, pedalBrake:0 };
    document.body.classList.remove("in-vehicle");
    this.renderer.camera.position.set(safePosition.x, safePosition.y, safePosition.z);
    this.yaw = yaw + (forwardSign > 0 ? Math.PI : 0); this.pitch = 0;
    this.renderer.camera.rotation.set(0,this.yaw,0,"YXZ");
    const hud=document.querySelector("#vehicle-hud"), controls=document.querySelector("#vehicle-controls");
    if (hud) hud.hidden=true;
    if (controls) controls.hidden=true;
    const exitButton=document.querySelector("#vehicle-exit");
    if (exitButton) exitButton.hidden=true;
    const button=document.querySelector("#interact-button");
    if (button) button.textContent="INTERACT · E";
  }

  moveVehicleWithFootprint(vehicle, dx, dz, type) {
    const yaw = vehicle.rotation.y;
    const halfWidth = type === "truck" ? 1.20 : type === "bike" ? 0.43 : 0.94;
    const halfLength = type === "truck" ? 3.42 : type === "bike" ? 0.92 : 2.02;
    const points = [
      [-halfWidth, -halfLength], [0, -halfLength], [halfWidth, -halfLength],
      [-halfWidth, 0], [0, 0], [halfWidth, 0],
      [-halfWidth, halfLength], [0, halfLength], [halfWidth, halfLength]
    ];
    const cells = this.renderer.getGateCollisionCells();
    const clearAt = fraction => {
      for (const [lx, lz] of points) {
        const ox = Math.cos(yaw) * lx + Math.sin(yaw) * lz;
        const oz = -Math.sin(yaw) * lx + Math.cos(yaw) * lz;
        const expected = { x: vehicle.position.x + ox + dx * fraction, z: vehicle.position.z + oz + dz * fraction };
        const corrected = { ...expected };
        moveWithCollisions(corrected, 0, 0, 0.18, cells, this.renderer.solidMeshes);
        if (Math.hypot(corrected.x - expected.x, corrected.z - expected.z) > 0.035) return false;
      }
      return true;
    };
    let low = 0, high = 1;
    if (clearAt(1)) low = 1;
    else {
      for (let i = 0; i < 9; i++) {
        const mid = (low + high) * 0.5;
        if (clearAt(mid)) low = mid; else high = mid;
      }
    }
    vehicle.position.x += dx * low;
    vehicle.position.z += dz * low;
    return low;
  }

  updateVehicle(delta) {
    const vehicle = this.currentVehicle;
    if (!vehicle) { this.exitVehicle(); return; }
    const type = this.currentVehicleType;
    const keyThrottle = (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0) -
      (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0);
    const keySteering = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) -
      (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
    const buttonThrottle = this.vehicleButtons.has("throttle") ? 1 : this.vehicleButtons.has("reverse") ? -1 : 0;
    const buttonSteering = (this.vehicleButtons.has("steer-right") ? 1 : 0) - (this.vehicleButtons.has("steer-left") ? 1 : 0);
    const throttle = this.vehicleControlMode === "joystick" ? (this.vehicleInput.throttle || keyThrottle) : (buttonThrottle || keyThrottle);
    const steering = this.vehicleControlMode === "joystick" ? (this.vehicleInput.steering || keySteering) : (buttonSteering || keySteering);
    const brake = Math.max(
      this.vehicleButtons.has("brake") || this.vehicleButtons.has("front-brake") ? 1 : 0,
      this.vehicleButtons.has("pedal-brake") ? 1 : 0,
      this.vehicleInput.brake || 0, this.vehicleInput.pedalBrake || 0,
      this.keys.has(" ") ? 1 : 0
    );
    const handbrake = this.vehicleButtons.has("handbrake") ? 1 : this.vehicleInput.handbrake || 0;
    const clutch = this.vehicleButtons.has("clutch") ? 1 : this.vehicleInput.clutch || 0;
    const caps = type === "truck" ? [0,2,3,4,5,6,7] : type === "bike" ? [0,2.2,4,5.8,7.8,9.8,12] : [0,2.4,3.8,5.2,6.7,8.3,10];
    const maxSpeed = caps[this.vehicleGear] || caps[1];
    const drive = type === "bike" && clutch > 0.5 ? 0 : throttle;
    const acceleration = type === "truck" ? 1.35 : type === "bike" ? 2.9 : 2.0;
    this.vehicleSpeed += (drive * maxSpeed - this.vehicleSpeed) * Math.min(1, delta * (drive ? acceleration : 2.4));
    if (brake > 0) this.vehicleSpeed *= Math.exp(-delta * (type === "bike" ? 7.5 : 8.5) * brake);
    if (handbrake > 0) this.vehicleSpeed *= Math.exp(-delta * 15 * handbrake);
    if (Math.abs(this.vehicleSpeed) < 0.035) this.vehicleSpeed = 0;
    this.vehicleYaw -= steering * Math.sign(this.vehicleSpeed || 1) * Math.min(1,Math.abs(this.vehicleSpeed)/3) *
      delta * (type === "truck" ? 0.38 : type === "bike" ? 1.05 : 0.72);
    vehicle.rotation.y = this.vehicleYaw;
    const forwardSign = vehicle.userData?.forwardSign || -1;
    const dx = Math.sin(this.vehicleYaw) * this.vehicleSpeed * delta * forwardSign;
    const dz = Math.cos(this.vehicleYaw) * this.vehicleSpeed * delta * forwardSign;
    const beforeX=vehicle.position.x,beforeZ=vehicle.position.z;
    const allowedFraction = this.moveVehicleWithFootprint(vehicle, dx, dz, type);
    if (allowedFraction < 0.2 && Math.hypot(dx, dz) > 0.001) this.vehicleSpeed *= 0.18;
    const data=vehicle.userData||{};
    if (type==="bike") {
      for (const wheel of data.wheels||[]) wheel.spin.rotation.x += this.vehicleSpeed*delta/0.30;
      if (data.forkPivot) data.forkPivot.rotation.y=steering*0.38;
    } else {
      for (const wheel of data.wheels||[]) {
        wheel.spinGrp.rotation.x += this.vehicleSpeed*delta/(type==="truck"?0.48:0.36);
        if (wheel.isFront) wheel.steerGrp.rotation.y=steering*(type==="truck"?0.30:0.36);
      }
    }
    const brakeGlow=brake>0||handbrake>0?1.8:0.55;
    for (const material of data.tailMats||[]) if (material?.emissive) material.emissiveIntensity=brakeGlow;
    this.positionVehicleCamera();
    const speed=document.querySelector("#vehicle-speed"), spares=document.querySelector("#spare-count"), gear=document.querySelector("#vehicle-gear-value");
    if (speed) speed.textContent=Math.round(Math.abs(this.vehicleSpeed)*3.6)+" km/h";
    if (spares) spares.textContent=type==="car"?"SPARES · "+this.spareTires:type==="bike"?"REBEL":"CARGO";
    if (gear) gear.textContent=this.vehicleGear+" / 6";
    this.updateInteractionUI();
  }

  isNearGeneratorKey() {
    if (this.hasGeneratorKey) return false;
    const p = this.renderer.generatorKeyPosition;
    return !!p && Math.hypot(this.renderer.camera.position.x - p.x, this.renderer.camera.position.z - p.z) < 2.0;
  }

  isNearGeneratorDoor() {
    const p = this.renderer.generatorDoorPosition;
    return !!p && Math.hypot(this.renderer.camera.position.x - p.x, this.renderer.camera.position.z - p.z) < 2.8;
  }

  updateStoryUI() {
    const title = document.querySelector("#story-chapter");
    const objective = document.querySelector("#story-objective");
    if (!title || !objective) return;
    const chapters = [
      ["THE ARRIVAL", "Find your uncle's diary in the bedroom."],
      ["OLD PROMISES", "Examine the photograph on the living-room table."],
      ["THREE STRANGERS", "Find the brass key on the bedroom desk."],
      ["THE POWER ROOM", "Unlock the detached generator room."],
      ["THE POWER ROOM", "Start the generator."],
      ["AFTER THE LIGHTS", "Find the book that appeared inside the house."],
      ["THE FIRST WARNING", "Search the bedroom drawer, living-room mat and reception drawer for three keys."],
      ["THREE LOCKS", "Take all three keys to the locked upstairs room."],
      ["THE SEALED ROOM", "Enter the ritual chamber. The salt circle is waiting."],
      ["THE CHILLA", "The circle has been disturbed. Find out what answered."]
    ];
    const current = chapters[Math.min(this.storyStage, chapters.length - 1)];
    title.textContent = this.chillaStarted ? "THE CHILLA · NIGHT " + this.hauntNight : current[0];
    if (this.chillaStarted) {
      const hauntObjectives = [
        "Listen carefully. The knocks are coming from somewhere inside the house.",
        "Stay near the firelight. Something is moving in the shadows it casts.",
        "The shadows no longer follow the people or objects that should own them.",
        "Do not let it turn you around. Something is trying to take control."
      ];
      objective.textContent = hauntObjectives[Math.min(Math.max(this.hauntNight - 1, 0), 3)];
    } else {
      objective.textContent = current[1];
    }
  }

  updateHaunting(delta) {
    if (!this.chillaStarted) return null;
    this.hauntNightTimer += delta;
    const nextNight = Math.floor(this.hauntNightTimer / 240) + 1;
    if (nextNight !== this.hauntNight) {
      this.hauntNight = nextNight;
      this.renderer.setHauntNight(this.hauntNight);
      this.updateStoryUI();
      const messages = {
        2: "NIGHT 2 — Firelight flickers upstairs. The walls are casting shadows that should not be there.",
        3: "NIGHT 3 — The shadows have stopped following the light.",
        4: "NIGHT 4 — Something turns when you are not looking. You feel it tug at your thoughts."
      };
      this.showGameToast(messages[this.hauntNight] || "Another night passes. It is learning how you move.");
    }
    const influence = this.renderer.updateHaunting(delta, this.hauntNightTimer);
    if (this.hauntNight === 1 && this.hauntNightTimer >= this.nextHauntCue) {
      if (this.hauntCueIndex % 3 === 0) this.playDistantKnocks();
      else if (this.hauntCueIndex % 3 === 1) this.playWhisperCue();
      else this.playFootstepsCue();
      this.hauntCueIndex++;
      this.nextHauntCue = this.hauntNightTimer + 23 + Math.random() * 15;
    }
    return influence;
  }

  playWhisperCue() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.ritualAudioContext ||= new AudioContextClass();
      const context = this.ritualAudioContext;
      context.resume().catch(() => {});
      const length = Math.floor(context.sampleRate * 1.05);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.55;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const start = context.currentTime + 0.04;
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(620, start);
      filter.frequency.linearRampToValueAtTime(360, start + 0.85);
      filter.Q.value = 0.8;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.035, start + 0.24);
      gain.gain.linearRampToValueAtTime(0.0001, start + 1.02);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start(start);
      source.stop(start + 1.06);
    } catch (error) {
      console.warn("Whisper cue unavailable:", error);
    }
  }

  playFootstepsCue() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.ritualAudioContext ||= new AudioContextClass();
      const context = this.ritualAudioContext;
      context.resume().catch(() => {});
      const start = context.currentTime + 0.05;
      for (let i = 0; i < 2; i++) {
        const at = start + i * 0.48;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(58, at);
        oscillator.frequency.exponentialRampToValueAtTime(34, at + 0.13);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(0.10, at + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.20);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.22);
      }
    } catch (error) {
      console.warn("Footstep cue unavailable:", error);
    }
  }

  playDistantKnocks() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.ritualAudioContext ||= new AudioContextClass();
      const context = this.ritualAudioContext;
      context.resume().catch(() => {});
      const start = context.currentTime + 0.06;
      for (let i = 0; i < 3; i++) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const at = start + i * 0.78;
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(74, at);
        oscillator.frequency.exponentialRampToValueAtTime(43, at + 0.16);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.linearRampToValueAtTime(0.22, at + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.26);
      }
    } catch (error) {
      console.warn("Ritual knock audio unavailable:", error);
    }
  }

  showGameToast(message) {
    let toast = document.querySelector("#game-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "game-toast";
      toast.style.cssText = "position:fixed;top:max(18px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:50;max-width:88vw;padding:11px 16px;border:1px solid #c5ad7a88;border-radius:12px;background:#101713eF;color:#f0e6ce;font:600 12px/1.45 system-ui,sans-serif;letter-spacing:.03em;text-align:center;box-shadow:0 8px 28px #0009;pointer-events:none;opacity:0;transition:opacity .18s";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = "1";
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { toast.style.opacity = "0"; }, 2600);
  }

  isNearGate() {
    const camera = this.renderer.camera;
    return Math.hypot(camera.position.x, camera.position.z - 8.4) < 3.3;
  }

  updateInteractionUI() {
    const button = document.querySelector("#interact-button");
    if (!button) return;
    if (this.levelTransitioning) { button.hidden = true; return; }
    if (this.inVehicle) {
      button.hidden = true;
      const exit = document.querySelector("#vehicle-exit");
      if (exit) exit.hidden = false;
      return;
    }
    const target = this.renderer.interactions.update();
    button.hidden = !target;
    if (!target) return;
    let label = target.label;
    if (target.id.startsWith("legacy-vehicle-part-")) {
      const index = Number(target.id.split("-").pop());
      label = this.renderer.legacyVehicleTargets?.[index]?.getLabel?.() || label;
    }
    if (target.id === "interior-exit") {
      label = this.renderer.interiorLevel?.exitState?.open ? "STEP OUTSIDE · E" : "OPEN FRONT DOOR · E";
    } else if (target.id === "living-room-mat") {
      label = this.ritualKeysFound.has("ritual-key-mat") ? "MAT ALREADY SEARCHED" : "LIFT LIVING-ROOM MAT · E";
    } else if (target.id === "bedroom-drawer") {
      label = this.ritualKeysFound.has("ritual-key-bedroom") ? "EMPTY DRAWER" : "SEARCH BEDROOM DRAWER · E";
    } else if (target.id === "reception-drawer") {
      label = this.ritualKeysFound.has("ritual-key-reception") ? "EMPTY DRAWER" : "SEARCH RECEPTION DRAWER · E";
    } else if (target.id === "ritual-room-door") {
      label = this.ritualKeysFound.size === 3 ? "UNLOCK THREE LOCKS · E" : "THREE LOCKS · " + this.ritualKeysFound.size + "/3 KEYS";
    } else if (target.id === "ritual-circle") {
      label = "BEGIN THE CHILLA · E";
    } else if (target.id.startsWith("house-door-")) {
      const door = this.renderer.houseDoors.find(item => item.id === target.id);
      label = door?.open ? "ENTER FARMHOUSE · E" : "OPEN FRONT DOOR · E";
    } else if (target.id.startsWith("car-tire-")) {
      label = "REPLACE DAMAGED TYRE · E";
    } else if (target.id.startsWith("spare-tire-")) {
      label = "PICK UP SPARE TYRE · E";
    } else if (target.id === "generator-door") {
      label = this.hasGeneratorKey ? (this.renderer.generatorDoorOpen ? "CLOSE GENERATOR ROOM · E" : "UNLOCK GENERATOR ROOM · E") : "LOCKED · FIND KEY";
    } else if (target.id.startsWith("farmhouse-gate-")) {
      label = this.renderer.gateTargetOpen > 0.5 ? "CLOSE GATE · E" : "OPEN GATE · E";
    }
    button.textContent = label + (label.includes("LOCKED") ? "" : "");
    button.setAttribute("aria-label", label);
  }

  syncGateButton(open) {
    const button = document.querySelector("#interact-button");
    if (!button) return;
    button.textContent = open ? "CLOSE GATE · E" : "OPEN GATE · E";
  }

  syncFlashlightButton(enabled) {
    const button = document.querySelector("#flashlight-toggle");
    if (!button) return;
    button.textContent = enabled ? "LIGHT ON" : "LIGHT OFF";
    button.setAttribute("aria-pressed", String(enabled));
    button.classList.toggle("is-on", enabled);
  }

  stop() {
    this.running = false;
    this.renderer.dispose();
  }
}
