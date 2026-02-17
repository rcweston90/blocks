export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const BLOCK_HEIGHT = 24;
export const FLOOR_HEIGHT = 6;
export const GRID_EXTENT = 40;

// Gameplay
export const BOOST_DURATION = 2000;  // ms
export const ICE_SLIDE_CELLS = 2;
export const JUMP_DURATION = 600;    // ms
export const JUMP_HEIGHT = 2;        // multiplier of BLOCK_HEIGHT for visual

// Ramp directions (index matches rotation: 0=N, 1=E, 2=S, 3=W)
export const RAMP_DIRS = [
  { dgx: 0, dgy: -1, label: 'N' },  // 0: up = north
  { dgx: 1, dgy: 0,  label: 'E' },  // 1: up = east
  { dgx: 0, dgy: 1,  label: 'S' },  // 2: up = south
  { dgx: -1, dgy: 0, label: 'W' },  // 3: up = west
];

// World boundaries
export const DEFAULT_BOUNDARY = 40;  // ±N cells from origin
