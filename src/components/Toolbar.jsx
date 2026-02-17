import { useRef } from 'react';
import { FLOOR_TYPES } from '../engine/blockTypes.js';
import { THEME_LIST } from '../engine/themes.js';
import { MAP_LAYOUTS } from '../engine/mapGenerator.js';

const PLACE_TOOLS = [
  { id: 'addWall', label: 'Wall', shortcut: 'B' },
  { id: 'paintFloor', label: 'Floor', shortcut: 'G' },
  { id: 'placeCoin', label: 'Coin', shortcut: 'N' },
];

const SHAPE_TOOLS = [
  { id: 'drawRect', label: 'Rect', shortcut: 'R' },
  { id: 'fill', label: 'Fill', shortcut: 'F' },
];

const NAV_TOOLS = [
  { id: 'select', label: 'Select', shortcut: 'S' },
  { id: 'moveCamera', label: 'Pan', shortcut: 'V' },
  { id: 'eraser', label: 'Eraser', shortcut: 'X' },
];

const SPEED_LABELS = ['Slow', 'Normal', 'Fast', 'Faster', 'Max'];
const BOUNDARY_PRESETS = [25, 40, 60, 80, 120, 200];
const RAMP_DIRS = ['N', 'E', 'S', 'W'];

function ToolButton({ tool, activeTool, onToolChange }) {
  return (
    <button
      className={activeTool === tool.id ? 'active' : ''}
      onClick={() => onToolChange(tool.id)}
      title={`${tool.label} (${tool.shortcut})`}
      aria-pressed={activeTool === tool.id}
    >
      {tool.label}
    </button>
  );
}

