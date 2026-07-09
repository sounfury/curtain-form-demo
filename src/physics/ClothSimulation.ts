import { Particle } from './Particle';
import { Spring } from './Spring';

export interface ClothConfig {
  cols: number;
  rows: number;
  width: number;
  height: number;
  structuralStiffness: number;
  shearStiffness: number;
  bendStiffness: number;
  damping: number;
  gravity: number;
}

export const DEFAULT_CLOTH_CONFIG: ClothConfig = {
  cols: 30,
  rows: 20,
  width: 800,
  height: 600,
  structuralStiffness: 0.9,
  shearStiffness: 0.7,
  bendStiffness: 0.3,
  damping: 0.97,
  gravity: 0.5,
};

export class ClothSimulation {
  particles: Particle[] = [];
  springs: Spring[] = [];
  config: ClothConfig;
  private time: number = 0;

  constructor(config: Partial<ClothConfig> = {}) {
    this.config = { ...DEFAULT_CLOTH_CONFIG, ...config };
    this.init();
  }

  private init(): void {
    const { cols, rows, width, height } = this.config;
    const spacingX = width / (cols - 1);
    const spacingY = height / (rows - 1);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * spacingX;
        const y = row * spacingY;
        // 顶行固定（窗帘杆）
        const pinned = row === 0;
        this.particles.push(new Particle(x, y, pinned));
      }
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;

        // 结构弹簧（水平/垂直邻居）
        if (col < cols - 1) {
          this.addSpring(index, index + 1, this.config.structuralStiffness);
        }
        if (row < rows - 1) {
          this.addSpring(index, index + cols, this.config.structuralStiffness);
        }

        // 剪切弹簧（对角邻居）
        if (col < cols - 1 && row < rows - 1) {
          this.addSpring(index, index + cols + 1, this.config.shearStiffness);
          this.addSpring(index + 1, index + cols, this.config.shearStiffness);
        }

        // 弯曲弹簧（隔一个粒子）
        if (col < cols - 2) {
          this.addSpring(index, index + 2, this.config.bendStiffness);
        }
        if (row < rows - 2) {
          this.addSpring(index, index + cols * 2, this.config.bendStiffness);
        }
      }
    }
  }

  private addSpring(indexA: number, indexB: number, stiffness: number): void {
    this.springs.push(
      new Spring(this.particles[indexA], this.particles[indexB], stiffness),
    );
  }

  getIndex(col: number, row: number): number {
    return row * this.config.cols + col;
  }

  getParticle(col: number, row: number): Particle {
    return this.particles[this.getIndex(col, row)];
  }

  /** 获取右下角粒子（拖拽目标） */
  getBottomRightParticle(): Particle {
    return this.getParticle(this.config.cols - 1, this.config.rows - 1);
  }

  step(dt: number = 1): void {
    const { damping, gravity } = this.config;
    this.time += dt * 0.016;

    for (const particle of this.particles) {
      particle.applyForce(0, gravity);

      if (!particle.pinned) {
        const windX = Math.sin(this.time * 0.5 + particle.y * 0.1) * 0.002;
        const windY =
          (Math.sin(particle.x * 0.05 + this.time * 0.3) * 0.5 +
            Math.cos(particle.y * 0.07 + this.time * 0.2) * 0.5) *
          0.001;
        particle.applyForce(windX, windY);
      }
    }

    for (const particle of this.particles) {
      particle.update(damping, dt);
    }

    for (let iteration = 0; iteration < 3; iteration++) {
      for (const spring of this.springs) {
        spring.solve();
      }
    }
  }

  /** 更新布料尺寸（窗口变化时） */
  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;

    const spacingX = width / (this.config.cols - 1);
    const spacingY = height / (this.config.rows - 1);

    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        const index = row * this.config.cols + col;
        const particle = this.particles[index];
        particle.x = col * spacingX;
        particle.y = row * spacingY;
        particle.oldX = particle.x;
        particle.oldY = particle.y;
      }
    }

    for (const spring of this.springs) {
      const deltaX = spring.p2.x - spring.p1.x;
      const deltaY = spring.p2.y - spring.p1.y;
      spring.restLength = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    }
  }

  /** 获取位置数组 (flat: x0,y0,x1,y1,...) */
  getPositions(): Float32Array {
    const { cols, rows } = this.config;
    const positions = new Float32Array(cols * rows * 2);
    for (let index = 0; index < this.particles.length; index++) {
      positions[index * 2] = this.particles[index].x;
      positions[index * 2 + 1] = this.particles[index].y;
    }
    return positions;
  }

  getUVs(): Float32Array {
    const { cols, rows } = this.config;
    const uvs = new Float32Array(cols * rows * 2);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        uvs[index * 2] = col / (cols - 1);
        uvs[index * 2 + 1] = row / (rows - 1);
      }
    }
    return uvs;
  }

  getIndices(): Uint32Array {
    const { cols, rows } = this.config;
    const indices: number[] = [];
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols - 1; col++) {
        const index = row * cols + col;
        indices.push(index, index + 1, index + cols);
        indices.push(index + 1, index + cols + 1, index + cols);
      }
    }
    return new Uint32Array(indices);
  }
}
