const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');
const THREE = require('three');
function load(file) {
  const filename = path.resolve(file);
  assert.ok(fs.existsSync(filename), `Missing adapter module: ${file}`);
  const result = esbuild.buildSync({ entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false });
  const mod = new Module(filename, module); mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, filename); return mod.exports;
}
const editor = name => load(`src/app/components/kite-editor/${name}.ts`);
const physics = load('src/app/flight/physics.ts');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
function fixture(kiteType = 'classic') {
  const c = { kiteType, mode: 'build', modeRef: { current: 'build' }, applyModeColors() {} };
  for (const key of ['kiteGroupRef', 'kiteFacesRef', 'tailMeshRef', 'vSparRef', 'hSparRef', 'highlightMeshesRef', 'buildGroupRef']) c[key] = { current: null };
  c.cornerPartsRef = { current: {} };
  editor('createKiteModel').createKiteModel(c, new THREE.Scene());
  return c;
}
const options = () => ({
  scale: { millimetresPerUnit: 100, confirmation: 'Synthetic test scale, not manufacturing evidence' },
  paper: { name: 'Test paper', arealDensityKgM2: 0.08 },
  tailModel: 'panel', frame: { spine: { massKg: 0.001 }, cross: { massKg: 0.002 } },
});
const snap = (c, o = options()) => editor('flightAdapter').snapshotEditorFlight(c, o);
function addPaper(c, geo, x = 0) {
  const m = new THREE.Mesh(geo); m.position.x = x;
  m.userData.build = true; m.userData.kind = 'stamp';
  c.buildGroupRef.current.add(m); return m;
}

test('all six templates produce convex SI input with exact physical triangle area', () => {
  for (const type of ['classic', 'diamond', 'oval', 'swallow', 'fighter', 'butterfly']) {
    const c = fixture(type), r = snap(c);
    assert.ok(r.input, JSON.stringify(r.issues));
    assert.equal(r.sticks.length, 2);
    assert.ok(r.paper.some(p => p.role === 'tail'));
    if (type === 'butterfly') assert.equal(r.paper.filter(p => p.role === 'wing').length, 2);
    r.input.panels.forEach(p => physics.measurePolygon(p.outlineM));
    const analysis = physics.analyzeFlight(r.input);
    assert.equal(analysis.status, 'incomplete', JSON.stringify(analysis.issues));
    near(analysis.geometry.physicalPanelAreaM2, r.physicalPaperAreaM2);
    near(analysis.geometry.exposedAreaM2, r.exposedAreaM2);
    near(analysis.mass.totalKg, r.physicalPaperAreaM2 * 0.08 + 0.003);
    assert.ok(r.exposedAreaM2 <= r.physicalPaperAreaM2 + 1e-10);
    assert.ok(r.issues.some(i => i.code === 'missing-bridle'));
    assert.ok(r.issues.some(i => i.code === 'missing-aerodynamics'));
  }
});

test('scale requires confirmation; no material, line, bridle or coefficients are invented', () => {
  const c = fixture();
  const unscaled = snap(c, {});
  assert.equal(unscaled.input, null);
  assert.ok(unscaled.issues.some(i => i.code === 'missing-scale'));
  const r = snap(c, { scale: options().scale, tailModel: 'panel' });
  assert.ok(r.input);
  assert.equal(r.input.panels[0].material.arealDensityKgM2, undefined);
  assert.equal(r.input.frame[0].massKg, undefined);
  for (const code of ['missing-paper-density', 'missing-stick-mass', 'missing-bridle', 'missing-line', 'missing-wind', 'missing-aerodynamics']) assert.ok(r.issues.some(i => i.code === code), code);
  assert.equal(physics.analyzeFlight(r.input).mass, null);
  const unknownTail = snap(c, { scale: options().scale });
  assert.equal(unknownTail.input, null);
  assert.ok(unknownTail.issues.some(i => i.code === 'missing-tail-model'));
});

