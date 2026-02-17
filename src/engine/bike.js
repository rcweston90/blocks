import { BOOST_DURATION, ICE_SLIDE_CELLS, JUMP_DURATION, BLOCK_HEIGHT, JUMP_HEIGHT, DEFAULT_BOUNDARY, RAMP_DIRS } from './constants.js';
import { getBlockType } from './blockTypes.js';

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
    this.z = 0;
    this.prevGx = 0;
    this.prevGy = 0;
    this.prevZ = 0;
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

    // Camera follow
    this.cameraFollow = true;

    // Score / timer
    this.startTime = 0;
    this.highScore = 0;
    this.pausedDuration = 0;
    this.pauseStartTime = 0;

    // Ghost trail
    this.ghostTrail = false;

    // Invincibility
    this.invincible = false;

    // Terrain effects
    this.boostUntil = 0;
    this.slideLockedUntil = 0;  // cell count at which ice lock expires
    this.jumping = false;
    this.jumpStartTime = 0;
    this.score = 0;
    this.levelComplete = false;
    this.deathMessage = 'Crashed!';

    // Track last score for particle detection
    this.lastScore = 0;

    // Visual lean for turning animation
    this.lean = 0;
    this.wheelPhase = 0;

    // Afterimage position history (ring buffer, max 6)
    this.posHistory = [];
    this._posHistoryMax = 6;
  }

  get effectiveSpeed() {
    const base = this.speed;
    const isBoosted = this.boosting || (this.boostUntil > 0 && performance.now() < this.boostUntil);
    return isBoosted ? Math.max(base * 0.5, 50) : base;
  }

  get isBoosted() {
    return this.boosting || (this.boostUntil > 0 && performance.now() < this.boostUntil);
  }

  reset(startBlock) {
    this.highScore = Math.max(this.highScore, this.cellsTraveled);

    const DIR_MAP = [
      { dgx: 0, dgy: -1 }, // 0 = N
      { dgx: 1, dgy: 0 },  // 1 = E
      { dgx: 0, dgy: 1 },  // 2 = S
      { dgx: -1, dgy: 0 }, // 3 = W
    ];

    if (startBlock) {
      this.gx = startBlock.gx;
      this.gy = startBlock.gy;
      this.z = startBlock.z;
      this.direction = DIR_MAP[startBlock.dir || 0] || DIR_MAP[1];
    } else {
      this.gx = 0;
      this.gy = 0;
      this.z = 0;
      this.direction = { dgx: 1, dgy: 0 };
    }
    this.prevGx = this.gx;
    this.prevGy = this.gy;
    this.prevZ = this.z;
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

    // Reset terrain state
    this.boostUntil = 0;
    this.slideLockedUntil = 0;
    this.jumping = false;
    this.jumpStartTime = 0;
    this.score = 0;
    this.lastScore = 0;
    this.levelComplete = false;
    this.deathMessage = 'Crashed!';
    this.lean = 0;
    this.wheelPhase = 0;
    this.posHistory = [];
    // Preserve: cameraFollow, ghostTrail, invincible, highScore
  }

  setDirection(d) {
    // Reject 180-degree reversal
    if (d.dgx + this.direction.dgx === 0 && d.dgy + this.direction.dgy === 0) {
      return;
    }
    // Reject direction changes while ice-locked
    if (this.cellsTraveled < this.slideLockedUntil) {
      return;
    }
    // Compute lean from turn direction (cross product of old vs new)
    const cross = this.direction.dgx * d.dgy - this.direction.dgy * d.dgx;
    if (cross !== 0) {
      this.lean = cross > 0 ? 1 : -1;
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
      this.pauseStartTime = now;
    } else {
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
      return { gx: this.gx, gy: this.gy, z: this.z };
    }

    const elapsed = now - this.lastMoveTime;
    const t = Math.min(elapsed / this.effectiveSpeed, 1);
    const eased = 1 - (1 - t) * (1 - t);

    return {
      gx: this.prevGx + (this.gx - this.prevGx) * eased,
      gy: this.prevGy + (this.gy - this.prevGy) * eased,
      z: this.prevZ + (this.z - this.prevZ) * eased,
    };
  }

  getJumpZ(now) {
    if (!this.jumping) return 0;
    const elapsed = now - this.jumpStartTime;
    const progress = Math.min(elapsed / JUMP_DURATION, 1);
    if (progress >= 1) {
      this.jumping = false;
      return 0;
    }
    return Math.sin(progress * Math.PI) * BLOCK_HEIGHT * JUMP_HEIGHT;
  }

  getElapsedSeconds(now) {
    if (this.startTime === 0) return 0;
    let paused = this.pausedDuration;
    if (this.paused && this.pauseStartTime > 0) {
      paused += now - this.pauseStartTime;
    }
    return (now - this.startTime - paused) / 1000;
  }

  collect(block, appState) {
    if (block.type === 'coin') {
      appState.removeBlock(block);
      this.score++;
    }
  }

  tick(now, appState) {
    if (!this.alive) return;
    if (this.paused) return;
    if (this.levelComplete) return;
    if (now - this.lastMoveTime < this.effectiveSpeed) return;

    // Start timer on first move
    if (this.cellsTraveled === 0) {
      this.startTime = now;
    }

    // Record position history for afterimage trail
    this.posHistory.push({ gx: this.gx, gy: this.gy, z: this.z });
    if (this.posHistory.length > this._posHistoryMax) {
      this.posHistory.shift();
    }

    // Add current position to trail (with z)
    if (this.ghostTrail && this.trail.length >= 5000) {
      // Cap ghost trail
    } else {
      this.trail.push({ gx: this.gx, gy: this.gy, z: this.z, time: now });
    }

    // Store previous position for interpolation
    this.prevGx = this.gx;
    this.prevGy = this.gy;
    this.prevZ = this.z;

    // Compute next position
    let nextGx = this.gx + this.direction.dgx;
    let nextGy = this.gy + this.direction.dgy;

    // Boundary bounce/deflect
    const boundary = appState.worldBoundary || DEFAULT_BOUNDARY;
    let bounced = false;
    let dgx = this.direction.dgx;
    let dgy = this.direction.dgy;
    if (Math.abs(nextGx) > boundary) {
      dgx = -dgx;
      bounced = true;
    }
    if (Math.abs(nextGy) > boundary) {
      dgy = -dgy;
      bounced = true;
    }
    if (bounced) {
      this.direction = { dgx, dgy };
      nextGx = this.gx + dgx;
      nextGy = this.gy + dgy;
      appState.statusText = 'Boundary deflect!';
    }

    // Trail self-collision (skip if jumping, only at same z)
    const selfCollision = !this.jumping && this.trail.some(
      t => t.gx === nextGx && t.gy === nextGy && t.z === this.z
    );

    if (selfCollision && !this.invincible) {
      this.alive = false;
      this.flashUntil = now + 300;
      this.deathMessage = 'Crashed into trail!';
      appState.statusText = this.deathMessage;
      return;
    }

    // Skip block collision while jumping
    if (!this.jumping) {
      // Check for wall at bike's z-level
      const wall = appState.getWallAt(nextGx, nextGy, this.z);
      if (wall) {
        if (!this.invincible) {
          this.alive = false;
          this.flashUntil = now + 300;
          this.deathMessage = 'Crashed!';
          appState.statusText = this.deathMessage;
          return;
        }
      }

      // Check for floor-type block at bike's z-level
      const floor = appState.getFloorAt(nextGx, nextGy, this.z);
      if (floor) {
        const floorType = floor.type || 'normal';
        switch (floorType) {
          case 'lava':
            if (!this.invincible) {
              this.alive = false;
              this.flashUntil = now + 300;
              this.deathMessage = 'Burned in lava!';
              appState.statusText = this.deathMessage;
              return;
            }
            break;

          case 'water':
            if (!this.invincible) {
              this.alive = false;
              this.flashUntil = now + 300;
              this.deathMessage = 'Fell in water!';
              appState.statusText = this.deathMessage;
              return;
            }
            break;

          case 'boost':
            this.boostUntil = now + BOOST_DURATION;
            this._moveTo(nextGx, nextGy, now);
            appState.statusText = 'BOOST!';
            this._applyFalling(appState);
            return;

          case 'ice':
            this.slideLockedUntil = this.cellsTraveled + ICE_SLIDE_CELLS;
            this._moveTo(nextGx, nextGy, now);
            appState.statusText = 'ICE - direction locked!';
            this._applyFalling(appState);
            return;

          case 'ramp': {
            const rampDir = RAMP_DIRS[floor.dir || 0];
            const dot = this.direction.dgx * rampDir.dgx + this.direction.dgy * rampDir.dgy;
            this._moveTo(nextGx, nextGy, now);
            if (dot > 0) {
              // Uphill: moving in same direction as ramp's "up"
              this.z = floor.z + 1;
              appState.statusText = `Ramp UP! Elev: ${this.z}`;
            } else if (dot < 0) {
              // Downhill: moving opposite to ramp's "up" — stay at same level, gravity handles it
              appState.statusText = `Ramp DOWN! Elev: ${this.z}`;
              this._applyFalling(appState);
            } else {
              // Perpendicular: pass through at same z
              appState.statusText = `Ramp (sideways). Elev: ${this.z}`;
              this._applyFalling(appState);
            }
            return;
          }

          case 'goal':
            this._moveTo(nextGx, nextGy, now);
            this.levelComplete = true;
            appState.statusText = 'LEVEL COMPLETE!';
            return;
        }
      }

      // Check for ramp below: when elevated and no floor at current z,
      // a ramp at z-1 can transition the bike downhill
      if (this.z > 0 && !floor) {
        const rampBelow = appState.getFloorAt(nextGx, nextGy, this.z - 1);
        if (rampBelow && (rampBelow.type === 'ramp')) {
          const rampDir = RAMP_DIRS[rampBelow.dir || 0];
          const dot = this.direction.dgx * rampDir.dgx + this.direction.dgy * rampDir.dgy;
          if (dot < 0) {
            // Going downhill on this ramp
            this._moveTo(nextGx, nextGy, now);
            this.z = rampBelow.z;
            appState.statusText = `Ramp DOWN! Elev: ${this.z}`;
            return;
          }
        }
      }

      // Collect coins at any z <= bike.z
      const blocksAtDest = appState.getBlocksAt(nextGx, nextGy);
      for (const b of blocksAtDest) {
        const bt = getBlockType(b.type || 'normal');
        if (bt.isCollectible && b.z <= this.z) {
          this.collect(b, appState);
          appState.statusText = `Coin! Score: ${this.score}`;
        }
      }
    }

    // Move to next position
    this._moveTo(nextGx, nextGy, now);

    // Advance wheel animation phase
    this.wheelPhase += 1;

    // Decay lean back to center
    this.lean *= 0.6;

    // Apply falling if elevated
    this._applyFalling(appState);
  }

  _moveTo(gx, gy, now) {
    this.gx = gx;
    this.gy = gy;
    this.lastMoveTime = now;
    this.cellsTraveled++;
  }

  _applyFalling(appState) {
    if (this.z <= 0) return;

    // Check for support: wall at z-1 beneath current position
    const support = appState.getWallAt(this.gx, this.gy, this.z - 1);
    if (support) return; // Standing on wall top, stable

    // Check for floor tile at bike's z — elevated road/bridge support
    const floorSupport = appState.getFloorAt(this.gx, this.gy, this.z);
    if (floorSupport) return; // Standing on a floor tile, stable

    // No support — find highest surface below
    const blocksHere = appState.getBlocksAt(this.gx, this.gy);
    let highestSupport = 0;
    for (const b of blocksHere) {
      const bt = getBlockType(b.type || 'normal');
      if (b.z >= this.z) continue;
      if (bt.isCollectible) continue;
      if (bt.isFloor) {
        // Floor tile: bike stands at b.z (on the floor surface)
        highestSupport = Math.max(highestSupport, b.z);
      } else {
        // Wall: bike stands on top of it (z = b.z + 1)
        highestSupport = Math.max(highestSupport, b.z + 1);
      }
    }
    this.z = highestSupport;
  }

  pruneTrail(now) {
    if (this.ghostTrail) return;
    this.trail = this.trail.filter(t => now - t.time < 10000);
  }
}
