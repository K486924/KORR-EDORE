const canvas = document.querySelector("#game-canvas");
const errorPanel = document.querySelector("#boot-panel");
const errorStatus = document.querySelector("#boot-status");
const menu = document.querySelector("#main-menu");
const loading = document.querySelector("#loading-screen");
const loadingStatus = document.querySelector("#loading-status");
let game = null;
let audioContext = null;
let musicGain = null;
let musicNodes = [];

function showStartupError(error, source = null) {
  console.error("KORR EDORE startup failed:", error, source || "");
  const message = error instanceof Error ? (error.stack || error.message || error.name) : String(error);
  const location = source
    ? `\n\nSOURCE: ${source.filename || "unknown"}\nLINE: ${source.lineno ?? "?"}  COLUMN: ${source.colno ?? "?"}`
    : "";
  if (menu) menu.style.display = "none";
  if (loading) loading.classList.remove("is-visible");
  if (errorPanel) {
    errorPanel.hidden = false;
    errorPanel.style.display = "block";
    errorPanel.style.position = "fixed";
    errorPanel.style.zIndex = "200";
    errorPanel.style.left = "50%";
    errorPanel.style.top = "50%";
    errorPanel.style.transform = "translate(-50%,-50%)";
    errorPanel.style.width = "min(94vw,680px)";
    errorPanel.style.maxHeight = "80vh";
    errorPanel.style.overflow = "auto";
    errorPanel.style.pointerEvents = "auto";
    errorPanel.style.padding = "22px";
    errorPanel.style.background = "#100b09";
    errorPanel.style.border = "1px solid #9b5c4d";
    let details = document.querySelector("#boot-error-details");
    if (!details) {
      details = document.createElement("pre");
      details.id = "boot-error-details";
      details.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;max-height:55vh;overflow:auto;color:#ffd6c9;font:12px/1.45 monospace;margin:16px 0 0;text-align:left;user-select:text;";
      errorPanel.appendChild(details);
    }
    details.textContent = "STARTUP ERROR\n\n" + message + location;
  }
  if (errorStatus) errorStatus.textContent = "The game could not start. Share this error text if you need help.";
}

window.addEventListener("error", event => {
  if (document.body.classList.contains("game-active")) {
    showStartupError(event.error || event.message || "Unknown script error", {
      filename: event.filename, lineno: event.lineno, colno: event.colno
    });
  }
});
window.addEventListener("unhandledrejection", event => {
  if (document.body.classList.contains("game-active")) showStartupError(event.reason);
});

function showMenuScreen(name) {
  document.querySelectorAll(".menu-screen").forEach(screen => screen.classList.remove("is-active"));
  document.querySelector("#menu-" + name)?.classList.add("is-active");
}
document.querySelectorAll("[data-menu]").forEach(button => {
  button.addEventListener("click", () => { startAtmosphereMusic(); showMenuScreen(button.dataset.menu); });
});

function startAtmosphereMusic() {
  const enabled = document.querySelector("#music-toggle")?.checked !== false;
  const volume = Number(document.querySelector("#music-volume")?.value ?? 28) / 100;
  if (!enabled || volume <= 0) {
    if (musicGain && audioContext) musicGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.18);
    return;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContext) {
    audioContext = new AudioCtx();
    musicGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 190;
    filter.Q.value = 0.7;
    musicGain.gain.value = 0;
    filter.connect(musicGain);
    musicGain.connect(audioContext.destination);
    for (const [frequency, level] of [[55, 0.34], [65.41, 0.20], [82.41, 0.16], [110, 0.07], [164.81, 0.025]]) {
      const oscillator = audioContext.createOscillator();
      const voiceGain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      voiceGain.gain.value = level;
      oscillator.connect(voiceGain);
      voiceGain.connect(filter);
      oscillator.start();
      musicNodes.push(oscillator, voiceGain);
    }
  }
  audioContext.resume().catch(() => {});
  musicGain.gain.setTargetAtTime(0.045 * volume, audioContext.currentTime, 0.65);
}
document.querySelector("#music-toggle")?.addEventListener("change", startAtmosphereMusic);
document.querySelector("#music-volume")?.addEventListener("input", event => {
  const output = document.querySelector("#volume-value");
  if (output) output.textContent = event.target.value + "%";
  startAtmosphereMusic();
});

async function requestGameFullscreen() {
  const target = document.querySelector("#game-root");
  if (document.fullscreenElement) return true;
  if (!target?.requestFullscreen) return false;
  try {
    await target.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch (error) {
    console.info("Fullscreen was not granted by this browser:", error);
    return false;
  }
}
document.querySelector("#fullscreen-option")?.addEventListener("click", async () => {
  const ok = await requestGameFullscreen();
  const note = document.querySelector("#menu-options .menu-note");
  if (note) note.textContent = ok
    ? "Fullscreen enabled."
    : "This browser does not allow fullscreen from this screen. Gameplay will still fill the available display.";
});

document.querySelectorAll("[data-coming-soon]").forEach(button => {
  button.addEventListener("click", () => {
    const note = document.querySelector("#menu-play .menu-note");
    if (note) note.textContent = button.dataset.comingSoon + " is a solo chapter and is not playable in this build yet.";
  });
});

async function launchMainStory() {
  if (game) return;
  const fullscreenRequest = requestGameFullscreen();
  startAtmosphereMusic();
  if (menu) menu.style.display = "none";
  loading?.classList.add("is-visible");
  if (loadingStatus) loadingStatus.textContent = "Preparing the farmhouse and its interior…";
  try {
    await fullscreenRequest;
    const { Game } = await import("./core/Game.js?build=15");
    game = new Game(canvas);
    game.start();
    document.body.classList.add("game-active");
    loading?.classList.remove("is-visible");
    game.renderer.loadLocalAvatar({ gender: "male", height: 1.72 })
      .catch(error => console.warn("Optional player model failed to load:", error));
  } catch (error) {
    showStartupError(error);
  }
}
document.querySelector("#start-main-story")?.addEventListener("click", launchMainStory);

document.querySelector("#host-room")?.addEventListener("click", () => {});
document.querySelector("#join-room")?.addEventListener("click", () => {});
