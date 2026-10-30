const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const path = require('node:path');
const esbuild = require('esbuild');

function load(name) {
  const filename = path.resolve(`src/app/flight/${name}.ts`);
  const result = esbuild.buildSync({ entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false });
  const loaded = new Module(filename, module);
  loaded._compile(result.outputFiles[0].text, filename);
  return loaded.exports;
}
const near = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
function fixture() {
  return {
    panels: [{ id: 'body', outlineM: rect(-0.1, -0.1, 0.1, 0.1), material: { name: 'measured paper', arealDensityKgM2: 0.08 } }],
    frame: [
      { id: 'spine', startM: { x: 0, y: -0.1, z: 0 }, endM: { x: 0, y: 0.1, z: 0 }, massKg: 0.001 },
      { id: 'cross', startM: { x: -0.1, y: 0, z: 0 }, endM: { x: 0.1, y: 0, z: 0 }, massKg: 0.001 },
    ],
    tails: [], decorations: [], patches: [],
  };
}

test('editor conversion uses explicit scale and squares the area scale', () => {
  const p = load('physics');
  near(p.editorLengthToMetres(2.5, 100), 0.25);
  near(p.editorAreaToSquareMetres(3.125, 100), 0.03125);
  assert.throws(() => p.editorLengthToMetres(2.5, 0));
  assert.throws(() => p.editorAreaToSquareMetres(-1, 100));
});

test('polygon measurements handle winding and translation; invalid or concave outlines are rejected', () => {
  const p = load('physics');
  const a = p.measurePolygon(rect(1, 2, 3, 4));
  near(a.areaM2, 4); near(a.centroidM.x, 2); near(a.centroidM.y, 3);
  assert.deepEqual(p.measurePolygon(rect(1, 2, 3, 4).reverse()), a);
  assert.throws(() => p.measurePolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }]));
  assert.throws(() => p.measurePolygon([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.4, y: 0.4 }, { x: 1, y: 1 }, { x: 0, y: 1 }]));
});

test('paper and two sticks contribute mass while visual paint contributes none', () => {
  const input = fixture();
  input.decorations.push({ kind: 'visual', id: 'paint' });
  const r = load('physics').analyzeFlight(input);
  near(r.mass.totalKg, 0.0052); near(r.mass.centerM.x, 0); near(r.mass.centerM.y, 0);
  near(r.geometry.physicalPanelAreaM2, 0.04);
  assert.equal(r.status, 'incomplete');
  assert.ok(r.issues.some(i => i.code === 'missing-wind'));
});

test('overlapping layers add mass but exposed patches are counted once', () => {
  const input = fixture();
  input.panels.push({ ...input.panels[0], id: 'layer' });
  input.patches = [{ id: 'exposed', panelId: 'body', outlineM: input.panels[0].outlineM }];
  const p = load('physics');
  const r = p.analyzeFlight(input);
  near(r.mass.totalKg, 0.0084); near(r.geometry.exposedAreaM2, 0.04);
  input.patches.push({ ...input.patches[0], id: 'duplicate' });
  assert.equal(p.analyzeFlight(input).status, 'invalid');
});

test('tail placement and mirrored added mass change the center of gravity correctly', () => {
  const p = load('physics'), input = fixture();
  input.tails.push({ id: 'tail', lengthM: 0.5, widthM: 0.02, material: { name: 'paper', arealDensityKgM2: 0.08 }, centerM: { x: 0, y: -0.35, z: 0 } });
  const r = p.analyzeFlight(input);
  near(r.mass.totalKg, 0.006); near(r.mass.centerM.y, -0.00028 / 0.006);
  input.decorations.push({ id: 'glue', kind: 'added-mass', massKg: 0.001, centerM: { x: 0.1, y: 0, z: 0 } });
  const right = p.analyzeFlight(input);
  input.decorations[0].centerM.x = -0.1;
  near(p.analyzeFlight(input).mass.centerM.x, -right.mass.centerM.x);
});

