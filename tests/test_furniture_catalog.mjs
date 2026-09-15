// Oracle: catalog and library as they were in the monolith at a fixed commit (needs local Git history).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '908381d';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const libText = fs.readFileSync(new URL('../moveis/moveis_lib.json', import.meta.url), 'utf8');
const PARAMS = 'armarioParam, bancadaParam, aereoParam, ripadoParam, rackParam, tvParam, boxParam, maquinaParam, sofaParam';

function context(text) {
  const ctx = vm.createContext({document: {getElementById: id => id === '__moveis' ? {textContent: text} : null}});
  vm.runInContext(read('lib/three.min.js'), ctx);
  vm.runInContext(read('interior/furniture-param.js'), ctx);
  vm.runInContext(`const _c = new THREE.Color();
    globalThis.rgbDe = hex => { _c.setHex(hex); return [Math.round(_c.r*255), Math.round(_c.g*255), Math.round(_c.b*255)]; };
    globalThis.matInt = new THREE.MeshStandardMaterial();
    let MOVEIS_LIB;
    globalThis.__p = FurnitureParam.create({THREE, getLib: () => MOVEIS_LIB, rgbDe});
    globalThis.__setLib = l => { MOVEIS_LIB = l; };`, ctx);
  return ctx;
}
function oracle(text) {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const cut = (a, b) => { const i = app.indexOf(a), j = app.indexOf(b, i); assert.ok(i > 0 && j > i); return app.slice(i, j); };
  const ctx = context(text);
  vm.runInContext(`(() => { const {geoDeParts, ${PARAMS}} = __p;
    ${cut('const MOVEIS = {', 'const _cor = new THREE.Color();')}
    ${cut('const MOVEIS_LIB = (() => {', '/* ---- ambiente refletido')}
    __setLib(MOVEIS_LIB);
    globalThis.__o = {MOVEIS, MOVEL_KEYS, MOVEIS_LIB, geoDoMovel};
  })();`, ctx);
  return {api: ctx.__o, mat: ctx.matInt};
}
function modular(text) {
  const ctx = context(text);
  vm.runInContext(read('interior/furniture-catalog.js'), ctx);
  vm.runInContext(`globalThis.__o = FurnitureCatalog.create({THREE, document, rgbDe, geoDeParts: __p.geoDeParts,
    getMaterial: () => matInt, ...__p}); __setLib(__o.MOVEIS_LIB);`, ctx);
  return {api: ctx.__o, mat: ctx.matInt};
}
const describe = v => JSON.stringify(v, (k, x) => typeof x === 'function' ? 'fn:' + x.name : x);
function mesh(g, mat) {
  return g.children.map(c => ({mat: c.material === mat, cast: c.castShadow, receive: c.receiveShadow,
    attrs: Object.fromEntries(Object.entries(c.geometry.attributes).map(([k, a]) =>
      [k, [a.normalized, Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength).toString('base64')]])),
    index: c.geometry.index && [c.geometry.index.array.constructor.name, Buffer.from(c.geometry.index.array.buffer).toString('base64')]}));
}

for (const [label, text] of [['real library', libText], ['missing library', '']])
  test('catalog measures and every mounted piece match the monolith with ' + label, () => {
    const a = oracle(text), b = modular(text);
    assert.equal(describe(b.api.MOVEIS), describe(a.api.MOVEIS));
    assert.equal(JSON.stringify(b.api.MOVEL_KEYS), JSON.stringify(a.api.MOVEL_KEYS));
    assert.equal(Object.keys(b.api.MOVEIS_LIB).length, Object.keys(a.api.MOVEIS_LIB).length);
    for (const k of a.api.MOVEL_KEYS)
      for (const [cor, m] of [[a.api.MOVEIS[k].cor, undefined], [0x3366AA, {tipo: k, w: 2.4, h: 2.3, d: 0.6}]]) {
        const ga = a.api.geoDoMovel(a.api.MOVEIS[k], cor, m), gb = b.api.geoDoMovel(b.api.MOVEIS[k], cor, m);
        assert.equal(JSON.stringify(mesh(gb, b.mat)), JSON.stringify(mesh(ga, a.mat)), k);
      }
    if (text) assert.notEqual(b.api.MOVEIS.coifa.b[1], 0, 'library measure replaces the typed one');
  });
