# Curtain Form Demo

An interactive form rendered on a deformable cloth mesh. Drag the bottom-right corner to lift the curtain; release and the fabric springs back under gravity and springs.

Built with **React 19**, **TypeScript**, **Vite 8**, and **PixiJS v8** (WebGL2 + experimental HTML-in-Canvas).

## Features

- **Cloth physics** — 30×20 particle grid, Verlet integration, structural / shear / bend springs; top row pinned like a curtain rod
- **Corner lift** — grab the bottom-right 80×80 hit area; pointer move/up on `window` so release always ends the drag
- **Live form texture** — real HTML form as Pixi texture via `HTMLSource`; freezes to a snapshot while dragging so hits stay stable on the deformed mesh
- **Wrinkle shading** — custom GLSL (screen-space normals from `dFdx`/`dFdy`, diffuse light, fabric noise)
- **Decorative nails** — Pixi Graphics pins at the top corners

## Requirements

| Need | Notes |
|------|--------|
| Node.js | Recent LTS recommended |
| Chrome (or Chromium) | WebGL2 + **HTML-in-Canvas** |

HTML-in-Canvas is still experimental. If the page shows “Browser Not Supported”:

1. Open `chrome://flags`
2. Search for **HTML in Canvas**
3. Set to **Enabled** → Relaunch → reload this app

Feature detection uses `canvas.requestPaint`.

## Quick start

```bash
npm install
npm run dev
```

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (HMR) |
| `npm run build` | `tsc -b` + production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | Oxlint |

## How it works

```
React (CurtainFormDemo)
  └─ mounts 640×480 container, ResizeObserver, unsupported fallback
       └─ CurtainApp
            ├─ ClothSimulation (CPU physics → positions each frame)
            ├─ Mesh + custom wrinkle shader
            ├─ Form DOM (child of canvas → HTMLSource)
            ├─ CurtainFSM: IDLE ↔ DRAGGING (always spring back on release)
            └─ Interaction: corner Graphics + window pointer listeners
```

**Texture modes**

| State | Texture source | Why |
|-------|----------------|-----|
| Idle | `HTMLSource` (live form) | Form stays interactive and up to date |
| Dragging | `ElementImageSource` snapshot | Avoids mis-hits on a warped mesh |

**Coordinates**

- Cloth physics: `(0,0)` top-left → `(width, height)` bottom-right  
- Shader uploads NDC positions each frame (`aPosition`)

## Project layout

```
src/
  CurtainApp.ts              # Pixi app, mesh, textures, input, lifecycle
  components/CurtainFormDemo.tsx
  interaction/CurtainFSM.ts  # IDLE | DRAGGING
  physics/                   # Particle, Spring, ClothSimulation
  shaders/                   # curtainVertex / curtainFragment (.glsl?raw)
  utils/generateFabricTexture.ts
```

## Notes

- React StrictMode double-mounts effects; the demo guards with a `destroyed` flag and tears down the discarded `CurtainApp`.
- Side-effect import `pixi.js/html-source` must run before using HTML texture sources.
- Lift always springs back; there is no “fully open / success page” path in the current code.

## License

Private demo / experiment — no license file included.
