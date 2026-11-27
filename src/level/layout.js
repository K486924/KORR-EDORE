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
