import type {
  AeroProfile, AnalysisSettings, FlightAnalysis, FlightInput, ForceSample, Issue, Vec2, Vec3,
} from './types';
import { defaultAnalysisSettings, STANDARD_GRAVITY_MPS2 } from './presets';

const EPS = 1e-12;
class InputError extends Error {
  constructor(public kind: 'invalid' | 'unsupported', public path: string, message: string) { super(message); }
}
function requireValue(ok: boolean, path: string, message: string): asserts ok {
  if (!ok) throw new InputError('invalid', path, message);
}
function finite(value: number, path: string, min = -Infinity) {
  requireValue(Number.isFinite(value) && value >= min, path, `Expected a finite number >= ${min}.`);
  return value;
}
function positive(value: number, path: string) {
  finite(value, path, 0);
  requireValue(value > 0, path, 'Expected a positive number.');
  return value;
}
function vec(v: Vec3, path: string) {
  finite(v.x, path); finite(v.y, path); finite(v.z, path);
}
export function editorLengthToMetres(value: number, millimetresPerUnit: number) {
  return finite(finite(value, 'length') * (positive(millimetresPerUnit, 'scale') / 1000), 'converted-length');
}
export function editorAreaToSquareMetres(value: number, millimetresPerUnit: number) {
  return finite(finite(value, 'area', 0) * (positive(millimetresPerUnit, 'scale') / 1000) ** 2, 'converted-area');
}
const cross2 = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Convex, non-self-intersecting polygons; partition concave parts before calling. */
export function measurePolygon(points: Vec2[]) {
  requireValue(Array.isArray(points) && points.length >= 3, 'outline', 'At least three vertices required.');
  points.forEach(p => { finite(p.x, 'outline.x'); finite(p.y, 'outline.y'); });
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    requireValue(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) > EPS, 'outline', 'Repeated vertices are invalid; do not repeat the closing vertex.');
  }
  let twiceArea = 0, cx = 0, cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    requireValue(Math.hypot(a.x - b.x, a.y - b.y) > EPS, 'outline', 'Repeated vertices are invalid.');
    const cross = a.x * b.y - b.x * a.y;
    twiceArea += cross; cx += (a.x + b.x) * cross; cy += (a.y + b.y) * cross;
  }
  requireValue(Math.abs(twiceArea) > EPS, 'outline', 'Degenerate or self-intersecting polygon.');
  const sign = Math.sign(twiceArea);
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (points.some(p => sign * cross2(a, b, p) < -EPS)) {
      throw new InputError('unsupported', 'outline', 'Concave or self-intersecting outline; supply disjoint convex pieces.');
    }
  }
  const areaM2 = positive(Math.abs(twiceArea) / 2, 'outline.area');
  const centroidM = { x: finite(cx / (3 * twiceArea), 'outline.centroid'), y: finite(cy / (3 * twiceArea), 'outline.centroid') };
  return { areaM2, centroidM };
}
function contains(poly: Vec2[], p: Vec2) {
  const sides = poly.map((a, i) => cross2(a, poly[(i + 1) % poly.length], p));
  return sides.every(s => s >= -EPS) || sides.every(s => s <= EPS);
}
/** Separating-axis test: shared boundaries are permitted; positive-area overlap is not. */
function overlaps(a: Vec2[], b: Vec2[]) {
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const length = Math.hypot(q.x - p.x, q.y - p.y);
    const nx = -(q.y - p.y) / length, ny = (q.x - p.x) / length;
    const pa = a.map(v => v.x * nx + v.y * ny), pb = b.map(v => v.x * nx + v.y * ny);
    if (Math.min(...pa) >= Math.max(...pb) - EPS || Math.min(...pb) >= Math.max(...pa) - EPS) return false;
  }
  return true;
}

