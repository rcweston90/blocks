// Open Explorer: large open world with landmarks
import { registerBuilder } from '../registry.js';
import { fillRect, fillBox, fillEllipse, strokeRect, scatter, seedRandom } from '../primitives.js';
import { createBuilding, createRampBridge } from '../compounds.js';
import { C } from '../colors.js';

registerBuilder('openExplorer', (buf, state) => {
  const size = 80;
  const rng = seedRandom(777);

  // Ground floor
  fillRect(buf, -5, -5, size + 10, size + 10, C.FLOOR, 'normal', 0);

  // Start
  buf.add(3, 3, 0, C.START, 'start', 1);

  // Central Plaza
  const plazaCX = 40, plazaCY = 40;
  fillEllipse(buf, plazaCX, plazaCY, 8, 8, C.BOOST, 'boost', 0);
  fillBox(buf, plazaCX - 1, plazaCY - 1, 3, 3, 0, 3, C.WALL_LIGHT);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    buf.add(Math.round(plazaCX + Math.cos(angle) * 5), Math.round(plazaCY + Math.sin(angle) * 5), 1, C.COIN, 'coin');
  }

  // Mountain (NE)
  const mtX = 60, mtY = 8;
  for (let z = 0; z < 4; z++) {
    const r = 6 - z;
    fillRect(buf, mtX - r, mtY - r, r * 2 + 1, r * 2 + 1, C.WALL_DARK, 'normal', z);
  }
  for (let i = 0; i < 4; i++) {
    for (let w = -1; w <= 1; w++) {
      buf.set(mtX + w, mtY + 6 - i, i, C.RAMP, 'ramp', 0);
    }
  }
  buf.add(mtX, mtY, 4, C.COIN, 'coin');

  // Lake (SW)
  const lkX = 12, lkY = 60;
  fillEllipse(buf, lkX, lkY, 10, 7, C.WATER, 'water', 0);
  fillRect(buf, lkX - 2, lkY - 1, 4, 2, C.FLOOR, 'normal', 0);
  buf.add(lkX, lkY, 1, C.COIN, 'coin');

  // Lava Pit (SE)
  const lpX = 65, lpY = 65;
  fillEllipse(buf, lpX, lpY, 6, 6, C.LAVA, 'lava', 0);
  for (let i = -7; i <= 7; i++) {
    buf.set(lpX + i, lpY, 0, C.FLOOR, 'normal');
    buf.set(lpX, lpY + i, 0, C.FLOOR, 'normal');
  }

  // Village (NW)
  const villages = [
    { x: 5, y: 5, w: 4, h: 4 },
    { x: 12, y: 6, w: 3, h: 5 },
    { x: 5, y: 12, w: 5, h: 3 },
    { x: 13, y: 13, w: 4, h: 4 },
  ];
  for (let i = 0; i < villages.length; i++) {
    const v = villages[i];
    createBuilding(buf, v.x, v.y, v.w, v.h, {
      color: C.BLDG[i % C.BLDG.length],
      height: 2 + (i % 2),
      roofAccess: i === 0,
      roofColor: C.FLOOR,
    });
  }

  // Ice Rink
  const irX = 28, irY = 10;
  fillRect(buf, irX, irY, 14, 10, C.ICE, 'ice', 0);
  strokeRect(buf, irX - 1, irY - 1, 16, 12, C.WALL, 'normal', 0);
  buf.add(irX + 3, irY + 5, 1, C.COIN, 'coin');
  buf.add(irX + 10, irY + 5, 1, C.COIN, 'coin');

  // Boost Track (south)
  fillRect(buf, 15, 72, 45, 5, C.BOOST, 'boost', 0);
  strokeRect(buf, 14, 71, 47, 7, C.WALL, 'normal', 0);
  for (let i = 0; i < 5; i++) {
    buf.add(18 + i * 9, 74, 1, C.COIN, 'coin');
  }

  // Trees
  const treeExclude = new Set();
  for (let dx = -10; dx <= 10; dx++) {
    for (let dy = -10; dy <= 10; dy++) {
      treeExclude.add(`${plazaCX + dx},${plazaCY + dy}`);
      treeExclude.add(`${mtX + dx},${mtY + dy}`);
      treeExclude.add(`${lkX + dx},${lkY + dy}`);
      treeExclude.add(`${lpX + dx},${lpY + dy}`);
    }
  }
  const trees = scatter(buf, 0, 0, size, size, '#557744', 'normal', 20, 0, treeExclude, rng);
  for (const t of trees) {
    buf.add(t.gx, t.gy, 1, '#446633', 'normal');
  }

  // Bridge from plaza toward mountain
  createRampBridge(buf, plazaCX + 8, plazaCY - 5, mtX - 8, mtY + 5, {
    width: 3,
    topZ: 2,
  });

  // Goal
  buf.add(lpX, lpY, 0, C.GOAL, 'goal');

  state.worldBoundary = 80;
});
