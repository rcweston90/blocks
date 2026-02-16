const DIRECTIONS = {
  ArrowUp:    { dgx: 0, dgy: -1 },
  ArrowDown:  { dgx: 0, dgy: 1 },
  ArrowLeft:  { dgx: -1, dgy: 0 },
  ArrowRight: { dgx: 1, dgy: 0 },
  w: { dgx: 0, dgy: -1 },
  W: { dgx: 0, dgy: -1 },
  a: { dgx: -1, dgy: 0 },
  A: { dgx: -1, dgy: 0 },
  s: { dgx: 0, dgy: 1 },
  S: { dgx: 0, dgy: 1 },
  d: { dgx: 1, dgy: 0 },
  D: { dgx: 1, dgy: 0 },
};

export { DIRECTIONS };

const SPEED_PRESETS = [300, 200, 150, 100, 50];
const SPEED_LABELS = ['Slow', 'Normal', 'Fast', 'Faster', 'Max'];

export { SPEED_PRESETS, SPEED_LABELS };

export class BikeState {
  constructor() {
    this.gx = 0;
    this.gy = 0;
    this.prevGx = 0;
    this.prevGy = 0;
    this.direction = { dgx: 1, dgy: 0 };
    this.alive = true;
    this.trail = [];
    this.speedIndex = 1;
    this.speed = SPEED_PRESETS[this.speedIndex];
    this.lastMoveTime = 0;
    this.flashUntil = 0;
    this.paused = false;
    this.boosting = false;
    this.trailColor = '#00fff2';
    this.cellsTraveled = 0;

    // Camera follow (feature 2)
    this.cameraFollow = true;

    // Score / timer (feature 4)
    this.startTime = 0;
    this.highScore = 0;
    this.pausedDuration = 0;
    this.pauseStartTime = 0;

    // Ghost trail (feature 5)
    this.ghostTrail = false;

    // Invincibility (feature 6)
    this.invincible = false;
  }

  get effectiveSpeed() {
    const base = this.speed;
    return this.boosting ? Math.max(base * 0.5, 50) : base;
  }

  reset() {
    // Update high score before clearing
    this.highScore = Math.max(this.highScore, this.cellsTraveled);

    this.gx = 0;
    this.gy = 0;
    this.prevGx = 0;
    this.prevGy = 0;
    this.direction = { dgx: 1, dgy: 0 };
    this.alive = true;
    this.trail = [];
    this.lastMoveTime = 0;
    this.flashUntil = 0;
    this.paused = false;
    this.boosting = false;
    this.cellsTraveled = 0;
    this.startTime = 0;
    this.pausedDuration = 0;
    this.pauseStartTime = 0;
    // Preserve: cameraFollow, ghostTrail, invincible, highScore
  }

  setDirection(d) {
    // Reject 180-degree reversal
    if (d.dgx + this.direction.dgx === 0 && d.dgy + this.direction.dgy === 0) {
      return;
    }
    this.direction = d;
  }

  setSpeedIndex(i) {
    this.speedIndex = Math.max(0, Math.min(SPEED_PRESETS.length - 1, i));
    this.speed = SPEED_PRESETS[this.speedIndex];
  }

  togglePause() {
    const now = performance.now();
    if (!this.paused) {
      // Entering pause
      this.pauseStartTime = now;
    } else {
      // Leaving pause -- accumulate paused duration
      if (this.pauseStartTime > 0) {
        this.pausedDuration += now - this.pauseStartTime;
        this.pauseStartTime = 0;
      }
    }
    this.paused = !this.paused;
  }

  toggleCameraFollow() {
    this.cameraFollow = !this.cameraFollow;
  }

  toggleGhostTrail() {
    this.ghostTrail = !this.ghostTrail;
  }

  toggleInvincible() {
    this.invincible = !this.invincible;
  }

  getVisualPosition(now) {
    if (this.paused || !this.alive) {
      return { gx: this.gx, gy: this.gy };
    }

    const elapsed = now - this.lastMoveTime;
    const t = Math.min(elapsed / this.effectiveSpeed, 1);
    // Ease-out: 1 - (1-t)^2
    const eased = 1 - (1 - t) * (1 - t);

    return {
      gx: this.prevGx + (this.gx - this.prevGx) * eased,
      gy: this.prevGy + (this.gy - this.prevGy) * eased,
    };
  }

  getElapsedSeconds(now) {
    if (this.startTime === 0) return 0;
    let paused = this.pausedDuration;
    if (this.paused && this.pauseStartTime > 0) {
      paused += now - this.pauseStartTime;
    }
    return (now - this.startTime - paused) / 1000;
  }

  tick(now, appState) {
    if (!this.alive) return;
    if (this.paused) return;
    if (now - this.lastMoveTime < this.effectiveSpeed) return;

    // Start timer on first move
    if (this.cellsTraveled === 0) {
      this.startTime = now;
    }

    // Add current position to trail
    if (this.ghostTrail && this.trail.length >= 5000) {
      // Cap ghost trail at 5000 entries
    } else {
      this.trail.push({ gx: this.gx, gy: this.gy, time: now });
    }

    // Store previous position for interpolation
    this.prevGx = this.gx;
    this.prevGy = this.gy;

    // Compute next position
    const nextGx = this.gx + this.direction.dgx;
    const nextGy = this.gy + this.direction.dgy;

    // Collision check: any block at ground level (z=0) or any z
    const collision = appState.blocks.some(b => b.gx === nextGx && b.gy === nextGy);

    // Also check self-collision with trail
    const selfCollision = this.trail.some(t => t.gx === nextGx && t.gy === nextGy);

    if ((collision || selfCollision) && !this.invincible) {
      this.alive = false;
      this.flashUntil = now + 300;
      appState.statusText = 'Crashed!';
    } else {
      this.gx = nextGx;
      this.gy = nextGy;
      this.lastMoveTime = now;
      this.cellsTraveled++;
    }
  }

  pruneTrail(now) {
    if (this.ghostTrail) return;
    this.trail = this.trail.filter(t => now - t.time < 3000);
  }
}
