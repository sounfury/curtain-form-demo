import { Particle } from './Particle';

export class Spring {
  p1: Particle;
  p2: Particle;
  restLength: number;
  stiffness: number;

  constructor(p1: Particle, p2: Particle, stiffness: number) {
    this.p1 = p1;
    this.p2 = p2;
    this.stiffness = stiffness;

    const deltaX = p2.x - p1.x;
    const deltaY = p2.y - p1.y;
    this.restLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  solve(): void {
    const deltaX = this.p2.x - this.p1.x;
    const deltaY = this.p2.y - this.p1.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance < 0.0001) return;

    const difference = (distance - this.restLength) / distance;
    const offsetX = deltaX * difference * this.stiffness;
    const offsetY = deltaY * difference * this.stiffness;

    if (!this.p1.pinned && !this.p2.pinned) {
      this.p1.x += offsetX * 0.5;
      this.p1.y += offsetY * 0.5;
      this.p2.x -= offsetX * 0.5;
      this.p2.y -= offsetY * 0.5;
    } else if (!this.p1.pinned) {
      this.p1.x += offsetX;
      this.p1.y += offsetY;
    } else if (!this.p2.pinned) {
      this.p2.x -= offsetX;
      this.p2.y -= offsetY;
    }
  }
}
