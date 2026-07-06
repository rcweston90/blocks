import { registerBuilder } from '../registry.js';
import { fillRect, strokeRect, fillBox } from '../primitives.js';
import { C } from '../colors.js';

registerBuilder('arena', (buf, state) => {
  const arenaSize = 25;

  // Floor
  fillRect(buf, -arenaSize, -arenaSize, arenaSize * 2 + 1, arenaSize * 2 + 1, C.FLOOR, 'normal', 0);

  // Perimeter walls
  strokeRect(buf, -arenaSize - 1, -arenaSize - 1, arenaSize * 2 + 3, arenaSize * 2 + 3, C.WALL, 'normal', 0);

  // Pillars
  const pillars = [
    [-12, -12], [-12, 12], [12, -12], [12, 12],
    [0, -15], [0, 15], [-15, 0], [15, 0],
    [-6, -6], [6, 6], [-6, 6], [6, -6],
    [0, 0],
  ];
  for (const [px, py] of pillars) {
    fillBox(buf, px - 1, py - 1, 3, 3, 0, 3, C.WALL);
  }

  // Boost pads in corners
  const boostPads = [[-18, -18], [-18, 18], [18, -18], [18, 18]];
  for (const [bx, by] of boostPads) {
    fillRect(buf, bx - 2, by - 2, 5, 5, C.BOOST, 'boost', 0);
  }

  // Ramps
  const ramps = [
    { gx: -9, gy: 0, dir: 1 },
    { gx: 9, gy: 0, dir: 3 },
    { gx: 0, gy: -9, dir: 2 },
    { gx: 0, gy: 9, dir: 0 },
  ];
  for (const r of ramps) {
    for (let d = -1; d <= 1; d++) {
      const gx = r.dir % 2 === 0 ? r.gx + d : r.gx;
      const gy = r.dir % 2 === 1 ? r.gy + d : r.gy;
      buf.set(gx, gy, 0, C.RAMP, 'ramp', r.dir);
    }
  }

  // Coins
  const coinPositions = [
    [-16, 0], [16, 0], [0, -16], [0, 16],
    [-9, -9], [9, 9], [-9, 9], [9, -9],
    [-20, -20], [20, 20], [-20, 20], [20, -20],
  ];
  for (const [cx, cy] of coinPositions) {
    buf.add(cx, cy, 1, C.COIN, 'coin');
  }

  // Lava patches
  const lavaPads = [[-14, -14], [14, 14]];
  for (const [lx, ly] of lavaPads) {
    fillRect(buf, lx - 1, ly - 1, 3, 3, C.LAVA, 'lava', 0);
  }

  // Start
  buf.add(-arenaSize + 3, 0, 0, C.START, 'start', 1);

  // Goal
  buf.add(3, 3, 0, C.GOAL, 'goal');

  state.worldBoundary = 40;
});
