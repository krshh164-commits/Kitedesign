import type { AnalysisSettings, FlightInput } from './types';

export const SOURCES = {
  lift: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-equation/',
  drag: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/',
  stability: 'https://www.grc.nasa.gov/www/k-12/airplane/kitestab.html',
  mass: 'https://www.grc.nasa.gov/WWW/K-12/airplane/kitecg.html',
} as const;

/** Standard gravity, not a measurement of local gravity. */
export const STANDARD_GRAVITY_MPS2 = 9.80665;

export function defaultAnalysisSettings(): AnalysisSettings {
  return {
    angleRangeRad: [5 * Math.PI / 180, 75 * Math.PI / 180], angleSteps: 140,
    torqueToleranceNm: 1e-8, slopeToleranceNmPerRad: 1e-7, forceToleranceN: 1e-6,
  };
}

export const EXAMPLE_ASSUMPTIONS = [
  { property: 'Paper', value: '80 g/m2 = 0.08 kg/m2', source: 'Illustrative input, not a measured or manufacturer-sourced material.', uncertainty: 'Unknown; replace with the actual sheet grammage.' },
  { property: 'Sticks', value: '1 g per stick, uniform mass', source: 'Illustrative input; user confirmed only lightweight sticks.', uncertainty: 'Unknown; weigh each stick. Species and strength are not inferred.' },
  { property: 'Air', value: '1.2 kg/m3 at 5 m/s', source: 'Illustrative wind condition, not a local weather reading.', uncertainty: 'Temperature, altitude and actual wind are unspecified.' },
  { property: 'Aerodynamics', value: 'No default CL, CD or center of pressure', source: SOURCES.lift, uncertainty: 'Requires geometry-specific coefficients and pressure centers over the tested angle/wind range.' },
] as const;

/** A fresh, deliberately incomplete example. Nothing here configures the editor. */
export function createPaperStickExample(): FlightInput {
  const outlineM = [{ x: 0, y: 0.125 }, { x: 0.125, y: 0 }, { x: 0, y: -0.125 }, { x: -0.125, y: 0 }];
  return {
    panels: [{ id: 'paper-body', outlineM, material: { name: 'Example paper (replace grammage)', arealDensityKgM2: 0.08 } }],
    frame: [
      { id: 'spine', startM: { x: 0, y: -0.125, z: 0 }, endM: { x: 0, y: 0.125, z: 0 }, massKg: 0.001 },
      { id: 'cross-stick', startM: { x: -0.125, y: 0, z: 0 }, endM: { x: 0.125, y: 0, z: 0 }, massKg: 0.001 },
    ],
    tails: [], decorations: [],
    patches: [{ id: 'body-exposure', panelId: 'paper-body', outlineM: outlineM.map(p => ({ ...p })) }],
    wind: { speedMps: 5, airDensityKgM3: 1.2 },
  };
}
