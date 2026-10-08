// O mapa 3D como um visitante o recebe: a página de hoje (piloto montado pelo pipeline) e a v2
// (`publicado/`), com o mesmo instrumento.
//   node medicoes/medir_mapa.mjs --pasta <pasta com mapa/sao-carlos-<hash>.html> --paginas cidade
//        --perfis desktop,celular-fraco --repeticoes 2 --saida medicoes/resultados/<nome>.json
// Escrito no levantamento de 07/10 (linha de base) e trazido para cá sem mudar o método.
// Reaproveita GANCHO (instrumentacao WebGL), ARGS_CHROME e chromePath de medir.mjs
// e servir() (compressao br/gzip como o Hosting) de servidor.mjs das miniaturas.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
// O instrumento WebGL (GANCHO), as flags do Chrome e o servidor que imita o Hosting são os
// mesmos das medições das miniaturas.
const MED = path.resolve(AQUI, '..', '..', 'miniaturas', 'versao-melhorada-07-10', 'medicoes') + path.sep;
const { GANCHO, ARGS_CHROME, chromePath } = await import(MED + 'medir.mjs');
const { servir } = await import(MED + 'servidor.mjs');
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : p; };

const PERFIS = {
  'desktop':       { cpu: 1, rede: { latency: 20, down: 50e6, up: 10e6 }, viewport: { width: 1366, height: 768 }, dpr: 1, mobile: false },
  'desktop-alto':  { cpu: 1, rede: { latency: 20, down: 50e6, up: 10e6 }, viewport: { width: 1366, height: 768 }, dpr: 1, mobile: false, q: 'alto' },
  'celular-fraco': { cpu: 6, rede: { latency: 150, down: 1.6e6, up: 0.75e6 }, viewport: { width: 360, height: 780 }, dpr: 2, mobile: true },
};
const pastaRaiz = path.resolve(process.cwd(), arg('pasta', path.join(AQUI, '..', 'publicado')));
const mapaNome = fs.readdirSync(path.join(pastaRaiz, 'mapa')).find(f => /^sao-carlos-[0-9a-f]{12}\.html$/.test(f));
const PAGINAS = {
  // o que o indice do piloto (e o /imovel/<id> do Hosting) entrega: tour recortado em 2.500 m
  tour: 'mapa/imovel-monte-dos-cedros-37.html?imovel=monte-dos-cedros-37&modo=ficha',
  // referencia: o mesmo tour sem a biblioteca de casas (app.js: ?casas=procedural)
  tourProcedural: 'mapa/imovel-monte-dos-cedros-37.html?imovel=monte-dos-cedros-37&modo=ficha&casas=procedural',
  // o "Ver mapa": a cidade inteira, montada com comprime()
  cidade: 'mapa/' + mapaNome,
  // a cidade aberta já na ficha do Cedros (o que o link de um imóvel entrega na v2)
  imovel: 'mapa/' + mapaNome + '?imovel=monte-dos-cedros-37&modo=ficha',
};

// Sinais de pronto, anotados pelo __marca do GANCHO (intervalo de 25 ms dentro da pagina).
const SINAIS = {
  cidadeCarregada: 'window.__int && __int.vivos && __int.grupos().length > 0',
  filaZero: 'window.__int && __int.grupos().length > 0 && __int.vivos().size > 0 && __perf.fila() === 0',
  completa: 'window.__int && __int.grupos().length > 0 && __int.vivos().size > 0 && __perf.fila() === 0 && (!__int.exteriors || __int.exteriors.stats().pendingTiles === 0)',
};
const EXTRA = String.raw`(() => {
  window.__lt = { n: 0, soma: 0, max: 0, ate: [] };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) { __lt.n++; __lt.soma += e.duration; if (e.duration > __lt.max) __lt.max = e.duration; __lt.ate.push([Math.round(e.startTime), Math.round(e.duration)]); } })
    .observe({ type: 'longtask', buffered: true }); } catch (e) {}
})();`;

const met = (m, k) => (m.metrics.find(x => x.name === k) || {}).value || 0;

