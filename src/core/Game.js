import { Renderer } from "../renderer/Renderer.js";

export class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.running = false;
    this.lastTime = 0;
    this.keys = new Set();
    this.move = { x: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.frame = this.frame.bind(this);
    this.setupInput(canvas);
  }

  setupInput(canvas) {
    const camera = this.renderer.camera;
    this.yaw = camera.rotation.y;
    const onKey = (event, down) => {
      const key = event.key.toLowerCase();
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
      this.yaw -= dx * sensitivity;
      this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - dy * sensitivity));
      camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    });
    const endLook = event => {
      if (event.pointerId === lookPointer) { lookPointer = null; previous = null; }
    };
    canvas.addEventListener("pointerup", endLook);
    canvas.addEventListener("pointercancel", endLook);

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
    const deltaSeconds = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.update(deltaSeconds);
    this.renderer.render();
    requestAnimationFrame(this.frame);
  }

  update(delta) {
    const forward = (this.keys.has("w") || this.keys.has("arrowup") ? -1 : 0) +
      (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) + this.move.z;
    const strafe = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) +
      (this.keys.has("a") || this.keys.has("arrowleft") ? -1 : 0) + this.move.x;
    const length = Math.hypot(forward, strafe) || 1;
    const speed = 2.15 * delta / length;
    const camera = this.renderer.camera;
    camera.position.x += (Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) * speed;
    camera.position.z += (Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) * speed;
    camera.position.x = Math.max(-2.15, Math.min(2.15, camera.position.x));
    camera.position.z = Math.max(-27, Math.min(7.5, camera.position.z));
  }

  stop() {
    this.running = false;
    this.renderer.dispose();
  }
}