test('current transforms and SI scaling apply without touching cached scene matrices', () => {
  const c = fixture(); c.tailMeshRef.current.removeFromParent();
  const bodies = c.kiteFacesRef.current.filter(m => m.userData.surfaceIdx === 0);
  for (const m of bodies) { m.scale.set(2, 3, 1); m.position.x = 1; }
  c.kiteGroupRef.current.rotation.set(0.8, 0.7, 0.3); // view pose is not body geometry
  const before = c.kiteGroupRef.current.toJSON();
  const matrices = bodies.map(m => [...m.matrix.elements, ...m.matrixWorld.elements]);
  const r = snap(c);
  near(r.physicalPaperAreaM2, 0.03125 * 6);
  near(physics.analyzeFlight(r.input).geometry.spanM, 0.5);
  assert.deepEqual(c.kiteGroupRef.current.toJSON(), before);
  assert.deepEqual(bodies.map(m => [...m.matrix.elements, ...m.matrixWorld.elements]), matrices);
  const doubled = snap(c, { ...options(), scale: { ...options().scale, millimetresPerUnit: 200 } });
  near(doubled.physicalPaperAreaM2, r.physicalPaperAreaM2 * 4);
  const frozen = JSON.stringify(r); bodies[0].position.x = 3;
  assert.equal(JSON.stringify(r), frozen);
});

test('overlapping physical layers add mass, not exposed area; paint and duplicate faces add neither', () => {
  const c = fixture(); c.tailMeshRef.current.removeFromParent();
  const first = snap(c);
  const layer = addPaper(c, new THREE.PlaneGeometry(1, 1));
  const r = snap(c);
  near(r.physicalPaperAreaM2, first.physicalPaperAreaM2 + 0.01);
  near(r.exposedAreaM2, first.exposedAreaM2);
  near(physics.analyzeFlight(r.input).mass.totalKg, first.physicalPaperAreaM2 * 0.08 + 0.0008 + 0.003);
  const body = c.kiteFacesRef.current[0];
  c.kiteFacesRef.current.push(body); // registry alias
  body.add(new THREE.Mesh(body.geometry.clone())); // front/back pattern overlay
  layer.add(new THREE.Mesh(new THREE.PlaneGeometry(100, 100))); // decoration
  const paint = new THREE.Mesh(new THREE.PlaneGeometry(100, 100));
  paint.userData.attachmentPaint = true; c.kiteGroupRef.current.add(paint);
  const handle = new THREE.Mesh(new THREE.PlaneGeometry(100, 100)); c.kiteGroupRef.current.add(handle);
  const after = snap(c);
  near(after.physicalPaperAreaM2, r.physicalPaperAreaM2); near(after.exposedAreaM2, r.exposedAreaM2);
  assert.ok(after.input.decorations.every(d => d.kind === 'visual'));
  assert.ok(after.input.decorations.some(d => d.id === `visual:${body.children[0].uuid}`));
});

test('concave and disconnected wings retain gaps, overlap and nonuniform mirrored transforms', () => {
  const c = fixture();
  const { attachmentChoices, orientWing } = editor('wingAttachments');
  for (const shape of attachmentChoices('left', 'classic')) {
    const geo = shape.makeGeo(); orientWing(geo, 'left');
    const wing = new THREE.Mesh(geo); wing.userData.kind = 'corner-part'; wing.userData.cornerKey = 'left';
    wing.position.set(-1, 0, -0.005); wing.scale.set(-1.2, 2, 1); wing.rotation.z = 0.2;
    c.kiteGroupRef.current.add(wing);
    const r = snap(c); assert.ok(r.input, JSON.stringify(r.issues));
    assert.equal(physics.analyzeFlight(r.input).status, 'incomplete');
    assert.equal(r.paper.filter(p => p.role === 'wing').length, 1);
    wing.removeFromParent();
  }
});

test('replacement, deletion and real undo/redo use live objects, not stale registries', () => {
  const c = fixture(); const old = c.tailMeshRef.current; old.removeFromParent();
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 1)); tail.userData.kind = 'tail-stamp'; tail.position.set(0, -1.6, -0.005);
  c.kiteGroupRef.current.add(tail); // stale tailMeshRef deliberately remains old
  const r = snap(c); assert.equal(r.paper.find(p => p.role === 'tail').id, tail.uuid);
  const piece = addPaper(c, new THREE.PlaneGeometry(1, 1), 3);
  const undo = [{ type: 'add', obj: piece, parent: c.buildGroupRef.current }], redo = [];
  const history = editor('useHistory').useHistory({
    modeRef: { current: 'build' }, selectedFaceRef: { current: 0 }, buildGroupRef: c.buildGroupRef,
    surfaceDrawingsRef: { current: [] }, selectedStampRef: { current: null },
    getUndo: () => [undo], getRedo: () => [redo], bumpHistory() {}, clearSelection() {}, refreshSelectionOverlay() {},
  });
  const area = snap(c).physicalPaperAreaM2;
  history.undoOnSelectedSurface(); near(snap(c).physicalPaperAreaM2, area - 0.01);
  history.redoOnSelectedSurface(); near(snap(c).physicalPaperAreaM2, area);
  const before = { pos: piece.position.clone(), quat: piece.quaternion.clone(), scale: piece.scale.clone() };
  piece.scale.set(2, 3, 1);
  const after = { pos: piece.position.clone(), quat: piece.quaternion.clone(), scale: piece.scale.clone() };
  undo.push({ type: 'transform', obj: piece, before, after });
  near(snap(c).physicalPaperAreaM2, area + 0.05);
  history.undoOnSelectedSurface(); near(snap(c).physicalPaperAreaM2, area);
  history.redoOnSelectedSurface(); near(snap(c).physicalPaperAreaM2, area + 0.05);
});

