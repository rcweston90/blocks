export const MAP_LAYOUTS = [
  { id: 'raceTrack', label: 'Race Track' },
  { id: 'cityBlocks', label: 'City Blocks' },
  { id: 'obstacleCourse', label: 'Obstacle Course' },
];

export function generateMap(state, layoutId) {
  state.pushUndo();
  state.blocks = [];
  state.rectangles = [];
  state.selection = null;
  state._rebuildBlockMap();

  const builder = BUILDERS[layoutId];
  if (builder) {
    builder(state);
  }
  state._rebuildBlockMap();
  state.statusText = `Generated: ${MAP_LAYOUTS.find(l => l.id === layoutId)?.label || layoutId}`;
}

// Helper: add a block without duplicate-checking overhead (we start from empty)
function add(state, gx, gy, z, color, type = 'normal') {
  state.blocks.push({ gx, gy, z, color, type });
}

// ── Layout 1: Race Track ──────────────────────────────────────────────

function buildRaceTrack(state) {
  // Oval track: outer rect ~150x100, track width 20
  const cx = 75, cy = 0;
  const outerW = 75, outerH = 50;
  const trackW = 20;
  const innerW = outerW - trackW;
  const innerH = outerH - trackW;

  const WALL = '#98a8b8';
  const BOOST = '#00ff88';
  const ICE = '#88ddff';
  const COIN = '#ffdd00';
  const GOAL = '#ffffff';

  function isInOval(gx, gy, hw, hh) {
    const dx = gx - cx;
    const dy = gy - cy;
    return (dx * dx) / (hw * hw) + (dy * dy) / (hh * hh) <= 1;
  }

  function isOnTrack(gx, gy) {
    return isInOval(gx, gy, outerW, outerH) && !isInOval(gx, gy, innerW, innerH);
  }

  function isOuterEdge(gx, gy) {
    return isInOval(gx, gy, outerW + 1, outerH + 1) && !isInOval(gx, gy, outerW, outerH);
  }

  function isInnerEdge(gx, gy) {
    return isInOval(gx, gy, innerW, innerH) && !isInOval(gx, gy, innerW - 1, innerH - 1);
  }

  function isCorner(gx, gy) {
    const dx = Math.abs(gx - cx);
    const dy = Math.abs(gy - cy);
    return dx > innerW * 0.5 && dy > innerH * 0.5;
  }

  for (let gx = cx - outerW - 2; gx <= cx + outerW + 2; gx++) {
    for (let gy = cy - outerH - 2; gy <= cy + outerH + 2; gy++) {
      if (isOuterEdge(gx, gy)) {
        add(state, gx, gy, 0, WALL, 'normal');
      }
      if (isInnerEdge(gx, gy)) {
        add(state, gx, gy, 0, WALL, 'normal');
      }
      if (isOnTrack(gx, gy)) {
        if (isCorner(gx, gy)) {
          add(state, gx, gy, 0, ICE, 'ice');
        } else {
          add(state, gx, gy, 0, BOOST, 'boost');
        }
      }
    }
  }

  // Place coins along the inner lane
  const coinPositions = [];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI * 2 / 20) {
    const r = 0.7;
    const gx = Math.round(cx + (innerW + trackW * r) * Math.cos(angle));
    const gy = Math.round(cy + (innerH + trackW * r) * Math.sin(angle));
    if (isOnTrack(gx, gy)) {
      coinPositions.push({ gx, gy });
    }
  }
  for (const pos of coinPositions) {
    add(state, pos.gx, pos.gy, 1, COIN, 'coin');
  }

  // Start block at origin facing East
  state.blocks.push({ gx: 0, gy: 0, z: 0, color: '#44ff44', type: 'start', dir: 1 });

  // Goal at start/finish line (right side of oval)
  const goalX = cx + outerW - 10;
  const goalY = cy;
  add(state, goalX, goalY, 0, GOAL, 'goal');

  state.worldBoundary = 120;
}

// ── Layout 2: City Blocks ─────────────────────────────────────────────

