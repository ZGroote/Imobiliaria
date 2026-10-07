// Mede a miniatura do jeito que um visitante a recebe: bytes transferidos, tempo até a
// maquete aparecer e até a luz calculada chegar, memória de GPU, trabalho por quadro e
// CPU ocupada parada em cada modo -- em perfis de rede e de aparelho simulados.
//
//   node medicoes/medir.mjs --versao base|nova [--perfis desktop,celular-4g,celular-fraco]
//                           [--repeticoes 3] [--saida medicoes/resultados/x.json]
//
// O mesmo instrumento mede as duas versões: as chamadas WebGL são interceptadas (memória de
// buffers/texturas/renderbuffers, chamadas de desenho, triângulos, quadros), então nenhum
// número depende de a página "dizer" quanto gasta. O que muda entre as versões são só os
// sinais de pronto (`ADAPTADORES`).
//
// Limite honesto: sem GPU no ambiente de medição o Chromium rasteriza em software
// (SwiftShader). Bytes, tempos de rede/CPU, memória e chamadas são comparáveis; FPS absoluto
// não representa celular nenhum -- vale só a comparação entre as versões no mesmo ambiente.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, '..');
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : p; };

export const PERFIS = {
  // Notebook comum em Wi-Fi.
  'desktop': { qNova: 'alto', cpu: 1, rede: { latency: 20, down: 50e6, up: 10e6 }, viewport: { width: 1366, height: 768 },
               dpr: 1, mobile: false },
  // Celular intermediário em 4G típico (Brasil, mediana): CPU 4x mais lenta que a máquina de medição.
  'celular-4g': { qNova: 'medio', cpu: 4, rede: { latency: 60, down: 12e6, up: 3e6 }, viewport: { width: 390, height: 844 },
                  dpr: 3, mobile: true },
  // Celular fraco em 4G ruim/3G (perfil "Slow 4G" do Lighthouse): CPU 6x mais lenta.
  'celular-fraco': { qNova: 'baixo', cpu: 6, rede: { latency: 150, down: 1.6e6, up: 0.75e6 }, viewport: { width: 360, height: 780 },
                     dpr: 2, mobile: true },
};

export const ADAPTADORES = {
  base: {
    pasta: () => {
      const destino = path.join(os.tmpdir(), 'miniatura-base-montada');
      execFileSync(process.env.PYTHON || 'python3', [path.join(AQUI, 'montar_base.py'), destino], { stdio: 'pipe' });
      return destino;
    },
    pagina: 'maquete-monte-dos-cedros-37.html',
    exterior: 'window.__exteriorV3 && (__exteriorV3.ready || __exteriorV3.error)',
    interior: 'window.__bakeV3 && (__bakeV3.ready || __bakeV3.error)',
    erro: '(window.__exteriorV3&&__exteriorV3.error)||(window.__bakeV3&&__bakeV3.error)||null',
  },
  nova: {
    pasta: () => path.join(PASTA, 'publicado'),
    pagina: 'maquete-monte-dos-cedros-37.html',
    exterior: 'window.__miniatura && __miniatura.estado.exterior !== "carregando"',
    interior: 'window.__miniatura && ["pronto", "erro"].includes(__miniatura.estado.interior)',
    erro: 'window.__miniatura && __miniatura.estado.erro || null',
  },
};

