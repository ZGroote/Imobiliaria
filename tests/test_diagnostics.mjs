import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

vm.runInThisContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/scene/diagnostics.js', import.meta.url), 'utf8'));

test('QA reads the current scene and deferred vegetation without DOM or source injection', () => {
  const scene = {}, renderer = {};
  let trees = null, requested = 0;
  const qa = MapDiagnostics.create({terrainY: (x, z) => x + z, scene, renderer,
    getArborizacao: () => trees, monta: n => { requested = n; }});
  assert.equal(qa.terrainY(2, 3), 5);
  assert.equal(qa.cena().scene, scene);
  assert.equal(qa.cena().ARV, null);
  trees = {cat: ['tree']};
  assert.equal(qa.cena().ARV, trees);
  qa.cena().monta(4);
  assert.equal(requested, 4);
  assert.equal(qa.version, 1);
});
