// Isolated headless Chrome, real clock, fixed camera. No external dependencies.
// Protocol: https://chromedevtools.github.io/devtools-protocol/tot/Runtime/
// node tests/browser_realtime.mjs PAGE OUTPUT_PREFIX [--diagnostics]
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn, spawnSync} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const [page, output] = process.argv.slice(2);
if (!page || !output) throw Error('Provide PAGE and OUTPUT_PREFIX');
const prefix = path.resolve(output);
await fs.mkdir(path.dirname(prefix), {recursive: true});
const work = path.resolve('tasks/modularizacao/work');
await fs.mkdir(work, {recursive: true});
const profile = await fs.mkdtemp(path.join(work, 'chrome-'));
const chrome = spawn(process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile,
   '--window-size=960,640', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
   '--no-first-run', '--disable-background-networking', 'about:blank'],
  {windowsHide: true, stdio: 'ignore'});
let socket;
const pending = new Map();
let seq = 0;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await delay(100); }
  }
  if (!port) throw Error('Chrome debugging endpoint did not start');
  const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = e => {
    const data = JSON.parse(e.data), call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id); clearTimeout(call.timer);
    if (data.error) call.reject(Error(JSON.stringify(data.error))); else call.resolve(data.result);
  };
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++seq, timer = setTimeout(() => {pending.delete(id); reject(Error(method + ' timed out'));}, 120000);
      pending.set(id, {resolve, reject, timer}); socket.send(JSON.stringify({id, method, params}));
    });
  }
  async function evaluate(expression) {
    const r = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  await send('Page.navigate', {url: pathToFileURL(path.resolve(page)).href + '?q=baixo'});
  let ready = false;
  for (let i = 0; i < 240; i++) {
    if (await evaluate('!!(window.__int && window.__int.grupos().length)')) {ready = true; break;}
    await delay(250);
  }
  if (!ready) throw Error('Renderer did not start');
  const requireQA = process.argv.includes('--diagnostics');
  const result = await evaluate(`(() => {
    const I = __int, P = __perf;
    if (${requireQA} && (!window.__qa || __qa.version !== 1)) throw Error('QA API missing');
    window.requestAnimationFrame = () => 0;
    P.setStreamRadius(450); I.target.set(50000,0,50000);
    P.passo(1000000); P.bombeia(100000);
    I.target.set(-525,0,-1598); I.sph.set(230,1.05,.6);
    for(let k=0;k<4;k++){P.passo(1001000+k*2000);P.bombeia(100000);}
    const times = [P.mede(5,false), P.mede(5,false), P.mede(5,false)];
    const result = {camera:I.camera.position.toArray(),groups:I.vivos().size,queue:P.fila(),
      times,geometries:I.renderer.info.memory.geometries,textures:I.renderer.info.memory.textures,
      urban:I.urban && I.urban.stats(),dpr:P.dpr(),quality:P.nivel,
      viewport:[innerWidth,innerHeight], diagnostics:window.__qa ? __qa.version : null};
    if (${requireQA} && __qa.cena().scene !== I.scene) throw Error('Wrong QA scene');
    I.renderer.render(I.scene,I.camera);
    result.image=I.renderer.domElement.toDataURL('image/png').split(',')[1];
    return result;
  })()`);
  await fs.writeFile(prefix + '.png', Buffer.from(result.image, 'base64'));
  delete result.image;
  if (process.argv.includes('--terrain')) {
    result.terrain = await evaluate(`(async () => {
      const I = __int, P = __perf, button = document.getElementById('tRelief');
      if (!button) throw Error('Relief control missing');
      const samples = [];
      for (const on of [true, false, true]) {
        if ((button.getAttribute('aria-pressed') === 'true') !== on) button.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        if (button.disabled) throw Error('Elevation did not load from embedded data');
        P.passo(1100000 + samples.length * 2000); P.bombeia(100000);
        let vertices = 0, maximumError = 0;
        const visited = new Set();
        I.scene.traverse(object => {
          const g = object.geometry, t = g && g.userData.terrain;
          if (!t || g.userData.dynamicHeight || visited.has(g)) return;
          visited.add(g);
          const pos = g.attributes.position;
          for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 100))) {
            const expected = t.baseY[i] + t.dy[i] * Number(on);
            const error = Math.abs(pos.getY(i) - expected);
            if (!Number.isFinite(error)) throw Error('Non-finite terrain vertex');
            maximumError = Math.max(maximumError, error); vertices++;
          }
        });
        if (!vertices || maximumError > .001) throw Error('Terrain mismatch: ' + maximumError);
        samples.push({on, vertices, maximumError, geometries: visited.size});
      }
      return samples;
    })()`);
  }
  result.page = path.resolve(page);
  result.clock = 'real';
  await fs.writeFile(prefix + '.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  socket?.close();
  for (const call of pending.values()) clearTimeout(call.timer);
  if (chrome.pid) spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore'});
}
