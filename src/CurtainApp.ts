import "pixi.js/html-source";
import {
  Application,
  Mesh,
  MeshGeometry,
  Shader,
  UniformGroup,
  Texture,
  Graphics,
} from "pixi.js";
import { HTMLSource, ElementImageSource } from "pixi.js/html-source";
import type { HTMLSourceCanvas } from "pixi.js/html-source";
import { ClothSimulation, DEFAULT_CLOTH_CONFIG } from "./physics/ClothSimulation";
import { CurtainFSM } from "./interaction/CurtainFSM";
import type { CurtainState } from "./interaction/CurtainFSM";
import { generateFabricTexture } from "./utils/generateFabricTexture";

import vertexSrc from "./shaders/curtainVertex.glsl?raw";
import fragmentSrc from "./shaders/curtainFragment.glsl?raw";

/**
 * 坐标映射:
 * - 布料物理: (0,0) 左上 → (width, height) 右下
 * - WebGL NDC: (-1,-1) 左下 → (1,1) 右上
 * - Pixi 屏幕: (0,0) 左上 → (width, height) 右下
 *
 * 自定义 Shader + MeshGeometry：每帧把粒子位置写成 NDC 后上传 aPosition。
 */

export class CurtainApp {
  app!: Application;
  cloth!: ClothSimulation;
  fsm!: CurtainFSM;

  mesh!: Mesh;
  geometry!: MeshGeometry;
  meshTexture!: Texture;
  customShader!: Shader;

  htmlSource!: HTMLSource;
  frozenSource: ElementImageSource | null = null;
  liveTexture!: Texture;
  fabricTexture!: Texture;

  formElement!: HTMLElement;
  canvas!: HTMLSourceCanvas;

  private isDragging = false;
  private dragX = 0;
  private dragY = 0;

  /** 松手回弹中：角点未 pin，等重力/弹簧落回原位后再恢复表单交互 */
  private pendingSpringbackRestore = false;

  private onWindowPointerMove: ((event: PointerEvent) => void) | null = null;
  private onWindowPointerUp: ((event: PointerEvent) => void) | null = null;

  private width = 800;
  private height = 600;
  private destroyed = false;

  interactionArea!: Graphics;
  nailsLayer!: Graphics;

  async init(container: HTMLElement): Promise<boolean> {
    this.app = new Application();
    await this.app.init({
      resizeTo: container,
      backgroundAlpha: 0,
    });

    if (this.destroyed) {
      try {
        this.app.destroy(true);
      } catch {
        // Application.destroy 在 init 未完成时可能抛异常
      }
      return false;
    }

    this.canvas = this.app.canvas as HTMLSourceCanvas;

    if (!(this.canvas as HTMLSourceCanvas & { requestPaint?: unknown }).requestPaint) {
      return false;
    }

    container.appendChild(this.canvas);
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    this.formElement = this.createFormElement();
    this.canvas.appendChild(this.formElement);
    this.updateFormSize();

    this.cloth = new ClothSimulation({
      ...DEFAULT_CLOTH_CONFIG,
      width: this.width,
      height: this.height,
    });

    this.fsm = new CurtainFSM();
    this.fsm.onTransition((transition) => this.onStateTransition(transition));

    this.htmlSource = new HTMLSource({ resource: this.formElement });
    this.meshTexture = Texture.from(this.htmlSource);
    this.liveTexture = this.meshTexture;

    const fabricCanvas = generateFabricTexture();
    this.fabricTexture = Texture.from(fabricCanvas);

    await this.waitForHTMLSourceReady();

    if (this.destroyed) {
      return false;
    }

    this.createMesh();
    this.createInteractionArea();
    this.createNails();
    this.setupInteraction();

    this.app.ticker.add((ticker) => {
      this.update(ticker.deltaTime);
    });

    return true;
  }

