import assert from 'node:assert/strict';
import {createSplatCache} from './splat/cache.js';

const meshes = new Map();
const cache = createSplatCache({limit: 2, create(file) {
  let resolve, reject;
  const initialized = new Promise((a, b) => { resolve = a; reject = b; });
  const mesh = {initialized, resolve, reject, disposed: false, dispose() { this.disposed = true; }};
  meshes.set(file, mesh); return mesh;
}});
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

cache.select('sala'); cache.prefetch('varanda');
assert.equal(cache.ready, false);
meshes.get('varanda').resolve(); await settle();
assert.equal(meshes.get('varanda').visible, false, 'Prefetch must never replace the selected room');
meshes.get('sala').resolve(); await settle();
assert.equal(cache.ready, true);
cache.select('varanda');
assert.equal(meshes.get('varanda').visible, true);
assert.equal(meshes.get('sala').visible, false);

cache.select('suite');
meshes.get('suite').reject(Error('HTTP 404')); await settle();
assert.match(cache.error, /404/);
assert.equal(cache.ready, false, 'A failed asset must leave the mesh fallback in use');
cache.select('suite');
assert.equal(meshes.get('suite').disposed, false, 'Do not retry a failed download every animation frame');
cache.select('quarto'); cache.select('banho'); cache.select('varanda');
const old = meshes.get('quarto'); old.resolve(); await settle();
assert.equal(old.visible, false, 'An evicted late download must stay invisible');
assert.equal(old.disposed, true);
assert.ok(cache.snapshot().files.length <= 2);
cache.dispose();
meshes.get('banho').resolve(); meshes.get('varanda').resolve(); await settle();
assert.equal(cache.ready, false);
assert.ok([...meshes.values()].every(m => m.disposed));
console.log('PASS: prefetch, switches, failure, late completion, bounded cache and disposal');