export function analyzeFlight(input: FlightInput, settings = defaultAnalysisSettings()): FlightAnalysis {
  const result: FlightAnalysis = {
    status: 'incomplete', issues: [], geometry: null, mass: null, samples: [], trims: [],
    structural: { status: 'unsupported', reason: 'No frame bending, joints, paper tearing or line safety model. Loads are not safety ratings.' },
    explanations: [],
  };
  const missing = (path: string, code: string, message: string) => result.issues.push({ kind: 'missing', path, code, message });
  try {
    validateSettings(settings);
    const ids = new Set<string>();
    for (const list of [input.panels, input.frame, input.tails, input.decorations, input.patches]) {
      requireValue(Array.isArray(list), 'input', 'All part lists must be arrays.');
      for (const part of list) {
        requireValue(typeof part.id === 'string' && !!part.id && !ids.has(part.id), 'id', 'Part and patch IDs must be unique nonempty strings.');
        ids.add(part.id);
      }
    }
    requireValue(input.panels.length > 0, 'panels', 'At least one physical panel is required.');
    const panels = input.panels.map(panel => ({ ...measurePolygon(panel.outlineM), panel }));
    const patches = input.patches.map(patch => {
      const measurement = measurePolygon(patch.outlineM);
      const parent = input.panels.find(p => p.id === patch.panelId);
      requireValue(!!parent && patch.outlineM.every(p => contains(parent.outlineM, p)), `patches.${patch.id}`, 'Patch must be contained in its physical panel.');
      return { patch, ...measurement };
    });
    for (let i = 0; i < patches.length; i++) for (let j = i + 1; j < patches.length; j++) {
      requireValue(!overlaps(patches[i].patch.outlineM, patches[j].patch.outlineM), 'patches', 'Exposed patches overlap and would double-count aerodynamic area.');
    }
    const xs = input.panels.flatMap(p => p.outlineM.map(v => v.x));
    result.geometry = {
      physicalPanelAreaM2: panels.reduce((n, p) => n + p.areaM2, 0),
      exposedAreaM2: patches.reduce((n, p) => n + p.areaM2, 0),
      spanM: Math.max(...xs) - Math.min(...xs),
    };
    const parts: NonNullable<FlightAnalysis['mass']>['parts'] = [];
    let missingMass = false;
    const add = (id: string, mass: number | undefined, centerM: Vec3, path: string) => {
      vec(centerM, path);
      if (mass === undefined) { missing(path, 'missing-mass', 'Supply measured mass or material properties.'); missingMass = true; }
      else parts.push({ id, massKg: finite(mass, path, 0), centerM: { ...centerM } });
    };
    for (const p of panels) {
      const density = p.panel.material.arealDensityKgM2;
      if (density !== undefined) positive(density, `panels.${p.panel.id}.material`);
      add(p.panel.id, density === undefined ? undefined : p.areaM2 * density,
        { ...p.centroidM, z: 0 }, `panels.${p.panel.id}.mass`);
    }
    for (const f of input.frame) {
      vec(f.startM, 'frame.start'); vec(f.endM, 'frame.end');
      const length = positive(Math.hypot(f.endM.x - f.startM.x, f.endM.y - f.startM.y, f.endM.z - f.startM.z), 'frame.length');
      if (f.densityKgM3 !== undefined) positive(f.densityKgM3, 'frame.density');
      if (f.crossSectionAreaM2 !== undefined) positive(f.crossSectionAreaM2, 'frame.crossSection');
      const mass = f.massKg ?? (f.densityKgM3 !== undefined && f.crossSectionAreaM2 !== undefined ? length * f.densityKgM3 * f.crossSectionAreaM2 : undefined);
      add(f.id, mass, { x: (f.startM.x + f.endM.x) / 2, y: (f.startM.y + f.endM.y) / 2, z: (f.startM.z + f.endM.z) / 2 }, `frame.${f.id}.mass`);
    }
    for (const t of input.tails) {
      const area = positive(t.lengthM, 'tail.length') * positive(t.widthM, 'tail.width');
      const density = t.material.arealDensityKgM2;
      if (density !== undefined) positive(density, 'tail.material');
      add(t.id, density === undefined ? undefined : area * density, t.centerM, `tails.${t.id}.mass`);
    }
    for (const d of input.decorations) {
      requireValue(d.kind === 'visual' || d.kind === 'added-mass', 'decoration.kind', 'Unknown decoration kind.');
      if (d.kind === 'added-mass') add(d.id, d.massKg, d.centerM, `decorations.${d.id}.mass`);
    }
    if (!missingMass) {
      const totalKg = positive(parts.reduce((n, p) => n + p.massKg, 0), 'mass.total');
      const centerM = { x: 0, y: 0, z: 0 };
      for (const p of parts) for (const axis of ['x', 'y', 'z'] as const) centerM[axis] += p.massKg * p.centerM[axis] / totalKg;
      vec(centerM, 'mass.center');
      result.mass = { totalKg, centerM, parts };
    }
    if (!input.wind) missing('wind', 'missing-wind', 'Supply wind speed and air density.');
    if (!input.bridle) missing('bridle', 'missing-bridle', 'Supply the effective tow point in body coordinates.');
    if (!input.line) missing('line', 'missing-line', 'Explicitly opt into the massless straight-line approximation.');
    if (!patches.length) missing('patches', 'missing-exposure', 'Supply nonoverlapping exposed patches, not front/back render meshes.');
    for (const p of patches) if (!p.patch.profile) missing(`patches.${p.patch.id}.profile`, 'missing-aerodynamics', 'Supply angle-dependent CL, CD and pressure-center data.');
    for (const t of input.tails) if (!t.drag) missing(`tails.${t.id}.drag`, 'missing-tail-drag', 'Supply projected area, drag coefficient and effective drag position.');
    validateConditions(input, settings);
    result.explanations.push('Layered paper adds mass; only explicit exposed patches add sail reference area.',
      'Larger wings and tails change mass and force lever arms; no universal suitable length is assumed.');
    if (result.issues.some(i => i.kind === 'missing')) return result;
    result.issues.push({ kind: 'assumption', code: 'static-model', path: 'model', message: 'Rigid coplanar sail, uniform straight sticks, prescribed tail pose, steady horizontal wind, massless straight line; frame drag is omitted.' });
    for (const p of patches) if (p.patch.profile!.calibration === 'uncalibrated') {
      result.issues.push({ kind: 'assumption', code: 'uncalibrated', path: `patches.${p.patch.id}.profile`, message: p.patch.profile!.provenance });
    }
    if (input.tails.length) result.issues.push({ kind: 'assumption', code: 'tail-pose', path: 'tails', message: 'Tail mass and drag positions rotate with the body; ribbon sag, flutter, damping and wake shielding are not solved.' });
    const sample = (angle: number) => evaluate(input, result.mass!, patches.map(p => p.areaM2), angle);
    const [lo, hi] = settings.angleRangeRad;
    result.samples = Array.from({ length: settings.angleSteps + 1 }, (_, i) => sample(i === settings.angleSteps ? hi : lo + (hi - lo) * i / settings.angleSteps));
    if (input.wind!.speedMps > 0) {
      const roots: number[] = [];
      for (let i = 0; i < result.samples.length - 1; i++) {
        const a = result.samples[i], b = result.samples[i + 1];
        if (a.momentNm.x === 0) roots.push(a.angleRad);
        if (a.momentNm.x * b.momentNm.x < 0) {
          let left = a.angleRad, right = b.angleRad, sign = Math.sign(a.momentNm.x);
          for (let j = 0; j < 50; j++) {
            const mid = (left + right) / 2, torque = sample(mid).momentNm.x;
            if (Math.sign(torque) === sign) left = mid; else right = mid;
          }
          roots.push((left + right) / 2);
        }
      }
      for (const angle of roots) {
        // A stability estimate needs a neighborhood on both sides of the root.
        if (angle <= lo + 1e-6 || angle >= hi - 1e-6 || result.trims.some(t => Math.abs(t.angleRad - angle) < 1e-6)) continue;
        const h = Math.min(1e-5, (angle - lo) / 2, (hi - angle) / 2);
        const slope = (sample(angle + h).momentNm.x - sample(angle - h).momentNm.x) / (2 * h);
        const value = sample(angle);
        if (Math.abs(value.momentNm.x) > settings.torqueToleranceNm) continue;
        result.trims.push({ ...value, pitchSlopeNmPerRad: slope,
          pitchStability: slope < -settings.slopeToleranceNmPerRad ? 'restoring' : slope > settings.slopeToleranceNmPerRad ? 'unstable' : 'neutral',
          equilibrium: value.aboveAnchor && value.forceResidualN <= settings.forceToleranceN &&
            Math.hypot(value.momentNm.x, value.momentNm.y, value.momentNm.z) <= settings.torqueToleranceNm &&
            (value.lineLoadRatio === null || value.lineLoadRatio < 1),
        });
      }
    }
    result.status = 'estimated';
    result.explanations.push(
      result.trims.some(t => t.equilibrium && t.pitchStability === 'restoring')
        ? 'A restoring pitch equilibrium exists under the supplied assumptions; roll/yaw stability and safe construction remain unverified.'
        : 'No restoring flight equilibrium was found within the sampled angle range and supplied assumptions.',
      'Increasing wind speed increases modeled aerodynamic forces quadratically, but does not establish a safe wind limit.',
    );
    if (result.samples.some(s => s.lineLoadRatio !== null && s.lineLoadRatio >= 1)) result.explanations.push('At some tested angles, modeled tension reaches or exceeds the supplied line breaking load.');
    return result;
  } catch (error) {
    const e = error instanceof InputError ? error : new InputError('invalid', 'input', 'Malformed input.');
    result.status = e.kind;
    result.issues.push({ kind: e.kind, code: e.kind, path: e.path, message: e.message } satisfies Issue);
    result.samples = []; result.trims = [];
    return result;
  }
}

