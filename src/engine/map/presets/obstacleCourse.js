import { registerBuilder } from '../registry.js';
import { wallBorder } from '../primitives.js';
import { createHazardZone, createIceCorridor, createRampBridge } from '../compounds.js';
import { C } from '../colors.js';

registerBuilder('obstacleCourse', (buf, state) => {
  const pathWidth = 10;

  // Scaled-down waypoints (~65x65 area)
  const waypoints = [
    { x: 0, y: 0 },
    { x: 0, y: 25 },
    { x: 25, y: 25 },
    { x: 25, y: 0 },
    { x: 50, y: 0 },
    { x: 50, y: 25 },
    { x: 65, y: 25 },
    { x: 65, y: 50 },
    { x: 40, y: 50 },
    { x: 40, y: 65 },
    { x: 15, y: 65 },
    { x: 15, y: 40 },
    { x: 0, y: 40 },
    { x: 0, y: 65 },
  ];

  const segmentTypes = ['boost', 'ice', 'normal', 'boost', 'ice', 'normal', 'boost', 'normal', 'ice', 'boost', 'normal', 'boost', 'ice'];
  const segmentColors = {
    boost: C.BOOST,
    ice: C.ICE,
    lava: C.LAVA,
    normal: C.FLOOR,
  };

  const allPathCells = new Set();
  const pathCellData = [];

  for (let seg = 0; seg < waypoints.length - 1; seg++) {
    const a = waypoints[seg];
    const b = waypoints[seg + 1];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let cx = a.x, cy = a.y;

    const addCross = (px, py) => {
      for (let w = 0; w < pathWidth; w++) {
        const gx = dx !== 0 ? px : px + w;
        const gy = dy !== 0 ? py : py + w;
        const key = `${gx},${gy}`;
        if (!allPathCells.has(key)) {
          allPathCells.add(key);
          pathCellData.push({ gx, gy, segment: seg });
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

  // Place path floors
  for (const cell of pathCellData) {
    const type = segmentTypes[cell.segment % segmentTypes.length];
    const color = segmentColors[type] || C.FLOOR;
    buf.add(cell.gx, cell.gy, 0, color, type);
  }

  // Walls along edges
  wallBorder(buf, allPathCells, C.WALL, 0, 1);

  // Lava hazard zone in segment 4
  const seg4a = waypoints[4];
  const seg4b = waypoints[5];
  createHazardZone(buf, Math.min(seg4a.x, seg4b.x) + 1, Math.min(seg4a.y, seg4b.y) + 2, 8, pathWidth - 4, {
    hazardType: 'lava',
    safeWidth: 2,
  });

  // Ice corridor in segment 8
  const seg8a = waypoints[8];
  const seg8b = waypoints[9];
  createIceCorridor(buf, seg8a.x + 2, seg8a.y, seg8b.x + 2, seg8b.y, { width: 3, wallHeight: 2 });

  // Ramp bridge in segment 6-7
  const seg6 = waypoints[6];
  createRampBridge(buf, seg6.x + 2, seg6.y + 2, seg6.x + 2, seg6.y + 10, { width: 3, topZ: 2 });

  // Ramp blocks at segment transitions
  const rampSegments = [3, 7, 10];
  for (const seg of rampSegments) {
    if (seg >= waypoints.length - 1) continue;
    const wp = waypoints[seg];
    const nextWp = waypoints[seg + 1];
    const dx = Math.sign(nextWp.x - wp.x);
    const dy = Math.sign(nextWp.y - wp.y);
    for (let w = 0; w < pathWidth; w++) {
      const gx = dx !== 0 ? wp.x : wp.x + w;
      const gy = dy !== 0 ? wp.y : wp.y + w;
      buf.set(gx, gy, 0, C.RAMP, 'ramp');
    }
  }

  // Higher walls at chokepoints
  const chokeSegments = [2, 5, 9];
  for (const seg of chokeSegments) {
    if (seg >= waypoints.length - 1) continue;
    const wp = waypoints[seg];
    const nextWp = waypoints[seg + 1];
    const dx = Math.sign(nextWp.x - wp.x);
    const dy = Math.sign(nextWp.y - wp.y);
    for (const offset of [-1, pathWidth]) {
      const gx = dx !== 0 ? wp.x : wp.x + offset;
      const gy = dy !== 0 ? wp.y : wp.y + offset;
      for (let z = 1; z <= 2; z++) {
        buf.add(gx, gy, z, C.WALL_DARK, 'normal');
      }
    }
  }

  // Coins
  const coinSegments = [1, 3, 5, 7, 9, 11, 6, 2];
  for (const seg of coinSegments) {
    if (seg >= waypoints.length - 1) continue;
    const a = waypoints[seg];
    const b = waypoints[seg + 1];
    const mx = Math.round((a.x + b.x) / 2);
    const my = Math.round((a.y + b.y) / 2);
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    const gx = dx !== 0 ? mx : mx + 3;
    const gy = dy !== 0 ? my : my + 3;
    buf.add(gx, gy, 1, C.COIN, 'coin');
  }

  // Start
  buf.add(0, 0, 0, C.START, 'start', 2);

  // Goal
  const last = waypoints[waypoints.length - 1];
  buf.add(last.x + 3, last.y + 3, 0, C.GOAL, 'goal');

  state.worldBoundary = 60;
});
