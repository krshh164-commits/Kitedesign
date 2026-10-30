
# KiteForge

KiteForge is a browser-based kite maker with an interactive 3D editor. Its goal
is to let people design a kite and print separate layout pieces that they can
cut out and assemble into a physical kite, similar to preparing parts for laser
cutting.

The project is currently a client-side prototype. The editor exists; printable
layouts and persistent design saving are not implemented yet.

## Intended Workflow

1. Choose a kite template.
2. Build its shape and attach parts such as a tail or wings.
3. Decorate the kite and inspect it in the 3D preview.
4. Export accurately sized 2D layout pieces for printing (planned).
5. Cut out the printed pieces and assemble the physical kite (intended outcome).

Actual laser-cutter support, machine formats and toolpaths have not been agreed.
Printable patterns must be based on physical dimensions, not screenshots of the
3D preview. The prototype does not yet verify print accuracy or flight behavior.

## Current Features

- Six templates: Classic, Diamond, Oval, Swallow, Fighter and Butterfly.
- Separate Build and Design modes.
- Interactive 3D viewing with orbit, zoom and orientation controls.
- Circle, square and triangle drawing tools, plus a freehand brush.
- Preset and custom decoration colors.
- Selection and move, resize and rotate controls for supported objects.
- Attachment choices for tails and supported wings.
- Undo, redo and clear controls scoped to the active mode and surface.
- Prototype A3 size limits during resizing.

## Flight Calculation Foundation

`src/app/flight/` contains a standalone steady-wind calculation layer for paper
panels/tails and lightweight frame sticks. It measures mass/balance, evaluates
supplied aerodynamic data and estimates pitch trim, with explicit missing-data
and unsupported-case reporting. Scores are provisional, not safety ratings.
The editor has a read-only snapshot adapter with explicit missing-input reporting.
There is no flight button, popup or animation. See the
[flight module guide](src/app/flight/README.md) for units, sources and limitations.

## Technology

| Area | Technology |
| --- | --- |
| Interface | React 18 and TypeScript source files |
| Development and build | Vite 6 |
| 3D editor | Three.js and OrbitControls |
| Styling | Tailwind CSS 4 and inline styles |
| Shared controls and icons | Existing Radix-based components and Lucide React |
| Regression tests | Node test runner and esbuild |
| Package management | npm and package-lock.json |

This is not a Next.js application. There is currently no backend, database,
authentication, payment system or cloud storage.

## Run Locally

Install Node.js with npm. A modern browser with WebGL support is needed for the
3D editor. From the project folder, run:

```sh
npm ci
npm run dev
```

Open the address printed by the development server. The default address is
usually http://localhost:5173/; Vite may choose another port if it is occupied.
This is a local preview, not a public website link.

No application API keys or environment variables are currently required.

## Verification And Build

```sh
npm test
npm run build
```

The regression tests cover undo/redo, transform restoration, mode-specific
clearing and drawing geometry. They do not cover every editor interaction.
The production build generates `dist/`; do not edit those files manually.

Dedicated type checking, linting and automated browser test scripts are not
configured yet. A successful Vite build does not establish TypeScript correctness.
For editor changes, also check affected interactions in the browser and confirm
that the 3D scene renders and controls remain usable at different screen sizes.

## Project Structure

```text
src/
  main.tsx                        Application entry point
  app/
    App.tsx                       Start screen and editor coordination
    flight/                       Pure steady-wind estimates and explained scoring
    components/
      LandingPage.tsx             Template chooser
      KiteViewer.tsx              Editor coordinator
      kite-editor/                Scene, geometry, state and editing modules
      ui/                         Shared interface components
  styles/                         Global styles and themes
  imports/                        Image assets
tests/                            Editor regression tests
guidelines/                       Existing interface guidance
AGENTS.md                         Repository working rules
DESIGN.md                         Product workflow and visual decisions
ARCHITECTURE.md                   Editor architecture and geometry notes
TODO.md                           Prioritized tasks and progress
PROJECT_STATE.md                  Current implementation and handoff context
```

