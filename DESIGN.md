# KiteForge Design

This document records confirmed product and visual decisions for KiteForge. It
also captures open decisions that must be settled before implementation. Proposed
ideas and visual references are not approved requirements until they are moved
into a confirmed section.

## Product Intent

KiteForge is a browser-based kite maker. Users choose a kite template, build the
shape and attachments, decorate the kite in a 3D editor, and eventually export
accurately sized 2D layout pieces that can be printed, cut and assembled into a
physical kite.

The 3D editor is a preview and editing surface. Printable cutting layouts must
come from dimensioned 2D part outlines in explicit physical units, not from
screenshots or perspective renders of the 3D scene.

Actual laser-cutter integration, machine-specific export formats and toolpaths
are not confirmed product requirements.

## Confirmed Workflow

1. Choose one of the available templates.
2. Build the kite by selecting or modifying supported body parts and attachments.
3. Switch to Design mode to decorate surfaces.
4. Preview the result in 3D with orbit, zoom and orientation controls.
5. Export printable layout pieces in a future milestone.
6. Cut and assemble the printed pieces outside the app.

The current prototype implements steps 1-4 only. Exported layouts, saving and
reopening designs, and physical validation are not implemented.

## Current Experience

- The start screen introduces KiteForge and directly displays the template chooser.
- Six templates are available: Classic, Diamond, Oval, Swallow, Fighter and
  Butterfly.
- Build mode uses neutral part colors and supports attachment edits.
- Design mode uses colored kite surfaces and supports stamps, brush strokes and
  color changes.
- Undo, redo and clear are scoped by editor mode and surface.
- The editor uses direct manipulation for selection, moving, resizing and
  rotating supported objects.

## Visual Direction

The user requested the "Kawaii Pastel Pop" reference from `design (1).md`.
It now informs the template chooser and editor controls.

| Token | Value |
| --- | --- |
| Pink | `#FFD1DC` |
| Text | `#222222` |
| Lavender | `#9D84B6` |
| Blue | `#B3E5FC` |
| Yellow | `#FFF9C4` |
| Mint | `#B9F6CA` |

The template chooser shows all six existing kite silhouettes directly, with
rounded 20px cards, soft shadows and a responsive grid. Editor controls use light
panels, pink selected states and charcoal labels. The 3D background uses soft
blue fading to off-white. Existing kite geometry and decoration colors remain.

Shared styling lives in `src/styles/kite.css`. Typography requests Varela Round
when installed, with Arial Rounded MT Bold, Trebuchet MS and sans-serif fallbacks;
no external font service or package is required. Fixed heading sizes, keyboard
focus rings and reduced-motion support adapt the reference for the working app.
The older ISOPOP reference is superseded for these surfaces.

## Interface Rules

- Preserve keyboard accessibility and accessible names for icon controls.
- Use familiar controls for editing actions: icons for tools, swatches for
  colors, segmented controls for modes, buttons for commands, and menus or panels
  for option sets.
- Keep Build and Design controls distinct so users understand whether they are
  changing structure or decoration.
- Prevent controls from overlapping or becoming unreachable at narrow mobile and
  wide desktop sizes.
- Include disabled, empty, loading and error states when adding new workflows.
- Do not claim export, save/load or print accuracy exists until those flows are
  implemented and verified.

## Print Layout Principles

Printable layouts are a confirmed product goal, but implementation details are
still open. When work begins:

- Use physical units as the source of truth.
- Keep stable identifiers for parts and surfaces.
- Preserve dimensions, transforms and decoration alignment between the print
  layout and the 3D preview.
- Arrange parts on pages without silently shrinking them.
- Report pieces that cannot fit within the agreed printable area.
- Verify exported scale numerically and visually before presenting the feature as
  working.

## Decisions Still Needed

- Target audience and expected mobile support.
- First paper sizes and printer margins.
- Export format for the first printable layout.
- Whether exports include decoration, cutting outlines, assembly labels or a
  combination of these.
- Multi-page tiling versus restricting parts to one sheet.
- Material, overlap, glue or seam allowances.
- Ordinary printer support, cutting-machine support or both.
- Saving approach and unsaved-edit handling when switching templates.

