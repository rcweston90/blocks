// ── Constants ──────────────────────────────────────────────────────────────
const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const BLOCK_HEIGHT = 24;
const GRID_EXTENT = 40; // draw grid from -GRID_EXTENT to +GRID_EXTENT

// ── Isometric Math ─────────────────────────────────────────────────────────
function gridToScreen(gx, gy) {
  return {
    x: (gx - gy) * (TILE_WIDTH / 2),
    y: (gx + gy) * (TILE_HEIGHT / 2),
  };
}

function screenToGrid(sx, sy, camera) {
  const cx = sx - camera.x;
  const cy = sy - camera.y;
  const gx = (cx / (TILE_WIDTH / 2) + cy / (TILE_HEIGHT / 2)) / 2;
  const gy = (cy / (TILE_HEIGHT / 2) - cx / (TILE_WIDTH / 2)) / 2;
  return { gx: Math.floor(gx), gy: Math.floor(gy) };
}

function getDiamondPath(cx, cy) {
  const hw = TILE_WIDTH / 2;
  const hh = TILE_HEIGHT / 2;
  return [
    { x: cx, y: cy - hh },
    { x: cx + hw, y: cy },
    { x: cx, y: cy + hh },
    { x: cx - hw, y: cy },
  ];
}

// ── Color Utilities ────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ];
}

function deriveBlockFaces(baseHex) {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const topL = Math.min(1, l + 0.12);
  const rightL = Math.max(0, l - 0.10);
  const [tr, tg, tb] = hslToRgb(h, s, topL);
  const [rr, rg, rb] = hslToRgb(h, s, rightL);
  return {
    top: rgbToHex(tr, tg, tb),
    left: baseHex,
    right: rgbToHex(rr, rg, rb),
  };
}

const _faceCache = {};
function getBlockFaces(baseHex) {
  if (!_faceCache[baseHex]) {
    _faceCache[baseHex] = deriveBlockFaces(baseHex);
  }
  return _faceCache[baseHex];
}

// ── AppState ───────────────────────────────────────────────────────────────
class AppState {
  constructor() {
    this.blocks = [];
    this.rectangles = [];
    this.selection = null;       // {type: 'block'|'rect', index}
    this.activeTool = 'addBlock';
    this.camera = { x: 0, y: 0 };
    this.hoverCell = null;       // {gx, gy}
    this.statusText = 'Ready.';
    this.dragState = null;       // tool-specific drag data
    this.activeColor = '#98a8b8';
  }

  hasBlockAt(gx, gy, z) {
    return this.blocks.some(b => b.gx === gx && b.gy === gy && b.z === z);
  }

  addBlock(gx, gy, z, color) {
    if (!this.hasBlockAt(gx, gy, z)) {
      this.blocks.push({ gx, gy, z, color });
      return true;
    }
    return false;
  }

  getMaxZ(gx, gy) {
    let max = -1;
    for (const b of this.blocks) {
      if (b.gx === gx && b.gy === gy && b.z > max) max = b.z;
    }
    return max;
  }

  getTopmostBlockIndex(gx, gy) {
    let maxZ = -1;
    let idx = -1;
    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      if (b.gx === gx && b.gy === gy && b.z > maxZ) {
        maxZ = b.z;
        idx = i;
      }
    }
    return idx;
  }

  addRectangle(x1, y1, x2, y2) {
    const rect = {
      x1: Math.min(x1, x2),
      y1: Math.min(y1, y2),
      x2: Math.max(x1, x2),
      y2: Math.max(y1, y2),
    };
    this.rectangles.push(rect);
    return rect;
  }

  toJSON() {
    return JSON.stringify({ version: 2, blocks: this.blocks, rectangles: this.rectangles }, null, 2);
  }

  fromJSON(json) {
    const data = JSON.parse(json);
    this.blocks = (data.blocks || []).map(b => ({
      gx: b.gx,
      gy: b.gy,
      z: b.z !== undefined ? b.z : 0,
      color: b.color || '#98a8b8',
    }));
    this.rectangles = data.rectangles || [];
    this.selection = null;
  }
}

