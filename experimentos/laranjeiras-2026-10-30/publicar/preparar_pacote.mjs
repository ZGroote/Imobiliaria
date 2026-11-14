// Pacote estático do Parque das Laranjeiras para um endereço de teste. Não publica nada.
// Mesmo caminho do LIV (otimizar_publicacao.mjs / preparar-horario.mjs): copia o site, junta o JS das três
// páginas com o esbuild (o three entra no pacote), embute o CSS, põe a cena, o cadastro e os móveis
// aprovados dentro do pacote e marca as páginas com noindex.
//   node experimentos/laranjeiras-2026-10-30/publicar/preparar_pacote.mjs [pasta de saída]
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {prepararBiblioteca} from '../../../pipeline/preparar_biblioteca.mjs';
import {prepararInteriores} from '../../../pipeline/preparar_interiores.mjs';
import {empacotarRuntime} from '../../../pipeline/empacotar_runtime.mjs';
import {createHash} from 'node:crypto';
import {cp, mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const exp = resolve(here, '..');
const root = resolve(exp, '../..');
const liv = join(root, 'experimentos/liv-experimental-2026-10-14');
const {transform} = createRequire(join(liv, 'package.json'))('esbuild');
const three = join(liv, 'node_modules/three');
const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10).replaceAll('-', '');
const out = resolve(process.argv[2] ?? join(root, `publicacao/laranjeiras-${today}/payload/laranjeiras`));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const once = (text, from, to, file) => {
  const n = typeof from === 'string' ? text.split(from).length - 1 : (text.match(new RegExp(from.source, 'g')) || []).length;
  if (n !== 1) throw Error(`${file}: esperava 1 ocorrência de ${from}, achei ${n}`);
  return text.replace(from, () => to);
};
const edit = async (file, pairs) => {
  let text = await readFile(join(out, file), 'utf8');
  for (const [from, to] of pairs) text = once(text, from, to, file);
  await writeFile(join(out, file), text);
};

// 1) Site, sem testes nem ferramentas de bancada.
await mkdir(out, {recursive: true});
if((await readdir(out)).length)throw Error('Destino ocupado. Escolha uma pasta nova ou vazia.');
// prova-splat/interior-splat: Tour em splat do LIV, que o Laranjeiras não tem.
const skip = name => /^(test_|qa_)|\.test\.|^diagnostico|^materiais\.html$|^materials-viewer\.js$|^(prova|interior)-splat\./.test(name);
await cp(join(exp, 'site'), out, {recursive: true, filter: src => !skip(src.split(/[\\/]/).pop())});

