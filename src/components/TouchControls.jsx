export default function TouchControls({ onDirection, onJump, onBoost, onBoostEnd }) {
  const handleTouch = (action) => (e) => {
    e.preventDefault();
    action();
  };

  return (
    <div className="touch-controls">
      <div className="dpad">
        <button
          className="dpad-btn dpad-up"
          onTouchStart={handleTouch(() => onDirection('up'))}
          onMouseDown={() => onDirection('up')}
          aria-label="Up"
        >
          &#9650;
        </button>
        <button
          className="dpad-btn dpad-left"
          onTouchStart={handleTouch(() => onDirection('left'))}
          onMouseDown={() => onDirection('left')}
          aria-label="Left"
        >
          &#9664;
        </button>
        <button
          className="dpad-btn dpad-right"
          onTouchStart={handleTouch(() => onDirection('right'))}
          onMouseDown={() => onDirection('right')}
          aria-label="Right"
        >
          &#9654;
        </button>
        <button
          className="dpad-btn dpad-down"
          onTouchStart={handleTouch(() => onDirection('down'))}
          onMouseDown={() => onDirection('down')}
          aria-label="Down"
        >
          &#9660;
        </button>
      </div>
      <div className="action-buttons">
        <button
          className="action-btn action-jump"
          onTouchStart={handleTouch(onJump)}
          onMouseDown={onJump}
          aria-label="Jump"
        >
          Jump
        </button>
        <button
          className="action-btn action-boost"
          onTouchStart={handleTouch(onBoost)}
          onTouchEnd={handleTouch(onBoostEnd)}
          onMouseDown={onBoost}
          onMouseUp={onBoostEnd}
          onMouseLeave={onBoostEnd}
          aria-label="Boost"
        >
          Boost
        </button>
      </div>
    </div>
  );
}
