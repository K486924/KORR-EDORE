import { Renderer } from "../renderer/Renderer.js?build=9";
import { moveWithCollisions } from "../player/collision.js";
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
    this.hasGeneratorKey = false;
    this.carSpeed = 0;
    this.spareTires = 1;
    this.offroadWear = 0;\n    this.stamina = 100;\n    this.health = 100;\n    this.sprintHeld = false;\n    this.sprintRegenDelay = 0;
    this.lookDelta = { yaw: 0, pitch: 0 };
    this.frame = this.frame.bind(this);
    this.setupInput(canvas);
    // The optional avatar is loaded after the world starts.
  }

  setupInput(canvas) {
    const camera = this.renderer.camera;
    this.yaw = camera.rotation.y;
    const onKey = (event, down) => {
      const key = event.key.toLowerCase();
      if (key === "shift") this.sprintHeld = down;\n      if (down && !event.repeat && key === "f") this.syncFlashlightButton(this.renderer.toggleFlashlight());
      if (down && !event.repeat && key === "e") this.handleContextInteraction();
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
    if (this.inVehicle) {
      this.updateVehicle(delta);
      this.updateInteractionUI();
      this.lookDelta.yaw = 0;
      this.lookDelta.pitch = 0;
      return;
    }
    const forward = (this.keys.has("w") || this.keys.has("arrowup") ? -1 : 0) +
      (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) + this.move.z;
    const strafe = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) +
      (this.keys.has("a") || this.keys.has("arrowleft") ? -1 : 0) + this.move.x;
    const length = Math.hypot(forward, strafe) || 1;
    const moving = Math.abs(forward) + Math.abs(strafe) > 0.01;\n    const canSprint = this.sprintHeld && moving && this.stamina > 0.5;\n    const sprintMultiplier = canSprint ? 1.7 : 1;\n    const speed = PLAYER_CONFIG.moveSpeed * sprintMultiplier * delta / length;\n    if (canSprint) {\n      this.stamina = Math.max(0, this.stamina - 28 * delta);\n      this.sprintRegenDelay = 0.65;\n    } else {\n      this.sprintRegenDelay = Math.max(0, this.sprintRegenDelay - delta);\n      if (this.sprintRegenDelay <= 0) this.stamina = Math.min(100, this.stamina + 19 * delta);\n    }\n    this.updatePlayerStatus();
    const camera = this.renderer.camera;
    const startX = camera.position.x;
    const startZ = camera.position.z;
    const deltaX = (Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) * speed;
    const deltaZ = (Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) * speed;
    moveWithCollisions(camera.position, deltaX, deltaZ, PLAYER_CONFIG.radius, this.renderer.getGateCollisionCells(), this.renderer.solidMeshes);

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

  handleContextInteraction() {
    if (this.inVehicle) {
      this.inVehicle = false;
      const hud = document.querySelector("#vehicle-hud");
      if (hud) hud.hidden = true;
      const car = this.renderer.arrivalCar;
      this.renderer.camera.position.set(car.position.x + 1.8, 1.62, car.position.z);
      this.yaw = car.rotation.y;
      this.renderer.camera.rotation.set(0, this.yaw, 0, "YXZ");
      this.carSpeed = 0;
      return;
    }
    const target = this.renderer.interactions.update();
    if (!target) return;
    if (target.id.startsWith("house-door-")) {
      const open = this.renderer.toggleHouseDoor(target.id);
      this.showGameToast(open ? "Front door opened." : "Front door closed.");
      return;
    }
    if (target.id === "arrival-car") {
      this.inVehicle = true;
      const hud = document.querySelector("#vehicle-hud");
      if (hud) hud.hidden = false;
      this.carSpeed = 0;
      this.yaw = this.renderer.arrivalCar.rotation.y;
      this.pitch = -0.22;
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
      return;
    }
    if (target.id === "generator-key") {
      this.hasGeneratorKey = true;
      this.renderer.setGeneratorKeyCollected(true);
      this.showGameToast("Brass key collected. It fits the generator room padlock.");
      return;
    }
    if (target.id === "generator-door") {
      if (!this.hasGeneratorKey) {
        this.showGameToast("Locked. Find the brass key in the uncle's bedroom.");
      } else {
        const open = this.renderer.toggleGeneratorDoor();
        this.showGameToast(open ? "Generator room unlocked." : "Generator room secured.");
      }
      return;
    }
    if (target.id.startsWith("farmhouse-gate-")) {
      this.syncGateButton(this.renderer.toggleGate());
    }
  }

  updateVehicle(delta) {
    const car = this.renderer.arrivalCar;
    const throttle = (this.keys.has("w") || this.keys.has("arrowup") || this.move.z < 0 ? 1 : 0) -
      (this.keys.has("s") || this.keys.has("arrowdown") || this.move.z > 0 ? 1 : 0);
    const steering = (this.keys.has("d") || this.keys.has("arrowright") || this.move.x > 0 ? 1 : 0) -
      (this.keys.has("a") || this.keys.has("arrowleft") || this.move.x < 0 ? 1 : 0);
    const target = throttle * (this.renderer.carTireStates?.some(t => t.blown) ? 3.2 : 7.5);
    this.carSpeed += (target - this.carSpeed) * Math.min(1, delta * (throttle ? 1.8 : 2.8));
    const roughGround = Math.abs(car.position.x) > 3.2 && car.position.z > -18 && car.position.z < 20;
    if (roughGround && Math.abs(this.carSpeed) > 3.5) {
      this.offroadWear += delta;
      if (this.offroadWear >= 12) {
        this.offroadWear = 0;
        const tires = this.renderer.carTireStates || [];
        const tire = tires.find(t => !t.blown && t.health > 0);
        if (tire) {
          tire.health = Math.max(0, tire.health - 0.35);
          if (tire.health <= 0) {
            tire.blown = true;
            tire.mesh.scale.y = 0.62;
            tire.tireMesh.material.color.setHex(0x090a09);
            this.showGameToast("TYRE BLOWOUT! Stop and aim at the damaged wheel to replace it.");
          } else {
            this.showGameToast(tire.label + " tyre damaged. Avoid rough ground.");
          }
        }
      }
    } else {
      this.offroadWear = Math.max(0, this.offroadWear - delta * 0.8);
    }
    this.yaw -= steering * Math.sign(this.carSpeed || 1) * Math.min(1, Math.abs(this.carSpeed) / 4) * delta * 0.72;
    car.rotation.y = this.yaw;
    const dx = -Math.sin(this.yaw) * this.carSpeed * delta;
    const dz = -Math.cos(this.yaw) * this.carSpeed * delta;
    const beforeX = car.position.x, beforeZ = car.position.z;
    moveWithCollisions(car.position, dx, dz, 1.02, this.renderer.getGateCollisionCells(), this.renderer.solidMeshes);
    if (Math.hypot(car.position.x - beforeX, car.position.z - beforeZ) < Math.hypot(dx, dz) * 0.2) {
      this.carSpeed *= 0.18;
    }
    for (const wheel of this.renderer.carWheels || []) wheel.rotation.x += this.carSpeed * delta / 0.38;
    const behindX = Math.sin(this.yaw) * 6.4;
    const behindZ = Math.cos(this.yaw) * 6.4;
    this.renderer.camera.position.set(car.position.x + behindX, 3.0, car.position.z + behindZ);
    this.renderer.camera.lookAt(car.position.x, 1.0, car.position.z);
    const button = document.querySelector("#interact-button");
    if (button) { button.hidden = false; button.textContent = "EXIT VEHICLE · E"; }
    const hud = document.querySelector("#vehicle-hud");
    const speed = document.querySelector("#vehicle-speed");
    const spares = document.querySelector("#spare-count");
    if (hud) hud.hidden = false;
    if (speed) speed.textContent = Math.round(Math.abs(this.carSpeed) * 3.6) + " km/h";
    if (spares) spares.textContent = "SPARES · " + this.spareTires;
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
    if (this.inVehicle) {
      button.hidden = false;
      button.textContent = "EXIT VEHICLE · E";
      button.setAttribute("aria-label", "Exit vehicle");
      return;
    }
    const target = this.renderer.interactions.update();
    button.hidden = !target;
    if (!target) return;
    let label = target.label;
    if (target.id.startsWith("house-door-")) {
      const door = this.renderer.houseDoors.find(item => item.id === target.id);
      label = door?.open ? "CLOSE FRONT DOOR · E" : "OPEN FRONT DOOR · E";
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
