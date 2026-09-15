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
  if (process.argv.includes('--streaming')) {
    result.streaming = await evaluate(`(() => {
      const I = __int, P = __perf, samples = [];
      function drain() {
        for (let k = 0; k < 4; k++) { P.passo(1200000 + samples.length * 10000 + k * 2000); P.bombeia(100000); }
        if (P.fila()) throw Error('Streaming queue did not drain');
        const trees = P.confereArvores();
        if (!trees.ok) throw Error('Tree membership mismatch: ' + JSON.stringify(trees));
        I.renderer.render(I.scene, I.camera);
        return {groups:I.vivos().size, geometries:I.renderer.info.memory.geometries,
          textures:I.renderer.info.memory.textures, trees:trees.completo};
      }
      for (let cycle = 0; cycle < 3; cycle++) {
        for (const [x, radius] of [[-525,450],[-375,250],[-525,450],[50000,150],[-525,450]]) {
          I.target.set(x,0,x === 50000 ? 50000 : -1598); P.setStreamRadius(radius);
          samples.push({cycle,x,radius,...drain()});
        }
      }
      // Compare the same path after each full cycle; hysteresis deliberately keeps
      // different geometry sets after the nearby and far-away routes.
      const last = [samples[9], samples[14]];
      if (last[0].groups !== last[1].groups || last[0].geometries !== last[1].geometries || last[0].textures !== last[1].textures)
        throw Error('Resources did not settle after repeated return: ' + JSON.stringify(last));
      return samples;
    })()`);
  }
  if (process.argv.includes('--listing')) {
    // Every showcase item: sheet text as rendered, then enter the first one.
    result.listing = await evaluate(`(async () => {
      const I = __int, g = id => document.getElementById(id), out = {sheets: []};
      const items = document.querySelectorAll('#houses .hitem[data-unidade]');
      out.showcase = items.length;
      for (const item of items) {
        item.click();
        out.sheets.push({id:item.dataset.unidade, on:g('usheet').classList.contains('on'),
          tag:g('uTag').textContent, name:g('uName').textContent, addr:g('uAddr').textContent,
          warning:[g('uAviso').hidden, g('uAviso').textContent], stats:g('uStats').innerHTML,
          count:g('uNCom').textContent, rooms:g('uCom').innerHTML,
          roomsHidden:g('usheet').querySelector('.comodos').hidden, enterHidden:g('uEnter').hidden});
      }
      out.ads = [];
      for (const item of document.querySelectorAll('#houses .hitem:not([data-unidade])')) {
        item.click();
        const ad = {title:item.querySelector('.t').textContent, on:g('hsheet').classList.contains('on'),
          tag:g('hTag').textContent, name:g('hName').textContent, addr:g('hAddr').textContent,
          price:g('hPrice').textContent, rooms:g('hRooms').textContent, parking:g('hGar').textContent,
          link:g('hLink').getAttribute('href'), modelHidden:g('hModel').hidden, note:g('hModelNote').textContent};
        if (!ad.modelHidden) {
          g('hModel').click();
          const dialog = document.querySelector('dialog.listing-model-dialog');
          ad.modelOpen = !!(dialog && dialog.open); ad.modelTitle = dialog && dialog.querySelector('h2').textContent;
          dialog.querySelector('header button').click(); ad.modelClosed = !dialog.open;
        }
        out.ads.push(ad);
      }
      g('hx').click();
      // POI layer buffers and the "what is nearby" column for the first showcase item.
      const hex = async a => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
        new Uint8Array(a.buffer, a.byteOffset, a.byteLength)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
      out.poiLayer = [];
      const poiObjects = [];
      I.scene.traverse(o => { if (o.geometry && o.geometry.userData.poi) poiObjects.push(o); });
      for (const o of poiObjects) {
        const geo = o.geometry, m = o.material, row = {type:o.type, renderOrder:o.renderOrder,
          frustumCulled:o.frustumCulled, material:[m.type, m.opacity, m.blending, m.depthTest, m.depthWrite, !!m.map]};
        for (const [k, a] of Object.entries(geo.attributes)) row[k] = [a.count, await hex(a.array)];
        row.presetDY = await hex(geo.userData.presetDY); row.presetCenter = await hex(geo.userData.presetCenter);
        out.poiLayer.push(row);
      }
      out.nearby = [];
      for (const item of items) {
        item.click(); g('uPerto').click();
        const near = {id:item.dataset.unidade, on:g('nearby').classList.contains('on'), sub:g('nSub').textContent, back:!g('nBack').hidden,
          chips:[...g('nList').children].map(b => [b.querySelector('span').textContent, b.querySelector('b').textContent,
            b.getAttribute('aria-pressed'), b.classList.contains('vazio')]),
          sheetMin:g('usheet').classList.contains('min')};
        g('nBack').click();
        near.afterBack = [g('nearby').classList.contains('on'), g('usheet').classList.contains('on'), g('usheet').classList.contains('min')];
        g('ux').click();
        out.nearby.push(near);
      }
      // Search results as rendered, from the same fixed camera target.
      out.search = [];
      for (const term of ['farm', 'ru', 'Catedral', 'são car', 'SAO', 'escola', 'x', 'zzqq']) {
        g('bq').value = term; g('bq').dispatchEvent(new Event('input'));
        out.search.push([term, g('bres').hidden, g('bres').innerHTML]);
      }
      g('bq').value = ''; g('bq').dispatchEvent(new Event('input'));
      // Minimap pixels: camera variations, then POI dots with categories all on, all off and one on.
      const minimap = async label => { I.desenhaMinimapa();
        out.minimap.push([label, I.MM.pronto, await hex(new TextEncoder().encode(I.MM.cv.toDataURL()))]); };
      out.minimap = [];
      await minimap('base');
      const orbit = [I.sph.radius, I.sph.theta];
      I.sph.radius = 3000; I.sph.theta = 1.1; await minimap('far-rotated');
      I.sph.radius = 60; await minimap('near');
      [I.sph.radius, I.sph.theta] = orbit;
      if (items.length) {
        items[items.length > 2 ? 2 : 0].click(); g('uPerto').click();
        g('nAll').click(); await minimap('pins-all');
        g('nNone').click(); await minimap('pins-none');
        g('nList').children[0].click(); await minimap('pins-one');
        g('nx').click(); await minimap('closed');
      }
      if (!items.length) return out;
      items[0].click(); g('uEnter').click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      const pl = I.INT.pl;
      Object.assign(out, {entered:!!I.INT.on, unit:pl && pl.id, rooms:pl ? pl.comodos.length : 0,
        walls:pl ? pl.paredes.length : 0, furniture:I.INT.moveis.length});
      // Derived plan: walls, openings (type, swing side, hinge) and rooms, exactly as computed.
      out.plan = pl && await hex(new TextEncoder().encode(JSON.stringify({
        paredes: pl.paredes, esquadrias: pl.esquadrias, comodos: pl.comodos.map(c => [c.nome, c.area, c.poly, c.piso]),
        casca: pl.casca, ob: pl.ob, furo: pl.furo, area: pl.area,
        moveis: pl.moveis.map(m => [m.tipo, m.u, m.v, m.rot, m.w, m.h, m.d, m.cor])})));
      out.planCounts = pl && {walls: pl.paredes.length, openings: pl.esquadrias.length,
        types: pl.esquadrias.map(e => e.tipo + ':' + e.lado + ':' + e.eixo).join(' ')};
      // House shell as mounted: every mesh of INT.casa (walls, floors, ceiling, openings).
      out.house = [];
      for (const c of (I.INT.casa ? I.INT.casa.children : [])) {
        const geo = c.geometry, row = {type:c.type, material:c.material && c.material.type, renderOrder:c.renderOrder,
          cast:c.castShadow, receive:c.receiveShadow, casa:!!c.userData.casa};
        if (geo) {
          for (const [k, a] of Object.entries(geo.attributes)) row[k] = [a.count, await hex(a.array)];
          if (geo.index) row.index = [geo.index.count, await hex(geo.index.array)];
        }
        out.house.push(row);
      }
      // Interior camera lens right after entering.
      out.camera = [I.camera.fov, I.camera.near, I.camera.far, I.camera.aspect];
      // Entry pose and the walkable map of the plan, sampled every 25 cm.
      out.entryPose = I.FP ? [I.FP.pos.x, I.FP.pos.z, I.FP.yaw] : null;
      if (pl && I.livre) {
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (const c of pl.contorno) for (const p of c) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
        const bits = [];
        for (let x = x0 - 0.5; x <= x1 + 0.5; x += 0.25) for (let z = z0 - 0.5; z <= z1 + 0.5; z += 0.25) bits.push(I.livre(x, z) ? 1 : 0);
        out.walkable = [bits.length, bits.reduce((a, b) => a + b, 0), await hex(new Uint8Array(bits))];
      }
      // The frame loop is stopped here, so the incremental bake never drains on its own:
      // finish it the way the headless probes do, then hash the lit colours and the profile.
      out.bakeFinished = !!(I.bakeAgora && I.bakeAgora());
      out.bake = I.BAKE && {on:I.BAKE.on, pronto:I.BAKE.pronto, unicos:I.BAKE.unicos, vertices:I.BAKE.vertices,
        tris:I.BAKE.tris, med:I.BAKE.med, k:I.BAKE.k, cache:I.BAKE.cache.size};
      out.houseBaked = [];
      for (const c of (I.INT.casa ? I.INT.casa.children : [])) {
        const a = c.geometry && c.geometry.attributes.color;
        out.houseBaked.push(a ? [a.count, await hex(a.array)] : null);
      }
      out.doorLeaves = pl && await hex(new TextEncoder().encode(JSON.stringify(pl.esquadrias.map(e => e.folha || null))));
      // Interior lighting as mounted, then with the first two lamps switched on.
      const lights = async () => {
        const S = I.INT, arr = a => hex(new Float32Array(a));
        const inst = async m => m && [m.count, await arr(m.instanceMatrix.array), m.instanceColor ? await arr(m.instanceColor.array) : null];
        return {sun: I.sun.intensity, exposure: I.renderer.toneMappingExposure, fog: I.scene.fog.color.toArray(),
          hemi: [I.hemi.intensity, I.hemi.color.getHex(), I.hemi.groundColor.getHex()],
          shadowCam: ['left','right','top','bottom','near','far'].map(k => I.sun.shadow.camera[k]).concat([I.sun.shadow.bias, I.sun.shadow.normalBias]),
          lights: S.luzes.map(l => [l.type, l.intensity, l.color.getHex(), l.position.toArray(), l.castShadow, l.distance || 0]),
          lamps: S.lamps.map(L => [L.i, L.on, L.p.toArray()]), key: S.chaveLuz,
          plafons: await inst(S.plafons), switches: await inst(S.chaves), map: S.chaves && S.chaves.userData.mapa};
      };
      out.lighting = await lights();
      if (I.alternaLuz) { I.alternaLuz(0); I.alternaLuz(1); out.lightingOn = await lights(); I.alternaLuz(0); I.alternaLuz(1); }
      // Furniture geometry as mounted: type, measure, transform and buffer hashes per piece.
      out.furnitureGeometry = [];
      for (const m of I.INT.moveis) {
        const o = m.obj, row = {type:m.tipo, measure:[m.w, m.h, m.d, m.rot, m.cor],
          position:o.position.toArray(), scale:o.scale.toArray(), rotation:o.rotation.y, meshes:[]};
        for (const c of o.children) {
          const geo = c.geometry, mesh = {material:c.material.type};
          for (const [k, a] of Object.entries(geo.attributes)) mesh[k] = [a.count, await hex(a.array)];
          if (geo.index) mesh.index = [geo.index.count, await hex(geo.index.array)];
          row.meshes.push(mesh);
        }
        out.furnitureGeometry.push(row);
      }
      return out;
    })()`);
  }
  if (process.argv.includes('--night')) {
    // Night applied at once: exposure, fog, clear colour, sky tint and the frame, then day again.
    result.night = await evaluate(`(async () => {
      const I = __int, P = __perf, R = I.renderer, sky = I.scene.children.find(o => o.renderOrder === -1000);
      const snap = async () => {
        P.passo(1300000); R.render(I.scene, I.camera);
        const png = R.domElement.toDataURL('image/png');
        const bytes = new TextEncoder().encode(png);
        const d = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
        return {on: I.NOITE.on, t: I.NOITE.t, exposure: R.toneMappingExposure, fog: I.scene.fog.color.toArray(),
          clear: R.getClearColor(new THREE.Color()).toArray(), sky: sky && [sky.visible, sky.material.color.toArray()], image: d};
      };
      const out = {day: await snap()};
      I.setNoite(true, true); out.night = await snap();
      I.setNoite(false, true); out.back = await snap();
      return out;
    })()`);
  }
  if (process.argv.includes('--editor')) {
    // Furniture editor in the real page: resize from both sides, rotate, move and cancel,
    // move and confirm, then reload the saved layout into a fresh visit.
    result.editor = await evaluate(`(async () => {
      const I = __int, g = id => document.getElementById(id), tick = () => new Promise(r => setTimeout(r, 50));
      const item = document.querySelector('#houses .hitem[data-unidade]');
      if (!item) return {skipped: 'no unit'};
      item.click(); g('uEnter').click();
      await new Promise(r => setTimeout(r, 1500));
      const out = {steps: []}, pl = I.INT.pl;
      const key = 'int_' + JSON.parse(g('__cidade').textContent).slug + '_' + pl.id;
      const snap = label => {
        const m = I.INT.moveis[I.INT.sel];
        out.steps.push([label, I.MOB.on, I.MOB.modo, I.INT.sel, m && [m.tipo, m.u, m.v, m.w, m.d, m.h, m.rot,
          m.obj.position.toArray(), m.obj.rotation.y, m.obj.scale.toArray()], localStorage.getItem(key)]);
      };
      localStorage.removeItem(key);
      I.modoMoveis(true); await tick();
      const i = I.INT.moveis.findIndex(m => !I.MOVEIS[m.tipo].alto && m.h > 0.3);
      I.seleciona(i); snap('selected');
      I.modo('medir'); snap('measure');
      const m = I.INT.moveis[i];
      I.redimensiona(m, 'w', m.w + 0.3, 1); snap('wider +');
      I.redimensiona(m, 'd', m.d - 0.1, -1); snap('shallower -');
      I.redimensiona(m, 'h', m.h + 0.2, 1); snap('taller');
      out.axis = [[1, 0], [0, 1]].map(([x, z]) => I.dirUV(m, x, z));
      m.rot = (m.rot + 1) % 4; I.atualizaMovel(m); I.seleciona(i); snap('rotated');
      I.modo('mover'); m.u += 0.8; m.v -= 0.4; I.atualizaMovel(m); snap('moving');
      out.fitsMoving = I.cabeAqui(m, m.u, m.v);
      I.cancelaGesto(); snap('cancelled');
      I.modo('mover'); m.u += 0.2; I.atualizaMovel(m); I.confirmaMover(); snap('confirmed');
      const saved = localStorage.getItem(key);
      I.modoMoveis(false); snap('mode off');
      I.exitInterior(); await new Promise(r => setTimeout(r, 1200));
      I.enterInterior(pl.rec, pl.unidade); await new Promise(r => setTimeout(r, 1500));
      out.reloaded = [saved === localStorage.getItem(key), I.INT.moveis.length,
        I.INT.moveis.map(x => [x.tipo, x.u, x.v, x.w, x.d, x.h, x.rot])];
      localStorage.removeItem(key);
      return out;
    })()`);
  }
  if (process.argv.includes('--mobile')) {
    // Compact viewport: tab switching, inert areas and a sheet forcing the map tab.
    await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
    await delay(500);
    result.mobile = await evaluate(`(async () => {
      const g = id => document.getElementById(id), tick = () => new Promise(r => setTimeout(r, 50));
      const state = label => ({label, tab:document.body.dataset.mobile, compact:matchMedia('(max-width:820px)').matches,
        aria:[g('mMapa').getAttribute('aria-pressed'), g('mImoveis').getAttribute('aria-expanded'), g('mOpcoes').getAttribute('aria-expanded')],
        inert:['usheet','hsheet','psheet','nearby','ipanel','houses','panel'].map(id => g(id).inert)});
      const out = [state('start')];
      for (const id of ['mImoveis', 'mImoveis', 'mOpcoes', 'mImoveis', 'mMapa']) { g(id).click(); await tick(); out.push(state(id)); }
      g('mImoveis').click(); await tick();
      const item = document.querySelector('#houses .hitem');
      if (item) { item.click(); await tick(); out.push(state('sheet')); }
      g('mOpcoes').click(); await tick(); out.push(state('options-closes-sheet'));
      g('mOpcoes').click(); await tick(); out.push(state('options-again'));
      return out;
    })()`);
    await send('Emulation.clearDeviceMetricsOverride');
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
