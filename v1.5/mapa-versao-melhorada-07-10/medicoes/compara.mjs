// Comparação visual: a página de hoje (piloto montado pelo pipeline) × a v2, nas mesmas
// câmeras, depois de a cidade terminar de montar.
//
//   node medicoes/compara.mjs --base <pasta do piloto> [--nova publicado] [--saida medicoes/comparacao]
//                             [--vistas centro,bairro,rua] [--q baixo]
//
// Cada vista é um link de posição do próprio mapa (`?em=lat,lon&r=&p=&t=`, ver
// fonte/ui/position-link.js). As capturas vão para `--saida` (fora do git), e
// `python medicoes/psnr.py` mede a diferença.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, '..');
const MED = path.resolve(PASTA, '..', 'miniaturas', 'versao-melhorada-07-10', 'medicoes');
const { servir } = await import(path.join(MED, 'servidor.mjs'));
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : p; };

export const VISTAS = {
  // de cima, o centro de São Carlos
  centro: 'em=-22.01725,-47.89080&r=1400&p=0.70&t=0.55',
  // um bairro de casas visto a 45°
  bairro: 'em=-21.99640,-47.88180&r=420&p=0.95&t=0.30',
  // perto, quase rua
  rua: 'em=-21.99640,-47.88180&r=140&p=1.18&t=1.10',
};
export const PRONTO = 'window.__int && __int.grupos && __int.grupos().length > 0 && __int.vivos().size > 0 && window.__perf && __perf.fila() === 0 && (!__int.exteriors || __int.exteriors.stats().pendingTiles === 0)';
export const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

export function paginaDe(pasta) {
  const m = fs.readdirSync(path.join(pasta, 'mapa')).find(f => /^sao-carlos-[0-9a-f]{12}\.html$/.test(f));
  if (!m) throw new Error('sem página de mapa em ' + pasta);
  return 'mapa/' + m;
}

export async function captura(url, arquivo, { viewport = { width: 1366, height: 768 }, espera = 2500 } = {}) {
  const nav = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
  const ctx = await nav.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'commit', timeout: 600000 });
  await page.waitForFunction(PRONTO, null, { timeout: 600000, polling: 250 });
  const ms = Date.now() - t0;
  await page.waitForTimeout(espera);
  await page.screenshot({ path: arquivo });
  await nav.close();
  return { ms, erros };
}

async function main() {
  const base = path.resolve(arg('base'));
  const nova = path.resolve(PASTA, arg('nova', 'publicado'));
  const saida = path.resolve(PASTA, arg('saida', 'medicoes/comparacao'));
  fs.mkdirSync(saida, { recursive: true });
  const q = arg('q', '') ? `&q=${arg('q')}` : '';
  const sa = await servir(base), sb = await servir(nova);
  const pa = paginaDe(base), pb = paginaDe(nova);
  const res = {};
  for (const v of arg('vistas', Object.keys(VISTAS).join(',')).split(',')) {
    const qs = `?${VISTAS[v]}${q}`;
    // `--reusa-base`: a captura da página de hoje não muda entre rodadas da v2.
    const arqBase = path.join(saida, `${v}-base.png`);
    const a = process.argv.includes('--reusa-base') && fs.existsSync(arqBase) ? { ms: null, erros: [] }
      : await captura(`${sa.url}/${pa}${qs}`, arqBase);
    const b = await captura(`${sb.url}/${pb}${qs}`, path.join(saida, `${v}-nova.png`));
    res[v] = { base: a, nova: b };
    console.log(v, 'base', a.ms, 'ms', a.erros.length, 'erros | nova', b.ms, 'ms', b.erros.length, 'erros');
    for (const e of [...a.erros, ...b.erros].slice(0, 6)) console.log('   ', e.slice(0, 200));
  }
  fs.writeFileSync(path.join(saida, 'capturas.json'), JSON.stringify(res, null, 1));
  await sa.fechar(); await sb.fechar();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
