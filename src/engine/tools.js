export class AddBlockTool {
  onMouseDown(state, cell) {
    state.pushUndo();
    const newZ = state.getMaxZ(cell.gx, cell.gy) + 1;
    state.addBlock(cell.gx, cell.gy, newZ, state.activeColor);
    state.statusText = `Placed block at (${cell.gx}, ${cell.gy}, z=${newZ})`;
  }
  onMouseMove() {}
  onMouseUp() {}
}

export class DrawRectTool {
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
      state.pushUndo();
      const a = state.dragState.anchor;
      const rect = state.addRectangle(a.gx, a.gy, cell.gx, cell.gy);
      state.statusText = `Rectangle added (${rect.x1}, ${rect.y1}) -> (${rect.x2}, ${rect.y2})`;
      state.dragState = null;
    }
  }
}

export class SelectTool {
  onMouseDown(state, cell, event) {
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

    for (let i = state.rectangles.length - 1; i >= 0; i--) {
      const r = state.rectangles[i];
      if (cell.gx >= r.x1 && cell.gx <= r.x2 && cell.gy >= r.y1 && cell.gy <= r.y2) {
        state.selection = { type: 'rect', index: i };
        state.statusText = `Selected rectangle ${i}`;
        return;
      }
    }

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

  adjustHeight(state, delta) {
    const sel = state.selection;
    if (!sel || sel.type !== 'block') return;
    const block = state.blocks[sel.index];
    if (!block) return;
    const newZ = block.z + delta;
    if (newZ < 0) return;
    if (state.hasBlockAt(block.gx, block.gy, newZ)) {
      state.statusText = `Cannot move: occupied at z=${newZ}`;
      return;
    }
    state.pushUndo();
    block.z = newZ;
    state.statusText = `Block height: z=${newZ}`;
  }

  onMouseUp(state) {
    if (state.dragState && state.dragState.mode === 'move') {
      if (state.dragState.confirmed) {
        state.pushUndo();
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

export class MoveCameraTool {
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

export class EraserTool {
  onMouseDown(state, cell) {
    const idx = state.getTopmostBlockIndex(cell.gx, cell.gy);
    if (idx !== -1) {
      state.pushUndo();
      state.deleteBlock(idx);
      state.statusText = `Erased block at (${cell.gx}, ${cell.gy})`;
    } else {
      state.statusText = `No block at (${cell.gx}, ${cell.gy})`;
    }
  }
  onMouseMove() {}
  onMouseUp() {}
}

export class FillTool {
  onMouseDown(state, cell) {
    state.dragState = { anchor: { gx: cell.gx, gy: cell.gy }, current: { gx: cell.gx, gy: cell.gy } };
    state.statusText = `Filling from (${cell.gx}, ${cell.gy})...`;
  }

  onMouseMove(state, cell) {
    if (state.dragState) {
      state.dragState.current = { gx: cell.gx, gy: cell.gy };
    }
  }

  onMouseUp(state, cell) {
    if (state.dragState) {
      state.pushUndo();
      const a = state.dragState.anchor;
      const x1 = Math.min(a.gx, cell.gx);
      const y1 = Math.min(a.gy, cell.gy);
      const x2 = Math.max(a.gx, cell.gx);
      const y2 = Math.max(a.gy, cell.gy);
      let count = 0;
      for (let gx = x1; gx <= x2; gx++) {
        for (let gy = y1; gy <= y2; gy++) {
          const newZ = state.getMaxZ(gx, gy) + 1;
          state.addBlock(gx, gy, newZ, state.activeColor);
          count++;
        }
      }
      state.statusText = `Filled ${count} blocks (${x1},${y1}) -> (${x2},${y2})`;
      state.dragState = null;
    }
  }
}

export class ToolManager {
  constructor() {
    this.tools = {
      addBlock: new AddBlockTool(),
      drawRect: new DrawRectTool(),
      select: new SelectTool(),
      moveCamera: new MoveCameraTool(),
      eraser: new EraserTool(),
      fill: new FillTool(),
    };
  }

  get(name) {
    return this.tools[name];
  }
}
