import { TILE_WIDTH, TILE_HEIGHT } from './constants.js';

export function gridToScreen(gx, gy, rotation = 0) {
  // Rotate grid coords by angle before isometric projection
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rx = gx * cos - gy * sin;
  const ry = gx * sin + gy * cos;
  return {
    x: (rx - ry) * (TILE_WIDTH / 2),
    y: (rx + ry) * (TILE_HEIGHT / 2),
  };
}

export function screenToGrid(sx, sy, camera) {
  const cx = sx - camera.x;
  const cy = sy - camera.y;
  // Inverse iso projection to get rotated coords
  const rx = (cx / (TILE_WIDTH / 2) + cy / (TILE_HEIGHT / 2)) / 2;
  const ry = (cy / (TILE_HEIGHT / 2) - cx / (TILE_WIDTH / 2)) / 2;
  // Un-rotate by -rotation
  const rotation = camera.rotation || 0;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const gx = rx * cos - ry * sin;
  const gy = rx * sin + ry * cos;
  return { gx: Math.floor(gx), gy: Math.floor(gy) };
}

export function getSortDepth(gx, gy, rotation) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rx = gx * cos - gy * sin;
  const ry = gx * sin + gy * cos;
  return rx + ry;
}

export function rotateDirection(dgx, dgy, rotationIndex) {
  // Rotate a grid direction by rotationIndex * 90 degrees (counterclockwise)
  // so arrow keys stay screen-relative
  const idx = ((rotationIndex % 4) + 4) % 4;
  for (let i = 0; i < idx; i++) {
    // Each 90° CCW rotation: (dgx, dgy) -> (dgy, -dgx)
    const tmp = dgx;
    dgx = dgy;
    dgy = -tmp;
  }
  return { dgx, dgy };
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
