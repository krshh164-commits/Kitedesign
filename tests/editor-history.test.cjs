const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const path = require('node:path');
const esbuild = require('esbuild');
const THREE = require('three');

function loadEditorModule(name) {
  const filename = path.resolve(`src/app/components/kite-editor/${name}.ts`);
  const result = esbuild.buildSync({
    entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false,
  });
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded._compile(result.outputFiles[0].text, filename);
  return loaded.exports;
}

const { useHistory } = loadEditorModule('useHistory');
const { createKiteModel } = loadEditorModule('createKiteModel');
const { bodySurfaceGeometry, clipPaintToBody } = loadEditorModule('bodySurface');

test('all template highlights and body masks match the rendered panels exactly', () => {
  for (const kiteType of ['classic', 'diamond', 'oval', 'swallow', 'fighter', 'butterfly']) {
    const context = { kiteType, mode: 'build', modeRef: { current: 'build' }, applyModeColors: () => {} };
    for (const key of ['kiteGroupRef', 'kiteFacesRef', 'tailMeshRef', 'vSparRef', 'hSparRef', 'highlightMeshesRef', 'buildGroupRef']) context[key] = { current: null };
    context.cornerPartsRef = { current: {} };
    createKiteModel(context, new THREE.Scene());
    const panels = context.kiteFacesRef.current.filter(mesh => mesh.userData.surfaceIdx === 0);
    const expected = panels.flatMap(mesh => {
      const geo = mesh.geometry, pos = geo.getAttribute('position');
      return Array.from({ length: geo.index?.count ?? pos.count }, (_, i) => {
        const j = geo.index ? geo.index.getX(i) : i;
        return [pos.getX(j), pos.getY(j), pos.getZ(j)];
      }).flat();
    });
    const highlight = context.highlightMeshesRef.current[0];
    assert.deepEqual(Array.from(highlight.geometry.getAttribute('position').array), expected, kiteType);
    assert.equal(highlight.rotation.z, 0);
    for (const panel of panels) {
      assert.equal(panel.material.stencilWrite, true);
      assert.equal(panel.material.stencilRef, 1);
      assert.equal(panel.material.stencilZPass, THREE.ReplaceStencilOp);
    }
    assert.equal(context.tailMeshRef.current.material.stencilWrite, false);
    for (const spar of [context.vSparRef.current, context.hSparRef.current]) {
      assert.equal(spar.renderOrder, Infinity);
      assert.equal(spar.material.transparent, true);
      assert.equal(spar.material.opacity, 1);
      assert.equal(spar.material.depthTest, true);
      assert.equal(spar.material.depthWrite, true);
    }
    const edges = new THREE.EdgesGeometry(highlight.geometry);
    assert.ok(edges.getAttribute('position').count >= 8);
    edges.dispose();
  }
});

test('body mask preserves transforms and is read-only for stamps and brush segments', () => {
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  panel.position.set(2, 3, 0); panel.scale.set(2, 1, 1);
  const geo = bodySurfaceGeometry([panel]);
  geo.computeBoundingBox();
  assert.deepEqual(geo.boundingBox.min.toArray(), [0, 2, 0]);
  assert.deepEqual(geo.boundingBox.max.toArray(), [4, 4, 0]);
  const material = new THREE.MeshBasicMaterial();
  clipPaintToBody(material);
  assert.equal(material.stencilFunc, THREE.EqualStencilFunc);
  assert.equal(material.stencilWriteMask, 0);
  assert.equal(material.stencilRef, 1);
  const { addBrushSeg } = loadEditorModule('drawingGeometry');
  const brush = new THREE.Group();
  addBrushSeg(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), '#ff0000', brush, [], 1, true);
  assert.equal(brush.children.length, 2);
  for (const segment of brush.children) {
    assert.equal(segment.material.stencilFunc, THREE.EqualStencilFunc);
    assert.equal(segment.material.stencilWriteMask, 0);
  }
  geo.dispose(); panel.geometry.dispose(); material.dispose();
});

