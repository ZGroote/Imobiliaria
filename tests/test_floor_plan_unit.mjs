// Oracle: plantaDaUnidade as it was in the monolith at a fixed commit (needs local Git history),
// over every supplied plan, both footprint windings and a lot unit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '624a13f';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const git = path => execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':' + path],
  {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
const base = new URL('../plantas_fornecidas/', import.meta.url);
// Same merge montar.py does for automatic furniture.
const units = fs.readdirSync(base).filter(d => fs.existsSync(new URL(`${d}/unidade.json`, base))).map(d => {
  const u = JSON.parse(fs.readFileSync(new URL(`${d}/unidade.json`, base), 'utf8'));
  const auto = new URL(`${d}/moveis.auto.json`, base);
  if (u.planta && !(u.planta.moveis || []).length && u.planta.mobiliar !== false && fs.existsSync(auto))
    u.planta.moveis = JSON.parse(fs.readFileSync(auto, 'utf8')).moveis || [];
  return u;
}).filter(u => u.planta && (u.planta.comodos || []).length);

const PRELUDE = `const {inside, shoelace, safeInset, obbOf} = MapGeometry;
  const ESP = 0.13, ESQ_ANG = 78 * Math.PI/180, ESQ_MARCO = 0.030, PD = 2.70, BUILDING_INSET = 1.0;
  const MOVEIS = {cama:{b:[1.45,0.95,2.05],cor:0x8A7660}, sofa:{b:[1.96,0.80,0.92],cor:0x4A5A6B},
    mesa:{b:[1.40,0.76,0.85],cor:0x9A7A55}, armario:{b:[1.2,2.1,0.58],cor:0x6E5B47}, pia:{b:[1.3,0.92,0.6],cor:0x8E9299},
    vaso:{b:[0.4,0.8,0.66],cor:0xF0F2F4}, geladeira:{b:[0.68,1.78,0.68],cor:0xC6CBD0}, fogao:{b:[0.62,0.92,0.62],cor:0xD3D7DB},
    tv:{b:[1.15,0.78,0.26],cor:0x22262B}, cadeira:{b:[0.46,0.92,0.48],cor:0x7C6A55}};
  const anelDoLote = u => u.lote ? {r:[[-8,-10],[8,-10],[8,10],[-8,10]], h:3} : null;`;
function context() {
  const ctx = vm.createContext({location: {search: ''}, URLSearchParams});
  vm.runInContext(read('core/geometry.js'), ctx);
  return ctx;
}
function oracle() {
  const app = git('renderizador-v16-moveis/app.js');
  const i = app.indexOf('const PISO_HEX = '), j = app.indexOf('/* ---- geometria fixa da casa', i);
  assert.ok(i > 0 && j > i);
  const ctx = context();
  vm.runInContext(git('renderizador-v16-moveis/interior/floor-plan.js'), ctx);
  vm.runInContext(`(() => { ${PRELUDE}
    const {paredesDaGrade, decideVao} = FloorPlan.create({inside, shoelace, ESP, ESQ_ANG, ESQ_MARCO});
    ${app.slice(i, j)}
    globalThis.__o = {plantaDaUnidade, dentroDaPlanta}; })();`, ctx);
  return ctx.__o;
}
function modular() {
  const ctx = context();
  vm.runInContext(read('interior/floor-plan.js'), ctx);
  return vm.runInContext(`(() => { ${PRELUDE}
    return FloorPlan.create({inside, shoelace, ESP, ESQ_ANG, ESQ_MARCO, safeInset, obbOf, BUILDING_INSET, PD, anelDoLote, MOVEIS}); })()`, ctx);
}
// `estilo` (par de malhas do sofá) é posterior ao monólito: o oráculo não o conhece.
const plain = pl => pl && JSON.stringify({...pl, W: [pl.W(1, 2), pl.W(-3.5, 0.25)], unidade: pl.unidade.id,
  moveis: pl.moveis.map(({estilo, ...m}) => m)});

test('unit plan assembly matches the monolith for supplied plans, footprint windings and a lot', () => {
  assert.ok(units.length >= 5);
  const a = oracle(), b = modular();
  const footprints = [
    {r: [[-12,-9],[14,-9],[14,11],[-12,11]], h: 30},          // clockwise in plan view: Overture inset
    {r: [[-12,11],[14,11],[14,-9],[-12,-9]], h: 12},          // other winding: generated inset
    {r: [[0,0],[25,6],[19,30],[-6,24]], h: 21}];              // rotated footprint
  let n = 0;
  for (const u of units) {
    for (const rec of footprints) {
      const pa = a.plantaDaUnidade(rec, u), pb = b.plantaDaUnidade(rec, u);
      assert.equal(plain(pb), plain(pa), u.id);
      for (const [x, z] of [[pb.cx, pb.cz], [pb.cx + 3, pb.cz - 1], [100, 100]])
        assert.equal(b.dentroDaPlanta(pb, x, z), a.dentroDaPlanta(pa, x, z));
      n++;
    }
    const lot = {...u, lote: {lat: -22, lon: -47}};
    assert.equal(plain(b.plantaDaUnidade(null, lot)), plain(a.plantaDaUnidade(null, lot)), u.id + ' lot');
    assert.equal(b.plantaDaUnidade(null, lot).furo.r, 0);
  }
  assert.equal(b.plantaDaUnidade(null, {...units[0], lote: undefined}), null, 'no building and no lot');
  assert.ok(n >= 15 && units.some(u => (u.planta.moveis || []).length), 'furniture from records exercised');
});

test('declared furniture height reaches the maquette without shifting across skipped catalog entries', () => {
  const unit = structuredClone(units[0]);
  unit.planta.moveis = [
    {tipo: 'tipo-desconhecido', p: [0, 0], y: 9, rot: 0},
    {tipo: 'sofa', p: [1, 1], y: 1.15, rot: 3},
    {tipo: 'outro-desconhecido', p: [2, 2], y: 7, rot: 0},
    {tipo: 'tv', p: [3, 3], y: 0, rot: 1},
    {tipo: 'mesa', p: [4, 4], rot: 0},
  ];
  const plan = modular().plantaDaUnidade({r: [[-12,-9],[14,-9],[14,11],[-12,11]], h: 30}, unit);
  assert.deepEqual(Array.from(plan.moveis, m => [m.tipo, m.y]), [['sofa', 1.15], ['tv', 0], ['mesa', undefined]]);
  const page = fs.readFileSync(new URL('../v1.5/miniaturas/pagina_maquete.py', import.meta.url), 'utf8');
  const start = page.indexOf('function montaMoveisDaPlanta(g) {');
  const end = page.indexOf('\nfunction montaMoveis(g)', start);
  assert.ok(start > 0 && end > start);
  const pieces = [];
  const ctx = vm.createContext({
    PL_R: plan, console,
    FURN: {MOVEIS: {sofa: {b: [1, 1, 1]}, tv: {b: [1, 1, 1]}, mesa: {b: [1, 1, 1]}},
      geoDoMovel: () => ({position: {set: (x, y, z) => pieces.push({x, y, z})},
                         rotation: {}, scale: {set() {}}, userData: {}})},
  });
  vm.runInContext(page.slice(start, end), ctx);
  assert.equal(ctx.montaMoveisDaPlanta({add() {}}), 3);
  assert.deepEqual(pieces.map(p => p.y), [1.15, 0, 0.03]);
  assert.equal(unit.planta.moveis[1].y, 1.15, 'source record stays untouched');
});
