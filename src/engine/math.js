import { TILE_WIDTH, TILE_HEIGHT } from './constants.js';

export function gridToScreen(gx, gy) {
  return {
    x: (gx - gy) * (TILE_WIDTH / 2),
    y: (gx + gy) * (TILE_HEIGHT / 2),
  };
}

export function screenToGrid(sx, sy, camera) {
  const cx = sx - camera.x;
  const cy = sy - camera.y;
  const gx = (cx / (TILE_WIDTH / 2) + cy / (TILE_HEIGHT / 2)) / 2;
  const gy = (cy / (TILE_HEIGHT / 2) - cx / (TILE_WIDTH / 2)) / 2;
  return { gx: Math.floor(gx), gy: Math.floor(gy) };
}

export function getDiamondPath(cx, cy) {
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;
  return [
    { x: cx, y: cy - hh },
    { x: cx + hw, y: cy },
    { x: cx, y: cy + hh },
    { x: cx - hw, y: cy },
  ];
}
