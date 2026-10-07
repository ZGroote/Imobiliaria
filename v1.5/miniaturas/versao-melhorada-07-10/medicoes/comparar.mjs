// Comparação visual: a versão aprovada (base) e a v4 nas MESMAS poses de câmera, mesmo
// tamanho de tela, sem resolução dinâmica. Grava as capturas e a diferença pixel a pixel
// (medicoes/comparacao/), e o resumo em medicoes/resultados/comparacao-<q>.json.
//   node medicoes/comparar.mjs [--q alto|medio|baixo]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { servir } from './servidor.mjs';
import { ADAPTADORES } from './medir.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, '..');
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : p; };
const q = arg('q', 'alto');
// --celular: as duas versões como num celular (toque, tela de 390 px, DPR 3). A versão atual
// então usa a configuração aprovada para celular (sem MSAA, DPR 1,25, sombra 1024), que é a
// referência justa para o perfil médio.
const CELULAR = process.argv.includes('--celular');
const extra = arg('extra', '');
const sufixo = (CELULAR ? '-celular' : '') + (extra ? '-' + extra.replace(/[^a-z0-9]+/gi, '') : '');
const SAIDA = path.join(AQUI, 'comparacao'); fs.mkdirSync(SAIDA, { recursive: true });
const exe = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(c => c && fs.existsSync(c));

const POSES = [
  // aquecimento: o primeiro toque troca a dica e reinicia o relógio do giro; não entra na conta
  { nome: 'aquecimento', prep: async p => {}, orb: { th: 0.95, ph: 1.03 }, descarta: true },
  { nome: 'maquete', prep: async p => {}, orb: { th: 0.95, ph: 1.03 } },
  { nome: 'maquete-fundos', prep: async p => {}, orb: { th: 3.6, ph: 1.15 } },
  { nome: 'conjunto', prep: async p => { await p.locator('#verConjunto').click(); }, orb: { th: 0.72, ph: 1.03 } },
  { nome: 'planta3d', prep: async (p, ad) => {
      // relógio solto enquanto o interior carrega (o laço precisa andar), congelado de novo depois
      await p.evaluate(() => { window.__congelado = null; });
      await p.locator('[data-modo="planta3d"]').click();
      await p.waitForFunction(ad.interior, null, { timeout: 180000 }); await p.waitForTimeout(800);
      await p.evaluate(() => { window.__congelado = performance.now(); }); },
    orb: { th: 0.95, ph: 0.72 }, semClique: true },
  { nome: 'visita-sala', prep: async p => { await p.evaluate(() => { window.__congelado = null; });
      await p.locator('[data-modo="visita"]').click(); await p.waitForTimeout(800);
      await p.evaluate(() => { window.__congelado = performance.now(); }); },
    fp: { x: -2.35, z: -1.72, yaw: Math.atan2(1.75, -2.47), pitch: -0.12 } },
  { nome: 'visita-teto', prep: async () => {}, fp: { x: -2.35, z: -1.72, yaw: Math.atan2(1.75, -2.47), pitch: 0.35 } },
];

