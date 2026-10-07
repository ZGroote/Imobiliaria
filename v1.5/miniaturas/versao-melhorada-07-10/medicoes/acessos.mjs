// Estudo de acessos repetidos: quanto custa o SEGUNDO acesso da mesma pessoa -- à mesma
// maquete ou a outra -- em bytes que o servidor manda e em tempo, na versão atual (v3) e na v4.
//
//   node medicoes/acessos.mjs [--versoes base,nova] [--perfis desktop,celular-4g,celular-fraco]
//                             [--repeticoes 3] [--saida medicoes/resultados/acessos.json]
//
// Cada execução usa um perfil de navegador novo, persistente em disco, e o fecha entre as
// sessões (fechar e reabrir = "voltar outro dia": só o cache em disco sobrevive, como num
// celular). Sessões, na ordem:
//   1. primeiro acesso à maquete A (cache vazio), até a luz calculada do prédio;
//   2. volta à maquete A; depois "recarregar" (F5 / puxar para atualizar); depois entra na
//      Planta 3D pela primeira vez;
//   3. volta à maquete A e entra na Planta 3D de novo (tudo já visto);
//   4. abre a maquete B, outro imóvel do mesmo site, e entra na Planta 3D dele;
//   5. volta à maquete A depois de uma publicação nova (uma correção no código).
//
// A maquete B é a A com outro endereço para os dados do imóvel (mesmos bytes, então custa
// o mesmo que um imóvel do mesmo porte); o código e as bibliotecas ficam onde estão, como
// numa publicação real. A "publicação nova" muda o código: na v4, o pedaço principal ganha
// outro nome (hash) e o HTML aponta para ele; na v3, muda o HTML (que embute o código).
//
// Os bytes são contados dos dois lados: no servidor (corpo de cada resposta, o que o Hosting
// cobra, fora cabeçalhos) e no navegador (DevTools Protocol, com cabeçalhos e a origem de
// cada recurso: rede, 304 ou cache). Os dois têm de bater.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';
import { PERFIS, ADAPTADORES, GANCHO, ARGS_CHROME, chromePath, imagens } from './medir.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : p; };
const PAGINA_A = 'maquete-monte-dos-cedros-37.html', PAGINA_B = 'maquete-imovel-b.html';