test('Classic and Diamond panels all face the same front side', () => {
  for (const kiteType of ['classic', 'diamond']) {
    const context = { kiteType, mode: 'build', modeRef: { current: 'build' }, applyModeColors: () => {} };
    for (const key of ['kiteGroupRef', 'kiteFacesRef', 'tailMeshRef', 'vSparRef', 'hSparRef', 'highlightMeshesRef', 'buildGroupRef']) context[key] = { current: null };
    context.cornerPartsRef = { current: {} };
    createKiteModel(context, new THREE.Scene());
    const panels = context.kiteFacesRef.current.filter(mesh => mesh.userData.surfaceIdx === 0);
    assert.equal(panels.length, 4);
    for (const mesh of panels) {
      const normals = mesh.geometry.getAttribute('normal');
      for (let i = 0; i < normals.count; i++) assert.ok(normals.getZ(i) > 0.99, `${kiteType} panel is reversed`);
    }
  }
});
const { makeShapeGeo, computeSurfaceClipping, intersectDrawingPlane } = loadEditorModule('drawingGeometry');

test('stroke projection stays on a rotated surface beyond its edges', () => {
  const group = new THREE.Group();
  group.rotation.set(0.5, 0.8, 0.3);
  group.position.set(1, -2, 3);
  group.scale.set(1.3, 0.7, 1.1);
  group.updateMatrixWorld(true);
  const start = new THREE.Vector3(0, 0, 0.015), normal = new THREE.Vector3(0, 0, 1);
  for (const local of [new THREE.Vector3(0.2, 0.3, 0.015), new THREE.Vector3(4, -5, 0.015)]) {
    const target = local.clone().applyMatrix4(group.matrixWorld);
    const origin = target.clone().add(new THREE.Vector3(2, 3, 7));
    const ray = new THREE.Ray(origin, target.clone().sub(origin).normalize());
    const result = intersectDrawingPlane(ray, group, start, normal);
    assert.ok(result && result.distanceTo(local) < 1e-6);
  }
});
const { paintGeometry } = loadEditorModule('attachmentPaint');
const { bindPaintSide, updatePaintSide } = loadEditorModule('paintSide');

