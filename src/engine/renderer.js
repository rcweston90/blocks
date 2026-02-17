import { TILE_WIDTH, TILE_HEIGHT, BLOCK_HEIGHT, FLOOR_HEIGHT, GRID_EXTENT, DEFAULT_BOUNDARY, RAMP_DIRS } from './constants.js';
import { gridToScreen, screenToGrid, getDiamondPath, getSortDepth } from './math.js';
import { getBlockFaces, hexToRgb } from './colors.js';
import { getBlockType } from './blockTypes.js';
import { ParticleSystem } from './particles.js';
import { THEMES } from './themes.js';

export class Renderer {
  constructor(canvas, state, fpsTracker) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.fpsTracker = fpsTracker;
    this.bike = null;
    this.theme = THEMES.light;
    this.particles = new ParticleSystem();
    this._rotation = 0;

    // Track score changes for coin particles
    this._lastBikeScore = 0;
    this._lastBikeAlive = true;

    // Crash flash/chromatic aberration tracking
    this._crashDetected = false;
    this._crashFlashStart = 0;

    // Boost zoom tracking
    this._wasBoosted = false;
    this._boostZoom = 1.0;
  }

  clear() {
    const ctx = this.ctx;
    const theme = this.theme;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (theme.gradient) {
      const grad = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      for (const [stop, color] of theme.gradient.stops) {
        grad.addColorStop(stop, color);
      }
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = theme.background;
    }
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGrid() {
    const ctx = this.ctx;
    const cam = this.state.camera;
    const theme = this.theme;
    const rot = this._rotation;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const corners = [
      screenToGrid(0, 0, cam),
      screenToGrid(w, 0, cam),
      screenToGrid(0, h, cam),
      screenToGrid(w, h, cam),
    ];
    const minG = -GRID_EXTENT, maxG = GRID_EXTENT;
    const allGx = corners.map(c => c.gx);
    const allGy = corners.map(c => c.gy);
    const gxMin = Math.max(Math.min(...allGx) - 2, minG);
    const gxMax = Math.min(Math.max(...allGx) + 2, maxG);
    const gyMin = Math.max(Math.min(...allGy) - 2, minG);
    const gyMax = Math.min(Math.max(...allGy) + 2, maxG);

    // Compute bike screen position for reactive grid glow
    let bikeScreenX = 0, bikeScreenY = 0;
    const useReactiveGlow = this.bike && this.bike.alive && theme.gridGlow;
    if (useReactiveGlow) {
      const vis = this.bike.getVisualPosition(performance.now());
      const bs = gridToScreen(vis.gx, vis.gy, rot);
      bikeScreenX = bs.x + cam.x;
      bikeScreenY = bs.y + cam.y;
    }

    ctx.lineWidth = theme.gridLineWidth;
    if (theme.gridGlow && !useReactiveGlow) {
      ctx.shadowColor = theme.gridGlow;
      ctx.shadowBlur = 2;
    }

    for (let gx = gxMin; gx <= gxMax + 1; gx++) {
      const from = gridToScreen(gx - 0.5, gyMin - 0.5, rot);
      const to = gridToScreen(gx - 0.5, gyMax + 0.5, rot);
      const fromX = from.x + cam.x, fromY = from.y + cam.y;
      const toX = to.x + cam.x, toY = to.y + cam.y;

      if (useReactiveGlow) {
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;
        const dist = Math.sqrt((midX - bikeScreenX) ** 2 + (midY - bikeScreenY) ** 2);
        if (dist < 120) {
          const boost = 0.35 * (1 - dist / 120);
          ctx.strokeStyle = theme.gridGlow;
          ctx.globalAlpha = Math.min(1, 0.15 + boost);
          ctx.shadowColor = theme.gridGlow;
          ctx.shadowBlur = 4;
        } else {
          ctx.strokeStyle = theme.gridColor;
          ctx.globalAlpha = 1;
          ctx.shadowColor = theme.gridGlow;
          ctx.shadowBlur = 2;
        }
      } else {
        ctx.strokeStyle = theme.gridColor;
      }

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    }

    for (let gy = gyMin; gy <= gyMax + 1; gy++) {
      const from = gridToScreen(gxMin - 0.5, gy - 0.5, rot);
      const to = gridToScreen(gxMax + 0.5, gy - 0.5, rot);
      const fromX = from.x + cam.x, fromY = from.y + cam.y;
      const toX = to.x + cam.x, toY = to.y + cam.y;

      if (useReactiveGlow) {
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;
        const dist = Math.sqrt((midX - bikeScreenX) ** 2 + (midY - bikeScreenY) ** 2);
        if (dist < 120) {
          const boost = 0.35 * (1 - dist / 120);
          ctx.strokeStyle = theme.gridGlow;
          ctx.globalAlpha = Math.min(1, 0.15 + boost);
          ctx.shadowColor = theme.gridGlow;
          ctx.shadowBlur = 4;
        } else {
          ctx.strokeStyle = theme.gridColor;
          ctx.globalAlpha = 1;
          ctx.shadowColor = theme.gridGlow;
          ctx.shadowBlur = 2;
        }
      } else {
        ctx.strokeStyle = theme.gridColor;
      }

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  drawWarningZone() {
    const ctx = this.ctx;
    const cam = this.state.camera;
    const rot = this._rotation;
    const boundary = this.state.worldBoundary || DEFAULT_BOUNDARY;
    const warningDist = 5;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const corners = [
      screenToGrid(0, 0, cam),
      screenToGrid(w, 0, cam),
      screenToGrid(0, h, cam),
      screenToGrid(w, h, cam),
    ];
    const allGx = corners.map(c => c.gx);
    const allGy = corners.map(c => c.gy);
    const gxMin = Math.max(Math.min(...allGx) - 1, -boundary - 1);
    const gxMax = Math.min(Math.max(...allGx) + 1, boundary + 1);
    const gyMin = Math.max(Math.min(...allGy) - 1, -boundary - 1);
    const gyMax = Math.min(Math.max(...allGy) + 1, boundary + 1);

    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    for (let gx = gxMin; gx <= gxMax; gx++) {
      for (let gy = gyMin; gy <= gyMax; gy++) {
        const distFromEdge = Math.min(
          boundary - Math.abs(gx),
          boundary - Math.abs(gy)
        );
        if (distFromEdge >= warningDist || distFromEdge < -1) continue;

        const opacity = distFromEdge < 0
          ? 0.25
          : (1 - distFromEdge / warningDist) * 0.15;
        if (opacity <= 0) continue;

        const s = gridToScreen(gx, gy, rot);
        const cx = s.x + cam.x;
        const cy = s.y + cam.y;

        ctx.globalAlpha = opacity;
        ctx.fillStyle = '#ff2222';
        ctx.beginPath();
        ctx.moveTo(cx, cy - hh);
        ctx.lineTo(cx + hw, cy);
        ctx.lineTo(cx, cy + hh);
        ctx.lineTo(cx - hw, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawDiamond(cx, cy, fillStyle, strokeStyle, lineWidth) {
    const ctx = this.ctx;
    const pts = getDiamondPath(cx, cy);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
    if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = lineWidth || 1; ctx.stroke(); }
  }

  drawRectangleFill(rect) {
    const cam = this.state.camera;
    const rot = this._rotation;
    for (let gx = rect.x1; gx <= rect.x2; gx++) {
      for (let gy = rect.y1; gy <= rect.y2; gy++) {
        const s = gridToScreen(gx, gy, rot);
        const cx = s.x + cam.x;
        const cy = s.y + cam.y;
        this.drawDiamond(cx, cy, 'rgba(80, 180, 160, 0.35)', null, 0);
      }
    }
  }

  drawBlock(gx, gy, z, color, type, now, block) {
    const ctx = this.ctx;
    const cam = this.state.camera;
    const theme = this.theme;
    const s = gridToScreen(gx, gy, this._rotation);
    const cx = s.x + cam.x;
    const cy = s.y + cam.y;
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;
    const zOff = z * BLOCK_HEIGHT;
    const faces = getBlockFaces(color);
    const isWireframe = theme.wireframe;
    const stroke = theme.blockStroke;
    const bt = getBlockType(type);

    // Coin: draw as floating diamond instead of block
    if (type === 'coin') {
      this._drawCoin(cx, cy, zOff, now);
      return;
    }

    // Floor tiles use thin height, walls use full height
    const bh = bt.isFloor ? FLOOR_HEIGHT : BLOCK_HEIGHT;

    // Lava: flickering brightness
    let lavaAlpha = 1;
    if (type === 'lava' && now) {
      lavaAlpha = 0.7 + 0.3 * Math.sin(now * 0.005);
    }

    if (type === 'lava') ctx.globalAlpha = lavaAlpha;

    // Top face
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh - bh - zOff);
    ctx.lineTo(cx + hw, cy - bh - zOff);
    ctx.lineTo(cx, cy + hh - bh - zOff);
    ctx.lineTo(cx - hw, cy - bh - zOff);
    ctx.closePath();
    if (!isWireframe) {
      ctx.fillStyle = faces.top;
      ctx.fill();
    }
    ctx.strokeStyle = isWireframe ? theme.blockStroke : stroke;
    ctx.lineWidth = isWireframe ? 1 : 1.5;
    ctx.stroke();

    // Left face
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy - bh - zOff);
    ctx.lineTo(cx, cy + hh - bh - zOff);
    ctx.lineTo(cx, cy + hh - zOff);
    ctx.lineTo(cx - hw, cy - zOff);
    ctx.closePath();
    if (!isWireframe) {
      ctx.fillStyle = faces.left;
      ctx.fill();
    }
    ctx.strokeStyle = isWireframe ? theme.blockStroke : stroke;
    ctx.lineWidth = isWireframe ? 1 : 1.5;
    ctx.stroke();

    // Right face
    ctx.beginPath();
    ctx.moveTo(cx + hw, cy - bh - zOff);
    ctx.lineTo(cx, cy + hh - bh - zOff);
    ctx.lineTo(cx, cy + hh - zOff);
    ctx.lineTo(cx + hw, cy - zOff);
    ctx.closePath();
    if (!isWireframe) {
      ctx.fillStyle = faces.right;
      ctx.fill();
    }
    ctx.strokeStyle = isWireframe ? theme.blockStroke : stroke;
    ctx.lineWidth = isWireframe ? 1 : 1.5;
    ctx.stroke();

    if (type === 'lava') ctx.globalAlpha = 1;

    // Type-specific overlays on top face
    if (!isWireframe) {
      this._drawBlockOverlay(ctx, cx, cy, hw, hh, bh, zOff, type, now, block);
    }
  }

  _drawBlockOverlay(ctx, cx, cy, hw, hh, bh, zOff, type, now, block) {
    const topCy = cy - bh - zOff;

    switch (type) {
      case 'boost': {
        // Chevron arrows on top face
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        const pulse = now ? 0.6 + 0.4 * Math.sin(now * 0.004) : 1;
        ctx.globalAlpha = pulse;
        // Draw two chevrons
        for (let i = -1; i <= 1; i += 2) {
          const ox = i * hw * 0.25;
          ctx.beginPath();
          ctx.moveTo(cx + ox - 4, topCy + 3);
          ctx.lineTo(cx + ox, topCy - 3);
          ctx.lineTo(cx + ox + 4, topCy + 3);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }

      case 'ice': {
        // Crystalline X pattern
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        const r = hh * 0.5;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.7, topCy - r * 0.5);
        ctx.lineTo(cx + r * 0.7, topCy + r * 0.5);
        ctx.moveTo(cx + r * 0.7, topCy - r * 0.5);
        ctx.lineTo(cx - r * 0.7, topCy + r * 0.5);
        ctx.stroke();
        break;
      }

      case 'ramp': {
        // Directional triangle rotated by ramp dir + camera rotation
        const rampDirIdx = (block && block.dir) || 0;
        const rampDir = RAMP_DIRS[rampDirIdx];
        const rot = this._rotation;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        // Rotate grid direction by camera, then iso-project
        const rgx = rampDir.dgx * cosR - rampDir.dgy * sinR;
        const rgy = rampDir.dgx * sinR + rampDir.dgy * cosR;
        const sdx = (rgx - rgy) * (TILE_WIDTH / 2);
        const sdy = (rgx + rgy) * (TILE_HEIGHT / 2);
        const angle = Math.atan2(sdy, sdx);
        // Draw rotated triangle
        const triSize = Math.min(hw, hh) * 0.45;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(
          cx + Math.cos(angle) * triSize,
          topCy + Math.sin(angle) * triSize
        );
        const perpAngle = angle + Math.PI / 2;
        const baseOffset = triSize * 0.6;
        const backOffset = triSize * 0.7;
        ctx.lineTo(
          cx - Math.cos(angle) * backOffset + Math.cos(perpAngle) * baseOffset,
          topCy - Math.sin(angle) * backOffset + Math.sin(perpAngle) * baseOffset
        );
        ctx.lineTo(
          cx - Math.cos(angle) * backOffset - Math.cos(perpAngle) * baseOffset,
          topCy - Math.sin(angle) * backOffset - Math.sin(perpAngle) * baseOffset
        );
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'water': {
        // Animated wavy lines on top face
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        const waveT = now ? now * 0.003 : 0;
        for (let i = -1; i <= 1; i++) {
          const oy = i * hh * 0.3;
          ctx.beginPath();
          for (let dx = -hw * 0.6; dx <= hw * 0.6; dx += 2) {
            const wy = Math.sin(dx * 0.3 + waveT + i) * 2;
            if (dx === -hw * 0.6) {
              ctx.moveTo(cx + dx, topCy + oy + wy);
            } else {
              ctx.lineTo(cx + dx, topCy + oy + wy);
            }
          }
          ctx.stroke();
        }
        break;
      }

      case 'goal': {
        // Checkered pattern on top face (simplified)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        const gs = 4;
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if ((dx + dy) % 2 === 0) continue;
            ctx.fillRect(cx + dx * gs - gs / 2, topCy + dy * gs - gs / 2, gs, gs);
          }
        }
        break;
      }
    }
  }

  _drawCoin(cx, cy, zOff, now) {
    const ctx = this.ctx;
    const theme = this.theme;
    // Floating golden diamond at half block height, rotating
    const floatY = cy - BLOCK_HEIGHT * 0.5 - zOff;
    const bob = now ? Math.sin(now * 0.003) * 3 : 0;
    const rotation = now ? now * 0.002 : 0;
    const scaleX = Math.cos(rotation);
    const size = 8;

    if (theme.gridGlow || theme.trailGlow) {
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur = 8;
    }

    ctx.fillStyle = '#ffdd00';
    ctx.beginPath();
    ctx.moveTo(cx, floatY - size + bob);
    ctx.lineTo(cx + size * 0.6 * Math.abs(scaleX), floatY + bob);
    ctx.lineTo(cx, floatY + size + bob);
    ctx.lineTo(cx - size * 0.6 * Math.abs(scaleX), floatY + bob);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#cc9900';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  drawBlocks(now) {
    const rot = this._rotation;
    const sorted = [...this.state.blocks].sort((a, b) => {
      const d = getSortDepth(a.gx, a.gy, rot) - getSortDepth(b.gx, b.gy, rot);
      return d !== 0 ? d : a.z - b.z;
    });
    for (const block of sorted) {
      this.drawBlock(block.gx, block.gy, block.z, block.color, block.type || 'normal', now, block);
    }
  }

  drawRectangles() {
    for (const rect of this.state.rectangles) {
      this.drawRectangleFill(rect);
    }
  }

  drawRectPreview() {
    const ds = this.state.dragState;
    if (!ds || (this.state.activeTool !== 'drawRect' && this.state.activeTool !== 'fill')) return;
    const rect = {
      x1: Math.min(ds.anchor.gx, ds.current.gx),
      y1: Math.min(ds.anchor.gy, ds.current.gy),
      x2: Math.max(ds.anchor.gx, ds.current.gx),
      y2: Math.max(ds.anchor.gy, ds.current.gy),
    };
    this.drawRectangleFill(rect);
  }

  drawMovePreview() {
    const ds = this.state.dragState;
    const sel = this.state.selection;
    if (!ds || ds.mode !== 'move' || !ds.confirmed || !sel) return;

    const deltaGx = ds.currentCell.gx - ds.startCell.gx;
    const deltaGy = ds.currentCell.gy - ds.startCell.gy;
    if (deltaGx === 0 && deltaGy === 0) return;

    const ctx = this.ctx;
    ctx.globalAlpha = 0.5;

    if (sel.type === 'block') {
      const block = this.state.blocks[sel.index];
      if (block) {
        this.drawBlock(block.gx + deltaGx, block.gy + deltaGy, block.z, block.color, block.type || 'normal', performance.now());
      }
    } else if (sel.type === 'rect') {
      const rect = this.state.rectangles[sel.index];
      if (rect) {
        this.drawRectangleFill({
          x1: rect.x1 + deltaGx,
          y1: rect.y1 + deltaGy,
          x2: rect.x2 + deltaGx,
          y2: rect.y2 + deltaGy,
        });
      }
    }

    ctx.globalAlpha = 1.0;
  }

  drawHover() {
    const cell = this.state.hoverCell;
    if (!cell) return;
    const cam = this.state.camera;
    const s = gridToScreen(cell.gx, cell.gy, this._rotation);
    const cx = s.x + cam.x;

    // Offset hover diamond to sit on top of the highest block
    const topBlock = this.state.getBlockAt(cell.gx, cell.gy);
    let zOff = 0;
    if (topBlock) {
      const bt = getBlockType(topBlock.type || 'normal');
      const bh = bt.isFloor ? FLOOR_HEIGHT : BLOCK_HEIGHT;
      zOff = topBlock.z * BLOCK_HEIGHT + bh;
    }
    const cy = s.y + cam.y - zOff;

    this.drawDiamond(cx, cy, 'rgba(100, 170, 255, 0.3)', 'rgba(100, 170, 255, 0.6)', 1);
  }

  drawSelection() {
    const sel = this.state.selection;
    if (!sel) return;

    const ctx = this.ctx;
    const cam = this.state.camera;
    ctx.strokeStyle = '#d00';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);

    if (sel.type === 'block') {
      const block = this.state.blocks[sel.index];
      if (!block) { this.state.selection = null; return; }
      const s = gridToScreen(block.gx, block.gy, this._rotation);
      const cx = s.x + cam.x;
      const cy = s.y + cam.y;
      const hw = TILE_WIDTH / 2;
      const hh = TILE_HEIGHT / 2;
      const zOff = block.z * BLOCK_HEIGHT;

      ctx.beginPath();
      ctx.moveTo(cx, cy - hh - BLOCK_HEIGHT - zOff);
      ctx.lineTo(cx + hw, cy - BLOCK_HEIGHT - zOff);
      ctx.lineTo(cx + hw, cy - zOff);
      ctx.lineTo(cx, cy + hh - zOff);
      ctx.lineTo(cx - hw, cy - zOff);
      ctx.lineTo(cx - hw, cy - BLOCK_HEIGHT - zOff);
      ctx.closePath();
      ctx.stroke();
    } else if (sel.type === 'rect') {
      const rect = this.state.rectangles[sel.index];
      if (!rect) { this.state.selection = null; return; }

      const rot = this._rotation;
      const s1 = gridToScreen(rect.x1, rect.y1, rot);
      const s2 = gridToScreen(rect.x2, rect.y1, rot);
      const s3 = gridToScreen(rect.x2, rect.y2, rot);
      const s4 = gridToScreen(rect.x1, rect.y2, rot);

      const hw = TILE_WIDTH / 2;
      const hh = TILE_HEIGHT / 2;

      ctx.beginPath();
      ctx.moveTo(s1.x + cam.x, s1.y + cam.y - hh);
      ctx.lineTo(s2.x + cam.x + hw, s2.y + cam.y);
      ctx.lineTo(s3.x + cam.x, s3.y + cam.y + hh);
      ctx.lineTo(s4.x + cam.x - hw, s4.y + cam.y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  drawTrail(bike, now) {
    if (this.theme.trailGlow) {
      this._drawTrailWalls(bike, now);
    } else {
      this._drawTrailDiamonds(bike, now);
    }
  }

  _drawTrailDiamonds(bike, now) {
    const ctx = this.ctx;
    const cam = this.state.camera;

    for (const entry of bike.trail) {
      const age = now - entry.time;
      const opacity = bike.ghostTrail ? 1.0 : (1 - (age / 3000));
      if (opacity <= 0) continue;

      const s = gridToScreen(entry.gx, entry.gy, this._rotation);
      const cx = s.x + cam.x;
      const trailZ = (entry.z || 0) * BLOCK_HEIGHT;
      const cy = s.y + cam.y - trailZ;

      ctx.globalAlpha = opacity;
      const trailColor = bike.trailColor || '#00fff2';
      this.drawDiamond(cx, cy, trailColor, trailColor, 1);
    }

    ctx.globalAlpha = 1.0;
  }

  _drawTrailWalls(bike, now) {
    const ctx = this.ctx;
    const cam = this.state.camera;
    const trailColor = bike.trailColor || '#00fff2';
    const [tr, tg, tb] = hexToRgb(trailColor);

    const trail = bike.trail;
    if (trail.length === 0) return;

    for (let i = 0; i < trail.length; i++) {
      const entry = trail[i];
      const age = now - entry.time;
      const opacity = bike.ghostTrail ? 1.0 : (1 - (age / 3000));
      if (opacity <= 0) continue;

      const s = gridToScreen(entry.gx, entry.gy, this._rotation);
      const cx = s.x + cam.x;
      const trailZ = (entry.z || 0) * BLOCK_HEIGHT;
      const cy = s.y + cam.y - trailZ;

      // Vertical gradient wall face
      const wallH = 10;
      const grad = ctx.createLinearGradient(cx, cy - wallH, cx, cy);
      grad.addColorStop(0, `rgba(${tr}, ${tg}, ${tb}, 0)`);
      grad.addColorStop(1, `rgba(${tr}, ${tg}, ${tb}, ${opacity * 0.7})`);
      ctx.fillStyle = grad;

      const hw = TILE_WIDTH / 2 * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy - wallH);
      ctx.lineTo(cx + hw, cy - wallH);
      ctx.lineTo(cx + hw, cy);
      ctx.lineTo(cx - hw, cy);
      ctx.closePath();
      ctx.fill();

      // Outer glow stroke
      ctx.globalAlpha = opacity * 0.3;
      ctx.strokeStyle = trailColor;
      ctx.lineWidth = 4;
      ctx.shadowColor = trailColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy);
      ctx.lineTo(cx + hw, cy);
      ctx.stroke();

      // Inner bright white core
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy);
      ctx.lineTo(cx + hw, cy);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Traveling energy pulse
    if (trail.length > 1) {
      const pulseT = (Math.sin(now * 0.003) * 0.5 + 0.5);
      const pulseIdx = Math.floor(pulseT * (trail.length - 1));
      const entry = trail[Math.min(pulseIdx, trail.length - 1)];
      const age = now - entry.time;
      const opacity = bike.ghostTrail ? 1.0 : (1 - (age / 3000));
      if (opacity > 0) {
        const ps = gridToScreen(entry.gx, entry.gy, this._rotation);
        const px = ps.x + cam.x;
        const py = ps.y + cam.y - (entry.z || 0) * BLOCK_HEIGHT;
        ctx.globalAlpha = opacity;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    ctx.globalAlpha = 1.0;
  }

  _drawAfterimages(bike, now) {
    if (!bike.posHistory || bike.posHistory.length === 0) return;
    const ctx = this.ctx;
    const cam = this.state.camera;
    const trailColor = bike.trailColor || '#00fff2';
    const isBoosted = bike.isBoosted;

    const len = bike.posHistory.length;
    for (let i = 0; i < len; i++) {
      const pos = bike.posHistory[i];
      const s = gridToScreen(pos.gx, pos.gy, this._rotation);
      const cx = s.x + cam.x;
      const cy = s.y + cam.y - (pos.z || 0) * BLOCK_HEIGHT;

      const t = (i + 1) / (len + 1);
      let alpha = 0.05 + t * 0.2;
      if (isBoosted) alpha *= 2.5;
      alpha = Math.min(alpha, 0.6);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = isBoosted ? '#ff8800' : trailColor;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawEnergyAura(bike, now) {
    if (!this.theme.trailGlow || !bike.alive) return;
    const ctx = this.ctx;
    const cam = this.state.camera;

    const vis = bike.getVisualPosition(now);
    const s = gridToScreen(vis.gx, vis.gy, this._rotation);
    const cx = s.x + cam.x;
    const cy = s.y + cam.y - (vis.z || 0) * BLOCK_HEIGHT;

    const radius = 14 + Math.sin(now * 0.006) * 3;
    const trailColor = bike.trailColor || '#00fff2';
    const [r, g, b] = hexToRgb(trailColor);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.25)`);
    grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.1)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  _drawHeadlightCone(bike, now) {
    if (!this.theme.trailGlow || !bike.alive) return;
    const ctx = this.ctx;
    const cam = this.state.camera;

    const vis = bike.getVisualPosition(now);
    const s = gridToScreen(vis.gx, vis.gy, this._rotation);
    const cx = s.x + cam.x;
    const cy = s.y + cam.y - (vis.z || 0) * BLOCK_HEIGHT;

    const dir = bike.direction;
    const fwdScreen = gridToScreen(dir.dgx, dir.dgy, this._rotation);
    const fwdLen = Math.sqrt(fwdScreen.x ** 2 + fwdScreen.y ** 2) || 1;
    const fx = fwdScreen.x / fwdLen;
    const fy = fwdScreen.y / fwdLen;

    const dist = 90;
    const targetX = cx + fx * dist;
    const targetY = cy + fy * dist;

    const grad = ctx.createRadialGradient(cx, cy, 0, targetX, targetY, dist * 0.6);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(0.5, 'rgba(255, 255, 200, 0.06)');
    grad.addColorStop(1, 'rgba(255, 255, 200, 0)');

    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx + fx * dist * 0.4, cy + fy * dist * 0.4, dist * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  drawBike(bike, now) {
    const ctx = this.ctx;
    const cam = this.state.camera;
    const theme = this.theme;

    // Flash effect on crash
    if (now < bike.flashUntil) {
      const flashPhase = Math.floor((now - (bike.flashUntil - 300)) / 60) % 2;
      if (flashPhase === 1) return;
    }

    const vis = bike.getVisualPosition(now);
    const s = gridToScreen(vis.gx, vis.gy, this._rotation);
    const cx = s.x + cam.x;
    const elevOff = (vis.z || 0) * BLOCK_HEIGHT;
    let cy = s.y + cam.y - elevOff;

    // Ground shadow when elevated or jumping
    if (elevOff > 0) {
      const groundCy = s.y + cam.y;
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#000';
      const shadowScale = Math.max(0.3, 1 - elevOff / (BLOCK_HEIGHT * 6));
      const sw = TILE_WIDTH * 0.22 * shadowScale;
      const sh = TILE_HEIGHT * 0.16 * shadowScale;
      ctx.beginPath();
      ctx.ellipse(cx, groundCy, sw, sh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const jumpZ = bike.getJumpZ(now);
    if (jumpZ > 0) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#000';
      const shadowScale = 1 - jumpZ / (BLOCK_HEIGHT * 4);
      const sw = TILE_WIDTH * 0.22 * shadowScale;
      const sh = TILE_HEIGHT * 0.16 * shadowScale;
      ctx.beginPath();
      ctx.ellipse(cx, cy, sw, sh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      cy -= jumpZ;
    }

    // Invincible pulse
    if (bike.invincible) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 250);
    }

    // Glow effect
    if (theme.trailGlow) {
      ctx.shadowColor = theme.bikeColor;
      ctx.shadowBlur = 18;
    }

    // --- Compute isometric direction vectors ---
    const dir = bike.direction;
    // Forward vector in screen space (iso projection of grid direction with rotation)
    const fwdScreen = gridToScreen(dir.dgx, dir.dgy, this._rotation);
    const fwdX = fwdScreen.x;
    const fwdY = fwdScreen.y;
    const fwdLen = Math.sqrt(fwdX * fwdX + fwdY * fwdY) || 1;
    const fx = fwdX / fwdLen;  // unit forward
    const fy = fwdY / fwdLen;
    const rx = -fy;  // unit right (perpendicular)
    const ry = fx;

    // Scale factors
    const sc = 0.55;
    const lean = bike.lean * 2.5;  // lean offset in pixels

    // Wheel animation
    const wheelSpin = now * 0.012;
    const isBoosted = bike.isBoosted;
    const wheelSpinSpeed = isBoosted ? now * 0.025 : wheelSpin;

    // --- Rear wheel ---
    const rwX = cx - fx * 12 * sc + rx * lean * 0.3;
    const rwY = cy - fy * 12 * sc + ry * lean * 0.3;
    this._drawWheel(ctx, rwX, rwY, 5 * sc, 3 * sc, wheelSpinSpeed, theme);

    // --- Front wheel ---
    const fwX = cx + fx * 12 * sc + rx * lean * 0.3;
    const fwY = cy + fy * 12 * sc + ry * lean * 0.3;
    this._drawWheel(ctx, fwX, fwY, 5 * sc, 3 * sc, wheelSpinSpeed, theme);

    // --- Frame (curved line connecting wheels) ---
    const frameMidX = cx + rx * (-3 + lean) * sc;
    const frameMidY = cy + ry * (-3 + lean) * sc - 4 * sc;
    ctx.beginPath();
    ctx.moveTo(rwX, rwY);
    ctx.quadraticCurveTo(frameMidX, frameMidY, fwX, fwY);
    ctx.strokeStyle = theme.bikeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // --- Seat (small bar on frame) ---
    const seatX = cx - fx * 2 * sc + rx * lean * 0.3;
    const seatY = cy - fy * 2 * sc + ry * lean * 0.3 - 6 * sc;
    ctx.beginPath();
    ctx.moveTo(seatX - rx * 3 * sc, seatY - ry * 3 * sc);
    ctx.lineTo(seatX + rx * 3 * sc, seatY + ry * 3 * sc);
    ctx.strokeStyle = theme.bikeStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Handlebars ---
    const hbX = cx + fx * 8 * sc + rx * lean * 0.3;
    const hbY = cy + fy * 8 * sc + ry * lean * 0.3 - 5 * sc;
    ctx.beginPath();
    ctx.moveTo(hbX - rx * 4 * sc, hbY - ry * 4 * sc);
    ctx.lineTo(hbX + rx * 4 * sc, hbY + ry * 4 * sc);
    ctx.strokeStyle = theme.bikeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Rider body ---
    const riderBaseX = seatX;
    const riderBaseY = seatY;
    // Torso (leaning forward)
    const torsoTopX = riderBaseX + fx * 3 * sc + rx * lean * 0.5;
    const torsoTopY = riderBaseY + fy * 3 * sc + ry * lean * 0.5 - 8 * sc;
    ctx.beginPath();
    ctx.moveTo(riderBaseX, riderBaseY);
    ctx.lineTo(torsoTopX, torsoTopY);
    ctx.strokeStyle = theme.bikeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Arms (from torso top to handlebars)
    ctx.beginPath();
    ctx.moveTo(torsoTopX, torsoTopY);
    ctx.lineTo(hbX, hbY);
    ctx.strokeStyle = theme.bikeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Head
    const headX = torsoTopX + rx * lean * 0.2;
    const headY = torsoTopY - 4 * sc;
    ctx.beginPath();
    ctx.arc(headX, headY, 3 * sc, 0, Math.PI * 2);
    ctx.fillStyle = theme.bikeColor;
    ctx.fill();

    // Headlight glow at front
    const hlX = fwX + fx * 4 * sc;
    const hlY = fwY + fy * 4 * sc - 2 * sc;
    ctx.beginPath();
    ctx.arc(hlX, hlY, 2.5 * sc, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    if (theme.trailGlow) {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(hlX, hlY, 1.5 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowColor = theme.bikeColor;
    }

    // --- Speed lines when fast or boosting ---
    if (bike.speedIndex >= 3 || isBoosted) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = theme.bikeColor;
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const t = (i + 1) * 0.25;
        const spread = (Math.random() - 0.5) * 6;
        const startX = cx - fx * 14 * sc + rx * spread;
        const startY = cy - fy * 14 * sc + ry * spread;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX - fx * 10 * t, startY - fy * 10 * t);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // --- Exhaust puff at rear (small animated wisps) ---
    if (bike.alive && !bike.paused && bike.cellsTraveled > 0) {
      const exhaustCount = isBoosted ? 3 : 1;
      for (let i = 0; i < exhaustCount; i++) {
        const phase = (now * 0.008 + i * 2.1) % (Math.PI * 2);
        const puffDist = 6 + Math.sin(phase) * 3;
        const puffX = rwX - fx * puffDist * sc + (Math.sin(phase * 1.7)) * rx * 2;
        const puffY = rwY - fy * puffDist * sc + (Math.cos(phase * 1.3)) * ry * 2;
        const puffAlpha = 0.3 - Math.sin(phase) * 0.15;
        const puffSize = 1.5 + Math.sin(phase) * 0.8;
        ctx.globalAlpha = Math.max(0, puffAlpha);
        ctx.fillStyle = isBoosted ? '#ff8800' : theme.bikeColor;
        ctx.beginPath();
        ctx.arc(puffX, puffY, puffSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Reset state
    ctx.shadowBlur = 0;
    if (bike.invincible) {
      ctx.globalAlpha = 1.0;
    }
  }

  _drawWheel(ctx, wx, wy, radiusX, radiusY, spinAngle, theme) {
    // Tire outline
    ctx.beginPath();
    ctx.ellipse(wx, wy, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.strokeStyle = theme.bikeStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Spinning spokes
    const spokeCount = 3;
    ctx.strokeStyle = theme.bikeColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < spokeCount; i++) {
      const angle = spinAngle + (i * Math.PI * 2 / spokeCount);
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(
        wx + Math.cos(angle) * radiusX * 0.85,
        wy + Math.sin(angle) * radiusY * 0.85
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Hub dot
    ctx.beginPath();
    ctx.arc(wx, wy, 1, 0, Math.PI * 2);
    ctx.fillStyle = theme.bikeColor;
    ctx.fill();
  }

  drawScanlines() {
    if (!this.theme.scanlines) return;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  drawFPS() {
    const ctx = this.ctx;
    const tracker = this.fpsTracker;
    const theme = this.theme;
    const padding = 10;
    const panelW = 180;
    const panelH = 80;
    const x = padding;
    const y = padding;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, 4);
    ctx.fill();

    if (theme.hudBorder) {
      ctx.strokeStyle = theme.hudBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.fillText(`FPS: ${tracker.fps}`, x + 8, y + 16);
    ctx.fillStyle = theme.hudText;
    ctx.fillText(`avg: ${tracker.avgDelta.toFixed(1)}ms`, x + 8, y + 30);

    const cell = this.state.hoverCell;
    if (cell) {
      const maxZ = this.state.getMaxZ(cell.gx, cell.gy);
      ctx.fillText(`grid: (${cell.gx}, ${cell.gy}) z=${maxZ}`, x + 8, y + 44);
    }

    const barY = y + 52;
    const barH = 20;
    const barW = (panelW - 16) / tracker.size;
    for (let i = 0; i < tracker.size; i++) {
      const idx = (tracker.index + i) % tracker.size;
      const delta = tracker.deltas[idx];
      const h = Math.min(delta / 33 * barH, barH);
      const green = delta < 17 ? '#0f0' : delta < 33 ? '#ff0' : '#f00';
      ctx.fillStyle = green;
      ctx.fillRect(x + 8 + i * barW, barY + barH - h, Math.max(barW - 0.5, 1), h);
    }
  }

  drawMetrics(bike, now) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const theme = this.theme;
    const dpr = window.devicePixelRatio || 1;
    const panelW = 180;
    const panelH = 140;
    const padding = 10;
    const x = padding;
    const y = padding + 80 + padding; // below FPS panel

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, 4);
    ctx.fill();

    if (theme.hudBorder) {
      ctx.strokeStyle = theme.hudBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.font = '12px monospace';

    // Distance
    ctx.fillStyle = theme.hudAccent;
    ctx.fillText(`Dist: ${bike.cellsTraveled}`, x + 8, y + 16);

    // High score
    ctx.fillStyle = theme.hudText;
    ctx.fillText(`Best: ${bike.highScore}`, x + 100, y + 16);

    // Score (coins)
    if (bike.score > 0) {
      ctx.fillStyle = '#ffdd00';
      ctx.fillText(`Coins: ${bike.score}`, x + 8, y + 30);
    }

    // Speed label
    const speedLabels = ['Slow', 'Normal', 'Fast', 'Faster', 'Max'];
    const label = speedLabels[bike.speedIndex] || 'Normal';
    ctx.fillStyle = theme.hudText;
    const boostLabel = bike.isBoosted ? ' +BOOST' : '';
    ctx.fillText(`Speed: ${label}${boostLabel}`, x + 8, y + (bike.score > 0 ? 44 : 30));

    // Elapsed time
    const elapsed = bike.getElapsedSeconds(now || performance.now());
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const timeY = bike.score > 0 ? 58 : 44;
    ctx.fillText(`Time: ${timeStr}`, x + 8, y + timeY);

    // Position
    ctx.fillText(`Pos: (${bike.gx}, ${bike.gy})`, x + 8, y + timeY + 14);

    // Elevation
    if (bike.z > 0) {
      ctx.fillStyle = '#ff8800';
      ctx.fillText(`Elev: ${bike.z}`, x + 100, y + timeY + 14);
    }

    // Status indicators
    let statusY = timeY + 28;
    if (bike.paused) {
      ctx.fillStyle = '#ff0';
      ctx.fillText('PAUSED', x + 8, y + statusY);
      statusY += 14;
    }
    if (bike.isBoosted && !bike.paused) {
      ctx.fillStyle = '#f80';
      ctx.fillText('BOOST', x + 8, y + statusY);
      statusY += 14;
    }
    if (bike.jumping) {
      ctx.fillStyle = '#ff8800';
      ctx.fillText('JUMPING', x + 8, y + statusY);
      statusY += 14;
    }
    if (bike.cellsTraveled < bike.slideLockedUntil) {
      ctx.fillStyle = '#88ddff';
      ctx.fillText('ICE', x + 8, y + statusY);
      statusY += 14;
    }
    if (!bike.alive) {
      ctx.fillStyle = '#f00';
      ctx.fillText(bike.deathMessage || 'CRASHED', x + 8, y + statusY);
      statusY += 14;
    }
    if (bike.levelComplete) {
      ctx.fillStyle = '#0f0';
      ctx.fillText('LEVEL COMPLETE!', x + 8, y + statusY);
      statusY += 14;
    }
    if (bike.ghostTrail) {
      ctx.fillStyle = theme.hudAccent;
      ctx.fillText('GHOST', x + 8, y + statusY);
      statusY += 14;
    }
    if (bike.invincible) {
      ctx.fillStyle = '#0f0';
      ctx.fillText('INVINCIBLE', x + 8, y + statusY);
      statusY += 14;
    }
  }

  _emitBikeParticles(bike, now) {
    if (!bike) return;

    const cam = this.state.camera;
    const vis = bike.getVisualPosition(now);
    const s = gridToScreen(vis.gx, vis.gy, this._rotation);
    const px = s.x + cam.x;
    const py = s.y + cam.y - (vis.z || 0) * BLOCK_HEIGHT;

    // Compute screen-space direction angle for directed particles
    const dir = bike.direction;
    const fwdScreen = gridToScreen(dir.dgx, dir.dgy, this._rotation);
    const dirAngle = Math.atan2(fwdScreen.y, fwdScreen.x);

    // Exhaust while moving and alive
    if (bike.alive && !bike.paused && bike.cellsTraveled > 0) {
      this.particles.emit(px, py, 'exhaust', dirAngle);
    }

    // Crash burst
    if (this._lastBikeAlive && !bike.alive) {
      let crashPreset = 'crash';
      if (bike.deathMessage?.includes('lava')) crashPreset = 'lavaExplosion';
      else if (bike.deathMessage?.includes('water')) crashPreset = 'waterSplash';
      this.particles.emit(px, py, crashPreset);
    }
    this._lastBikeAlive = bike.alive;

    // Boost flames (heavy variant at high speed)
    if (bike.isBoosted && bike.alive) {
      const preset = bike.speedIndex >= 3 ? 'boostFlameHeavy' : 'boostFlame';
      this.particles.emit(px, py, preset, dirAngle);
    }

    // Turn sparks when lean is significant
    if (bike.alive && Math.abs(bike.lean) > 0.5) {
      const perpAngle = dirAngle + (bike.lean > 0 ? -Math.PI / 2 : Math.PI / 2);
      this.particles.emit(px, py, 'turnSparks', perpAngle);
    }

    // Coin pickup
    if (bike.score > this._lastBikeScore) {
      this.particles.emit(px, py, 'coinPickup');
    }
    this._lastBikeScore = bike.score;
  }

  _drawCrashEffects(now) {
    if (this.bike && !this.bike.alive && !this._crashDetected) {
      this._crashDetected = true;
      this._crashFlashStart = now;
    }
    if (this.bike && this.bike.alive) {
      this._crashDetected = false;
    }

    if (!this._crashDetected || !this._crashFlashStart) return;

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    const elapsed = now - this._crashFlashStart;

    // White flash overlay (150ms)
    if (elapsed < 150) {
      const alpha = (1 - elapsed / 150) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Chromatic aberration (200ms)
    if (elapsed < 200) {
      const offset = 2 * (1 - elapsed / 200);
      const prevComposite = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.15 * (1 - elapsed / 200);
      ctx.drawImage(this.canvas, offset, 0, w, h, 0, 0, w, h);
      ctx.drawImage(this.canvas, -offset, 0, w, h, 0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = prevComposite;
    }
  }

  drawMiniMap(bike, now) {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const boundary = this.state.worldBoundary || DEFAULT_BOUNDARY;
    const mapSize = 150;
    const padding = 10;
    const x = padding;
    const y = this.canvas.height / dpr - mapSize - 84; // clear the fixed bottom toolbar
    const rot = this._rotation;

    // Background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, mapSize, mapSize, 4);
    ctx.fill();

    if (this.theme.hudBorder) {
      ctx.strokeStyle = this.theme.hudBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Clip to panel
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, mapSize, mapSize, 4);
    ctx.clip();

    // Scale: map the full world into mapSize
    const worldIsoW = boundary * 2 * (TILE_WIDTH / 2);
    const worldIsoH = boundary * 2 * (TILE_HEIGHT / 2);
    const maxSpan = Math.max(worldIsoW, worldIsoH);
    const scale = (mapSize - 10) / maxSpan;

    const mapCx = x + mapSize / 2;
    const mapCy = y + mapSize / 2;

    const toMap = (gx, gy) => {
      const s = gridToScreen(gx, gy, rot);
      return {
        x: mapCx + s.x * scale,
        y: mapCy + s.y * scale,
      };
    };

    // Warning zone tint
    const warningDist = 5;
    const step = Math.max(1, Math.floor(2 / scale));
    for (let gx = -boundary; gx <= boundary; gx += step) {
      for (let gy = -boundary; gy <= boundary; gy += step) {
        const distFromEdge = Math.min(
          boundary - Math.abs(gx),
          boundary - Math.abs(gy)
        );
        if (distFromEdge >= warningDist) continue;
        const opacity = (1 - distFromEdge / warningDist) * 0.2;
        if (opacity <= 0) continue;
        const mp = toMap(gx, gy);
        ctx.fillStyle = `rgba(255, 50, 50, ${opacity})`;
        ctx.fillRect(mp.x - 1, mp.y - 1, 2, 2);
      }
    }

    // Boundary border
    const corners = [
      toMap(-boundary, -boundary),
      toMap(boundary, -boundary),
      toMap(boundary, boundary),
      toMap(-boundary, boundary),
    ];
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Blocks as small colored dots
    for (const block of this.state.blocks) {
      const mp = toMap(block.gx, block.gy);
      ctx.fillStyle = block.color || '#98a8b8';
      ctx.fillRect(mp.x - 1, mp.y - 1, 2, 2);
    }

    // Trail (only when bike is present)
    if (bike && bike.trail.length > 0) {
      const trailColor = bike.trailColor || '#00fff2';
      ctx.strokeStyle = trailColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      const firstT = toMap(bike.trail[0].gx, bike.trail[0].gy);
      ctx.moveTo(firstT.x, firstT.y);
      for (let i = 1; i < bike.trail.length; i++) {
        const tp = toMap(bike.trail[i].gx, bike.trail[i].gy);
        ctx.lineTo(tp.x, tp.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Viewport indicator
    const cam = this.state.camera;
    const zoom = cam.zoom || 1.0;
    const viewW = (this.canvas.width / dpr) / zoom;
    const viewH = (this.canvas.height / dpr) / zoom;
    const camCenterIsoX = (this.canvas.width / dpr / 2 - cam.x) / zoom;
    const camCenterIsoY = (this.canvas.height / dpr / 2 - cam.y) / zoom;

    const vpLeft = mapCx + (camCenterIsoX - viewW / 2) * scale;
    const vpTop = mapCy + (camCenterIsoY - viewH / 2) * scale;
    const vpW = viewW * scale;
    const vpH = viewH * scale;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vpLeft, vpTop, vpW, vpH);

    // Bike dot + direction indicator (only when bike is present)
    if (bike) {
      const bikeMap = toMap(bike.gx, bike.gy);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(bikeMap.x, bikeMap.y, 3, 0, Math.PI * 2);
      ctx.fill();

      const dir = bike.direction;
      const dirMap = toMap(bike.gx + dir.dgx * 3, bike.gy + dir.dgy * 3);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bikeMap.x, bikeMap.y);
      ctx.lineTo(dirMap.x, dirMap.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  frame(now) {
    this.fpsTracker.tick();
    const ctx = this.ctx;
    const cam = this.state.camera;
    const zoom = cam.zoom || 1.0;
    const dpr = window.devicePixelRatio || 1;

    // Animate rotation toward target (ease-out, ~300ms)
    const rotDiff = cam.targetRotation - cam.rotation;
    if (Math.abs(rotDiff) < 0.001) {
      cam.rotation = cam.targetRotation;
    } else {
      cam.rotation += rotDiff * 0.15;
    }
    this._rotation = cam.rotation;

    this.clear();

    // Camera auto-follow
    if (this.bike && this.bike.cameraFollow && this.bike.alive) {
      const vis = this.bike.getVisualPosition(now);
      const bikeScreen = gridToScreen(vis.gx, vis.gy, this._rotation);
      const targetX = (this.canvas.width / dpr / 2) - bikeScreen.x * zoom;
      const targetY = (this.canvas.height / dpr / 2) - bikeScreen.y * zoom;
      cam.x += (targetX - cam.x) * 0.1;
      cam.y += (targetY - cam.y) * 0.1;
    }

    // Boost zoom pulse
    let effectiveZoom = zoom;
    if (this.bike) {
      const isBoosted = this.bike.isBoosted;
      if (isBoosted && !this._wasBoosted) {
        this._boostZoomStart = now;
      }
      this._wasBoosted = isBoosted;

      if (isBoosted) {
        this._boostZoom += (0.93 - this._boostZoom) * 0.08;
      } else {
        this._boostZoom += (1.0 - this._boostZoom) * 0.12;
      }
      effectiveZoom = zoom * this._boostZoom;
    }

    // Apply zoom transform
    const origCamX = cam.x;
    const origCamY = cam.y;
    cam.x = origCamX / effectiveZoom;
    cam.y = origCamY / effectiveZoom;

    ctx.save();

    // Sinusoidal screen shake on crash
    if (this.bike && !this.bike.alive && now < this.bike.flashUntil) {
      const elapsed = now - (this.bike.flashUntil - 300);
      const intensity = 6 * Math.max(0, 1 - elapsed / 300);
      const shakeX = Math.sin(elapsed * 0.05) * intensity;
      const shakeY = Math.sin(elapsed * 0.065) * intensity;
      ctx.translate(shakeX, shakeY);
    }

    ctx.scale(effectiveZoom, effectiveZoom);

    this.drawGrid();
    this.drawWarningZone();
    this.drawRectangles();
    this.drawBlocks(now);

    // Bike + trail rendering (drive mode)
    if (this.bike) {
      const t = now || performance.now();
      this.bike.pruneTrail(t);
      this.drawTrail(this.bike, t);

      // Energy aura (glow themes, beneath bike)
      this._drawEnergyAura(this.bike, t);

      // Afterimages (before main bike)
      this._drawAfterimages(this.bike, t);

      this.drawBike(this.bike, t);

      // Headlight cone (glow themes, after bike)
      this._drawHeadlightCone(this.bike, t);

      // Particles
      this._emitBikeParticles(this.bike, t);
      this.particles.update(t);
      this.particles.draw(ctx);
    }

    this.drawRectPreview();
    this.drawMovePreview();
    this.drawHover();
    this.drawSelection();

    ctx.restore();

    // Restore camera to screen-space values
    cam.x = origCamX;
    cam.y = origCamY;

    // Crash effects (chromatic aberration + flash, screen-space)
    if (this.bike) {
      this._drawCrashEffects(now);
    }

    // HUD elements drawn without zoom
    this.drawFPS();
    if (this.bike) {
      this.drawMetrics(this.bike, now);
    }
    this.drawMiniMap(this.bike, now);

    // Scanlines overlay (retro theme)
    this.drawScanlines();
  }
}
