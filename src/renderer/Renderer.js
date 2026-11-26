import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GRID, SOLID_CELLS, cellCenter } from "../level/layout.js";

function makeNoiseTexture(base, speckle, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 9500; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const a = Math.random() * 0.16;
    ctx.fillStyle = speckle;
    ctx.globalAlpha = a;
    ctx.fillRect(x, y, Math.random() * 3 + 1, Math.random() * 3 + 1);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090d0e);
    this.scene.fog = new THREE.FogExp2(0x111819, 0.038);
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.05, 90);
    this.camera.position.set(0, 1.62, 7.5);
    this.camera.rotation.order = "YXZ";

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: "high-performance",
      alpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.82;

    this.clock = new THREE.Clock();
    this.flickerLights = [];
    this.buildWorld();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  box(parent, size, position, material, cast = true, receive = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  }

  buildWorld() {
    const wallTex = makeNoiseTexture("#343a36", "#c0b69a");
    const floorTex = makeNoiseTexture("#242827", "#8d8878");
    const plaster = new THREE.MeshStandardMaterial({ map: wallTex, color: 0x777b70, roughness: 0.96 });
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, color: 0x77756b, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x171d1b, roughness: 0.94 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x393b34, roughness: 0.86 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x292b27, roughness: 0.82 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x252b28, roughness: 1 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x555b55, metalness: 0.62, roughness: 0.5 });

    // Narrow residential passage: deliberately imperfect, not a clean game corridor.
    this.box(this.scene, [5.8, 0.22, 39], [0, -0.12, -10], floorMat);
    this.box(this.scene, [5.8, 0.18, 39], [0, 3.45, -10], ceilingMat, false);
    // Build visible wall geometry from the exact same solid cells used by collision.
    const wallGeometry = new THREE.BoxGeometry(GRID.cellSize, 3.5, GRID.cellSize);
    const wallInstances = new THREE.InstancedMesh(wallGeometry, plaster, SOLID_CELLS.length);
    const wallMatrix = new THREE.Matrix4();
    SOLID_CELLS.forEach((cell, index) => {
      const center = cellCenter(cell.x, cell.z);
      wallMatrix.makeTranslation(center.x, 1.62, center.z);
      wallInstances.setMatrixAt(index, wallMatrix);
    });
    wallInstances.instanceMatrix.needsUpdate = true;
    wallInstances.castShadow = true;
    wallInstances.receiveShadow = true;
    this.scene.add(wallInstances);

    // Skirting and ceiling seams.
    for (const x of [-2.77, 2.77]) {
      this.box(this.scene, [0.06, 0.22, 38.5], [x, 0.12, -10], trim, false);
      this.box(this.scene, [0.08, 0.12, 38.5], [x * 0.985, 3.32, -10], dark, false);
    }

    // Repeating doors, each with slightly different proportions and details.
    for (let i = 0; i < 6; i++) {
      const z = 4 - i * 5.8;
      for (const side of [-1, 1]) {
        const x = side * 2.78;
        const door = this.box(this.scene, [0.10, 2.35 + (i % 2) * 0.12, 1.18], [x, 1.18, z], doorMat);
        door.rotation.y = side < 0 ? 0.015 : -0.015;
        this.box(this.scene, [0.13, 0.12, 1.42], [x, 2.43, z], trim, false);
        this.box(this.scene, [0.13, 2.5, 0.12], [x, 1.22, z - 0.65], trim, false);
        this.box(this.scene, [0.13, 2.5, 0.12], [x, 1.22, z + 0.65], trim, false);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), metal);
        knob.position.set(side * 2.67, 1.05, z + (side > 0 ? -0.35 : 0.35));
        this.scene.add(knob);
        // A dark recess behind the door frame.
        this.box(this.scene, [0.025, 2.18, 0.94], [side * 2.66, 1.16, z], dark, false);
      }
    }

    // A distant doorway that is subtly too tall.
    this.box(this.scene, [1.65, 2.95, 0.16], [0, 1.48, -27.8], dark);
    this.box(this.scene, [0.12, 3.2, 0.2], [-0.88, 1.58, -27.7], trim, false);
    this.box(this.scene, [0.12, 3.2, 0.2], [0.88, 1.58, -27.7], trim, false);
    this.box(this.scene, [1.9, 0.12, 0.2], [0, 3.12, -27.7], trim, false);

    // Water stains, exposed pipes and small architectural irregularities.
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x303a37, metalness: 0.72, roughness: 0.58 });
    for (const side of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 37, 8), pipeMat);
      pipe.position.set(side * 2.55, 2.72, -10);
      this.scene.add(pipe);
      for (let i = 0; i < 13; i++) {
        const stain = new THREE.Mesh(
          new THREE.BoxGeometry(0.018, 0.45 + Math.random() * 1.1, 0.12 + Math.random() * 0.22),
          new THREE.MeshStandardMaterial({ color: 0x202b27, transparent: true, opacity: 0.22, roughness: 1 })
        );
        stain.position.set(side * (2.775 + Math.random() * 0.004), 0.6 + Math.random() * 2.4, 6 - Math.random() * 34);
        this.scene.add(stain);
      }
    }

    // Ceiling fixtures with restrained, cold light and occasional flicker.
    this.scene.add(new THREE.HemisphereLight(0x9caeaa, 0x171a17, 0.42));
    const ambient = new THREE.AmbientLight(0x71817c, 0.14);
    this.scene.add(ambient);
    for (let i = 0; i < 5; i++) {
      const z = 5 - i * 7;
      this.box(this.scene, [0.78, 0.045, 0.22], [0, 3.32, z], new THREE.MeshStandardMaterial({
        color: 0x899b91, emissive: 0x61786d, emissiveIntensity: 0.65
      }), false);
      const light = new THREE.PointLight(0xa7b9ae, i === 2 ? 1.25 : 0.8, 9, 2);
      light.position.set(i % 2 ? 0.3 : -0.25, 3.08, z);
      this.scene.add(light);
      this.flickerLights.push({ light, base: light.intensity, phase: Math.random() * 10, rate: 1.2 + Math.random() * 2 });
    }

    // One crooked ceiling panel and a small floor obstruction give the space scale.
    const panel = this.box(this.scene, [1.25, 0.07, 1.7], [1.1, 3.28, -13.5], trim);
    panel.rotation.z = 0.035;
    const debris = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.36), dark);
    debris.position.set(-1.25, 0.02, -5.2);
    debris.rotation.y = 0.45;
    this.scene.add(debris);
  }

  update(time) {
    for (const item of this.flickerLights) {
      const wave = Math.sin(time * item.rate + item.phase);
      const glitch = Math.sin(time * 17 + item.phase) > 0.985 ? 0.12 : 1;
      item.light.intensity = item.base * (0.92 + wave * 0.045) * glitch;
    }
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render() {
    this.update(this.clock.getElapsedTime());
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
  }
}