// Instrumentação WebGL: memória viva por objeto, chamadas e triângulos, quadros.
const GANCHO = String.raw`(() => {
  const S = window.__gl = { draws: 0, tris: 0, frames: 0, primeiroDesenho: 0, mem: 0, pico: 0,
                            tex: 0, buf: 0, rb: 0, contexto: null, pronto: {} };
  const vivos = new WeakMap(), texNiveis = new WeakMap();
  function poe(obj, tipo, bytes) {
    const ant = vivos.get(obj); if (ant) { S[ant.tipo] -= ant.bytes; S.mem -= ant.bytes; }
    vivos.set(obj, { tipo, bytes }); S[tipo] += bytes; S.mem += bytes; if (S.mem > S.pico) S.pico = S.mem;
  }
  function tira(obj) { const ant = obj && vivos.get(obj); if (ant) { S[ant.tipo] -= ant.bytes; S.mem -= ant.bytes; vivos.delete(obj); } }
  // bytes por texel (formatos sem compressão) e bytes por bloco 4x4 (comprimidos)
  const BPP = { 0x8058: 4, 0x8C43: 4, 0x8051: 4, 0x1908: 4, 0x1907: 4, 0x881A: 8, 0x8814: 16, 0x822F: 8, 0x8D62: 2,
    0x8229: 1, 0x822B: 2, 0x8C3D: 4, 0x8C3A: 4, 0x88F0: 4, 0x81A6: 4, 0x8CAC: 4, 0x81A5: 2, 0x8D48: 1, 0x1906: 1,
    0x1909: 1, 0x190A: 2, 0x8D9F: 4, 0x8C40: 4, 0x881B: 8, 0x8815: 16 };
  const BLOCO = { 0x9274: 8, 0x9275: 8, 0x9278: 16, 0x9279: 16, 0x93B0: 16, 0x93D0: 16, 0x8E8C: 16, 0x8E8D: 16,
    0x83F0: 8, 0x83F1: 8, 0x83F2: 16, 0x83F3: 16, 0x8D64: 8, 0x8C00: 8, 0x8C02: 8, 0x8E8E: 16, 0x8E8F: 16 };
  function bytesNivel(fmt, w, h) {
    if (BLOCO[fmt]) return Math.ceil(w / 4) * Math.ceil(h / 4) * BLOCO[fmt];
    return w * h * (BPP[fmt] || 4);
  }
  function somaTex(tex) { const m = texNiveis.get(tex); let s = 0; if (m) m.forEach(v => s += v); poe(tex, 'tex', s); }
  function hook(gl) {
    S.contexto = gl.getContextAttributes();
    const buf = {}, tex = {}; let unidade = 0x84C0;
    const o = {};
    for (const k of ['bindBuffer', 'bufferData', 'deleteBuffer', 'activeTexture', 'bindTexture', 'texStorage2D',
      'texImage2D', 'compressedTexImage2D', 'deleteTexture', 'renderbufferStorage', 'renderbufferStorageMultisample',
      'bindRenderbuffer', 'deleteRenderbuffer', 'drawElements', 'drawArrays', 'drawElementsInstanced',
      'drawArraysInstanced', 'drawRangeElements']) o[k] = gl[k] && gl[k].bind(gl);
    let rbAtual = null;
    gl.bindBuffer = (t, b) => { buf[t] = b; return o.bindBuffer(t, b); };
    gl.bufferData = function (t, a, u, ...r) {
      const n = typeof a === 'number' ? a : (r.length > 1 && r[1] ? r[1] * (a.BYTES_PER_ELEMENT || 1) : a ? a.byteLength : 0);
      if (buf[t]) poe(buf[t], 'buf', n); return o.bufferData(t, a, u, ...r);
    };
    gl.deleteBuffer = b => { tira(b); return o.deleteBuffer(b); };
    gl.activeTexture = u => { unidade = u; return o.activeTexture(u); };
    gl.bindTexture = (t, x) => { tex[unidade + ':' + t] = x; return o.bindTexture(t, x); };
    const atual = t => tex[unidade + ':' + (t >= 0x8515 && t <= 0x851A ? 0x8513 : t)];
    gl.texStorage2D = (t, niveis, fmt, w, h) => {
      const x = atual(t); if (x) { const m = new Map(); let ww = w, hh = h;
        for (let l = 0; l < niveis; l++) { m.set(l, bytesNivel(fmt, ww, hh) * (t === 0x8513 ? 6 : 1)); ww = Math.max(1, ww >> 1); hh = Math.max(1, hh >> 1); }
        texNiveis.set(x, m); somaTex(x); }
      return o.texStorage2D(t, niveis, fmt, w, h);
    };
    gl.texImage2D = function (t, nivel, fmt, ...r) {
      const x = atual(t);
      if (x) { let w, h;
        if (typeof r[0] === 'number' && r.length >= 5) { w = r[0]; h = r[1]; }
        else { const src = r[r.length - 1]; w = src && (src.width || src.videoWidth) || 0; h = src && (src.height || src.videoHeight) || 0; }
        const m = texNiveis.get(x) || new Map(); m.set(nivel * 8 + (t - 0x8515 + 1 > 0 && t <= 0x851A ? t - 0x8514 : 0), bytesNivel(fmt, w, h));
        texNiveis.set(x, m); somaTex(x); }
      return o.texImage2D(t, nivel, fmt, ...r);
    };
    gl.compressedTexImage2D = function (t, nivel, fmt, w, h, borda, dados, ...r) {
      const x = atual(t); if (x) { const m = texNiveis.get(x) || new Map(); m.set(nivel * 8, bytesNivel(fmt, w, h)); texNiveis.set(x, m); somaTex(x); }
      return o.compressedTexImage2D(t, nivel, fmt, w, h, borda, dados, ...r);
    };
    gl.deleteTexture = x => { tira(x); texNiveis.delete(x); return o.deleteTexture(x); };
    gl.bindRenderbuffer = (t, r) => { rbAtual = r; return o.bindRenderbuffer(t, r); };
    gl.renderbufferStorage = (t, fmt, w, h) => { if (rbAtual) poe(rbAtual, 'rb', bytesNivel(fmt, w, h)); return o.renderbufferStorage(t, fmt, w, h); };
    if (o.renderbufferStorageMultisample) gl.renderbufferStorageMultisample = (t, s, fmt, w, h) => {
      if (rbAtual) poe(rbAtual, 'rb', bytesNivel(fmt, w, h) * Math.max(1, s)); return o.renderbufferStorageMultisample(t, s, fmt, w, h); };
    gl.deleteRenderbuffer = r => { tira(r); return o.deleteRenderbuffer(r); };
    let quadro = -1;
    function conta(modo, n, inst) {
      if (!S.primeiroDesenho) S.primeiroDesenho = performance.now();
      S.draws++; if (modo === 4) S.tris += Math.floor(n / 3) * (inst || 1);
      if (quadro !== S._raf) { quadro = S._raf; S.frames++; }
    }
    gl.drawElements = (m, n, t, off) => { conta(m, n); return o.drawElements(m, n, t, off); };
    gl.drawArrays = (m, f, n) => { conta(m, n); return o.drawArrays(m, f, n); };
    if (o.drawRangeElements) gl.drawRangeElements = (m, a, b, n, t, off) => { conta(m, n); return o.drawRangeElements(m, a, b, n, t, off); };
    if (o.drawElementsInstanced) gl.drawElementsInstanced = (m, n, t, off, i) => { conta(m, n, i); return o.drawElementsInstanced(m, n, t, off, i); };
    if (o.drawArraysInstanced) gl.drawArraysInstanced = (m, f, n, i) => { conta(m, n, i); return o.drawArraysInstanced(m, f, n, i); };
  }
  S._raf = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => { S._raf++; cb(t); });
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (tipo, attrs) {
    const gl = orig.call(this, tipo, attrs);
    if (gl && /webgl/.test(tipo) && !gl.__instrumentado && this.id) { gl.__instrumentado = true; hook(gl); }
    return gl;
  };
  // Relógio dos sinais de pronto: anotado no próprio laço da página, não por quem pergunta.
  window.__marca = (nome, expr) => { const f = new Function('return (' + expr + ')');
    const id = setInterval(() => { try { if (f()) { S.pronto[nome] = performance.now(); clearInterval(id); } } catch (e) {} }, 25); };
})();`;

