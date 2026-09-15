// Oracle: walking collision, clearance, line of sight and the entry pose as they were in the monolith
// at a fixed commit (needs local Git history), over real supplied plans with doors and furniture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = 'b976291';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const base = new URL('../plantas_fornecidas/', import.meta.url);
const units = fs.readdirSync(base).filter(d => fs.existsSync(new URL(`${d}/unidade.json`, base))).map(d => {
  const u = JSON.parse(fs.readFileSync(new URL(`${d}/unidade.json`, base), 'utf8'));
  const auto = new URL(`${d}/moveis.auto.json`, base);
  if (u.planta && !(u.planta.moveis || []).length && fs.existsSync(auto))
    u.planta.moveis = JSON.parse(fs.readFileSync(auto, 'utf8')).moveis || [];
  return u;
}).filter(u => u.planta && (u.planta.comodos || []).length);

const SETUP = `const {inside, shoelace, safeInset, obbOf} = MapGeometry;
  const PD = 2.70, ESP = 0.13, RAIO = 0.30, OLHO = 1.62;
  const MOVEIS = {cama:{b:[1.45,0.95,2.05],cor:1}, sofa:{b:[1.96,0.8,0.92],cor:1}, mesa:{b:[1.4,0.76,0.85],cor:1},
    armario:{b:[1.2,2.1,0.58],cor:1}, pia:{b:[1.3,0.92,0.6],cor:1}, vaso:{b:[0.4,0.8,0.66],cor:1},
    geladeira:{b:[0.68,1.78,0.68],cor:1}, fogao:{b:[0.62,0.92,0.62],cor:1}, tv:{b:[1.15,0.78,0.26],cor:1,alto:1},
    cadeira:{b:[0.46,0.92,0.48],cor:1}, aereo:{b:[1.2,2.2,0.35],cor:1,alto:1}, cortina:{b:[1.9,2.4,0.12],cor:1,alto:1},
    tapete:{b:[2.2,0.02,1.6],cor:1}, criado:{b:[0.45,0.55,0.4],cor:1}, estante:{b:[0.95,1.85,0.34],cor:1},
    guardaroupa:{b:[2,2.35,0.6],cor:1}, box:{b:[0.8,2,0.8],cor:1,alto:1}, maquina:{b:[0.6,0.85,0.65],cor:1},
    balcao:{b:[1,0.92,0.6],cor:1}, coifa:{b:[0.6,2.7,0.5],cor:1,alto:1}, ripado:{b:[2.4,2.4,0.05],cor:1,alto:1},
    rack:{b:[1.8,0.7,0.38],cor:1,alto:1}};
  const _c = new THREE.Color();
  const rgbDe = hex => { _c.setHex(hex); return [Math.round(_c.r*255), Math.round(_c.g*255), Math.round(_c.b*255)]; };
  const mats = {};
  const {ESQ_ANG, ESQ_MARCO, geoDasEsquadrias} = Openings.create({THREE, ESP, rgbDe, matEsq: mats, matAlum: mats, matVidro: mats});
  const {plantaDaUnidade, dentroDaPlanta} = FloorPlan.create({inside, shoelace, ESP, ESQ_ANG, ESQ_MARCO, safeInset, obbOf,
    BUILDING_INSET: 1.0, PD, anelDoLote: () => null, MOVEIS});
  const INT = { pl: null, moveis: [] };
  globalThis.__entra = u => {
    INT.pl = plantaDaUnidade({r: [[-12,-9],[14,-9],[14,11],[-12,11]], h: 30}, u);
    geoDasEsquadrias(INT.pl);                // sets v.folha, which blocks the walk
    INT.moveis = INT.pl.moveis;
    return INT.pl;
  };`;
function context() {
  const ctx = vm.createContext({location: {search: ''}, URLSearchParams});
  for (const f of ['lib/three.min.js', 'core/geometry.js', 'interior/floor-plan.js', 'interior/openings.js']) vm.runInContext(read(f), ctx);
  return ctx;
}
function oracle() {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const cut = (a, b) => { const i = app.indexOf(a), j = app.indexOf(b, i); assert.ok(i > 0 && j > i, a); return app.slice(i, j); };
  const ctx = context();
  vm.runInContext(`(() => { ${SETUP}
    ${cut('function folga(x, z) {', '// A unidade fornecida mora num ANDAR')}
    ${cut('function paraUV(x, z) {', '/* ---- painel ----')}
    globalThis.__o = {folga, livre, comodoDeEntrada, visivel, melhorDirecao, pontoDeEntrada}; })();`, ctx);
  return ctx;
}
function modular() {
  const ctx = context();
  vm.runInContext(read('interior/navigation.js'), ctx);
  vm.runInContext(`(() => { ${SETUP}
    function paraUV(x, z) { const ob = INT.pl.ob, dx = x - ob.cx, dz = z - ob.cz; return [dx*ob.ux + dz*ob.uz, -dx*ob.uz + dz*ob.ux]; }
    globalThis.__o = InteriorNavigation.create({INT, dentroDaPlanta, paraUV, MOVEIS, ESP, RAIO, OLHO}); })();`, ctx);
  return ctx;
}

test('walkability, clearance, sight lines and entry pose match the monolith for every supplied plan', () => {
  assert.ok(units.length >= 5);
  const a = oracle(), b = modular();
  let samples = 0, walkable = 0;
  for (const u of units) {
    const pa = a.__entra(u), pb = b.__entra(u);
    assert.equal(b.__o.comodoDeEntrada(pb).nome, a.__o.comodoDeEntrada(pa).nome);
    const ea = a.__o.pontoDeEntrada(pa), eb = b.__o.pontoDeEntrada(pb);
    assert.equal(JSON.stringify(eb), JSON.stringify(ea), u.id + ' entry');
    assert.equal(b.__o.melhorDirecao(eb[0], eb[1]), a.__o.melhorDirecao(ea[0], ea[1]), u.id + ' yaw');
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const c of pb.contorno) for (const p of c) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    for (let x = x0 - 0.5; x <= x1 + 0.5; x += 0.37)
      for (let z = z0 - 0.5; z <= z1 + 0.5; z += 0.37) {
        const la = a.__o.livre(x, z), lb = b.__o.livre(x, z);
        assert.equal(lb, la, `${u.id} livre ${x},${z}`);
        assert.equal(b.__o.visivel(x, z), a.__o.visivel(x, z));
        assert.equal(b.__o.folga(x, z), a.__o.folga(x, z));
        samples++; walkable += lb ? 1 : 0;
      }
  }
  assert.ok(samples > 1000 && walkable > 100 && walkable < samples, `${walkable} walkable of ${samples}`);
});
