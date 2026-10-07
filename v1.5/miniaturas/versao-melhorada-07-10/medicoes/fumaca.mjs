// Teste de fumaça da v4: abre a página montada, espera a luz externa, percorre os quatro
// modos, abre o editor e liga/desliga um interruptor; falha em erro de página, recurso 404
// ou luz que não carrega. Grava capturas em medicoes/capturas/.
//   node medicoes/fumaca.mjs [--q alto|medio|baixo] [--largura 1280] [--celular]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, '..');
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : p; };
const celular = process.argv.includes('--celular');
const q = arg('q', '');
const CAP = path.join(AQUI, 'capturas'); fs.mkdirSync(CAP, { recursive: true });
const exe = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(c => c && fs.existsSync(c));

const srv = await servir(path.join(PASTA, 'publicado'));
const b = await chromium.launch({ executablePath: exe, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext(celular
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
  : { viewport: { width: Number(arg('largura', 1280)), height: 900 } });
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', e => erros.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') erros.push(m.type() + ': ' + m.text()); });
p.on('response', r => { if (r.status() >= 400) erros.push(r.status() + ' ' + r.url()); });
const nome = (celular ? 'celular' : 'desktop') + (q ? '-' + q : '');
const t0 = Date.now();
await p.goto(`${srv.url}/maquete-monte-dos-cedros-37.html${q ? '?q=' + q : ''}`);
await p.waitForFunction('window.__miniatura && __miniatura.estado.exterior !== "carregando"', null, { timeout: 120000 });
const est = await p.evaluate(() => ({ ...__miniatura.estado, perfil: __miniatura.perfil.nome, origem: __miniatura.qualidade.origem,
  gpu: __miniatura.qualidade.placa.gpu }));
console.log('exterior', est, Date.now() - t0, 'ms');
if (est.exterior !== 'pronto') throw new Error('luz externa: ' + est.erro);
await p.waitForTimeout(600);
await p.locator('#c').screenshot({ path: path.join(CAP, `${nome}-maquete.png`) });
await p.locator('#verConjunto').click(); await p.waitForTimeout(600);
await p.locator('#c').screenshot({ path: path.join(CAP, `${nome}-conjunto.png`) });
await p.locator('#verConjunto').click();
for (const modo of ['planta2d', 'planta3d', 'visita', 'maquete']) {
  await p.locator(`[data-modo="${modo}"]`).click();
  if (modo === 'planta3d' || modo === 'visita') {
    await p.waitForFunction('["pronto","erro"].includes(__miniatura.estado.interior)', null, { timeout: 120000 });
    const e = await p.evaluate(() => __miniatura.estado);
    if (e.interior !== 'pronto') throw new Error('luz interna: ' + e.erro);
  }
  await p.waitForTimeout(700);
  if (await p.evaluate(() => __maq.modo()) !== modo) throw new Error('modo ' + modo);
  await p.screenshot({ path: path.join(CAP, `${nome}-${modo}.png`) });
}
// Editor e interruptores: a luz calculada precisa ceder à dinâmica, como no padrão aprovado.
await p.locator('[data-modo="planta3d"]').click(); await p.waitForTimeout(400);
const ed = await p.evaluate(() => { const e = __maq.editor(); e.abrir(); e.seleciona(0); e.altera('rot', 1); return { n: e.estado.moveis.length }; });
await p.waitForTimeout(500);
const v3 = await p.evaluate(() => ({ desativada: __bakeV3.disabled, mapas: __bakeV3.materials.every(m => m.lightMapIntensity === 0) }));
console.log('editor', ed, 'luz calculada desativada após mover:', v3);
await p.screenshot({ path: path.join(CAP, `${nome}-editor.png`) });
await p.evaluate(() => __maq.editor().fechar());
// Visita: interruptor de um cômodo e caminhada pelo teclado (quadros sob demanda precisam
// continuar enquanto a tecla está apertada, e parar quando ela solta).
await p.locator('[data-modo="visita"]').click(); await p.waitForTimeout(400);
await p.locator('#interruptores summary').click();
await p.locator('#interruptores button').first().click(); await p.waitForTimeout(400);
const luzes = await p.evaluate(() => ({ dinamica: __roomLights.group.visible, desligado: __roomLights.rooms[0].on === false }));
if (!luzes.dinamica || !luzes.desligado) throw new Error('interruptor não ligou a luz dinâmica: ' + JSON.stringify(luzes));
const x0 = await p.evaluate(() => [__maq.FP.x, __maq.FP.z]);
await p.keyboard.down('w'); await p.waitForTimeout(700); await p.keyboard.up('w');
const x1 = await p.evaluate(() => [__maq.FP.x, __maq.FP.z]);
const andou = Math.hypot(x1[0] - x0[0], x1[1] - x0[1]);
await p.waitForTimeout(600);
const parou = await p.evaluate(() => { const l = __miniatura.laco(); return !l.pendente || !l.sujo; });
console.log('interruptor', luzes, 'caminhou', andou.toFixed(2), 'm; laço parado depois:', parou);
if (!(andou > 0.05)) throw new Error('a visita não andou com a tecla W');
await p.screenshot({ path: path.join(CAP, `${nome}-interruptor.png`) });
const fps = await p.evaluate(() => __miniatura.governador.dpr);
console.log('dpr governador', fps, 'erros:', erros.length);
for (const e of erros) console.log('  ', e);
await b.close(); await srv.fechar();
if (erros.some(e => !/^warning/.test(e))) process.exit(1);
