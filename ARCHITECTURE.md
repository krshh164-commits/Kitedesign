# KiteForge Architecture

KiteForge is a client-side React and Three.js prototype. This document describes
the current implementation and separates it from the planned physical print
layout model.

## Runtime Shape

- React owns the application screen flow and editor UI.
- Vite builds and serves the application.
- Three.js owns the 3D scene, geometry, materials, raycasting and camera controls.
- All design state currently lives in browser memory. There is no backend,
  database, authentication or persistent design storage.
- Regression tests use Node's built-in test runner with esbuild.

## Application Flow

`src/main.tsx` mounts the React app.

`src/app/App.tsx` switches between:

- `LandingPage`, where users choose a template.
- `KiteViewer`, where the selected template is edited.

`src/app/components/LandingPage.tsx` renders the start screen and template
chooser. It passes the selected template type back to `App`.

`src/app/components/KiteViewer.tsx` is the editor coordinator. It composes the
editor hooks, keeps mode/tool side effects in one place, and renders
`EditorControls`.

## Editor Modules

The editor lives in `src/app/components/kite-editor/`.

| Module | Responsibility |
| --- | --- |
| `useEditorState.ts` | React state plus persistent scene, selection, history and drawing refs. |
| `useKiteScene.ts` | Three.js scene setup, renderer lifetime, camera, lights, resize, animation loop and pointer transforms. |
| `createKiteModel.ts` | Builds the selected kite body, spars, default tail and template-specific attachments. |
| `templates.ts` | Template surfaces, attachment definitions and geometry factory functions. |
| `useDrawing.ts` | Hit testing, stamping, brush drawing and registration of drawn objects. |
| `drawingGeometry.ts` | Drawing shapes, brush segment geometry and clipping helpers. |
| `useSelection.ts` | Selected-object overlays, transform handles and selection refresh. |
| `useHistory.ts` | Per-mode, per-surface undo, redo, clear and disposal behavior. |
| `useAttachments.ts` | Corner hover detection, attachment panels and replacement animations. |
| `useGizmo.ts` | Orientation gizmo interaction and camera snapping. |
| `gizmoGeometry.ts` | Orientation gizmo texture and easing helpers. |
| `EditorControls.tsx` | Visible controls, panels, toolbars and editor layout. |
| `types.ts` | Shared TypeScript contracts. |
| `constants.ts` | Shared editor constants such as brush size and prototype print limits. |

`src/app/components/kite-editor/README.md` is the compact module guide and should
stay aligned with this document.

## State And Scene Ownership

`useEditorState` owns shared state and long-lived refs. The other hooks receive
the specific state and callbacks they need through the context assembled by
`KiteViewer`.

Scene callbacks use refs for current mode and active tool values so ordinary UI
changes do not recreate the Three.js scene. This is important for preserving
geometry, selection, history and renderer lifetime while editing.

`useKiteScene` creates the Three.js scene once, connects the renderer to the
editor container, initializes OrbitControls and the orientation gizmo, and cleans
up event listeners, animation frames and renderer resources on unmount.

## Modes And History

The editor has two modes:

- Build mode for structure and attachments.
- Design mode for surface decoration.

History stacks are scoped by mode and surface. Add, transform, undo, redo and
clear behavior should preserve that separation. When objects are replaced or
removed, selection overlays, highlights, drawing groups and history references
must remain consistent.

## Current Geometry Assumptions

The current 3D model uses Three.js geometry as the editing source. Some constants
bridge toward physical sizing:

- `MM_PER_UNIT` is a prototype conversion.
- `A3_LONG_MM` and `A3_SHORT_MM` are prototype resizing limits.

These values do not prove print accuracy or flight suitability. They are editor
constraints until a physical part model is designed and validated.

## Planned Physical Part Model

Printable layouts should be based on a dimensioned 2D model that can also drive
the 3D preview. That model should define:

- Stable part and surface identifiers.
- Outlines in explicit physical units.
- Per-part transforms and attachment points.
- Decoration mapping from editor surfaces to printed pieces.
- Page arrangement data for the agreed paper size and margins.
- Assembly labels, allowances and oversized-part handling once decided.

Do not derive printable patterns from canvas screenshots or perspective 3D
renders. Preserve physical dimensions and decoration alignment through export.

## Verification

Current configured checks are:

```sh
npm test
npm run build
```

The regression tests cover focused editor history and drawing geometry behavior.
Production builds verify the Vite bundle but are not a dedicated TypeScript
check. Browser smoke checks are still required for affected editor interactions,
especially scene rendering, mode switching, drawing, selection, transforms,
attachments, undo/redo, clear behavior and narrow layouts.

## Known Risks

- Designs are lost on refresh.
- Printable layouts and export downloads are absent.
- Narrow-screen controls can overlap.
- Drawing is primarily mouse-based.
- Body paint uses a stencil written by the rendered body panels; highlights
  and borders derive from the same geometry. Replacement-tail selection still
  needs focused follow-up.
- No lint, dedicated typecheck or automated browser interaction scripts are
  configured yet.