test('unsupported tilt, invalid scale, missing sticks and nonrectangular flexible tails block flight input', () => {
  const c = fixture(); c.kiteFacesRef.current[0].rotation.x = 0.2;
  const tilted = snap(c); assert.equal(tilted.input, null); assert.ok(tilted.issues.some(i => i.code === 'nonplanar-paper'));
  assert.equal(snap(fixture(), { ...options(), scale: { millimetresPerUnit: 0, confirmation: 'bad' } }).input, null);
  const missing = fixture(); missing.hSparRef.current.removeFromParent();
  assert.ok(snap(missing).issues.some(i => i.code === 'missing-frame'));
  const flexible = snap(fixture(), { ...options(), tailModel: 'flexible' });
  assert.equal(flexible.input, null);
  assert.ok(flexible.issues.some(i => i.code === 'unsupported-flexible-shape'));
});

test('partial, contained, touching and duplicate layers have analytic union areas', () => {
  for (const [offset, expected] of [[0, 0.01], [0.5, 0.015], [1, 0.02], [0.25, 0.0125]]) {
    const c = fixture(); c.tailMeshRef.current.removeFromParent();
    const base = snap(c);
    addPaper(c, new THREE.PlaneGeometry(1, 1), 3);
    addPaper(c, new THREE.PlaneGeometry(1, 1), 3 + offset);
    const r = snap(c);
    near(r.physicalPaperAreaM2 - base.physicalPaperAreaM2, 0.02);
    near(r.exposedAreaM2 - base.exposedAreaM2, expected);
    assert.equal(physics.analyzeFlight(r.input).status, 'incomplete');
  }
});

test('single flexible rectangle preserves material area but requires prescribed pose and drag', () => {
  const c = fixture(); c.tailMeshRef.current.removeFromParent();
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 1));
  tail.userData.kind = 'tail-stamp'; tail.position.set(0, -1.6, -0.005); tail.rotation.z = 0.4; tail.scale.set(2, 3, 1);
  c.kiteGroupRef.current.add(tail);
  const missing = snap(c, { ...options(), tailModel: 'flexible' });
  assert.equal(missing.input, null); assert.ok(missing.issues.some(i => i.code === 'missing-tail-pose'));
  const o = { ...options(), tailModel: 'flexible', flexibleTails: { [tail.uuid]: { centerM: { x: 0, y: -0.2, z: 0 } } } };
  const r = snap(c, o);
  assert.ok(r.input, JSON.stringify(r.issues));
  assert.equal(r.input.tails.length, 1);
  near(r.input.tails[0].lengthM, 0.3); near(r.input.tails[0].widthM, 0.04);
  near(r.exposedAreaM2, 0.03125); // flexible strip is not a rigid aero patch
  near(physics.analyzeFlight(r.input).mass.totalKg, (0.03125 + 0.012) * 0.08 + 0.003);
  assert.ok(r.issues.some(i => i.code === 'missing-tail-drag'));
  o.flexibleTails[tail.uuid].centerM.y = -9;
  near(r.input.tails[0].centerM.y, -0.2);
});

test('actual reversed body duplicate faces are excluded, but separate build layers retain mass', () => {
  const c = fixture(); const base = snap(c);
  const original = c.kiteFacesRef.current[0];
  const duplicate = new THREE.Mesh(original.geometry.clone()); duplicate.userData.surfaceIdx = 0;
  const pos = duplicate.geometry.getAttribute('position');
  const p0 = new THREE.Vector3().fromBufferAttribute(pos, 0), p1 = new THREE.Vector3().fromBufferAttribute(pos, 1);
  pos.setXYZ(0, p1.x, p1.y, p1.z); pos.setXYZ(1, p0.x, p0.y, p0.z);
  c.kiteGroupRef.current.add(duplicate); c.kiteFacesRef.current.push(duplicate);
  near(snap(c).physicalPaperAreaM2, base.physicalPaperAreaM2);
  addPaper(c, original.geometry.clone());
  near(snap(c).physicalPaperAreaM2, base.physicalPaperAreaM2 + 0.03125 / 4);
});