const ARGS_CHROME = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
                     '--enable-precise-memory-info'];
function chromePath() {
  const cands = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'];
  return cands.find(c => c && fs.existsSync(c));
}

async function ocioso(page, cdp, ms) {
  const m0 = await cdp.send('Performance.getMetrics');
  const a = await page.evaluate(() => ({ ...__gl, t: performance.now() }));
  await page.waitForTimeout(ms);
  const m1 = await cdp.send('Performance.getMetrics');
  const b = await page.evaluate(() => ({ ...__gl, t: performance.now() }));
  const met = (m, k) => (m.metrics.find(x => x.name === k) || {}).value || 0;
  const s = (b.t - a.t) / 1000;
  return { segundos: +s.toFixed(2), quadrosPorSeg: +((b.frames - a.frames) / s).toFixed(1),
           desenhosPorSeg: Math.round((b.draws - a.draws) / s), triangulosPorSeg: Math.round((b.tris - a.tris) / s),
           cpuPrincipalPct: +((met(m1, 'TaskDuration') - met(m0, 'TaskDuration')) / s * 100).toFixed(1) };
}

export async function medirUma(base, ad, perfilNome, opcoes = {}) {
  const P = PERFIS[perfilNome];
  // Perfil persistente e novo a cada execução: cache em disco de verdade (a revisita mede o
  // que um celular guarda), mas a primeira abertura sempre fria.
  const perfilDir = fs.mkdtempSync(path.join(os.tmpdir(), 'miniatura-perfil-'));
  const ctx = await chromium.launchPersistentContext(perfilDir, { executablePath: chromePath(), headless: true,
    args: ARGS_CHROME, viewport: P.viewport, deviceScaleFactor: P.dpr, isMobile: P.mobile,
    hasTouch: P.mobile, userAgent: P.mobile
      ? 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'
      : undefined });
  await ctx.addInitScript(GANCHO);
  const page = ctx.pages()[0] || await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Performance.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: P.rede.latency,
    downloadThroughput: P.rede.down / 8, uploadThroughput: P.rede.up / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
  const req = new Map(); let bytes = 0;
  const porUrl = {};
  cdp.on('Network.responseReceived', e => req.set(e.requestId, { url: e.response.url, status: e.response.status }));
  cdp.on('Network.loadingFinished', e => {
    bytes += e.encodedDataLength; const r = req.get(e.requestId);
    if (r) { const k = r.url.replace(base, '').split('?')[0]; porUrl[k] = (porUrl[k] || 0) + e.encodedDataLength; }
  });
  const fase = {};
  const url = base + '/' + ad.pagina + (opcoes.query || '');
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit', timeout: 300000 });
  await page.evaluate(([e, i]) => { __marca('exterior', e); __marca('interior', i); }, [ad.exterior, ad.interior]);
  await page.waitForFunction(ad.exterior, null, { timeout: 300000, polling: 50 });
  await page.waitForTimeout(300);
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    // "Primeira imagem": o que a pessoa vê primeiro -- a capa (v4) ou o primeiro desenho 3D.
    const t = window.__miniatura && __miniatura.estado.tempos || {};
    const capa = t.capa || null;
    return { html: n.responseEnd, dom: n.domContentLoadedEventEnd, load: n.loadEventEnd,
             primeiroDesenho: __gl.primeiroDesenho, capa,
             primeiraImagem: Math.min(capa || Infinity, __gl.primeiroDesenho || Infinity),
             luzExterior: __gl.pronto.exterior };
  });
  fase.abrir = { ...nav, bytes, requisicoes: req.size, erroPagina: await page.evaluate(ad.erro) };
  fase.memoriaMaquete = await memoria(page, cdp);
  fase.maqueteParada = await ocioso(page, cdp, opcoes.janela || 4000);
  // Planta 3D: tempo do clique até a luz interna, e o que mais foi baixado.
  const b0 = bytes, c0 = Date.now();
  await page.locator('[data-modo="planta3d"]').click();
  await page.waitForFunction(ad.interior, null, { timeout: 300000, polling: 50 });
  fase.planta3d = { ms: Date.now() - c0, bytes: bytes - b0, erroPagina: await page.evaluate(ad.erro) };
  await page.waitForTimeout(500);
  fase.planta3dParada = await ocioso(page, cdp, opcoes.janela || 4000);
  await page.locator('[data-modo="visita"]').click();
  await page.waitForTimeout(800);
  fase.visitaParada = await ocioso(page, cdp, opcoes.janela || 4000);
  await page.locator('[data-modo="planta2d"]').click();
  await page.waitForTimeout(500);
  fase.planta2dParada = await ocioso(page, cdp, opcoes.janela || 4000);
  fase.memoriaTudo = await memoria(page, cdp);
  // Revisita no mesmo aparelho (cache quente), até a luz externa.
  const b1 = bytes, r0 = Date.now();
  await page.goto(url, { waitUntil: 'commit' });
  await page.evaluate(([e]) => { __marca('exterior', e); }, [ad.exterior]);
  await page.waitForFunction(ad.exterior, null, { timeout: 300000, polling: 50 });
  fase.revisita = { bytes: bytes - b1, luzExterior: await page.evaluate(() => __gl.pronto.exterior) };
  fase.bytesPorRecurso = porUrl;
  fase.erros = erros.slice(0, 20);
  fase.totalMs = Date.now() - t0;
  await ctx.close();
  fs.rmSync(perfilDir, { recursive: true, force: true });
  return fase;
}