// ── Tools ──────────────────────────────────────────────────────────────────
class AddBlockTool {
  onMouseDown(state, cell) {
    const newZ = state.getMaxZ(cell.gx, cell.gy) + 1;
    state.addBlock(cell.gx, cell.gy, newZ, state.activeColor);
    state.statusText = `Placed block at (${cell.gx}, ${cell.gy}, z=${newZ})`;
  }
  onMouseMove() {}
  onMouseUp() {}
}

class DrawRectTool {
  onMouseDown(state, cell) {
    state.dragState = { anchor: { gx: cell.gx, gy: cell.gy }, current: { gx: cell.gx, gy: cell.gy } };
    state.statusText = `Drawing from (${cell.gx}, ${cell.gy})...`;
  }

  onMouseMove(state, cell) {
    if (state.dragState) {
      state.dragState.current = { gx: cell.gx, gy: cell.gy };
    }
  }

  onMouseUp(state, cell) {
    if (state.dragState) {
      const a = state.dragState.anchor;
      const rect = state.addRectangle(a.gx, a.gy, cell.gx, cell.gy);
      state.statusText = `Rectangle added (${rect.x1}, ${rect.y1}) -> (${rect.x2}, ${rect.y2})`;
      state.dragState = null;
    }
  }
}

class SelectTool {
  onMouseDown(state, cell, event) {
    // Check if clicking on the already-selected item to initiate drag
    if (state.selection) {
      const sel = state.selection;
      if (sel.type === 'block') {
        const block = state.blocks[sel.index];
        if (block && block.gx === cell.gx && block.gy === cell.gy) {
          state.dragState = {
            mode: 'move',
            startCell: { gx: cell.gx, gy: cell.gy },
            currentCell: { gx: cell.gx, gy: cell.gy },
            startClientX: event.clientX,
            startClientY: event.clientY,
            confirmed: false,
          };
          return;
        }
      } else if (sel.type === 'rect') {
        const rect = state.rectangles[sel.index];
        if (rect && cell.gx >= rect.x1 && cell.gx <= rect.x2 && cell.gy >= rect.y1 && cell.gy <= rect.y2) {
          state.dragState = {
            mode: 'move',
            startCell: { gx: cell.gx, gy: cell.gy },
            currentCell: { gx: cell.gx, gy: cell.gy },
            startClientX: event.clientX,
            startClientY: event.clientY,
            confirmed: false,
          };
          return;
        }
      }
    }

    // Hit-test rectangles first (point-in-region)
    for (let i = state.rectangles.length - 1; i >= 0; i--) {
      const r = state.rectangles[i];
      if (cell.gx >= r.x1 && cell.gx <= r.x2 && cell.gy >= r.y1 && cell.gy <= r.y2) {
        state.selection = { type: 'rect', index: i };
        state.statusText = `Selected rectangle ${i}`;
        return;
      }
    }
    // Hit-test blocks (topmost at cell)
    const blockIdx = state.getTopmostBlockIndex(cell.gx, cell.gy);
    if (blockIdx !== -1) {
      state.selection = { type: 'block', index: blockIdx };
      state.statusText = `Selected block ${blockIdx}`;
      return;
    }
    state.selection = null;
    state.statusText = 'Ready.';
  }

  onMouseMove(state, cell, event) {
    if (state.dragState && state.dragState.mode === 'move') {
      if (!state.dragState.confirmed) {
        const dx = event.clientX - state.dragState.startClientX;
        const dy = event.clientY - state.dragState.startClientY;
        if (Math.sqrt(dx * dx + dy * dy) >= 5) {
          state.dragState.confirmed = true;
        }
      }
      if (state.dragState.confirmed) {
        state.dragState.currentCell = { gx: cell.gx, gy: cell.gy };
      }
    }
  }

