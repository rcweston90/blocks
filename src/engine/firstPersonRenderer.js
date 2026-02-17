import { DEFAULT_BOUNDARY } from './constants.js';
import { getBlockFaces, hexToRgb } from './colors.js';

export class FirstPersonRenderer {
  constructor(canvas, state, fpsTracker) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.fpsTracker = fpsTracker;

    this.bike = null;
    this.theme = null;

    // Config
    this.FOV = Math.PI / 3; // 60 degrees
    this.RENDER_DIST = 24;
    this.WALL_HEIGHT_SCALE = 1.2;

    // Camera state
    this._cameraAngle = 0;

    // Crash tracking
    this._crashDetected = false;
    this._crashFlashStart = 0;
  }

  frame(now) {
    if (!this.bike || !this.theme) return;

    this.fpsTracker.tick();
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    // Get player position — use linear interpolation (not ease-out) to avoid
    // velocity discontinuities that cause a "hopping" look in first-person
    const bike = this.bike;
    let posX, posY;
    if (bike.paused || !bike.alive) {
      posX = bike.gx + 0.5;
      posY = bike.gy + 0.5;
    } else {
      const t = Math.min((now - bike.lastMoveTime) / bike.effectiveSpeed, 1);
      posX = bike.prevGx + (bike.gx - bike.prevGx) * t + 0.5;
      posY = bike.prevGy + (bike.gy - bike.prevGy) * t + 0.5;
    }
    const playerZ = bike.z;

    // Update camera angle
    this._updateCameraAngle(now);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Screen shake on crash
    ctx.save();
    if (!this.bike.alive && now < this.bike.flashUntil) {
      const elapsed = now - (this.bike.flashUntil - 300);
      const intensity = 6 * Math.max(0, 1 - elapsed / 300);
      const shakeX = Math.sin(elapsed * 0.05) * intensity;
      const shakeY = Math.sin(elapsed * 0.065) * intensity;
      ctx.translate(shakeX, shakeY);
    }

    // Draw layers
    this._drawSky(ctx, w, h);
    // Build trail lookup for floor rendering
    this._buildTrailMap(now);
    this._drawFloorAndCeiling(ctx, w, h, posX, posY, playerZ, now);
    const zBuffer = this._castRays(ctx, w, h, posX, posY, playerZ, now);
    this._drawSprites(ctx, w, h, posX, posY, playerZ, zBuffer, now);

    ctx.restore();

    // HUD (screen-space, unaffected by shake)
    this._drawCrashEffects(ctx, w, h, now);
    this._drawFPS(ctx);
    this._drawMetrics(ctx, w, h, now);
    this._drawMiniMap(ctx, w, h, posX, posY);
    this._drawScanlines(ctx, w, h);
  }

  // --- Camera ---

  _updateCameraAngle(now) {
    const bike = this.bike;
    const targetAngle = Math.atan2(bike.direction.dgy, bike.direction.dgx);

    // Snap on reset
    if (bike.cellsTraveled === 0) {
      this._cameraAngle = targetAngle;
      return;
    }

    // Shortest-path angular interpolation
    let diff = targetAngle - this._cameraAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Lerp (~200ms ease-out at 60fps)
    this._cameraAngle += diff * 0.15;

    // Slight lean influence for turning feel
    this._cameraAngle += bike.lean * 0.05;

    // Normalize
    while (this._cameraAngle > Math.PI) this._cameraAngle -= Math.PI * 2;
    while (this._cameraAngle < -Math.PI) this._cameraAngle += Math.PI * 2;
  }

  // --- Sky ---

  _drawSky(ctx, w, h) {
    const theme = this.theme;
    const horizon = h / 2;

    if (theme.gradient) {
      const grad = ctx.createLinearGradient(0, 0, 0, horizon);
      for (const [stop, color] of theme.gradient.stops) {
        grad.addColorStop(stop, color);
      }
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = theme.background || '#f0f0e8';
    }
    ctx.fillRect(0, 0, w, horizon);

    // Ground base (overwritten by floor casting)
    ctx.fillStyle = this._getFogColor();
    ctx.fillRect(0, horizon, w, h - horizon);
  }

  // --- Trail map for floor rendering ---

  _buildTrailMap(now) {
    this._trailMap = new Map();
    if (!this.bike || !this.bike.trail) return;
    const trail = this.bike.trail;
    const trailColor = this.bike.trailColor || '#00fff2';
    const trailRgb = hexToRgb(trailColor);
    for (const entry of trail) {
      const age = now - entry.time;
      const opacity = this.bike.ghostTrail ? 1.0 : Math.pow(1 - age / 10000, 0.5);
      if (opacity <= 0) continue;
      const key = `${entry.gx},${entry.gy}`;
      // Keep the brightest (most recent) entry per cell
      const existing = this._trailMap.get(key);
      if (!existing || opacity > existing.opacity) {
        this._trailMap.set(key, { r: trailRgb[0], g: trailRgb[1], b: trailRgb[2], opacity });
      }
    }
  }

  // --- Floor casting ---

  _drawFloorAndCeiling(ctx, w, h, posX, posY, playerZ, now) {
    const angle = this._cameraAngle;
    const halfFov = this.FOV / 2;
    const horizon = h / 2;
    const fogRgb = hexToRgb(this._getFogColor());
    const boundary = this.state.worldBoundary || DEFAULT_BOUNDARY;

    // Camera direction and plane
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const planeX = -dirY * Math.tan(halfFov);
    const planeY = dirX * Math.tan(halfFov);

    const stripHeight = 4;

    for (let y = horizon + 1; y < h; y += stripHeight) {
      const rowDist = (this.WALL_HEIGHT_SCALE * horizon) / (y - horizon);
      if (rowDist > this.RENDER_DIST) continue;

      const fogT = Math.min(rowDist / this.RENDER_DIST, 1);
      const sampleStep = Math.max(4, Math.floor(rowDist * 2));

      for (let x = 0; x < w; x += sampleStep) {
        const cameraX = 2 * x / w - 1;

        const floorX = posX + rowDist * (dirX + planeX * cameraX);
        const floorY = posY + rowDist * (dirY + planeY * cameraX);

        const cellX = Math.floor(floorX);
        const cellY = Math.floor(floorY);

        let cr, cg, cb;

        // Check for floor tiles at bike's z-level
        const floor = this.state.getFloorAt(cellX, cellY, playerZ);
        if (floor) {
          switch (floor.type) {
            case 'boost': cr = 0; cg = 255; cb = 136; break;
            case 'ice':   cr = 136; cg = 221; cb = 255; break;
            case 'lava':  cr = 255; cg = 51; cb = 34; break;
            case 'water': cr = 34; cg = 136; cb = 221; break;
            case 'ramp':  cr = 255; cg = 136; cb = 0; break;
            case 'goal':  cr = 255; cg = 255; cb = 255; break;
            case 'start': cr = 68; cg = 255; cb = 68; break;
            default:      cr = 100; cg = 100; cb = 100; break;
          }
        } else {
          // Checkerboard ground
          const checker = ((cellX + cellY) & 1) === 0;
          const base = checker ? 60 : 50;
          cr = base; cg = base; cb = base;
        }

        // Trail overlay: blend trail color onto floor
        const trailEntry = this._trailMap.get(`${cellX},${cellY}`);
        if (trailEntry) {
          const t = trailEntry.opacity * 0.95;
          cr = cr + (trailEntry.r - cr) * t;
          cg = cg + (trailEntry.g - cg) * t;
          cb = cb + (trailEntry.b - cb) * t;
        }

        // Warning zone: red tint near boundary
        const distFromEdge = Math.min(
          boundary - Math.abs(cellX),
          boundary - Math.abs(cellY)
        );
        if (distFromEdge < 5) {
          const warnT = Math.max(0, 1 - distFromEdge / 5) * 0.4;
          cr = Math.min(255, cr + warnT * (255 - cr));
          cg = cg * (1 - warnT);
          cb = cb * (1 - warnT);
        }

        // Apply distance fog
        const r = Math.round(cr + (fogRgb[0] - cr) * fogT);
        const g = Math.round(cg + (fogRgb[1] - cg) * fogT);
        const b = Math.round(cb + (fogRgb[2] - cb) * fogT);

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, sampleStep, stripHeight);
      }
    }
  }

  // --- DDA Raycasting ---

  _castRays(ctx, w, h, posX, posY, playerZ, now) {
    const angle = this._cameraAngle;
    const halfFov = this.FOV / 2;
    const horizon = h / 2;
    const fogRgb = hexToRgb(this._getFogColor());

    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const planeX = -dirY * Math.tan(halfFov);
    const planeY = dirX * Math.tan(halfFov);

    const zBuffer = new Float32Array(Math.ceil(w));
    zBuffer.fill(this.RENDER_DIST);

    // One ray per screen column
    for (let x = 0; x < w; x++) {
      const cameraX = 2 * x / w - 1;
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;

      let mapX = Math.floor(posX);
      let mapY = Math.floor(posY);

      const deltaDistX = Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(1 / rayDirY);

      let stepX, sideDistX;
      let stepY, sideDistY;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (posX - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1 - posX) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (posY - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1 - posY) * deltaDistY;
      }

      // DDA walk
      let hit = false;
      let side = 0; // 0 = X face, 1 = Y face
      let hitBlock = null;

      for (let step = 0; step < this.RENDER_DIST * 2; step++) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }

        // --- Trail pillar rendering (transparent, ray continues) ---
        const trailEntry = this._trailMap.get(`${mapX},${mapY}`);
        if (trailEntry) {
          let trailDist;
          if (side === 0) {
            trailDist = (mapX - posX + (1 - stepX) / 2) / rayDirX;
          } else {
            trailDist = (mapY - posY + (1 - stepY) / 2) / rayDirY;
          }

          if (trailDist > 0) {
            const trailWallH = (this.WALL_HEIGHT_SCALE * h) / trailDist;
            const pillarH = trailWallH * 0.45;
            // Position at ground level: bottom of where a full wall would be
            const fullWallBottom = Math.min(h, Math.floor(horizon + trailWallH / 2));
            const pillarTop = Math.max(0, Math.floor(fullWallBottom - pillarH));
            const pillarBottom = fullWallBottom;

            const fogT = Math.min(trailDist / this.RENDER_DIST, 1);
            const tr = Math.round(trailEntry.r + (fogRgb[0] - trailEntry.r) * fogT);
            const tg = Math.round(trailEntry.g + (fogRgb[1] - trailEntry.g) * fogT);
            const tb = Math.round(trailEntry.b + (fogRgb[2] - trailEntry.b) * fogT);

            // Glow strip (3px wide, 30% alpha) for neon bloom
            ctx.globalAlpha = trailEntry.opacity * 0.3;
            ctx.fillStyle = `rgb(${tr},${tg},${tb})`;
            ctx.fillRect(x - 1, pillarTop, 3, pillarBottom - pillarTop);

            // Pillar (1px, full trail opacity)
            ctx.globalAlpha = trailEntry.opacity;
            ctx.fillRect(x, pillarTop, 1, pillarBottom - pillarTop);
            ctx.globalAlpha = 1;

            // Update zBuffer if this is closer than what we have
            if (trailDist < zBuffer[x]) {
              zBuffer[x] = trailDist;
            }
          }
        }

        // --- Wall check (opaque, ray stops) ---
        const wall = this.state.getWallAt(mapX, mapY, playerZ);
        if (wall) {
          hit = true;
          hitBlock = wall;
          break;
        }
      }

      if (!hit) continue;

      // Perpendicular distance (avoids fisheye)
      let perpWallDist;
      if (side === 0) {
        perpWallDist = (mapX - posX + (1 - stepX) / 2) / rayDirX;
      } else {
        perpWallDist = (mapY - posY + (1 - stepY) / 2) / rayDirY;
      }

      if (perpWallDist <= 0) continue;

      zBuffer[x] = perpWallDist;

      // Project wall height
      const wallHeight = (this.WALL_HEIGHT_SCALE * h) / perpWallDist;
      const drawStart = Math.max(0, Math.floor(horizon - wallHeight / 2));
      const drawEnd = Math.min(h, Math.floor(horizon + wallHeight / 2));

      // Wall color: left face for X hits, right face for Y hits
      const faces = getBlockFaces(hitBlock.color);
      const wallRgb = hexToRgb(side === 0 ? faces.left : faces.right);

      // Distance fog
      const fogT = Math.min(perpWallDist / this.RENDER_DIST, 1);
      const r = Math.round(wallRgb[0] + (fogRgb[0] - wallRgb[0]) * fogT);
      const g = Math.round(wallRgb[1] + (fogRgb[1] - wallRgb[1]) * fogT);
      const b = Math.round(wallRgb[2] + (fogRgb[2] - wallRgb[2]) * fogT);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
    }

    return zBuffer;
  }

  // --- Sprites ---

  _drawSprites(ctx, w, h, posX, posY, playerZ, zBuffer, now) {
    const angle = this._cameraAngle;
    const halfFov = this.FOV / 2;
    const horizon = h / 2;

    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const planeX = -dirY * Math.tan(halfFov);
    const planeY = dirX * Math.tan(halfFov);

    // Collect sprites
    const sprites = [];

    // Coins
    for (const block of this.state.blocks) {
      if (block.type === 'coin' && block.z <= playerZ) {
        const dx = (block.gx + 0.5) - posX;
        const dy = (block.gy + 0.5) - posY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.RENDER_DIST) {
          sprites.push({ type: 'coin', x: block.gx + 0.5, y: block.gy + 0.5, dist });
        }
      }
    }

    // Trail entries
    if (this.bike.trail) {
      for (const entry of this.bike.trail) {
        const age = now - entry.time;
        const opacity = this.bike.ghostTrail ? 1.0 : Math.pow(1 - age / 10000, 0.5);
        if (opacity <= 0) continue;

        const dx = (entry.gx + 0.5) - posX;
        const dy = (entry.gy + 0.5) - posY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.RENDER_DIST && dist > 0.5) {
          sprites.push({
            type: 'trail', x: entry.gx + 0.5, y: entry.gy + 0.5,
            dist, opacity, color: this.bike.trailColor || '#00fff2',
          });
        }
      }
    }

    // Sort far-to-near (painter's order)
    sprites.sort((a, b) => b.dist - a.dist);

    // Inverse determinant for sprite projection
    const invDet = 1.0 / (planeX * dirY - dirX * planeY);

    for (const sprite of sprites) {
      const spriteX = sprite.x - posX;
      const spriteY = sprite.y - posY;

      // Transform to camera space
      const transformX = invDet * (dirY * spriteX - dirX * spriteY);
      const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

      if (transformY <= 0.1) continue; // Behind camera

      const spriteScreenX = Math.floor(w / 2 * (1 + transformX / transformY));
      const spriteHeight = Math.abs(Math.floor((this.WALL_HEIGHT_SCALE * h) / transformY));

      // Check zBuffer at sprite center for occlusion
      if (spriteScreenX < 0 || spriteScreenX >= w) continue;
      if (transformY >= zBuffer[spriteScreenX]) continue;

      const distFade = Math.max(0, 1 - transformY / this.RENDER_DIST);

      if (sprite.type === 'coin') {
        const size = Math.floor(spriteHeight * 0.3);
        const bob = Math.sin(now * 0.003) * size * 0.2;
        const cy = horizon - bob;

        ctx.globalAlpha = distFade;
        ctx.fillStyle = '#ffdd00';
        ctx.beginPath();
        ctx.moveTo(spriteScreenX, cy - size);
        ctx.lineTo(spriteScreenX + size * 0.6, cy);
        ctx.lineTo(spriteScreenX, cy + size);
        ctx.lineTo(spriteScreenX - size * 0.6, cy);
        ctx.closePath();
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#cc9900';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (sprite.type === 'trail') {
        const barWidth = Math.max(2, Math.floor(spriteHeight * 0.15));
        const barHeight = Math.floor(spriteHeight * 0.5);
        const barX = spriteScreenX - barWidth / 2;
        const barY = horizon - barHeight / 2;

        ctx.globalAlpha = sprite.opacity * distFade * 0.7;
        ctx.fillStyle = sprite.color;
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.globalAlpha = 1;
      }
    }
  }

  // --- HUD: FPS ---

  _drawFPS(ctx) {
    const tracker = this.fpsTracker;
    const theme = this.theme;
    const padding = 10;
    const panelW = 140;
    const panelH = 56;
    const x = padding;
    const y = padding;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, 4);
    ctx.fill();

    if (theme.hudBorder) {
      ctx.strokeStyle = theme.hudBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.fillText(`FPS: ${tracker.fps}`, x + 8, y + 16);
    ctx.fillStyle = theme.hudText;
    ctx.fillText(`avg: ${tracker.avgDelta.toFixed(1)}ms`, x + 8, y + 30);

    // Sparkline
    const barY = y + 36;
    const barH = 14;
    const barW = (panelW - 16) / tracker.size;
    for (let i = 0; i < tracker.size; i++) {
      const idx = (tracker.index + i) % tracker.size;
      const delta = tracker.deltas[idx];
      const bh = Math.min(delta / 33 * barH, barH);
      const color = delta < 17 ? '#0f0' : delta < 33 ? '#ff0' : '#f00';
      ctx.fillStyle = color;
      ctx.fillRect(x + 8 + i * barW, barY + barH - bh, Math.max(barW - 0.5, 1), bh);
    }
  }

  // --- HUD: Metrics ---

  _drawMetrics(ctx, w, h, now) {
    const bike = this.bike;
    const theme = this.theme;
    const dpr = window.devicePixelRatio || 1;
    const canvasW = this.canvas.width / dpr;
    const panelW = 180;
    const panelH = 140;
    const padding = 10;
    const x = canvasW - panelW - padding;
    const y = padding;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, panelW, panelH, 4);
    ctx.fill();

    if (theme.hudBorder) {
      ctx.strokeStyle = theme.hudBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.font = '12px monospace';

    ctx.fillStyle = theme.hudAccent;
    ctx.fillText(`Dist: ${bike.cellsTraveled}`, x + 8, y + 16);

    ctx.fillStyle = theme.hudText;
    ctx.fillText(`Best: ${bike.highScore}`, x + 100, y + 16);

    if (bike.score > 0) {
      ctx.fillStyle = '#ffdd00';
      ctx.fillText(`Coins: ${bike.score}`, x + 8, y + 30);
    }

    const speedLabels = ['Slow', 'Normal', 'Fast', 'Faster', 'Max'];
    const label = speedLabels[bike.speedIndex] || 'Normal';
    ctx.fillStyle = theme.hudText;
    const boostLabel = bike.isBoosted ? ' +BOOST' : '';
    ctx.fillText(`Speed: ${label}${boostLabel}`, x + 8, y + (bike.score > 0 ? 44 : 30));

    const elapsed = bike.getElapsedSeconds(now || performance.now());
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const timeY = bike.score > 0 ? 58 : 44;
    ctx.fillText(`Time: ${timeStr}`, x + 8, y + timeY);

    ctx.fillText(`Pos: (${bike.gx}, ${bike.gy})`, x + 8, y + timeY + 14);

    if (bike.z > 0) {
      ctx.fillStyle = '#ff8800';
      ctx.fillText(`Elev: ${bike.z}`, x + 100, y + timeY + 14);
    }

    let statusY = timeY + 28;
    if (bike.paused) {
      ctx.fillStyle = '#ff0';
      ctx.fillText('PAUSED', x + 8, y + statusY);
      statusY += 14;
    }
    if (bike.isBoosted && !bike.paused) {
      ctx.fillStyle = '#f80';
      ctx.fillText('BOOST', x + 8, y + statusY);
      statusY += 14;
    }
    if (!bike.alive) {
      ctx.fillStyle = '#f00';
      ctx.fillText(bike.deathMessage || 'CRASHED', x + 8, y + statusY);
      statusY += 14;
    }
    if (bike.levelComplete) {
      ctx.fillStyle = '#0f0';
      ctx.fillText('LEVEL COMPLETE!', x + 8, y + statusY);
      statusY += 14;
    }
  }

  // --- HUD: Minimap (top-down orthographic) ---

  _drawMiniMap(ctx, w, h, posX, posY) {
    const dpr = window.devicePixelRatio || 1;
    const canvasH = this.canvas.height / dpr;
    const boundary = this.state.worldBoundary || DEFAULT_BOUNDARY;
    const mapSize = 120;
    const padding = 10;
    const x = padding;
    const y = canvasH - mapSize - padding;

    // Background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y, mapSize, mapSize, 4);
    ctx.fill();

    if (this.theme.hudBorder) {
      ctx.strokeStyle = this.theme.hudBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, mapSize, mapSize, 4);
    ctx.clip();

    const mapCx = x + mapSize / 2;
    const mapCy = y + mapSize / 2;
    const scale = (mapSize - 10) / (boundary * 2);

    const toMap = (gx, gy) => ({
      x: mapCx + gx * scale,
      y: mapCy + gy * scale,
    });

    // Boundary border
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      mapCx - boundary * scale,
      mapCy - boundary * scale,
      boundary * 2 * scale,
      boundary * 2 * scale
    );

    // Blocks as dots
    for (const block of this.state.blocks) {
      const mp = toMap(block.gx, block.gy);
      ctx.fillStyle = block.color || '#98a8b8';
      ctx.fillRect(mp.x - 1, mp.y - 1, 2, 2);
    }

    // Trail line
    if (this.bike.trail.length > 0) {
      ctx.strokeStyle = this.bike.trailColor || '#00fff2';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      const firstT = toMap(this.bike.trail[0].gx, this.bike.trail[0].gy);
      ctx.moveTo(firstT.x, firstT.y);
      for (let i = 1; i < this.bike.trail.length; i++) {
        const tp = toMap(this.bike.trail[i].gx, this.bike.trail[i].gy);
        ctx.lineTo(tp.x, tp.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Player dot
    const playerMap = toMap(posX - 0.5, posY - 0.5);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(playerMap.x, playerMap.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Direction line
    const angle = this._cameraAngle;
    const dirLen = 8;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playerMap.x, playerMap.y);
    ctx.lineTo(
      playerMap.x + Math.cos(angle) * dirLen,
      playerMap.y + Math.sin(angle) * dirLen
    );
    ctx.stroke();

    // FOV cone
    const coneLen = 15;
    const halfFov = this.FOV / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playerMap.x, playerMap.y);
    ctx.lineTo(
      playerMap.x + Math.cos(angle - halfFov) * coneLen,
      playerMap.y + Math.sin(angle - halfFov) * coneLen
    );
    ctx.moveTo(playerMap.x, playerMap.y);
    ctx.lineTo(
      playerMap.x + Math.cos(angle + halfFov) * coneLen,
      playerMap.y + Math.sin(angle + halfFov) * coneLen
    );
    ctx.stroke();

    // FOV arc
    ctx.beginPath();
    ctx.arc(playerMap.x, playerMap.y, coneLen, angle - halfFov, angle + halfFov);
    ctx.stroke();

    ctx.restore();
  }

  // --- Crash effects ---

  _drawCrashEffects(ctx, w, h, now) {
    if (this.bike && !this.bike.alive && !this._crashDetected) {
      this._crashDetected = true;
      this._crashFlashStart = now;
    }
    if (this.bike && this.bike.alive) {
      this._crashDetected = false;
    }

    if (!this._crashDetected || !this._crashFlashStart) return;

    const elapsed = now - this._crashFlashStart;

    // White flash
    if (elapsed < 150) {
      const alpha = (1 - elapsed / 150) * 0.5;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Red vignette
    if (elapsed < 500) {
      const alpha = (1 - elapsed / 500) * 0.3;
      const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.7);
      grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
      grad.addColorStop(1, `rgba(255, 0, 0, ${alpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // --- Scanlines ---

  _drawScanlines(ctx, w, h) {
    if (!this.theme.scanlines) return;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  // --- Utilities ---

  _getFogColor() {
    const theme = this.theme;
    if (theme.gradient) {
      return theme.gradient.stops[theme.gradient.stops.length - 1][1];
    }
    return theme.background || '#f0f0e8';
  }
}