function buildCityBlocks(state) {
  const WALL = '#98a8b8';
  const BOOST = '#00ff88';
  const LAVA = '#ff3322';
  const COIN = '#ffdd00';
  const GOAL = '#ffffff';

  const buildingColors = ['#7788aa', '#8899bb', '#667799', '#99aabb', '#556688'];

  // City layout: buildings are 20x20, streets are 15 wide
  // Block pitch = 20 (building) + 15 (street) = 35
  const buildingSize = 20;
  const streetWidth = 15;
  const pitch = buildingSize + streetWidth;
  const gridCount = 5;
  const off = 20;
  const localSize = gridCount * pitch + streetWidth;
  const totalSize = off + localSize;

  function isBuilding(gx, gy) {
    const lx = gx - off, ly = gy - off;
    if (lx < 0 || ly < 0 || lx >= localSize || ly >= localSize) return false;
    const bx = lx % pitch;
    const by = ly % pitch;
    return bx < buildingSize && by < buildingSize && lx < gridCount * pitch && ly < gridCount * pitch;
  }

  // Streets
  for (let gx = 0; gx < totalSize; gx++) {
    for (let gy = 0; gy < totalSize; gy++) {
      if (!isBuilding(gx, gy)) {
        add(state, gx, gy, 0, BOOST, 'boost');
      }
    }
  }

  // Buildings: stacked walls 2-4 high
  for (let bxi = 0; bxi < gridCount; bxi++) {
    for (let byi = 0; byi < gridCount; byi++) {
      const ox = off + bxi * pitch;
      const oy = off + byi * pitch;
      const height = 2 + ((bxi * 3 + byi * 7) % 3);
      const color = buildingColors[(bxi + byi * 3) % buildingColors.length];
      for (let dx = 0; dx < buildingSize; dx++) {
        for (let dy = 0; dy < buildingSize; dy++) {
          for (let z = 0; z < height; z++) {
            add(state, ox + dx, oy + dy, z, color, 'normal');
          }
        }
      }
    }
  }

  // Lava patches at a few intersections
  const lavaIntersections = [[40, 40], [75, 110], [110, 75], [145, 145]];
  for (const [ix, iy] of lavaIntersections) {
    for (let dx = 0; dx < 15; dx++) {
      for (let dy = 0; dy < 15; dy++) {
        const gx = ix + dx;
        const gy = iy + dy;
        if (!isBuilding(gx, gy)) {
          const idx = state.blocks.findIndex(b => b.gx === gx && b.gy === gy && b.z === 0);
          if (idx !== -1) state.blocks[idx] = { gx, gy, z: 0, color: LAVA, type: 'lava' };
        }
      }
    }
  }

  // Coins scattered along streets
  const coinSpots = [
    [45, 25], [45, 60], [45, 95], [45, 130],
    [80, 45], [80, 80], [80, 115],
    [115, 25], [115, 60], [115, 95], [115, 130],
    [150, 45],
  ];
  for (const [cx, cy] of coinSpots) {
    if (!isBuilding(cx, cy)) {
      add(state, cx, cy, 1, COIN, 'coin');
    }
  }

  // Start block at origin facing East
  state.blocks.push({ gx: 0, gy: 0, z: 0, color: '#44ff44', type: 'start', dir: 1 });

  // Goal at far corner
  add(state, totalSize - 10, totalSize - 10, 0, GOAL, 'goal');

  state.worldBoundary = 200;
}

// ── Layout 3: Obstacle Course ─────────────────────────────────────────