async function memoria(page, cdp) {
  const h = await cdp.send('Runtime.getHeapUsage');
  const g = await page.evaluate(() => {
    const c = document.querySelector('canvas#c') || document.querySelector('canvas');
    const a = __gl.contexto || {}; const px = c ? c.width * c.height : 0;
    // tela padrão: cor + profundidade/stencil, multiplicadas pelas amostras do MSAA
    const tela = px * (4 + 4) * (a.antialias ? 4 : 1) + px * 4;
    return { gpuMiB: +((__gl.mem + tela) / 1048576).toFixed(1), texturasMiB: +(__gl.tex / 1048576).toFixed(1),
             buffersMiB: +(__gl.buf / 1048576).toFixed(1), alvosMiB: +((__gl.rb + tela) / 1048576).toFixed(1),
             picoGpuMiB: +((__gl.pico + tela) / 1048576).toFixed(1), canvas: c ? [c.width, c.height] : null,
             msaa: !!a.antialias };
  });
  return { ...g, heapJsMiB: +(h.usedSize / 1048576).toFixed(1) };
}

function mediana(xs) { const a = xs.filter(x => typeof x === 'number').sort((p, q) => p - q); return a.length ? a[a.length >> 1] : null; }

async function main() {
  const versao = arg('versao', 'base'), ad = ADAPTADORES[versao];
  const perfis = arg('perfis', Object.keys(PERFIS).join(',')).split(',');
  const reps = Number(arg('repeticoes', 3));
  const pasta = ad.pasta();
  const srv = await servir(pasta);
  const saida = { versao, quando: new Date().toISOString(), maquina: `${os.cpus()[0].model} x${os.cpus().length}`,
                  render: 'SwiftShader (software)', perfis: {} };
  for (const pn of perfis) {
    const runs = [];
    for (let i = 0; i < reps; i++) {
      process.stderr.write(`${versao} ${pn} ${i + 1}/${reps}... `);
      // A v4 é medida no perfil que um aparelho dessa classe recebe, com a resolução fixa
      // (`drs=0`): sem GPU, o governador derrubaria a resolução e a comparação ficaria injusta
      // a favor dela.
      const query = arg('query', versao === 'nova' ? `?q=${PERFIS[pn].qNova}&drs=0` : '');
      const r = await medirUma(srv.url, ad, pn, { query });
      process.stderr.write(`luz ${Math.round(r.abrir.luzExterior)} ms, ${(r.abrir.bytes / 1e6).toFixed(2)} MB\n`);
      runs.push(r);
    }
    const m = f => mediana(runs.map(f));
    saida.perfis[pn] = {
      perfil: PERFIS[pn],
      mediana: {
        primeiraImagemMs: m(r => r.abrir.primeiraImagem), primeiroDesenhoMs: m(r => r.abrir.primeiroDesenho),
        luzExteriorMs: m(r => r.abrir.luzExterior),
        htmlMs: m(r => r.abrir.html), bytesAbrir: m(r => r.abrir.bytes), planta3dMs: m(r => r.planta3d.ms),
        bytesPlanta3d: m(r => r.planta3d.bytes), bytesRevisita: m(r => r.revisita.bytes),
        revisitaLuzMs: m(r => r.revisita.luzExterior),
      },
      execucoes: runs,
    };
  }
  await srv.fechar();
  const destino = arg('saida', path.join(AQUI, 'resultados', `${versao}.json`));
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(saida, null, 2));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(saida.perfis).map(([k, v]) => [k, v.mediana])), null, 1));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
