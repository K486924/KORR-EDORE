export const GRID = Object.freeze({
  cellSize: 0.5,
  originX: -10,
  originZ: -16
});

// Collision footprint for the farmhouse shell. The front doorway is left open.
const cells = [];
const add = (x, z) => cells.push(Object.freeze({ x, z }));

// House footprint: x = -8..8, z = -14..1.5. Leave a 2.5 m front entrance.
for (let x = 4; x <= 35; x++) {
  if (x >= 18 && x <= 22) continue;
  add(x, 35);
  add(x, 4);
}
for (let z = 5; z <= 34; z++) {
  add(4, z);
  add(35, z);
}

const worldCell = (value, origin) => Math.floor((value - origin) / GRID.cellSize);
function addWallX(x, zStart, zEnd) {
  const minX = worldCell(x - 0.12, GRID.originX);
  const maxX = worldCell(x + 0.12, GRID.originX);
  const minZ = worldCell(Math.min(zStart, zEnd), GRID.originZ);
  const maxZ = worldCell(Math.max(zStart, zEnd), GRID.originZ);
  for (let ix = minX; ix <= maxX; ix++) for (let iz = minZ; iz <= maxZ; iz++) add(ix, iz);
}
function addWallZ(z, xStart, xEnd) {
  const minZ = worldCell(z - 0.12, GRID.originZ);
  const maxZ = worldCell(z + 0.12, GRID.originZ);
  const minX = worldCell(Math.min(xStart, xEnd), GRID.originX);
  const maxX = worldCell(Math.max(xStart, xEnd), GRID.originX);
  for (let ix = minX; ix <= maxX; ix++) for (let iz = minZ; iz <= maxZ; iz++) add(ix, iz);
}
// Internal room dividers mirror the furnished ground-floor plan, with door gaps.
for (const x of [-2.05, 2.05]) {
  addWallX(x, -13.5, -10.5);
  addWallX(x, -9.65, -6.55);
  addWallX(x, -5.0, -1.0);
}
addWallZ(-4.65, -7.6, -3.0);
addWallZ(-4.65, -0.6, 0.6);
addWallZ(-4.65, 3.0, 7.6);

const uniqueCells = [...new Map(cells.map(cell => [cell.x + "," + cell.z, cell])).values()];
export const SOLID_CELLS = Object.freeze(uniqueCells);
export const SOLID_CELL_KEYS = new Set(uniqueCells.map(cell => cell.x + "," + cell.z));

export function cellCenter(x, z) {
  const half = GRID.cellSize * 0.5;
  return {
    x: GRID.originX + x * GRID.cellSize + half,
    z: GRID.originZ + z * GRID.cellSize + half
  };
}