let camera = {};
const cameras = {};
async function capturas(versao, query) {
  const ad = ADAPTADORES[versao];
  const srv = await servir(ad.pasta());
  const b = await chromium.launch({ executablePath: exe, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(CELULAR
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 900 } });
  // Relógio da animação congelável: com ele parado, o giro e o pulso do andar não andam
  // entre a pose e a captura (o quadro da versão atual leva centenas de ms em software).
  await p.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window); window.__congelado = null;
    window.requestAnimationFrame = cb => raf(t => cb(window.__congelado !== null ? window.__congelado : t));
  });
  await p.goto(`${srv.url}/${ad.pagina}${query}`);
  // A v4 não tem o "Ver mapa": na versão atual ele ocupa uma linha a mais na ficha do
  // celular e muda a proporção do painel 3D. Escondido aqui, os dois painéis ficam iguais.
  if (versao === 'base') await p.addStyleTag({ content: '#verMapa{display:none!important}' });
  await p.waitForFunction(ad.exterior, null, { timeout: 180000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { window.__congelado = performance.now(); });
  await p.waitForTimeout(500);
  const arquivos = {}; camera = {};
  for (const pose of POSES) {
    await pose.prep(p, ad);
    // Um toque para o giro automático parar (é o próprio comportamento da página) e a pose.
    // Só a maquete gira sozinha; na planta e na visita um clique mudaria o pivô/destino.
    // No rasterizador de software um quadro da versão atual leva centenas de ms e o giro
    // volta 2,2 s depois do toque: a câmera é conferida antes e depois da captura e, se
    // mudou no meio, a pose é refeita.
    const leCamera = () => p.evaluate(() => [__maq.cam.position.toArray(), __maq.cam.quaternion.toArray(),
      __maq.cam.fov, __maq.ren.domElement.width, __maq.ren.domElement.height].flat().map(v => +v.toFixed(5)));
    const f = path.join(SAIDA, `${pose.nome}-${versao}${versao === 'nova' ? '-' + q : ''}${sufixo}.png`);
    let ok = false;
    for (let tentativa = 0; tentativa < 6 && !ok; tentativa++) {
      await p.evaluate(([o, fp]) => {
        if (o) { __maq.orb.th = o.th; __maq.orb.ph = o.ph; }
        if (fp) Object.assign(__maq.FP, fp);
        if (__maq.suja) __maq.suja();
      }, [pose.orb, pose.fp]);
      // Dois quadros com o relógio congelado, chamados direto (a "porta pro QA" do padrão),
      // e a imagem lida do próprio canvas na mesma tarefa do desenho: não depende de o
      // navegador sem tela continuar agendando quadros.
      const antes = await leCamera();
      const dataUrl = await p.evaluate(() => { if (__maq.suja) __maq.suja(); __maq.quadro(window.__congelado);
        if (__maq.suja) __maq.suja(); __maq.quadro(window.__congelado);
        return __maq.ren.domElement.toDataURL('image/png'); });
      fs.writeFileSync(f, Buffer.from(dataUrl.split(',')[1], 'base64'));
      const depois = await leCamera();
      const naPose = await p.evaluate(([o]) => !o || Math.abs(__maq.orb.th - o.th) < 1e-9, [pose.orb]);
      ok = naPose;
      if (!ok && process.env.DEPURA) console.log(versao, pose.nome, tentativa, antes.slice(0, 3), depois.slice(0, 3));
      camera[pose.nome] = depois;
    }
    if (!ok) throw new Error('a câmera não parou na pose ' + pose.nome);
    arquivos[pose.nome] = f;
  }
  await b.close(); await srv.fechar();
  cameras[versao] = camera;
  return arquivos;
}

const base = await capturas('base', '');
const nova = await capturas('nova', `?q=${q}&drs=0${extra ? '&' + extra : ''}`);
const py = String.raw`
import json,sys
import numpy as np
from PIL import Image
pares=json.loads(sys.argv[1]);saida=sys.argv[2];res={}
for nome,(a,b) in pares.items():
    def rgb(f):
        im=Image.open(f).convert('RGBA');fundo=Image.new('RGBA',im.size,(14,20,27,255));return np.asarray(Image.alpha_composite(fundo,im).convert('RGB')).astype(np.float32)
    A=rgb(a);B=rgb(b)
    h=min(A.shape[0],B.shape[0]);w=min(A.shape[1],B.shape[1]);A=A[:h,:w];B=B[:h,:w]
    d=np.abs(A-B).max(-1);mse=((A-B)**2).mean()
    res[nome]={'psnr':round(float(10*np.log10(255**2/max(mse,1e-9))),2),'difMedia':round(float(d.mean()),3),
               'pctAcima8':round(float((d>8).mean()*100),3),'pctAcima24':round(float((d>24).mean()*100),3),'tamanho':[w,h]}
    Image.fromarray(np.uint8(np.clip(d*6,0,255))).save(saida+'/'+nome+sys.argv[3]+'-diferenca.png')
print(json.dumps(res))
`;
const pares = Object.fromEntries(Object.keys(base).filter(k => k !== 'aquecimento').map(k => [k, [base[k], nova[k]]]));
const out = execFileSync(process.env.PYTHON || 'python3', ['-c', py, JSON.stringify(pares), SAIDA, '-' + q + sufixo]).toString();
const res = JSON.parse(out);
fs.mkdirSync(path.join(AQUI, 'resultados'), { recursive: true });
fs.writeFileSync(path.join(AQUI, 'resultados', `comparacao-${q}${sufixo}.json`), JSON.stringify({ q, celular: CELULAR, extra, quando: new Date().toISOString(),
  render: 'SwiftShader', poses: res, cameras }, null, 2));
for (const k of Object.keys(res)) res[k].mesmaCamera = JSON.stringify(cameras.base[k]) === JSON.stringify(cameras.nova[k]);
for (const k of Object.keys(res)) if (!res[k].mesmaCamera) console.log('camera diferente em', k, cameras.base[k], cameras.nova[k]);
console.table(res);
