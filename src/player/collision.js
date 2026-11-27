import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GRID, SOLID_CELL_KEYS } from "../level/layout.js";

const HALF_CELL = GRID.cellSize * 0.5;

function cellIndex(value, origin) {
  return Math.floor((value - origin) / GRID.cellSize);
}

function resolveAxis(position, radius, axis, extraSolidCells = null) {
  const otherAxis = axis === "x" ? "z" : "x";
  const origin = axis === "x" ? GRID.originX : GRID.originZ;
  const otherOrigin = otherAxis === "x" ? GRID.originX : GRID.originZ;
  const index = cellIndex(position[axis], origin);
  const otherIndex = cellIndex(position[otherAxis], otherOrigin);
  for (let a = index - 1; a <= index + 1; a++) {
    for (let b = otherIndex - 1; b <= otherIndex + 1; b++) {
      const xIndex = axis === "x" ? a : b;
      const zIndex = axis === "z" ? a : b;
      const key = `${xIndex},${zIndex}`;
      if (!SOLID_CELL_KEYS.has(key) && !extraSolidCells?.has(key)) continue;
      const boxX = GRID.originX + xIndex * GRID.cellSize + HALF_CELL;
      const boxZ = GRID.originZ + zIndex * GRID.cellSize + HALF_CELL;
      const closestX = Math.max(boxX - HALF_CELL, Math.min(position.x, boxX + HALF_CELL));
      const closestZ = Math.max(boxZ - HALF_CELL, Math.min(position.z, boxZ + HALF_CELL));
      const dx = position.x - closestX, dz = position.z - closestZ;
      if (dx * dx + dz * dz >= radius * radius) continue;
      if (axis === "x") {
        const required = Math.sqrt(Math.max(0, radius * radius - dz * dz));
        position.x = Math.abs(dx) > 1e-8 ? closestX + Math.sign(dx) * required :
          (Math.abs(position.x - (boxX - HALF_CELL)) < Math.abs((boxX + HALF_CELL) - position.x)
            ? boxX - HALF_CELL - required : boxX + HALF_CELL + required);
      } else {
        const required = Math.sqrt(Math.max(0, radius * radius - dx * dx));
        position.z = Math.abs(dz) > 1e-8 ? closestZ + Math.sign(dz) * required :
          (Math.abs(position.z - (boxZ - HALF_CELL)) < Math.abs((boxZ + HALF_CELL) - position.z)
            ? boxZ - HALF_CELL - required : boxZ + HALF_CELL + required);
      }
    }
  }
}

function resolveMeshCollisions(position, radius, meshes) {
  if (!meshes?.length) return;
  const center = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const local = new THREE.Vector3();
  const closest = new THREE.Vector3();
  for (let pass = 0; pass < 3; pass++) {
    for (const mesh of meshes) {
      if (!mesh?.visible || mesh.userData?.collisionEnabled === false) continue;
      mesh.updateWorldMatrix(true, false);
      mesh.getWorldPosition(center);
      mesh.getWorldQuaternion(quaternion);
      const sx = mesh.scale.x, sz = mesh.scale.z;
      const halfX = (mesh.geometry?.parameters?.width || 0.2) * Math.abs(sx) * 0.5;
      const halfZ = (mesh.geometry?.parameters?.depth || 0.2) * Math.abs(sz) * 0.5;
      local.set(position.x - center.x, 0, position.z - center.z).applyQuaternion(quaternion.clone().invert());
      closest.set(Math.max(-halfX, Math.min(local.x, halfX)), 0,
        Math.max(-halfZ, Math.min(local.z, halfZ)));
      const dx = local.x - closest.x, dz = local.z - closest.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= radius * radius) continue;
      let nx = dx, nz = dz;
      let distance = Math.sqrt(distanceSq);
      if (distance < 1e-7) {
        const px = halfX - Math.abs(local.x), pz = halfZ - Math.abs(local.z);
        if (px < pz) { nx = local.x >= 0 ? 1 : -1; nz = 0; distance = -px; }
        else { nx = 0; nz = local.z >= 0 ? 1 : -1; distance = -pz; }
      }
      const push = radius - distance;
      local.x += nx / Math.max(1e-7, Math.hypot(nx, nz)) * push;
      local.z += nz / Math.max(1e-7, Math.hypot(nx, nz)) * push;
      const corrected = new THREE.Vector3(local.x, 0, local.z).applyQuaternion(quaternion).add(center);
      position.x = corrected.x;
      position.z = corrected.z;
    }
  }
}

export function moveWithCollisions(position, deltaX, deltaZ, radius, extraSolidCells = null, solidMeshes = null) {
  position.x += deltaX;
  resolveAxis(position, radius, "x", extraSolidCells);
  resolveMeshCollisions(position, radius, solidMeshes);
  position.z += deltaZ;
  resolveAxis(position, radius, "z", extraSolidCells);
  resolveMeshCollisions(position, radius, solidMeshes);
  return position;
}
