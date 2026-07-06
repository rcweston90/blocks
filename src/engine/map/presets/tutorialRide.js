// Tutorial Ride: 8 chambers, each teaching one mechanic
import { registerBuilder } from '../registry.js';
import { fillRect, strokeRect, fillBox, rampStrip } from '../primitives.js';
import { createArena, createHazardZone, createIceCorridor, createRampBridge, createCoinTrail, createBoostHighway } from '../compounds.js';
import { C } from '../colors.js';

registerBuilder('tutorialRide', (buf, state) => {
  // 8 chambers in a 2x4 grid, connected by corridors
  const chamberW = 10;
  const chamberH = 10;
  const corridorW = 4;
  const corridorLen = 4;
  const pitch = chamberW + corridorLen;

  function chamberOrigin(col, row) {
    return { x: col * pitch, y: row * pitch };
  }

  function connectH(x1, y1) {
    const sx = x1 + chamberW;
    const sy = y1 + Math.floor(chamberH / 2) - Math.floor(corridorW / 2);
    fillRect(buf, sx, sy, corridorLen, corridorW, C.FLOOR, 'normal', 0);
  }

  function connectV(x1, y1) {
    const sx = x1 + Math.floor(chamberW / 2) - Math.floor(corridorW / 2);
    const sy = y1 + chamberH;
    fillRect(buf, sx, sy, corridorW, corridorLen, C.FLOOR, 'normal', 0);
  }

  // Row 0: [0] Movement → [1] Boost → [2] Ice → [3] Coins
  // Row 1: [4] Ramps → [5] Lava → [6] Water → [7] Goal
  const chambers = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      chambers.push(chamberOrigin(col, row));
    }
  }

  // Build all chambers
  for (const { x, y } of chambers) {
    createArena(buf, x + Math.floor(chamberW / 2), y + Math.floor(chamberH / 2), chamberW, chamberH, {
      floorColor: C.FLOOR,
      wallHeight: 2,
    });
  }

  // Connect horizontally in each row
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const i = row * 4 + col;
      connectH(chambers[i].x, chambers[i].y);
    }
  }

  // Connect rows vertically at column 3
  connectV(chambers[3].x, chambers[3].y);

  // Chamber 0: Movement basics — start here
  buf.add(chambers[0].x + 2, chambers[0].y + Math.floor(chamberH / 2), 0, C.START, 'start', 1);

  // Chamber 1: Boost pads
  {
    const { x, y } = chambers[1];
    fillRect(buf, x + 2, y + 2, 6, 6, C.BOOST, 'boost', 0);
  }

  // Chamber 2: Ice
  {
    const { x, y } = chambers[2];
    fillRect(buf, x + 1, y + 1, 8, 8, C.ICE, 'ice', 0);
  }

  // Chamber 3: Coins
  {
    const { x, y } = chambers[3];
    for (let i = 0; i < 4; i++) {
      buf.add(x + 2 + i * 2, y + Math.floor(chamberH / 2), 1, C.COIN, 'coin');
    }
  }

  // Chamber 4: Ramps
  {
    const { x, y } = chambers[4];
    for (let i = 0; i < 3; i++) {
      for (let w = 0; w < 3; w++) {
        buf.set(x + 4 + w, y + 2 + i, i, C.RAMP, 'ramp', 2);
      }
    }
    fillRect(buf, x + 3, y + 5, 5, 3, C.FLOOR, 'normal', 2);
    for (let z = 0; z < 2; z++) {
      buf.add(x + 3, y + 5, z, C.WALL, 'normal');
      buf.add(x + 7, y + 5, z, C.WALL, 'normal');
      buf.add(x + 3, y + 7, z, C.WALL, 'normal');
      buf.add(x + 7, y + 7, z, C.WALL, 'normal');
    }
  }

  // Chamber 5: Lava hazard
  {
    const { x, y } = chambers[5];
    createHazardZone(buf, x + 1, y + 1, 8, 8, {
      hazardType: 'lava',
      hazardColor: C.LAVA,
      safeWidth: 2,
    });
  }

  // Chamber 6: Water hazard
  {
    const { x, y } = chambers[6];
    createHazardZone(buf, x + 1, y + 1, 8, 8, {
      hazardType: 'water',
      hazardColor: C.WATER,
      safeWidth: 2,
    });
  }

  // Chamber 7: Goal
  {
    const { x, y } = chambers[7];
    buf.add(x + Math.floor(chamberW / 2), y + Math.floor(chamberH / 2), 0, C.GOAL, 'goal');
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const gx = Math.round(x + chamberW / 2 + Math.cos(angle) * 3);
      const gy = Math.round(y + chamberH / 2 + Math.sin(angle) * 3);
      buf.add(gx, gy, 1, C.COIN, 'coin');
    }
  }

  state.worldBoundary = 40;
});
