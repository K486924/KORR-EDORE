import { Renderer } from "../renderer/Renderer.js";
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
      if (down && !event.repeat && key === "f") this.syncFlashlightButton(this.renderer.toggleFlashlight());
      if (down && !event.repeat && key === "e" && this.isNearGate()) this.syncGateButton(this.renderer.toggleGate());
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
        if (this.isNearGate()) this.syncGateButton(this.renderer.toggleGate());
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
    const forward = (this.keys.has("w") || this.keys.has("arrowup") ? -1 : 0) +
      (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) + this.move.z;
    const strafe = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) +
      (this.keys.has("a") || this.keys.has("arrowleft") ? -1 : 0) + this.move.x;
    const length = Math.hypot(forward, strafe) || 1;
    const speed = PLAYER_CONFIG.moveSpeed * delta / length;
    const camera = this.renderer.camera;
    const startX = camera.position.x;
    const startZ = camera.position.z;
    const deltaX = (Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) * speed;
    const deltaZ = (Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) * speed;
    moveWithCollisions(camera.position, deltaX, deltaZ, PLAYER_CONFIG.radius, this.renderer.getGateCollisionCells());

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

  isNearGate() {
    const camera = this.renderer.camera;
    return Math.hypot(camera.position.x, camera.position.z - 8.4) < 3.3;
  }

  updateInteractionUI() {
    const button = document.querySelector("#interact-button");
    if (!button) return;
    const nearby = this.isNearGate();
    button.hidden = !nearby;
    if (nearby) {
      const open = this.renderer.gateTargetOpen > 0.5;
      button.textContent = open ? "CLOSE GATE · E" : "OPEN GATE · E";
      button.setAttribute("aria-label", open ? "Close farmhouse gate" : "Open farmhouse gate");
    }
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
