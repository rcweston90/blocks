import { TILE_WIDTH, TILE_HEIGHT, BLOCK_HEIGHT, GRID_EXTENT } from './constants.js';
import { gridToScreen, screenToGrid, getDiamondPath } from './math.js';
import { getBlockFaces } from './colors.js';

export class Renderer {
  constructor(canvas, state, fpsTracker) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.fpsTracker = fpsTracker;
    this.bike = null; // set externally when in drive mode
    this.neonTheme = false;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = this.neonTheme ? '#0a0a14' : '#f0f0e8';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGrid() {
    const ctx = this.ctx;
    const cam = this.state.camera;
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

    if (this.neonTheme) {
      ctx.strokeStyle = 'rgba(0, 255, 242, 0.15)';
      ctx.lineWidth = 0.8;
      ctx.shadowColor = 'rgba(0, 255, 242, 0.3)';
      ctx.shadowBlur = 2;
    } else {
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 0.5;
    }

    for (let gx = gxMin; gx <= gxMax + 1; gx++) {
      const from = gridToScreen(gx - 0.5, gyMin - 0.5);
      const to = gridToScreen(gx - 0.5, gyMax + 0.5);
      ctx.beginPath();
      ctx.moveTo(from.x + cam.x, from.y + cam.y);
      ctx.lineTo(to.x + cam.x, to.y + cam.y);
      ctx.stroke();
    }

    for (let gy = gyMin; gy <= gyMax + 1; gy++) {
      const from = gridToScreen(gxMin - 0.5, gy - 0.5);
      const to = gridToScreen(gxMax + 0.5, gy - 0.5);
      ctx.beginPath();
      ctx.moveTo(from.x + cam.x, from.y + cam.y);
      ctx.lineTo(to.x + cam.x, to.y + cam.y);
      ctx.stroke();
    }

    if (this.neonTheme) {
      ctx.shadowBlur = 0;
    }
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
    for (let gx = rect.x1; gx <= rect.x2; gx++) {
      for (let gy = rect.y1; gy <= rect.y2; gy++) {
        const s = gridToScreen(gx, gy);
        const cx = s.x + cam.x;
        const cy = s.y + cam.y;
        this.drawDiamond(cx, cy, 'rgba(80, 180, 160, 0.35)', null, 0);
      }
    }
  }

