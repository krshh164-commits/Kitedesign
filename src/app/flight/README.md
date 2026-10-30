# Flight Calculation Layer

Pure TypeScript steady-wind estimation. No React, browser, Three.js, network,
randomness or new dependencies in this layer. This is not a flight simulator,
certified structural analysis, probability of successful flight or flight-test UI.

## Modules

- `types.ts`: SI part, environment, coefficient, analysis and scoring contracts.
- `physics.ts`: conversions, convex polygon measurements, mass, forces and trim.
- `scoring.ts`: explicit product policy, kept separate from physical formulas.
- `presets.ts`: sources, numerical settings and a deliberately incomplete example.

The user confirmed paper body, wings and tails, with two perpendicular lightweight
sticks. Paper grammage, stick material/mass/section, adhesive, bridle and flying-line
properties are still unknown. Do not infer that the flying line is paper.

## Units And Coordinates

Metres, kilograms, seconds, radians, newtons and newton-metres throughout.
Paper grammage in g/m2 must be divided by 1000 to get kg/m2. Stick mass in grams
must also be divided by 1000. Density in kg/m3 is different from paper grammage.

The inspected editor constant `MM_PER_UNIT = 100` means nominally 0.1 m per unit.
The editor adapter uses `editorLengthToMetres` with caller-confirmed scale; area conversion
uses the square of this factor. The classic 2.5-unit diamond nominally spans 0.25 m,
with area 0.03125 m2. This is not a verified printing or manufacturing scale.
The module deliberately does not import editor constants. Rendering radius is not
a measured stick cross-section. The Swallow helper's SVG coordinates are not SI.

All inputs share one body frame: x right, y toward the nose, z normal to the sail.
The intended symmetry plane is x=0. Panels/patches lie at body z=0; apply all editor
transforms before passing physical outlines. Uniform paper and sticks are assumed.
World y is vertical up; steady horizontal wind flows along world +z. At angle of
attack alpha=0, body +y points upstream (-world z) and body +z points upward.
The body-to-world rotation about x is alpha-pi/2. Positive pitch moment increases
alpha. Only alpha in [0, pi/2] is supported; no sideslip, dihedral or rolled pose.

## Physical Versus Exposed Geometry

Physical panels account for every paper layer, including overlap. Separate exposed
patches define aerodynamic reference area once, not once per rendered face.
Patches must be inside their referenced physical panel and cannot overlap each
other; touching edges are permitted. A hidden physical layer need not own a patch.
The caller is responsible for representing all exposed sail area and occlusion.

V1 accepts convex polygons with no holes or repeated vertices, in either winding.
Partition concave parts into nonoverlapping convex pieces before calling; this
module does not triangulate editor meshes or implement arbitrary polygon unions.
Split pieces must preserve the real material area. Curves need a chosen polygonal
approximation. Self-intersecting, degenerate and non-convex inputs are rejected.

Paint is `kind: 'visual'` and contributes neither duplicate area nor mass.
Actual glue, ink, tape, connectors and bridle mass can be represented explicitly
as `kind: 'added-mass'` at measured lumped positions. Omission is not measurement.
Flexible tails are uniform rectangular strips with supplied mass-center and drag
positions. A decorative rigid wing should be a panel, not a flexible tail.

## Formulas And Sources

