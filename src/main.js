const canvas = document.querySelector("#game-canvas");
const panel = document.querySelector("#boot-panel");
const status = document.querySelector("#boot-status");

function showStartupError(error, source = null) {
  console.error("KORR EDORE startup failed:", error, source || "");
  const message = error instanceof Error
    ? (error.stack || error.message || error.name)
    : String(error);
  const location = source
    ? `\\n\\nSOURCE: ${source.filename || "unknown"}\\nLINE: ${source.lineno ?? "?"}  COLUMN: ${source.colno ?? "?"}`
    : "";
  if (panel) {
    panel.classList.remove("hidden");
    panel.style.display = "block";
    panel.style.width = "min(94vw, 680px)";
    panel.style.maxHeight = "80vh";
    panel.style.overflow = "auto";
    panel.style.textAlign = "left";
    let details = document.querySelector("#boot-error-details");
    if (!details) {
      details = document.createElement("pre");
      details.id = "boot-error-details";
      details.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;max-height:55vh;overflow:auto;color:#ffd6c9;font:12px/1.45 monospace;margin:16px 0 0;text-align:left;user-select:text;";
      panel.appendChild(details);
    }
    details.textContent = "STARTUP ERROR\n\n" + message + location;
  }
  if (status) status.textContent = "The game could not start. Error details below:";
}

window.addEventListener("error", event => {
  showStartupError(event.error || event.message || "Unknown script error", {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});
window.addEventListener("unhandledrejection", event => showStartupError(event.reason));

async function boot() {
  try {
    const { Game } = await import("./core/Game.js?diagnostic=11");
    const game = new Game(canvas);
    game.start();

    if (status) status.textContent = "A quiet afternoon at the farmhouse.";
    window.setTimeout(() => panel?.classList.add("hidden"), 1800);
    window.setTimeout(() => panel?.remove(), 3200);

    game.renderer.loadLocalAvatar({ gender: "male", height: 1.72 })
      .catch(error => console.warn("Optional player model failed to load:", error));
  } catch (error) {
    showStartupError(error);
  }
}

boot();