test('front and back artwork remains independent after part transforms', () => {
  const part = new THREE.Group();
  const front = new THREE.Group(), back = new THREE.Mesh(new THREE.PlaneGeometry());
  part.add(front, back);
  const camera = new THREE.PerspectiveCamera();
  camera.position.z = 5;
  bindPaintSide(front, camera, part, new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
  camera.position.z = -5;
  bindPaintSide(back, camera, part, new THREE.Vector3(), new THREE.Vector3(0, 0, 1));
  part.rotation.set(0.3, 1.2, 0.4);
  part.position.set(2, -1, 3);
  part.scale.set(2, 0.8, 1);
  part.updateMatrixWorld(true);
  for (const z of [5, -5]) {
    const view = part.localToWorld(new THREE.Vector3(0, 0, z));
    updatePaintSide(front, view); updatePaintSide(back, view);
    assert.equal(front.visible, z > 0);
    assert.equal(back.visible, z < 0);
  }
  back.geometry.dispose();
});

test('attachment paint preserves exact wing triangles and normalizes UVs without changing the part', () => {
  for (const shape of attachmentChoices('left', 'classic')) {
    const source = shape.makeGeo();
    const paint = paintGeometry(source);
    assert.deepEqual(Array.from(paint.getAttribute('position').array), Array.from(source.getAttribute('position').array));
    assert.deepEqual(Array.from(paint.index.array), Array.from(source.index.array));
    assert.notEqual(paint, source);
    const uv = paint.getAttribute('uv');
    assert.ok(Array.from(uv.array).every(v => Number.isFinite(v) && v >= -1e-6 && v <= 1.000001));
    paint.dispose(); source.dispose();
  }
});
const { attachmentChoices, orientWing, wingAnchor, wingMount, resizeWing } = loadEditorModule('wingAttachments');

test('paired wing resizing restores both sizes and mounts in one undo and redo', () => {
  const f = historyFixture();
  const snap = m => ({ pos: m.position.clone(), quat: m.quaternion.clone(), scale: m.scale.clone() });
  const wings = ['left', 'right'].map(side => {
    const mesh = new THREE.Mesh();
    mesh.userData.cornerKey = side;
    mesh.position.copy(wingMount('classic', side));
    return mesh;
  });
  const before = wings.map(snap);
  wings.forEach((m, i) => resizeWing(m, before[i], 1.5, 2));
  const after = wings.map(snap);
  assert.equal(wings[0].position.x, -wings[1].position.x);
  assert.deepEqual(wings[0].scale.toArray(), wings[1].scale.toArray());
  f.undo.build[0].push({ type: 'transform', obj: wings[0], before: before[0], after: after[0],
    linked: { obj: wings[1], before: before[1], after: after[1] } });
  f.history.undoOnSelectedSurface();
  wings.forEach((m, i) => assert.deepEqual(snap(m), before[i]));
  assert.equal(f.redo.build[0].length, 1);
  f.history.redoOnSelectedSurface();
  wings.forEach((m, i) => assert.deepEqual(snap(m), after[i]));
});

test('Classic wing attachment edges are fully inside the kite body', () => {
  for (const side of ['left', 'right']) {
    for (const shape of attachmentChoices(side, 'classic')) {
      const geo = shape.makeGeo();
      const positions = geo.getAttribute('position');
      const root = Array.from({ length: positions.count }, (_, i) => i)
        .filter(i => Math.abs(positions.getY(i)) < 1e-6);
      assert.ok(root.length > 0);
      orientWing(geo, side);
      const mount = wingMount('classic', side);
      for (const i of root) {
        const x = positions.getX(i) + mount.x;
        const y = positions.getY(i) + mount.y;
        assert.ok(Math.abs(x) + Math.abs(y) < 1.25, `${side} ${shape.label} root protrudes`);
      }
      geo.dispose();
    }
  }
});

test('dedicated wings mirror exactly and slope 55 degrees downward', () => {
  const names = ['Long Triangle', 'Single Ribbon', 'Twin Ribbons', 'Diamond', 'Swept Fin', 'Forked Wing'];
  for (const type of ['classic', 'diamond', 'oval', 'swallow', 'fighter', 'butterfly']) {
    assert.deepEqual(attachmentChoices('left', type).map(s => s.label), names);
    assert.deepEqual(attachmentChoices('right', type).map(s => s.label), names);
    const l = wingAnchor(type, 'left'), r = wingAnchor(type, 'right');
    assert.equal(l.x, -r.x);
    assert.equal(l.y, r.y);
  }
  for (const shape of attachmentChoices('left', 'classic')) {
    const left = orientWing(shape.makeGeo(), 'left');
    const right = orientWing(shape.makeGeo(), 'right');
    const l = left.getAttribute('position'), r = right.getAttribute('position');
    for (let i = 0; i < l.count; i++) {
      assert.ok(Math.abs(l.getX(i) + r.getX(i)) < 1e-6);
      assert.ok(Math.abs(l.getY(i) - r.getY(i)) < 1e-6);
    }
    left.dispose(); right.dispose();
  }
  const ribbon = attachmentChoices('right', 'classic').find(s => s.id === 'single_ribbon');
  const geo = orientWing(ribbon.makeGeo(), 'right');
  geo.computeBoundingBox();
  const center = geo.boundingBox.getCenter(new THREE.Vector3());
  assert.ok(center.x > 0 && center.y < 0);
  assert.ok(Math.abs(Math.atan2(-center.y, center.x) * 180 / Math.PI - 55) < 0.001);
  geo.dispose();
  assert.ok(attachmentChoices('bottom', 'classic').some(s => s.id === 'tri'));
});

function historyFixture() {
  const build = new THREE.Group();
  const design = new THREE.Group();
  const undo = { build: [[]], design: [[]] };
  const redo = { build: [[]], design: [[]] };
  const mode = { current: 'build' };
  const selected = { current: null };
  const context = {
    modeRef: mode, selectedFaceRef: { current: 0 }, buildGroupRef: { current: build },
    surfaceDrawingsRef: { current: [design] }, selectedStampRef: selected,
    getUndo: () => undo[mode.current], getRedo: () => redo[mode.current],
    bumpHistory: () => {}, clearSelection: () => { selected.current = null; },
    refreshSelectionOverlay: () => {},
  };
  return { build, design, undo, redo, mode, selected, history: useHistory(context) };
}

test('undo and redo preserve the object and its original parent', () => {
  const f = historyFixture();
  const mesh = new THREE.Mesh();
  f.build.add(mesh);
  f.selected.current = mesh;
  f.undo.build[0].push({ type: 'add', obj: mesh, parent: f.build });
  f.history.undoOnSelectedSurface();
  assert.equal(mesh.parent, null);
  assert.equal(f.selected.current, null);
  assert.equal(f.redo.build[0].length, 1);
  f.history.redoOnSelectedSurface();
  assert.equal(mesh.parent, f.build);
  assert.equal(f.undo.build[0].length, 1);
});

test('transform history restores position, rotation, and scale in both directions', () => {
  const f = historyFixture();
  const mesh = new THREE.Mesh();
  const before = { pos: new THREE.Vector3(1, 2, 0), quat: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1) };
  const after = { pos: new THREE.Vector3(3, 4, 0), quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.5), scale: new THREE.Vector3(2, 3, 1) };
  f.undo.build[0].push({ type: 'transform', obj: mesh, before, after });
  f.history.undoOnSelectedSurface();
  assert.deepEqual(mesh.position.toArray(), before.pos.toArray());
  assert.deepEqual(mesh.scale.toArray(), before.scale.toArray());
  f.history.redoOnSelectedSurface();
  assert.deepEqual(mesh.position.toArray(), after.pos.toArray());
  assert.deepEqual(mesh.quaternion.toArray(), after.quat.toArray());
  assert.deepEqual(mesh.scale.toArray(), after.scale.toArray());
});

