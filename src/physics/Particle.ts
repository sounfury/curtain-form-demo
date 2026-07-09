export class Particle {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  accX: number = 0;
  accY: number = 0;
  pinned: boolean = false;

  constructor(x: number, y: number, pinned: boolean = false) {
    this.x = x;
    this.y = y;
    this.oldX = x;
    this.oldY = y;
    this.pinned = pinned;
  }

  applyForce(fx: number, fy: number): void {
    if (this.pinned) return;
    this.accX += fx;
    this.accY += fy;
  }

  update(damping: number, dt: number): void {
    if (this.pinned) {
      this.accX = 0;
      this.accY = 0;
      return;
    }

    const vx = (this.x - this.oldX) * damping;
    const vy = (this.y - this.oldY) * damping;

    this.oldX = this.x;
    this.oldY = this.y;

    this.x += vx + this.accX * dt * dt;
    this.y += vy + this.accY * dt * dt;

    this.accX = 0;
    this.accY = 0;
  }
}