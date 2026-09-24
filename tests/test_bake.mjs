// Oracle: the incremental light bake as it was in the monolith at a fixed commit (needs local
// Git history), over real supplied plans: preparation, per-frame tracing and the lit colours.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '8a3ad9a';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const base = new URL('../plantas_fornecidas/', import.meta.url);
const units = ['monte-das-colinas-39', 'sanca-135-29']
  .map(d => JSON.parse(fs.readFileSync(new URL(`${d}/unidade.json`, base), 'utf8')));

// Wall prisms and fan-triangulated floors: enough geometry to exercise tessellation, the ray grid and the key table.
const SCENE = `const {inside, shoelace, safeInset, obbOf} = MapGeometry;
  const PD = 2.70, ESP = 0.13;
  const fp = FloorPlan.create({inside, shoelace, ESP, ESQ_ANG: 78*Math.PI/180, ESQ_MARCO: 0.03, safeInset, obbOf,
    BUILDING_INSET: 1.0, PD, anelDoLote: () => null, MOVEIS: {}});
  globalThis.__grupos = pl => {
    const par = [[], [], [], []], frio = [[], [], [], []], mad = [[], [], [], []];
    for (const w of pl.paredes)
      ShellGeometry.prismaQuad(par[0], par[1], par[2], par[3], ShellGeometry.quadDoSeg([w.a, w.b], ESP), w.y0, w.y1, [217, 212, 203]);
    pl.comodos.forEach((c, i) => {
      const d = i % 2 ? mad : frio;
      for (let k = 1; k + 1 < c.poly.length; k++)
        for (const p of [c.poly[0], c.poly[k + 1], c.poly[k]]) {
          d[0].push(p[0], 0.02, p[1]); d[1].push(0, 1, 0); d[2].push(200, 190, 180); d[3].push(p[0], p[1]);
        }
    });
    return [par, frio, mad];
  };
  globalThis.__planta = u => fp.plantaDaUnidade({r: [[-12,-9],[14,-9],[14,11],[-12,11]], h: 30}, u);`;
function context(search) {
  const ctx = vm.createContext({location: {search}, URLSearchParams, performance});
  for (const f of ['core/geometry.js', 'interior/floor-plan.js', 'interior/shell-geometry.js']) vm.runInContext(read(f), ctx);
  vm.runInContext(SCENE, ctx);
  return ctx;
}
function oracle(search) {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('const BAKE = {'), j = app.indexOf('function geoDaCasa(', i);
  assert.ok(i > 0 && j > i);
  const ctx = context(search);
  vm.runInContext(`(() => { const {inside} = MapGeometry; const PD = 2.70;
    ${app.slice(i, j)}
    globalThis.__o = {BAKE, cenaDoBake, bakeRaio, bakePrepara, bakePasso, bakeAgora}; })();`, ctx);
  return ctx;
}
function modular(search) {
  const ctx = context(search);
  vm.runInContext(read('interior/bake.js'), ctx);
  vm.runInContext('globalThis.__o = LightBake.create({inside: MapGeometry.inside, PD: 2.70});', ctx);
  return ctx;
}
const stable = B => JSON.stringify({on: B.on, pronto: B.pronto, unicos: B.unicos, vertices: B.vertices, tris: B.tris,
  med: B.med, k: B.k, cache: [...B.cache.keys()]});
const buf = t => t && ['P', 'N', 'C', 'U'].map(k => Buffer.from(new Float64Array(t[k]).buffer).toString('base64'));

test('bake scene, ray hits, incremental passes and lit colours match the monolith', () => {
  for (const u of units) {
    const a = oracle(''), b = modular('');
    const pa = a.__planta(u), pb = b.__planta(u);
    const Sa = a.__o.cenaDoBake(pa), Sb = b.__o.cenaDoBake(pb);
    assert.equal(JSON.stringify({...Sb, loc: 0, gira: 0}), JSON.stringify({...Sa, loc: 0, gira: 0}), u.id + ' scene');
    for (const r of [[0, 1.2, 0, 1, 0.1, 0], [0.5, 1.5, -0.3, -0.7, -0.4, 0.6], [1, 2.6, 1, 0, 1, 0], [0, 0.5, 0, 0.3, -0.9, 0.3]])
      assert.equal(b.__o.bakeRaio(Sb, ...r), a.__o.bakeRaio(Sa, ...r));
    const ca = a.__o.bakePrepara(pa, a.__grupos(pa)), cb = b.__o.bakePrepara(pb, b.__grupos(pb));
    assert.equal(cb.nu, ca.nu); assert.ok(cb.nu > 500, u.id + ' vertices ' + cb.nu);
    assert.deepEqual([...cb.pos], [...ca.pos]); assert.deepEqual([...cb.nrm], [...ca.nrm]);
    // Incremental: a tiny budget leaves the context unfinished; later passes finish it.
    assert.equal(b.__o.bakePasso(cb, 0), false); a.__o.bakePasso(ca, 0);
    ca.ch = cb.ch = u.id + '|1';
    b.__o.BAKE.fila = cb; a.__o.BAKE.fila = ca;
    assert.equal(b.__o.bakeAgora(), true); assert.equal(a.__o.bakeAgora(), true);
    assert.equal(b.__o.bakeAgora(), false);
    assert.equal(JSON.stringify(cb.malhas.map(buf)), JSON.stringify(ca.malhas.map(buf)), u.id + ' lit colours');
    assert.equal(stable(b.__o.BAKE), stable(a.__o.BAKE));
    assert.equal(b.__o.BAKE.pronto, true);
  }
  assert.equal(modular('?bake=0').__o.BAKE.on, false);
  assert.equal(modular('').__o.BAKE.on, true);
});
