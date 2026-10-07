// Aba anônima: o cache do Chrome fica só em memória (2% da RAM, até 50 MB) e cada arquivo
// pode ter no máximo 1/8 disso. Mede, na MESMA aba anônima, o primeiro acesso e a volta à
// maquete (e o apartamento), nas duas versões.
//   node medicoes/anonima.mjs [--perfil desktop] [--saida medicoes/resultados/anonima.json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';
import { PERFIS, ADAPTADORES, GANCHO, ARGS_CHROME, chromePath } from './medir.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : p; };
const pn = arg('perfil', 'desktop'), P = PERFIS[pn];
const saida = { quando: new Date().toISOString(), perfil: pn, memoriaGiB: +(os.totalmem() / 2 ** 30).toFixed(1), versoes: {} };

for (const versao of ['base', 'nova']) {
  const ad = ADAPTADORES[versao];
  const srv = await servir(ad.pasta());
  const nav = await chromium.launch({ executablePath: chromePath(), headless: true, args: ARGS_CHROME });
  const ctx = await nav.newContext({ viewport: P.viewport, deviceScaleFactor: P.dpr, isMobile: P.mobile, hasTouch: P.mobile });
  await ctx.addInitScript(GANCHO);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  const pedidos = new Map();
  cdp.on('Network.requestWillBeSent', e => pedidos.set(e.requestId, { url: e.request.url, origem: 'rede' }));
  cdp.on('Network.requestServedFromCache', e => { const p = pedidos.get(e.requestId); if (p) p.origem = 'cache'; });
  cdp.on('Network.responseReceived', e => { const p = pedidos.get(e.requestId); if (!p) return;
    if (e.response.fromDiskCache || e.response.fromServiceWorker) p.origem = 'cache'; else if (e.response.status === 304) p.origem = '304'; });
  cdp.on('Network.loadingFinished', e => { const p = pedidos.get(e.requestId); if (p) p.bytes = e.encodedDataLength; });
  const q = versao === 'nova' ? `?q=${P.qNova}&drs=0` : '';
  const url = `${srv.url}/${ad.pagina}${q}`;
  const trecho = async fn => {
    const antes = new Set(pedidos.keys());
    await fn();
    await page.waitForTimeout(2000);
    const novos = [...pedidos.entries()].filter(([id]) => !antes.has(id)).map(([, p]) => p).filter(p => /^http/.test(p.url));
    return { bytes: novos.reduce((s, p) => s + (p.bytes || 0), 0),
             daRede: novos.filter(p => p.origem === 'rede' && (p.bytes || 0) > 1e5)
               .map(p => ({ recurso: p.url.replace(srv.url, '').split('?')[0], bytes: p.bytes })) };
  };
  const abre = () => trecho(async () => {
    await page.goto(url, { waitUntil: 'commit' });
    await page.waitForFunction(ad.exterior, null, { timeout: 300000, polling: 100 });
  });
  const entra = () => trecho(async () => {
    await page.locator('[data-modo="planta3d"]').click();
    await page.waitForFunction(ad.interior, null, { timeout: 300000, polling: 100 });
  });
  const r = {};
  r.primeiroAcesso = await abre();
  r.planta3d = await entra();
  await page.goto('about:blank');
  r.volta = await abre();
  r.voltaPlanta3d = await entra();
  saida.versoes[versao] = r;
  console.log(versao, Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.bytes])));
  await nav.close();
  await srv.fechar();
}
const destino = arg('saida', path.join(AQUI, 'resultados', 'anonima.json'));
fs.writeFileSync(destino, JSON.stringify(saida, null, 2));