async function janela(page, cdp, ms, acao) {
  const m0 = await cdp.send('Performance.getMetrics');
  const a = await page.evaluate(() => ({ ...__gl, pronto: 0, contexto: 0, t: performance.now() }));
  if (acao) await acao(ms); else await page.waitForTimeout(ms);
  const m1 = await cdp.send('Performance.getMetrics');
  const b = await page.evaluate(() => ({ ...__gl, pronto: 0, contexto: 0, t: performance.now() }));
  const s = (b.t - a.t) / 1000, fr = b.frames - a.frames;
  return { segundos: +s.toFixed(2), quadrosPorSeg: +(fr / s).toFixed(1),
    desenhosPorQuadro: fr ? Math.round((b.draws - a.draws) / fr) : 0,
    triangulosPorQuadro: fr ? Math.round((b.tris - a.tris) / fr) : 0,
    cpuPrincipalPct: +((met(m1, 'TaskDuration') - met(m0, 'TaskDuration')) / s * 100).toFixed(1),
    scriptPct: +((met(m1, 'ScriptDuration') - met(m0, 'ScriptDuration')) / s * 100).toFixed(1) };
}

async function memoria(page, cdp) {
  const h = await cdp.send('Runtime.getHeapUsage');
  const g = await page.evaluate(() => {
    const c = document.querySelector('canvas#c'); const a = __gl.contexto || {}; const px = c ? c.width * c.height : 0;
    const tela = px * (4 + 4) * (a.antialias ? 4 : 1) + px * 4;
    return { gpuMiB: +((__gl.mem + tela) / 1048576).toFixed(1), texturasMiB: +(__gl.tex / 1048576).toFixed(1),
      buffersMiB: +(__gl.buf / 1048576).toFixed(1), alvosMiB: +((__gl.rb + tela) / 1048576).toFixed(1),
      picoGpuMiB: +((__gl.pico + tela) / 1048576).toFixed(1), canvas: c ? [c.width, c.height] : null, msaa: !!a.antialias };
  });
  const dom = await cdp.send('Memory.getDOMCounters').catch(() => ({}));
  return { ...g, heapJsMiB: +(h.usedSize / 1048576).toFixed(1), heapJsTotalMiB: +(h.totalSize / 1048576).toFixed(1), nos: dom.nodes };
}