// ---- o site de teste: A, B e a publicação nova de A -----------------------------------
function preparaSite(versao) {
  const origem = ADAPTADORES[versao].pasta();
  const raiz = path.join(os.tmpdir(), `miniatura-acessos-${versao}`);
  fs.rmSync(raiz, { recursive: true, force: true });
  fs.cpSync(origem, raiz, { recursive: true });
  const htmlA = fs.readFileSync(path.join(raiz, PAGINA_A), 'utf8');
  let htmlB, htmlNovo;
  if (versao === 'nova') {
    const de = 'assets/monte-dos-cedros-37/', para = 'assets/imovel-b/';
    fs.cpSync(path.join(raiz, de), path.join(raiz, para), { recursive: true });
    htmlB = htmlA.replaceAll(de, para);
    const entrada = htmlA.match(/app\/miniatura-[A-Z0-9]+\.js/)[0];
    const nova = 'app/miniatura-PUB4001X.js';
    fs.writeFileSync(path.join(raiz, nova), fs.readFileSync(path.join(raiz, entrada), 'utf8') + '\n// 4.0.1\n');
    htmlNovo = htmlA.replaceAll(entrada, nova);
  } else {
    const rel = htmlA.match(/assets\/cedros\/([0-9a-f]{16})\//)[1];
    const de = `assets/cedros/${rel}/`, para = 'assets/cedros/b0b0b0b0b0b0b0b0/';
    fs.cpSync(path.join(raiz, de), path.join(raiz, para), { recursive: true });
    htmlB = htmlA.replaceAll(de, para);
    htmlNovo = htmlA.replace('</html>', '<!-- correção 3.0.1 -->\n</html>');
    if (htmlNovo === htmlA) htmlNovo = htmlA + '\n<!-- correção 3.0.1 -->\n';
  }
  if (htmlB === htmlA) throw new Error('a maquete B ficou igual à A');
  fs.writeFileSync(path.join(raiz, PAGINA_B), htmlB);
  // A página A troca de conteúdo entre as sessões; o ETag do servidor depende do tamanho e
  // da data, então cada variante tem data fixa (a original volta com o mesmo ETag).
  const t0 = fs.statSync(path.join(raiz, PAGINA_A)).mtime;
  const variantes = { original: { html: htmlA, t: t0 }, nova: { html: htmlNovo, t: new Date(t0.getTime() + 1e6) } };
  const usaA = v => { const arq = path.join(raiz, PAGINA_A); fs.writeFileSync(arq, variantes[v].html); fs.utimesSync(arq, variantes[v].t, variantes[v].t); };
  usaA('original');
  return { raiz, usaA };
}

// O servidor comprime o HTML na primeira vez que o vê; isso é feito antes de cada sessão,
// fora da medida (o Hosting entrega a versão comprimida já pronta).
function aquece(url) {
  return new Promise((ok, erro) => http.get(url, { headers: { 'accept-encoding': 'br' } }, r => { r.resume(); r.on('end', ok); }).on('error', erro));
}

// ---- uma sessão de navegador -------------------------------------------------------------
async function abreSessao(perfilDir, P, servidor) {
  const ctx = await chromium.launchPersistentContext(perfilDir, { executablePath: chromePath(), headless: true,
    args: ARGS_CHROME, viewport: P.viewport, deviceScaleFactor: P.dpr, isMobile: P.mobile, hasTouch: P.mobile,
    userAgent: P.mobile ? 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' : undefined });
  await ctx.addInitScript(GANCHO);
  const page = ctx.pages()[0] || await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: P.rede.latency,
    downloadThroughput: P.rede.down / 8, uploadThroughput: P.rede.up / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: P.cpu });
  const pedidos = new Map();
  let ultimo = Date.now();
  const marca = () => { ultimo = Date.now(); };
  cdp.on('Network.requestWillBeSent', e => { marca(); if (!pedidos.has(e.requestId)) pedidos.set(e.requestId, { url: e.request.url, origem: 'rede' }); });
  cdp.on('Network.requestServedFromCache', e => { const p = pedidos.get(e.requestId); if (p) p.origem = 'cache'; });
  cdp.on('Network.responseReceived', e => { marca(); const p = pedidos.get(e.requestId); if (!p) return;
    p.status = e.response.status;
    if (e.response.fromDiskCache || e.response.fromPrefetchCache || e.response.fromServiceWorker) p.origem = 'cache';
    else if (e.response.status === 304) p.origem = '304'; });
  cdp.on('Network.loadingFinished', e => { marca(); const p = pedidos.get(e.requestId); if (p) { p.fim = true; p.bytes = e.encodedDataLength; } });
  cdp.on('Network.loadingFailed', e => { marca(); const p = pedidos.get(e.requestId); if (p) { p.fim = true; p.falhou = e.errorText; p.bytes = 0; } });
  servidor.ouvinte = marca;

  // Um trecho: tudo o que foi pedido entre começo e fim, dos dois lados.
  function trecho() {
    const ids = new Set(pedidos.keys()), reg0 = servidor.log.length;
    return {
      fecha() {
        const novos = [...pedidos.entries()].filter(([id]) => !ids.has(id)).map(([, p]) => p);
        const rel = u => u.replace(servidor.url, '').split('?')[0];
        const recursos = novos.filter(p => /^https?:/.test(p.url)).map(p => ({ recurso: rel(p.url), origem: p.origem,
          status: p.status ?? null, bytesNavegador: p.bytes ?? 0, falhou: p.falhou }));
        const srv = servidor.log.slice(reg0);
        const soma = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
        return {
          bytesServidor: soma(srv, r => r.bytes), respostas200: srv.filter(r => r.status === 200).length,
          respostas304: srv.filter(r => r.status === 304).length, respostas404: srv.filter(r => r.status === 404).length,
          bytesNavegador: soma(recursos, r => r.bytesNavegador),
          doCache: recursos.filter(r => r.origem === 'cache').length,
          recursos, servidor: srv,
        };
      },
    };
  }
  // Espera a rede ficar quieta (sem pedido novo nem resposta por `ms`).
  async function silencio(ms = 1500, max = 30000) {
    const t = Date.now();
    while (Date.now() - t < max) { if (Date.now() - ultimo > ms && [...pedidos.values()].every(p => p.fim || !/^https?:/.test(p.url))) return;
      await page.waitForTimeout(200); }
  }
  return { ctx, page, erros, trecho, silencio };
}

async function abreMaquete(s, url, ad, recarregar = false) {
  const tr = s.trecho();
  const t0 = Date.now();
  if (recarregar) await s.page.reload({ waitUntil: 'commit', timeout: 600000 });
  else await s.page.goto(url, { waitUntil: 'commit', timeout: 600000 });
  await s.page.evaluate(([e]) => { __marca('exterior', e); }, [ad.exterior]);
  await s.page.waitForFunction(ad.exterior, null, { timeout: 600000, polling: 50 });
  const t = { luzMs: await s.page.evaluate(() => __gl.pronto.exterior), ...await imagens(s.page) };
  const erro = await s.page.evaluate(ad.erro);
  await s.silencio();
  return { ...t, primeiraImagemMs: t.primeiraImagem,
           totalMs: Date.now() - t0, erroPagina: erro, ...tr.fecha() };
}

async function entraPlanta3d(s, ad) {
  const tr = s.trecho();
  const t0 = Date.now();
  await s.page.locator('[data-modo="planta3d"]').click();
  await s.page.waitForFunction(ad.interior, null, { timeout: 600000, polling: 50 });
  const ms = Date.now() - t0;
  const erro = await s.page.evaluate(ad.erro);
  await s.silencio();
  return { ms, erroPagina: erro, ...tr.fecha() };
}

async function fecha(s) {
  // tempo para o cache em disco terminar de gravar antes de fechar o navegador
  await s.page.waitForTimeout(1000);
  await s.ctx.close();
}

async function umaExecucao(versao, perfilNome, site, servidor) {
  const P = PERFIS[perfilNome], ad = ADAPTADORES[versao];
  const q = versao === 'nova' ? `?q=${P.qNova}&drs=0` : '';
  const A = `${servidor.url}/${PAGINA_A}${q}`, B = `${servidor.url}/${PAGINA_B}${q}`;
  const perfilDir = fs.mkdtempSync(path.join(os.tmpdir(), 'miniatura-acessos-perfil-'));
  const r = {}, erros = [];
  const sessao = async (nome, fn) => {
    for (const p of [PAGINA_A, PAGINA_B]) await aquece(`${servidor.url}/${p}`);
    servidor.log.length = 0;
    const s = await abreSessao(perfilDir, P, servidor);
    try { await fn(s); } finally { erros.push(...s.erros.map(e => `${nome}: ${e}`)); await fecha(s); }
  };
  try {
    site.usaA('original');
    await sessao('1', async s => { r.primeiroAcesso = await abreMaquete(s, A, ad); });
    await sessao('2', async s => {
      r.voltaMesmaMaquete = await abreMaquete(s, A, ad);
      r.recarregar = await abreMaquete(s, A, ad, true);
      r.planta3dPrimeiraVez = await entraPlanta3d(s, ad);
    });
    await sessao('3', async s => {
      r.voltaComPlanta3d = await abreMaquete(s, A, ad);
      r.planta3dJaVista = await entraPlanta3d(s, ad);
    });
    await sessao('4', async s => {
      r.outraMaquete = await abreMaquete(s, B, ad);
      r.outraMaquetePlanta3d = await entraPlanta3d(s, ad);
    });
    site.usaA('nova');
    await sessao('5', async s => { r.depoisDePublicar = await abreMaquete(s, A, ad); });
  } finally {
    site.usaA('original');
    fs.rmSync(perfilDir, { recursive: true, force: true });
  }
  r.erros = erros.slice(0, 20);
  return r;
}

function mediana(xs) { const a = xs.filter(x => typeof x === 'number').sort((p, q) => p - q); return a.length ? a[a.length >> 1] : null; }
const CENARIOS = ['primeiroAcesso', 'voltaMesmaMaquete', 'recarregar', 'planta3dPrimeiraVez', 'voltaComPlanta3d',
                  'planta3dJaVista', 'outraMaquete', 'outraMaquetePlanta3d', 'depoisDePublicar'];

async function main() {
  const versoes = arg('versoes', 'base,nova').split(',');
  const perfis = arg('perfis', Object.keys(PERFIS).join(',')).split(',');
  const reps = Number(arg('repeticoes', 3));
  const destino = arg('saida', path.join(AQUI, 'resultados', 'acessos.json'));
  const saida = fs.existsSync(destino) ? JSON.parse(fs.readFileSync(destino, 'utf8')) : { versoes: {} };
  Object.assign(saida, { quando: new Date().toISOString(), maquina: `${os.cpus()[0].model} x${os.cpus().length}`,
                         render: 'SwiftShader (software)', cenarios: CENARIOS });
  for (const versao of versoes) {
    const site = preparaSite(versao);
    const servidor = { log: [], ouvinte: null };
    const srv = await servir(site.raiz, 0, { registro: (rel, status, bytes) => {
      servidor.log.push({ recurso: '/' + rel, status, bytes }); servidor.ouvinte?.(); } });
    servidor.url = srv.url;
    saida.versoes[versao] = { perfis: {} };
    for (const pn of perfis) {
      const runs = [];
      for (let i = 0; i < reps; i++) {
        process.stderr.write(`${versao} ${pn} ${i + 1}/${reps}... `);
        const r = await umaExecucao(versao, pn, site, servidor);
        process.stderr.write(CENARIOS.map(c => `${c} ${(r[c].bytesServidor / 1e6).toFixed(3)}MB`).join(' | ') + '\n');
        runs.push(r);
      }
      const med = {};
      for (const c of CENARIOS) {
        const m = f => mediana(runs.map(r => f(r[c])));
        med[c] = { bytesServidor: m(x => x.bytesServidor), bytesNavegador: m(x => x.bytesNavegador),
                   respostas200: m(x => x.respostas200), respostas304: m(x => x.respostas304),
                   respostas404: m(x => x.respostas404), doCache: m(x => x.doCache),
                   luzMs: m(x => x.luzMs), primeiraImagemMs: m(x => x.primeiraImagemMs), capaPintadaMs: m(x => x.capaPintada),
                   capaCarregadaMs: m(x => x.capaCarregada), primeiroDesenhoMs: m(x => x.primeiroDesenho), ms: m(x => x.ms) };
      }
      saida.versoes[versao].perfis[pn] = { perfil: PERFIS[pn], mediana: med, execucoes: runs };
    }
    await srv.fechar();
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, JSON.stringify(saida, null, 2));
  }
  for (const [v, x] of Object.entries(saida.versoes)) for (const [p, y] of Object.entries(x.perfis))
    console.log(v, p, Object.fromEntries(CENARIOS.map(c => [c, y.mediana[c].bytesServidor])));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
