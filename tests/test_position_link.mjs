// Oracle: position link written to and read from the URL as it was in the monolith at a fixed commit
// (needs local Git history): formatting, dedup, preserved parameters, file:// refusal and clamping.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CHECKPOINT = '0253446';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/').replace(/\/$/, '');

const SETUP = `const CENTER = {lat: -22.01725, lon: -47.8908};
  const MLAT = 111132.92, MLON = 111319.49 * Math.cos(CENTER.lat * Math.PI/180);
  const px = lon => (lon - CENTER.lon) * MLON, pz = lat => -(lat - CENTER.lat) * MLAT;
  const vec = () => ({x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }});
  const target = vec(), sph = {radius: 900, phi: 0.98, theta: 0.55};
  const NOITE = {on: false}, INT = {on: false}, log = [];
  function setNoite(on, jaVai) { log.push(['noite', on, jaVai]); NOITE.on = on; }
  const streamUpdate = f => log.push(['stream', f]);
  globalThis.__st = {target, sph, NOITE, INT, log};`;
function env(search, recusa) {
  const writes = [];
  let refused = 0;
  return {URL, URLSearchParams, writes,
    location: {href: 'file:///C:/mapa/sao-carlos-v16-moveis.html' + search + '#vista', search},
    history: {replaceState: (s, t, u) => { if (recusa && refused++ === 0) throw Error('opaque origin'); writes.push(u); }}};
}
function oracle(search, recusa) {
  const app = execFileSync('git', ['-c', 'safe.directory=' + root, 'show', CHECKPOINT + ':renderizador-v16-moveis/app.js'],
    {cwd: root, encoding: 'utf8', maxBuffer: 64 << 20}).replace(/\r/g, '');
  const i = app.indexOf('let _linkOk = true, _linkT = 0'), j = app.indexOf('/* ---------------- minimapa', i);
  assert.ok(i > 0 && j > i);
  const e = env(search, recusa), ctx = vm.createContext(e);
  vm.runInContext(`(() => { ${SETUP} ${app.slice(i, j)} globalThis.__o = {escreveLink, lerLink}; })();`, ctx);
  return {ctx, e};
}
function modular(search, recusa) {
  const e = env(search, recusa), ctx = vm.createContext(e);
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/ui/position-link.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(`(() => { ${SETUP}
    globalThis.__o = PositionLink.create({CENTER, MLAT, MLON, px, pz, target, sph, NOITE, INT, setNoite, streamUpdate,
      // Dependências posteriores ao monólito, neutras: nenhuma ficha aberta, nenhum tour e
      // nenhum ?imovel= na URL (nenhuma das buscas abaixo tem), então vale o link de posição.
      TOUR: {on: false}, getFicha: () => null, getLinkImovel: () => null}); })();`, ctx);
  return {ctx, e};
}
function run({ctx, e}) {
  const S = ctx.__st, P = ctx.__o, out = [];
  P.lerLink(); out.push([S.target.x, S.target.z, S.sph.radius, S.sph.phi, S.sph.theta, S.NOITE.on, S.log.splice(0)]);
  for (const [x, z, r, phi, theta, noite, dentro] of [[0, 0, 900, 0.98, 0.55, false, false], [0, 0, 900, 0.98, 0.55, false, false],
      [-412.3, 1433.9, 230, 1.05, 0.6, false, false], [-412.3, 1433.9, 230, 1.05, 0.6, true, false], [50, 50, 90, 0.3, -2.1, false, true],
      [1200.5, -300.25, 4000.4, 1.4999, 3.14159, false, false]]) {
    S.target.set(x, 0, z); Object.assign(S.sph, {radius: r, phi, theta}); S.NOITE.on = noite; S.INT.on = dentro;
    P.escreveLink(); out.push(e.writes.slice());
  }
  return JSON.stringify(out);
}

test('position link write and read match the monolith', () => {
  const searches = ['', '?q=baixo&x=1', '?em=bad', '?em=-22.02,-47.9&r=15&p=2&t=0.3', '?em=-22.00,-47.88&r=12000&p=0.01&t=nada&noite=1',
    '?noite=1', '?em=-22.03,-47.87&r=640&p=1.2&t=-1.5&q=medio'];
  for (const search of searches)
    for (const recusa of [false, true])
      assert.equal(run(modular(search, recusa)), run(oracle(search, recusa)), `${search} recusa=${recusa}`);
});
