// Mid-level gameplay structures built from primitives
import { fillRect, strokeRect, fillBox, wallBorder, path, scatter, rampStrip, line, seedRandom } from './primitives.js';
import { C } from './colors.js';

/**
 * Flat arena with walls around the perimeter.
 * Returns { pathCells, bounds }.
 */
export function createArena(buf, cx, cy, w, h, opts = {}) {
  const {
    floorColor = C.FLOOR,
    floorType = 'normal',
    wallColor = C.WALL,
    wallHeight = 1,
    z = 0,
  } = opts;

  const x = cx - Math.floor(w / 2);
  const y = cy - Math.floor(h / 2);

  // Floor
  fillRect(buf, x, y, w, h, floorColor, floorType, z);

  // Walls around perimeter
  for (let dz = 0; dz < wallHeight; dz++) {
    strokeRect(buf, x - 1, y - 1, w + 2, h + 2, wallColor, 'normal', z + dz);
  }

  const pathCells = new Set();
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      pathCells.add(`${x + dx},${y + dy}`);
    }
  }

  return { pathCells, bounds: { x, y, w, h } };
}

/**
 * Recursive-backtracking maze.
 * Returns { pathCells, entry, exit }.
 */
export function createMaze(buf, x, y, w, h, opts = {}) {
  const {
    floorColor = C.FLOOR,
    wallColor = C.WALL,
    wallHeight = 1,
    z = 0,
    cellSize = 3,  // corridor width (odd works best)
    seed = 42,
  } = opts;

  const rng = seedRandom(seed);
  const cols = Math.floor(w / cellSize);
  const rows = Math.floor(h / cellSize);

  // Start with all walls
  const maze = Array.from({ length: rows }, () => Array(cols).fill(true));
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

  function carve(cr, cc) {
    visited[cr][cc] = true;
    maze[cr][cc] = false;
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    // Shuffle directions
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const [dr, dc] of dirs) {
      const nr = cr + dr * 2, nc = cc + dc * 2;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr]?.[nc]) {
        // Carve the wall between
        maze[cr + dr][cc + dc] = false;
        visited[cr + dr] = visited[cr + dr] || [];
        visited[cr + dr][cc + dc] = true;
        carve(nr, nc);
      }
    }
  }

  carve(1, 1);

  const pathCells = new Set();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gx = x + c * 1; // 1:1 scale (cellSize controls maze density)
      const gy = y + r * 1;
      if (gx >= x + w || gy >= y + h) continue;
      if (maze[r][c]) {
        for (let dz = 0; dz < wallHeight; dz++) {
          buf.add(gx, gy, z + dz, wallColor, 'normal');
        }
      } else {
        buf.add(gx, gy, z, floorColor, 'normal');
        pathCells.add(`${gx},${gy}`);
      }
    }
  }

  const entry = { x: x + 1, y: y + 1 };
  const exit = { x: x + Math.min(cols - 2, w - 2), y: y + Math.min(rows - 2, h - 2) };

  return { pathCells, entry, exit };
}

/**
 * Elevated platform: floor at z=platformZ with wall supports.
 * Returns { pathCells, platformZ }.
 */
export function createElevatedPlatform(buf, x, y, w, h, opts = {}) {
  const {
    floorColor = C.FLOOR,
    floorType = 'normal',
    supportColor = C.WALL,
    platformZ = 3,
  } = opts;

  // Corner supports
  const corners = [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]];
  for (const [cx, cy] of corners) {
    for (let z = 0; z < platformZ; z++) {
      buf.add(cx, cy, z, supportColor, 'normal');
    }
  }

  // Platform surface
  fillRect(buf, x, y, w, h, floorColor, floorType, platformZ);

  const pathCells = new Set();
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      pathCells.add(`${x + dx},${y + dy}`);
    }
  }

  return { pathCells, platformZ };
}

/**
 * Hazard zone: fills area with hazard, then carves a safe path through.
 * Returns { pathCells, safePath }.
 */
export function createHazardZone(buf, x, y, w, h, opts = {}) {
  const {
    hazardColor = C.LAVA,
    hazardType = 'lava',
    safeColor = C.FLOOR,
    safeWidth = 3,
    z = 0,
    seed = 99,
  } = opts;

  // Fill with hazard
  fillRect(buf, x, y, w, h, hazardColor, hazardType, z);

  // Carve a safe corridor through the middle
  const safeY = y + Math.floor(h / 2) - Math.floor(safeWidth / 2);
  const safePath = new Set();
  for (let dx = 0; dx < w; dx++) {
    for (let sw = 0; sw < safeWidth; sw++) {
      const gx = x + dx;
      const gy = safeY + sw;
      buf.set(gx, gy, z, safeColor, 'normal');
      safePath.add(`${gx},${gy}`);
    }
  }

  const pathCells = new Set();
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      pathCells.add(`${x + dx},${y + dy}`);
    }
  }

  return { pathCells, safePath };
}

/**
 * Place coins along a series of waypoints.
 */
export function createCoinTrail(buf, points, opts = {}) {
  const {
    color = C.COIN,
    z = 1,
    spacing = 3,
  } = opts;

  let count = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = Math.sign(b.x - a.x) || 0;
    const dy = Math.sign(b.y - a.y) || 0;
    let cx = a.x, cy = a.y;
    while (cx !== b.x || cy !== b.y) {
      if (count % spacing === 0) {
        buf.add(cx, cy, z, color, 'coin');
      }
      count++;
      cx += dx;
      cy += dy;
    }
  }
}

