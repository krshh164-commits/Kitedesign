const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
const THREE = require('three');

function load(file) {
  const filename = path.resolve(file);
  const result = esbuild.buildSync({ entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false });
  const mod = new Module(filename, module); mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, filename); return mod.exports;
}

const settingsModule = () => load('src/app/components/kite-editor/flightSettings.ts');
const editor = name => load(`src/app/components/kite-editor/${name}.ts`);

function fixture() {
  const c = { kiteType: 'classic', mode: 'build', modeRef: { current: 'build' }, applyModeColors() {} };
  for (const key of ['kiteGroupRef', 'kiteFacesRef', 'tailMeshRef', 'vSparRef', 'hSparRef', 'highlightMeshesRef', 'buildGroupRef']) c[key] = { current: null };
  c.cornerPartsRef = { current: {} };
  editor('createKiteModel').createKiteModel(c, new THREE.Scene());
  return c;
}

test('flight settings convert user units to SI without filling unknown fields', () => {
  const { prepareFlightOptions } = settingsModule();
  const prepared = prepareFlightOptions({
    scaleMmPerUnit: '100', scaleConfirmed: true, paperGsm: '80', spineMassG: '1.5', crossMassG: '2',
    bridleXcm: '1', bridleYcm: '-4', bridleZcm: '0.5', windSpeedMps: '6', airDensityKgM3: '1.225',
    masslessLineConsent: true, lineElevationDeg: '35', lineBreakingLoadN: '12',
  });
  assert.deepEqual(prepared.errors, {});
  assert.equal(prepared.options.paper.arealDensityKgM2, 0.08);
  assert.equal(prepared.options.frame.spine.massKg, 0.0015);
  assert.equal(prepared.options.frame.cross.massKg, 0.002);
  assert.deepEqual(prepared.options.bridle.pointM, { x: 0.01, y: -0.04, z: 0.005 });
  assert.deepEqual(prepared.options.wind, { speedMps: 6, airDensityKgM3: 1.225 });
  assert.ok(Math.abs(prepared.options.line.elevationRad - 35 * Math.PI / 180) < 1e-12);
  assert.equal(prepared.options.line.breakingLoadN, 12);

  const unknown = prepareFlightOptions({});
  assert.deepEqual(unknown.errors, {});
  assert.equal(unknown.options.paper, undefined);
  assert.equal(unknown.options.frame, undefined);
  assert.equal(unknown.options.bridle, undefined);
  assert.equal(unknown.options.wind, undefined);
  assert.equal(unknown.options.line, undefined);
});

test('flight settings distinguish invalid partial values from unknown values and require line consent', () => {
  const { prepareFlightOptions } = settingsModule();
  const invalid = prepareFlightOptions({
    scaleMmPerUnit: '-1', scaleConfirmed: true, paperGsm: 'zero', spineMassG: '0',
    bridleXcm: '1', windSpeedMps: '5', lineElevationDeg: '90', lineBreakingLoadN: '-2',
  });
  for (const key of ['scaleMmPerUnit', 'paperGsm', 'spineMassG', 'bridle', 'wind', 'masslessLineConsent', 'lineElevationDeg', 'lineBreakingLoadN']) {
    assert.ok(invalid.errors[key], key);
  }
  assert.equal(invalid.options.line, undefined);
});

test('calculation uses the current editor design and reports unavailable physics without aerodynamics', () => {
  const { calculateTestFlight } = settingsModule();
  const c = fixture();
  const settings = {
    scaleMmPerUnit: '100', scaleConfirmed: true, paperGsm: '80', spineMassG: '1', crossMassG: '2',
    bridleXcm: '0', bridleYcm: '0', bridleZcm: '0', windSpeedMps: '5', airDensityKgM3: '1.225',
    masslessLineConsent: true,
  };
  const run = calculateTestFlight(options => editor('flightAdapter').snapshotEditorFlight(c, options), settings, 3, 7);
  assert.equal(run.phase, 'unavailable');
  assert.equal(run.designVersion, 3);
  assert.equal(run.settingsVersion, 7);
  assert.ok(run.snapshot.paper.some(part => part.role === 'body'));
  assert.ok(run.dimensions.widthM > 0 && run.dimensions.heightM > 0);
  assert.ok(run.analysis.geometry.exposedAreaM2 > 0);
  assert.ok(run.analysis.mass.totalKg > 0);
  assert.equal(run.analysis.samples.length, 0);
  assert.equal(run.score.status, 'unavailable');
  assert.ok(run.missing.some(issue => issue.code === 'missing-aerodynamics'));
});

test('results become stale after either settings or design changes', () => {
  const { isFlightRunStale } = settingsModule();
  const run = { designVersion: 4, settingsVersion: 9 };
  assert.equal(isFlightRunStale(run, 4, 9), false);
  assert.equal(isFlightRunStale(run, 5, 9), true);
  assert.equal(isFlightRunStale(run, 4, 10), true);
});
