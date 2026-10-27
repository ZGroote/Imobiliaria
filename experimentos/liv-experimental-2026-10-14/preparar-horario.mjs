// Prévia local do horário sobre o payload publicado. Não prepara nem publica Firebase.
// Uso, na raiz: node experimentos/liv-experimental-2026-10-14/preparar-horario.mjs
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {basename, dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const source = dirname(fileURLToPath(import.meta.url));
const root = resolve(source, '../..');
const published = join(root, 'publicacao/liv-duplo-20261017/payload');
const preview = join(root, 'publicacao/liv-horario-20261026');
const payload = join(preview, 'payload');
const classic = join(payload, 'liv-classico');
const three = join(published, 'liv-classico/node_modules/three');
const overlay = [
  'viewer.js', 'renderer.js', 'interior-renderer.js', 'interior-melhorias.js', 'interior-look.js', 'material-rgbm.js', 'mapa-retorno.js',
  'horario-solar.js', 'horario-ui.js', 'horario-ui.css',
  'horario-exterior.js', 'horario-interior.js', 'interior-luz-horario.js', 'interior-portas.js', 'interior-navigation.js',
  'marca-telhado.js', 'marca-telhado.webp', 'folheado.js', 'experiencia-compra.js',
];
const pages = [
  ['liv-classico/maquete-liv-ipanema.html', 'viewer.js', 'viewer.bundle.js'],
  ['maquetes/liv/index.html', 'viewer.js', 'viewer.bundle.js'],
  ['liv-classico/prova-rgbm.html', 'renderer.js', 'renderer.bundle.js'],
  ['liv-classico/interior.html', 'interior-renderer.js', 'interior-renderer.bundle.js'],
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fingerprints = {};
const modelPath = 'liv-classico/modelo/entrada/candidato/assets/manifest.json';
const publishedModel = await readFile(join(published, modelPath));
const model = JSON.parse(publishedModel);
assert.equal(model.sourceModelSHA256, '9ba4c3d261fae716b51ee6fa65464c574074f082ea5873bc7603407ed2b56bac');
const pageScript = (entry, bundle) => new RegExp(
  '<script type="module" src="' + (entry === 'interior-renderer.js' ? entry : bundle).replaceAll('.', '\\.') + '(?:\\?[^\"]*)?"></script>', 'g');

assert.notEqual(payload, published);
assert.equal(dirname(payload), preview);
// Read every required input before writing the preview, so incomplete work cannot replace it.
const modules = new Map(await Promise.all(overlay.map(async name => [name, await readFile(join(source, name))])));
const libraryPath='interiores/melhorias',catalogBytes=await readFile(join(source,libraryPath,'catalogo.json'));
const libraryCatalog=JSON.parse(catalogBytes),libraryFiles=new Map([['catalogo.json',catalogBytes]]);
assert.equal(libraryCatalog.schema,'liv-interior-improvements-v1');
assert(libraryCatalog.assets?.length,'Biblioteca detalhada vazia.');
assert(libraryCatalog.complete!==false,'A exportação da biblioteca ainda não terminou.');
for(const asset of libraryCatalog.assets){
  const path=asset.path.replace(/^interiores\/melhorias\//,'');
  assert(/^[a-zA-Z0-9._/-]+\.glb$/i.test(path)&&!path.startsWith('/')&&!path.split('/').includes('..'),'Caminho de GLB inválido.');
  const bytes=await readFile(join(source,libraryPath,path));
  if(asset.bytes!==undefined)assert.equal(bytes.length,asset.bytes,`${asset.id}: tamanho GLB`);
  if(asset.sha256)assert.equal(hash(bytes),asset.sha256,`${asset.id}: SHA GLB`);
  libraryFiles.set(path,bytes);
}
for(const environment of [libraryCatalog.environment,libraryCatalog.background,...Object.values(libraryCatalog.reflectionEnvironments||{})].filter(Boolean)){
  const path=environment.path.replace(/^interiores\/melhorias\//,'');
  assert(/^[a-zA-Z0-9._/-]+\.hdr$/i.test(path)&&!path.startsWith('/')&&!path.split('/').includes('..'),'Caminho de HDR inválido.');
  const bytes=await readFile(join(source,libraryPath,path));
  if(environment.bytes!==undefined)assert.equal(bytes.length,environment.bytes,'Tamanho do HDR');
  if(environment.sha256)assert.equal(hash(bytes),environment.sha256,'SHA do HDR');
  libraryFiles.set(path,bytes);
}
if(libraryCatalog.look){
  const look=libraryCatalog.look,path=look.path.replace(/^interiores\/melhorias\//,'');
  assert(/^[a-zA-Z0-9._/-]+\.bin$/i.test(path)&&!path.startsWith('/')&&!path.split('/').includes('..'),'Caminho da transformação de cor inválido.');
  const bytes=await readFile(join(source,libraryPath,path));
  assert.equal(bytes.length,look.bytes,'Tamanho da transformação de cor');
  assert.equal(hash(bytes),look.sha256,'SHA da transformação de cor');
  libraryFiles.set(path,bytes);
}
// Folheado de nogueira (folheado.js confere o SHA de cada mapa ao carregar).
const veneerFiles = ['color', 'normal', 'roughness'].map(name => `interiores/shared/folheado-nogueira/${name}.webp`);
const veneerBytes = new Map(await Promise.all(veneerFiles.map(async path => [path, await readFile(join(source, path))])));
// Luz gravada por hora (bake-luz-horario.py + empacotar-luz-horario.py), por planta; sem ela o interior segue dinâmico.
const timeLightFiles = new Map();
for (const typology of ['canto', 'meio']) {
  const timeLightPath = `interiores/${typology}/luz-horario`;
  try {
    const manifestBytes = await readFile(join(source, timeLightPath, 'manifest.json'));
    const manifest = JSON.parse(manifestBytes);
    assert.equal(manifest.typology, typology, `${timeLightPath}: manifesto de outra planta`);
    timeLightFiles.set(`${timeLightPath}/manifest.json`, manifestBytes);
    for (const entry of [...manifest.keys, manifest.night].flatMap(item => item.probes ? [item, item.probes] : [item])) {
      const name = basename(entry.path), bytes = await readFile(join(source, timeLightPath, name));
      assert.equal(entry.path, `${timeLightPath}/${name}`, 'Caminho da luz gravada inválido.');
      assert.equal(bytes.length, entry.bytes, `${entry.id}: tamanho da luz gravada`);
      assert.equal(hash(bytes), entry.sha256, `${entry.id}: SHA da luz gravada`);
      timeLightFiles.set(`${timeLightPath}/${name}`, bytes);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const originals = new Map(await Promise.all(pages.map(async ([path]) => [path, await readFile(join(published, path), 'utf8')])));
assert(!originals.get('liv-classico/interior.html').includes('interior-splat.js'), 'A base precisa ser o interior clássico publicado.');
assert(originals.get('maquetes/liv/index.html').includes('<base href="/liv-classico/">'), 'Alias publicado inesperado.');
for (const [path, entry, bundle] of pages) {
  assert.equal([...originals.get(path).matchAll(pageScript(entry, bundle))].length, 1, `Script publicado inesperado: ${path}`);
}
await readFile(join(three, 'build/three.webgpu.js'));

await mkdir(preview, {recursive: true});
await cp(published, payload, {
  recursive: true,
  filter: path => !relative(published, path).split(sep).includes('node_modules'),
});
for (const [name, bytes] of modules) {
  await writeFile(join(classic, name), bytes);
  fingerprints[name] = {bytes: bytes.length, sha256: hash(bytes)};
}
for(const [name,bytes]of libraryFiles){
  const destination=join(classic,libraryPath,name);await mkdir(dirname(destination),{recursive:true});
  await writeFile(destination,bytes);fingerprints[`${libraryPath}/${name}`]={bytes:bytes.length,sha256:hash(bytes)};
}
for (const [path, bytes] of veneerBytes) {
  await mkdir(dirname(join(classic, path)), {recursive: true}); await writeFile(join(classic, path), bytes);
  fingerprints[path] = {bytes: bytes.length, sha256: hash(bytes)};
}
for (const [path, bytes] of timeLightFiles) {
  const destination = join(classic, path); await mkdir(dirname(destination), {recursive: true});
  await writeFile(destination, bytes); fingerprints[path] = {bytes: bytes.length, sha256: hash(bytes)};
}
// O selo da marca saiu do topo da página (26/10): o logo agora fica na laje da torre (marca-telhado.js).
const viewerPath = join(classic, 'viewer.js');
const viewer = await readFile(viewerPath, 'utf8');
assert(/const geometry=[^\n]*:'entrada';/.test(viewer), 'Preserve entrada como edição padrão do LIV.');
assert(!viewer.includes('marca-liv.js'), 'O selo da marca não volta ao topo da página.');

const result = await build({
  entryPoints: {
    'viewer.bundle': viewerPath,
    'renderer.bundle': join(classic, 'renderer.js'),
    'interior-renderer.bundle': join(classic, 'interior-renderer.js'),
  },
  outdir: classic, bundle: true, splitting: true, format: 'esm', target: 'es2022',
  minify: true, charset: 'utf8', chunkNames: 'chunk-[hash]', metafile: true,
  legalComments: 'eof', sourcemap: 'linked', sourcesContent: false,
  alias: {
    // The frozen vendor copy contains only addons used by the old site. Bundle the new HDR parser from the pinned viewer package.
    'three/addons/loaders/HDRLoader.js': join(source,'node_modules/three/examples/jsm/loaders/HDRLoader.js'),
    'three/webgpu': join(three, 'build/three.webgpu.js'),
    'three/tsl': join(three, 'build/three.tsl.js'),
    three: join(three, 'build/three.webgpu.js'),
    'three/addons': join(three, 'examples/jsm'),
  },
  external: ['./estoque-runtime.js'],
});
const outputs = result.metafile.outputs;
function preloads(entry) {
  const output = Object.values(outputs).find(item => item.entryPoint && basename(item.entryPoint) === entry);
  assert(output, `Entry sem pacote: ${entry}`);
  return output.imports.filter(item => item.kind === 'import-statement' && !item.external)
    .map(item => `<link rel="modulepreload" href="${basename(item.path)}">`).join('');
}
const pageHashes = {};
for (const [path, entry, bundle] of pages) {
  let html = originals.get(path);
  const script = pageScript(entry, bundle);
  html = html.replace(/<link rel="modulepreload" href="chunk-[^"]+\.js">/g, '');
  html = html.replace(script, preloads(entry) + `<script type="module" src="${bundle}"></script>`);
  await writeFile(join(payload, path), html);
  pageHashes[path] = {publishedSHA256: hash(originals.get(path)), previewSHA256: hash(html)};
}
assert((await readFile(join(payload, 'maquetes/liv/index.html'), 'utf8')).includes('<base href="/liv-classico/">'));
assert(!(await readFile(join(classic, 'interior.html'), 'utf8')).includes('interior-splat.js'));
assert.equal(hash(await readFile(join(payload, modelPath))), hash(publishedModel), 'O modelo de entrada foi alterado na prévia.');
const report = {
  sourcePayload: relative(root, published).split(sep).join('/'),
  previewPayload: relative(root, payload).split(sep).join('/'),
  sourceFiles: fingerprints, pages: pageHashes, furnitureLibrary:{assets:libraryCatalog.assets.length,source:libraryCatalog.source||libraryCatalog.sourceBlend||null},
  geometry: 'entrada', sourceModelSHA256: model.sourceModelSHA256, modelManifestSHA256: hash(publishedModel),
  bundles: Object.fromEntries(Object.entries(outputs).map(([path, output]) => [basename(path), {bytes: output.bytes}])),
  command: 'python -m http.server 8792 --bind 127.0.0.1 --directory publicacao/liv-horario-20261026/payload',
  url: 'http://127.0.0.1:8792/maquetes/liv/',
};
await writeFile(join(preview, 'preparacao-horario.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({payload, url: report.url, server: report.command, modules: overlay.length, bundles: Object.keys(report.bundles)}, null, 2));
