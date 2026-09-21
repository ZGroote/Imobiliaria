// Oracle: painted sky texture and dome as they were in the monolith at a fixed commit (needs local Git history).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '81b9c37';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const three = fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/lib/three.min.js', import.meta.url), 'utf8');
const HASH = `const hash = id => { let h = 2166136261 ^ id; h = Math.imul(h ^ (h>>>15), 2246822507);
  h = Math.imul(h ^ (h>>>13), 3266489909); return ((h ^ (h>>>16))>>>0) / 4294967296; };`;

// A 2D context that records every call and assignment, rounded so both sides compare exactly.
function context(ceuTex) {
  const log = [];
  const r = v => typeof v === 'number' ? +v.toFixed(9) : v;
  const grad = name => ({addColorStop: (o, c) => log.push([name + '.stop', r(o), c])});
  const g = new Proxy({}, {
    get: (o, k) => k === 'createLinearGradient' ? (...a) => { log.push(['linear', ...a.map(r)]); return grad('lin'); }
      : k === 'createRadialGradient' ? (...a) => { log.push(['radial', ...a.map(r)]); return grad('rad'); }
      : (...a) => log.push([k, ...a.map(r)]),
    set: (o, k, v) => { log.push(['=' + String(k), typeof v === 'object' ? 'gradient' : v]); return true; }});
  const canvas = {getContext: () => g};
  const ctx = vm.createContext({document: {createElement: () => canvas}, __nivel: {ceuTex}, __log: log});
  vm.runInContext(three, ctx);
  vm.runInContext('globalThis.__scene = new THREE.Scene();', ctx);
  return ctx;
}
function oracle(ceuTex) {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('/* ---- céu de dentro de casa'), j = app.indexOf('/* `linearDe` NAO SERVE MAIS', i);
  assert.ok(i > 0 && j > i);
  const ctx = context(ceuTex);
  vm.runInContext(`(() => { const NIVEL = __nivel, scene = __scene; ${HASH} ${app.slice(i, j)}
    globalThis.__o = {CEU_LINHA, CEU}; })();`, ctx);
  return ctx;
}
function modular(ceuTex) {
  const ctx = context(ceuTex);
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/scene/sky.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(`(() => { ${HASH} globalThis.__o = SkyDome.create({THREE, document, scene: __scene, NIVEL: __nivel, hash}); })();`, ctx);
  return ctx;
}
const dome = ctx => {
  const c = ctx.__o.CEU, m = c.material, t = m.map;
  return JSON.stringify({linha: ctx.__o.CEU_LINHA, inScene: ctx.__scene.children.includes(c), visible: c.visible,
    order: c.renderOrder, culled: c.frustumCulled, geo: c.geometry.parameters,
    mat: [m.side, m.depthWrite, m.depthTest, m.fog, m.toneMapped], tex: [t.wrapS, t.colorSpace, t.encoding, t.anisotropy]});
};

test('sky painting and dome match the monolith', () => {
  for (const ceuTex of [1024, 2048, undefined]) {
    const a = oracle(ceuTex), b = modular(ceuTex);
    assert.equal(JSON.stringify(b.__log), JSON.stringify(a.__log), 'draw calls ' + ceuTex);
    assert.ok(b.__log.length > 1000, 'clouds painted: ' + b.__log.length);
    assert.equal(dome(b), dome(a));
  }
});
