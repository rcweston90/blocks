import { registerBuilder } from '../registry.js';
import { wallBorder } from '../primitives.js';
import { C } from '../colors.js';

registerBuilder('figure8', (buf, state) => {
  const loopRadius = 18;
  const trackW = 6;
  const loopOffset = loopRadius;
  const pathCells = new Set();

  // Two circular loops
  const loops = [
    { cx: -loopOffset, cy: 0 },
    { cx: loopOffset, cy: 0 },
  ];

  for (const loop of loops) {
    const steps = 360;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const centerX = Math.round(loop.cx + Math.cos(angle) * loopRadius);
      const centerY = Math.round(loop.cy + Math.sin(angle) * loopRadius);

      for (let dx = -Math.floor(trackW / 2); dx <= Math.floor(trackW / 2); dx++) {
        for (let dy = -Math.floor(trackW / 2); dy <= Math.floor(trackW / 2); dy++) {
          const gx = centerX + dx;
          const gy = centerY + dy;
          if (Math.sqrt(dx * dx + dy * dy) > trackW / 2) continue;
          const key = `${gx},${gy}`;
          if (!pathCells.has(key)) {
            pathCells.add(key);
            buf.add(gx, gy, 0, C.BOOST, 'boost');
          }
        }
      }
    }
  }

  // Ice at the intersection
  const iceRadius = trackW;
  for (let gx = -iceRadius; gx <= iceRadius; gx++) {
    for (let gy = -iceRadius; gy <= iceRadius; gy++) {
      const key = `${gx},${gy}`;
      if (pathCells.has(key)) {
        buf.set(gx, gy, 0, C.ICE, 'ice');
      }
    }
  }

  // Walls
  wallBorder(buf, pathCells, C.WALL);

  // Coins around each loop
  for (const loop of loops) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const gx = Math.round(loop.cx + Math.cos(angle) * loopRadius);
      const gy = Math.round(loop.cy + Math.sin(angle) * loopRadius);
      buf.add(gx, gy, 1, C.COIN, 'coin');
    }
  }

  // Start at left loop top, facing east
  buf.add(-loopOffset, -loopRadius, 0, C.START, 'start', 1);

  // Goal at center
  buf.add(0, 0, 0, C.GOAL, 'goal');

  state.worldBoundary = 40;
});