test('root scale, nested matrix-only transforms and frame resizing are read without mutation', () => {
  const c = fixture(); c.kiteGroupRef.current.scale.set(2, 2, 2);
  const piece = addPaper(c, new THREE.PlaneGeometry(1, 1), 3);
  piece.matrixAutoUpdate = false;
  piece.matrix.makeTranslation(3, 0, 0).multiply(new THREE.Matrix4().makeScale(2, 1, 1));
  c.vSparRef.current.scale.y = 2;
  const nodes = []; c.kiteGroupRef.current.traverse(o => nodes.push(o));
  const state = () => nodes.map(o => ({ matrix: o.matrix.toArray(), world: o.matrixWorld.toArray(), dirty: o.matrixWorldNeedsUpdate, data: JSON.stringify(o.userData), children: o.children.map(c => c.uuid) }));
  const before = state(); const r = snap(c); assert.deepEqual(state(), before);
  const spine = r.sticks.find(s => s.id === 'spine').centerlineM;
  near(Math.abs(spine[1].y - spine[0].y), 1);
  near(r.paper.find(p => p.id === piece.uuid).trianglesM.reduce((s, t) => s + physics.measurePolygon(t).areaM2, 0), 0.08);
});

test('all replacement tail shapes preserve their polygons without area inflation', () => {
  const { CORNER_SHAPES } = editor('templates');
  for (const def of CORNER_SHAPES.bottom) {
    const c = fixture(); c.tailMeshRef.current.removeFromParent();
    const tail = new THREE.Mesh(def.makeGeo()); tail.userData.kind = 'tail-stamp'; tail.position.set(0, -1.4, -0.005);
    c.kiteGroupRef.current.add(tail);
    const r = snap(c); assert.ok(r.input, `${def.id}: ${JSON.stringify(r.issues)}`);
    assert.equal(physics.analyzeFlight(r.input).status, 'incomplete', def.id);
  }
});

test('deformed or partial triangle geometry and unsupported line models are explicit', () => {
  const c = fixture(); c.kiteFacesRef.current[0].geometry.setDrawRange(0, 0);
  assert.equal(snap(c).input, null);
  assert.ok(snap(c).issues.some(i => i.code === 'unsupported-paper-geometry'));
  const invalid = snap(fixture(), { ...options(), line: { model: 'elastic' } });
  assert.equal(invalid.input, null);
  assert.ok(invalid.issues.some(i => i.code === 'unsupported-line'));
});

test('root shear is rejected rather than silently reduced to scale', () => {
  const c = fixture();
  const root = c.kiteGroupRef.current;
  root.matrixAutoUpdate = false;
  root.matrix.makeShear(0.3, 0, 0, 0, 0, 0);
  const before = root.matrix.toArray();
  const r = snap(c);
  assert.ok(r.input === null);
  assert.ok(r.issues.some(i => i.code === 'unsupported-root-transform'));
  assert.deepEqual(root.matrix.toArray(), before);
});

test('partial and deformed frame geometry never yields a fabricated complete stick', () => {
  for (const change of [
    m => m.geometry.setDrawRange(0, 0),
    m => { m.morphTargetInfluences = [0.5]; },
    m => { m.geometry.parameters.radialSegments = Infinity; },
  ]) {
    const c = fixture(); change(c.hSparRef.current);
    const r = snap(c);
    assert.ok(r.input === null);
    assert.ok(r.issues.some(i => i.code === 'unsupported-stick'));
  }
});

test('instanced paper cannot be mistaken for a single physical layer', () => {
  const c = fixture();
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial(), 2);
  m.userData.build = true; m.userData.kind = 'stamp'; c.buildGroupRef.current.add(m);
  const r = snap(c);
  assert.ok(r.input === null);
  assert.ok(r.issues.some(i => i.code === 'unsupported-paper-geometry'));
});

test('numerically unresolved clipping fragments are reported instead of silently discarded', () => {
  const { subtractConvex } = editor('flightGeometry');
  const reports = [];
  const tiny = [{ x: 0, y: 0 }, { x: 1e-6, y: 0 }, { x: 0, y: 1e-6 }];
  const cutter = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }];
  subtractConvex(tiny, cutter, area => reports.push(area));
  assert.ok(reports.length > 0);
  assert.ok(reports.every(area => area > 0 && area <= 1e-12));
});
