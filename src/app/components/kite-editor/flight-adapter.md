# Editor Flight Adapter

`flightAdapter.ts` is the only editor/Three.js boundary for flight input.
Call `state.snapshotFlight(options)` from the existing editor state, or call
`snapshotEditorFlight(source, options)` directly. No UI or animation is added.
The returned `input`, when non-null, implements the existing `FlightInput`.
Pass it to `analyzeFlight` and inspect that analysis's status/issues separately.
The adapter neither calls scoring nor supplies calibration values.

## Contract

- `paper`: detached numeric triangles, source UUID, role and physical model.
  Concave curves and disconnected shapes retain the actual editor tessellation.
- `sticks`: exactly the live spine/cross references, with transformed centerlines.
  Curved cross spars become uniform straight segments in flight input; explicit
  whole-stick mass is apportioned by segment length, never duplicated.
- `input`: null for unconfirmed scale, unresolved tail model, missing body/frame,
  or invalid/unsupported geometry. Missing material/aerodynamic inputs can leave
  a partial input available for independent geometry measurement, not flight scores.
- `issues`: adapter restrictions and missing inputs. `analyzeFlight` remains the
  authority for detailed validation of supplied bridle, wind, pose and coefficients.
- `physicalPaperAreaM2`: material area of every paper layer, including flexible
  strips. `exposedAreaM2`: rigid sail union only; flexible strip drag uses explicitly
  supplied projected area and is not added to the rigid sail patches.

`options.scale` requires positive `millimetresPerUnit` and a nonempty
`confirmation` describing its evidence. `MM_PER_UNIT=100` is inspected nominal
editor metadata, not independent verification of manufacturing dimensions.
The caller owns scale confirmation; a string alone does not prove a measurement.
Length is multiplied by mm/unit / 1000, area by its square.

Optional physical inputs are `paper`, `materialsByPart` (UUID keyed), `frame.spine`
and `frame.cross` (measured mass or measured density/cross-section), `bridle`,
`line`, `wind`, and `profilesByPatch`. Nothing is populated with example values.
Paper density is kg/m2, frame mass kg; display stick radius is never used as a
physical section measurement. Line properties are not inferred from the kite.

Set `tailModel` explicitly to `panel` for fixed flat paper or `flexible` for a
prescribed flexible strip. Flexible mode accepts only one actual rectangular
sheet per part, and requires `flexibleTails[uuid].centerM`; drag needs supplied
projected area, coefficient and center. Forks, fringes and other nonrectangular
flexible outlines return unsupported, never a bounding-box replacement. Paper
wings remain flat panels; no flexibility is inferred from a thumbnail or name.

## Coordinates And Lifetime

The origin/axes are the kite's body frame. Root translation and rotation represent
view pose and are excluded; root scale and every descendant transform are applied.
Both TRS and matrix-only descendant transforms are read without calling any scene
matrix update method. Matrix-only root transforms must decompose into nonsingular
translation, rotation and scale; shear/projective roots return
`unsupported-root-transform` rather than silently changing the physical shape.
Known construction offsets are removed: attachments -0.005,
build group -0.01, and frame +0.02 editor units. Other paper z movement, tilt or
folding is unsupported by the existing flat flight contract.

Live scene membership wins over stale tail/corner/raycast registries. Each call
reads geometry anew, including resizing, movement, replacement, deletion and
history restoration. No cache, source mesh, material, bounding box, matrix, flag,
history array or caller input is modified. Output values do not retain live refs.
UUID-based part IDs persist through transforms and history but change on replacement.

## Layers And Exposure

Body triangles come from the live body registry. Attachments and structural build
parts come from their existing semantic markers, not arbitrary scene traversal
of every mesh. Visual paint/pattern overlays are zero-mass decoration records.
Highlights, borders, handles, frame tube skins and detached objects are excluded.
Reverse-winding duplicate triangles within a sheet (and duplicate body panels)
are counted once; independently added structural layers are counted separately.

Physical triangles each contribute material mass. Exposed triangles are clipped
against the preceding union using convex half-plane subtraction. This preserves
concavities and gaps without new dependencies. Patches reference their containing
physical triangle. The first-covered sheet owns shared exposure; this is a flat
planform reference-area convention, not a layered airflow/wake model.
Patch IDs can change after topology/overlap changes: coefficients must be supplied
for the current geometry and partition, not reused as universal paper constants.

The polygon tolerance is 1e-12 m2; numerically unresolved physical triangles are
rejected. Tiny subtraction slivers below that tolerance are dropped with an
explicit `exposure-tolerance` assumption reporting intermediate fragment count;
that count is not a measurement of final area error. Vertex cleanup uses 1e-12 m.
Physical paper triangles remain unchanged. The adapter rejects partial draw
ranges, instanced/skinned/morphed paper or sticks, invalid frame ring metadata,
and unknown frame geometry.
Overlap partitioning stops with an unsupported issue above 20,000 fragments;
it is not a general high-complexity CAD boolean engine.

## Verification

`tests/editor-flight.test.cjs` builds all six real templates and exercises real
history operations, replacement tails, all wing and tail choices, SI conversion,
mirrored/nonuniform/nested transforms, stale caches, paint/duplicate exclusions,
analytic overlap areas, flexible strips and unsupported cases. These are software
geometry checks, not measurements of paper, frame stiffness or flight performance.

Audit on 2026-10-30 reused the existing integration: 17 adapter tests and all 56
regression tests passed. `npm run build` passed with the existing large-chunk
warning. No browser interaction check or dedicated typecheck was run in this
audit; no UI or animation changed.

No dynamic tail model, frame stiffness, aerodynamic coefficients, bridle defaults,
line specification, scoring policy, UI, animation or dependency is added.
