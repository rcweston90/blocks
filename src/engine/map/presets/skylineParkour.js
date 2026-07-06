// Skyline Parkour: elevated platforms over deadly water
import { registerBuilder } from '../registry.js';
import { fillRect, fillBox } from '../primitives.js';
import { createElevatedPlatform } from '../compounds.js';
import { C } from '../colors.js';

registerBuilder('skylineParkour', (buf, state) => {
  // Water base
  fillRect(buf, -5, -5, 80, 70, C.WATER, 'water', 0);

  // Starting island
  fillRect(buf, 0, 0, 8, 8, C.FLOOR, 'normal', 1);
  fillBox(buf, 0, 0, 8, 8, 0, 1, C.WALL);
  buf.set(2, 4, 1, C.START, 'start', 1);

  // Platform chain
  const platforms = [
    { x: 12, y: 0, w: 8, h: 7, z: 2 },
    { x: 24, y: -2, w: 7, h: 6, z: 3 },
    { x: 35, y: 0, w: 7, h: 7, z: 4 },
    { x: 46, y: -2, w: 8, h: 8, z: 5 },
    { x: 46, y: 12, w: 8, h: 7, z: 4 },
    { x: 34, y: 15, w: 7, h: 7, z: 3 },
    { x: 22, y: 18, w: 8, h: 7, z: 2 },
    { x: 10, y: 15, w: 7, h: 7, z: 1 },
    // South route
    { x: 0, y: 28, w: 8, h: 7, z: 2 },
    { x: 12, y: 30, w: 7, h: 7, z: 3 },
    { x: 24, y: 30, w: 10, h: 8, z: 4 },
    { x: 38, y: 32, w: 7, h: 7, z: 5 },
    { x: 50, y: 30, w: 9, h: 9, z: 3 },
  ];

  for (const p of platforms) {
    createElevatedPlatform(buf, p.x, p.y, p.w, p.h, {
      platformZ: p.z,
      floorColor: p.z >= 5 ? C.ICE : C.FLOOR,
      floorType: p.z >= 5 ? 'ice' : 'normal',
    });
  }

  // Connect platforms with ramp blocks at midpoints
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7],
    [7, 8], [8, 9], [9, 10], [10, 11], [11, 12],
  ];

  for (const [ai, bi] of connections) {
    const a = platforms[ai];
    const b = platforms[bi];
    const ax = a.x + Math.floor(a.w / 2);
    const ay = a.y + Math.floor(a.h / 2);
    const bx = b.x + Math.floor(b.w / 2);
    const by = b.y + Math.floor(b.h / 2);

    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    const startZ = a.z;
    const endZ = b.z;

    let rampDir;
    if (endZ >= startZ) {
      if (Math.abs(bx - ax) > Math.abs(by - ay)) rampDir = dx > 0 ? 1 : 3;
      else rampDir = dy > 0 ? 2 : 0;
    } else {
      if (Math.abs(bx - ax) > Math.abs(by - ay)) rampDir = dx > 0 ? 3 : 1;
      else rampDir = dy > 0 ? 0 : 2;
    }

    const midX = Math.round((ax + bx) / 2);
    const midY = Math.round((ay + by) / 2);
    const midZ = Math.round((startZ + endZ) / 2);

    for (let w = -1; w <= 1; w++) {
      buf.add(midX + (dy !== 0 ? w : 0), midY + (dx !== 0 ? w : 0), midZ, C.RAMP, 'ramp', rampDir);
      for (let z = 0; z < midZ; z++) {
        buf.add(midX + (dy !== 0 ? w : 0), midY + (dx !== 0 ? w : 0), z, C.WALL, 'normal');
      }
    }
  }

  // Coins on platforms
  for (const p of platforms) {
    buf.add(p.x + Math.floor(p.w / 2), p.y + Math.floor(p.h / 2), p.z + 1, C.COIN, 'coin');
  }

  // Goal on last platform
  const goalP = platforms[platforms.length - 1];
  fillRect(buf, goalP.x + 2, goalP.y + 2, 3, 3, C.BOOST, 'boost', goalP.z);
  buf.add(goalP.x + Math.floor(goalP.w / 2), goalP.y + Math.floor(goalP.h / 2), goalP.z, C.GOAL, 'goal');

  state.worldBoundary = 60;
});
