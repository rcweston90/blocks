import { useState, useRef, useCallback, useEffect } from 'react';
import Toolbar from './components/Toolbar.jsx';
import GameCanvas from './components/GameCanvas.jsx';
import TouchControls from './components/TouchControls.jsx';
import './App.css';

export default function App() {
  const [mode, setMode] = useState('edit'); // 'edit' | 'drive'
  const [activeTool, setActiveTool] = useState('addWall');
  const [activeColor, setActiveColor] = useState('#98a8b8');
  const [activeFloorType, setActiveFloorType] = useState('boost');
  const [activeTheme, setActiveTheme] = useState('light');
  const [statusText, setStatusText] = useState('Ready.');
  const [bikeSpeed, setBikeSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [isCameraFollow, setIsCameraFollow] = useState(true);
  const [worldBoundary, setWorldBoundary] = useState(40);
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const [activeRampDir, setActiveRampDir] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const canvasRef = useRef(null);

  // ? key toggles help overlay
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShowHelp(prev => !prev);
      }
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showHelp]);

  const handleModeToggle = useCallback(() => {
    setMode(prev => {
      const next = prev === 'edit' ? 'drive' : 'edit';
      if (next === 'drive') {
        setBikeSpeed(1);
        setIsPaused(false);
        setIsCameraFollow(true);
      }
      return next;
    });
    setIsFirstPerson(false);
  }, []);

  const handleFirstPersonToggle = useCallback(() => {
    setIsFirstPerson(prev => !prev);
  }, []);

  const handleToolChange = useCallback((toolId) => {
    setActiveTool(toolId);
  }, []);

  const handleColorChange = useCallback((color) => {
    setActiveColor(color);
  }, []);

  const handleFloorTypeChange = useCallback((type) => {
    setActiveFloorType(type);
  }, []);

  const handleThemeChange = useCallback((themeId) => {
    setActiveTheme(themeId);
  }, []);

  const handleStatusChange = useCallback((text) => {
    setStatusText(text);
  }, []);

  const handleColorSync = useCallback((color) => {
    setActiveColor(prev => prev !== color ? color : prev);
  }, []);

  const handleDownload = useCallback(() => {
    canvasRef.current?.download();
  }, []);

  const handleUpload = useCallback((jsonText) => {
    canvasRef.current?.upload(jsonText);
  }, []);

  const handleGenerate = useCallback((layoutId) => {
    canvasRef.current?.generate(layoutId);
  }, []);

  const handleSpeedChange = useCallback((index) => {
    setBikeSpeed(index);
  }, []);

  const handlePauseToggle = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const handlePauseChange = useCallback((paused) => {
    setIsPaused(paused);
  }, []);

  const handleCameraFollowChange = useCallback((follow) => {
    setIsCameraFollow(follow);
  }, []);

  const handleCameraFollowToggle = useCallback(() => {
    setIsCameraFollow(prev => !prev);
  }, []);

  const handleBoundaryChange = useCallback((size) => {
    setWorldBoundary(size);
  }, []);

  const handleRampDirChange = useCallback((dir) => {
    setActiveRampDir(dir);
  }, []);

  const handleReset = useCallback(() => {
    setIsPaused(false);
    setBikeSpeed(1);
    canvasRef.current?.resetBike?.();
  }, []);

  return (
    <div className="app-layout">
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Keyboard Shortcuts</h2>
            <div className="help-columns">
              <div className="help-column">
                <h3>Edit Mode</h3>
                <div className="help-row"><kbd>B</kbd> Wall tool</div>
                <div className="help-row"><kbd>G</kbd> Floor tool</div>
                <div className="help-row"><kbd>N</kbd> Coin tool</div>
                <div className="help-row"><kbd>R</kbd> Rectangle tool</div>
                <div className="help-row"><kbd>F</kbd> Fill tool</div>
                <div className="help-row"><kbd>S</kbd> Select tool</div>
                <div className="help-row"><kbd>V</kbd> Pan camera</div>
                <div className="help-row"><kbd>X</kbd> Eraser</div>
                <div className="help-row"><kbd>I</kbd> Eyedropper</div>
                <div className="help-row"><kbd>D</kbd> Cycle ramp dir</div>
                <div className="help-row"><kbd>[ ]</kbd> Adjust height</div>
                <div className="help-row"><kbd>Ctrl+C</kbd> Copy block</div>
                <div className="help-row"><kbd>Ctrl+V</kbd> Paste block</div>
                <div className="help-row"><kbd>Ctrl+Z</kbd> Undo</div>
                <div className="help-row"><kbd>Ctrl+Shift+Z</kbd> Redo</div>
                <div className="help-row"><kbd>Del</kbd> Delete selected</div>
              </div>
              <div className="help-column">
                <h3>Drive Mode</h3>
                <div className="help-row"><kbd>Arrows/WASD</kbd> Steer</div>
                <div className="help-row"><kbd>Space</kbd> Jump / Pause</div>
                <div className="help-row"><kbd>Shift</kbd> Boost</div>
                <div className="help-row"><kbd>1-5</kbd> Set speed</div>
                <div className="help-row"><kbd>+/-</kbd> Speed up/down</div>
                <div className="help-row"><kbd>R</kbd> Reset bike</div>
                <div className="help-row"><kbd>C</kbd> Camera follow</div>
                <div className="help-row"><kbd>G</kbd> Ghost trail</div>
                <div className="help-row"><kbd>I</kbd> Invincible</div>
                <div className="help-row"><kbd>F</kbd> First-person</div>
                <div className="help-row"><kbd>M</kbd> Toggle minimap</div>
                <div className="help-row"><kbd>H</kbd> Cycle HUD</div>
              </div>
              <div className="help-column">
                <h3>Global</h3>
                <div className="help-row"><kbd>Q/E</kbd> Rotate camera</div>
                <div className="help-row"><kbd>T</kbd> Cycle theme</div>
                <div className="help-row"><kbd>Scroll</kbd> Zoom</div>
                <div className="help-row"><kbd>?</kbd> Toggle this help</div>
              </div>
            </div>
            <button className="help-close" onClick={() => setShowHelp(false)}>Close</button>
          </div>
        </div>
      )}
      <GameCanvas
        ref={canvasRef}
        mode={mode}
        activeTool={activeTool}
        activeColor={activeColor}
        activeFloorType={activeFloorType}
        activeTheme={activeTheme}
        bikeSpeed={bikeSpeed}
        isPaused={isPaused}
        isFirstPerson={isFirstPerson}
        onStatusChange={handleStatusChange}
        onColorSync={handleColorSync}
        onToolChange={handleToolChange}
        onSpeedChange={handleSpeedChange}
        onPauseChange={handlePauseChange}
        onCameraFollowChange={handleCameraFollowChange}
        onThemeChange={handleThemeChange}
        onFirstPersonToggle={handleFirstPersonToggle}
        isCameraFollow={isCameraFollow}
        worldBoundary={worldBoundary}
        onBoundaryChange={handleBoundaryChange}
        activeRampDir={activeRampDir}
        onRampDirChange={handleRampDirChange}
      />
      {mode === 'drive' && (
        <TouchControls
          onDirection={(dir) => canvasRef.current?.steer(dir)}
          onJump={() => canvasRef.current?.jump()}
          onBoost={() => canvasRef.current?.startBoost()}
          onBoostEnd={() => canvasRef.current?.endBoost()}
        />
      )}
      <Toolbar
        mode={mode}
        activeTool={activeTool}
        activeColor={activeColor}
        activeFloorType={activeFloorType}
        activeTheme={activeTheme}
        statusText={statusText}
        bikeSpeed={bikeSpeed}
        isPaused={isPaused}
        isFirstPerson={isFirstPerson}
        onToolChange={handleToolChange}
        onColorChange={handleColorChange}
        onFloorTypeChange={handleFloorTypeChange}
        onThemeChange={handleThemeChange}
        onModeToggle={handleModeToggle}
        onDownload={handleDownload}
        onUpload={handleUpload}
        onGenerate={handleGenerate}
        onSpeedChange={handleSpeedChange}
        onPauseToggle={handlePauseToggle}
        onCameraFollowToggle={handleCameraFollowToggle}
        onFirstPersonToggle={handleFirstPersonToggle}
        isCameraFollow={isCameraFollow}
        onReset={handleReset}
        worldBoundary={worldBoundary}
        onBoundaryChange={handleBoundaryChange}
        activeRampDir={activeRampDir}
        onRampDirChange={handleRampDirChange}
        onHelpToggle={() => setShowHelp(prev => !prev)}
      />
    </div>
  );
}
