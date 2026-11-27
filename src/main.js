const canvas = document.querySelector("#game-canvas");
const panel = document.querySelector("#boot-panel");
const status = document.querySelector("#boot-status");

function showStartupError(error) {
  console.error("KORR EDORE startup failed:", error);
  if (status) {
    const message = error instanceof Error ? (error.stack || error.message) : String(error);
    status.textContent = `Startup error: ${message}`;
    status.style.whiteSpace = "normal";
    status.style.overflowWrap = "anywhere";
    status.style.fontSize = "14px";
    status.style.lineHeight = "1.5";
  }
  if (panel) panel.classList.remove("hidden");
}

async function boot() {
  try {
    // Dynamic import ensures module-resolution failures are shown in the boot panel.
    const { Game } = await import("./core/Game.js");
    const game = new Game(canvas);
    game.start();

    if (status) status.textContent = "A quiet afternoon at the farmhouse.";
    window.setTimeout(() => panel?.classList.add("hidden"), 1800);
    window.setTimeout(() => panel?.remove(), 3200);

    // The avatar is optional; it must never prevent the world from starting.
    game.renderer.loadLocalAvatar({ gender: "male", height: 1.72 })
      .catch(error => console.warn("Optional player model failed to load:", error));
  } catch (error) {
    showStartupError(error);
  }
}

boot();
