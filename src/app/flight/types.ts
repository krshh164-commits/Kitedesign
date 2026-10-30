/** All geometry is in metres in one body frame; see README for axes. */
export interface Vec2 { x: number; y: number }
export interface Vec3 extends Vec2 { z: number }
export interface PaperMaterial {
  name: string;
  arealDensityKgM2?: number;
}
export interface PhysicalPanel {
  id: string;
  outlineM: Vec2[];
  material: PaperMaterial;
}
export interface FrameMember {
  id: string;
  startM: Vec3;
  endM: Vec3;
  massKg?: number;
  densityKgM3?: number;
  crossSectionAreaM2?: number;
}
export interface FlexibleTail {
  id: string;
  lengthM: number;
  widthM: number;
  material: PaperMaterial;
  /** Measured/assumed lumped position, not inferred from ribbon length. */
  centerM: Vec3;
  drag?: { projectedAreaM2: number; cd: number; centerM: Vec3 };
}
export type Decoration = { id: string; kind: 'visual' } |
  { id: string; kind: 'added-mass'; massKg?: number; centerM: Vec3 };
export interface AeroSample {
  angleRad: number;
  cl: number;
  cd: number;
  centerOfPressureM: Vec3;
}
export interface AeroProfile {
  provenance: string;
  calibration: 'uncalibrated' | 'measured';
  /** CL and CD must use this patch's flat planform area, not projected area. */
  samples: AeroSample[];
}
export interface AeroPatch {
  id: string;
  panelId: string;
  outlineM: Vec2[];
  profile?: AeroProfile;
}
export interface Bridle { pointM: Vec3 }
export interface FlyingLine {
  model: 'massless-straight';
  /** Omit to solve required elevation; otherwise fixes the anchor direction. */
  elevationRad?: number;
  breakingLoadN?: number;
}
export interface Wind { speedMps: number; airDensityKgM3: number }
export interface FlightInput {
  panels: PhysicalPanel[];
  frame: FrameMember[];
  tails: FlexibleTail[];
  decorations: Decoration[];
  patches: AeroPatch[];
  bridle?: Bridle;
  line?: FlyingLine;
  wind?: Wind;
}
/** Static analysis only. No time integration, gusts or hidden randomness. */
export interface AnalysisSettings {
  angleRangeRad: [number, number];
  angleSteps: number;
  torqueToleranceNm: number;
  slopeToleranceNmPerRad: number;
  forceToleranceN: number;
}
export interface Issue {
  kind: 'invalid' | 'missing' | 'unsupported' | 'assumption';
  code: string;
  path: string;
  message: string;
}
export interface MassResult {
  totalKg: number;
  centerM: Vec3;
  parts: { id: string; massKg: number; centerM: Vec3 }[];
}
export interface GeometryResult {
  physicalPanelAreaM2: number;
  exposedAreaM2: number;
  spanM: number;
}
export interface ForceSample {
  angleRad: number;
  liftN: number;
  dragN: number;
  weightN: number;
  momentNm: Vec3;
  requiredElevationRad: number;
  tensionN: number;
  forceResidualN: number;
  aboveAnchor: boolean;
  lineLoadRatio: number | null;
}
export interface TrimResult extends ForceSample {
  pitchSlopeNmPerRad: number;
  pitchStability: 'restoring' | 'unstable' | 'neutral';
  equilibrium: boolean;
}
export interface FlightAnalysis {
  status: 'estimated' | 'incomplete' | 'invalid' | 'unsupported';
  issues: Issue[];
  geometry: GeometryResult | null;
  mass: MassResult | null;
  samples: ForceSample[];
  trims: TrimResult[];
  structural: { status: 'unsupported'; reason: string };
  explanations: string[];
}
export type ScoreMetric = 'lateralBalance' | 'pitchRestoring' | 'equilibrium' | 'structural';
export interface ScoringPolicy {
  name: string;
  /** Explicit product policy, not aerodynamic constants. No default weights. */
  weights: Partial<Record<ScoreMetric, number>>;
}
export interface FlightScore {
  status: 'provisional' | 'unavailable';
  overall: number | null;
  policy: string;
  categories: { metric: ScoreMetric; score: number | null; explanation: string }[];
  explanation: string;
}
