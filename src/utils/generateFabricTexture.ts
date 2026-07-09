/**
 * 程序化生成亚麻织纹噪波纹理
 * 返回一个 Canvas 元素，可作为 PixiJS Texture 源
 */
export function generateFabricTexture(width: number = 256, height: number = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // 简单的 value noise + 多层叠加模拟织纹
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // 基础噪波（大尺度）
      const n1 = hashNoise(x * 0.05, y * 0.05);
      // 细节噪波（小尺度）
      const n2 = hashNoise(x * 0.2, y * 0.2);
      // 水平纹路（模拟纬线）
      const hLine = Math.sin(y * 1.5 + n1 * 2.0) * 0.5 + 0.5;
      // 垂直纹路（模拟经线）
      const vLine = Math.sin(x * 1.2 + n1 * 1.5) * 0.5 + 0.5;

      // 交织纹理
      const weave = hLine * 0.6 + vLine * 0.4;
      const val = weave * 0.7 + n2 * 0.3;

      const byte = Math.floor(val * 255);
      data[idx] = byte;
      data[idx + 1] = byte;
      data[idx + 2] = byte;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/** 简单的哈希噪波 */
function hashNoise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}