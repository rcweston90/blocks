// Hazard Gauntlet: 6 themed deadly rooms
import { registerBuilder } from '../registry.js';
import { fillRect, strokeRect, fillBox } from '../primitives.js';
import { createHazardZone, createMaze } from '../compounds.js';
import { C } from '../colors.js';

registerBuilder('hazardGauntlet', (buf, state) => {
  const roomW = 16;
  const roomH = 16;
  const corridorW = 4;
  const corridorLen = 4;

  // 6 rooms in a 3x2 grid
  function roomOrigin(col, row) {
    return {
      x: col * (roomW + corridorLen),
      y: row * (roomH + corridorLen),
    };
  }

  function connectH(c1, r1) {
    const o = roomOrigin(c1, r1);
    const sx = o.x + roomW;
    const sy = o.y + Math.floor(roomH / 2) - Math.floor(corridorW / 2);
    fillRect(buf, sx, sy, corridorLen, corridorW, C.FLOOR, 'normal', 0);
  }

  function connectV(c1, r1) {
    const o = roomOrigin(c1, r1);
    const sx = o.x + Math.floor(roomW / 2) - Math.floor(corridorW / 2);
    const sy = o.y + roomH;
    fillRect(buf, sx, sy, corridorW, corridorLen, C.FLOOR, 'normal', 0);
  }

  // Room 0: Lava Fields
  {
    const { x, y } = roomOrigin(0, 0);
    for (let dz = 0; dz < 2; dz++) {
      strokeRect(buf, x - 1, y - 1, roomW + 2, roomH + 2, C.WALL, 'normal', dz);
    }
    createHazardZone(buf, x, y, roomW, roomH, {
      hazardType: 'lava',
      hazardColor: C.LAVA,
      safeWidth: 2,
    });
    // Zigzag safe path
    for (let i = 0; i < roomW; i++) {
      const zigY = y + 3 + (i % 6 < 3 ? i % 3 : 3 - (i % 3));
      buf.set(x + i, zigY, 0, C.FLOOR, 'normal');
      buf.set(x + i, zigY + 1, 0, C.FLOOR, 'normal');
    }
    buf.add(x + 2, y + Math.floor(roomH / 2), 0, C.START, 'start', 1);
  }

  // Room 1: Ice Maze
  {
    const { x, y } = roomOrigin(1, 0);
    for (let dz = 0; dz < 2; dz++) {
      strokeRect(buf, x - 1, y - 1, roomW + 2, roomH + 2, C.WALL, 'normal', dz);
    }
    createMaze(buf, x, y, roomW, roomH, {
      floorColor: C.ICE,
      wallColor: C.WALL_DARK,
      wallHeight: 2,
      seed: 123,
    });
  }

  // Room 2: Water Crossing
  {
    const { x, y } = roomOrigin(2, 0);
    for (let dz = 0; dz < 2; dz++) {
      strokeRect(buf, x - 1, y - 1, roomW + 2, roomH + 2, C.WALL, 'normal', dz);
    }
    fillRect(buf, x, y, roomW, roomH, C.WATER, 'water', 0);
    const stones = [
      [1, 1], [5, 3], [9, 1], [13, 3],
      [2, 7], [7, 9], [12, 7],
      [1, 12], [6, 14], [11, 12],
    ];
    for (const [sx, sy] of stones) {
      if (sx + x < x + roomW - 1 && sy + y < y + roomH - 1) {
        fillRect(buf, x + sx, y + sy, 2, 2, C.FLOOR, 'normal', 0);
      }
    }
    buf.add(x + 9, y + 2, 1, C.COIN, 'coin');
  }

  // Room 3: Lava Pillars — elevated walkway
  {
    const { x, y } = roomOrigin(0, 1);
    for (let dz = 0; dz < 2; dz++) {
      strokeRect(buf, x - 1, y - 1, roomW + 2, roomH + 2, C.WALL, 'normal', dz);
    }
    fillRect(buf, x, y, roomW, roomH, C.LAVA, 'lava', 0);
    const midY = y + Math.floor(roomH / 2);
    for (let i = 0; i < roomW; i++) {
      buf.add(x + i, midY, 2, C.FLOOR, 'normal');
      buf.add(x + i, midY + 1, 2, C.FLOOR, 'normal');
      if (i % 4 === 0) {
        for (let z = 0; z < 2; z++) {
          buf.add(x + i, midY, z, C.WALL, 'normal');
          buf.add(x + i, midY + 1, z, C.WALL, 'normal');
        }
      }
    }
    buf.set(x, midY, 0, C.RAMP, 'ramp', 1);
    buf.set(x, midY + 1, 0, C.RAMP, 'ramp', 1);
    buf.set(x + 1, midY, 1, C.RAMP, 'ramp', 1);
    buf.set(x + 1, midY + 1, 1, C.RAMP, 'ramp', 1);
  }

  // Room 4: Mixed Gauntlet — alternating strips
  {
    const { x, y } = roomOrigin(1, 1);
    for (let dz = 0; dz < 2; dz++) {
      strokeRect(buf, x - 1, y - 1, roomW + 2, roomH + 2, C.WALL, 'normal', dz);
    }
    const stripTypes = [
      { color: C.FLOOR, type: 'normal' },
      { color: C.LAVA, type: 'lava' },
      { color: C.ICE, type: 'ice' },
      { color: C.WATER, type: 'water' },
    ];
    const stripH = Math.floor(roomH / stripTypes.length);
    for (let s = 0; s < stripTypes.length; s++) {
      fillRect(buf, x, y + s * stripH, roomW, stripH, stripTypes[s].color, stripTypes[s].type, 0);
    }
    // Safe corridor down the middle
    for (let dy = 0; dy < roomH; dy++) {
      buf.set(x + Math.floor(roomW / 2), y + dy, 0, C.FLOOR, 'normal');
      buf.set(x + Math.floor(roomW / 2) + 1, y + dy, 0, C.FLOOR, 'normal');
    }
    buf.add(x + Math.floor(roomW / 2), y + Math.floor(roomH / 2), 1, C.COIN, 'coin');
  }

  // Room 5: Boss Room — lava ring + goal
  {
    const { x, y } = roomOrigin(2, 1);
    for (let dz = 0; dz < 3; dz++) {
      strokeRect(buf, x - 1, y - 1, roomW + 2, roomH + 2, C.WALL, 'normal', dz);
    }
    fillRect(buf, x, y, roomW, roomH, C.FLOOR, 'normal', 0);
    const rcx = x + Math.floor(roomW / 2);
    const rcy = y + Math.floor(roomH / 2);
    for (let dx = -5; dx <= 5; dx++) {
      for (let dy = -5; dy <= 5; dy++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= 3 && dist <= 5) {
          buf.set(rcx + dx, rcy + dy, 0, C.LAVA, 'lava');
        }
      }
    }
    // Safe bridges across
    for (let i = -5; i <= 5; i++) {
      buf.set(rcx + i, rcy, 0, C.FLOOR, 'normal');
      buf.set(rcx, rcy + i, 0, C.FLOOR, 'normal');
    }
    buf.set(rcx, rcy, 0, C.GOAL, 'goal');
    buf.add(x + 2, y + 2, 1, C.COIN, 'coin');
    buf.add(x + roomW - 3, y + 2, 1, C.COIN, 'coin');
    buf.add(x + 2, y + roomH - 3, 1, C.COIN, 'coin');
    buf.add(x + roomW - 3, y + roomH - 3, 1, C.COIN, 'coin');
  }

  // Connect rooms
  connectH(0, 0);
  connectH(1, 0);
  connectV(0, 0);
  connectV(1, 0);
  connectV(2, 0);
  connectH(0, 1);
  connectH(1, 1);

  state.worldBoundary = 60;
});
