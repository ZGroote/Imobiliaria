import { cp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { build } from 'esbuild';
import { planSVG } from './plan-svg.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..');
const source = join(root, 'publicacao/liv-duplo-20261017/payload/liv-classico');
const three = join(root, 'experimentos/liv-experimental-2026-10-14/node_modules/three');
const destination = join(here, '.preview'), runtime = join(destination, 'runtime');
const identity = {};
async function patch(name, edits) {
  let content = await readFile(join(source, name), 'utf8');
  identity[name] = createHash('sha256').update(content).digest('hex');
  for (const [before, after, all = false] of edits) {
    if (!content.includes(before)) throw Error(`A base mudou: trecho de ${name} ausente: ${before.slice(0, 70)}`);
    if (!all && content.indexOf(before) !== content.lastIndexOf(before)) throw Error(`Trecho ambíguo em ${name}: ${before}`);
    content = all ? content.replaceAll(before, after) : content.replace(before, after);
  }
  await writeFile(join(runtime, name), content);
}
await stat(source); await stat(join(three, 'examples/jsm/tsl/display/GTAONode.js'));
await mkdir(destination, { recursive: true });
await cp(source, runtime, { recursive: true, filter: path => !path.endsWith('.map') });
for (const name of ['index.html', 'studio.css', 'studio.js']) await cp(join(here, name), join(destination, name));
for (const name of ['quality.js', 'quality-config.mjs', 'model-exterior.js', 'model-interior.js', 'materials-pbr.js']) await cp(join(here, name), join(runtime, name));
await patch('renderer.js', [
  ["import * as THREE from 'three/webgpu';", "import * as THREE from 'three/webgpu';\nimport {createQuality} from './quality.js';"],
  ['let environment,controls,resizeObserver,unitPicking,ambience,parking,pendingSpaces=[];', 'let quality,environment,controls,resizeObserver,unitPicking,ambience,parking,pendingSpaces=[];'],
  ['atlas.dispose();environment?.dispose();', 'quality?.dispose();atlas.dispose();environment?.dispose();'],
  ['function makeCamera(spec,viewName=null)', "quality=state.quality=createQuality({renderer,scene,stage,kind:'exterior'});\n  function makeCamera(spec,viewName=null)"],
  ['renderer.render(scene,camera)', 'quality.render(camera)', true],
]);
await patch('interior-renderer.js', [
  ["import * as THREE from 'three/webgpu';", "import * as THREE from 'three/webgpu';\nimport {createQuality} from './quality.js';"],
  ['let furnitureFactory,furnitureMaterials,furnitureEditor;', 'let furnitureFactory,furnitureMaterials,furnitureEditor,quality;\nfunction drawAsync(){return quality?quality.renderAsync(camera):renderer.renderAsync(scene,camera);}'],
  ['furnitureEditor?.dispose();', 'furnitureEditor?.dispose();quality?.dispose();'],
  ['materials[id]=own(new THREE[spec.type](params));', 'materials[id]=own(new THREE[spec.type](params));materials[id].userData.studioId=id;'],
  ['  addLights();', "  addLights();quality=state.quality=createQuality({renderer,scene,stage,kind:'interior',layout});"],
  ['await renderer.renderAsync(scene,camera)', 'await drawAsync()', true],
  ['framePromise=renderer.renderAsync(scene,camera)', 'framePromise=drawAsync()', true],
]);
await patch('prova-rgbm.html', [
  ['<link rel="modulepreload" href="chunk-ONTLQXQ4.js"><script type="module" src="renderer.bundle.js"></script>', '<script type="module" src="renderer.studio.js"></script>'],
]);
await patch('interior.html', [
  ['src="interior-renderer.js?rev=2026-10-13-rodateto-selado-final"', 'src="interior-renderer.studio.js"'],
  ['</style>', ':root[data-embedded="1"] #furniture-panel{display:none!important}</style>'],
]);
const threePlugin = { name: 'runtime-fixado', setup(builder) {
  builder.onResolve({ filter: /^three(?:\/|$)/ }, ({ path }) => ({ path: path === 'three' || path === 'three/webgpu'
    ? join(three, 'build/three.webgpu.js') : path === 'three/tsl' ? join(three, 'build/three.tsl.js')
    : join(three, 'examples/jsm', path.replace('three/addons/', '')) }));
} };
await build({ entryPoints: { 'renderer.studio': join(runtime, 'renderer.js'), 'interior-renderer.studio': join(runtime, 'interior-renderer.js') },
  outdir: runtime, bundle: true, splitting: true, format: 'esm', target: 'es2022', minify: true, plugins: [threePlugin] });
for (const type of ['canto', 'meio']) {
  const unit = JSON.parse(await readFile(join(runtime, 'interiores', type, 'unidade.json'), 'utf8'));
  await writeFile(join(destination, `${type}.svg`), planSVG(unit));
}
await writeFile(join(destination, 'origem.json'), JSON.stringify({ source: 'https://conectaimoveis3d.com.br/maquetes/liv/',
  local: 'publicacao/liv-duplo-20261017/payload/liv-classico', identity, three: '0.186.1', generatedAt: new Date().toISOString() }, null, 2));
console.log('Prévia separada preparada em ' + destination);