// Arrasto horizontal continuo sobre o canvas (giro da camera), pelo mesmo caminho de
// pointer que um usuario usa (scene/camera-gestures.js escuta pointerdown no canvas).
async function gira(page, P, ms) {
  const cx = P.viewport.width / 2, cy = P.viewport.height * 0.45, amp = P.viewport.width * 0.3;
  await page.mouse.move(cx - amp, cy); await page.mouse.down();
  const t0 = Date.now(); let i = 0;
  while (Date.now() - t0 < ms) {
    const f = ((i++ % 80) / 80); const x = cx - amp + 2 * amp * (f < 0.5 ? f * 2 : 2 - f * 2);
    await page.mouse.move(x, cy, { steps: 1 }); await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

async function medirUma(base, pagina, pn) {
  const P = PERFIS[pn];
  const perfilDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapa-perfil-'));
  const ctx = await chromium.launchPersistentContext(perfilDir, { executablePath: chromePath(), headless: true,
    args: ARGS_CHROME, viewport: P.viewport, deviceScaleFactor: P.dpr, isMobile: P.mobile, hasTouch: P.mobile,
    userAgent: P.mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' : undefined });
  (chromium._abertos ||= []).push(ctx);
  await ctx.addInitScript(GANCHO); await ctx.addInitScript(EXTRA);
  const page = ctx.pages()[0] || await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text().slice(0, 300)); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable'); await cdp.send('Performance.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: P.rede.latency, downloadThroughput: P.rede.down / 8, uploadThroughput: P.rede.up / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
  const req = new Map(); let bytes = 0; const porUrl = {}; let ultimoTile = 0, tiles = 0, bytesTiles = 0;
  cdp.on('Network.responseReceived', e => req.set(e.requestId, { url: e.response.url }));
  cdp.on('Network.loadingFinished', e => {
    bytes += e.encodedDataLength; const r = req.get(e.requestId); if (!r) return;
    let k = r.url.replace(base, '').split('?')[0];
    if (/\/quintais\//.test(k)) { tiles++; bytesTiles += e.encodedDataLength; ultimoTile = Date.now(); k = 'mapa/quintais/*.bin'; }
    else if (k.startsWith('data:')) k = 'data:';
    porUrl[k] = (porUrl[k] || 0) + e.encodedDataLength;
  });
  const url = base + '/' + pagina + (P.q ? (pagina.includes('?') ? '&' : '?') + 'q=' + P.q : '');
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit', timeout: 600000 });
  await page.evaluate(s => { for (const [k, e] of Object.entries(s)) __marca(k, e); }, SINAIS);
  // 1) a cidade decodificada (loadCity terminou) e o primeiro desenho ja na tela
  await page.waitForFunction('window.__int && __int.vivos().size > 0 && __gl.primeiroDesenhoNaTela', null, { timeout: 600000, polling: 100 });
  const tCarregadaWall = Date.now() - t0;
  const mCarregada = await cdp.send('Performance.getMetrics');
  // 2) Sem GPU o quadro do SwiftShader leva ~2 s e o streaming monta 1-2 quarteiroes por
  //    quadro: esperar a fila zerar pelo laco normal levaria horas. Mede-se entao o CUSTO
  //    DE CPU de cada quarteirao (montado um a um, sincronamente, com o mesmo buildNext do
  //    laco) e simula-se o empacotamento em fatias de STREAM_MS por quadro.
  // Cada chamada de __perf.bombeia(1) e UM streamPump() -- exatamente a fatia que o laco
  // gasta por quadro (STREAM_MS, ao menos um quarteirao, mais rebuildOverlay). O numero de
  // chamadas ate a fila zerar e o numero de quadros que a montagem exige num aparelho real.
  const montagem = await page.evaluate(() => {
    const ts = [], ns = []; let guarda = 20000, antes = __perf.fila(); const ini = antes;
    while (__perf.fila() > 0 && guarda-- > 0) { const a = performance.now(); __perf.bombeia(1); ts.push(performance.now() - a); const f = __perf.fila(); ns.push(antes - f); antes = f; }
    return { ini, ts, ns };
  });
  const fatia = (await page.evaluate(() => __perf.nivel)) === 'baixo' ? 4 : 6;
  const quadros = montagem.ts.length;
  const ord = montagem.ts.slice().sort((a, b) => a - b), soma = ord.reduce((a, b) => a + b, 0);
  const montagemResumo = { quarteiroesNaFila: montagem.ini, cpuTotalMs: Math.round(soma), fatiaMs: fatia, quadrosParaMontar: quadros,
    fatiaMedianaMs: +(ord[ord.length >> 1] || 0).toFixed(2), fatiaP95Ms: +(ord[Math.floor(ord.length * 0.95)] || 0).toFixed(1),
    fatiaMaxMs: +(ord[ord.length - 1] || 0).toFixed(1), fatiasAcimaDe50ms: ord.filter(x => x > 50).length,
    quarteiroesPorQuadroMediana: montagem.ns.slice().sort((a, b) => a - b)[montagem.ns.length >> 1] || 0,
    segundosA60fps: +(quadros / 60 + soma / 1000 * 0).toFixed(1), segundosA30fps: +(quadros / 30).toFixed(1) };
  // 3) quintais (tiles .bin) e estabilidade
  await page.waitForFunction(SINAIS.completa, null, { timeout: 600000, polling: 100 });
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(500);
    if (await page.evaluate(SINAIS.completa) && Date.now() - ultimoTile > 1500) break; }
  const tCompletaWall = Date.now() - t0;
  const mCompleta = await cdp.send('Performance.getMetrics');
  const abrir = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || null;
    const ex = window.__int && __int.exteriors ? __int.exteriors.stats() : null;
    return { htmlRespostaFim: n.responseEnd, domContentLoaded: n.domContentLoadedEventEnd, load: n.loadEventEnd, fcp,
      primeiroDesenho: __gl.primeiroDesenho, primeiroDesenhoNaTela: __gl.primeiroDesenhoNaTela,
      cidadeCarregada: __gl.pronto.cidadeCarregada, filaZero: __gl.pronto.filaZero, completa: __gl.pronto.completa,
      longTasks: { n: __lt.n, somaMs: Math.round(__lt.soma), maxMs: Math.round(__lt.max), maiores: __lt.ate.sort((a, b) => b[1] - a[1]).slice(0, 6) },
      nivel: __perf.nivel, dpr: __perf.dpr(), grupos: __int.grupos().length, vivos: __int.vivos().size,
      exteriores: ex && { loadedTiles: ex.loadedTiles, tileErrors: ex.tileErrors, pendingTiles: ex.pendingTiles, range: ex.range, coverage: ex.coverage },
      raioStream: __perf.raio(), drawsAteAqui: __gl.draws };
  });
  const cpuAteCompleta = { scriptMs: Math.round(met(mCompleta, 'ScriptDuration') * 1000), tarefaMs: Math.round(met(mCompleta, 'TaskDuration') * 1000),
    layoutMs: Math.round(met(mCompleta, 'LayoutDuration') * 1000), estiloMs: Math.round(met(mCompleta, 'RecalcStyleDuration') * 1000),
    nota: 'tempo de thread principal ja na escala do estrangulamento de CPU' };
  const memoriaCompleta = await memoria(page, cdp);
  // um quadro desenhado fora do rAF: chamadas e triangulos do renderer.info, com dpr atual
  const umQuadro = await page.evaluate(() => { const r = __perf.mede(3, false); return { calls: r.calls, tris: r.tris, msSwiftShader: +r.ms.toFixed(1) }; });
  const composicao = await page.evaluate(fs.readFileSync(path.join(AQUI, 'composicao.js'), 'utf8'));
  const parado = await janela(page, cdp, 5000);
  const girando = await janela(page, cdp, 5000, ms => gira(page, P, ms));
  await page.waitForTimeout(1500);
  const posGiro = await page.evaluate(() => ({ fila: __perf.fila(), vivos: __int.vivos().size, dpr: __perf.dpr() }));
  const memoriaFinal = await memoria(page, cdp);
  const r = { url: url.replace(base, ''), perfil: pn, carregadaParedeMs: tCarregadaWall, completaParedeMs: tCompletaWall, montagem: montagemResumo,
    cpuAteCarregada: { scriptMs: Math.round(met(mCarregada, 'ScriptDuration') * 1000), tarefaMs: Math.round(met(mCarregada, 'TaskDuration') * 1000) }, bytesAteCompleta: bytes, requisicoes: req.size, tiles, bytesTiles,
    abrir, cpuAteCompleta, memoriaCompleta, umQuadro, composicao, parado, girando, posGiro, memoriaFinal, bytesPorRecurso: porUrl, erros: erros.slice(0, 15) };
  await ctx.close(); fs.rmSync(perfilDir, { recursive: true, force: true });
  return r;
}

const paginas = arg('paginas', 'tour,cidade').split(','), perfis = arg('perfis', 'desktop,celular-fraco').split(',');
const reps = Number(arg('repeticoes', 2));
const srv = await servir(pastaRaiz);
const saida = { quando: new Date().toISOString(), maquina: `${os.cpus()[0].model} x${os.cpus().length}`, render: 'SwiftShader (software)', pasta: pastaRaiz, resultados: {} };
const destino = path.resolve(process.cwd(), arg('saida', path.join(AQUI, 'resultados', 'mapa.json')));
fs.mkdirSync(path.dirname(destino), { recursive: true });
for (const pg of paginas) for (const pn of perfis) {
  const k = pg + '|' + pn; saida.resultados[k] = [];
  for (let i = 0; i < reps; i++) {
    process.stderr.write(`${k} ${i + 1}/${reps}... `);
    try {
      const r = await medirUma(srv.url, PAGINAS[pg], pn);
      process.stderr.write(`carregada ${Math.round(r.abrir.cidadeCarregada)} ms, montagem ${r.montagem.cpuTotalMs} ms cpu, ${(r.bytesAteCompleta / 1e6).toFixed(2)} MB, ${r.umQuadro.calls} calls\n`);
      saida.resultados[k].push(r);
    } catch (e) { process.stderr.write('ERRO ' + e.message + '\n'); saida.resultados[k].push({ erro: String(e.message) }); for (const c of chromium._abertos || []) await c.close().catch(() => {}); }
    fs.writeFileSync(destino, JSON.stringify(saida, null, 2));
  }
}
await srv.fechar();
console.log('salvo', destino);
