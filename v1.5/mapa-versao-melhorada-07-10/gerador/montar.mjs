// Monta o site do mapa v2 em `publicado/`, a partir das PECAS da montagem oficial
// (`gerador/pecas.py`) e da fonte desta pasta.
//
//   node gerador/montar.mjs [--sem-pecas] [--saida publicado]
//
// O que muda em relacao a pagina unica de 14 MB (pipeline/montar.py):
//  - o HTML leva so cabeca, estilo, corpo e o carregador (fonte/entrega/carregador.js):
//    a tela de carga aparece antes de qualquer dado;
//  - cada bloco de dado vira `mapa/dados/<id>-<hash>.json`, servido com Brotli pelo
//    Hosting (base64 nao recomprime: a pagina "comprimida" de hoje transfere 9,6 MB, o
//    mesmo dado aberto com Brotli fica em ~7 MB) e guardado pelo navegador por um ano;
//  - three, earcut e o programa vao em `mapa/lib/` e `mapa/app/`, minificados, com hash;
//  - moveis e luz do apartamento sao `tarde`: so descem para quem entra no interior.
// Tudo que tem hash no nome e imutavel; o HTML revalida (firebase.json desta pasta).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, '..');
const RAIZ = path.resolve(PASTA, '..', '..');
const arg = (n, p) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : p; };
const SAIDA = path.resolve(PASTA, arg('saida', 'publicado'));
const PECAS = path.join(PASTA, 'derivados', '_tmp', 'pecas');
// Blocos que so o interior usa: nao entram na abertura.
const TARDE = new Set(['__moveis', '__luzue']);

if (!process.argv.includes('--sem-pecas'))
  execFileSync(process.env.PYTHON || 'python3', [path.join(AQUI, 'pecas.py'), '--saida', PECAS], { stdio: 'inherit' });
const man = JSON.parse(fs.readFileSync(path.join(PECAS, 'pecas.json'), 'utf8'));

const hash = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
fs.rmSync(SAIDA, { recursive: true, force: true });
const MAPA = path.join(SAIDA, 'mapa');
fs.mkdirSync(MAPA, { recursive: true });
function grava(rel, conteudo) {
  const alvo = path.join(MAPA, rel);
  fs.mkdirSync(path.dirname(alvo), { recursive: true });
  fs.writeFileSync(alvo, conteudo);
  return rel.split(path.sep).join('/');
}
function comHash(pasta, nome, ext, conteudo) {
  return grava(path.join(pasta, `${nome}-${hash(conteudo)}${ext}`), conteudo);
}

// ---- scripts ---------------------------------------------------------------------------
// O programa e a juncao dos 72 scripts de `modules.json` (cada um pendura a sua fabrica em
// `globalThis`; o app.js e uma funcao anonima). Envolto numa funcao, o esbuild pode
// encurtar os nomes de topo sem quebrar ninguem: quem atravessa arquivo o faz por
// `globalThis.X`, nao por nome solto.
const programa = fs.readFileSync(path.join(PECAS, 'programa.js'), 'utf8');
const app = (await esbuild.transform(programa, { minify: true, format: 'iife', target: ['es2020', 'safari15'],
  legalComments: 'none', charset: 'utf8' })).code;
const urlApp = comHash('app', 'mapa', '.js', app);
// three (o pacote do proprio renderizador, com a global THREE) e earcut ja vem minificados.
const urlThree = comHash('lib', 'three-r168', '.min.js', fs.readFileSync(path.join(PECAS, 'three.min.js')));
const urlEarcut = comHash('lib', 'earcut', '.min.js', fs.readFileSync(path.join(PECAS, 'earcut.min.js')));

// ---- dados ----------------------------------------------------------------------------------
const dados = {};
for (const p of man.pecas) {
  if (p.tipo !== 'bloco') continue;
  const texto = fs.readFileSync(path.join(PECAS, 'blocos', p.id + '.json'));
  dados[p.id] = { url: comHash('dados', p.id.replace(/^_+/, ''), '.json', texto), bytes: texto.length,
                  ...(TARDE.has(p.id) ? { tarde: true } : {}) };
}

