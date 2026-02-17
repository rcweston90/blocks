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
    return this.blocks.some(b => b.gx === gx && b.gy === gy && b.z === z);
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

  deleteBlock(index) {
    if (index >= 0 && index < this.blocks.length) {
      this.blocks.splice(index, 1);
      if (this.selection && this.selection.type === 'block') {
        if (this.selection.index === index) {
          this.selection = null;
        } else if (this.selection.index > index) {
          this.selection.index--;
        }
      }
      this._rebuildBlockMap();
    }
  }

  removeBlock(block) {
    const idx = this.blocks.indexOf(block);
    if (idx !== -1) {
      this.blocks.splice(idx, 1);
      this._rebuildBlockMap();
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

  pushUndo() {
    this.undoStack.push({
      blocks: JSON.parse(JSON.stringify(this.blocks)),
      rectangles: JSON.parse(JSON.stringify(this.rectangles)),
    });
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push({
      blocks: JSON.parse(JSON.stringify(this.blocks)),
      rectangles: JSON.parse(JSON.stringify(this.rectangles)),
    });
    const snapshot = this.undoStack.pop();
    this.blocks = snapshot.blocks;
    this.rectangles = snapshot.rectangles;
    this.selection = null;
    this._rebuildBlockMap();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push({
      blocks: JSON.parse(JSON.stringify(this.blocks)),
      rectangles: JSON.parse(JSON.stringify(this.rectangles)),
    });
    const snapshot = this.redoStack.pop();
    this.blocks = snapshot.blocks;
    this.rectangles = snapshot.rectangles;
    this.selection = null;
    this._rebuildBlockMap();
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
  }
}
