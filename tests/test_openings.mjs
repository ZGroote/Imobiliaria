// Oracle: door and window joinery as it was in the monolith at a fixed commit (needs local
// Git history), over the openings of every supplied plan.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '5c5fac0';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const base = new URL('../plantas_fornecidas/', import.meta.url);
const units = fs.readdirSync(base).filter(d => fs.existsSync(new URL(`${d}/unidade.json`, base)))
  .map(d => JSON.parse(fs.readFileSync(new URL(`${d}/unidade.json`, base), 'utf8')))
  .filter(u => u.planta && (u.planta.comodos || []).length);

const PRELUDE = `const {inside, shoelace, safeInset, obbOf} = MapGeometry;
  const ESP = 0.13, PD = 2.70, BUILDING_INSET = 1.0, MOVEIS = {}, anelDoLote = () => null;
  const _c = new THREE.Color();
  const rgbDe = hex => { _c.setHex(hex); return [Math.round(_c.r*255), Math.round(_c.g*255), Math.round(_c.b*255)]; };
  const matEsq = {name:'esq'}, matAlum = {name:'alum'}, matVidro = {name:'vidro'};`;
function context() {
  const ctx = vm.createContext({location: {search: ''}, URLSearchParams});
  vm.runInContext(read('lib/three.min.js'), ctx);
  vm.runInContext(read('core/geometry.js'), ctx);
  vm.runInContext(read('interior/floor-plan.js'), ctx);
  return ctx;
}
function oracle() {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('const ESQ_ANG   = '), j = app.indexOf('/* Tres malhas, nao uma: parede, piso frio', i);
  assert.ok(i > 0 && j > i);
  const ctx = context();
  vm.runInContext(`(() => { ${PRELUDE}
    ${app.slice(i, j).replace(/^const \{decideVao, plantaDaUnidade, dentroDaPlanta\} = FloorPlan\.create[\s\S]*?\}\);\n/m, '')}
    const fp = FloorPlan.create({inside, shoelace, ESP, ESQ_ANG, ESQ_MARCO, safeInset, obbOf, BUILDING_INSET, PD, anelDoLote, MOVEIS});
    globalThis.__o = {geoDasEsquadrias, plantaDaUnidade: fp.plantaDaUnidade, mats: [matEsq, matAlum, matVidro]}; })();`, ctx);
  return ctx.__o;
}
function modular() {
  const ctx = context();
  vm.runInContext(read('interior/openings.js'), ctx);
  return vm.runInContext(`(() => { ${PRELUDE}
    const {ESQ_ANG, ESQ_MARCO, geoDasEsquadrias} = Openings.create({THREE, ESP, rgbDe, matEsq, matAlum, matVidro});
    const fp = FloorPlan.create({inside, shoelace, ESP, ESQ_ANG, ESQ_MARCO, safeInset, obbOf, BUILDING_INSET, PD, anelDoLote, MOVEIS});
    return {geoDasEsquadrias, plantaDaUnidade: fp.plantaDaUnidade, mats: [matEsq, matAlum, matVidro]}; })()`, ctx);
}
const meshes = (list, mats) => list.map(m => ({mat: mats.findIndex(x => x.name === m.material.name), cast: m.castShadow,
  receive: m.receiveShadow, order: m.renderOrder, casa: m.userData.casa,
  attrs: Object.fromEntries(Object.entries(m.geometry.attributes).map(([k, a]) =>
    [k, [a.normalized, Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength).toString('base64')]]))}));

test('door frames, leaves, handles, sills and sliding panes match the monolith for every supplied plan', () => {
  assert.ok(units.length >= 5);
  const a = oracle(), b = modular();
  const rec = {r: [[-12,-9],[14,-9],[14,11],[-12,11]], h: 30};
  let pieces = 0;
  for (const u of units)
    for (const cores of [u.cores || {}, {esquadria: '#553311', aluminio: '#CCCCCC', vidro: '#88AACC', porta: '#FFFFFF', peitoril: '#777777'}]) {
      const ua = {...u, cores}, ub = {...u, cores};
      const pa = a.plantaDaUnidade(rec, ua), pb = b.plantaDaUnidade(rec, ub);
      const ma = a.geoDasEsquadrias(pa), mb = b.geoDasEsquadrias(pb);
      assert.equal(JSON.stringify(meshes(mb, b.mats)), JSON.stringify(meshes(ma, a.mats)), u.id);
      assert.equal(JSON.stringify(pb.esquadrias.map(e => e.folha || null)), JSON.stringify(pa.esquadrias.map(e => e.folha || null)));
      pieces += mb.length;
    }
  assert.ok(pieces >= units.length * 2 * 2, 'meshes built: ' + pieces);
});
