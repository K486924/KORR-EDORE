import { Game } from "./core/Game.js";

const canvas = document.querySelector("#game-canvas");
const status = document.querySelector("#boot-status");

try {
  const game = new Game(canvas);
  game.start();
  status.textContent = "Renderer ready — procedural world is next.";
} catch (error) {
  console.error(error);
  status.textContent = "WebGL is unavailable on this browser or device.";
}
