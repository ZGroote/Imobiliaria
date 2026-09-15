// Oracle: the same builders as they were in the monolith at a fixed commit (needs local Git history).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '5d1d7e9';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const read = name => fs.readFileSync(new URL('../renderizador-v16-moveis/' + name, import.meta.url), 'utf8');
const lib = JSON.parse(fs.readFileSync(new URL('../moveis/moveis_lib.json', import.meta.url), 'utf8'));
const pecas = lib.pecas || lib;
const NAMES = ['armarioParam','bancadaParam','aereoParam','ripadoParam','rackParam','tvParam','boxParam','maquinaParam','sofaParam'];

function context() {
  const ctx = vm.createContext({});
  vm.runInContext(read('lib/three.min.js'), ctx);
  vm.runInContext(`const _c = new THREE.Color();
    globalThis.rgbDe = hex => { _c.setHex(hex); return [Math.round(_c.r*255), Math.round(_c.g*255), Math.round(_c.b*255)]; };`, ctx);
  ctx.MOVEIS_LIB = pecas;
  return ctx;
}
function oracle() {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const start = app.indexOf('const B = (x, y, z, w, h, d, c)'), end = app.indexOf('const _cor = new THREE.Color();');
  assert.ok(start > 0 && end > start);
  const ctx = context();
  vm.runInContext(app.slice(start, end) + '\nglobalThis.__o = {geoDeParts, ' + NAMES.join(', ') + '};', ctx);
  return ctx.__o;
}
function modular() {
  const ctx = context();
  vm.runInContext(read('interior/furniture-param.js'), ctx);
  return vm.runInContext('FurnitureParam.create({THREE, getLib: () => MOVEIS_LIB, rgbDe})', ctx);
}

test('parametric part lists and merged buffers match the monolith across measures', () => {
  const a = oracle(), b = modular();
  let cases = 0;
  for (const name of NAMES)
    for (const w of [0.3, 0.6, 0.95, 1.3, 2.0, 2.6, 3.2])
      for (const h of [0.5, 0.9, 1.8, 2.35, 2.7])
        for (const d of [0.3, 0.5, 0.6, 0.9])
          for (const tipo of ['pia', 'balcao']) {
            const m = {tipo, w, h, d};
            const pa = a[name](m), pb = b[name](m);
            assert.equal(JSON.stringify(pb), JSON.stringify(pa), name + ' ' + JSON.stringify(m));
            if (w === 1.3 || w === 3.2) for (const cor of [0x4A5A6B, 0xE8E4DC]) {
              const ga = a.geoDeParts(pa, cor), gb = b.geoDeParts(pb, cor);
              for (const k of ['position', 'normal', 'color'])
                assert.ok(Buffer.from(gb.attributes[k].array.buffer).equals(Buffer.from(ga.attributes[k].array.buffer)), name + ' ' + k);
              assert.equal(gb.boundingSphere.radius, ga.boundingSphere.radius);
            }
            cases++;
          }
  assert.equal(cases, NAMES.length * 280);
  assert.ok(b.sofaParam({w: 3.2, h: 0.8, d: 0.9}).length > 2, 'sofa uses the real library modules');
});
