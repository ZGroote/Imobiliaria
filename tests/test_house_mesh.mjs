// Oracle: geoDaCasa as it was in the monolith at a fixed commit (needs local Git history), fed by
// the already-verified bake, light-atlas, shell and openings modules, over real supplied plans.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = 'e10cf9c';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const base = new URL('../plantas_fornecidas/', import.meta.url);
const units = ['monte-das-colinas-39', 'wish-castanheiras-58']
  .map(d => JSON.parse(fs.readFileSync(new URL(`${d}/unidade.json`, base), 'utf8')));

const DEPS = `const {inside, shoelace, safeInset, obbOf} = MapGeometry;
  const PD = 2.70, ESP = 0.13, V2 = THREE.Vector2;
  const triangulateRing = r => MapGeometry.triangulateRing(r, null,
    ring => THREE.ShapeUtils.triangulateShape(ring.map(p => new V2(p[0], p[1])), []));
  const _cor = new THREE.Color(), _hsl = {h:0, s:0, l:0};
  const rgbDe = hex => { _cor.setHex(hex); return [Math.round(_cor.r*255), Math.round(_cor.g*255), Math.round(_cor.b*255)]; };
  const rgbAcabamento = hex => { _cor.setHex(hex); _cor.getHSL(_hsl); _cor.setHSL(_hsl.h, Math.min(1, _hsl.s * 1.55), _hsl.l);
    return [Math.round(_cor.r*255), Math.round(_cor.g*255), Math.round(_cor.b*255)]; };
  const mat = n => Object.assign(new THREE.MeshStandardMaterial(), {name: n});
  const matParede = mat('parede'), matFrio = mat('frio'), matMadeira = mat('madeira'),
        matEsq = mat('esq'), matAlum = mat('alum'), matVidro = mat('vidro');
  const {_LUZUE, texturaDeLuz, cursorDeLuz} = LightAtlas.create({THREE, document, sujaSombra: () => {}});
  const {BAKE, bakePrepara, bakeAgora} = LightBake.create({inside, PD});
  const {ESQ_ANG, ESQ_MARCO, geoDasEsquadrias} = Openings.create({THREE, ESP, rgbDe, matEsq, matAlum, matVidro});
  const fp = FloorPlan.create({inside, shoelace, ESP, ESQ_ANG, ESQ_MARCO, safeInset, obbOf, BUILDING_INSET: 1.0, PD,
    anelDoLote: () => null, MOVEIS: {}});
  globalThis.__planta = u => fp.plantaDaUnidade({r: [[-12,-9],[14,-9],[14,11],[-12,11]], h: 30}, u);
  globalThis.__bake = {BAKE, bakeAgora};`;
function context(search) {
  const ctx = vm.createContext({location: {search}, URLSearchParams, performance, Image: class {},
    console, document: {getElementById: () => ({textContent: '{}'})}});
  for (const f of ['lib/three.min.js', 'core/geometry.js', 'interior/floor-plan.js', 'interior/shell-geometry.js',
                   'interior/openings.js', 'interior/light-atlas.js', 'interior/bake.js']) vm.runInContext(read(f), ctx);
  return ctx;
}
function oracle(search) {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('function geoDaCasa('), j = app.indexOf('/* ---- estado ----', i);
  assert.ok(i > 0 && j > i);
  const ctx = context(search);
  vm.runInContext(`(() => { const {prismaQuad, quadDoSeg} = ShellGeometry; ${DEPS}
    ${app.slice(i, j)}
    globalThis.__geo = geoDaCasa; })();`, ctx);
  return ctx;
}
function modular(search) {
  const ctx = context(search);
  vm.runInContext(read('interior/house-mesh.js'), ctx);
  vm.runInContext(`(() => { const {prismaQuad, quadDoSeg} = ShellGeometry; ${DEPS}
    globalThis.__geo = HouseMesh.create({THREE, ESP, rgbAcabamento, triangulateRing, prismaQuad, quadDoSeg,
      cursorDeLuz, texturaDeLuz, _LUZUE, BAKE, bakePrepara, matParede, matFrio, matMadeira, geoDasEsquadrias}).geoDaCasa; })();`, ctx);
  return ctx;
}
const group = g => JSON.stringify(g.children.map(m => ({mat: m.material.name, cast: m.castShadow, receive: m.receiveShadow,
  order: m.renderOrder, casa: m.userData.casa, attrs: Object.fromEntries(Object.entries(m.geometry.attributes).map(([k, a]) =>
    [k, [a.count, a.normalized, Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength).toString('base64')]]))})));

test('house walls, skirting, floors, ceiling, bake queue and cache match the monolith', () => {
  for (const search of ['', '?bake=0'])
    for (const u of units)
      for (const comTeto of [true, false]) {
        const a = oracle(search), b = modular(search);
        const pa = a.__planta(u), pb = b.__planta(u);
        const ga = a.__geo(pa, comTeto), gb = b.__geo(pb, comTeto);
        assert.equal(group(gb), group(ga), `${u.id} teto=${comTeto} ${search}`);
        assert.equal(!!b.__bake.BAKE.fila, !!a.__bake.BAKE.fila);
        assert.equal(!!b.__bake.BAKE.fila, search === '');
        b.__bake.bakeAgora(); a.__bake.bakeAgora();
        assert.equal(group(gb), group(ga), `${u.id} baked`);
        // Re-entering the same unit takes the cached bake immediately.
        const ca = a.__geo(pa, comTeto), cb = b.__geo(pb, comTeto);
        assert.equal(group(cb), group(ca), `${u.id} cached`);
        assert.equal(b.__bake.BAKE.fila === null || b.__bake.BAKE.fila === undefined, a.__bake.BAKE.fila === null || a.__bake.BAKE.fila === undefined);
      }
});

test('rendered surviving wall reaches the perpendicular face on either end', () => {
  for (const side of ['remateA','remateB']) {
    const ctx=modular('?bake=0');
    const w={a:[0,0],b:[2,0],y0:.02,y1:2.6,pa:1,pb:1,[side]:.065};
    const pl={id:'closure-fixture',pd:2.6,ob:{cx:0,cz:0,ux:1,uz:0},paredes:[w],comodos:[],contorno:[],esquadrias:[]};
    const g=ctx.__geo(pl,false);const a=g.children[0].geometry.attributes.position;
    const xs=[];for(let i=0;i<a.count;i++){assert.ok(Number.isFinite(a.getX(i)));xs.push(a.getX(i));}
    assert.ok(Math.abs(Math.min(...xs)-(side==='remateA'?-.065:0))<1e-6);
    assert.ok(Math.abs(Math.max(...xs)-(side==='remateB'?2.065:2))<1e-6);
    assert.deepEqual(w.a,[0,0]);assert.deepEqual(w.b,[2,0]);
  }
});
