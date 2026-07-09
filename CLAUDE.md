# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server (HMR)
npm run build     # tsc -b && vite build
npm run preview   # serve production build
npm run lint      # oxlint (no fix flag — fix manually)
```

No test runner is configured.

## Tech stack

- React 19 + TypeScript 6 + Vite 8
- PixiJS v8 (rendering) — note v8 API breaking changes from v7; `pixijs-migration-v8` skill in `.agents/skills/` covers migration
- `vite-plugin-glsl` — imports `.glsl` files as strings (`?raw` also works)
- Oxlint (not ESLint) — config lives in `.oxlintrc.json` if extended

## Architecture

This is a "curtain form" demo: an HTML form rendered onto a deformable cloth that the user lifts like a curtain. The integration hinges on a few non-obvious pieces:

**`src/CurtainApp.ts`** is the god object — owns the Pixi `Application`, the cloth sim, the FSM, the mesh/shader, and the texture pipeline. React (`CurtainFormDemo.tsx`) only mounts a container div, instantiates `CurtainApp`, wires a `ResizeObserver`, and handles the unsupported-browser fallback. All rendering/interaction logic is in `CurtainApp`.

**Cloth pipeline (`src/physics/`):** `Particle` (Verlet position+oldPosition+acceleration) + `Spring` (structural/shear/bend, three types) + `ClothSimulation` (30×20 grid, left-column pinned, Verlet integration, 3-iteration constraint solver, gravity, damping, micro wind). Runs on CPU; positions are uploaded to `MeshGeometry` each frame.

**Wrinkle shader (`src/shaders/`):** custom GLSL — vertex passes `vNormal`/`vCurvature`; fragment layers form texture + diffuse light + curvature AO + fabric noise. `CurtainApp` computes face normals and area-weighted vertex normals + curvature on CPU each frame and writes them into the geometry's custom attributes. This is why the project uses base `Mesh` + `MeshGeometry` instead of `MeshPlane` (which has a fixed shader).

**Form texture pipeline (the tricky part):** uses PixiJS v8 experimental HTML-in-Canvas API. The form is a real HTML DOM element appended as a child of `app.canvas` (hard requirement of `HTMLSource`). Two texture modes swap at runtime:
- IDLE → `HTMLSource` (live, interactive form)
- DRAGGING → `ElementImageSource` from `canvas.captureElementImage(form)` (frozen snapshot, avoids click misregistration on deformed mesh)

`import "pixi.js/html-source"` is a side-effect import that registers these sources — must run before use.

**Interaction (`src/interaction/CurtainFSM.ts`):** FSM `IDLE ↔ DRAGGING → OPENED`. The lift-redesign change (see `openspec/changes/curtain-lift-redesign/`) fixed a critical bug: pointer events must be on `window`, not on the Pixi mesh — `pointerdown` fires on the interaction area but PixiJS doesn't route `pointerup` back to the mesh, so dragging never ended. Keep global listeners; clean them up in `destroy()`.

**Coordinate spaces** (documented in `CurtainApp.ts`): cloth physics is local (0,0 top-left), WebGL NDC is (-1,-1) bottom-left, Pixi screen is (0,0) top-left. The shader handles local→NDC.

## Browser support

Requires WebGL2 **and** the HTML-in-Canvas feature (Chrome: `chrome://flags/#enable-html-in-canvas`). `CurtainApp.getUnsupportedMessage()` drives the fallback UI. Feature-detect via `canvas.requestPaint`.

## OpenSpec

Spec-driven workflow lives in `openspec/`. Active change folders:
- `curtain-form` — original build (cloth physics, wrinkle shader, form-texture pipeline, interaction FSM)
- `curtain-lift-redesign` — top-row pinning + bottom-right lift + centered 640×480 canvas + pointer-event fix

Each change has `proposal.md` / `design.md` / `tasks.md` / `specs/<capability>/spec.md`. When extending capabilities, follow this pattern and mark tasks `[x]` only when actually done.

## Conventions

- React StrictMode double-invokes effects; `CurtainFormDemo` guards with a `destroyed` flag and destroys the late-init `CurtainApp` instance on the discarded mount. Preserve this when refactoring the mount effect.
- `CurtainApp` has an instance counter and logs construction — useful for debugging StrictMode double-mounts.
- Pinned particles: top row (`row === 0`) after the lift-redesign; left column was the original. Check `ClothSimulation` before assuming which edge is fixed.
- GLSL files are imported via `?raw` (Vite) — both `vite-plugin-glsl` and `?raw` work; stay consistent within a file.
