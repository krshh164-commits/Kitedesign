import { analyzeFlight } from '../../flight/physics';
import { scoreFlight } from '../../flight/scoring';
import type { FlightAnalysis, FlightScore, Issue, ScoringPolicy } from '../../flight/types';
import type { EditorFlightSnapshot, FlightAdapterOptions } from './flightAdapter';

export interface FlightSettings {
  scaleMmPerUnit: string;
  scaleConfirmed: boolean;
  paperGsm: string;
  spineMassG: string;
  crossMassG: string;
  bridleXcm: string;
  bridleYcm: string;
  bridleZcm: string;
  windSpeedMps: string;
  airDensityKgM3: string;
  masslessLineConsent: boolean;
  lineElevationDeg: string;
  lineBreakingLoadN: string;
}

export const EMPTY_FLIGHT_SETTINGS: FlightSettings = {
  scaleMmPerUnit: '', scaleConfirmed: false, paperGsm: '', spineMassG: '', crossMassG: '',
  bridleXcm: '', bridleYcm: '', bridleZcm: '', windSpeedMps: '', airDensityKgM3: '',
  masslessLineConsent: false, lineElevationDeg: '', lineBreakingLoadN: '',
};

export const TEST_FLIGHT_SCORE_POLICY: ScoringPolicy = {
  name: 'KiteForge provisional balance and trim v1',
  weights: { lateralBalance: 1, pitchRestoring: 1, equilibrium: 1 },
};

export interface PreparedFlightOptions {
  options: FlightAdapterOptions;
  errors: Record<string, string>;
  assumptions: string[];
}

export interface TestFlightRun {
  phase: 'available' | 'unavailable' | 'invalid' | 'error';
  designVersion: number;
  settingsVersion: number;
  snapshot: EditorFlightSnapshot | null;
  analysis: FlightAnalysis | null;
  score: FlightScore | null;
  dimensions: { widthM: number; heightM: number } | null;
  missing: Issue[];
  errors: Record<string, string>;
  assumptions: string[];
  errorMessage?: string;
}

const value = (input: string | undefined) => input?.trim() ?? '';
const parse = (input: string | undefined) => value(input) === '' ? undefined : Number(value(input));
const allBlank = (items: (string | undefined)[]) => items.every(item => value(item) === '');

export function prepareFlightOptions(partial: Partial<FlightSettings>): PreparedFlightOptions {
  const settings = { ...EMPTY_FLIGHT_SETTINGS, ...partial };
  const errors: Record<string, string> = {};
  const options: FlightAdapterOptions = { tailModel: 'panel' };
  const assumptions = ['Tail meshes are treated as rigid flat paper panels; flexible-tail drag and motion are not modeled.'];
  const positive = (raw: string, key: string, label: string, allowZero = false) => {
    const n = parse(raw);
    if (n !== undefined && (!Number.isFinite(n) || (allowZero ? n < 0 : n <= 0))) errors[key] = `${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'}.`;
    return n;
  };

  const scale = positive(settings.scaleMmPerUnit, 'scaleMmPerUnit', 'Scale');
  if (settings.scaleConfirmed && scale === undefined) errors.scaleMmPerUnit = 'Enter the confirmed scale.';
  if (scale !== undefined && !settings.scaleConfirmed) errors.scaleConfirmed = 'Confirm that this scale comes from the current design or print specification.';
  if (scale !== undefined && settings.scaleConfirmed && !errors.scaleMmPerUnit) {
    options.scale = { millimetresPerUnit: scale, confirmation: 'Confirmed by the user in Test Flight settings.' };
  }

  const grammage = positive(settings.paperGsm, 'paperGsm', 'Paper grammage');
  if (grammage !== undefined && !errors.paperGsm) options.paper = { name: 'User-entered paper', arealDensityKgM2: grammage / 1000 };
  const spine = positive(settings.spineMassG, 'spineMassG', 'Spine mass');
  const cross = positive(settings.crossMassG, 'crossMassG', 'Cross-stick mass');
  if (spine !== undefined || cross !== undefined) options.frame = {
    spine: spine !== undefined && !errors.spineMassG ? { massKg: spine / 1000 } : undefined,
    cross: cross !== undefined && !errors.crossMassG ? { massKg: cross / 1000 } : undefined,
  };

  const bridleRaw = [settings.bridleXcm, settings.bridleYcm, settings.bridleZcm];
  if (!allBlank(bridleRaw)) {
    const bridle = bridleRaw.map(parse);
    if (bridle.some(n => n === undefined || !Number.isFinite(n))) errors.bridle = 'Enter all three finite bridle coordinates.';
    else options.bridle = { pointM: { x: bridle[0]! / 100, y: bridle[1]! / 100, z: bridle[2]! / 100 } };
  }

  const windRaw = [settings.windSpeedMps, settings.airDensityKgM3];
  if (!allBlank(windRaw)) {
    const speed = positive(settings.windSpeedMps, 'wind', 'Wind speed', true);
    const density = positive(settings.airDensityKgM3, 'wind', 'Air density');
    if (speed === undefined || density === undefined) errors.wind = 'Enter both wind speed and air density.';
    else if (!errors.wind) options.wind = { speedMps: speed, airDensityKgM3: density };
  }

  const elevation = parse(settings.lineElevationDeg);
  const breakingLoad = parse(settings.lineBreakingLoadN);
  const hasLineValues = elevation !== undefined || breakingLoad !== undefined;
  if (hasLineValues && !settings.masslessLineConsent) errors.masslessLineConsent = 'Consent is required before line settings can be used.';
  if (elevation !== undefined && (!Number.isFinite(elevation) || elevation < 0 || elevation >= 90)) errors.lineElevationDeg = 'Line elevation must be at least 0 and below 90 degrees.';
  if (breakingLoad !== undefined && (!Number.isFinite(breakingLoad) || breakingLoad <= 0)) errors.lineBreakingLoadN = 'Breaking load must be greater than zero.';
  if (settings.masslessLineConsent) options.line = {
    model: 'massless-straight',
    elevationRad: elevation !== undefined && !errors.lineElevationDeg ? elevation * Math.PI / 180 : undefined,
    breakingLoadN: breakingLoad !== undefined && !errors.lineBreakingLoadN ? breakingLoad : undefined,
  };

  return { options, errors, assumptions };
}

