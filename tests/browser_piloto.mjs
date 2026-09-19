// Smoke test HTTP dos textos aprovados e dos assets do piloto, com Chrome isolado.
// node tests/browser_piloto.mjs http://127.0.0.1:8871/ tasks/v1.0/evidencias
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn, spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const [base, output] = process.argv.slice(2);
if (!base || !output) throw Error('Informe URL HTTP local e pasta de evidencias');
const origin = new URL(base);
if (!['127.0.0.1', 'localhost'].includes(origin.hostname)) throw Error('Use servidor local');
const piloto = JSON.parse(await fs.readFile(new URL('../tasks/v1.0/piloto.json', import.meta.url), 'utf8'));
await fs.mkdir(output, {recursive: true});
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'imobiliaria-piloto-'));
const chrome = spawn(process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile,
   '--window-size=1280,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
   '--no-first-run', '--disable-background-networking', 'about:blank'],
  {windowsHide: true, stdio: 'ignore'});
let socket, seq = 0;
const pending = new Map(), errors = [], warnings = [], httpErrors = [], results = [];
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await delay(100); }
  }
  if (!port) throw Error('Chrome nao iniciou');
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
  socket.onmessage = e => {
    const data = JSON.parse(e.data), call = pending.get(data.id);
    if (call) {
      pending.delete(data.id); clearTimeout(call.timer);
      if (data.error) call.reject(Error(JSON.stringify(data.error))); else call.resolve(data.result);
    }
    if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails);
    if (data.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(data.params.type))
      warnings.push(data.params.args.map(a => a.value ?? a.description).join(' '));
    if (data.method === 'Network.responseReceived' && data.params.response.status >= 400 &&
        !data.params.response.url.endsWith('/favicon.ico'))
      httpErrors.push({url: data.params.response.url, status: data.params.response.status});
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++seq, timer = setTimeout(() => {pending.delete(id); reject(Error(method + ' timeout'));}, 45000);
      pending.set(id, {resolve, reject, timer}); socket.send(JSON.stringify({id, method, params}));
    });
  }
  async function read(expression) {
    const result = await send('Runtime.evaluate', {expression, returnByValue: true});
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', {url: origin.href});
  for (let i = 0; i < 60 && !(await read('document.querySelectorAll("article").length===3')); i++) await delay(250);
  assert.equal(await read('document.querySelectorAll("article").length'), 3);
  let shot = await send('Page.captureScreenshot', {format: 'png'});
  await fs.writeFile(path.join(output, 'indice.png'), Buffer.from(shot.data, 'base64'));
  for (const id of piloto.imoveis) {
    errors.length = 0; warnings.length = 0; httpErrors.length = 0;
    const url = new URL('mapa/imovel-' + id + '.html', origin);
    url.search = new URLSearchParams({imovel: id, modo: 'ficha', q: 'baixo'}).toString();
    await send('Page.navigate', {url: url.href});
    let state;
    for (let i = 0; i < 180; i++) {
      state = await read(`(() => {
        const sheet=document.getElementById('usheet');
        return {ready: !!(sheet?.classList.contains('on') && window.__int?.grupos().length),
          title:document.getElementById('uName')?.textContent,
          price:document.getElementById('uStats')?.textContent,
          warning:document.getElementById('uAviso')?.textContent,
          warningHidden:document.getElementById('uAviso')?.hidden,
          tileStats:window.__int?.exteriors?.stats()};
      })()`);
      if (state.ready && state.tileStats && state.tileStats.pendingTiles === 0 && state.tileStats.loadedTiles > 0) break;
      await delay(500);
    }
    assert.ok(state.ready, 'ficha nao abriu: ' + id);
    const unit = JSON.parse(await fs.readFile(new URL('../plantas_fornecidas/' + id + '/unidade.json', import.meta.url), 'utf8'));
    assert.equal(state.title, unit.ficha.empreendimento);
    assert.ok(state.price.includes(piloto.preco_ausente));
    assert.equal(state.warning, piloto.localizacao_nao_confirmada);
    assert.equal(state.warningHidden, false);
    assert.equal(state.tileStats?.tileErrors, 0);
    assert.ok(state.tileStats?.loadedTiles > 0);
    shot = await send('Page.captureScreenshot', {format: 'png'});
    await fs.writeFile(path.join(output, id + '.png'), Buffer.from(shot.data, 'base64'));
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(httpErrors.length, 0, JSON.stringify(httpErrors));
    results.push({id, ...state, warnings: [...warnings], errors: [...errors], httpErrors: [...httpErrors]});
    console.log('OK', id, state.title, 'tiles:', state.tileStats.loadedTiles);
  }
  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
  await send('Page.navigate', {url: origin.href});
  for (let i = 0; i < 60 && !(await read('document.querySelectorAll("article").length===3')); i++) await delay(250);
  assert.equal(await read('document.documentElement.scrollWidth <= innerWidth'), true, 'indice com rolagem horizontal');
  shot = await send('Page.captureScreenshot', {format: 'png'});
  await fs.writeFile(path.join(output, 'indice-mobile.png'), Buffer.from(shot.data, 'base64'));
  await fs.writeFile(path.join(output, 'browser.json'), JSON.stringify({base, results,
    mobile: 'apenas indice em viewport emulada; aparelho fisico nao testado'}, null, 2));
} finally {
  socket?.close();
  for (const call of pending.values()) clearTimeout(call.timer);
  if (chrome.pid) spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore'});
}
