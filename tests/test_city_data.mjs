import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const context = vm.createContext({}); // No window, document, THREE or application globals.
vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/core/city-data.js', import.meta.url), 'utf8'), context);
const area2 = ring => ring.reduce((sum, p, i) => {
  const next = ring[(i + 1) % ring.length];
  return sum + p[0] * next[1] - next[0] * p[1];
}, 0);
const decode = context.CityData.createDecoder(10, area2);
const plain = value => JSON.parse(JSON.stringify(value));

test('preserves coordinates, metadata and building/placement indices with q=20', () => {
  const source = {q: 20, names: ['Casa', 'Rua A'], bm: [0, 0, 1], fa: [90],
    urbanLots: {'0': [3, 5, -2, .5]},
    b: [1, 60, 4, 0, 0, 40, 0, 0, 40, -40, 0],
    r: [6, 1, 2, 0, 0, 100, 0],
    g: [3, 0, 0, 20, 0, 0, 20], bl: [20, 40, 60, 0, 1]};
  const before = JSON.stringify(source);
  const result = plain(context.CityData.createDecoder(20, area2)(source));
  assert.deepEqual(result.B[0], {r: [[0, 0], [2, 0], [2, 2], [0, 2]], h: 3,
    c: 1, area: 4, name: 'Casa', addr: 'Rua A', urbanLot: [3, 5, -2, .5], fa: 90});
  assert.deepEqual(result.R, [{pts: [[0, 0], [5, 0]], k: 6, name: 'Rua A'}]);
  assert.deepEqual(result.G, [{r: [[0, 0], [1, 0], [1, 1]]}]);
  assert.deepEqual(result.grp, [{cx: 1, cz: 2, rad: 3, s: 0, n: 1}]);
  assert.equal(JSON.stringify(source), before, 'decoding must not mutate its input');
});

test('retains the legacy rescaling when imported data uses another quantization', () => {
  // Characterization, not a new conversion rule: the old decoder multiplies q/Q.
  // Normal builds enforce matching q; changing imported-city semantics is separate.
  const result = plain(decode({q: 20, b: [0, 60, 3, 0, 0, 40, 0, 0, 40], r: []}));
  assert.deepEqual(result.B[0].r, [[0, 0], [8, 0], [8, 8]]);
});

test('legacy defaults, empty collections and clockwise rings remain compatible', () => {
  assert.deepEqual(plain(decode({b: [], r: []})), {B: [], R: [], G: [], grp: []});
  const result = plain(decode({b: [0, 30, 3, 0, 0, 0, 20, 20, 0], r: []}));
  assert.equal(result.B[0].area, 2);
  assert.equal(result.B[0].h, 3);
  assert.equal(result.B[0].fa, 400);
  assert.equal(result.B[0].name, null);
  assert.equal(result.B[0].addr, null);
});
