// Oracle: light-atlas texture and piece addressing as they were in the monolith at a fixed commit (needs local Git history).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '8a3ad9a';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const three = fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/lib/three.min.js', import.meta.url), 'utf8');

// Two walls (one with skirting), two rooms, one ceiling outline -> 10 + 5 + 2 + 1 = 18 pieces.
const plan = {id: 'u1', paredes: [{y0: 0.02}, {y0: 1.0}], comodos: [{}, {}], contorno: [[]]};
const atlas = {u1: {atlas: 512, png: 'data:image/png;base64,AA==', escala: 1.4,
  rects: Array.from({length: 18}, (_, k) => [k * 10, k * 5, 8, 4])},
  curto: {atlas: 256, rects: [[0, 0, 1, 1]]}};

function context(search) {
  const warnings = [], images = [];
  class Image { constructor() { images.push(this); } }
  const ctx = vm.createContext({URLSearchParams, Image, location: {search},
    console: {warn: m => warnings.push(m)},
    document: {getElementById: id => id === '__luzue' ? {textContent: JSON.stringify(atlas)} : null}});
  vm.runInContext(three, ctx);
  ctx.__dirty = 0;
  return {ctx, warnings, images};
}
function oracle(search) {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('const _LUZUE = (() => {'), j = app.indexOf('const _UNIDADES', i);
  assert.ok(i > 0 && j > i);
  const c = context(search);
  vm.runInContext(`(() => { const sujaSombra = () => globalThis.__dirty++; ${app.slice(i, j)}
    globalThis.__o = {_LUZUE, texturaDeLuz, cursorDeLuz}; })();`, c.ctx);
  return {...c, api: c.ctx.__o};
}
function modular(search) {
  const c = context(search);
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/interior/light-atlas.js', import.meta.url), 'utf8'), c.ctx);
  c.api = vm.runInContext('LightAtlas.create({THREE, document, sujaSombra: () => globalThis.__dirty++})', c.ctx);
  return c;
}
const addresses = cur => cur && JSON.stringify({total: cur.total,
  parede: [0, 1].map(i => [0, 1, 2, 3, 4].map(f => cur.parede(i, f)(0.25, 0.75))),
  rodape: [0, 1, 2, 3, 4].map(f => cur.rodape(0, f)(1, 0)), piso: [0, 1].map(i => cur.piso(i)(0.5, 0.5)),
  teto: cur.teto(0)(0, 1), fora: cur.rodape(1, 4)});

test('atlas addressing, mode switch, size mismatch and lightmap texture match the monolith', () => {
  for (const search of ['', '?luz=js', '?luz=ue']) {
    const a = oracle(search), b = modular(search);
    assert.equal(addresses(b.api.cursorDeLuz(plan)), addresses(a.api.cursorDeLuz(plan)), search);
    assert.equal(b.api.cursorDeLuz({...plan, id: 'curto'}), a.api.cursorDeLuz({...plan, id: 'curto'}));
    assert.equal(b.api.cursorDeLuz(null), null);
    assert.equal(JSON.stringify(b.warnings), JSON.stringify(a.warnings));
    const ta = a.api.texturaDeLuz('u1'), tb = b.api.texturaDeLuz('u1');
    const props = t => [t.flipY, t.channel, t.colorSpace, t.minFilter, t.magFilter, t.generateMipmaps, t.wrapS, t.wrapT, t.image.src];
    assert.equal(JSON.stringify(props(tb)), JSON.stringify(props(ta)));
    assert.equal(b.api.texturaDeLuz('u1'), tb, 'cached per unit');
    assert.equal(b.api.texturaDeLuz('sem'), null);
    b.images[0].onload(); a.images[0].onload();
    assert.equal(b.ctx.__dirty, a.ctx.__dirty);
    assert.equal(b.api._LUZUE.u1.escala, 1.4);
  }
  assert.ok(modular('?luz=ue').api.cursorDeLuz(plan), 'ue mode resolves the atlas');
  assert.equal(modular('?luz=ue').warnings.length, 0);
  const warned = modular('?luz=ue'); warned.api.cursorDeLuz({...plan, id: 'curto'});
  assert.equal(warned.warnings.length, 1);
});
