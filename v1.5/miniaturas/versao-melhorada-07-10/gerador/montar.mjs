// Monta o site publicável da v4 a partir de `fonte/` e `derivados/<imovel>/`.
//
//   node gerador/montar.mjs [--imovel monte-dos-cedros-37] [--saida publicado]
//
// - JavaScript empacotado e minificado pelo esbuild, com divisão de código: o interior e
//   o fflate viram pedaços carregados sob demanda.
// - three r168 e o transcodificador Basis vão para `lib/three-r168/` (mesmo endereço para
//   todo imóvel: um visitante que já abriu outra miniatura não baixa de novo).
// - Todo arquivo de `app/`, `lib/` e `assets/` tem a versão no NOME (hash do conteúdo):
//   o Hosting pode mandar cache de um ano, imutável. Só o HTML revalida.
// - Sem importmap: o "three" é reescrito para um caminho relativo na montagem, então a
//   página abre também em Safari anterior ao 16.4.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, '..');
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : p; };
const ID = arg('imovel', 'monte-dos-cedros-37');
const SAIDA = path.resolve(PASTA, arg('saida', 'publicado'));
const DER = path.join(PASTA, 'derivados', ID);
const CFG_IMOVEL = JSON.parse(fs.readFileSync(path.join(PASTA, 'imoveis', ID + '.json'), 'utf8'));
const THREE_DIR = path.join(PASTA, 'node_modules', 'three');
const THREE_VER = JSON.parse(fs.readFileSync(path.join(THREE_DIR, 'package.json'), 'utf8')).version;
const LIB = `lib/three-r${THREE_VER.split('.')[1]}`;

const hash = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
function copia(origem, destinoRel) {
  const alvo = path.join(SAIDA, destinoRel);
  fs.mkdirSync(path.dirname(alvo), { recursive: true });
  fs.copyFileSync(origem, alvo);
  return destinoRel.split(path.sep).join('/');
}
function comHash(origem, pasta, nome) {
  const b = fs.readFileSync(origem), ext = path.extname(nome), base = path.basename(nome, ext);
  return copia(origem, path.join(pasta, `${base}-${hash(b)}${ext}`));
}

if (!fs.existsSync(path.join(DER, 'relatorio.json')) ||
    ['exterior-luz-cheia.ktx2', 'interior-luz-cheia.ktx2'].some(f => !fs.existsSync(path.join(DER, f)))) {
  console.error(`faltam derivados de ${ID} (os atlas de resolução cheia não são versionados): rode antes  python gerador/derivar.py`); process.exit(1);
}
fs.rmSync(SAIDA, { recursive: true, force: true });
fs.mkdirSync(SAIDA, { recursive: true });

// ---- bibliotecas versionadas -------------------------------------------------
const threeUrl = copia(path.join(THREE_DIR, 'build', 'three.module.min.js'), path.join(LIB, 'three.module.min.js'));
for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm'])
  copia(path.join(THREE_DIR, 'examples', 'jsm', 'libs', 'basis', f), path.join(LIB, 'basis', f));

// ---- JavaScript ----------------------------------------------------------------
const reescreveThree = {
  name: 'three-relativo',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: `../${LIB}/three.module.min.js`, external: true }));
  },
};
const r = await esbuild.build({
  entryPoints: { miniatura: path.join(PASTA, 'fonte', 'miniatura.js') },
  bundle: true, splitting: true, format: 'esm', minify: true, target: ['es2020', 'safari15'],
  outdir: path.join(SAIDA, 'app'), entryNames: '[name]-[hash]', chunkNames: '[name]-[hash]',
  plugins: [reescreveThree], metafile: true, legalComments: 'none', write: true, logLevel: 'warning',
  nodePaths: [path.join(PASTA, 'node_modules')],
});
const saidasJs = Object.keys(r.metafile.outputs).filter(f => f.endsWith('.js'));
const entrada = saidasJs.find(f => r.metafile.outputs[f].entryPoint);
const appUrl = path.relative(SAIDA, path.resolve(entrada)).split(path.sep).join('/');
// O que a página importa já na abertura (sem os pedaços sob demanda):
const estaticos = (r.metafile.outputs[entrada].imports || []).filter(i => i.kind === 'import-statement' && !i.external)
  .map(i => path.relative(SAIDA, path.resolve(i.path)).split(path.sep).join('/'));
