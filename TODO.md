# KiteForge TODO

Goal: design a kite, print accurately sized layout pieces, then cut and assemble
the physical kite. This is the project's single task list and progress record.

Unchecked tasks are a proposed work queue, not authorization to implement every
feature. Product choices marked undecided need resolution before dependent work.
Before starting a task, inspect current code and reproduce any reported issue.
Split substantial tasks into smaller steps with checkable outcomes.

## Flight Calculation Layer (Approved 2026-10-27)

Paper body, wings and tails; two perpendicular lightweight sticks. Actual paper
grammage, stick masses, bridle and flying-line specifications remain unmeasured.
Implement the approved steady-wind design without UI, dependencies or editor changes.

- [x] FLIGHT-01: Add `src/app/flight/types.ts`, `physics.ts` and `presets.ts`.
  Test SI conversions, convex panel measurements, layered mass versus explicit
  nonoverlapping exposed patches, mass distribution and invalid inputs first.
  Then implement pure numeric measurement and mass functions. Concave outlines
  must be partitioned by the caller; no implicit polygon boolean operations.
- [x] FLIGHT-02: Extend physics with supplied coefficient tables, force balance,
  moments about the bridle and bounded pitch-trim search. Test wind-squared forces,
  symmetry, zero wind, missing data and restoring/unstable synthetic fixtures.
  No automatic aerodynamic calibration, structural safety or dynamic simulation.
- [x] FLIGHT-03: Add `scoring.ts` and flight `README.md`; test explicit scoring
  policy, unavailable categories and deterministic outputs. Document sources,
  units, example assumptions and experimental calibration needs. Run `npm test`
  and `npm run build`; record actual results in `PROJECT_STATE.md`.

Verified 2026-10-27: 39 tests pass (24 flight, 15 existing); production build passes
with the existing bundle warning. UI/animation, physical editor adapter and real
coefficient calibration are not part of this completed calculation-layer task.

## Now: Project Foundation

- [x] FLIGHT-04: Read-only editor adapter with no UI or animation. Preserve live
  geometry/transforms, split physical mass from union exposure, exclude visuals,
  report missing/unsupported inputs, and test all templates and history changes.
  See `src/app/components/kite-editor/flight-adapter.md` for caller requirements.
  Re-audited 2026-10-30 without duplicating integration: strengthened unsupported
  geometry guards and explicit clipping-tolerance reporting. All 56 tests and
  production build passed; physical calibration remains caller-provided.
- [x] FLIGHT-05: Add in-memory Test Flight settings and an accessible current-design
  popup. Convert confirmed user measurements to SI, invalidate stale results,
  expose available geometry/mass, and withhold forces/scores without calibration.
  No animation, persistence, dependency or structural-safety claim.

- [ ] SETUP-01: Add a suitable `.gitignore` and establish Git history.
  Done when a reviewed baseline can be recovered and dependencies, generated
  output, secrets and private session files are excluded. Git initialization,
  commits and remote setup require a user request; do not publish automatically.
- [x] DOC-01: Create `DESIGN.md` from confirmed product decisions.
  Done when the design-to-print workflow, current visual conventions and open
  decisions are documented without presenting proposals as approved features.
- [x] DOC-02: Create `ARCHITECTURE.md` describing the current editor.
  Done when module ownership, state flow, scene lifetime and geometry assumptions
  are explained, and proposed physical-part modeling is separate from current code.
- [ ] CHECK-01: Configure a dedicated TypeScript check.
  Done when an agreed check command validates application and editor types and
  identified errors are resolved without suppressing meaningful checks.
- [ ] CHECK-02: Configure linting using agreed tooling.
  Done when a documented command checks the maintained source and passes without
  hiding errors. New dependencies need approval under `AGENTS.md`.

## Next: Editor Reliability

- [ ] BUG-01: Fix overlapping controls on narrow screens.
  Done when mode controls, history, drawing toolbar and orientation control are
  reachable and do not overlap at 375px and 1440px viewport widths.
- [ ] BUG-02: Match paint clipping and selection outlines to each template.
  Done when painting reaches valid edges without spilling or disappearing across
  all six templates, including curved bodies and tails.
  Body masking and outlines now use actual template geometry; all six pass
  geometry checks, with Swallow/Oval browser coverage. Replacement-tail outline
  synchronization remains part of BUG-03.
- [ ] BUG-03: Synchronize replacement-tail selection and decoration data.
  Done when the visible replacement tail is the selected and paintable object,
  highlights follow it and the removed tail no longer participates in selection.
- [ ] BUG-04: Verify freeform-part removal and undo/redo bookkeeping.
  Done when removed parts cannot be selected or retain orphaned decoration, and
  undo/redo restores the correct object, drawing layers and selection data.
  This is an audit task; reproduce a failure before treating it as a confirmed bug.