function validateSettings(s: AnalysisSettings) {
  requireValue(Array.isArray(s.angleRangeRad) && s.angleRangeRad.length === 2, 'settings.range', 'Expected [minimum, maximum] angle.');
  const [lo, hi] = s.angleRangeRad;
  finite(lo, 'settings.minimum', 0); finite(hi, 'settings.maximum', 0);
  requireValue(lo < hi && hi <= Math.PI / 2, 'settings.range', 'V1 supports angles from 0 to pi/2 radians.');
  requireValue(Number.isInteger(s.angleSteps) && s.angleSteps >= 2 && s.angleSteps <= 1000, 'settings.steps', 'Use 2 to 1000 angle intervals.');
  positive(s.torqueToleranceNm, 'settings.torqueTolerance'); positive(s.slopeToleranceNmPerRad, 'settings.slopeTolerance'); positive(s.forceToleranceN, 'settings.forceTolerance');
}

function validateConditions(input: FlightInput, settings: AnalysisSettings) {
  if (input.wind) { finite(input.wind.speedMps, 'wind.speed', 0); positive(input.wind.airDensityKgM3, 'wind.density'); }
  if (input.bridle) vec(input.bridle.pointM, 'bridle');
  if (input.line) {
    if (input.line.model !== 'massless-straight') throw new InputError('unsupported', 'line.model', 'Only an explicitly massless straight line is supported.');
    if (input.line.elevationRad !== undefined) {
      finite(input.line.elevationRad, 'line.elevation', 0);
      requireValue(input.line.elevationRad < Math.PI / 2, 'line.elevation', 'Line elevation must be below pi/2.');
    }
    if (input.line.breakingLoadN !== undefined) positive(input.line.breakingLoadN, 'line.breakingLoad');
  }
  for (const t of input.tails) if (t.drag) {
    finite(t.drag.projectedAreaM2, 'tail.projectedArea', 0); finite(t.drag.cd, 'tail.cd', 0); vec(t.drag.centerM, 'tail.dragCenter');
    requireValue(t.drag.projectedAreaM2 <= t.lengthM * t.widthM, 'tail.projectedArea', 'Projected drag area cannot exceed ribbon material area.');
  }
  for (const patch of input.patches) if (patch.profile) {
    const p = patch.profile;
    requireValue(typeof p.provenance === 'string' && p.provenance.trim().length > 0, 'profile.provenance', 'Document coefficient provenance.');
    requireValue(p.calibration === 'measured' || p.calibration === 'uncalibrated', 'profile.calibration', 'Declare calibration status.');
    requireValue(Array.isArray(p.samples) && p.samples.length >= 2, 'profile.samples', 'Supply at least two ordered angle samples.');
    p.samples.forEach((s, i) => {
      finite(s.angleRad, 'profile.angle'); finite(s.cl, 'profile.cl'); finite(s.cd, 'profile.cd', 0); vec(s.centerOfPressureM, 'profile.pressureCenter');
      requireValue(i === 0 || s.angleRad > p.samples[i - 1].angleRad, 'profile.angle', 'Sample angles must be strictly increasing.');
    });
    if (p.samples[0].angleRad > settings.angleRangeRad[0] || p.samples[p.samples.length - 1].angleRad < settings.angleRangeRad[1]) {
      throw new InputError('unsupported', 'profile.range', 'Coefficient data must cover the entire requested angle range; no extrapolation.');
    }
  }
}