// O carregador da luz é dinâmico (não atrasa a primeira imagem), mas é pedido logo em
// seguida: vai junto na pré-carga.
const ktx2Chunk = (r.metafile.outputs[entrada].imports || []).filter(i => i.kind === 'dynamic-import' && /KTX2Loader/.test(i.path))
  .map(i => path.relative(SAIDA, path.resolve(i.path)).split(path.sep).join('/'));

// ---- dados do imóvel ---------------------------------------------------------------
const pasta = path.join('assets', ID);
const D = f => path.join(DER, f);
const assets = {
  predio: comHash(D('predio.bin'), pasta, 'predio.bin'),
  exteriorUV: comHash(D('exterior-uv.bin'), pasta, 'exterior-uv.bin'),
  interiorUV: comHash(D('interior-uv.bin'), pasta, 'interior-uv.bin'),
  exteriorLuz: { cheia: comHash(D('exterior-luz-cheia.ktx2'), pasta, 'exterior-luz-cheia.ktx2'),
                 metade: comHash(D('exterior-luz-metade.ktx2'), pasta, 'exterior-luz-metade.ktx2') },
  interiorLuz: { cheia: comHash(D('interior-luz-cheia.ktx2'), pasta, 'interior-luz-cheia.ktx2'),
                 metade: comHash(D('interior-luz-metade.ktx2'), pasta, 'interior-luz-metade.ktx2') },
  moveis: comHash(D('moveis.json'), pasta, 'moveis.json'),
  luzue: comHash(D('luzue.json'), pasta, 'luzue.json'),
};
const capa = fs.existsSync(D('capa.webp')) ? comHash(D('capa.webp'), pasta, 'capa.webp') : null;
const capaEstreita = capa && fs.existsSync(D('capa-estreita.webp')) ? comHash(D('capa-estreita.webp'), pasta, 'capa-estreita.webp') : null;
const ESTREITA = '(max-width: 640px)';
const config = { versao: 4, imovel: ID, lib: { basis: `${LIB}/basis/` }, assets,
                 luz: JSON.parse(fs.readFileSync(D('luz.json'), 'utf8')) };

// ---- a página ------------------------------------------------------------------------
// O perfil de qualidade é escolhido JÁ NO HTML (um trecho mínimo, embutido), para o
// pedido do atlas certo (cheio ou metade) e do transcodificador sair junto com o resto,
// e não só depois que o three.js e o código chegarem.
const perfilInline = (await esbuild.build({
  stdin: { contents: `import { escolhePerfil } from './qualidade.js'; window.__perfil = escolhePerfil();
    var capa = document.getElementById('capa');
    if (capa) { if (capa.complete && capa.naturalWidth) window.__tCapa = performance.now();
      else capa.addEventListener('load', function () { window.__tCapa = performance.now(); }); }
    var p = window.__perfil.perfil, c = JSON.parse(document.getElementById('__config').textContent);
    [c.assets.exteriorLuz[p.luz], c.lib.basis + 'basis_transcoder.js', c.lib.basis + 'basis_transcoder.wasm']
      .forEach(function (u) { var l = document.createElement('link'); l.rel = 'preload'; l.as = 'fetch';
        l.crossOrigin = 'anonymous'; l.href = u; document.head.appendChild(l); });`,
    resolveDir: path.join(PASTA, 'fonte') },
  bundle: true, format: 'iife', minify: true, write: false, target: ['es2020', 'safari15'],
})).outputFiles[0].text;