See [the editor module guide](src/app/components/kite-editor/README.md) for
individual module responsibilities and [AGENTS.md](AGENTS.md) for development
rules and completion criteria.

## Known Limitations

- Designs are held in memory; refreshing the page loses edits.
- Printable layouts, export downloads and save/load are not implemented.
- Narrow-screen controls can overlap, and drawing is primarily mouse-based.
- Body paint boundaries match template geometry; modified-part selection and
  highlight synchronization still need further checks.
- Replacing a tail needs consistent selection, paint and highlight data.
- Returning from the editor to choose another template currently needs a refresh.
- Production builds report a large JavaScript bundle warning.
- Git version history has not been set up in this project folder.

## Product Decisions Still Needed

Paper sizes, printer margins, export formats, multi-page tiling, assembly
allowances, cutting-machine support, target audience and mobile expectations
remain undecided. Local versus account-based design saving is also undecided.
These are planning questions, not features already approved or implemented.

## Development Workflow

Develop KiteForge in small, testable steps. Before a substantial feature, agree
on the user-visible outcome and resolve the decisions that affect it. Keep the
existing stack and editor module boundaries unless a change is explicitly agreed.

1. Read this README, `AGENTS.md` and the relevant editor module documentation.
2. Inspect the implementation and identify what already works.
3. Describe the change, its scope and how success will be checked.
4. Implement one focused step and run the relevant tests and build checks.
5. Inspect affected behavior in the browser, including mobile layouts when relevant.
6. Report results and limitations so the user can review the result.
7. Update project context after a significant feature or milestone. Once Git is
   configured, record reviewed working milestones using the agreed commit workflow.

For printable layouts, completion checks must include physical dimensions,
page boundaries and alignment between decoration and cutting outlines.
A rendered preview alone is not evidence that the printed pieces are correct.

### Project Context Documents

Keep one authoritative document for each purpose and keep it current.
The root files below can provide the context described as a "memory bank" in
the reference guide; a duplicate folder is not necessary.

| Document | Purpose | Current status |
| --- | --- | --- |
| `README.md` | Product context, setup and current capabilities | Present |
| `AGENTS.md` | Repository working rules and completion criteria | Present |
| `src/app/components/kite-editor/README.md` | Editor module responsibilities | Present |
| `DESIGN.md` | Confirmed product workflow and visual decisions | Present |
| `ARCHITECTURE.md` | System structure, data flow and physical geometry model | Present |
| `TODO.md` | Small ordered tasks, acceptance checks and milestone progress | Present |
| `PROJECT_STATE.md` | Current implementation, verification record and handoff context | Present |

The technology summary is maintained in this README. Use [TODO.md](TODO.md) for both
the implementation plan and progress, rather than keeping
several competing task lists. Record unresolved choices instead of inventing
product requirements.

Read [PROJECT_STATE.md](PROJECT_STATE.md) when resuming work to see the current
implementation, last verified behavior and open decisions. Keep task ordering
and acceptance criteria in `TODO.md`.

### Fixing Problems

Reproduce the failing interaction and capture the relevant browser error or
visual state. Inspect the affected module, make a focused fix and verify both
the failure case and nearby working behavior. Keep user edits intact.
Use Git history for recovery once configured; do not discard work automatically.
Additional plugins and tools should address a specific need before being added.

## Origin And Attribution

The project began as a Figma export named 3D Kite Viewer and has since been
edited and reorganized as KiteForge.

- [Original Figma project](https://www.figma.com/design/i3C6TCKc4fiqb7hF1oKi5k/3D-Kite-Viewer)
- [Asset and component attribution](ATTRIBUTIONS.md)

The development workflow was adapted from the user-provided *Ultimate Guide to
Vibe Coding V1.2.2* by Nicolas Zullo. Its project-planning and incremental-testing
approach is used here; tool versions, subscriptions and game-specific setup are
not KiteForge requirements.