test('missing mass is not silently treated as zero and nonfinite input is invalid', () => {
  const p = load('physics'), input = fixture();
  delete input.frame[0].massKg;
  const r = p.analyzeFlight(input);
  assert.equal(r.mass, null); assert.equal(r.status, 'incomplete');
  assert.ok(r.issues.some(i => i.path === 'frame.spine.mass'));
  input.panels[0].outlineM[0].x = NaN;
  assert.equal(p.analyzeFlight(input).status, 'invalid');
});

test('stick density and cross-section calculate mass without inventing strength', () => {
  const input = fixture();
  delete input.frame[0].massKg;
  input.frame[0].densityKgM3 = 500;
  input.frame[0].crossSectionAreaM2 = 0.00001;
  const r = load('physics').analyzeFlight(input);
  near(r.mass.totalKg, 0.0052);
  assert.equal(r.structural.status, 'unsupported');
});

function flightFixture() {
  const input = fixture();
  input.wind = { speedMps: 5, airDensityKgM3: 1.2 };
  input.bridle = { pointM: { x: 0, y: 0, z: -0.02 } };
  input.line = { model: 'massless-straight' };
  input.patches = [{ id: 'exposed', panelId: 'body', outlineM: input.panels[0].outlineM,
    profile: { calibration: 'uncalibrated', provenance: 'Synthetic constant coefficients for analytic tests, not paper calibration.',
      samples: [0, Math.PI / 2].map(angleRad => ({ angleRad, cl: 1, cd: 1 / 3, centerOfPressureM: { x: 0, y: 0, z: 0 } })) } }];
  return input;
}

test('lift and drag follow dynamic pressure and scale with wind speed squared', () => {
  const p = load('physics'), input = flightFixture();
  const a = p.analyzeFlight(input);
  assert.equal(a.status, 'estimated');
  near(a.samples[0].liftN, 0.6); near(a.samples[0].dragN, 0.2);
  near(a.samples[0].weightN, 0.0052 * 9.80665);
  input.wind.speedMps = 10;
  const b = p.analyzeFlight(input);
  near(b.samples[0].liftN, 2.4); near(b.samples[0].dragN, 0.8);
  assert.equal(a.samples[0].lineLoadRatio, null);
});

test('pitch trim finds analytic equilibrium and distinguishes restoring from unstable', () => {
  const p = load('physics'), input = flightFixture();
  const stable = p.analyzeFlight(input);
  assert.equal(stable.trims.length, 1);
  const trim = stable.trims[0], netLift = 0.6 - 0.0052 * 9.80665;
  near(trim.angleRad, Math.atan2(0.2, netLift), 1e-7);
  near(trim.tensionN, Math.hypot(netLift, 0.2));
  near(trim.pitchSlopeNmPerRad, -0.02 * Math.hypot(netLift, 0.2), 1e-7);
  assert.equal(trim.pitchStability, 'restoring'); assert.equal(trim.equilibrium, true);
  near(trim.momentNm.y, 0); near(trim.momentNm.z, 0);
  input.bridle.pointM.z = 0.02;
  const unstable = p.analyzeFlight(input).trims[0];
  assert.equal(unstable.pitchStability, 'unstable');
});

test('a fixed line angle can prevent force equilibrium despite pitch trim', () => {
  const input = flightFixture(); input.line.elevationRad = 0.1;
  const trim = load('physics').analyzeFlight(input).trims[0];
  assert.equal(trim.equilibrium, false); assert.ok(trim.forceResidualN > 0.1);
});

test('asymmetric loading generates moments and cannot masquerade as full equilibrium', () => {
  const input = flightFixture();
  input.patches[0].profile.samples.forEach(s => { s.centerOfPressureM.x = 0.05; });
  const p = load('physics'), right = p.analyzeFlight(input);
  assert.equal(right.trims[0].equilibrium, false);
  near(right.samples[0].momentNm.y, -0.01); near(right.samples[0].momentNm.z, 0.03);
  input.patches[0].profile.samples.forEach(s => { s.centerOfPressureM.x = -0.05; });
  const left = p.analyzeFlight(input);
  near(left.samples[0].momentNm.y, -right.samples[0].momentNm.y);
  near(left.samples[0].momentNm.z, -right.samples[0].momentNm.z);
});

