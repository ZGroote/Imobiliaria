// A CAPA do mapa: a cidade na pose de abertura, renderizada pelo próprio mapa v2, mostrada
// pelo HTML antes de qualquer dado chegar. No celular fraco os dados levam dezenas de
// segundos para descer; com a capa a pessoa já vê a cidade no primeiro segundo, e o 3D a
// substitui com um esmaecimento quando o bairro em volta já está montado.
//
//   node gerador/capa.mjs           (precisa do site montado: node gerador/montar.mjs)
// Grava derivados/capa/capa.webp (computador) e capa-estreita.webp (celular em pé), fora
// do git (imagem só versiona em pasta classificada). Rode o montar.mjs de novo depois.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { paginaDe, ARGS, CHROME, PRONTO } from '../medicoes/compara.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, '..');
const MED = path.resolve(PASTA, '..', 'miniaturas', 'versao-melhorada-07-10', 'medicoes');
const { servir } = await import(path.join(MED, 'servidor.mjs'));
if (!fs.existsSync(CHROME)) { console.log('sem Chromium: o site sai sem capa'); process.exit(0); }

const raiz = path.join(PASTA, 'publicado');
const srv = await servir(raiz);
const nav = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
const DESTINO = path.join(PASTA, 'derivados', 'capa');
fs.mkdirSync(DESTINO, { recursive: true });
// Duas proporções: a do computador e a do celular em pé. A página escolhe pela largura
// (<picture>), e o primeiro quadro 3D tem o mesmo enquadramento (mesmo campo de visão
// vertical, mesma pose).
const FORMATOS = [{ nome: 'capa', w: 1366, h: 768 }, { nome: 'capa-estreita', w: 412, h: 860 }];
for (const F of FORMATOS) {
  const page = await (await nav.newContext({ viewport: { width: F.w, height: F.h }, deviceScaleFactor: 1 })).newPage();
  await page.goto(`${srv.url}/${paginaDe(raiz)}?q=alto`, { waitUntil: 'commit' });
  await page.waitForFunction(PRONTO, null, { timeout: 1800000, polling: 500 });
  await page.waitForTimeout(1500);
  // Só o canvas: painéis, rótulos e a própria capa saem da foto (eles continuam por cima
  // da capa na página, como continuam por cima do 3D).
  await page.addStyleTag({ content: 'body > *:not(#c){visibility:hidden!important} #c{visibility:visible!important}' });
  await page.waitForTimeout(800);
  const tmp = path.join(DESTINO, `_${F.nome}.png`);
  await page.locator('#c').screenshot({ path: tmp });
  const destino = path.join(DESTINO, `${F.nome}.webp`);
  execFileSync(process.env.PYTHON || 'python3', ['-c', `
from PIL import Image
Image.open(r'${tmp}').convert('RGB').save(r'${destino}', 'WEBP', quality=72, method=6)
`], { stdio: 'inherit' });
  fs.unlinkSync(tmp);
  console.log(F.nome, path.relative(PASTA, destino), fs.statSync(destino).size, 'bytes');
  await page.context().close();
}
await nav.close(); await srv.fechar();