const tplPagina = fs.readFileSync(path.join(PASTA, 'fonte', 'pagina.html'), 'utf8');
const css = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n/g, '\n').replace(/^[ \t]+/gm, '');
const releaseBytes = Buffer.concat([...saidasJs.map(f => fs.readFileSync(f)), Buffer.from((capa || '') + (capaEstreita || '')),
  ...Object.values(assets).flatMap(v => typeof v === 'string' ? [v] : Object.values(v)).map(u => Buffer.from(u))]);
const release = hash(releaseBytes);
const preloads = [
  `<link rel="modulepreload" href="${threeUrl}">`,
  `<link rel="modulepreload" href="${appUrl}">`,
  ...estaticos.map(u => `<link rel="modulepreload" href="${u}">`),
  ...ktx2Chunk.map(u => `<link rel="modulepreload" href="${u}">`),
  `<link rel="preload" href="${assets.predio}" as="fetch" crossorigin>`,
  `<link rel="preload" href="${assets.exteriorUV}" as="fetch" crossorigin>`,
  capa ? `<link rel="preload" href="${capa}" as="image" fetchpriority="high"${capaEstreita ? ` media="(min-width: 641px)"` : ''}>` : '',
  capaEstreita ? `<link rel="preload" href="${capaEstreita}" as="image" fetchpriority="high" media="${ESTREITA}">` : '',
].filter(Boolean).join('\n');
const imovelTxt = fs.readFileSync(D('imovel.json'), 'utf8');
let html = tplPagina
  .replace('@@TITULO@@', CFG_IMOVEL.titulo)
  .replace('@@RELEASE@@', release)
  .replace('@@PRELOADS@@', preloads)
  .replace('@@CAPA@@', !capa ? '' : capaEstreita
    ? `  <picture><source media="${ESTREITA}" srcset="${capaEstreita}"><img id="capa" src="${capa}" alt="" fetchpriority="high"></picture>`
    : `  <img id="capa" src="${capa}" alt="" fetchpriority="high">`)
  .replace('@@IMOVEL@@', () => imovelTxt)
  .replace('@@CONFIG@@', () => JSON.stringify(config))
  .replace('<script type="importmap">@@IMPORTMAP@@</script>\n', () => `<script>${perfilInline}</script>\n`)
  .replace('@@APP@@', appUrl);
html = html.replace(/<style>([\s\S]*?)<\/style>/, (m, c) => `<style>${css(c)}</style>`);
if (html.includes('@@')) throw new Error('marcador sem substituir no HTML');
const nomePagina = `maquete-${ID}.html`;
fs.writeFileSync(path.join(SAIDA, nomePagina), html);
fs.writeFileSync(path.join(SAIDA, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Miniaturas v4</title>
<meta http-equiv="refresh" content="0; url=${nomePagina}"><a href="${nomePagina}">${CFG_IMOVEL.titulo}</a>`);

// ---- manifesto (o que foi publicado, com hash) -----------------------------------------
const arquivos = [];
(function anda(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name); if (e.isDirectory()) anda(p); else arquivos.push(p); } })(SAIDA);
const manifesto = { versao: 4, imovel: ID, release, three: THREE_VER, montadoEm: new Date().toISOString(),
  pagina: nomePagina, app: appUrl,
  arquivos: Object.fromEntries(arquivos.sort().map(p => [path.relative(SAIDA, p).split(path.sep).join('/'),
    { bytes: fs.statSync(p).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') }])) };
fs.writeFileSync(path.join(PASTA, 'publicacao.json'), JSON.stringify(manifesto, null, 2));
const total = Object.values(manifesto.arquivos).reduce((s, a) => s + a.bytes, 0);
console.log(`v4 ${ID}: ${arquivos.length} arquivos, ${(total / 1e6).toFixed(2)} MB em ${path.relative(PASTA, SAIDA)}/ (release ${release})`);
for (const f of saidasJs) console.log('  ', path.relative(SAIDA, f), (fs.statSync(f).size / 1024).toFixed(1), 'KB');
