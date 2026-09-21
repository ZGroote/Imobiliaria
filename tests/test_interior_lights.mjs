// Oracle: interior lighting (city light yielding to the window, lamp pool, switches, restore on exit)
// as it was in the monolith at a fixed commit (needs local Git history), on a real supplied plan.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = 'b9bc964';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const base = new URL('../plantas_fornecidas/', import.meta.url);
const units = ['monte-das-colinas-39', 'wish-castanheiras-58']
  .map(d => JSON.parse(fs.readFileSync(new URL(`${d}/unidade.json`, base), 'utf8')));

const SETUP = `const {inside, shoelace, safeInset, obbOf} = MapGeometry;
  const ESP = 0.13, PD = 2.70, LUZ_PI = Math.PI, FILL = 0.5, CEU_LINHA = "#C7D8E4";
  const NIVEL = {somMap: globalThis.__somMap};
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x6B7A88, 10, 100);
  const hemi = new THREE.HemisphereLight(0xC7D6E8, 0x1A222C, 0.8);
  const sun = new THREE.DirectionalLight(0xFFF4E0, 0.95 * LUZ_PI);
  Object.assign(sun.shadow.camera, {left: -640, right: 640, top: 640, bottom: -640, near: 10, far: 3000});
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.4;
  const renderer = {toneMappingExposure: 1.075};
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 1.6, 0);
  const cursorDeLuz = pl => globalThis.__assado ? {} : null;
  const _c = new THREE.Color();
  const rgbDe = hex => { _c.setHex(hex); return [Math.round(_c.r*255), Math.round(_c.g*255), Math.round(_c.b*255)]; };
  const {ESQ_ANG, ESQ_MARCO, geoDasEsquadrias} = Openings.create({THREE, ESP, rgbDe, matEsq: {}, matAlum: {}, matVidro: {}});
  const fp = FloorPlan.create({inside, shoelace, ESP, ESQ_ANG, ESQ_MARCO, safeInset, obbOf, BUILDING_INSET: 1.0, PD,
    anelDoLote: () => null, MOVEIS: {}});
  const INT = { luzes:[], sombra:null, brilho:null, lamps:[], pool:[], chaveLuz:"", plafons:null, chaves:null,
                raiz: new THREE.Group(), baseY: 4.2 };
  globalThis.__st = {INT, scene, sun, hemi, renderer, camera,
    planta: u => fp.plantaDaUnidade({r: [[-12,-9],[14,-9],[14,11],[-12,11]], h: 30}, u)};`;
function context(somMap, assado) {
  const ctx = vm.createContext({location: {search: ''}, URLSearchParams, __somMap: somMap, __assado: assado});
  for (const f of ['lib/three.min.js', 'core/geometry.js', 'interior/floor-plan.js', 'interior/openings.js']) vm.runInContext(read(f), ctx);
  return ctx;
}
function oracle(somMap, assado) {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('const MAX_LUZES = 6;'), j = app.indexOf('function baseDaCasa(pl) {', i);
  assert.ok(i > 0 && j > i);
  const ctx = context(somMap, assado);
  vm.runInContext(`(() => { ${SETUP} ${app.slice(i, j)}
    globalThis.__o = {acendeInterior, apagaInterior, distribuiLuzes, sujaLuzes, alternaLuz, luzDoHit}; })();`, ctx);
  return ctx;
}
function modular(somMap, assado) {
  const ctx = context(somMap, assado);
  vm.runInContext(read('interior/lights.js'), ctx);
  vm.runInContext(`(() => { ${SETUP}
    globalThis.__o = InteriorLights.create({THREE, INT, scene, sun, hemi, renderer, camera, NIVEL, LUZ_PI, FILL,
      cursorDeLuz, CEU_LINHA, inside, ESP}); })();`, ctx);
  return ctx;
}
function state(ctx) {
  const {INT, scene, sun, hemi, renderer} = ctx.__st;
  const buf = a => a ? Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64') : null;
  return JSON.stringify({sun: sun.intensity, exp: renderer.toneMappingExposure, fog: scene.fog.color.toArray(),
    hemi: [hemi.intensity, hemi.color.getHex(), hemi.groundColor.getHex()],
    cam: ['left','right','top','bottom','near','far'].map(k => sun.shadow.camera[k]), bias: [sun.shadow.bias, sun.shadow.normalBias],
    children: scene.children.map(o => [o.type, o.intensity, o.position && o.position.toArray(), o.castShadow,
      o.shadow ? [o.shadow.mapSize.x, o.shadow.camera.near, o.shadow.camera.far, o.shadow.bias, o.shadow.normalBias, o.shadow.autoUpdate, o.shadow.needsUpdate] : null]),
    lamps: INT.lamps.map(L => [L.i, L.on, L.p.toArray()]), key: INT.chaveLuz, pool: INT.pool.length,
    plafons: INT.plafons && [INT.plafons.count, buf(INT.plafons.instanceMatrix.array), buf(INT.plafons.instanceColor && INT.plafons.instanceColor.array)],
    chaves: INT.chaves && [INT.chaves.count, buf(INT.chaves.instanceMatrix.array), buf(INT.chaves.instanceColor && INT.chaves.instanceColor.array), INT.chaves.userData.mapa],
    raiz: INT.raiz.children.length, brilho: !!INT.brilho, sombra: !!INT.sombra});
}
function run(ctx, u) {
  const S = ctx.__st, P = ctx.__o, out = [];
  const pl = S.planta(u);
  P.acendeInterior(pl); out.push(state(ctx));
  P.alternaLuz(0); P.alternaLuz(2); P.alternaLuz(99); out.push(state(ctx));
  S.camera.position.set(pl.comodos[pl.comodos.length - 1].cx, 5.8, pl.comodos[pl.comodos.length - 1].cz);
  for (let k = 0; k < pl.comodos.length; k++) if (k % 2) P.alternaLuz(k);
  P.distribuiLuzes(false); out.push(state(ctx));
  P.sujaLuzes(); out.push(state(ctx));
  out.push(P.luzDoHit({object: {userData: {}}}), P.luzDoHit({object: S.INT.plafons, instanceId: 3}),
    S.INT.chaves ? P.luzDoHit({object: S.INT.chaves, instanceId: 1}) : null);
  P.apagaInterior(); out.push(state(ctx));
  return JSON.stringify(out);
}

test('interior light, lamp pool, switches and restore match the monolith', () => {
  for (const [somMap, assado] of [[2048, false], [1024, false], [2048, true]])
    for (const u of units) {
      const a = oracle(somMap, assado), b = modular(somMap, assado);
      assert.equal(run(b, u), run(a, u), `${u.id} somMap=${somMap} assado=${assado}`);
    }
});