  onMouseUp(state) {
    if (state.dragState && state.dragState.mode === 'move') {
      if (state.dragState.confirmed) {
        const deltaGx = state.dragState.currentCell.gx - state.dragState.startCell.gx;
        const deltaGy = state.dragState.currentCell.gy - state.dragState.startCell.gy;
        if (deltaGx !== 0 || deltaGy !== 0) {
          const sel = state.selection;
          if (sel.type === 'block') {
            const block = state.blocks[sel.index];
            const newGx = block.gx + deltaGx;
            const newGy = block.gy + deltaGy;
            if (state.hasBlockAt(newGx, newGy, block.z)) {
              state.statusText = `Cannot move: occupied at (${newGx}, ${newGy}, z=${block.z})`;
            } else {
              block.gx = newGx;
              block.gy = newGy;
              state.statusText = `Moved block to (${newGx}, ${newGy}, z=${block.z})`;
            }
          } else if (sel.type === 'rect') {
            const rect = state.rectangles[sel.index];
            rect.x1 += deltaGx;
            rect.y1 += deltaGy;
            rect.x2 += deltaGx;
            rect.y2 += deltaGy;
            state.statusText = `Moved rectangle to (${rect.x1}, ${rect.y1}) -> (${rect.x2}, ${rect.y2})`;
          }
        }
      }
      state.dragState = null;
    }
  }
}

class MoveCameraTool {
  onMouseDown(state, cell, event) {
    state.dragState = { startX: event.clientX, startY: event.clientY, camStartX: state.camera.x, camStartY: state.camera.y };
  }

  onMouseMove(state, cell, event) {
    if (state.dragState) {
      const dx = event.clientX - state.dragState.startX;
      const dy = event.clientY - state.dragState.startY;
      state.camera.x = state.dragState.camStartX + dx;
      state.camera.y = state.dragState.camStartY + dy;
    }
  }

  onMouseUp(state) {
    state.dragState = null;
  }
}

// ── Tool Manager ───────────────────────────────────────────────────────────
class ToolManager {
  constructor() {
    this.tools = {
      addBlock: new AddBlockTool(),
      drawRect: new DrawRectTool(),
      select: new SelectTool(),
      moveCamera: new MoveCameraTool(),
    };
  }

  get(name) {
    return this.tools[name];
  }
}

// ── FPS Tracker ────────────────────────────────────────────────────────────
class FPSTracker {
  constructor(size = 60) {
    this.size = size;
    this.deltas = new Array(size).fill(16);
    this.index = 0;
    this.lastTime = performance.now();
  }

  tick() {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    this.deltas[this.index] = delta;
    this.index = (this.index + 1) % this.size;
    return delta;
  }

  get avgDelta() {
    let sum = 0;
    for (let i = 0; i < this.size; i++) sum += this.deltas[i];
    return sum / this.size;
  }

  get fps() {
    return Math.round(1000 / this.avgDelta);
  }
}

// ── Renderer ───────────────────────────────────────────────────────────────
class Renderer {
  constructor(canvas, state, fpsTracker) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.fpsTracker = fpsTracker;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#f0f0e8';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGrid() {
    const ctx = this.ctx;
    const cam = this.state.camera;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Determine visible grid range by inverse-projecting canvas corners
    const corners = [
      screenToGrid(0, 0, cam),
      screenToGrid(w, 0, cam),
      screenToGrid(0, h, cam),
      screenToGrid(w, h, cam),
    ];
    let minG = -GRID_EXTENT, maxG = GRID_EXTENT;
    const allGx = corners.map(c => c.gx);
    const allGy = corners.map(c => c.gy);
    const gxMin = Math.max(Math.min(...allGx) - 2, minG);
    const gxMax = Math.min(Math.max(...allGx) + 2, maxG);
    const gyMin = Math.max(Math.min(...allGy) - 2, minG);
    const gyMax = Math.min(Math.max(...allGy) + 2, maxG);

    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;

