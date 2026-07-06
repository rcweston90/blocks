// BlockBuffer + low-level drawing helpers for map generation

// ── Seeded PRNG ─────────────────────────────────────────────────────────
export function seedRandom(seed) {
  let s = seed | 0;
  return function () {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ── BlockBuffer ─────────────────────────────────────────────────────────
export class BlockBuffer {
  constructor() {
    this._blocks = [];       // {gx, gy, z, color, type, dir?}
    this._keys = new Set();  // "gx,gy,z" for dedup
  }

  _key(gx, gy, z) { return `${gx},${gy},${z}`; }

  /** Add a block (skips if already occupied at gx,gy,z). */
  add(gx, gy, z, color, type = 'normal', dir) {
    const k = this._key(gx, gy, z);
    if (this._keys.has(k)) return;
    this._keys.add(k);
    const b = { gx, gy, z, color, type };
    if (dir !== undefined) b.dir = dir;
    this._blocks.push(b);
  }

  /** Set a block (overwrites any existing block at gx,gy,z). */
  set(gx, gy, z, color, type = 'normal', dir) {
    const k = this._key(gx, gy, z);
    if (this._keys.has(k)) {
      const idx = this._blocks.findIndex(b => b.gx === gx && b.gy === gy && b.z === z);
      if (idx !== -1) this._blocks.splice(idx, 1);
    }
    this._keys.add(k);
    const b = { gx, gy, z, color, type };
    if (dir !== undefined) b.dir = dir;
    this._blocks.push(b);
  }

  /** Check if a block exists at gx,gy,z. */
  has(gx, gy, z) {
    return this._keys.has(this._key(gx, gy, z));
  }

  /** Push all blocks into state.blocks and rebuild the block map. */
  flush(state) {
    for (const b of this._blocks) {
      state.blocks.push(b);
    }
  }

  get length() { return this._blocks.length; }
}

// ── Primitive drawing helpers ───────────────────────────────────────────

/** Fill a rectangle of blocks. */
export function fillRect(buf, x, y, w, h, color, type = 'normal', z = 0) {
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      buf.add(x + dx, y + dy, z, color, type);
    }
  }
}

/** Outline a rectangle (1-cell border). */
export function strokeRect(buf, x, y, w, h, color, type = 'normal', z = 0) {
  for (let dx = 0; dx < w; dx++) {
    buf.add(x + dx, y, z, color, type);
    buf.add(x + dx, y + h - 1, z, color, type);
  }
  for (let dy = 1; dy < h - 1; dy++) {
    buf.add(x, y + dy, z, color, type);
    buf.add(x + w - 1, y + dy, z, color, type);
  }
}

/** Bresenham line from (x1,y1) to (x2,y2). */
export function line(buf, x1, y1, x2, y2, color, type = 'normal', z = 0) {
  let dx = Math.abs(x2 - x1), sx = x1 < x2 ? 1 : -1;
  let dy = -Math.abs(y2 - y1), sy = y1 < y2 ? 1 : -1;
  let err = dx + dy;
  let cx = x1, cy = y1;
  while (true) {
    buf.add(cx, cy, z, color, type);
    if (cx === x2 && cy === y2) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; cx += sx; }
    if (e2 <= dx) { err += dx; cy += sy; }
  }
}

/** Filled ellipse centered at (cx,cy) with radii (rx,ry). */
export function fillEllipse(buf, cx, cy, rx, ry, color, type = 'normal', z = 0) {
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        buf.add(cx + dx, cy + dy, z, color, type);
      }
    }
  }
}

/** Ellipse outline (stroke only). */
export function strokeEllipse(buf, cx, cy, rx, ry, color, type = 'normal', z = 0) {
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      const v = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
      if (v <= 1 && v > 0.85) {
        buf.add(cx + dx, cy + dy, z, color, type);
      }
    }
  }
}

/** Vertical column of wall blocks from z=0 to height-1. */
export function column(buf, gx, gy, height, color) {
  for (let z = 0; z < height; z++) {
    buf.add(gx, gy, z, color, 'normal');
  }
}

/** 3D rectangular prism (solid box of walls). */
export function fillBox(buf, x, y, w, h, zBase, height, color) {
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      for (let z = zBase; z < zBase + height; z++) {
        buf.add(x + dx, y + dy, z, color, 'normal');
      }
    }
  }
}

/**
 * Draw a path along waypoints with given width.
 * Returns a Set<"gx,gy"> of all cells on the path.
 */
export function path(buf, waypoints, width, color, type = 'normal', z = 0) {
  const cells = new Set();
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let cx = a.x, cy = a.y;

    const addCross = (px, py) => {
      for (let w = 0; w < width; w++) {
        const gx = dx !== 0 ? px : px + w;
        const gy = dy !== 0 ? py : py + w;
        const key = `${gx},${gy}`;
        if (!cells.has(key)) {
          cells.add(key);
          buf.add(gx, gy, z, color, type);
        }
      }
    };

    while (cx !== b.x || cy !== b.y) {
      addCross(cx, cy);
      cx += dx;
      cy += dy;
    }
    addCross(b.x, b.y);
  }
  return cells;
}

/**
 * Place walls along the border of a path.
 * pathCells: Set<"gx,gy"> of path interior.
 */
export function wallBorder(buf, pathCells, color, z = 0, height = 1) {
  const walls = new Set();
  for (const key of pathCells) {
    const [px, py] = key.split(',').map(Number);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nk = `${px + dx},${py + dy}`;
      if (!pathCells.has(nk) && !walls.has(nk)) {
        walls.add(nk);
        for (let h = 0; h < height; h++) {
          buf.add(px + dx, py + dy, z + h, color, 'normal');
        }
      }
    }
  }
  return walls;
}

/**
 * Scatter random blocks inside an area, avoiding an exclusion set.
 * Returns the placed positions.
 */
export function scatter(buf, x, y, w, h, color, type, count, z = 0, exclude = null, rng = Math.random) {
  const placed = [];
  let attempts = 0;
  while (placed.length < count && attempts < count * 10) {
    attempts++;
    const gx = x + Math.floor(rng() * w);
    const gy = y + Math.floor(rng() * h);
    const key = `${gx},${gy}`;
    if (exclude && exclude.has(key)) continue;
    if (buf.has(gx, gy, z)) continue;
    buf.add(gx, gy, z, color, type);
    placed.push({ gx, gy });
  }
  return placed;
}

/**
 * Place a strip of ramp blocks from (sx,sy) to (ex,ey).
 * Auto-detects direction from the travel direction.
 * width expands perpendicular to travel.
 */
export function rampStrip(buf, sx, sy, ex, ey, width, color) {
  const dx = Math.sign(ex - sx);
  const dy = Math.sign(ey - sy);

  // Determine ramp dir: the ramp "faces up" toward the high end.
  // RAMP_DIRS: 0=N(0,-1), 1=E(1,0), 2=S(0,1), 3=W(-1,0)
  // The ramp dir should point toward (ex,ey) — the high end.
  let dir;
  if (dy < 0) dir = 0;       // going north → ramp faces north
  else if (dx > 0) dir = 1;  // going east
  else if (dy > 0) dir = 2;  // going south
  else dir = 3;               // going west

  let cx = sx, cy = sy;
  while (true) {
    for (let w = 0; w < width; w++) {
      const gx = dx !== 0 ? cx : cx + w;
      const gy = dy !== 0 ? cy : cy + w;
      buf.add(gx, gy, 0, color, 'ramp', dir);
    }
    if (cx === ex && cy === ey) break;
    cx += dx;
    cy += dy;
  }
}
