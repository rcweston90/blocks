import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { AppState } from '../engine/state.js';
import { ToolManager } from '../engine/tools.js';
import { FPSTracker } from '../engine/fps.js';
import { Renderer } from '../engine/renderer.js';
import { FirstPersonRenderer } from '../engine/firstPersonRenderer.js';
import { BikeState, DIRECTIONS, SPEED_LABELS } from '../engine/bike.js';
import { generateMap } from '../engine/mapGenerator.js';
import { screenToGrid, rotateDirection } from '../engine/math.js';
import { THEMES, getNextTheme } from '../engine/themes.js';
const GameCanvas = forwardRef(function GameCanvas({
  mode,
  activeTool,
  activeColor,
  activeFloorType,
  activeTheme,
  bikeSpeed,
  isPaused,
  isFirstPerson,
  onStatusChange,
  onColorSync,
  onToolChange,
  onSpeedChange,
  onPauseChange,
  onCameraFollowChange,
  onThemeChange,
  onFirstPersonToggle,
  isCameraFollow,
  worldBoundary,
  activeRampDir,
  onRampDirChange,
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
      engine.bike.reset(engine.state.getStartBlock());
      engine.state.statusText = 'Bike reset';
    },
    generate(layoutId) {
      const engine = engineRef.current;
      if (!engine) return;
      generateMap(engine.state, layoutId);
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
    const fpRenderer = new FirstPersonRenderer(canvas, state, fpsTracker);

    engineRef.current = { state, toolManager, fpsTracker, renderer, fpRenderer, ctx, bike: null, isFirstPerson: false };

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

      if (engine.isFirstPerson && engine.bike) {
        fpRenderer.frame(now);
      } else {
        renderer.frame(now);
      }

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

    // Mouse helpers
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
        rotation: state.camera.rotation,
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
      const startBlock = state.getStartBlock();
      if (startBlock) bike.reset(startBlock);
      engine.bike = bike;
      renderer.bike = bike;
      engine.fpRenderer.bike = bike;
      engine.fpRenderer.theme = renderer.theme;
      state.activeTool = 'moveCamera';
      state.selection = null;
      state.dragState = null;
      state.statusText = 'Drive mode -- use arrow keys or WASD!';
      canvasRef.current.style.cursor = 'grab';
    } else {
      engine.bike = null;
      renderer.bike = null;
      engine.fpRenderer.bike = null;
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

    if (state.selection && state.selection.type === 'block') {
      const block = state.blocks[state.selection.index];
      if (block) block.color = activeColor;
    }

    if (engine.bike) {
      engine.bike.trailColor = activeColor;
    }
  }, [activeColor]);

  // Sync active floor type
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.state.activeFloorType = activeFloorType || 'boost';
  }, [activeFloorType]);

  // Sync theme
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const theme = THEMES[activeTheme];
    if (theme) {
      engine.renderer.theme = theme;
      engine.fpRenderer.theme = theme;
    }
  }, [activeTheme]);

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

  // Sync world boundary from toolbar
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.state.worldBoundary = worldBoundary ?? 40;
  }, [worldBoundary]);

  // Sync active ramp direction
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.state.activeRampDir = activeRampDir ?? 0;
  }, [activeRampDir]);

  // Sync first-person mode
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.isFirstPerson = isFirstPerson;
  }, [isFirstPerson]);

  // Camera rotation (Q/E) — always active in all modes
  useEffect(() => {
    const handler = (e) => {
      const engine = engineRef.current;
      if (!engine) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.metaKey || e.ctrlKey) return;

      if (engine.isFirstPerson) return; // Q/E not applicable in FP mode
      const { state } = engine;
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        const cam = state.camera;
        cam.rotationIndex = (cam.rotationIndex + 3) % 4;
        cam.targetRotation -= Math.PI / 2;
        state.statusText = `Rotate left (${cam.rotationIndex * 90}°)`;
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        const cam = state.camera;
        cam.rotationIndex = (cam.rotationIndex + 1) % 4;
        cam.targetRotation += Math.PI / 2;
        state.statusText = `Rotate right (${cam.rotationIndex * 90}°)`;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Edit-mode keyboard shortcuts
  useEffect(() => {
    if (mode !== 'edit') return;

    const handler = (e) => {
      const engine = engineRef.current;
      if (!engine) return;
      const { state, toolManager } = engine;

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      const key = e.key;
      const isCmd = e.metaKey || e.ctrlKey;

      if (isCmd && !e.shiftKey && key === 'z') {
        e.preventDefault();
        if (state.undo()) {
          state.statusText = 'Undo';
        }
        return;
      }

      if ((isCmd && e.shiftKey && key === 'z') || (isCmd && key === 'y')) {
        e.preventDefault();
        if (state.redo()) {
          state.statusText = 'Redo';
        }
        return;
      }

      if (isCmd) return;

      const toolMap = {
        b: 'addWall', B: 'addWall',
        g: 'paintFloor', G: 'paintFloor',
        n: 'placeCoin', N: 'placeCoin',
        r: 'drawRect', R: 'drawRect',
        s: 'select', S: 'select',
        v: 'moveCamera', V: 'moveCamera',
        x: 'eraser', X: 'eraser',
        f: 'fill', F: 'fill',
      };

      if (toolMap[key]) {
        e.preventDefault();
        if (onToolChange) onToolChange(toolMap[key]);
        return;
      }

      if (key === 'Escape') {
        state.selection = null;
        state.dragState = null;
        state.statusText = 'Ready.';
        return;
      }

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

      // T -- cycle theme
      if (key === 't' || key === 'T') {
        e.preventDefault();
        const { renderer } = engine;
        const nextTheme = getNextTheme(renderer.theme.id);
        renderer.theme = nextTheme;
        if (onThemeChange) onThemeChange(nextTheme.id);
        state.statusText = `Theme: ${nextTheme.label}`;
        return;
      }

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

      // D — cycle ramp direction when floor tool + ramp type active
      if (key === 'd' || key === 'D') {
        if (state.activeTool === 'paintFloor' && state.activeFloorType === 'ramp') {
          e.preventDefault();
          const next = ((state.activeRampDir || 0) + 1) % 4;
          state.activeRampDir = next;
          const labels = ['N', 'E', 'S', 'W'];
          state.statusText = `Ramp direction: ${labels[next]}`;
          if (onRampDirChange) onRampDirChange(next);
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, onToolChange, onThemeChange, onRampDirChange]);

  // Drive-mode keyboard handler
  useEffect(() => {
    if (mode !== 'drive') return;

    const onKeyDown = (e) => {
      const engine = engineRef.current;
      if (!engine || !engine.bike) return;
      const bike = engine.bike;

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      // F: toggle first-person view
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (onFirstPersonToggle) onFirstPersonToggle();
        return;
      }

      const dir = DIRECTIONS[e.key];
      if (dir) {
        e.preventDefault();
        if (!bike.alive || bike.levelComplete) {
          bike.reset(engine.state.getStartBlock());
          engine.state.statusText = 'Drive mode -- use arrow keys or WASD!';
          if (onPauseChange) onPauseChange(false);
        } else if (engine.isFirstPerson) {
          // FP mode: left/right = relative turn, up/down = no-op
          const isLeft = e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A';
          const isRight = e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D';
          if (isLeft) {
            const d = bike.direction;
            bike.setDirection({ dgx: d.dgy, dgy: -d.dgx });
          } else if (isRight) {
            const d = bike.direction;
            bike.setDirection({ dgx: -d.dgy, dgy: d.dgx });
          }
          // Up/Down: no-op (bike auto-moves forward)
        } else {
          // Rotate direction so arrow keys stay screen-relative
          const rotated = rotateDirection(dir.dgx, dir.dgy, engine.state.camera.rotationIndex);
          bike.setDirection(rotated);
        }
        return;
      }

      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        bike.setSpeedIndex(idx);
        engine.state.statusText = `Speed: ${SPEED_LABELS[idx]}`;
        if (onSpeedChange) onSpeedChange(idx);
        return;
      }

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

      if (e.key === ' ') {
        e.preventDefault();
        bike.togglePause();
        engine.state.statusText = bike.paused ? 'Paused' : 'Resumed';
        if (onPauseChange) onPauseChange(bike.paused);
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        bike.reset(engine.state.getStartBlock());
        engine.state.statusText = 'Bike reset';
        if (onPauseChange) onPauseChange(false);
        if (onSpeedChange) onSpeedChange(bike.speedIndex);
        return;
      }

      if (e.key === 'Shift') {
        bike.boosting = true;
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        bike.toggleCameraFollow();
        engine.state.statusText = `Camera follow: ${bike.cameraFollow ? 'ON' : 'OFF'}`;
        if (onCameraFollowChange) onCameraFollowChange(bike.cameraFollow);
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        bike.toggleGhostTrail();
        engine.state.statusText = `Ghost trail: ${bike.ghostTrail ? 'ON' : 'OFF'}`;
        return;
      }

      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        bike.toggleInvincible();
        engine.state.statusText = `Invincible: ${bike.invincible ? 'ON' : 'OFF'}`;
        return;
      }

      // T -- cycle theme
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        const { renderer, fpRenderer } = engine;
        const nextTheme = getNextTheme(renderer.theme.id);
        renderer.theme = nextTheme;
        fpRenderer.theme = nextTheme;
        if (onThemeChange) onThemeChange(nextTheme.id);
        engine.state.statusText = `Theme: ${nextTheme.label}`;
        return;
      }
    };

    const onKeyUp = (e) => {
      const engine = engineRef.current;
      if (!engine || !engine.bike) return;

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
  }, [mode, onSpeedChange, onPauseChange, onCameraFollowChange, onThemeChange, onFirstPersonToggle]);

  return <canvas ref={canvasRef} id="canvas" />;
});

export default GameCanvas;