// Mapa compartilhado em um namespace: não substituir o cálculo solar do Laranjeiras.
execFileSync('python',[join(liv,'preparar_mapa_2d.py')],{cwd:root,stdio:'pipe'});
const sharedMap=JSON.parse(await readFile(join(liv,'mapa-2d-manifest.json'),'utf8'));
const mapFiles=[];
for(const [name,record] of Object.entries(sharedMap.files)){
  if(name.startsWith('/')||name.split('/').includes('..'))throw Error('Arquivo do mapa fora do pacote.');
  const bytes=await readFile(join(liv,name));if(bytes.length!==record.bytes||hash(bytes)!==record.sha256)throw Error('Recurso do mapa divergente: '+name);
  const target='mapa-compartilhado/'+name;await mkdir(dirname(join(out,target)),{recursive:true});await writeFile(join(out,target),bytes);
  mapFiles.push({path:target,group:'map',...record,essential:false,background:false});
}
await cp(join(liv,'mapa-retorno.js'),join(out,'mapa-retorno.js'));
await cp(join(liv,'transfer-worker.js'),join(out,'transfer-worker.js'));
await edit('mapa-liv-ipanema-5km.html',[
  ['data-map-runtime="../../liv-experimental-2026-10-14/mapa-runtime/mapa-2d.html"','data-map-runtime="mapa-compartilhado/mapa-runtime/mapa-2d.html" data-map-assets="mapa-compartilhado/"'],
  ['src="../../liv-experimental-2026-10-14/mapa-retorno.js"','src="mapa-retorno.js"'],
]);
const queuePath=join(out,'transfer-manifest.json');
let queue={schema:'liv-transfer-manifest-v1',order:['tour','map','planta2d'],groups:{tour:{label:'Tour 3D'},map:{label:'Mapa'},planta2d:{label:'Planta 2D'}},files:[]};
try{queue=JSON.parse(await readFile(queuePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
queue.files=[...queue.files.filter(file=>file.group!=='map'),...mapFiles];await writeFile(queuePath,JSON.stringify(queue));

// 2) Cena, atlas, manifesto e cadastro dos 312 apartamentos (gerados por modelo/exportar_cena.py).
await cp(join(exp, 'assets'), join(out, 'assets'), {recursive: true});
await edit('edicoes.js', [["assets:'../assets/',units:'../assets/unidades.json',glb:'../modelo/laranjeiras.glb'", "assets:'assets/',units:'assets/unidades.json',glb:null"]]);

// 3) Móveis aprovados (GLB/HDR, fora do git também no LIV): só o que o catálogo usa, conferido por SHA.
const library = join(liv, 'interiores/melhorias');
const catalogBytes = await readFile(join(library, 'catalogo.json'));
const catalog = JSON.parse(catalogBytes);
const files = new Set(['catalogo.json']);
for (const asset of catalog.assets) files.add(asset.path.replace(/^interiores\/melhorias\//, ''));
for (const env of [catalog.environment, catalog.background, ...Object.values(catalog.reflectionEnvironments || {})].filter(Boolean))
  files.add(env.path.replace(/^interiores\/melhorias\//, ''));
if (catalog.look?.path) files.add(catalog.look.path.replace(/^interiores\/melhorias\//, ''));
for (const asset of catalog.assets) {
  const bytes = await readFile(join(library, asset.path.replace(/^interiores\/melhorias\//, '')));
  if (asset.sha256 && hash(bytes) !== asset.sha256) throw Error(`Móvel aprovado diferente do catálogo: ${asset.id}`);
}
await mkdir(join(out, 'interiores/melhorias'), {recursive: true});
for (const file of files) {
  await mkdir(dirname(join(out, 'interiores/melhorias', file)), {recursive: true});
  await cp(join(library, file), join(out, 'interiores/melhorias', file));
}
const libraryURL = "new URL('../../liv-experimental-2026-10-14/interiores/melhorias/catalogo.json',base)";
await edit('interior-melhorias.js', [[libraryURL, "new URL('interiores/melhorias/catalogo.json',base)"]]);
await edit('interior-look.js', [[libraryURL, "new URL('interiores/melhorias/catalogo.json',base)"]]);

// 4) JS das três páginas em pacotes minificados; o three entra no pacote (sem node_modules publicado).
console.log(JSON.stringify({prepared:await prepararInteriores(out)}));
console.log(JSON.stringify({library:await prepararBiblioteca(out,{includeDecorations:false})}));
const result = await empacotarRuntime(out,three);
const css = async name => (await transform(await readFile(join(out, name), 'utf8'), {loader: 'css', minify: true})).code.trim();
const noindex = '<meta name="robots" content="noindex, nofollow">';
let page = await readFile(join(out, 'maquete-laranjeiras.html'), 'utf8');
for (const name of ['unit-ui.css', 'viewer-ui.css', 'viewer-compact.css'])
  page = once(page, new RegExp(`<link rel="stylesheet" href="${name.replace('.', '\\.')}[^"]*">`), `<style>${await css(name)}</style>`, 'maquete');
page = once(page, /<script type="module" src="viewer\.js[^"]*"><\/script>/, '<script type="module" src="viewer.bundle.js"></script>', 'maquete');
page = once(page, '<meta charset="utf-8">', '<meta charset="utf-8">\n  ' + noindex, 'maquete');
await writeFile(join(out, 'maquete-laranjeiras.html'), page);
await writeFile(join(out, 'index.html'), page);   // /laranjeiras/ abre a maquete direto
for (const [file, entry] of [['prova-rgbm.html', 'renderer'], ['interior.html', 'interior-renderer']]) {
  let html = await readFile(join(out, file), 'utf8');
  html = once(html, /<script type="importmap">[^<]*<\/script>\n?/, '', file);
  html = once(html, new RegExp(`<script type="module" src="${entry}\\.js[^"]*"><\\/script>`), `<script type="module" src="${entry}.bundle.js"></script>`, file);
  html = html.replace(/<meta charset="utf-8">/i, m => m + noindex);
  await writeFile(join(out, file), html);
}
// interior-splat.js (Tour em splat do LIV) não existe no Laranjeiras: tirar a tag, se houver.
await writeFile(join(out, 'interior.html'), (await readFile(join(out, 'interior.html'), 'utf8')).replace(/<script type="module" src="interior-splat\.js[^"]*"><\/script>\n?/, ''));
for (const name of ['decodificar-worker.js', 'transfer-worker.js'])
  await writeFile(join(out, name), (await transform(await readFile(join(out, name), 'utf8'), {loader: 'js', minify: true, charset: 'utf8', legalComments: 'none'})).code);

// O mesmo catálogo verificável serve aos próximos prédios gerados por este fluxo.
execFileSync('python',['-m','pipeline.transfer_manifest',out],{cwd:root,stdio:'pipe'});

// 5) Inventário (tamanho e SHA de cada arquivo) para conferir antes e depois de subir.
const inventory = {};
let total = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      const bytes = await readFile(path);
      inventory[path.slice(out.length + 1).replaceAll('\\', '/')] = {bytes: bytes.length, sha256: hash(bytes)};
      total += bytes.length;
    }
  }
}
await walk(out);
await writeFile(join(dirname(out), 'inventario.json'), JSON.stringify({pasta: out, arquivos: Object.keys(inventory).length, bytes: total, inventory}, null, 2));
console.log(JSON.stringify({pasta: out, arquivos: Object.keys(inventory).length, MB: +(total / 2 ** 20).toFixed(1),
  pacotes: Object.entries(result.metafile.outputs).filter(([p]) => p.endsWith('.bundle.js')).map(([p, o]) => [p.split(/[\\/]/).pop(), o.bytes])}));
