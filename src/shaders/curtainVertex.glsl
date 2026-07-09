#version 300 es
precision highp float;

// MeshGeometry 的 positions 在 CPU 端已转为 NDC (-1~1)
in vec2 aPosition;
in vec2 aUV;

out vec2 vUv;
out vec2 vNdcPos;  // NDC 位置，用于 dFdx/dFdy 推导法线

void main() {
    vUv = aUV;
    vNdcPos = aPosition;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}