    // Draw grid lines along gx axis
    for (let gx = gxMin; gx <= gxMax; gx++) {
      const from = gridToScreen(gx, gyMin);
      const to = gridToScreen(gx, gyMax);
      ctx.beginPath();
      ctx.moveTo(from.x + cam.x, from.y + cam.y);
      ctx.lineTo(to.x + cam.x, to.y + cam.y);
      ctx.stroke();
    }

    // Draw grid lines along gy axis
    for (let gy = gyMin; gy <= gyMax; gy++) {
      const from = gridToScreen(gxMin, gy);
      const to = gridToScreen(gxMax, gy);
      ctx.beginPath();
      ctx.moveTo(from.x + cam.x, from.y + cam.y);
      ctx.lineTo(to.x + cam.x, to.y + cam.y);
      ctx.stroke();
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
    // Sort back-to-front: primary (gx + gy) ascending, secondary z ascending
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
    if (!ds || this.state.activeTool !== 'drawRect') return;
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
      const bh = BLOCK_HEIGHT;
      const zOff = block.z * BLOCK_HEIGHT;

      // Outline the cube silhouette with z offset
      ctx.beginPath();
      ctx.moveTo(cx, cy - hh - bh - zOff);        // top
      ctx.lineTo(cx + hw, cy - bh - zOff);         // top-right
      ctx.lineTo(cx + hw, cy - zOff);              // right
      ctx.lineTo(cx, cy + hh - zOff);              // bottom
      ctx.lineTo(cx - hw, cy - zOff);              // left
      ctx.lineTo(cx - hw, cy - bh - zOff);         // top-left
      ctx.closePath();
      ctx.stroke();
    } else if (sel.type === 'rect') {
      const rect = this.state.rectangles[sel.index];
      if (!rect) { this.state.selection = null; return; }

      // Compute outer perimeter of the isometric region
      const s1 = gridToScreen(rect.x1, rect.y1);
      const s2 = gridToScreen(rect.x2, rect.y1);
      const s3 = gridToScreen(rect.x2, rect.y2);
      const s4 = gridToScreen(rect.x1, rect.y2);

      const hw = TILE_WIDTH / 2;
      const hh = TILE_HEIGHT / 2;

      ctx.beginPath();
      // Top vertex
      ctx.moveTo(s1.x + cam.x, s1.y + cam.y - hh);
      // Right vertex
      ctx.lineTo(s2.x + cam.x + hw, s2.y + cam.y);
      // Bottom-right to bottom
      ctx.lineTo(s3.x + cam.x, s3.y + cam.y + hh);
      // Left vertex
      ctx.lineTo(s4.x + cam.x - hw, s4.y + cam.y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.setLineDash([]);
  }

  drawFPS() {
    const ctx = this.ctx;
    const tracker = this.fpsTracker;
    const padding = 10;
    const panelW = 180;
    const panelH = 80;
    const x = padding;
    const y = padding;

    // Panel background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, 4);
    ctx.fill();

    // FPS text
    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.fillText(`FPS: ${tracker.fps}`, x + 8, y + 16);
    ctx.fillStyle = '#aaa';
    ctx.fillText(`avg: ${tracker.avgDelta.toFixed(1)}ms`, x + 8, y + 30);

    // Mouse grid coords with z
    const cell = this.state.hoverCell;
    if (cell) {
      const maxZ = this.state.getMaxZ(cell.gx, cell.gy);
      ctx.fillText(`grid: (${cell.gx}, ${cell.gy}) z=${maxZ}`, x + 8, y + 44);
    }

    // Mini bar graph of frame times
    const barY = y + 52;
    const barH = 20;
    const barW = (panelW - 16) / tracker.size;
    for (let i = 0; i < tracker.size; i++) {
      const idx = (tracker.index + i) % tracker.size;
      const delta = tracker.deltas[idx];
      const h = Math.min(delta / 33 * barH, barH); // 33ms = ~30fps as max bar
      const green = delta < 17 ? '#0f0' : delta < 33 ? '#ff0' : '#f00';
      ctx.fillStyle = green;
      ctx.fillRect(x + 8 + i * barW, barY + barH - h, Math.max(barW - 0.5, 1), h);
    }
  }

  frame() {
    this.fpsTracker.tick();
    this.clear();
    this.drawGrid();
    this.drawRectangles();
    this.drawBlocks();
    this.drawRectPreview();
    this.drawMovePreview();
    this.drawHover();
    this.drawSelection();
    this.drawFPS();
  }
}

// ── Application ────────────────────────────────────────────────────────────
class App {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.state = new AppState();
    this.toolManager = new ToolManager();
    this.fpsTracker = new FPSTracker();
    this.renderer = new Renderer(this.canvas, this.state, this.fpsTracker);
    this.statusEl = document.getElementById('status');
    this.colorPicker = document.getElementById('color-picker');

