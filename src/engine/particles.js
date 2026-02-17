const MAX_PARTICLES = 300;

class Particle {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.life = 0;
    this.age = 0;
    this.color = '#fff';
    this.size = 3;
    this.gravity = 0;
    this.active = false;
  }

  init(x, y, vx, vy, life, color, size, gravity) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.age = 0;
    this.color = color;
    this.size = size;
    this.gravity = gravity;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    this.age += dt;
    if (this.age >= this.life) {
      this.active = false;
      return;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
  }
}

export const PARTICLE_PRESETS = {
  exhaust: {
    count: 1,
    speed: 0.025,
    life: 350,
    color: '#00cccc',
    size: 2,
    gravity: -0.00005,
    spread: 0.5,
    directed: true,
  },
  crash: {
    count: 40,
    speed: 0.15,
    life: 600,
    color: '#ff4444',
    size: 5,
    gravity: 0.0002,
    spread: 1.0,
  },
  coinPickup: {
    count: 12,
    speed: 0.08,
    life: 500,
    color: '#ffdd00',
    size: 3,
    gravity: -0.00008,
    spread: 1.0,
  },
  boostFlame: {
    count: 3,
    speed: 0.06,
    life: 300,
    color: '#ff8800',
    size: 3,
    gravity: -0.00003,
    spread: 0.6,
    directed: true,
  },
  boostFlameHeavy: {
    count: 5,
    speed: 0.08,
    life: 400,
    color: '#ffaa00',
    size: 5,
    gravity: -0.00004,
    spread: 0.7,
    directed: true,
  },
  turnSparks: {
    count: 6,
    speed: 0.1,
    life: 250,
    color: '#ffaa33',
    size: 2,
    gravity: 0.0002,
    spread: 0.8,
    directed: true,
  },
  lavaExplosion: {
    count: 25,
    speed: 0.12,
    life: 500,
    color: '#ff2200',
    size: 4,
    gravity: 0.0001,
    spread: 1.0,
  },
  waterSplash: {
    count: 20,
    speed: 0.1,
    life: 500,
    color: '#44aaff',
    size: 3,
    gravity: 0.00015,
    spread: 0.8,
  },
};

export class ParticleSystem {
  constructor() {
    this.pool = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push(new Particle());
    }
    this.lastUpdate = 0;

    // Pre-render 32x32 radial gradient glow texture
    this._glowCanvas = document.createElement('canvas');
    this._glowCanvas.width = 32;
    this._glowCanvas.height = 32;
    const gctx = this._glowCanvas.getContext('2d');
    const grad = gctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 32, 32);
  }

  emit(x, y, preset, dirAngle) {
    const config = typeof preset === 'string' ? PARTICLE_PRESETS[preset] : preset;
    if (!config) return;

    let spawned = 0;
    for (let i = 0; i < this.pool.length && spawned < config.count; i++) {
      const p = this.pool[i];
      if (!p.active) {
        let angle;
        if (dirAngle !== undefined && config.directed) {
          // Emit opposite to movement direction with some spread
          angle = dirAngle + Math.PI + (Math.random() - 0.5) * (config.spread || 0.5);
        } else {
          angle = Math.random() * Math.PI * 2;
        }
        const speed = config.speed * (0.5 + Math.random() * 0.5);
        const spread = config.directed ? 1 : (config.spread || 1);
        p.init(
          x + (Math.random() - 0.5) * 4,
          y + (Math.random() - 0.5) * 4,
          Math.cos(angle) * speed * spread,
          Math.sin(angle) * speed * spread,
          config.life * (0.7 + Math.random() * 0.3),
          config.color,
          config.size * (0.6 + Math.random() * 0.4),
          config.gravity || 0
        );
        spawned++;
      }
    }
  }

  update(now) {
    const dt = this.lastUpdate > 0 ? Math.min(now - this.lastUpdate, 50) : 16;
    this.lastUpdate = now;
    for (const p of this.pool) {
      if (p.active) p.update(dt);
    }
  }

  draw(ctx) {
    const prevComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';

    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.age / p.life;
      const alpha = 1 - t;
      const s = p.size * (1 - t * 0.5);

      ctx.globalAlpha = alpha;

      // Tint the glow texture by drawing a colored rect then compositing
      const drawSize = s * 4;
      const half = drawSize / 2;

      // Draw colored background circle
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, half * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Overlay the glow texture for bloom
      ctx.drawImage(this._glowCanvas, p.x - half, p.y - half, drawSize, drawSize);
    }

    ctx.globalCompositeOperation = prevComposite;
    ctx.globalAlpha = 1.0;
  }
}
