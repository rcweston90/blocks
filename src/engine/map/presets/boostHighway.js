// Boost Highway: speed lanes with shortcuts and hazards
import { registerBuilder } from '../registry.js';
import { fillRect, strokeRect, fillBox } from '../primitives.js';
import { createBoostHighway, createIceCorridor, createRampBridge, createHazardZone } from '../compounds.js';
import { C } from '../colors.js';

registerBuilder('boostHighway', (buf, state) => {
  const highwayY = 15;
  const highwayLen = 80;

  // Ground base
  fillRect(buf, -3, -3, highwayLen + 6, 55, C.FLOOR, 'normal', 0);

  // Main highway
  createBoostHighway(buf, 0, highwayY, highwayLen, highwayY, { width: 6 });

  // Shortcut 1: Ice tunnel under a wall section at x=15
  fillBox(buf, 14, highwayY - 3, 8, 3, 0, 3, C.WALL);
  createIceCorridor(buf, 12, highwayY - 5, 24, highwayY - 5, { width: 2, wallHeight: 2 });
  fillRect(buf, 12, highwayY - 3, 2, 3, C.FLOOR, 'normal', 0);
  fillRect(buf, 22, highwayY - 3, 2, 3, C.FLOOR, 'normal', 0);

  // Shortcut 2: Ramp bypass
  createRampBridge(buf, 32, highwayY + 8, 50, highwayY + 8, { width: 3, topZ: 2 });
  fillRect(buf, 30, highwayY + 6, 3, 3, C.FLOOR, 'normal', 0);
  fillRect(buf, 48, highwayY + 6, 3, 3, C.FLOOR, 'normal', 0);

  // Shortcut 3: Hazard alley with coins
  {
    const hzY = highwayY + 28;
    fillRect(buf, 50, highwayY + 6, 3, hzY - highwayY - 6, C.FLOOR, 'normal', 0);
    createHazardZone(buf, 53, hzY, 20, 5, { hazardType: 'lava', safeWidth: 2 });
    fillRect(buf, 71, highwayY + 6, 3, hzY - highwayY - 6, C.FLOOR, 'normal', 0);
    for (let i = 0; i < 4; i++) {
      buf.add(55 + i * 5, hzY + 2, 1, C.COIN, 'coin');
    }
  }

  // Obstacles on highway
  fillRect(buf, 22, highwayY + 1, 2, 4, C.LAVA, 'lava', 0);
  fillRect(buf, 38, highwayY + 2, 2, 3, C.LAVA, 'lava', 0);
  fillRect(buf, 55, highwayY + 1, 2, 2, C.WATER, 'water', 0);
  fillBox(buf, 44, highwayY + 1, 2, 3, 0, 2, C.WALL);

  // Coins along highway
  for (let i = 0; i < 8; i++) {
    buf.add(3 + i * 10, highwayY + 3, 1, C.COIN, 'coin');
  }

  // Return highway going back
  const returnY = highwayY + 32;
  createBoostHighway(buf, highwayLen, returnY, 0, returnY, { width: 5 });

  // U-turn connection
  fillRect(buf, highwayLen - 2, highwayY + 6, 4, returnY - highwayY - 6, C.FLOOR, 'normal', 0);
  for (let dy = highwayY + 6; dy < returnY; dy++) {
    buf.set(highwayLen, dy, 0, C.ICE, 'ice');
  }

  // Start
  buf.add(2, highwayY + 3, 0, C.START, 'start', 1);

  // Goal
  buf.add(3, returnY + 2, 0, C.GOAL, 'goal');

  state.worldBoundary = 80;
});
