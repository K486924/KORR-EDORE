import { GRID, SOLID_CELL_KEYS } from "../level/layout.js";

const HALF_CELL = GRID.cellSize * 0.5;

function cellIndex(value, origin) {
  return Math.floor((value - origin) / GRID.cellSize);
}

function resolveAxis(position, radius, axis) {
  const otherAxis = axis === "x" ? "z" : "x";
  const origin = axis === "x" ? GRID.originX : GRID.originZ;
  const otherOrigin = otherAxis === "x" ? GRID.originX : GRID.originZ;
  const index = cellIndex(position[axis], origin);
  const otherIndex = cellIndex(position[otherAxis], otherOrigin);

  // A circle this small can only overlap cells in this local 3x3 neighborhood.
  for (let a = index - 1; a <= index + 1; a++) {
    for (let b = otherIndex - 1; b <= otherIndex + 1; b++) {
      const xIndex = axis === "x" ? a : b;
      const zIndex = axis === "z" ? a : b;
      if (!SOLID_CELL_KEYS.has(`${xIndex},${zIndex}`)) continue;

      const boxX = GRID.originX + xIndex * GRID.cellSize + HALF_CELL;
      const boxZ = GRID.originZ + zIndex * GRID.cellSize + HALF_CELL;
      const closestX = Math.max(boxX - HALF_CELL, Math.min(position.x, boxX + HALF_CELL));
      const closestZ = Math.max(boxZ - HALF_CELL, Math.min(position.z, boxZ + HALF_CELL));
      const dx = position.x - closestX;
      const dz = position.z - closestZ;
      const distanceSquared = dx * dx + dz * dz;
      if (distanceSquared >= radius * radius) continue;

      if (axis === "x") {
        if (Math.abs(dx) > 1e-8) {
          position.x = closestX + Math.sign(dx) * radius;
        } else {
          const left = Math.abs(position.x - (boxX - HALF_CELL));
          const right = Math.abs((boxX + HALF_CELL) - position.x);
          position.x = left < right
            ? boxX - HALF_CELL - radius
            : boxX + HALF_CELL + radius;
        }
      } else if (Math.abs(dz) > 1e-8) {
        position.z = closestZ + Math.sign(dz) * radius;
      } else {
        const near = Math.abs(position.z - (boxZ - HALF_CELL));
        const far = Math.abs((boxZ + HALF_CELL) - position.z);
        position.z = near < far
          ? boxZ - HALF_CELL - radius
          : boxZ + HALF_CELL + radius;
      }
    }
  }
}

export function moveWithCollisions(position, deltaX, deltaZ, radius) {
  position.x += deltaX;
  resolveAxis(position, radius, "x");
  position.z += deltaZ;
  resolveAxis(position, radius, "z");
  return position;
}
