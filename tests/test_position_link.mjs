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
  // v17: a escada das tres etapas. Sem imovel na ficha nem link de imovel, o modulo tem que
  // se comportar exatamente como o original; o que muda com eles fica no teste de baixo.
  const ETAPA = {atual: 'mapa'}, TOUR = {on: false}, IMOVEL = {ficha: null, link: null};
  const getFicha = () => IMOVEL.ficha, getLinkImovel = () => IMOVEL.link,
    abrePeloLink = () => log.push(['abrePeloLink', IMOVEL.link]);
  globalThis.__st = {target, sph, NOITE, INT, log, ETAPA, TOUR, IMOVEL};`;
// `segue`: a location acompanha o replaceState, como no navegador. O oraculo nao liga isso.
function env(search, recusa, segue) {
  const writes = [];
  let refused = 0;
  const location = {href: 'file:///C:/mapa/sao-carlos-v16-moveis.html' + search + '#vista', search};
  return {URL, URLSearchParams, writes, location,
    history: {replaceState: (s, t, u) => { if (recusa && refused++ === 0) throw Error('opaque origin'); writes.push(u);
      if (segue) { location.href = 'file://' + u; location.search = new URL(location.href).search; } }}};
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
function modular(search, recusa, segue) {
  const e = env(search, recusa, segue), ctx = vm.createContext(e);
  vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/ui/position-link.js', import.meta.url), 'utf8'), ctx);
  vm.runInContext(`(() => { ${SETUP}
    globalThis.__o = PositionLink.create({CENTER, MLAT, MLON, px, pz, target, sph, NOITE, INT, setNoite, streamUpdate,
      ETAPA, TOUR, getFicha, getLinkImovel, abrePeloLink}); })();`, ctx);
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

test('with a listing in hand the URL names the listing, not the camera', () => {
  const m = modular('?em=-22.02,-47.9&r=15&p=2&t=0.3&q=baixo', false, true), S = m.ctx.__st, P = m.ctx.__o;
  S.IMOVEL.link = 'mirra-114'; P.lerLink();
  assert.equal(JSON.stringify(S.log), '[["abrePeloLink","mirra-114"]]', '?imovel= wins over ?em=');
  assert.deepEqual([S.target.x, S.target.z, S.sph.radius], [0, 0, 900]);
  S.IMOVEL.ficha = {u: {id: 'mirra-114'}}; P.escreveLink();
  S.IMOVEL.ficha = null; S.TOUR.on = true; P.escreveLink();
  assert.deepEqual(m.e.writes, [], 'no camera position while a sheet is open or the tour spins');
  S.TOUR.on = false; S.IMOVEL.ficha = {u: {id: 'mirra-114'}}; S.ETAPA.atual = 'planta'; P.marcaEtapaNaUrl();
  S.ETAPA.atual = 'mapa'; P.marcaEtapaNaUrl();
  S.IMOVEL.ficha = null; P.marcaEtapaNaUrl();
  const doc = '/C:/mapa/sao-carlos-v16-moveis.html';
  assert.deepEqual(m.e.writes, [doc + '?q=baixo&imovel=mirra-114&etapa=planta#vista',
    doc + '?q=baixo&imovel=mirra-114#vista', doc + '?q=baixo#vista']);
  const f = modular('', true, true);   // file:// recusa a primeira escrita e o link desliga
  f.ctx.__st.IMOVEL.ficha = {u: {id: 7}}; f.ctx.__o.marcaEtapaNaUrl(); f.ctx.__o.marcaEtapaNaUrl();
  assert.deepEqual(f.e.writes, []);
});