  drawBlock(gx, gy, z, color) {
    const ctx = this.ctx;
    const cam = this.state.camera;
    const s = gridToScreen(gx, gy);
    const cx = s.x + cam.x;
    const cy = s.y + cam.y;
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;
    const bh = BLOCK_HEIGHT;
    const zOff = z * BLOCK_HEIGHT;
    const faces = getBlockFaces(color);

    // Top face
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh - bh - zOff);
    ctx.lineTo(cx + hw, cy - bh - zOff);
    ctx.lineTo(cx, cy + hh - bh - zOff);
    ctx.lineTo(cx - hw, cy - bh - zOff);
    ctx.closePath();
    ctx.fillStyle = faces.top;
    ctx.fill();
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Left face
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy - bh - zOff);
    ctx.lineTo(cx, cy + hh - bh - zOff);
    ctx.lineTo(cx, cy + hh - zOff);
    ctx.lineTo(cx - hw, cy - zOff);
    ctx.closePath();
    ctx.fillStyle = faces.left;
    ctx.fill();
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Right face
    ctx.beginPath();
    ctx.moveTo(cx + hw, cy - bh - zOff);
    ctx.lineTo(cx, cy + hh - bh - zOff);
    ctx.lineTo(cx, cy + hh - zOff);
    ctx.lineTo(cx + hw, cy - zOff);
    ctx.closePath();
    ctx.fillStyle = faces.right;
    ctx.fill();
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawBlocks() {
    const sorted = [...this.state.blocks].sort((a, b) => {
      const d = (a.gx + a.gy) - (b.gx + b.gy);
      return d !== 0 ? d : a.z - b.z;
    });
    for (const block of sorted) {
      this.drawBlock(block.gx, block.gy, block.z, block.color);
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
        this.drawBlock(block.gx + deltaGx, block.gy + deltaGy, block.z, block.color);
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
    const s = gridToScreen(cell.gx, cell.gy);
    const cx = s.x + cam.x;
    const cy = s.y + cam.y;
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
      const s = gridToScreen(block.gx, block.gy);
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

      const s1 = gridToScreen(rect.x1, rect.y1);
      const s2 = gridToScreen(rect.x2, rect.y1);
      const s3 = gridToScreen(rect.x2, rect.y2);
      const s4 = gridToScreen(rect.x1, rect.y2);

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
    const ctx = this.ctx;
    const cam = this.state.camera;
    const isNeon = this.neonTheme;

    for (const entry of bike.trail) {
      const age = now - entry.time;
      const opacity = bike.ghostTrail ? 1.0 : (1 - (age / 3000));
      if (opacity <= 0) continue;

      const s = gridToScreen(entry.gx, entry.gy);
      const cx = s.x + cam.x;
      const cy = s.y + cam.y;

      ctx.globalAlpha = opacity;
      const trailColor = bike.trailColor || '#00fff2';

      if (isNeon) {
        ctx.shadowColor = trailColor;
        ctx.shadowBlur = 12 * opacity;
      }

      this.drawDiamond(cx, cy, trailColor, trailColor, 1);
    }

    ctx.globalAlpha = 1.0;
    if (isNeon) {
      ctx.shadowBlur = 0;
    }
  }

  drawBike(bike, now) {
    const ctx = this.ctx;
    const cam = this.state.camera;

    // Flash effect on crash
    if (now < bike.flashUntil) {
      const flashPhase = Math.floor((now - (bike.flashUntil - 300)) / 60) % 2;
      if (flashPhase === 1) return; // invisible frame
    }

    // Use interpolated position (feature 1)
    const vis = bike.getVisualPosition(now);
    const s = gridToScreen(vis.gx, vis.gy);
    const cx = s.x + cam.x;
    const cy = s.y + cam.y;

    const hw = TILE_WIDTH * 0.3;
    const hh = TILE_HEIGHT * 0.3;

    // Invincible pulse (feature 6)
    if (bike.invincible) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 250);
    }

    // Neon glow (feature 7)
    if (this.neonTheme) {
      ctx.shadowColor = '#00fff2';
      ctx.shadowBlur = 15;
    }

    // Draw bike body (small diamond)
    const pts = [
      { x: cx, y: cy - hh },
      { x: cx + hw, y: cy },
      { x: cx, y: cy + hh },
      { x: cx - hw, y: cy },
    ];

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = '#00fff2';
    ctx.fill();
    ctx.strokeStyle = '#00cccc';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw directional chevron
    const dir = bike.direction;
    const chevronSize = 6;
    let tipX = cx, tipY = cy;

    if (dir.dgx === 1 && dir.dgy === 0) {
      tipX = cx + hw + chevronSize;
      tipY = cy;
    } else if (dir.dgx === -1 && dir.dgy === 0) {
      tipX = cx - hw - chevronSize;
      tipY = cy;
    } else if (dir.dgx === 0 && dir.dgy === -1) {
      tipX = cx;
      tipY = cy - hh - chevronSize;
    } else if (dir.dgx === 0 && dir.dgy === 1) {
      tipX = cx;
      tipY = cy + hh + chevronSize;
    }

    ctx.beginPath();
    ctx.arc(tipX, tipY, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Reset neon/invincible state
    if (this.neonTheme) {
      ctx.shadowBlur = 0;
    }
    if (bike.invincible) {
      ctx.globalAlpha = 1.0;
    }
  }

  drawFPS() {
    const ctx = this.ctx;
    const tracker = this.fpsTracker;
    const padding = 10;
    const panelW = 180;
    const panelH = 80;
    const x = padding;
    const y = padding;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, 4);
    ctx.fill();

    if (this.neonTheme) {
      ctx.strokeStyle = 'rgba(0, 255, 242, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.fillText(`FPS: ${tracker.fps}`, x + 8, y + 16);
    ctx.fillStyle = '#aaa';
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
    const dpr = window.devicePixelRatio || 1;
    const panelW = 180;
    const panelH = 118;
    const padding = 10;
    const x = canvas.width / dpr - panelW - padding;
    const y = padding;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, 4);
    ctx.fill();

    if (this.neonTheme) {
      ctx.strokeStyle = 'rgba(0, 255, 242, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.font = '12px monospace';

    // Distance
    ctx.fillStyle = '#0ff';
    ctx.fillText(`Dist: ${bike.cellsTraveled}`, x + 8, y + 16);

    // High score
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Best: ${bike.highScore}`, x + 100, y + 16);

    // Speed label
    const speedLabels = ['Slow', 'Normal', 'Fast', 'Faster', 'Max'];
    const label = speedLabels[bike.speedIndex] || 'Normal';
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Speed: ${label}${bike.boosting ? ' +BOOST' : ''}`, x + 8, y + 30);

    // Elapsed time (M:SS)
    const elapsed = bike.getElapsedSeconds(now || performance.now());
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    ctx.fillText(`Time: ${timeStr}`, x + 8, y + 44);

    // Position
    ctx.fillText(`Pos: (${bike.gx}, ${bike.gy})`, x + 8, y + 58);

    // Status indicators
    let statusY = 72;
    if (bike.paused) {
      ctx.fillStyle = '#ff0';
      ctx.fillText('PAUSED', x + 8, y + statusY);
      statusY += 14;
    }
    if (bike.boosting && !bike.paused) {
      ctx.fillStyle = '#f80';
      ctx.fillText('BOOST', x + 8, y + statusY);
      statusY += 14;
    }
    if (!bike.alive) {
      ctx.fillStyle = '#f00';
      ctx.fillText('CRASHED', x + 8, y + statusY);
      statusY += 14;
    }
    if (bike.ghostTrail) {
      ctx.fillStyle = '#0ff';
      ctx.fillText('GHOST', x + 8, y + statusY);
      statusY += 14;
    }
    if (bike.invincible) {
      ctx.fillStyle = '#0f0';
      ctx.fillText('INVINCIBLE', x + 8, y + statusY);
      statusY += 14;
    }
  }

  frame(now) {
    this.fpsTracker.tick();
    const ctx = this.ctx;
    const cam = this.state.camera;
    const zoom = cam.zoom || 1.0;
    const dpr = window.devicePixelRatio || 1;

    this.clear();

    // Camera auto-follow (feature 2) -- before zoom transform
    if (this.bike && this.bike.cameraFollow && this.bike.alive) {
      const vis = this.bike.getVisualPosition(now);
      const bikeScreen = gridToScreen(vis.gx, vis.gy);
      const targetX = (this.canvas.width / dpr / 2) - bikeScreen.x * zoom;
      const targetY = (this.canvas.height / dpr / 2) - bikeScreen.y * zoom;
      cam.x += (targetX - cam.x) * 0.1;
      cam.y += (targetY - cam.y) * 0.1;
    }

    // Apply zoom transform -- adjust camera into zoomed coordinate space
    const origCamX = cam.x;
    const origCamY = cam.y;
    cam.x = origCamX / zoom;
    cam.y = origCamY / zoom;

    ctx.save();

    // Screen shake on crash (feature 3)
    if (this.bike && !this.bike.alive && now < this.bike.flashUntil) {
      const elapsed = now - (this.bike.flashUntil - 300);
      const intensity = 6 * (1 - elapsed / 300);
      ctx.translate((Math.random() - 0.5) * 2 * intensity,
                    (Math.random() - 0.5) * 2 * intensity);
    }

    ctx.scale(zoom, zoom);

    this.drawGrid();
    this.drawRectangles();
    this.drawBlocks();

    // Bike + trail rendering (drive mode)
    if (this.bike) {
      const t = now || performance.now();
      this.bike.pruneTrail(t);
      this.drawTrail(this.bike, t);
      this.drawBike(this.bike, t);
    }

    this.drawRectPreview();
    this.drawMovePreview();
    this.drawHover();
    this.drawSelection();

    ctx.restore();

    // Restore camera to screen-space values
    cam.x = origCamX;
    cam.y = origCamY;

    // HUD elements drawn without zoom
    this.drawFPS();
    if (this.bike) {
      this.drawMetrics(this.bike, now);
    }
  }
}
