#version 300 es
precision mediump float;

in vec2 vUv;
in vec2 vNdcPos;

uniform sampler2D uFormTexture;
uniform sampler2D uFabricNoise;
uniform vec3 uLightDir;

out vec4 finalColor;

void main() {
    vec4 formColor = texture(uFormTexture, vUv);

    // 从屏幕空间导数推导法线
    vec2 dx = dFdx(vNdcPos);
    vec2 dy = dFdy(vNdcPos);
    vec2 duvdx = dFdx(vUv);
    vec2 duvdy = dFdy(vUv);

    float det = duvdx.x * duvdy.y - duvdx.y * duvdy.x;
    float invDet = abs(det) > 0.0001 ? 1.0 / det : 0.0;

    vec2 dPdu = vec2(
        dx.x * duvdy.y - dy.x * duvdx.y,
        dx.y * duvdy.y - dy.y * duvdx.y
    ) * invDet;

    vec2 dPdv = vec2(
        dy.x * duvdx.x - dx.x * duvdy.x,
        dy.y * duvdx.x - dx.y * duvdy.x
    ) * invDet;

    float zScale = 3.0;
    vec3 Tu = vec3(dPdu, zScale);
    vec3 Tv = vec3(dPdv, zScale);

    vec3 normal = cross(Tu, Tv);
    float normalLen = length(normal);
    normal = normalLen > 0.0001 ? normal / normalLen : vec3(0.0, 0.0, 1.0);
    if (normal.z < 0.0) normal = -normal;

    // 漫反射光照
    vec3 lightDirection = normalize(uLightDir);
    float diffuse = max(dot(normal, lightDirection), 0.0);
    float ambient = 0.9;
    float wrinkle = ambient + (1.0 - ambient) * diffuse;
    wrinkle = clamp(wrinkle, 0.0, 1.2);

    // 曲率 AO（各向异性近似）
    float stretchU = length(dPdu);
    float stretchV = length(dPdv);
    float anisotropy = abs(stretchU - stretchV) / max(stretchU + stretchV, 0.001);
    float curvatureAO = 1.0 - smoothstep(0.0, 0.6, anisotropy) * 0.2;
    curvatureAO = clamp(curvatureAO, 0.5, 1.0);

    // 亚麻织纹叠加
    float fabric = texture(uFabricNoise, vUv * 20.0).r;
    fabric = mix(0.97, 1.03, fabric);

    vec3 finalRgb = formColor.rgb * wrinkle * curvatureAO * fabric;
    finalColor = vec4(finalRgb, formColor.a);
}