test('clearing one mode leaves the other mode and its history intact', () => {
  const f = historyFixture();
  const buildMesh = new THREE.Mesh();
  const designMesh = new THREE.Mesh();
  f.build.add(buildMesh);
  f.design.add(designMesh);
  f.undo.build[0].push({ type: 'add', obj: buildMesh, parent: f.build });
  f.undo.design[0].push({ type: 'add', obj: designMesh, parent: f.design });
  f.mode.current = 'design';
  f.history.clearSelectedSurface();
  assert.equal(f.design.children.length, 0);
  assert.equal(f.undo.design[0].length, 0);
  assert.equal(f.build.children.length, 1);
  assert.equal(f.undo.build[0].length, 1);
});

test('drawing geometry keeps expected sizes and clips within the body', () => {
  for (const tool of ['circle', 'square', 'triangle']) {
    const geometry = makeShapeGeo(tool, 2);
    geometry.computeBoundingBox();
    assert.ok(Math.abs(geometry.boundingBox.max.x - geometry.boundingBox.min.x - 2) < 0.00001);
    geometry.dispose();
  }
  const group = new THREE.Group();
  const planes = computeSurfaceClipping(0, group);
  assert.equal(planes.length, 4);
  assert.ok(planes.every(plane => plane.distanceToPoint(new THREE.Vector3()) > 0));
  assert.ok(planes.some(plane => plane.distanceToPoint(new THREE.Vector3(5, 0, 0)) < 0));
});
