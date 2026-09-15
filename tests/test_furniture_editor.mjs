// Oracle: furniture editor rules (grid snap, placement fit, local axis in plan space, one-sided resize)
// as they were in the monolith at a fixed commit (needs local Git history).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '951e5a8';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const base = new URL('../plantas_fornecidas/', import.meta.url);
const unit = JSON.parse(fs.readFileSync(new URL('monte-das-colinas-39/unidade.json', base), 'utf8'));
unit.planta.moveis = JSON.parse(fs.readFileSync(new URL('monte-das-colinas-39/moveis.auto.json', base), 'utf8')).moveis;

const SETUP = `const {inside, shoelace, safeInset, obbOf} = MapGeometry;
  const ESP = 0.13, PD = 2.70;
  const MOVEIS = {cama:{b:[1.45,0.95,2.05]}, sofa:{b:[1.96,0.8,0.92]}, armario:{b:[1.2,2.1,0.58]}, geladeira:{b:[0.68,1.78,0.68]},
    fogao:{b:[0.62,0.92,0.62]}, pia:{b:[1.3,0.92,0.6]}, coifa:{b:[0.6,2.7,0.5], alto:1}, aereo:{b:[1.2,2.2,0.35], alto:1},
    tapete:{b:[2.2,0.02,1.6]}, mesa:{b:[1.4,0.76,0.85]}, cadeira:{b:[0.46,0.92,0.48]}, tv:{b:[1.15,0.78,0.26], alto:1},
    rack:{b:[1.8,0.7,0.38], alto:1}, ripado:{b:[2.4,2.4,0.05], alto:1}, criado:{b:[0.45,0.55,0.4]}, vaso:{b:[0.4,0.8,0.66]},
    box:{b:[0.8,2,0.8], alto:1}, maquina:{b:[0.6,0.85,0.65]}, cortina:{b:[1.9,2.4,0.12], alto:1}, guardaroupa:{b:[2,2.35,0.6]},
    estante:{b:[0.95,1.85,0.34]}, balcao:{b:[1,0.92,0.6]}};
  const fp = FloorPlan.create({inside, shoelace, ESP, ESQ_ANG: 78*Math.PI/180, ESQ_MARCO: 0.03, safeInset, obbOf,
    BUILDING_INSET: 1.0, PD, anelDoLote: () => null, MOVEIS});
  const {dentroDaPlanta} = fp;
  const INT = {pl: fp.plantaDaUnidade({r: [[-12,-9],[14,-9],[14,11],[-12,11]], h: 30}, globalThis.__unit), moveis: [], sel: 0};
  INT.moveis = INT.pl.moveis;
  const MOB = {passo: 0.10};
  const calls = [];
  const atualizaMovel = m => { calls.push(['atualiza', m.tipo, m.u, m.v, m.w, m.d, m.h]);
    const p = INT.pl.W(m.u, m.v); m.obj.position.set(p[0], 0.03, p[1]);
    m.obj.rotation.y = Math.atan2(-INT.pl.ob.uz, INT.pl.ob.ux) + m.rot * Math.PI/2; };
  function seleciona(i) { calls.push(['seleciona', i]); }
  function salvaMoveis() { calls.push(['salva']); }
  function paraUV(x, z) { const ob = INT.pl.ob, dx = x - ob.cx, dz = z - ob.cz; return [dx*ob.ux + dz*ob.uz, -dx*ob.uz + dz*ob.ux]; }
  for (const m of INT.moveis) { m.obj = new THREE.Object3D(); atualizaMovel(m); }
  globalThis.__st = {INT, calls};`;
function context() {
  const ctx = vm.createContext({location: {search: ''}, URLSearchParams, __unit: unit});
  for (const f of ['lib/three.min.js', 'core/geometry.js', 'interior/floor-plan.js']) vm.runInContext(read(f), ctx);
  return ctx;
}
function oracle() {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const cut = (a, b) => { const i = app.indexOf(a), j = app.indexOf(b, i); assert.ok(i > 0 && j > i, a); return app.slice(i, j); };
  const ctx = context();
  vm.runInContext(`(() => { ${SETUP}
    ${cut('const arred = v =>', '\n')}
    ${cut('const _mobEul = new THREE.Euler()', '/* ---- o fantasma')}
    ${cut('const MEIA_PAREDE = ESP/2;', '/* ---- campos de medida')}
    globalThis.__o = {arred, dirUV, redimensiona, cabeAqui}; })();`, ctx);
  return ctx;
}
function modular() {
  const ctx = context();
  vm.runInContext(read('interior/furniture-editor.js'), ctx);
  vm.runInContext(`(() => { ${SETUP}
    globalThis.__o = FurnitureEditor.create({THREE, INT, MOB, MOVEIS, ESP, dentroDaPlanta, paraUV, atualizaMovel, seleciona, salvaMoveis}); })();`, ctx);
  return ctx;
}
function run(ctx) {
  const {INT, calls} = ctx.__st, P = ctx.__o, out = [];
  out.push([-0.149, -0.05, 0.051, 1.2345, 2.96].map(P.arred));
  const f = INT.pl.ob;
  for (const m of INT.moveis) {
    for (let u = -f.hu - 0.5; u <= f.hu + 0.5; u += 0.45)
      for (let v = -f.hv - 0.5; v <= f.hv + 0.5; v += 0.45) out.push(P.cabeAqui(m, u, v) ? 1 : 0);
    for (const [lx, lz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) out.push(P.dirUV(m, lx, lz).map(x => +x.toFixed(12)));
  }
  for (let i = 0; i < INT.moveis.length; i++) {
    const m = INT.moveis[i]; INT.sel = i;
    for (const [k, novo, s] of [['w', m.w + 0.4, 1], ['w', m.w - 0.2, -1], ['d', 9, 1], ['h', 0.01, 1], ['d', 0.05, -1]]) {
      P.redimensiona(m, k, novo, s);
      out.push([m.u, m.v, m.w, m.d, m.h]);
    }
  }
  out.push(calls);
  return JSON.stringify(out);
}

test('grid snap, placement fit, plan-space axis and one-sided resize match the monolith', () => {
  const a = oracle(), b = modular();
  const ra = run(a), rb = run(b);
  assert.equal(rb, ra);
  const fits = JSON.parse(rb).filter(x => x === 0 || x === 1);
  assert.ok(fits.includes(0) && fits.includes(1), 'both fitting and blocked positions sampled');
});
