// Oracle: graphics level table, GPU guess and level precedence as they were in the monolith at a fixed
// commit (needs local Git history), across GPU strings, touch screens, core counts, ?q= and saved choices.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '56f11f6';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');

function globals({gpu, coarse, screenMin, cores, search, saved, noGl}) {
  const canvas = {getContext: () => noGl ? null : {getExtension: () => gpu === null ? null : {UNMASKED_RENDERER_WEBGL: 1},
    getParameter: () => gpu}};
  return {document: {createElement: () => canvas}, matchMedia: q => ({matches: q === '(pointer:coarse)' && coarse}),
    screen: {width: screenMin, height: screenMin + 500}, navigator: {hardwareConcurrency: cores},
    location: {search}, URLSearchParams,
    __store: saved === undefined ? {} : {'mapa3d.qual': saved}};
}
function oracle(env) {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('const QUAL_NIVEIS = {'), j = app.indexOf('const SOMBRA_CIDADE', i);
  assert.ok(i > 0 && j > i);
  const ctx = vm.createContext(globals(env));
  vm.runInContext(`(() => {
    const MapStorage = {create: () => ({le: k => k in __store ? __store[k] : null})};
    ${app.slice(i, j)}
    globalThis.__o = {QUAL_NIVEIS, GPU, NIVEL_NOME, NIVEL}; })();`, ctx);
  return ctx.__o;
}
function modular(env) {
  const ctx = vm.createContext(globals(env));
  vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/scene/quality.js', import.meta.url), 'utf8'), ctx);
  return vm.runInContext(`GraphicsQuality.create({document, guarda: {le: k => k in __store ? __store[k] : null},
    QS: new URLSearchParams(location.search)})`, ctx);
}

test('level guess and precedence match the monolith', () => {
  const gpus = ['ANGLE (NVIDIA GeForce GTX 1650)', 'ANGLE (Intel(R) UHD Graphics 620)', 'Google SwiftShader', 'AMD Radeon RX 6600',
    'Apple M2', 'AMD Radeon R5 Graphics', 'Mali-G78', '', null];
  const seen = new Set();
  let n = 0;
  for (const gpu of gpus)
    for (const [coarse, screenMin] of [[false, 1080], [true, 390], [true, 900]])
      for (const cores of [2, 8])
        for (const [search, saved, noGl] of [['', undefined, false], ['?q=alto', 'baixo', false], ['?q=nada', 'medio', false],
                                              ['', 'alto', true], ['?q=baixo', undefined, false]]) {
          const env = {gpu, coarse, screenMin, cores, search, saved, noGl};
          const a = oracle(env), b = modular(env);
          assert.equal(JSON.stringify([b.GPU, b.NIVEL_NOME, b.NIVEL]), JSON.stringify([a.GPU, a.NIVEL_NOME, a.NIVEL]), JSON.stringify(env));
          seen.add(b.NIVEL_NOME); n++;
        }
  assert.equal(n, 9 * 3 * 2 * 5);
  assert.deepEqual([...seen].sort(), ['alto', 'baixo', 'medio']);
});
