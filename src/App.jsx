import { useState, useRef, useCallback } from 'react';
import Toolbar from './components/Toolbar.jsx';
import GameCanvas from './components/GameCanvas.jsx';
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
  const canvasRef = useRef(null);

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
        activeRampDir={activeRampDir}
        onRampDirChange={handleRampDirChange}
      />
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
      />
    </div>
  );
}