    this.resize();
    this.bindEvents();
    this.loop();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Center camera on initial load
    if (this.state.camera.x === 0 && this.state.camera.y === 0) {
      this.state.camera.x = rect.width / 2;
      this.state.camera.y = rect.height / 3;
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());

    // Canvas mouse events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => { this.state.hoverCell = null; });

    // Toolbar buttons
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.activeTool = btn.dataset.tool;
        document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.selection = null;
        this.state.dragState = null;

        // Update cursor
        if (btn.dataset.tool === 'moveCamera') {
          this.canvas.style.cursor = 'grab';
        } else if (btn.dataset.tool === 'select') {
          this.canvas.style.cursor = 'default';
        } else {
          this.canvas.style.cursor = 'crosshair';
        }
      });
    });

    // Color picker
    this.colorPicker.addEventListener('input', (e) => {
      this.state.activeColor = e.target.value;
      // Live recolor selected block
      if (this.state.selection && this.state.selection.type === 'block') {
        const block = this.state.blocks[this.state.selection.index];
        if (block) block.color = e.target.value;
      }
    });

    // Download JSON
    document.getElementById('btn-download').addEventListener('click', () => {
      const json = this.state.toJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'isometric-scene.json';
      a.click();
      URL.revokeObjectURL(url);
      this.state.statusText = 'JSON downloaded.';
    });

    // Upload JSON
    const fileInput = document.getElementById('file-input');
    document.getElementById('btn-upload').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          this.state.fromJSON(ev.target.result);
          this.state.statusText = `Loaded: ${this.state.blocks.length} blocks, ${this.state.rectangles.length} rectangles.`;
        } catch (err) {
          this.state.statusText = 'Error loading JSON.';
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  onMouseDown(e) {
    const pos = this.getCanvasPos(e);
    const cell = screenToGrid(pos.x, pos.y, this.state.camera);
    const tool = this.toolManager.get(this.state.activeTool);
    if (tool) tool.onMouseDown(this.state, cell, e);

    if (this.state.activeTool === 'moveCamera') {
      this.canvas.style.cursor = 'grabbing';
    }
  }

  onMouseMove(e) {
    const pos = this.getCanvasPos(e);
    const cell = screenToGrid(pos.x, pos.y, this.state.camera);
    this.state.hoverCell = cell;
    const tool = this.toolManager.get(this.state.activeTool);
    if (tool) tool.onMouseMove(this.state, cell, e);
  }

  onMouseUp(e) {
    const pos = this.getCanvasPos(e);
    const cell = screenToGrid(pos.x, pos.y, this.state.camera);
    const tool = this.toolManager.get(this.state.activeTool);
    if (tool) tool.onMouseUp(this.state, cell, e);

    if (this.state.activeTool === 'moveCamera') {
      this.canvas.style.cursor = 'grab';
    }
  }

  loop() {
    this.renderer.frame();
    this.statusEl.textContent = this.state.statusText;
    // Sync color picker to selected block's color
    const sel = this.state.selection;
    if (sel && sel.type === 'block') {
      const block = this.state.blocks[sel.index];
      if (block && this.colorPicker.value !== block.color) {
        this.colorPicker.value = block.color;
      }
    }
    requestAnimationFrame(() => this.loop());
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => new App());
