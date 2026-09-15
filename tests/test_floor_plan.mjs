// Oracle: wall grid and opening decisions as they were in the monolith at a fixed commit
// (needs local Git history), run over every supplied floor plan.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '044b220';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const plans = fs.readdirSync(new URL('../plantas_fornecidas/', import.meta.url))
  .map(d => new URL(`../plantas_fornecidas/${d}/unidade.json`, import.meta.url))
  .filter(u => fs.existsSync(u)).map(u => JSON.parse(fs.readFileSync(u, 'utf8')))
  .filter(u => u.planta && u.planta.comodos && u.planta.comodos.length);

const CONSTS = 'const ESP = 0.13, ESQ_ANG = 78 * Math.PI/180, ESQ_MARCO = 0.030;';
function context() {
  const ctx = vm.createContext({});
  vm.runInContext(read('core/geometry.js'), ctx);
  return ctx;
}
function oracle() {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('// t do ponto projetado no segmento'), j = app.indexOf('const PISO_HEX', i);
  assert.ok(i > 0 && j > i);
  const ctx = context();
  vm.runInContext(`(() => { const {inside, shoelace} = MapGeometry; ${CONSTS}
    ${app.slice(i, j)}
    globalThis.__o = {paredesDaGrade, decideVao}; })();`, ctx);
  return ctx.__o;
}
function modular() {
  const ctx = context();
  vm.runInContext(read('interior/floor-plan.js'), ctx);
  return vm.runInContext(`(() => { const {inside, shoelace} = MapGeometry; ${CONSTS}
    return FloorPlan.create({inside, shoelace, ESP, ESQ_ANG, ESQ_MARCO}); })()`, ctx);
}
// Same opening list plantaDaUnidade builds from the record.
function openings(P) {
  const vaos = [];
  for (const p of (P.portas || []))
    vaos.push({rec: p, porta: true, p: p.p, largura: p.largura || 0.85, y0: p.y0 != null ? p.y0 : 0, y1: p.y1 != null ? p.y1 : 2.10});
  for (const j of (P.janelas || []))
    vaos.push({rec: j, porta: false, p: j.p, largura: j.largura || 1.40, y0: j.y0 != null ? j.y0 : 1.00, y1: j.y1 != null ? j.y1 : 2.20});
  return vaos;
}
const plain = v => JSON.stringify(v, (k, x) => k === 'src' ? undefined : x);

test('walls, placed openings and door decisions match the monolith for every supplied plan', () => {
  assert.ok(plans.length >= 5, 'supplied plans available');
  const a = oracle(), b = modular();
  let openingsSeen = 0;
  const types = new Set();
  for (const u of plans)
    for (const pd of [u.planta.pe_direito || 2.70, 2.50, 3.00]) {
      const ga = a.paredesDaGrade(u.planta.comodos, openings(u.planta), pd);
      const gb = b.paredesDaGrade(u.planta.comodos, openings(u.planta), pd);
      assert.equal(plain(gb), plain(ga), u.id + ' pd ' + pd);
      assert.ok(gb.paredes.length > 0);
      for (let k = 0; k < gb.vaos.length; k++) {
        const da = a.decideVao(u.planta.comodos, ga.vaos[k], pd), db = b.decideVao(u.planta.comodos, gb.vaos[k], pd);
        assert.equal(JSON.stringify(db), JSON.stringify(da), u.id + ' opening ' + k);
        if (db) types.add(db.tipo);
        openingsSeen++;
      }
    }
  assert.ok(openingsSeen > 100, 'openings compared: ' + openingsSeen);
  assert.ok(types.size >= 3, 'door types exercised: ' + [...types]);
});