function dimensions(snapshot: EditorFlightSnapshot) {
  const points = snapshot.paper.flatMap(part => part.trianglesM?.flat() ?? []);
  if (!points.length) return null;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { widthM: Math.max(...xs) - Math.min(...xs), heightM: Math.max(...ys) - Math.min(...ys) };
}

export function calculateTestFlight(
  snapshotFlight: (options: FlightAdapterOptions) => EditorFlightSnapshot,
  settings: Partial<FlightSettings>, designVersion: number, settingsVersion: number,
): TestFlightRun {
  const prepared = prepareFlightOptions(settings);
  if (Object.keys(prepared.errors).length) return {
    phase: 'invalid', designVersion, settingsVersion, snapshot: null, analysis: null, score: null,
    dimensions: null, missing: [], errors: prepared.errors, assumptions: prepared.assumptions,
  };
  try {
    const snapshot = snapshotFlight(prepared.options);
    const analysis = snapshot.input ? analyzeFlight(snapshot.input) : null;
    const score = analysis ? scoreFlight(analysis, TEST_FLIGHT_SCORE_POLICY) : null;
    const missing = [...snapshot.issues, ...(analysis?.issues ?? [])].filter((issue, index, list) =>
      (issue.kind === 'missing' || issue.kind === 'unsupported' || issue.kind === 'invalid') &&
      list.findIndex(other => other.code === issue.code && other.message === issue.message) === index);
    return {
      phase: analysis?.status === 'estimated' ? 'available' : 'unavailable',
      designVersion, settingsVersion, snapshot, analysis, score, dimensions: dimensions(snapshot), missing,
      errors: prepared.errors, assumptions: [...prepared.assumptions, ...snapshot.issues.filter(i => i.kind === 'assumption').map(i => i.message)],
    };
  } catch (error) {
    return {
      phase: 'error', designVersion, settingsVersion, snapshot: null, analysis: null, score: null,
      dimensions: null, missing: [], errors: {}, assumptions: prepared.assumptions,
      errorMessage: error instanceof Error ? error.message : 'The calculation could not be completed.',
    };
  }
}

export function isFlightRunStale(run: Pick<TestFlightRun, 'designVersion' | 'settingsVersion'> | null, designVersion: number, settingsVersion: number) {
  return !!run && (run.designVersion !== designVersion || run.settingsVersion !== settingsVersion);
}