function interpolate(profile: AeroProfile, angle: number) {
  const data = profile.samples;
  const upper = data.findIndex((s, i) => i > 0 && s.angleRad >= angle);
  const a = data[upper - 1], b = data[upper];
  const t = (angle - a.angleRad) / (b.angleRad - a.angleRad);
  const mix = (x: number, y: number) => x + (y - x) * t;
  return { cl: mix(a.cl, b.cl), cd: mix(a.cd, b.cd), centerM: {
    x: mix(a.centerOfPressureM.x, b.centerOfPressureM.x), y: mix(a.centerOfPressureM.y, b.centerOfPressureM.y), z: mix(a.centerOfPressureM.z, b.centerOfPressureM.z),
  } };
}

function evaluate(input: FlightInput, mass: NonNullable<FlightAnalysis['mass']>, areas: number[], angleRad: number): ForceSample {
  const q = 0.5 * input.wind!.airDensityKgM3 * input.wind!.speedMps ** 2;
  const weightN = mass.totalKg * STANDARD_GRAVITY_MPS2;
  const momentNm = { x: 0, y: 0, z: 0 };
  let liftN = 0, dragN = 0;
  const apply = (position: Vec3, lift: number, drag: number) => {
    const b = input.bridle!.pointM, x = position.x - b.x, y = position.y - b.y, z = position.z - b.z;
    // Body +y points toward the nose. At alpha=0 it points upstream (-world z).
    const ry = y * Math.sin(angleRad) + z * Math.cos(angleRad);
    const rz = -y * Math.cos(angleRad) + z * Math.sin(angleRad);
    momentNm.x += ry * drag - rz * lift;
    momentNm.y -= x * drag; momentNm.z += x * lift;
  };
  input.patches.forEach((p, i) => {
    const c = interpolate(p.profile!, angleRad), lift = q * areas[i] * c.cl, drag = q * areas[i] * c.cd;
    liftN += lift; dragN += drag; apply(c.centerM, lift, drag);
  });
  input.tails.forEach(t => {
    const d = t.drag!, drag = q * d.projectedAreaM2 * d.cd;
    dragN += drag; apply(d.centerM, 0, drag);
  });
  apply(mass.centerM, -weightN, 0);
  const netLift = liftN - weightN;
  const requiredElevationRad = Math.atan2(netLift, dragN);
  const elevation = input.line!.elevationRad ?? requiredElevationRad;
  const tensionN = Math.max(0, netLift * Math.sin(elevation) + dragN * Math.cos(elevation));
  const forceResidualN = Math.hypot(netLift - tensionN * Math.sin(elevation), dragN - tensionN * Math.cos(elevation));
  const value = { angleRad, liftN, dragN, weightN, momentNm, requiredElevationRad, tensionN, forceResidualN,
    aboveAnchor: netLift > 0 && dragN > 0,
    lineLoadRatio: input.line!.breakingLoadN === undefined ? null : tensionN / input.line!.breakingLoadN };
  for (const v of [q, liftN, dragN, weightN, tensionN, forceResidualN, momentNm.x, momentNm.y, momentNm.z, value.lineLoadRatio ?? 0]) finite(v, 'computed-result');
  return value;
}
