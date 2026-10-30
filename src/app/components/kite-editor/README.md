# Kite Editor

`../KiteViewer.tsx` connects the editor modules and handles mode changes.

- `useEditorState.ts`: shared React state and persistent scene references.
- `useKiteScene.ts`: rendering, camera, lighting, resize and scene lifetime.
- `createKiteModel.ts`: builds the selected kite's body, spars and default attachments.
- `templates.ts`: attachment definitions, geometry and existing surface outlines.
- `useDrawing.ts`: hit testing, painting and registering drawn surfaces.
- `drawingGeometry.ts`: shape geometry, brush segments and clipping calculations.
- `bodySurface.ts`: exact body highlight geometry and stencil masking for paint.
- `flightAdapter.ts`: read-only editor snapshot to the existing flight contracts;
  `flightGeometry.ts` partitions exposed area. See [adapter contract](flight-adapter.md).
- `flightSettings.ts`: validates in-memory user measurements, converts UI units to
  SI, runs the existing analysis/scoring modules and rejects stale result revisions.
- `TestFlightDialog.tsx`: accessible Radix popup for current-design settings,
  available measurements, explicit missing inputs and provisional results.
- `useSelection.ts`: selection outlines and transform handles.
- `useHistory.ts`: per-mode, per-surface undo, redo and clear actions.
- `useAttachments.ts`: corner detection and attachment replacement.
- `useGizmo.ts` and `gizmoGeometry.ts`: orientation controls and camera snapping.
- `EditorControls.tsx`: visible editor controls and panels.
- `types.ts` and `constants.ts`: shared contracts and editor limits.

The hooks share references owned by `useEditorState`; they do not create separate
copies of the scene. Each editing hook accepts the state and callbacks it uses.
The scene effect runs once and reads current tool and mode values through refs.

Test Flight always requests a fresh `snapshotFlight` on open or rerun. Settings
remain in React memory while editing; there is no backend or persistent storage.
The popup treats the rendered tail as a rigid flat paper panel and labels that
model assumption. It does not create aerodynamic coefficients, so force, pitch
and score fields remain unavailable until calibrated profiles exist.

Run `npm test` for focused history and drawing geometry regression checks, and
`npm run build` to verify the production bundle.
