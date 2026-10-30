# KiteForge Project State

Last updated: 2026-10-30 (Asia/Calcutta).

This is a snapshot for continuing development across sessions. Use
[TODO.md](TODO.md) for task priorities, dependencies and acceptance checks, and
[AGENTS.md](AGENTS.md) for working rules. Confirm this snapshot against current
source before changing behavior.

## Product Direction

The confirmed goal is to design a kite, print separate layout pieces, then cut
and assemble a physical kite. The 3D editor provides a preview of the design.
Printable layouts are required for that goal but are not implemented.
Actual laser-cutter integration and machine-specific formats are not confirmed.

## Current Stage

The project is a local, client-side editor prototype using React, TypeScript
source files, Vite and Three.js. Tailwind CSS and inline styles provide the UI.
There is no backend, database, authentication, payment system or cloud storage.
The current folder has no Git repository or `.gitignore`.

The preview was previously started at http://127.0.0.1:5173/. This address is
local to the computer, and the server must be running for it to work. No public
deployment URL has been established in this work.

## Implemented

- Start screen and six templates: Classic, Diamond, Oval, Swallow, Fighter and Butterfly.
- Build and Design modes, with history scoped by mode and surface.
- 3D orbit, zoom and orientation controls.
- Shape drawing, freehand brush and preset/custom colors.
- Selection, movement, resizing and rotation for supported objects.
- Tail attachment choices and supported wing attachments.
- Undo, redo and clear controls.
- Prototype A3 resizing limits and a scene-unit-to-millimeter conversion.

These capabilities exist in code; the verification below describes what was
actually tested. Physical dimensions and flight behavior are not validated.

## Latest Completed Work

### Test Flight Settings And Popup (2026-10-30)

- Added an accessible responsive Test Flight dialog using the existing Radix
  dialog, controls, Lucide icons and current `snapshotFlight` adapter. It always
  reads the current edited design; no sample kite is substituted.
- In-memory settings cover confirmed editor scale, paper grammage, each stick's
  measured mass, bridle coordinates, wind speed, air density and optional line
  elevation/breaking load with explicit massless-straight-line consent. Blank
  values remain unknown; UI grams/centimetres/degrees convert to SI.
- Available dimensions, exposure, mass and CG are shown. Lift, drag, tension,
  pitch and scoring remain unavailable when calibrated coefficient profiles are
  missing. Scoring calls the existing module with the named equal-weight balance,
  restoring-pitch and equilibrium policy; it is never a flight probability.
- Results are invalidated by setting or editor-history revisions. Radix provides
  focus trapping, Escape closing and trigger focus return. No animation, backend,
  persistence, dependency or independent physics change was added.
- Verification: all 60 regression tests passed and the production build passed
  with the existing >500 kB chunk warning. Browser checks passed at 1280x800 and
  a 428x844 mobile viewport: no horizontal overflow or control overlap, modal
  layering/scrolling worked, Escape returned focus, and a populated current-design
  run showed dimensions/area/mass/CG while withholding uncalibrated forces/score.
  A fresh console check after the dialog ref fix reported no errors or warnings.

### Adapter Verification And Guards (2026-10-30)

- Reused the existing `snapshotFlight` integration; no duplicate adapter, UI,
  animation, dependencies or changes to the independent flight maths.
- Rejects root matrix shear/projective transforms, instanced paper, partial or
  deformed sticks and invalid frame ring metadata. Snapshots remain read-only.
- Reports numerical exposure-clipping fragments explicitly instead of silently
  dropping them. Physical layer area is retained; union exposure has documented
  numerical tolerance.
- Four new regression tests failed before fixes and passed afterward. All 17
  adapter tests and all 56 full-suite tests passed. Production build passed with
  the existing >500 kB chunk warning. No browser check or dedicated typecheck run.
- Scale requires caller evidence; material weights, stick mass, bridle, line,
  flexible-tail data and aerodynamic calibration are not inferred. These checks
  validate software geometry, not flight performance or manufacturing accuracy.

### Editor Flight Adapter (2026-10-27)

- Added `flightAdapter.ts`, `flightGeometry.ts` and the adapter contract under
  `kite-editor/`; `useEditorState.snapshotFlight(options)` reads live refs on demand.
- Preserves all six template meshes, current transforms, actual wing/tail shapes
  and two frame centerlines. No source scene/state/cache mutation. Geometry is
  converted only with explicit caller scale confirmation; nominal scale remains
  100 mm/unit, not verified manufacturing evidence.
