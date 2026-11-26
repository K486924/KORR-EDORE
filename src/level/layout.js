export const GRID = Object.freeze({
  cellSize: 0.5,
  originX: -3.25,
  originZ: -30
});

// The level layout is the single source of truth for solid grid cells.
// The renderer builds its wall geometry from this list; player collision
// queries the same cells through SOLID_CELL_KEYS.
const cells = [];
const add = (x, z) => cells.push(Object.freeze({ x, z }));

// Two continuous side walls and the far end wall.
for (let z = 0; z < 80; z++) {
  add(0, z);
  add(12, z);
}
for (let x = 0; x <= 12; x++) add(x, 0);

const uniqueCells = [...new Map(cells.map(cell => [`${cell.x},${cell.z}`, cell])).values()];
export const SOLID_CELLS = Object.freeze(uniqueCells);
export const SOLID_CELL_KEYS = new Set(uniqueCells.map(cell => `${cell.x},${cell.z}`));

export function cellCenter(x, z) {
  const half = GRID.cellSize * 0.5;
  return {
    x: GRID.originX + x * GRID.cellSize + half,
    z: GRID.originZ + z * GRID.cellSize + half
  };
}