Polygon area and centroid use signed shoelace sums. Panel mass is area times
areal density. Stick mass is measured directly or length times section area times
density; a supplied measured mass takes precedence. A straight uniform stick's
center is its midpoint. Total CG is sum(mass * position) / total mass.
See [NASA's center of gravity explanation](https://www.grc.nasa.gov/WWW/K-12/airplane/kitecg.html).

Dynamic pressure q = rho * V^2 / 2; L = q * A * CL; D = q * A * CD.
Use [NASA's lift equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/)
and [drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/).
Each patch uses its flat planform area for BOTH coefficients. Do not additionally
project that area by angle; angle dependence belongs in the supplied coefficients.
The NASA sources support the formulas, not coefficients for KiteForge templates.

Supply ordered CL/CD/center-of-pressure samples over the entire requested angle
range. Values are linearly interpolated, never extrapolated. Negative CD is invalid;
signed CL is allowed. Pressure centers are explicit, not assumed equal to area
centroids. A profile marked measured must have provenance describing the tested
geometry, scale, wind, Reynolds-number range and material condition. The module
cannot verify that evidence or automatically correct profiles after geometry changes.

Weight = total mass * 9.80665 (standard gravity assumption). Forces act in world
axes: lift upward, drag downstream, gravity downward. Moment about the tow point
is sum((position - tow point) cross force), including tail drag and gravity.
The effective bridle point is required; no default bridle fraction is inferred.

Net untethered force is (0, L-W, D). The required elevation is atan2(L-W, D).
If line elevation is supplied, nonnegative tension is the projection of this net
force along the line; the remaining force is reported as residual. Otherwise the
required direction is used. Flight equilibrium requires positive net lift and drag,
balanced forces and all three moments within tolerance, and tension below any
supplied breaking load. Lift exceeding weight by itself does not prove equilibrium.
Tension/breaking-load ratio is demand relative to an input, NOT a safe working load.

Pitch trim search samples the configured range, bisects sign changes in moment,
and computes a central finite-difference slope at interior roots. Negative slope
means locally restoring pitch, positive unstable, near-zero neutral. See
[NASA kite stability](https://www.grc.nasa.gov/www/k-12/airplane/kitestab.html).
Default range is 5-75 degrees with 140 intervals; tolerances are numerical settings,
not manufacturing margins. Very narrow crossings and tangent roots can be missed.
Boundary-only roots are not rated because they lack a two-sided neighborhood.
Zero wind produces no flight trims. Pitch stability does not prove roll/yaw or
dynamic stability. Neutral continua can produce several sampled neutral trims.

## Wings, Tails And Limits

Wing resizing changes paper mass, exposed area, force application points and
balance. Asymmetric force/mass produces lateral moments even when pitch balances.
Lateral CG is reported; a centered CG does not prove symmetric shape or stability.

Tail drag is q * supplied projected area * CD, applied at its supplied effective
position. Projected area cannot exceed strip material area. Tail mass acts at its
supplied CG. These positions rotate with the body: this is a prescribed-pose static
approximation, not a solved flexible ribbon. Damping, sag, wake shielding and flutter
require calibration/dynamics and are not computed. No maximum wing/tail length is
invented. Compare sizes only with explicit material, geometry and wind assumptions;
structural support and coefficient changes must be considered outside this V1.

There is no frame bending, stick strength, joint failure, paper tearing, humidity,
stretch, line sag/drag/mass, frame drag, gust simulation or 3D fabric model. The line
must explicitly select `massless-straight`. Structural status is always unsupported,
even when stick density and line breaking load are provided. Real safe dimensions
or wind limits require material properties, support/joint models and physical tests.

## Results And Scoring

`analyzeFlight` returns status, issues, geometry, mass, angle samples, trim candidates
and explanations. Missing values preserve independent measurements but withhold
force analysis. Invalid/unsupported data has no usable flight samples. Always inspect
status and issues. Helpers throw on invalid geometry/conversion; analysis returns
structured issues instead. Inputs are not mutated; identical inputs are deterministic.

`scoreFlight` requires named, positive finite weights, with no default policy.
Available metrics: lateralBalance (linear CG offset/half-span), pitchRestoring
(binary restoring slope), equilibrium (binary force/moment feasibility), structural
(unavailable). All flight categories use one selected candidate: first restoring
equilibrium, otherwise first equilibrium, otherwise first pitch trim. Selection is
in ascending angle order. No candidate means 0 for the corresponding flight metrics.
Requested unavailable categories and incomplete analysis withhold the overall score;
they are not silently removed or reweighted. Scores are always provisional, even
with measured coefficients. Thresholds/weights are product heuristics, not physics.

## Example

```typescript
import { createPaperStickExample } from './presets';
import { analyzeFlight } from './physics';
import { scoreFlight } from './scoring';

const input = createPaperStickExample();
const analysis = analyzeFlight(input);
// 0.03125 m2 paper, 0.0045 kg including two assumed 1 g sticks.
// status: 'incomplete': missing bridle, line model and coefficient profile.
const score = scoreFlight(analysis, {
  name: 'Illustrative policy, not calibrated',
  weights: { equilibrium: 1, pitchRestoring: 1 },
});
// score.overall === null; no plausible-looking score for missing physics.
```

Replace example paper grammage and masses with actual measurements. Add paper wings
as physical panels/exposed patches and ribbons as tails. Supply an effective bridle
point, explicit line approximation and empirical profile per patch to enable forces.
`tests/flight.test.cjs` has a complete synthetic fixture whose constant coefficients
produce an analytically known trim. It tests mathematics, not real kite calibration.

## Calibration And Next Work

Measure paper grammage, both stick masses and shape, adhesive and tail mass/pose.
Measure bridle position and specify flying line. Obtain geometry-specific force and
pressure-center measurements across angles and wind speeds. Calibrate tail response
and eventually score policy against real flights; retain provenance and uncertainty.
No aerodynamic or material-strength preset claims validated paper-kite performance.

Run `node --test tests/flight.test.cjs`, `npm test` and `npm run build`.
The tests bundle this module with the existing esbuild setup.
Vite build success alone neither exercises this module nor establishes type safety.
The editor now exposes `state.snapshotFlight(options)` through a separate
[read-only adapter](../components/kite-editor/flight-adapter.md). It produces this
module's input without introducing editor or Three.js imports here. Check adapter
issues/input first, then analysis status. Scale confirmation, physical materials,
tail classification and calibrated flight inputs remain caller responsibilities.

The editor's Test Flight popup supplies confirmed scale, paper grammage, measured
stick masses, bridle, wind and explicit massless-line consent to that adapter. UI
grams and centimetres are converted to SI before analysis. It uses the documented
`KiteForge provisional balance and trim v1` policy with equal weights for lateral
balance, pitch restoring behavior and equilibrium. The score remains unavailable
unless every requested category has the required calibrated aerodynamic evidence.
The popup adds no animation and makes no structural-safety or guaranteed-flight claim.
