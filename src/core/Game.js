import { Renderer } from "../renderer/Renderer.js";

export class Game {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.running = false;
    this.lastTime = 0;
    this.frame = this.frame.bind(this);
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

  update(_deltaSeconds) {
    // Player, world and interaction updates will be connected here.
  }

  stop() {
    this.running = false;
    this.renderer.dispose();
  }
}
