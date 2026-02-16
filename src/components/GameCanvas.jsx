import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { AppState } from '../engine/state.js';
import { ToolManager } from '../engine/tools.js';
import { FPSTracker } from '../engine/fps.js';
import { Renderer } from '../engine/renderer.js';
import { BikeState, DIRECTIONS, SPEED_LABELS } from '../engine/bike.js';
import { screenToGrid } from '../engine/math.js';

const GameCanvas = forwardRef(function GameCanvas({
  mode,
  activeTool,
  activeColor,
  bikeSpeed,
  isPaused,
  onStatusChange,
  onColorSync,
  onToolChange,
  onSpeedChange,
  onPauseChange,
  onCameraFollowChange,
  isCameraFollow,
}, ref) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  // Expose download/upload to parent via ref
  useImperativeHandle(ref, () => ({
    download() {
      const engine = engineRef.current;
      if (!engine) return;
      const json = engine.state.toJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'isometric-scene.json';
      a.click();
      URL.revokeObjectURL(url);
      engine.state.statusText = 'JSON downloaded.';
    },
    upload(jsonText) {
      const engine = engineRef.current;
      if (!engine) return;
      try {
        engine.state.fromJSON(jsonText);
        engine.state.statusText = `Loaded: ${engine.state.blocks.length} blocks, ${engine.state.rectangles.length} rectangles.`;
      } catch {
        engine.state.statusText = 'Error loading JSON.';
      }
    },
    resetBike() {
      const engine = engineRef.current;
      if (!engine || !engine.bike) return;
      engine.bike.reset();
      engine.state.statusText = 'Bike reset';
    },
  }), []);

  // Initialize engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const state = new AppState();
    const toolManager = new ToolManager();
    const fpsTracker = new FPSTracker();
    const renderer = new Renderer(canvas, state, fpsTracker);

    engineRef.current = { state, toolManager, fpsTracker, renderer, ctx, bike: null };

    // Resize handler
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (state.camera.x === 0 && state.camera.y === 0) {
        state.camera.x = rect.width / 2;
        state.camera.y = rect.height / 3;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    // Animation loop
    let rafId;
    let lastStatusText = '';
    const loop = () => {
      const now = performance.now();
      const engine = engineRef.current;

      // Tick bike in drive mode
      if (engine.bike) {
        engine.bike.tick(now, state);
      }

      renderer.frame(now);

      // Push status text changes up to React
      if (state.statusText !== lastStatusText) {
        lastStatusText = state.statusText;
        onStatusChange(state.statusText);
      }

      // Sync color picker when block is selected
      const sel = state.selection;
      if (sel && sel.type === 'block') {
        const block = state.blocks[sel.index];
        if (block) {
          onColorSync(block.color);
        }
      }

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    // Mouse helpers -- account for zoom
    const getCanvasPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const getCell = (e) => {
      const pos = getCanvasPos(e);
      const zoom = state.camera.zoom || 1.0;
      return screenToGrid(pos.x / zoom, pos.y / zoom, {
        x: state.camera.x / zoom,
        y: state.camera.y / zoom,
      });
    };

    const onMouseDown = (e) => {
      const cell = getCell(e);
      const tool = toolManager.get(state.activeTool);
      if (tool) tool.onMouseDown(state, cell, e);
      if (state.activeTool === 'moveCamera') {
        canvas.style.cursor = 'grabbing';
      }
    };

    const onMouseMove = (e) => {
      const cell = getCell(e);
      state.hoverCell = cell;
      const tool = toolManager.get(state.activeTool);
      if (tool) tool.onMouseMove(state, cell, e);
    };

    const onMouseUp = (e) => {
      const cell = getCell(e);
      const tool = toolManager.get(state.activeTool);
      if (tool) tool.onMouseUp(state, cell, e);
      if (state.activeTool === 'moveCamera') {
        canvas.style.cursor = 'grab';
      }
    };

    const onMouseLeave = () => {
      state.hoverCell = null;
    };

    // Scroll wheel zoom
    const onWheel = (e) => {
      e.preventDefault();
      const zoom = state.camera.zoom || 1.0;
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.5, Math.min(2.0, zoom + delta));
      if (newZoom === zoom) return;

      // Zoom toward mouse position
      const pos = getCanvasPos(e);
      const factor = newZoom / zoom;
      state.camera.x = pos.x - (pos.x - state.camera.x) * factor;
      state.camera.y = pos.y - (pos.y - state.camera.y) * factor;
      state.camera.zoom = newZoom;
      state.statusText = `Zoom: ${Math.round(newZoom * 100)}%`;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync mode changes
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const { state, renderer } = engine;

    if (mode === 'drive') {
      const bike = new BikeState();
      engine.bike = bike;
      renderer.bike = bike;
      state.activeTool = 'moveCamera';
      state.selection = null;
      state.dragState = null;
      state.statusText = 'Drive mode -- use arrow keys or WASD!';
      canvasRef.current.style.cursor = 'grab';
    } else {
      engine.bike = null;
      renderer.bike = null;
      state.statusText = 'Ready.';
    }
  }, [mode]);

  // Sync active tool
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const { state } = engine;

    if (mode === 'drive') {
      state.activeTool = 'moveCamera';
    } else {
      state.activeTool = activeTool;
      state.selection = null;
      state.dragState = null;

      if (activeTool === 'moveCamera') {
        canvasRef.current.style.cursor = 'grab';
      } else if (activeTool === 'select') {
        canvasRef.current.style.cursor = 'default';
      } else {
        canvasRef.current.style.cursor = 'crosshair';
      }
    }
  }, [activeTool, mode]);

  // Sync active color
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const { state } = engine;
    state.activeColor = activeColor;

    // Update selected block color in edit mode
    if (state.selection && state.selection.type === 'block') {
      const block = state.blocks[state.selection.index];
      if (block) block.color = activeColor;
    }

    // Sync trail color in drive mode
    if (engine.bike) {
      engine.bike.trailColor = activeColor;
    }
  }, [activeColor]);

  // Sync bike speed from toolbar
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engine.bike) return;
    engine.bike.setSpeedIndex(bikeSpeed);
  }, [bikeSpeed]);

  // Sync pause state from toolbar
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engine.bike) return;
    engine.bike.paused = isPaused;
  }, [isPaused]);

  // Sync camera follow from toolbar
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engine.bike) return;
    engine.bike.cameraFollow = isCameraFollow;
  }, [isCameraFollow]);

  // Edit-mode keyboard shortcuts
  useEffect(() => {
    if (mode !== 'edit') return;

    const handler = (e) => {
      const engine = engineRef.current;
      if (!engine) return;
      const { state, toolManager } = engine;

      // Don't capture if user is in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key;
      const isCmd = e.metaKey || e.ctrlKey;

      // Undo: Cmd+Z
      if (isCmd && !e.shiftKey && key === 'z') {
        e.preventDefault();
        if (state.undo()) {
          state.statusText = 'Undo';
        }
        return;
      }

      // Redo: Cmd+Shift+Z or Ctrl+Y
      if ((isCmd && e.shiftKey && key === 'z') || (isCmd && key === 'y')) {
        e.preventDefault();
        if (state.redo()) {
          state.statusText = 'Redo';
        }
        return;
      }

      // Don't process tool shortcuts if modifier is held
      if (isCmd) return;

      // Tool switching
      const toolMap = {
        b: 'addBlock', B: 'addBlock',
        r: 'drawRect', R: 'drawRect',
        s: 'select', S: 'select',
        v: 'moveCamera', V: 'moveCamera',
        e: 'eraser', E: 'eraser',
        f: 'fill', F: 'fill',
      };

      if (toolMap[key]) {
        e.preventDefault();
        if (onToolChange) onToolChange(toolMap[key]);
        return;
      }

      // Escape -- deselect + clear drag
      if (key === 'Escape') {
        state.selection = null;
        state.dragState = null;
        state.statusText = 'Ready.';
        return;
      }

      // Delete / Backspace -- delete selected
      if (key === 'Delete' || key === 'Backspace') {
        const sel = state.selection;
        if (!sel) return;
        e.preventDefault();
        state.pushUndo();
        if (sel.type === 'block') {
          state.deleteBlock(sel.index);
          state.statusText = 'Block deleted';
        } else if (sel.type === 'rect') {
          state.deleteRectangle(sel.index);
          state.statusText = 'Rectangle deleted';
        }
        return;
      }

      // T -- toggle neon theme (works in edit mode too)
      if (key === 't' || key === 'T') {
        e.preventDefault();
        const { renderer } = engine;
        renderer.neonTheme = !renderer.neonTheme;
        state.statusText = `Neon theme: ${renderer.neonTheme ? 'ON' : 'OFF'}`;
        return;
      }

      // Height adjustment: ] raise, [ lower
      if (key === ']') {
        const selectTool = toolManager.get('select');
        selectTool.adjustHeight(state, 1);
        return;
      }
      if (key === '[') {
        const selectTool = toolManager.get('select');
        selectTool.adjustHeight(state, -1);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, onToolChange]);

  // Drive-mode keyboard handler
  useEffect(() => {
    if (mode !== 'drive') return;

    const onKeyDown = (e) => {
      const engine = engineRef.current;
      if (!engine || !engine.bike) return;
      const bike = engine.bike;

      // Don't capture if user is in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Direction keys (arrow + WASD)
      const dir = DIRECTIONS[e.key];
      if (dir) {
        e.preventDefault();
        if (!bike.alive) {
          bike.reset();
          engine.state.statusText = 'Drive mode -- use arrow keys or WASD!';
          if (onPauseChange) onPauseChange(false);
        } else {
          bike.setDirection(dir);
        }
        return;
      }

      // Speed presets: 1-5
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        bike.setSpeedIndex(idx);
        engine.state.statusText = `Speed: ${SPEED_LABELS[idx]}`;
        if (onSpeedChange) onSpeedChange(idx);
        return;
      }

      // Speed increment/decrement: +/-
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const newIdx = Math.min(4, bike.speedIndex + 1);
        bike.setSpeedIndex(newIdx);
        engine.state.statusText = `Speed: ${SPEED_LABELS[newIdx]}`;
        if (onSpeedChange) onSpeedChange(newIdx);
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const newIdx = Math.max(0, bike.speedIndex - 1);
        bike.setSpeedIndex(newIdx);
        engine.state.statusText = `Speed: ${SPEED_LABELS[newIdx]}`;
        if (onSpeedChange) onSpeedChange(newIdx);
        return;
      }

      // Space -- toggle pause
      if (e.key === ' ') {
        e.preventDefault();
        bike.togglePause();
        engine.state.statusText = bike.paused ? 'Paused' : 'Resumed';
        if (onPauseChange) onPauseChange(bike.paused);
        return;
      }

      // R -- reset
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        bike.reset();
        engine.state.statusText = 'Bike reset';
        if (onPauseChange) onPauseChange(false);
        if (onSpeedChange) onSpeedChange(bike.speedIndex);
        return;
      }

      // Shift -- boost (keydown)
      if (e.key === 'Shift') {
        bike.boosting = true;
        return;
      }

      // C -- toggle camera follow
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        bike.toggleCameraFollow();
        engine.state.statusText = `Camera follow: ${bike.cameraFollow ? 'ON' : 'OFF'}`;
        if (onCameraFollowChange) onCameraFollowChange(bike.cameraFollow);
        return;
      }

      // G -- toggle ghost trail
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        bike.toggleGhostTrail();
        engine.state.statusText = `Ghost trail: ${bike.ghostTrail ? 'ON' : 'OFF'}`;
        return;
      }

      // I -- toggle invincibility
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        bike.toggleInvincible();
        engine.state.statusText = `Invincible: ${bike.invincible ? 'ON' : 'OFF'}`;
        return;
      }

      // T -- toggle neon theme
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        engine.renderer.neonTheme = !engine.renderer.neonTheme;
        engine.state.statusText = `Neon theme: ${engine.renderer.neonTheme ? 'ON' : 'OFF'}`;
        return;
      }
    };

    const onKeyUp = (e) => {
      const engine = engineRef.current;
      if (!engine || !engine.bike) return;

      // Shift release -- stop boost
      if (e.key === 'Shift') {
        engine.bike.boosting = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [mode, onSpeedChange, onPauseChange, onCameraFollowChange]);

  return <canvas ref={canvasRef} id="canvas" />;
});

export default GameCanvas;
