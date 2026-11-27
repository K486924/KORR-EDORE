import * as THREE from "three";

// Small procedural surface library. One generated texture is shared by all
// colour variants so the same source can become many believable finishes.
function makePattern(kind, seed = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const base = {
    plaster: ["#d9cfbd", "#cfc4b0"],
    wood: ["#9a704c", "#b4865b"],
    fabric: ["#b8aa96", "#8c8275"],
    soil: ["#514334", "#66513a"],
    grass: ["#536b3d", "#71834c"],
    leaf: ["#355c36", "#557744"],
    metal: ["#515954", "#303a36"]
  }[kind] || ["#888888", "#777777"];
  ctx.fillStyle = base[0];
  ctx.fillRect(0, 0, 256, 256);
  if (kind === "wood") {
    for (let y = 0; y < 256; y += 2 + Math.floor(random() * 5)) {
      ctx.fillStyle = random() > 0.5 ? "rgba(52,31,17,.10)" : "rgba(255,225,180,.09)";
      ctx.fillRect(0, y, 256, 1 + random() * 3);
    }
    for (let i = 0; i < 18; i++) {
      const x = random() * 256, y = random() * 256;
      ctx.strokeStyle = "rgba(60,37,20,.14)";
      ctx.lineWidth = 1 + random() * 2;
      ctx.beginPath(); ctx.ellipse(x, y, 8 + random() * 25, 2 + random() * 5, 0, 0, Math.PI * 2); ctx.stroke();
    }
  } else {
    ctx.fillStyle = base[1];
    for (let i = 0; i < 2600; i++) {
      const a = 0.025 + random() * 0.09;
      ctx.fillStyle = random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      const x = random() * 256, y = random() * 256;
      const size = kind === "grass" || kind === "leaf" ? 1 + random() * 4 : 1 + random() * 2;
      ctx.fillRect(x, y, size, size);
    }
    if (kind === "plaster") {
      for (let i = 0; i < 24; i++) {
        ctx.strokeStyle = "rgba(255,255,255,.05)";
        ctx.beginPath(); ctx.moveTo(random()*256, random()*256); ctx.lineTo(random()*256, random()*256); ctx.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createMaterialLibrary() {
  const maps = {
    plaster: makePattern("plaster", 3),
    wood: makePattern("wood", 7),
    fabric: makePattern("fabric", 11),
    soil: makePattern("soil", 13),
    grass: makePattern("grass", 17),
    leaf: makePattern("leaf", 19),
    metal: makePattern("metal", 23)
  };
  const make = (kind, color, roughness = 0.85, metalness = 0) =>
    new THREE.MeshStandardMaterial({ map: maps[kind], color, roughness, metalness });
  return {
    plaster: (color = 0xe6ddcb) => make("plaster", color, 0.94),
    wood: (color = 0xb18a61) => make("wood", color, 0.72),
    darkWood: (color = 0x60452f) => make("wood", color, 0.82),
    fabric: (color = 0xc1b49f) => make("fabric", color, 0.98),
    soil: (color = 0x66523b) => make("soil", color, 1),
    grass: (color = 0x71834f) => make("grass", color, 1),
    leaf: (color = 0x547b45) => make("leaf", color, 0.92),
    metal: (color = 0x414a46, metalness = 0.72) => make("metal", color, 0.46, metalness),
    paint: (color = 0xf0e9dc) => new THREE.MeshStandardMaterial({ color, roughness: 0.88 }),
    glass: (color = 0x9db5ad) => new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.08, transparent: true, opacity: 0.52 }),
    dispose() { Object.values(maps).forEach(map => map.dispose()); }
  };
}
