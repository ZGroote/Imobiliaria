import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const ctx = vm.createContext({});
for (const file of ['lib/three.min.js', 'terrain-fit.js', 'world/terrain.js'])
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/' + file, import.meta.url), 'utf8'), ctx);
const T = ctx.THREE;
const create = () => ctx.WorldTerrain.create({THREE: T, TerrainFit: ctx.TerrainFit,
  n: 2, half: 10, exaggeration: 1, getAmount: () => 0});
const geometry = () => {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array([0, 2, 0, 1, 2, 0, 0, 2, 1]), 3));
  return g;
};

test('loading or replacing elevation invalidates the cached sample', () => {
  const terrain = create();
  assert.equal(terrain.sampleCached(0, 0), 0);
  terrain.grid = new Float32Array([0, 10, 20, 30]);
  assert.equal(terrain.sampleCached(0, 0), 15);
  terrain.grid = new Float32Array([10, 20, 30, 40]);
  assert.equal(terrain.sampleCached(0, 0), 25);
});

test('static geometry applies relief reversibly; shader buildings retain base vertices', () => {
  const terrain = create(), ground = geometry(), building = geometry();
  terrain.grid = new Float32Array([0, 10, 20, 30]);
  terrain.register(ground);
  terrain.apply(ground, 1, true);
  assert.equal(ground.attributes.position.getY(0), 17);
  terrain.apply(ground, 0, true);
  assert.equal(ground.attributes.position.getY(0), 2);
  building.userData.dynamicHeight = true;
  building.userData.presetDY = new Float32Array([8, 8, 8]);
  terrain.register(building); terrain.apply(building, 1, true);
  assert.equal(building.attributes.position.getY(0), 2);
  assert.equal(building.attributes.aDY.getX(0), 8);
});

test('recompute uses building centres and released geometries leave the registry', () => {
  const terrain = create(), g = geometry(), poi = geometry();
  g.userData.presetCenter = new Float32Array([0, 0, 0, 0, 0, 0]);
  poi.userData.poi = true;
  terrain.register(g); terrain.register(poi);
  terrain.grid = new Float32Array([0, 10, 20, 30]); terrain.recompute();
  assert.deepEqual(Array.from(g.userData.terrain.dy), [15, 15, 15]);
  terrain.retain(item => item.userData.poi);
  assert.deepEqual(Array.from(terrain.geometries()), [poi]);
  terrain.unregister(poi); terrain.unregister(poi);
  assert.equal(Array.from(terrain.geometries()).length, 0);
});
