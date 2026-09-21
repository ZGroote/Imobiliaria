// Oracle: furniture instances in the scene and their persistence as they were in the monolith at a
// fixed commit (needs local Git history), with the real catalog and mesh library.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = 'e9bd8b1';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const lib = fs.readFileSync(new URL('../moveis/moveis_lib.json', import.meta.url), 'utf8');

const SETUP = `const _c = new THREE.Color();
  const rgbDe = hex => { _c.setHex(hex); return [Math.round(_c.r*255), Math.round(_c.g*255), Math.round(_c.b*255)]; };
  const matInt = new THREE.MeshStandardMaterial();
  let MOVEIS_LIB;
  const fparam = FurnitureParam.create({THREE, getLib: () => MOVEIS_LIB, rgbDe});
  const cat = FurnitureCatalog.create({THREE, document, rgbDe, geoDeParts: fparam.geoDeParts, getMaterial: () => matInt, ...fparam});
  MOVEIS_LIB = cat.MOVEIS_LIB;
  const {MOVEIS, geoDoMovel} = cat, geoDeParts = fparam.geoDeParts;
  const CIDADE = {slug: 'sao-carlos'};
  const store = new Map();
  const guarda = {grava: (k, v) => store.set(k, v), le: k => store.has(k) ? store.get(k) : null};
  let luzes = 0; function sujaLuzes() { luzes++; }
  const ob = {cx: 3, cz: -2, ux: Math.cos(0.4), uz: Math.sin(0.4)};
  const INT = {pl: {id: 'u1', ob, W: (a, b) => [ob.cx + ob.ux*a - ob.uz*b, ob.cz + ob.uz*a + ob.ux*b]},
               raiz: new THREE.Group(), moveis: []};
  const MOB = {fantasma: null};
  globalThis.__st = {store, INT, MOB, luzes: () => luzes};`;
function context() {
  const ctx = vm.createContext({document: {getElementById: id => id === '__moveis' ? {textContent: lib} : null}});
  for (const f of ['lib/three.min.js', 'interior/furniture-param.js', 'interior/furniture-catalog.js']) vm.runInContext(read(f), ctx);
  return ctx;
}
function oracle() {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('const chaveSalva = id =>'), j = app.indexOf('// Contorno de seleção', i);
  assert.ok(i > 0 && j > i);
  const ctx = context();
  vm.runInContext(`(() => { ${SETUP} ${app.slice(i, j)}
    globalThis.__o = {salvaMoveis, leMoveis, poeNaCena, atualizaMovel, recolore}; })();`, ctx);
  return ctx;
}
function modular() {
  const ctx = context();
  vm.runInContext(read('interior/furniture-instances.js'), ctx);
  vm.runInContext(`(() => { ${SETUP}
    globalThis.__o = FurnitureInstances.create({INT, MOVEIS, geoDoMovel, geoDeParts, guarda, CIDADE, sujaLuzes, MOB}); })();`, ctx);
  return ctx;
}
function scene(ctx) {
  return JSON.stringify(ctx.__st.INT.moveis.map(m => ({tipo: m.tipo, b: m._b || null, pos: m.obj.position.toArray(),
    rot: m.obj.rotation.y, scale: m.obj.scale.toArray(), linked: m.obj.userData.movel === m,
    meshes: m.obj.children.map(c => [c.userData.movel === m, ...Object.values(c.geometry.attributes)
      .map(a => Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength).toString('base64'))])})));
}
function run(ctx) {
  const {INT, store} = ctx.__st, P = ctx.__o, out = [];
  INT.moveis = [
    {tipo: 'sofa', u: 0.5, v: -1, rot: 0, w: 2.6, h: 0.8, d: 0.92, cor: 0x4A5A6B},
    {tipo: 'cama', u: -2, v: 1.5, rot: 1, w: 1.45, h: 0.95, d: 2.05, cor: 0x8A7660},
    {tipo: 'armario', u: 1, v: 2, rot: 3, w: 1.8, h: 2.35, d: 0.6, cor: 0x6E5B47},
    {tipo: 'mesa', u: -0.4, v: 0.2, rot: 2, w: 1.1, h: 0.76, d: 0.85, cor: 0x9A7A55}];
  for (const m of INT.moveis) P.poeNaCena(m);
  out.push(scene(ctx), INT.raiz.children.length);
  const sofa = INT.moveis[0], cama = INT.moveis[1];
  const geoAntes = sofa.obj.children[0].geometry;
  P.atualizaMovel(sofa); out.push(sofa.obj.children[0].geometry === geoAntes);   // same measure: not rebuilt
  sofa.w = 3.2; cama.w = 1.9; cama.rot = 2; P.atualizaMovel(sofa); P.atualizaMovel(cama);
  out.push(scene(ctx));
  sofa.cor = 0x224466; P.recolore(sofa); cama.cor = 0x112233; P.recolore(cama);
  out.push(scene(ctx), INT.raiz.children.length);
  P.salvaMoveis(); out.push([...store.entries()], ctx.__st.luzes());
  store.set('int_sao-carlos_u1', JSON.stringify([{t: 'cama', u: 1, v: 2, r: 5, w: 1, d: 2, h: 1, c: 7}, {t: 'naoexiste', u: 0, v: 0}]));
  out.push(JSON.stringify(P.leMoveis('u1')));
  store.set('int_sao-carlos_u1', '[]'); out.push(P.leMoveis('u1'));
  store.set('int_sao-carlos_u1', '{quebrado'); out.push(P.leMoveis('u1'));
  out.push(P.leMoveis('outra'));
  INT.pl = null; P.salvaMoveis(); out.push(store.size, ctx.__st.luzes());
  return JSON.stringify(out);
}

test('furniture placement, parametric rebuild, recolour and saved layout match the monolith', () => {
  const a = oracle(), b = modular();
  assert.equal(run(b), run(a));
});
