import { useState, useRef, useCallback } from 'react';
import Toolbar from './components/Toolbar.jsx';
import GameCanvas from './components/GameCanvas.jsx';
import './App.css';

export default function App() {
  const [mode, setMode] = useState('edit'); // 'edit' | 'drive'
  const [activeTool, setActiveTool] = useState('addBlock');
  const [activeColor, setActiveColor] = useState('#98a8b8');
  const [statusText, setStatusText] = useState('Ready.');
  const [bikeSpeed, setBikeSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [isCameraFollow, setIsCameraFollow] = useState(true);
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
  }, []);

  const handleToolChange = useCallback((toolId) => {
    setActiveTool(toolId);
  }, []);

  const handleColorChange = useCallback((color) => {
    setActiveColor(color);
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

  const handleReset = useCallback(() => {
    // Reset is handled by GameCanvas via keyboard; this is the toolbar button path
    setIsPaused(false);
    setBikeSpeed(1);
    // Trigger reset on the bike via a prop change would be complex,
    // so we use the imperative ref approach
    canvasRef.current?.resetBike?.();
  }, []);

  return (
    <>
      <Toolbar
        mode={mode}
        activeTool={activeTool}
        activeColor={activeColor}
        statusText={statusText}
        bikeSpeed={bikeSpeed}
        isPaused={isPaused}
        onToolChange={handleToolChange}
        onColorChange={handleColorChange}
        onModeToggle={handleModeToggle}
        onDownload={handleDownload}
        onUpload={handleUpload}
        onSpeedChange={handleSpeedChange}
        onPauseToggle={handlePauseToggle}
        onCameraFollowToggle={handleCameraFollowToggle}
        isCameraFollow={isCameraFollow}
        onReset={handleReset}
      />
      <GameCanvas
        ref={canvasRef}
        mode={mode}
        activeTool={activeTool}
        activeColor={activeColor}
        bikeSpeed={bikeSpeed}
        isPaused={isPaused}
        onStatusChange={handleStatusChange}
        onColorSync={handleColorSync}
        onToolChange={handleToolChange}
        onSpeedChange={handleSpeedChange}
        onPauseChange={handlePauseChange}
        onCameraFollowChange={handleCameraFollowChange}
        isCameraFollow={isCameraFollow}
      />
    </>
  );
}
