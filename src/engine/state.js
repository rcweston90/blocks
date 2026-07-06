import { getBlockType } from './blockTypes.js';
import { DEFAULT_BOUNDARY } from './constants.js';

export class AppState {
  constructor() {
    this.blocks = [];
    this.rectangles = [];
    this.selection = null;       // {type: 'block'|'rect', index}
    this.activeTool = 'addWall';
    this.camera = { x: 0, y: 0, zoom: 1.0, rotation: 0, targetRotation: 0, rotationIndex: 0 };
    this.hoverCell = null;       // {gx, gy}
    this.statusText = 'Ready.';
    this.dragState = null;       // tool-specific drag data
    this.activeColor = '#98a8b8';
    this.activeBlockType = 'normal';
    this.activeFloorType = 'boost';
    this.lastPlacementMode = 'wall';
    this.undoStack = [];
    this.redoStack = [];
    this.blockMap = new Map();   // "gx,gy" -> array of blocks
    this.worldBoundary = DEFAULT_BOUNDARY; // ±N cells from origin
    this.activeRampDir = 0; // 0=N, 1=E, 2=S, 3=W
    this._blocksDirty = true; // dirty flag for cached depth sort
    this.blockAnimations = []; // {block, startTime, duration}
    this.clipboard = null; // for copy/paste
  }

  _rebuildBlockMap() {
    this.blockMap.clear();
    for (const b of this.blocks) {
      const key = `${b.gx},${b.gy}`;
      let arr = this.blockMap.get(key);
      if (!arr) {
        arr = [];
        this.blockMap.set(key, arr);
      }
      arr.push(b);
    }
  }

  _removeFromBlockMap(block) {
    const key = `${block.gx},${block.gy}`;
    const arr = this.blockMap.get(key);
    if (!arr) return;
    const idx = arr.indexOf(block);
    if (idx !== -1) arr.splice(idx, 1);
    if (arr.length === 0) this.blockMap.delete(key);
  }

  getBlocksAt(gx, gy) {
    return this.blockMap.get(`${gx},${gy}`) || [];
  }

  getBlockAt(gx, gy) {
    const arr = this.blockMap.get(`${gx},${gy}`);
    if (!arr || arr.length === 0) return null;
    let top = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].z > top.z) top = arr[i];
    }
    return top;
  }

  getWallAt(gx, gy, z) {
    const arr = this.blockMap.get(`${gx},${gy}`);
    if (!arr) return null;
    for (const b of arr) {
      const bt = getBlockType(b.type || 'normal');
      if (!bt.isFloor && !bt.isCollectible && b.z === z) return b;
    }
    return null;
  }

  getFloorAt(gx, gy, z) {
    const arr = this.blockMap.get(`${gx},${gy}`);
    if (!arr) return null;
    for (const b of arr) {
      const bt = getBlockType(b.type || 'normal');
      if (bt.isFloor && b.z === z) return b;
    }
    return null;
  }

  hasBlockAt(gx, gy, z) {
    const arr = this.blockMap.get(`${gx},${gy}`);
    if (!arr) return false;
    for (const b of arr) {
      if (b.z === z) return true;
    }
    return false;
  }

  addBlock(gx, gy, z, color, type = 'normal', dir = 0) {
    if (!this.hasBlockAt(gx, gy, z)) {
      const block = { gx, gy, z, color, type };
      if (type === 'ramp' || type === 'start') block.dir = dir;
      this.blocks.push(block);
      // Update blockMap
      const key = `${gx},${gy}`;
      let arr = this.blockMap.get(key);
      if (!arr) {
        arr = [];
        this.blockMap.set(key, arr);
      }
      arr.push(block);
      this._blocksDirty = true;
      // Trigger placement animation
      this.blockAnimations.push({ block, startTime: performance.now(), duration: 200 });
      return true;
    }
    return false;
  }

  getMaxZ(gx, gy) {
    const arr = this.blockMap.get(`${gx},${gy}`);
    if (!arr) return -1;
    let max = -1;
    for (const b of arr) {
      if (b.z > max) max = b.z;
    }
    return max;
  }

  getTopmostBlockIndex(gx, gy) {
    const arr = this.blockMap.get(`${gx},${gy}`);
    if (!arr || arr.length === 0) return -1;
    let topBlock = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].z > topBlock.z) topBlock = arr[i];
    }
    return this.blocks.indexOf(topBlock);
  }

  deleteBlock(index) {
    if (index >= 0 && index < this.blocks.length) {
      const block = this.blocks[index];
      this._removeFromBlockMap(block);
      this.blocks.splice(index, 1);
      if (this.selection && this.selection.type === 'block') {
        if (this.selection.index === index) {
          this.selection = null;
        } else if (this.selection.index > index) {
          this.selection.index--;
        }
      }
      this._blocksDirty = true;
    }
  }

  removeBlock(block) {
    const idx = this.blocks.indexOf(block);
    if (idx !== -1) {
      this._removeFromBlockMap(block);
      this.blocks.splice(idx, 1);
      this._blocksDirty = true;
    }
  }

  deleteRectangle(index) {
    if (index >= 0 && index < this.rectangles.length) {
      this.rectangles.splice(index, 1);
      if (this.selection && this.selection.type === 'rect') {
        if (this.selection.index === index) {
          this.selection = null;
        } else if (this.selection.index > index) {
          this.selection.index--;
        }
      }
    }
  }

  _snapshotBlocks() {
    return this.blocks.map(b => ({...b}));
  }

  _snapshotRects() {
    return this.rectangles.map(r => ({...r}));
  }

  pushUndo() {
    this.undoStack.push({
      blocks: this._snapshotBlocks(),
      rectangles: this._snapshotRects(),
    });
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push({
      blocks: this._snapshotBlocks(),
      rectangles: this._snapshotRects(),
    });
    const snapshot = this.undoStack.pop();
    this.blocks = snapshot.blocks;
    this.rectangles = snapshot.rectangles;
    this.selection = null;
    this._rebuildBlockMap();
    this._blocksDirty = true;
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push({
      blocks: this._snapshotBlocks(),
      rectangles: this._snapshotRects(),
    });
    const snapshot = this.redoStack.pop();
    this.blocks = snapshot.blocks;
    this.rectangles = snapshot.rectangles;
    this.selection = null;
    this._rebuildBlockMap();
    this._blocksDirty = true;
    return true;
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

  getStartBlock() {
    return this.blocks.find(b => b.type === 'start') || null;
  }

  removeStartBlocks() {
    this.blocks = this.blocks.filter(b => b.type !== 'start');
    this._rebuildBlockMap();
    this._blocksDirty = true;
  }

  toJSON() {
    // Omit type when 'normal' for backward compat
    const blocks = this.blocks.map(b => {
      const obj = { gx: b.gx, gy: b.gy, z: b.z, color: b.color };
      if (b.type && b.type !== 'normal') obj.type = b.type;
      if (b.dir) obj.dir = b.dir;
      return obj;
    });
    return JSON.stringify({ version: 2, blocks, rectangles: this.rectangles }, null, 2);
  }

  fromJSON(json) {
    const data = JSON.parse(json);
    this.blocks = (data.blocks || []).map(b => {
      const block = {
        gx: b.gx,
        gy: b.gy,
        z: b.z !== undefined ? b.z : 0,
        color: b.color || '#98a8b8',
        type: b.type || 'normal',
      };
      if (b.dir) block.dir = b.dir;
      return block;
    });
    this.rectangles = data.rectangles || [];
    this.selection = null;
    this._rebuildBlockMap();
    this._blocksDirty = true;
  }
}
