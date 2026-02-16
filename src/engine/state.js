export class AppState {
  constructor() {
    this.blocks = [];
    this.rectangles = [];
    this.selection = null;       // {type: 'block'|'rect', index}
    this.activeTool = 'addBlock';
    this.camera = { x: 0, y: 0, zoom: 1.0 };
    this.hoverCell = null;       // {gx, gy}
    this.statusText = 'Ready.';
    this.dragState = null;       // tool-specific drag data
    this.activeColor = '#98a8b8';
    this.undoStack = [];
    this.redoStack = [];
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