// ---- quintais: os tiles continuam onde a pagina os pede (prefixo relativo a ela) --------------
const QUINTAIS = path.join(RAIZ, 'v16-moveis', 'publicado', 'mapa', 'quintais');
if (fs.existsSync(QUINTAIS)) {
  for (const h of fs.readdirSync(QUINTAIS)) {
    const de = path.join(QUINTAIS, h), para = path.join(MAPA, 'quintais', h);
    fs.mkdirSync(para, { recursive: true });
    // link fisico: nao duplica 16,7 MB no disco, e o Hosting sobe o arquivo normal
    for (const f of fs.readdirSync(de)) {
      try { fs.linkSync(path.join(de, f), path.join(para, f)); }
      catch { fs.copyFileSync(path.join(de, f), path.join(para, f)); }
    }
  }
}

// ---- a pagina ---------------------------------------------------------------------------------
const css = fs.readFileSync(path.join(PECAS, 'estilo.css'), 'utf8');
const cssMin = (await esbuild.transform(css, { loader: 'css', minify: true })).code;
const carregador = (await esbuild.transform(fs.readFileSync(path.join(PASTA, 'fonte', 'entrega', 'carregador.js'), 'utf8'),
  { minify: true, target: ['es2017', 'safari12'] })).code;
const manifesto = { dados, scripts: [urlThree, urlEarcut, urlApp] };
let cabeca = '', corpo = '';
let viuEstilo = false;
for (const p of man.pecas) {
  if (p.tipo === 'estilo') viuEstilo = true;
  if (p.tipo !== 'html') continue;
  if (!viuEstilo) cabeca += p.texto; else corpo += p.texto;
}
cabeca = cabeca.replace(/﻿/g, '')
  .replace(/<title>[^<]*<\/title>/, m => m.replace(/\(([^)]*)·\s*duplo clique\)/, '($1 · v2)'))
  .replace(/<!--[\s\S]*?-->\n?/g, '');
const preload = [
  // O que todo visitante baixa: comeca a descer junto com o HTML, antes do carregador.
  ...Object.values(dados).filter(d => !d.tarde).sort((a, b) => b.bytes - a.bytes)
    .map(d => `<link rel="preload" href="${d.url}" as="fetch" crossorigin>`),
  `<link rel="preload" href="${urlThree}" as="script">`,
  `<link rel="preload" href="${urlApp}" as="script">`,
].join('\n');
// Sem doctype, como a pagina de hoje (o CSS do mapa foi calibrado em modo quirks).
const html = `${cabeca.trim()}\n${preload}\n<style>${cssMin}</style>\n${corpo}` +
  `<script>window.__MANIFESTO=${JSON.stringify(manifesto)};</script>\n<script>${carregador}</script>\n`;
const nome = `sao-carlos-${hash(html)}.html`;
fs.writeFileSync(path.join(MAPA, nome), html);
fs.writeFileSync(path.join(SAIDA, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Mapa 3D</title>
<meta http-equiv="refresh" content="0; url=mapa/${nome}"><a href="mapa/${nome}">Abrir o mapa</a>\n`);

const pub = { pagina: `mapa/${nome}`, carimbo: man.carimbo, pagina_oficial_sha256: man.pagina_sha256,
  arquivos: {} };
(function anda(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) { if (e.name !== 'quintais') anda(p); }
  else pub.arquivos[path.relative(SAIDA, p).split(path.sep).join('/')] = fs.statSync(p).size;
} })(SAIDA);
fs.writeFileSync(path.join(PASTA, 'derivados', '_tmp', 'publicacao.json'), JSON.stringify(pub, null, 1));
const soma = Object.values(pub.arquivos).reduce((s, b) => s + b, 0);
console.log(`mapa v2: ${Object.keys(pub.arquivos).length} arquivos, ${(soma / 1e6).toFixed(2)} MB (sem quintais) -> ${path.relative(PASTA, SAIDA)}/mapa/${nome}`);
console.log(`   HTML ${(html.length / 1024).toFixed(1)} KB · programa ${(app.length / 1024).toFixed(0)} KB (de ${(programa.length / 1024).toFixed(0)})`);
