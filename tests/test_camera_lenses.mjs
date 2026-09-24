// Oracle: camera planes and interior field of view as they were in the monolith at a fixed commit
// (needs local Git history), for both depth-buffer modes and landscape/portrait screens.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '56f11f6';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');
const NAMES = 'NEAR_CIDADE, NEAR_CASA, FAR_CIDADE, FAR_CASA, FOV_CIDADE, FOV_H_CASA, FOV_H_PLANTA, fovInterior';

function oracle(win) {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('const NEAR_CIDADE = 2'), j = app.indexOf('const target = new THREE.Vector3();', i);
  assert.ok(i > 0 && j > i);
  const ctx = vm.createContext(win);
  vm.runInContext(`(() => { const NIVEL = __nivel; ${app.slice(i, j)} globalThis.__o = {${NAMES}}; })();`, ctx);
  return ctx.__o;
}
function modular(win) {
  const ctx = vm.createContext(win);
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/scene/camera-lenses.js', import.meta.url), 'utf8'), ctx);
  return vm.runInContext('CameraLenses.create({NIVEL: __nivel})', ctx);
}

test('near/far planes and interior field of view match the monolith', () => {
  let n = 0;
  for (const logdepth of [true, false])
    for (const [w, h] of [[1920, 1080], [944, 545], [390, 844], [820, 820], [2560, 600], [360, 1600]]) {
      const win = {innerWidth: w, innerHeight: h, __nivel: {logdepth}};
      const a = oracle(win), b = modular(win);
      const pick = o => JSON.stringify([o.NEAR_CIDADE, o.NEAR_CASA, o.FAR_CIDADE, o.FAR_CASA, o.FOV_CIDADE, o.FOV_H_CASA,
        o.FOV_H_PLANTA, o.fovInterior(false), o.fovInterior(true)]);
      assert.equal(pick(b), pick(a), `${logdepth} ${w}x${h}`);
      n++;
    }
  assert.equal(n, 12);
});
