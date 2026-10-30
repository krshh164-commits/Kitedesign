const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const path = require('node:path');
const esbuild = require('esbuild');

test('Build ignores stale brush input without touching paint or history', () => {
  const filename = path.resolve('src/app/components/kite-editor/useDrawing.ts');
  const result = esbuild.buildSync({
    entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs',
    packages: 'external', write: false,
  });
  const loaded = new Module(filename, module);
  loaded.paths = module.paths;
  loaded.require = name => name === 'react' ? { useRef: value => ({ current: value }) } : require(name);
  loaded._compile(result.outputFiles[0].text, filename);
  const drawing = loaded.exports.useDrawing({
    modeRef: { current: 'build' }, activeToolRef: { current: 'brush' },
  });
  assert.doesNotThrow(() => drawing.handleOverlayMouseDown({
    preventDefault() { assert.fail('Build brush input should be ignored'); },
  }));
});
