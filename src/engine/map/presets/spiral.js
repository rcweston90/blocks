import { registerBuilder } from '../registry.js';
import { wallBorder } from '../primitives.js';
import { C } from '../colors.js';

registerBuilder('spiral', (buf, state) => {
  const trackW = 6;
  const cx = 0, cy = 0;
  const maxRadius = 30;
  const turns = 4;
  const totalAngle = turns * Math.PI * 2;
  const steps = 800;

  const pathCells = new Set();

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * totalAngle;
    const radius = maxRadius * (1 - i / steps) + 5;
    const centerX = Math.round(cx + Math.cos(angle) * radius);
    const centerY = Math.round(cy + Math.sin(angle) * radius);

    for (let dx = -Math.floor(trackW / 2); dx <= Math.floor(trackW / 2); dx++) {
      for (let dy = -Math.floor(trackW / 2); dy <= Math.floor(trackW / 2); dy++) {
        const gx = centerX + dx;
        const gy = centerY + dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > trackW / 2) continue;
        const key = `${gx},${gy}`;
        if (!pathCells.has(key)) {
          pathCells.add(key);
          const type = radius < 12 ? 'boost' : 'normal';
          const color = type === 'boost' ? C.BOOST : C.FLOOR;
          buf.add(gx, gy, 0, color, type);
        }
      }
    }

    // Coins along center line
    if (i % 40 === 0 && i > 0) {
      buf.add(centerX, centerY, 1, C.COIN, 'coin');
    }
  }

  // Walls along outer edge
  wallBorder(buf, pathCells, C.WALL);

  // Start at outer edge facing south
  buf.add(maxRadius, 0, 0, C.START, 'start', 2);

  // Goal near center
  buf.add(0, 0, 0, C.GOAL, 'goal');

  state.worldBoundary = 40;
});
