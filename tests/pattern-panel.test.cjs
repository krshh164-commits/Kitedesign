const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const path = require('node:path');
const esbuild = require('esbuild');
const THREE = require('three');

test('pattern overlays share one texture on both sides and clean up on replacement', () => {
  const filename = path.resolve('src/app/components/kite-editor/PatternPanel.tsx');
  const result = esbuild.buildSync({
    entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs',
    jsx: 'automatic', packages: 'external', write: false,
  });
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  let effect;
  loaded.require = name => name === 'react' ? {
    useState: initial => [initial, () => {}],
    useEffect: callback => { effect = callback; },
  } : require(name);
  loaded._compile(result.outputFiles[0].text, filename);
  const originalDocument = global.document;
  global.document = { createElement: () => ({ getContext: () => ({ fillRect() {} }) }) };
  const bodies = [new THREE.Mesh(new THREE.PlaneGeometry()), new THREE.Mesh(new THREE.PlaneGeometry())];
  const tail = new THREE.Mesh(new THREE.PlaneGeometry());
  bodies.forEach(body => { body.userData.surfaceIdx = 0; });
  tail.userData.surfaceIdx = 1;
  try {
    loaded.exports.PatternPanel({ context: {
      kiteGroupRef: { current: new THREE.Group() }, mode: 'design', kiteType: 'classic',
      kiteFacesRef: { current: [...bodies, tail] },
    } });
    const cleanup = effect();
    const overlays = bodies.map(body => {
      assert.equal(body.children.length, 1);
      return body.children[0];
    });
    assert.equal(tail.children.length, 0);
    assert.equal(overlays[0].material.map, overlays[1].material.map);
    let textureDisposals = 0;
    overlays[0].material.map.addEventListener('dispose', () => textureDisposals++);
    for (const overlay of overlays) assert.equal(overlay.material.side, THREE.DoubleSide);
    cleanup();
    assert.equal(textureDisposals, 1);
    for (const body of bodies) assert.equal(body.children.length, 0);
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
    for (const mesh of [...bodies, tail]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  }
});
