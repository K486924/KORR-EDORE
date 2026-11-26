import { Game } from "./core/Game.js";

const canvas = document.querySelector("#game-canvas");
const panel = document.querySelector("#boot-panel");
const status = document.querySelector("#boot-status");

try {
  const game = new Game(canvas);
  game.start();
  status.textContent = "The building is waiting.";
  window.setTimeout(() => panel.classList.add("hidden"), 1800);
  window.setTimeout(() => panel.remove(), 3200);
} catch (error) {
  console.error(error);
  status.textContent = "Unable to start 3D renderer. Check WebGL 2 support.";
}
