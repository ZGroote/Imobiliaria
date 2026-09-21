import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/core/geometry.js', import.meta.url), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/lib/earcut.min.js', import.meta.url), 'utf8'), ctx);
const G = ctx.MapGeometry, plain = value => JSON.parse(JSON.stringify(value));
const rectangle = [[0, 0], [0, 10], [20, 10], [20, 0]];

test('signed area, containment and inset preserve the map winding convention', () => {
  assert.equal(G.shoelace(rectangle), -400);
  assert(G.inside(rectangle, 4, 5));
  assert(!G.inside(rectangle, -1, 5));
  assert.deepEqual(plain(G.insetRing(rectangle, 1)), [[1, 1], [1, 9], [19, 9], [19, 1]]);
  assert.equal(G.safeInset(rectangle, 5), rectangle, 'collapsed inset uses original contour');
});

test('convex hull and oriented bounds do not mutate irregular source points', () => {
  const points = [...rectangle, [4, 5], [8, 7]], before = JSON.stringify(points);
  assert.equal(G.convexHull(points).length, 4);
  const bounds = G.obbOf(points, 200);
  assert.equal(bounds.cx, 10); assert.equal(bounds.cz, 5);
  assert.equal(bounds.hu, 10); assert.equal(bounds.hv, 5);
  assert.equal(bounds.rect, 1); assert.equal(bounds.elong, 2);
  assert.equal(JSON.stringify(points), before);
});

test('concave triangulation conserves area and supports an explicit fallback', () => {
  const ring = [[0, 0], [4, 0], [4, 4], [2, 2], [0, 4]];
  const triangles = G.triangulateRing(ring, ctx.earcut, () => { throw Error('unexpected fallback'); });
  const area = triangles.reduce((total, tri) => total + Math.abs(G.shoelace(tri.map(i => ring[i]))) / 2, 0);
  assert.equal(area, 12);
  const sentinel = [];
  assert.equal(G.triangulateRing(ring, null, r => { assert.equal(r, ring); return sentinel; }), sentinel);
});
