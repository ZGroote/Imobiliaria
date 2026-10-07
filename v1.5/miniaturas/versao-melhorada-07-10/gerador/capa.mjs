// A CAPA: a primeira imagem da página, antes de qualquer 3D. É o próprio visualizador v4
// na pose de abertura (prédio da unidade, giro em 0,72 rad), com a luz calculada, sem
// fundo -- então ocupa o mesmo lugar e tem o mesmo enquadramento do primeiro quadro 3D, e
// a troca é um esmaecimento, não um salto. WebP com transparência, ~30-60 KB.
//
//   node gerador/capa.mjs [--imovel monte-dos-cedros-37]
// Precisa do site montado (gerador/montar.mjs) e de um Chrome/Chromium. Grava em
// derivados/<imovel>/capa.webp; rode o montar.mjs de novo para ela entrar na página.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { servir } from '../medicoes/servidor.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, '..');
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : p; };
const ID = arg('imovel', 'monte-dos-cedros-37');
const exe = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', '/usr/bin/google-chrome'].find(c => c && fs.existsSync(c));
if (!exe) { console.log('sem Chrome/Chromium: a página sai sem capa'); process.exit(0); }

const srv = await servir(path.join(PASTA, 'publicado'));
const b = await chromium.launch({ executablePath: exe, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// Duas proporções de painel: a do computador (~1,6) e a do celular em pé (~0,9). A página
// escolhe pela largura da tela (<picture>), e o 3D que aparece depois tem quase o mesmo
// enquadramento.
const FORMATOS = [{ nome: 'capa', w: 960, h: 600 }, { nome: 'capa-estreita', w: 540, h: 600 }];
const pngs = {};
for (const F of FORMATOS) {
  const p = await b.newPage({ viewport: { width: F.w + 200, height: F.h + 480 }, deviceScaleFactor: 1 });
  await p.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window); window.__congelado = null;
    window.requestAnimationFrame = cb => raf(t => cb(window.__congelado !== null ? window.__congelado : t));
  });
  await p.goto(`${srv.url}/maquete-${ID}.html?q=alto&drs=0`);
  await p.addStyleTag({ content: `.folha{max-width:${F.w}px!important}#cena{height:${F.h}px!important;flex:none!important}#capa{display:none}` });
  await p.waitForFunction('window.__miniatura && __miniatura.estado.exterior !== "carregando"', null, { timeout: 180000 });
  if (await p.evaluate(() => __miniatura.estado.exterior) !== 'pronto') throw new Error('luz externa não carregou');
  await p.evaluate(() => { window.__congelado = performance.now(); });
  pngs[F.nome] = await p.evaluate(() => {
    __maq.orb.th = 0.72; __maq.orb.ph = 1.03; __maq.suja(); __maq.quadro(window.__congelado);
    __maq.suja(); __maq.quadro(window.__congelado);
    return __maq.ren.domElement.toDataURL('image/png');
  });
  await p.close();
}
await b.close(); await srv.fechar();
for (const [nome, png] of Object.entries(pngs)) {
  const tmp = path.join(PASTA, 'derivados', ID, `_${nome}.png`);
  fs.writeFileSync(tmp, Buffer.from(png.split(',')[1], 'base64'));
  const destino = path.join(PASTA, 'derivados', ID, `${nome}.webp`);
  execFileSync(process.env.PYTHON || 'python3', ['-c', `
from PIL import Image
Image.open(r'${tmp}').convert('RGBA').save(r'${destino}','WEBP',quality=82,method=6,alpha_quality=90)
`], { stdio: 'inherit' });
  fs.unlinkSync(tmp);
  console.log(nome, destino, fs.statSync(destino).size, 'bytes');
}
