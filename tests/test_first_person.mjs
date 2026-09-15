// Oracle: first-person step and walking joystick as they were in the monolith at a fixed commit (needs local Git history).
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = 'b976291';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');

function fakeJoy() {
  const h = {}, pino = {style: {transform: ''}}, cls = new Set();
  return {h, pino, cls, el: {firstElementChild: pino, captured: null,
    classList: {toggle: (k, on) => on ? cls.add(k) : cls.delete(k)},
    addEventListener: (k, f) => { (h[k] || (h[k] = [])).push(f); },
    getBoundingClientRect: () => ({left: 100, top: 600, width: 90, height: 90}),
    setPointerCapture(id) { this.captured = id; }}};
}
// Walls: x must stay below 2 and z above -3.
const SETUP = `const FP = {pos: {x: 0, y: 0, z: 0}, yaw: 0.3, pitch: 0, mov: {x: 0, z: 0}};
  const teclas = Object.create(null);
  const livre = (x, z) => x < 2 && z > -3;
  globalThis.__st = {FP, teclas};`;
function oracle(toque) {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const cut = (a, b) => { const i = app.indexOf(a), j = app.indexOf(b, i); assert.ok(i > 0 && j > i, a); return app.slice(i, j); };
  const j = fakeJoy();
  const ctx = vm.createContext({$: () => j.el});
  vm.runInContext(`(() => { ${SETUP} const TOQUE = ${toque};
    ${cut('function fpPasso(dt) {', 'addEventListener("keydown"')}
    ${cut('const joy = $("joy"), joyPino', '/* ---- de um clique')}
    globalThis.__o = {fpPasso, mostraJoy}; })();`, ctx);
  return {ctx, j};
}
function modular(toque) {
  const j = fakeJoy();
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/interior/first-person.js', import.meta.url), 'utf8'), ctx);
  ctx.__joy = j.el;
  vm.runInContext(`(() => { ${SETUP}
    globalThis.__o = FirstPerson.create({FP, teclas, livre, joy: __joy, TOQUE: ${toque}}); })();`, ctx);
  return {ctx, j};
}
function script(s) {
  const log = [];
  const snap = () => { const F = s.ctx.__st.FP; log.push([F.pos.x, F.pos.z, F.yaw, F.mov.x, F.mov.z, s.j.pino.style.transform, [...s.j.cls].join()]); };
  const t = s.ctx.__st.teclas, P = s.ctx.__o;
  for (const [keys, dt, n] of [[{w: 1}, 0.016, 30], [{w: 1, shift: 1}, 0.033, 40], [{d: 1}, 0.2, 20], [{q: 1}, 0.016, 10],
                               [{s: 1, a: 1}, 0.05, 30], [{e: 1, w: 1}, 0.016, 25], [{}, 0.016, 3]]) {
    for (const k of ['w', 's', 'a', 'd', 'q', 'e', 'shift']) t[k] = keys[k] || 0;
    for (let i = 0; i < n; i++) { P.fpPasso(dt); snap(); }
  }
  P.mostraJoy(true); snap();
  const fire = (k, e) => (s.j.h[k] || []).forEach(f => f({preventDefault() {}, stopPropagation() {}, ...e}));
  fire('pointerdown', {pointerId: 7, clientX: 170, clientY: 620}); snap();
  for (const [x, y] of [[160, 700], [145, 645], [300, 300]]) { fire('pointermove', {pointerId: 7, clientX: x, clientY: y}); P.fpPasso(0.016); snap(); }
  fire('pointermove', {pointerId: 9, clientX: 100, clientY: 100}); snap();
  fire('pointerleave', {pointerId: 7}); snap();
  P.mostraJoy(false); snap();
  return JSON.stringify(log);
}

test('keyboard walking, run, turning, wall sliding and joystick match the monolith', () => {
  for (const toque of [true, false]) {
    const a = oracle(toque), b = modular(toque);
    const la = script(a), lb = script(b);
    assert.equal(lb, la, 'toque=' + toque);
    const rows = JSON.parse(lb);
    // Running forward reaches the z wall; from there the step slides along it instead of stopping.
    const blocked = rows.findIndex(r => r[1] < -2.95);
    assert.ok(blocked > 0, 'reaches the wall');
    assert.ok(rows.slice(blocked).some((r, i, s) => i && r[0] !== s[i - 1][0] && r[1] === s[i - 1][1]), 'slides along the wall');
  }
});
