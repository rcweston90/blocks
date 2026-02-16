export class FPSTracker {
  constructor(size = 60) {
    this.size = size;
    this.deltas = new Array(size).fill(16);
    this.index = 0;
    this.lastTime = performance.now();
  }

  tick() {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    this.deltas[this.index] = delta;
    this.index = (this.index + 1) % this.size;
    return delta;
  }

  get avgDelta() {
    let sum = 0;
    for (let i = 0; i < this.size; i++) sum += this.deltas[i];
    return sum / this.size;
  }

  get fps() {
    return Math.round(1000 / this.avgDelta);
  }
}