- Counts every physical paper layer while convex subtraction counts exposed rigid
  sail area once. Paint, duplicate faces, highlights and handles add no mass/area.
- Requires explicit flat/flexible tail classification. Nonrectangular flexible
  tails, tilted paper and unsupported geometry block flight input. Unknown paper
  density, stick mass, bridle, line, wind and coefficients remain missing.
- No flight maths changes, dependencies, UI, animation or flight score claims.
- Full test suite: 52 passed, 0 failed, including 13 new adapter tests. Coverage
  includes templates, transforms, scale, overlap, decoration exclusion, replacement,
  real undo/redo, flexible strips and unsupported inputs. Production build passed
  with the existing >500 kB chunk warning; no dedicated typecheck/lint is configured.
  Software tests do not establish physical calibration.
- Browser smoke checking was attempted after restarting the local preview, but
  browser automation timed out and then failed decompression. No successful
  browser verification is claimed for this adapter change.

### Flight Calculation Layer (2026-10-27)

- Added `src/app/flight/types.ts`, `physics.ts`, `scoring.ts`, `presets.ts` and its
  README. Pure numeric TypeScript, no dependencies or editor/UI changes.
- User confirmed paper body/wings/tails with two perpendicular lightweight sticks.
  Grammage, stick masses/species/sections, bridle and flying-line details remain
  unmeasured. Example values are explicitly illustrative, not validated presets.
- Supports SI conversion, convex panel area/centroid, all-layer mass, exposed-area
  separation, CG, supplied-coefficient lift/drag, moments, line-force residuals,
  pitch-trim search and conditional local restoring/unstable/neutral estimates.
- Scoring requires an explicit policy, remains provisional, and withholds overall
  results when requested data/categories are unavailable. No structural safety
  rating, default paper aerodynamic coefficients or universal size limits.
- Convex coplanar panels only; concave outlines need caller partitioning. Flexible
  tail pose/drag is supplied rather than dynamically solved. No flutter, gust,
  roll/yaw stability, frame failure or realistic flying-line model.
- The calculation layer itself has no UI or animation; the later adapter and popup
  entries above now connect it to the current editor design.
  The nominal editor scale is 100 mm/unit, not a verified manufacturing scale.

### Earlier Editor Work

- Corrected the lower-right Classic/Diamond panel winding so its front/back
  patterns match the other three panels. Added model-level normal checks.
- Body paint is masked by each template's rendered panels, including concave
  outlines. Body highlights and selection borders use the same panel geometry,
  replacing the shared diamond boundary. Attachment paint remains separate.
  Verified with geometry regressions for all six templates and browser checks
  on Swallow and Oval (brush/stamp clipping, stamp movement, undo/redo and clear).

- New designs start neutral. Design mode has a right-side pattern panel with
  Plain, Dots, Crosshatch, Waves and optional Four-color patterns, editable colors,
  Shuffle, and shared settings applied to both sides. It collapses on narrow screens.
  Hand-drawn artwork remains independent on each side.
  Patterns cover the body beneath existing paint; wing/tail painting is retained.

- New brush strokes and shape stamps remember the side they were drawn on,
  including wing and tail paint. Opposite-side artwork is hidden when orbiting.

- Body strokes stay on their starting surface plane when the pointer leaves an
  edge. Removed the camera-facing fallback and drawing-tool rotation reset.

- Design brushes and shape stamps now paint live wings and tails using local
  texture layers on their exact mesh geometry, including fork gaps and twin
  ribbons. Layers follow part transforms and have per-part undo/redo and clear.

- Wings are selectable in Build mode with the tail's resize handles. Resizing
  either side applies the same scale ratio to the opposite wing; undo/redo
  restores both transforms together. Wing roots move inward as sizes increase.

- Inset wing mounting positions so the rotated root edge sits behind the body.
  Regression coverage checks both Classic roots for all six wing shapes.

- Left/right corner controls now offer six dedicated wings: Long Triangle,
  Single Ribbon, Twin Ribbons, Diamond, Swept Fin and Forked Wing. They mount
  at a mirrored 55-degree downward angle. Tail choices remain separate.
  Butterfly's initial wings remain unchanged until replaced.

- Flipped the Classic template's default triangular tail to point upward toward
  the body, matching its existing thumbnail, with the same size and overlap.

- Refactored the large editor into focused modules, coordinated by
  `src/app/components/KiteViewer.tsx`.