test('zero wind has no flight trim, and missing or invalid aerodynamic data is explicit', () => {
  const p = load('physics'), input = flightFixture();
  input.wind.speedMps = 0;
  const calm = p.analyzeFlight(input);
  near(calm.samples[0].liftN, 0); assert.equal(calm.trims.length, 0);
  delete input.patches[0].profile;
  assert.equal(p.analyzeFlight(input).status, 'incomplete');
  input.wind.speedMps = -1;
  assert.equal(p.analyzeFlight(input).status, 'invalid');
});

test('profiles interpolate but never extrapolate and malformed settings are rejected', () => {
  const p = load('physics'), input = flightFixture();
  input.patches[0].profile.samples[1].cl = 3;
  const settings = { angleRangeRad: [Math.PI / 4, 1], angleSteps: 10, torqueToleranceNm: 1e-8, slopeToleranceNmPerRad: 1e-7, forceToleranceN: 1e-6 };
  near(p.analyzeFlight(input, settings).samples[0].liftN, 1.2);
  input.patches[0].profile.samples[0].angleRad = 0.9;
  assert.equal(p.analyzeFlight(input, settings).status, 'unsupported');
  assert.equal(p.analyzeFlight(input, { ...settings, angleSteps: Infinity }).status, 'invalid');
});

test('flexible tail uses explicit projected drag area and adds no fabricated damping', () => {
  const input = flightFixture();
  input.tails.push({ id: 'tail', lengthM: 0.5, widthM: 0.02, material: { name: 'paper', arealDensityKgM2: 0.08 }, centerM: { x: 0, y: -0.3, z: 0 },
    drag: { projectedAreaM2: 0.005, cd: 1, centerM: { x: 0, y: -0.3, z: 0 } } });
  const p = load('physics'), r = p.analyzeFlight(input);
  near(r.samples[0].dragN, 0.275); near(r.mass.totalKg, 0.006);
  input.tails[0].drag.projectedAreaM2 = 1;
  assert.equal(p.analyzeFlight(input).status, 'invalid');
});

test('line load ratio is reported without a structural safety claim', () => {
  const input = flightFixture(); input.line.breakingLoadN = 0.1;
  const r = load('physics').analyzeFlight(input);
  assert.ok(r.trims[0].lineLoadRatio > 1); assert.equal(r.structural.status, 'unsupported');
  assert.equal(r.trims[0].equilibrium, false);
});

test('analysis is deterministic and does not mutate caller data', () => {
  const input = flightFixture(), before = structuredClone(input), p = load('physics');
  assert.deepEqual(p.analyzeFlight(input), p.analyzeFlight(input));
  assert.deepEqual(input, before);
});

test('scoring requires an explicit policy and never drops unavailable categories', () => {
  const p = load('physics'), score = load('scoring').scoreFlight;
  const r = p.analyzeFlight(flightFixture());
  const policy = { name: 'test policy', weights: { pitchRestoring: 2, equilibrium: 1, lateralBalance: 1 } };
  const s = score(r, policy);
  assert.equal(s.status, 'provisional'); near(s.overall, 100);
  const unavailable = score(r, { name: 'includes safety', weights: { equilibrium: 1, structural: 1 } });
  assert.equal(unavailable.overall, null); assert.equal(unavailable.status, 'unavailable');
  assert.throws(() => score(r, { name: 'empty', weights: {} }));
  assert.throws(() => score(r, { name: 'negative', weights: { equilibrium: -1 } }));
  assert.throws(() => score(r, { name: 'unknown', weights: { magic: 1 } }));
});