function buildObstacleCourse(state) {
  const WALL = '#98a8b8';
  const WALL_HI = '#8898a8';
  const BOOST = '#00ff88';
  const ICE = '#88ddff';
  const LAVA = '#ff3322';
  const RAMP = '#ff8800';
  const COIN = '#ffdd00';
  const GOAL = '#ffffff';

  const pathWidth = 20;

  // Waypoints scaled 5x — snakes through a ~130x130 area
  const waypoints = [
    { x: 0, y: 0 },
    { x: 0, y: 50 },
    { x: 50, y: 50 },
    { x: 50, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 130, y: 50 },
    { x: 130, y: 100 },
    { x: 80, y: 100 },
    { x: 80, y: 130 },
    { x: 30, y: 130 },
    { x: 30, y: 80 },
    { x: 0, y: 80 },
    { x: 0, y: 130 },
  ];

  const segmentTypes = ['boost', 'ice', 'normal', 'boost', 'ice', 'normal', 'boost', 'normal', 'ice', 'boost', 'normal', 'boost', 'ice'];
  const segmentColors = {
    boost: BOOST,
    ice: ICE,
    lava: LAVA,
    normal: '#bbccdd',
  };

  const pathCells = new Set();
  const pathCellData = [];

  for (let seg = 0; seg < waypoints.length - 1; seg++) {
    const a = waypoints[seg];
    const b = waypoints[seg + 1];

    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let cx = a.x, cy = a.y;

    while (cx !== b.x || cy !== b.y) {
      for (let w = 0; w < pathWidth; w++) {
        const gx = dx !== 0 ? cx : cx + w;
        const gy = dy !== 0 ? cy : cy + w;
        const key = `${gx},${gy}`;
        if (!pathCells.has(key)) {
          pathCells.add(key);
          pathCellData.push({ gx, gy, segment: seg });
        }
      }
      cx += dx;
      cy += dy;
    }
    for (let w = 0; w < pathWidth; w++) {
      const gx = dx !== 0 ? b.x : b.x + w;
      const gy = dy !== 0 ? b.y : b.y + w;
      const key = `${gx},${gy}`;
      if (!pathCells.has(key)) {
        pathCells.add(key);
        pathCellData.push({ gx, gy, segment: seg });
      }
    }
  }

  // Place path floors
  for (const cell of pathCellData) {
    const type = segmentTypes[cell.segment % segmentTypes.length];
    const color = segmentColors[type] || '#bbccdd';
    add(state, cell.gx, cell.gy, 0, color, type);
  }

  // Place walls along path edges
  for (const cell of pathCellData) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = cell.gx + dx;
      const ny = cell.gy + dy;
      const nkey = `${nx},${ny}`;
      if (!pathCells.has(nkey)) {
        const wallKey = `w${nx},${ny}`;
        if (!pathCells.has(wallKey)) {
          pathCells.add(wallKey);
          add(state, nx, ny, 0, WALL, 'normal');
        }
      }
    }
  }

  // Ramp blocks at segment transitions
  const rampSegments = [3, 7, 10];
  for (const seg of rampSegments) {
    if (seg >= waypoints.length - 1) continue;
    const wp = waypoints[seg];
    for (let w = 0; w < pathWidth; w++) {
      const nextWp = waypoints[seg + 1];
      const dx = Math.sign(nextWp.x - wp.x);
      const dy = Math.sign(nextWp.y - wp.y);
      const gx = dx !== 0 ? wp.x : wp.x + w;
      const gy = dy !== 0 ? wp.y : wp.y + w;
      add(state, gx, gy, 0, RAMP, 'ramp');
    }
  }

  // Higher walls at chokepoints (stacked z=0..2)
  const chokeSegments = [2, 5, 9];
  for (const seg of chokeSegments) {
    if (seg >= waypoints.length - 1) continue;
    const wp = waypoints[seg];
    for (const offset of [-1, pathWidth]) {
      const nextWp = waypoints[seg + 1];
      const dx = Math.sign(nextWp.x - wp.x);
      const dy = Math.sign(nextWp.y - wp.y);
      const gx = dx !== 0 ? wp.x : wp.x + offset;
      const gy = dy !== 0 ? wp.y : wp.y + offset;
      for (let z = 1; z <= 2; z++) {
        add(state, gx, gy, z, WALL_HI, 'normal');
      }
    }
  }

  // Coins at tricky spots
  const coinSegments = [1, 3, 5, 7, 9, 11, 6, 2];
  for (const seg of coinSegments) {
    if (seg >= waypoints.length - 1) continue;
    const a = waypoints[seg];
    const b = waypoints[seg + 1];
    const mx = Math.round((a.x + b.x) / 2);
    const my = Math.round((a.y + b.y) / 2);
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    const gx = dx !== 0 ? mx : mx + 5;
    const gy = dy !== 0 ? my : my + 5;
    add(state, gx, gy, 1, COIN, 'coin');
  }

  // Start block at origin facing South
  state.blocks.push({ gx: 0, gy: 0, z: 0, color: '#44ff44', type: 'start', dir: 2 });

  // Goal at the end
  const last = waypoints[waypoints.length - 1];
  add(state, last.x + 5, last.y + 5, 0, GOAL, 'goal');

  state.worldBoundary = 120;
}

const BUILDERS = {
  raceTrack: buildRaceTrack,
  cityBlocks: buildCityBlocks,
  obstacleCourse: buildObstacleCourse,
};