export default function Toolbar({
  mode,
  activeTool,
  activeColor,
  activeFloorType,
  activeTheme,
  statusText,
  bikeSpeed,
  isPaused,
  isFirstPerson,
  isCameraFollow,
  onToolChange,
  onColorChange,
  onFloorTypeChange,
  onThemeChange,
  onModeToggle,
  onDownload,
  onUpload,
  onGenerate,
  onSpeedChange,
  onPauseToggle,
  onCameraFollowToggle,
  onFirstPersonToggle,
  onReset,
  worldBoundary,
  onBoundaryChange,
  activeRampDir,
  onRampDirChange,
}) {
  const fileInputRef = useRef(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUpload(ev.target.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const showColorPicker = mode === 'drive' || (mode === 'edit' && activeTool === 'addWall');
  const showFloorTypes = mode === 'edit' && activeTool === 'paintFloor';

  return (
    <>
      <div id="toolbar-top">
        <div className="toolbar-group" role="group" aria-label="Theme">
          <select
            className="toolbar-select"
            value={activeTheme || 'light'}
            onChange={(e) => onThemeChange(e.target.value)}
            title="Visual theme (T)"
          >
            {THEME_LIST.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        {mode === 'edit' && (
          <div className="toolbar-group" role="group" aria-label="File">
            <button onClick={onDownload}>Save</button>
            <button onClick={handleUploadClick}>Load</button>
            <select
              className="toolbar-select"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onGenerate(e.target.value);
                  e.target.value = '';
                }
              }}
              title="Generate a preset map"
            >
              <option value="" disabled>Generate...</option>
              {MAP_LAYOUTS.map(l => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
        )}

        <label className="toolbar-speed-group" title="World boundary size" role="group" aria-label="Boundary">
          <span className="toolbar-label">Bounds</span>
          <select
            className="toolbar-select"
            value={worldBoundary ?? 40}
            onChange={(e) => onBoundaryChange(parseInt(e.target.value))}
          >
            {BOUNDARY_PRESETS.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      <div id="toolbar">
        <div className="toolbar-inner">
          {mode === 'edit' && (
            <div className="toolbar-edit-section toolbar-section">
              <div className="toolbar-pill" role="group" aria-label="Place tools">
                {PLACE_TOOLS.map(tool => (
                  <ToolButton key={tool.id} tool={tool} activeTool={activeTool} onToolChange={onToolChange} />
                ))}
              </div>
              <div className="toolbar-pill" role="group" aria-label="Shape tools">
                {SHAPE_TOOLS.map(tool => (
                  <ToolButton key={tool.id} tool={tool} activeTool={activeTool} onToolChange={onToolChange} />
                ))}
              </div>
              <div className="toolbar-pill" role="group" aria-label="Navigation tools">
                {NAV_TOOLS.map(tool => (
                  <ToolButton key={tool.id} tool={tool} activeTool={activeTool} onToolChange={onToolChange} />
                ))}
              </div>
            </div>
          )}

          {mode === 'drive' && (
            <div className="toolbar-drive-section toolbar-section">
              <div className="toolbar-pill" role="group" aria-label="Playback">
                <button onClick={onPauseToggle} aria-pressed={isPaused}>
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button onClick={onReset}>Reset</button>
              </div>
              <div className="toolbar-pill" role="group" aria-label="Camera">
                <button
                  onClick={onCameraFollowToggle}
                  className={isCameraFollow ? 'active drive-active' : ''}
                  title="Toggle camera follow (C)"
                  aria-pressed={isCameraFollow}
                >
                  Follow
                </button>
                <button
                  onClick={onFirstPersonToggle}
                  className={isFirstPerson ? 'active drive-active' : ''}
                  title="First-person view (F)"
                  aria-pressed={isFirstPerson}
                >
                  FP
                </button>
              </div>
              <div className="toolbar-pill" role="group" aria-label="Speed">
                <span className="toolbar-label">{SPEED_LABELS[bikeSpeed ?? 1]}</span>
                <input
                  type="range"
                  min={0}
                  max={4}
                  value={bikeSpeed ?? 1}
                  onChange={(e) => onSpeedChange(parseInt(e.target.value))}
                  className="speed-slider"
                  aria-label="Bike speed"
                />
              </div>
            </div>
          )}

          <div className="toolbar-mode-toggle" role="tablist" aria-label="Edit or Drive mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'edit'}
              className={mode === 'edit' ? 'mode-toggle-active' : ''}
              onClick={() => mode !== 'edit' && onModeToggle()}
            >
              Edit
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'drive'}
              className={mode === 'drive' ? 'drive-toggle-active' : ''}
              onClick={() => mode !== 'drive' && onModeToggle()}
            >
              Drive
            </button>
          </div>

          {showFloorTypes && (
            <div className="toolbar-edit-section toolbar-section">
              <div className="toolbar-pill toolbar-floor-types" role="group" aria-label="Floor type">
                {FLOOR_TYPES.map(ft => (
                  <button
                    key={ft.id}
                    className={activeFloorType === ft.id ? 'active' : ''}
                    style={{ borderLeftColor: ft.defaultColor }}
                    onClick={() => onFloorTypeChange(ft.id)}
                    title={ft.label}
                    aria-pressed={activeFloorType === ft.id}
                  >
                    {ft.label}
                  </button>
                ))}
                {(activeFloorType === 'ramp' || activeFloorType === 'start') && (
                  <button
                    className="toolbar-ramp-dir"
                    onClick={() => onRampDirChange(((activeRampDir || 0) + 1) % 4)}
                    title="Cycle ramp direction (D)"
                  >
                    {RAMP_DIRS[activeRampDir || 0]}
                  </button>
                )}
              </div>
            </div>
          )}

          {showColorPicker && (
            <div className="toolbar-edit-section toolbar-section">
              <label className="toolbar-pill toolbar-color-group" aria-label={mode === 'drive' ? 'Trail color' : 'Wall color'}>
                <span className="toolbar-label">{mode === 'drive' ? 'Trail' : 'Color'}</span>
                <input
                  type="color"
                  id="color-picker"
                  value={activeColor}
                  onChange={(e) => onColorChange(e.target.value)}
                  aria-label={mode === 'drive' ? 'Trail color' : 'Wall color'}
                />
              </label>
            </div>
          )}
        </div>

        <div className="toolbar-status" role="status" aria-live="polite">
          {statusText}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          hidden
          onChange={handleFileChange}
        />
      </div>
    </>
  );
}