/**
 * Ramp bridge: ramp up → flat section → ramp down.
 * Returns { pathCells, topZ }.
 */
export function createRampBridge(buf, sx, sy, ex, ey, opts = {}) {
  const {
    width = 5,
    rampColor = C.RAMP,
    bridgeColor = C.FLOOR,
    topZ = 3,
    supportColor = C.WALL,
  } = opts;

  const dx = Math.sign(ex - sx);
  const dy = Math.sign(ey - sy);
  const totalLen = Math.abs(ex - sx) + Math.abs(ey - sy);
  const rampLen = Math.min(Math.floor(totalLen / 3), topZ);
  const flatLen = totalLen - rampLen * 2;

  const pathCells = new Set();

  // Determine ramp direction
  let upDir, downDir;
  if (dy < 0) { upDir = 0; downDir = 2; }
  else if (dx > 0) { upDir = 1; downDir = 3; }
  else if (dy > 0) { upDir = 2; downDir = 0; }
  else { upDir = 3; downDir = 1; }

  let cx = sx, cy = sy;

  // Ramp up section
  for (let i = 0; i < rampLen; i++) {
    for (let w = 0; w < width; w++) {
      const gx = dx !== 0 ? cx : cx + w;
      const gy = dy !== 0 ? cy : cy + w;
      buf.add(gx, gy, i, rampColor, 'ramp', upDir);
      pathCells.add(`${gx},${gy}`);
    }
    cx += dx;
    cy += dy;
  }

  // Flat bridge section with supports
  for (let i = 0; i < flatLen; i++) {
    for (let w = 0; w < width; w++) {
      const gx = dx !== 0 ? cx : cx + w;
      const gy = dy !== 0 ? cy : cy + w;
      // Supports
      for (let z = 0; z < topZ; z++) {
        if (w === 0 || w === width - 1) {
          buf.add(gx, gy, z, supportColor, 'normal');
        }
      }
      buf.add(gx, gy, topZ, bridgeColor, 'normal');
      pathCells.add(`${gx},${gy}`);
    }
    cx += dx;
    cy += dy;
  }

  // Ramp down section
  for (let i = rampLen - 1; i >= 0; i--) {
    for (let w = 0; w < width; w++) {
      const gx = dx !== 0 ? cx : cx + w;
      const gy = dy !== 0 ? cy : cy + w;
      buf.add(gx, gy, i, rampColor, 'ramp', downDir);
      pathCells.add(`${gx},${gy}`);
    }
    cx += dx;
    cy += dy;
  }

  return { pathCells, topZ };
}

/**
 * Ice corridor: ice floor with walls on both sides.
 */
export function createIceCorridor(buf, sx, sy, ex, ey, opts = {}) {
  const {
    width = 5,
    iceColor = C.ICE,
    wallColor = C.WALL,
    wallHeight = 1,
    z = 0,
  } = opts;

  const dx = Math.sign(ex - sx);
  const dy = Math.sign(ey - sy);
  const pathCells = new Set();

  let cx = sx, cy = sy;
  while (true) {
    for (let w = -1; w <= width; w++) {
      const gx = dx !== 0 ? cx : cx + w;
      const gy = dy !== 0 ? cy : cy + w;
      if (w === -1 || w === width) {
        for (let h = 0; h < wallHeight; h++) {
          buf.add(gx, gy, z + h, wallColor, 'normal');
        }
      } else {
        buf.add(gx, gy, z, iceColor, 'ice');
        pathCells.add(`${gx},${gy}`);
      }
    }
    if (cx === ex && cy === ey) break;
    cx += dx;
    cy += dy;
  }

  return { pathCells };
}

/**
 * Boost highway: wide boost lanes.
 */
export function createBoostHighway(buf, sx, sy, ex, ey, opts = {}) {
  const {
    width = 8,
    boostColor = C.BOOST,
    borderColor = C.WALL,
    z = 0,
  } = opts;

  const dx = Math.sign(ex - sx);
  const dy = Math.sign(ey - sy);
  const pathCells = new Set();

  let cx = sx, cy = sy;
  while (true) {
    for (let w = -1; w <= width; w++) {
      const gx = dx !== 0 ? cx : cx + w;
      const gy = dy !== 0 ? cy : cy + w;
      if (w === -1 || w === width) {
        buf.add(gx, gy, z, borderColor, 'normal');
      } else {
        buf.add(gx, gy, z, boostColor, 'boost');
        pathCells.add(`${gx},${gy}`);
      }
    }
    if (cx === ex && cy === ey) break;
    cx += dx;
    cy += dy;
  }

  return { pathCells };
}

/**
 * Building: solid wall block with optional roof access.
 * Returns { bounds, roofZ }.
 */
export function createBuilding(buf, x, y, w, h, opts = {}) {
  const {
    color = C.BLDG[0],
    height = 3,
    roofAccess = false,
    roofColor = C.FLOOR,
    z = 0,
  } = opts;

  fillBox(buf, x, y, w, h, z, height, color);

  const roofZ = z + height;
  if (roofAccess) {
    fillRect(buf, x, y, w, h, roofColor, 'normal', roofZ);
  }

  return { bounds: { x, y, w, h }, roofZ };
}