- [ ] UX-01: Return to template selection without refreshing.
  Done when users can choose another template and the agreed handling of unsaved
  edits is respected. Confirm that handling before implementation.
- [ ] INPUT-01: Support touch drawing and selection.
  Done when painting, selecting and transforming parts work on touch input, with
  a clear distinction between editing gestures and camera gestures.
- [ ] CHECK-03: Expand automated interaction coverage using agreed tooling.
  Done when affected template, mode, drawing, transform, attachment and history
  workflows can be checked repeatedly, with no new browser errors.

## Print Milestone: Physical Layout Pieces

These tasks implement the confirmed product goal. Resolve PRINT-01 before
choosing export tools or making print-specific changes to the geometry model.

- [ ] PRINT-01: Agree on the first printing specification.
  Done when paper sizes, margins, physical units, export format, decoration
  inclusion, assembly allowances and oversized-part handling are recorded.
  Decide whether the first release targets ordinary printers, cutting machines
  or both. Actual laser-machine support is not confirmed.
- [ ] PRINT-02: Define dimensioned 2D parts as the shared geometry model.
  Depends on PRINT-01. Done when stable part identifiers, outlines, transforms,
  units and decoration mapping can describe one template without losing current
  editor behavior. Document how 3D coordinates map to physical measurements.
- [ ] PRINT-03: Derive one template's 3D preview from the physical part model.
  Depends on PRINT-02. Done when dimensions and edits match between the 2D model
  and 3D preview, verified against a known-size fixture.
- [ ] PRINT-04: Arrange that template's parts on printable pages.
  Depends on PRINT-03. Done when pieces retain their dimensions, fit within the
  agreed printable area and do not overlap; report pieces that cannot fit.
  Do not silently shrink parts to make them fit.
- [ ] PRINT-05: Export the first usable cutting layout.
  Depends on PRINT-04. Done when the agreed format preserves physical scale,
  cutting outlines and any agreed decoration or assembly information.
  Confirm default exports with numerical checks and visual inspection.
- [ ] PRINT-06: Validate a real printed and assembled sample.
  Depends on PRINT-05. Done when a user prints at the documented scale, measures
  reference lengths, checks assembly fit and records any discrepancies.
  Digital tests alone cannot establish physical print or flight accuracy.
- [ ] PRINT-07: Extend the validated model and export workflow to other templates.
  Depends on PRINT-06. Complete one template at a time; verify outlines, tails,
  supported attachments and decoration alignment for each.

## Later: Proposed Improvements

- [ ] SAVE-01: Agree on design saving and reopening behavior.
  Done when local versus account-based storage, file portability and refresh
  recovery are decided. Accounts and cloud storage are not approved requirements.
- [ ] SAVE-02: Implement the agreed save/load flow.
  Depends on SAVE-01 and a documented design schema. Done when a design can be
  reopened with its template, parts, dimensions and decoration intact, and
  invalid or unsupported data produces a useful error without corrupting edits.
- [ ] PERF-01: Investigate bundle size and rendering performance.
  Done when measured bottlenecks guide focused improvements, with browser checks
  showing no regressions in editor behavior or visual output.
- [ ] ACCESS-01: Audit keyboard access and control names.
  Done when supported controls have visible focus, accessible names and predictable
  focus behavior, with remaining canvas-interaction limitations documented.
- [ ] RELEASE-01: Prepare a public release and deployment plan.
  Done when release scope, browser support, known limitations and hosting choices
  are reviewed. Public deployment requires a separate user request.

## Decisions Needed

- Intended audience and required mobile support.
- First paper sizes and printer margins; current A3 limits are prototype assumptions.
- Export format and whether printed pieces include decoration or just outlines.
- Multi-page tiling versus restricting individual pieces to one sheet.
- Material, overlap, glue or seam allowances and assembly instructions.
- Ordinary printer output versus actual laser-cutter support.
- Saving and handling unsaved edits when switching templates.

## Done

- [x] Split the large editor into state, geometry, scene, drawing, selection,
  history, attachment and controls modules.
- [x] Add four focused regression tests covering history and drawing geometry.
- [x] Verify the refactor with a production build and browser smoke checks for
  rendering, drawing, undo/redo and mode switching.
- [x] Create `AGENTS.md` for the project's actual stack and working rules.
- [x] Document the physical printable-pieces goal in `AGENTS.md` and `README.md`.
- [x] Update the root README with project context and incremental development workflow.
- [x] Create this task list. No unchecked tasks were implemented as part of its creation.
- [x] Create `PROJECT_STATE.md` with the current implementation, verification
  record and continuation context.
- [x] Create `DESIGN.md` and `ARCHITECTURE.md` from confirmed project context.

## Updating This File

Keep task IDs stable. Mark a task complete only after its acceptance checks pass,
and record material limitations. Add blockers or dependencies as they become
known. Keep completed work so later sessions do not repeat it.
