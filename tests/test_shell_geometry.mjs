// Oracle: wall prism and segment quad as they were in the monolith at a fixed commit (needs local Git history).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '5c5fac0';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');

function oracle() {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('function prismaQuad('), j = app.indexOf('/* ---- esquadria: batente', i);
  assert.ok(i > 0 && j > i);
  const ctx = vm.createContext({});
  vm.runInContext(app.slice(i, j) + '\nglobalThis.__o = {prismaQuad, quadDoSeg};', ctx);
  return ctx.__o;
}
function modular() {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/interior/shell-geometry.js', import.meta.url), 'utf8'), ctx);
  return ctx.ShellGeometry;
}

test('wall prism faces, gradient, light-atlas UVs, capless skirting and end masks match the monolith', () => {
  const a = oracle(), b = modular();
  const segs = [[[0, 0], [4, 0]], [[1.2, -3], [1.2, 2.5]], [[-2, 1], [3.5, 4.25]], [[5, 5], [5, 5]]];
  const fy = y => 0.76 + 0.1 * y;
  const pecas = [0, 1, 2, 3, 4].map(f => (u, v) => [f + u * 0.5, v * 0.25]);
  let runs = 0;
  for (const seg of segs)
    for (const esp of [0.13, 0.162]) {
      assert.equal(JSON.stringify(b.quadDoSeg(seg, esp)), JSON.stringify(a.quadDoSeg(seg, esp)));
      const q = a.quadDoSeg(seg, esp);
      for (const [y0, y1] of [[0.02, 2.76], [0.02, 0.115], [2.1, 2.7], [1, 1]])
        for (const grad of [null, fy])
          for (const atlas of [false, true])
            for (const semTampa of [false, true])
              for (const semPontas of [0, 1, 2, 3])
                for (const fPonta of [undefined, 0.8]) {
                  const out = () => [[], [], [], [], atlas ? [] : null];
                  const oa = out(), ob = out();
                  a.prismaQuad(oa[0], oa[1], oa[2], oa[3], q, y0, y1, [217, 212, 203], grad, oa[4], atlas ? pecas : null, semTampa, semPontas, fPonta);
                  b.prismaQuad(ob[0], ob[1], ob[2], ob[3], q, y0, y1, [217, 212, 203], grad, ob[4], atlas ? pecas : null, semTampa, semPontas, fPonta);
                  assert.equal(JSON.stringify(ob), JSON.stringify(oa));
                  runs++;
                }
    }
  assert.equal(runs, 8 * 4 * 2 * 2 * 2 * 4 * 2);
});