  private createFormElement(): HTMLElement {
    const form = document.createElement("div");
    form.id = "curtain-form";
    form.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      padding: 40px;
      box-sizing: border-box;
      font-family: 'Georgia', serif;
      background: linear-gradient(135deg, #f5f0e8 0%, #e8dcc8 100%);
      color: #4a3f35;
    `;

    form.innerHTML = `
      <h2 style="margin:0 0 24px; font-size:28px; font-weight:300; letter-spacing:2px; color:#6b5b4f;">
        Contact Us
      </h2>
      <div style="margin-bottom:16px;">
        <label style="display:block; font-size:13px; color:#8a7d6f; margin-bottom:4px; letter-spacing:1px;">NAME</label>
        <input type="text" placeholder="Your name"
          style="width:100%; padding:10px 14px; border:1px solid #c9bda8; border-radius:4px;
                 background:rgba(255,255,255,0.5); font-size:15px; color:#4a3f35; outline:none;
                 font-family:inherit;" />
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block; font-size:13px; color:#8a7d6f; margin-bottom:4px; letter-spacing:1px;">EMAIL</label>
        <input type="email" placeholder="your@email.com"
          style="width:100%; padding:10px 14px; border:1px solid #c9bda8; border-radius:4px;
                 background:rgba(255,255,255,0.5); font-size:15px; color:#4a3f35; outline:none;
                 font-family:inherit;" />
      </div>
      <div style="margin-bottom:24px;">
        <label style="display:block; font-size:13px; color:#8a7d6f; margin-bottom:4px; letter-spacing:1px;">MESSAGE</label>
        <textarea rows="4" placeholder="Write your message..."
          style="width:100%; padding:10px 14px; border:1px solid #c9bda8; border-radius:4px;
                 background:rgba(255,255,255,0.5); font-size:15px; color:#4a3f35; outline:none;
                 font-family:inherit; resize:none;"></textarea>
      </div>
      <button style="
        padding:12px 32px; border:none; border-radius:4px; cursor:pointer;
        background:#6b5b4f; color:#f5f0e8; font-size:14px; letter-spacing:1px;
        font-family:inherit; transition: background 0.2s;
      ">SUBMIT</button>
      <p style="margin-top:24px; font-size:12px; color:#b0a590;">
        ↕ Drag the bottom-right corner to lift
      </p>
    `;

    return form;
  }

  private updateFormSize(): void {
    this.formElement.style.width = `${this.width}px`;
    this.formElement.style.height = `${this.height}px`;
  }

  private createMesh(): void {
    const positions = this.cloth.getPositions();
    const uvs = this.cloth.getUVs();
    const indices = this.cloth.getIndices();

    this.geometry = new MeshGeometry({
      positions: new Float32Array(positions),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices),
      topology: "triangle-list",
    });

    const uniforms = new UniformGroup({
      uLightDir: { value: new Float32Array([-0.3, -0.5, 1.0]), type: "vec3<f32>" },
    });

    this.customShader = Shader.from({
      gl: { vertex: vertexSrc, fragment: fragmentSrc },
      resources: {
        curtainUniforms: uniforms,
        uFormTexture: this.meshTexture.source,
        uFormSampler: this.meshTexture.source.style,
        uFabricNoise: this.fabricTexture.source,
        uFabricSampler: this.fabricTexture.source.style,
      },
    });

    this.mesh = new Mesh({
      geometry: this.geometry,
      shader: this.customShader,
    }) as Mesh;

    this.app.stage.addChild(this.mesh);
  }

  private createInteractionArea(): void {
    this.interactionArea = new Graphics();
    this.interactionArea.eventMode = "static";
    this.interactionArea.cursor = "grab";
    this.drawInteractionArea();
    this.app.stage.addChild(this.interactionArea);
  }

  private drawInteractionArea(): void {
    if (!this.interactionArea) return;
    this.interactionArea.clear();
    this.interactionArea.rect(this.width - 80, this.height - 80, 80, 80);
    this.interactionArea.fill({ alpha: 0 });
  }

  private createNails(): void {
    this.nailsLayer = new Graphics();
    this.drawNails();
    this.app.stage.addChild(this.nailsLayer);
  }

  private drawNails(): void {
    if (!this.nailsLayer) return;
    this.nailsLayer.clear();

    const nailPositions = [
      { x: 0, y: 0 },
      { x: this.width, y: 0 },
    ];

    for (const nailPosition of nailPositions) {
      this.nailsLayer.circle(nailPosition.x, nailPosition.y, 10);
      this.nailsLayer.fill({ color: 0x3d2e1f });
      this.nailsLayer.circle(nailPosition.x, nailPosition.y, 8);
      this.nailsLayer.fill({ color: 0x5a4a3a });
      this.nailsLayer.circle(nailPosition.x, nailPosition.y, 6);
      this.nailsLayer.fill({ color: 0x8b6f47 });
      this.nailsLayer.circle(nailPosition.x - 1.5, nailPosition.y - 1.5, 2.5);
      this.nailsLayer.fill({ color: 0xc4a06a });
    }
  }

  private pinBottomRightTo(x: number, y: number): void {
    const bottomRight = this.cloth.getBottomRightParticle();
    bottomRight.pinned = true;
    bottomRight.x = x;
    bottomRight.y = y;
    bottomRight.oldX = x;
    bottomRight.oldY = y;
  }

  private unpinBottomRight(): void {
    const bottomRight = this.cloth.getBottomRightParticle();
    bottomRight.pinned = false;
  }

  private setupInteraction(): void {
    this.interactionArea.on("pointerdown", (event: { global: { x: number; y: number } }) => {
      if (this.fsm.state !== "IDLE") return;

      this.pendingSpringbackRestore = false;
      this.isDragging = true;
      this.dragX = event.global.x;
      this.dragY = event.global.y;
      this.interactionArea.cursor = "grabbing";

      this.pinBottomRightTo(this.dragX, this.dragY);
      this.fsm.startDragging();
    });

    this.onWindowPointerMove = (event: PointerEvent) => {
      if (!this.isDragging || this.fsm.state !== "DRAGGING") return;

      const rect = this.canvas.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;

      this.dragX = Math.max(0, Math.min(this.width, canvasX));
      this.dragY = Math.max(0, Math.min(this.height, canvasY));

      this.pinBottomRightTo(this.dragX, this.dragY);
    };

    this.onWindowPointerUp = () => {
      if (!this.isDragging || this.fsm.state !== "DRAGGING") return;

      this.isDragging = false;
      this.interactionArea.cursor = "grab";

      this.pinBottomRightTo(this.dragX, this.dragY);
      this.unpinBottomRight();
      this.fsm.release();
    };

    window.addEventListener("pointermove", this.onWindowPointerMove);
    window.addEventListener("pointerup", this.onWindowPointerUp);

    this.interactionArea.on("pointermove", () => {
      if (this.fsm.state === "IDLE") {
        this.interactionArea.cursor = "grab";
      }
    });
  }

  private onStateTransition(transition: {
    from: CurtainState;
    to: CurtainState;
    reason: string;
  }): void {
    if (transition.from === "IDLE" && transition.to === "DRAGGING") {
      this.formElement.style.pointerEvents = "none";
      if (this.captureSnapshot()) {
        this.formElement.style.visibility = "hidden";
      }
    }

    if (transition.to === "IDLE" && transition.from === "DRAGGING") {
      this.unpinBottomRight();
      this.pendingSpringbackRestore = true;
    }
  }

  private captureSnapshot(): boolean {
    try {
      const canvasWithCapture = this.canvas as HTMLSourceCanvas & {
        captureElementImage: (element: HTMLElement) => ImageBitmap;
      };
      const snapshot = canvasWithCapture.captureElementImage(this.formElement);
      this.frozenSource = new ElementImageSource({
        resource: snapshot,
        autoClose: true,
      });
      this.meshTexture = Texture.from(this.frozenSource);
      this.updateShaderTexture();
      return true;
    } catch (error) {
      console.warn("captureElementImage failed, keeping HTMLSource:", error);
      return false;
    }
  }

  private destroySnapshot(): void {
    if (this.frozenSource) {
      this.meshTexture = this.liveTexture;
      this.updateShaderTexture();
      this.frozenSource.destroy();
      this.frozenSource = null;
    }
  }

  private updateShaderTexture(): void {
    this.customShader.resources.uFormTexture = this.meshTexture.source;
    this.customShader.resources.uFormSampler = this.meshTexture.source.style;
  }

  private update(deltaTime: number): void {
    if (this.isDragging && this.fsm.state === "DRAGGING") {
      this.pinBottomRightTo(this.dragX, this.dragY);
    }

    this.cloth.step(deltaTime);

    if (!this.isDragging && this.pendingSpringbackRestore) {
      this.unpinBottomRight();
      const freeCorner = this.cloth.getBottomRightParticle();
      const restX = this.cloth.config.width;
      const restY = this.cloth.config.height;
      const distanceToRest = Math.sqrt(
        (freeCorner.x - restX) ** 2 + (freeCorner.y - restY) ** 2,
      );
      if (distanceToRest < 40) {
        this.pendingSpringbackRestore = false;
        this.formElement.style.visibility = "visible";
        this.destroySnapshot();
        this.formElement.style.pointerEvents = "auto";
      }
    }

    this.updateGeometry();
  }

  private updateGeometry(): void {
    const positions = this.cloth.getPositions();
    const geometryPositions = this.geometry.positions;

    for (let index = 0; index < positions.length / 2; index++) {
      const particleX = positions[index * 2];
      const particleY = positions[index * 2 + 1];
      geometryPositions[index * 2] = (particleX / this.width) * 2.0 - 1.0;
      geometryPositions[index * 2 + 1] = 1.0 - (particleY / this.height) * 2.0;
    }

    this.geometry.getBuffer("aPosition").update();
  }

  public resize(width: number, height: number): void {
    if (this.destroyed) return;
    this.width = width;
    this.height = height;
    this.cloth?.resize(width, height);
    if (this.formElement) this.updateFormSize();
    if (this.interactionArea) this.drawInteractionArea();
    if (this.nailsLayer) this.drawNails();
  }

  private waitForHTMLSourceReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.htmlSource.isReady) {
        resolve();
        return;
      }

      const onPaint = () => {
        this.canvas.removeEventListener("paint", onPaint);
        resolve();
      };
      this.canvas.addEventListener("paint", onPaint);

      setTimeout(() => {
        this.canvas.removeEventListener("paint", onPaint);
        resolve();
      }, 3000);
    });
  }

  static getUnsupportedMessage(): string {
    return `Your browser doesn't support the HTML-in-Canvas feature.

Please enable it in Chrome:
1. Open chrome://flags in your address bar
2. Search for "HTML in Canvas"
3. Set it to "Enabled"
4. Click "Relaunch" to restart Chrome

Then reload this page.`;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.onWindowPointerMove) {
      window.removeEventListener("pointermove", this.onWindowPointerMove);
      this.onWindowPointerMove = null;
    }
    if (this.onWindowPointerUp) {
      window.removeEventListener("pointerup", this.onWindowPointerUp);
      this.onWindowPointerUp = null;
    }

    this.destroySnapshot();
    this.htmlSource?.destroy();

    try {
      this.app.destroy(true);
    } catch {
      // Application.destroy 在 init 未完成时可能抛异常
    }
  }
}
