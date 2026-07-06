import { registerBuilder } from '../registry.js';
import { rampStrip } from '../primitives.js';
import { createRampBridge, createIceCorridor, createCoinTrail } from '../compounds.js';
import { C } from '../colors.js';

registerBuilder('raceTrack', (buf, state) => {
  // Smaller oval: outer radii 35x25, centered at (35, 0)
  const cx = 35, cy = 0;
  const outerW = 35, outerH = 25;
  const trackW = 10;
  const innerW = outerW - trackW;
  const innerH = outerH - trackW;

  function isInOval(gx, gy, hw, hh) {
    const dx = gx - cx;
    const dy = gy - cy;
    return (dx * dx) / (hw * hw) + (dy * dy) / (hh * hh) <= 1;
  }

  function isOnTrack(gx, gy) {
    return isInOval(gx, gy, outerW, outerH) && !isInOval(gx, gy, innerW, innerH);
  }

  function isCorner(gx, gy) {
    const dx = Math.abs(gx - cx);
    const dy = Math.abs(gy - cy);
    return dx > innerW * 0.5 && dy > innerH * 0.5;
  }

  for (let gx = cx - outerW - 2; gx <= cx + outerW + 2; gx++) {
    for (let gy = cy - outerH - 2; gy <= cy + outerH + 2; gy++) {
      if (isInOval(gx, gy, outerW + 1, outerH + 1) && !isInOval(gx, gy, outerW, outerH)) {
        buf.add(gx, gy, 0, C.WALL, 'normal');
      }
      if (isInOval(gx, gy, innerW, innerH) && !isInOval(gx, gy, innerW - 1, innerH - 1)) {
        buf.add(gx, gy, 0, C.WALL, 'normal');
      }
      if (isOnTrack(gx, gy)) {
        if (isCorner(gx, gy)) {
          buf.add(gx, gy, 0, C.ICE, 'ice');
        } else {
          buf.add(gx, gy, 0, C.BOOST, 'boost');
        }
      }
    }
  }

  // Ramp bridge across top
  createRampBridge(buf, cx - 8, cy - outerH + trackW + 1, cx + 8, cy - outerH + trackW + 1, {
    width: 3,
    topZ: 2,
  });

  // Ice pit lane on bottom straight
  createIceCorridor(buf, cx - 10, cy + innerH - 1, cx + 10, cy + innerH - 1, {
    width: 3,
    wallHeight: 1,
  });

  // Coins along racing line
  const coinPoints = [];
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI * 2 / 12) {
    const r = 0.7;
    const gx = Math.round(cx + (innerW + trackW * r) * Math.cos(angle));
    const gy = Math.round(cy + (innerH + trackW * r) * Math.sin(angle));
    if (isOnTrack(gx, gy)) {
      coinPoints.push({ x: gx, y: gy });
    }
  }
  createCoinTrail(buf, coinPoints, { spacing: 1 });

  // Start
  buf.add(0, 0, 0, C.START, 'start', 1);

  // Goal
  buf.add(cx + outerW - 5, cy, 0, C.GOAL, 'goal');

  state.worldBoundary = 60;
});