test('an unstable trim lowers the explained score and incomplete inputs cannot earn an overall score', () => {
  const p = load('physics'), score = load('scoring').scoreFlight, input = flightFixture();
  input.bridle.pointM.z = 0.02;
  const s = score(p.analyzeFlight(input), { name: 'pitch only', weights: { pitchRestoring: 1 } });
  near(s.overall, 0); assert.ok(s.categories[0].explanation.includes('unstable'));
  delete input.wind;
  assert.equal(score(p.analyzeFlight(input), { name: 'balance only', weights: { lateralBalance: 1 } }).overall, null);
});

test('paper-stick example is explicitly incomplete and uses fresh objects', () => {
  const presets = load('presets'), p = load('physics');
  const example = presets.createPaperStickExample();
  near(p.analyzeFlight(example).mass.totalKg, 0.0045);
  assert.equal(p.analyzeFlight(example).status, 'incomplete');
  example.panels[0].material.arealDensityKgM2 = 1;
  near(presets.createPaperStickExample().panels[0].material.arealDensityKgM2, 0.08);
});

test('touching exposure pieces are allowed, protruding patches and retraced polygons are rejected', () => {
  const p = load('physics'), input = fixture();
  input.patches = [
    { id: 'left', panelId: 'body', outlineM: rect(-0.1, -0.1, 0, 0.1) },
    { id: 'right', panelId: 'body', outlineM: rect(0, -0.1, 0.1, 0.1) },
  ];
  near(p.analyzeFlight(input).geometry.exposedAreaM2, 0.04);
  input.patches[1].outlineM[1].x = 0.2;
  assert.equal(p.analyzeFlight(input).status, 'invalid');
  assert.throws(() => p.measurePolygon([...rect(0, 0, 1, 1), ...rect(0, 0, 1, 1)]));
});

test('conversion overflow is rejected instead of returning infinite physical dimensions', () => {
  const p = load('physics');
  assert.throws(() => p.editorLengthToMetres(Number.MAX_VALUE, 10000));
  assert.throws(() => p.editorAreaToSquareMetres(Number.MAX_VALUE, 10000));
});

test('duplicate IDs, negative drag, unordered profiles and unknown line models are rejected', () => {
  const p = load('physics');
  for (const mutate of [
    i => { i.frame[0].id = 'body'; },
    i => { i.patches[0].profile.samples[0].cd = -0.1; },
    i => { i.patches[0].profile.samples.reverse(); },
    i => { i.line.breakingLoadN = 0; },
  ]) {
    const input = flightFixture(); mutate(input);
    const r = p.analyzeFlight(input);
    assert.equal(r.status, 'invalid'); assert.equal(r.samples.length, 0);
  }
  const input = flightFixture(); input.line.model = 'elastic';
  assert.equal(p.analyzeFlight(input).status, 'unsupported');
});

test('moving the bridle changes trim and neutral pitch is not labelled restoring', () => {
  const p = load('physics'), input = flightFixture();
  const original = p.analyzeFlight(input).trims[0].angleRad;
  input.bridle.pointM.y = 0.005;
  const moved = p.analyzeFlight(input);
  assert.ok(moved.trims.length === 0 || Math.abs(moved.trims[0].angleRad - original) > 0.01);
  input.bridle.pointM = { x: 0, y: 0, z: 0 };
  const neutral = p.analyzeFlight(input);
  assert.ok(neutral.trims.length > 0);
  assert.ok(neutral.trims.every(t => t.pitchStability === 'neutral'));
});

test('coefficient range endpoints are valid and boundary-only trim is not rated', () => {
  const p = load('physics'), input = flightFixture(), settings = load('presets').defaultAnalysisSettings();
  input.patches[0].profile.samples[0].angleRad = settings.angleRangeRad[0];
  input.patches[0].profile.samples[1].angleRad = settings.angleRangeRad[1];
  assert.equal(p.analyzeFlight(input, settings).status, 'estimated');
  const root = Math.atan2(0.2, 0.6 - 0.0052 * 9.80665);
  settings.angleRangeRad[0] = root;
  assert.equal(p.analyzeFlight(input, settings).trims.length, 0);
});
