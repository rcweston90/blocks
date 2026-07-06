import { registerBuilder } from '../registry.js';
import { fillRect } from '../primitives.js';
import { createBuilding } from '../compounds.js';
import { C } from '../colors.js';

registerBuilder('cityBlocks', (buf, state) => {
  // Smaller city: 4x4 grid, 8x8 buildings, 6-wide streets
  const buildingSize = 8;
  const streetWidth = 6;
  const pitch = buildingSize + streetWidth;
  const gridCount = 4;
  const off = 5;
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
        buf.add(gx, gy, 0, C.BOOST, 'boost');
      }
    }
  }

  // Buildings
  for (let bxi = 0; bxi < gridCount; bxi++) {
    for (let byi = 0; byi < gridCount; byi++) {
      const ox = off + bxi * pitch;
      const oy = off + byi * pitch;
      const height = 2 + ((bxi * 3 + byi * 7) % 3);
      const color = C.BLDG[(bxi + byi * 3) % C.BLDG.length];

      const hasRoof = (bxi + byi) % 3 === 0;
      createBuilding(buf, ox, oy, buildingSize, buildingSize, {
        color,
        height,
        roofAccess: hasRoof,
        roofColor: C.FLOOR,
      });

      // Ramp to rooftop
      if (hasRoof && bxi < gridCount - 1) {
        const rampX = ox + buildingSize;
        const rampY = oy + Math.floor(buildingSize / 2);
        for (let i = 0; i < Math.min(height, 3); i++) {
          buf.add(rampX + i, rampY, i, C.RAMP, 'ramp', 1);
          buf.add(rampX + i, rampY + 1, i, C.RAMP, 'ramp', 1);
        }
      }
    }
  }

  // Lava patches at a few intersections
  const lavaIntersections = [[off + pitch - streetWidth, off + pitch - streetWidth], [off + 2 * pitch - streetWidth, off + 3 * pitch - streetWidth]];
  for (const [ix, iy] of lavaIntersections) {
    for (let dx = 0; dx < streetWidth; dx++) {
      for (let dy = 0; dy < streetWidth; dy++) {
        const gx = ix + dx;
        const gy = iy + dy;
        if (!isBuilding(gx, gy)) {
          buf.set(gx, gy, 0, C.LAVA, 'lava');
        }
      }
    }
  }

  // NE quadrant: ice streets
  const half = Math.floor(totalSize / 2);
  for (let gx = half; gx < totalSize; gx++) {
    for (let gy = 0; gy < half; gy++) {
      if (!isBuilding(gx, gy) && !buf.has(gx, gy, 0)) {
        buf.add(gx, gy, 0, C.ICE, 'ice');
      }
    }
  }

  // Coins along streets
  const coinSpots = [];
  for (let i = 0; i < gridCount; i++) {
    coinSpots.push([off + i * pitch + buildingSize + 3, off + 2]);
    coinSpots.push([off + 2, off + i * pitch + buildingSize + 3]);
  }
  for (const [coinX, coinY] of coinSpots) {
    if (!isBuilding(coinX, coinY)) {
      buf.add(coinX, coinY, 1, C.COIN, 'coin');
    }
  }

  // Start
  buf.add(2, 2, 0, C.START, 'start', 1);

  // Goal at far corner
  buf.add(totalSize - 5, totalSize - 5, 0, C.GOAL, 'goal');

  state.worldBoundary = 60;
});