- Added four regression tests in `tests/editor-history.test.cjs`.
- Created `AGENTS.md`, updated the root `README.md`, and created `TODO.md`.
- Recorded printable physical kite pieces as the product goal.
- Created `DESIGN.md` and `ARCHITECTURE.md`.
- Applied the user-requested Kawaii Pastel Pop style to the template chooser and
  editor, with shared CSS tokens, responsive controls and accessible tool labels.

The editor module map is in
[src/app/components/kite-editor/README.md](src/app/components/kite-editor/README.md).
Shared state and scene references are owned by `useEditorState`; scene lifetime,
model construction, drawing, selection, history and attachments have separate
modules. Preserve those ownership boundaries when continuing development.

## Verification Record

For the calculation-layer addition on 2026-10-27:

- `node --test tests/flight.test.cjs` was run incrementally with failing tests
  before implementation, followed by the full test suite.
- `npm test`: 39 passed, 0 failed (24 flight tests and 15 existing regressions).
  Includes units, layered mass/exposure, CG, symmetry/moments, analytic trim,
  line constraints, tail drag, invalid/missing inputs, scoring and determinism.
- `npm run build`: passed; existing >500 kB JavaScript chunk warning remains.
- No browser interaction checks were run: editor code and UI were unchanged and
  the module is not imported by the app yet. No typecheck/lint scripts are present;
  no TypeScript compiler is installed. Build/test bundling is not a type check.

The remaining verification records below refer to earlier editor work.

For the latest visual update on 2026-10-04:

- Production build passed, retaining the existing large-bundle warning.
- Browser smoke checks at desktop and phone widths confirmed template selection,
  the rendered 3D scene, Build/Design switching and the color picker. No console
  errors were reported. Drawing gestures, attachments and transforms were not
  exhaustively retested in the browser; touch drawing remains a known limitation.
- Preview server started at http://127.0.0.1:5174/ because 5173 was occupied.

- `npm test`: passed when rerun with normal filesystem access. The first sandboxed
  run failed because esbuild could not read an ancestor directory during module
  resolution.

The following checks passed during the editor refactor on 2026-10-04; they were
not rerun for the latest documentation-only update:

- Production build: passed, with a large JavaScript bundle warning.
- Browser smoke checks: Classic template rendering, drawing a shape, undo,
  redo and switching between Build and Design.

This is not full coverage of all templates, transforms, attachments, touch input
or export workflows. Dedicated TypeScript checking, linting and automated
end-to-end scripts are not configured. A successful build is not a type check.

Frame sticks render after transparent decoration while retaining depth tests.
Build hides the brush and color picker and rejects brush input; structural
shape tools remain available. Switching modes closes the color picker and
finishes any active drawing before changing history scope.
Verified with 15 passing regression tests, a production build, and browser
checks of paint over the frame and switching from the Design brush to Build.

## Known Gaps

- Designs exist only in memory; a refresh loses edits.
- Save/load, print layouts and export downloads are absent.
- Narrow-screen control overlap was observed in the browser.
- Drawing uses mouse input; touch editing needs dedicated work.
- Replacement-tail selection/highlight synchronization still needs verification;
  body drawing boundaries now follow each template's geometry.
- Returning to template selection currently requires a refresh.
- Freeform-part removal and undo/redo bookkeeping need an audit; this is an
  investigation task rather than a separately reproduced failure.

## Decisions And Next Steps

The next proposed foundation task is `SETUP-01` in `TODO.md`: establish ignore
rules and recoverable Git history when requested. Type checking is `CHECK-01`.
No application feature implementation is currently in progress.

Before implementing print exports, resolve `PRINT-01`: paper sizes, margins,
physical units, export format, decoration inclusion, assembly allowances and
oversized-part handling. Ordinary printing versus cutting-machine support is
still open. These decisions block dependent print tasks, not independent fixes.

Target audience, mobile expectations, storage approach and handling unsaved
edits during template changes also remain undecided. Proposed tasks do not
constitute approval for accounts, billing, a backend or a framework migration.

## Continuing A Session

1. Read this snapshot, `AGENTS.md`, and the relevant task in `TODO.md`.
2. Inspect the current source and preserve intervening user edits.
3. Implement the requested task and verify its acceptance checks.
4. Update `TODO.md` for task progress and this file for the current state,
   latest meaningful verification and unresolved blockers.

Run `npm run dev` for development, `npm test` for regression tests and
`npm run build` for production verification. Setup details are in [README.md](README.md).
Keep historical test results distinct from new checks and avoid copying the
entire task queue into this snapshot.
