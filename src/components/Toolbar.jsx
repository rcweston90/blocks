import { useRef } from 'react';

const EDIT_TOOLS = [
  { id: 'addBlock', label: 'Add Blocks', shortcut: 'B' },
  { id: 'drawRect', label: 'Draw Rect', shortcut: 'R' },
  { id: 'select', label: 'Select', shortcut: 'S' },
  { id: 'moveCamera', label: 'Move Camera', shortcut: 'V' },
  { id: 'eraser', label: 'Eraser', shortcut: 'E' },
  { id: 'fill', label: 'Fill', shortcut: 'F' },
];

const SPEED_LABELS = ['Slow', 'Normal', 'Fast', 'Faster', 'Max'];

export default function Toolbar({
  mode,
  activeTool,
  activeColor,
  statusText,
  bikeSpeed,
  isPaused,
  isCameraFollow,
  onToolChange,
  onColorChange,
  onModeToggle,
  onDownload,
  onUpload,
  onSpeedChange,
  onPauseToggle,
  onCameraFollowToggle,
  onReset,
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

  return (
    <div id="toolbar">
      <div id="toolbar-buttons">
        {mode === 'edit' && EDIT_TOOLS.map(tool => (
          <button
            key={tool.id}
            className={activeTool === tool.id ? 'active' : ''}
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
          >
            {tool.label}
          </button>
        ))}

        {mode === 'drive' && (
          <>
            <button onClick={onPauseToggle} className={isPaused ? 'active' : ''}>
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={onReset}>Reset</button>
            <button
              onClick={onCameraFollowToggle}
              className={isCameraFollow ? 'active' : ''}
              title="Toggle camera follow (C)"
            >
              Follow
            </button>
            <label className="toolbar-speed-group">
              <span className="toolbar-label">{SPEED_LABELS[bikeSpeed ?? 1]}</span>
              <input
                type="range"
                min={0}
                max={4}
                value={bikeSpeed ?? 1}
                onChange={(e) => onSpeedChange(parseInt(e.target.value))}
                className="speed-slider"
              />
            </label>
          </>
        )}

        <span className="toolbar-separator" />

        <button
          className={mode === 'drive' ? 'mode-toggle drive-active' : 'mode-toggle'}
          onClick={onModeToggle}
        >
          {mode === 'edit' ? 'Drive' : 'Edit'}
        </button>

        <span className="toolbar-separator" />

        <label className="toolbar-color-group">
          <span className="toolbar-label">{mode === 'drive' ? 'Trail' : 'Color'}</span>
          <input
            type="color"
            id="color-picker"
            value={activeColor}
            onChange={(e) => onColorChange(e.target.value)}
          />
        </label>

        {mode === 'edit' && (
          <>
            <button onClick={onDownload}>Download JSON</button>
            <button onClick={handleUploadClick}>Upload JSON</button>
          </>
        )}
      </div>
      <div id="status">{statusText}</div>
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        hidden
        onChange={handleFileChange}
      />
    </div>
  );
}
