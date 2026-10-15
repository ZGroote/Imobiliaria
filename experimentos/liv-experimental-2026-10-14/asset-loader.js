import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeAsset, inspectMaterials, registerAssetOwnership } from './materials.js';

const virtualOrigin = 'https://liv-local.invalid';
// Match this project's pinned GLTFLoader r186. Extensions implemented by third-party
// plugins are deliberately absent: a required extension must never degrade silently.
const supportedExtensions = new Set([
  'KHR_draco_mesh_compression', 'KHR_lights_punctual', 'KHR_materials_anisotropy',
  'KHR_materials_clearcoat', 'KHR_materials_dispersion', 'KHR_materials_emissive_strength',
  'KHR_materials_ior', 'KHR_materials_iridescence', 'KHR_materials_sheen',
  'KHR_materials_specular', 'KHR_materials_transmission', 'KHR_materials_unlit',
  'KHR_materials_volume', 'KHR_mesh_quantization', 'KHR_meshopt_compression',
  'KHR_texture_basisu', 'KHR_texture_transform', 'EXT_materials_bump',
  'EXT_meshopt_compression', 'EXT_mesh_gpu_instancing', 'EXT_texture_avif', 'EXT_texture_webp',
]);

function abortIfNeeded(signal) {
  if (signal?.aborted) throw new DOMException('Importação cancelada.', 'AbortError');
}

function filePath(file) {
  const path = String(file.webkitRelativePath || file.name || '').replaceAll('\\', '/');
  if (!path || path.startsWith('/') || path.includes('\0') || /^[a-z][\w+.-]*:/i.test(path)) {
    throw new Error(`Caminho local inválido: ${path || '(sem nome)'}`);
  }
  const segments = path.split('/');
  if (segments.some(segment => !segment || segment === '..')) throw new Error(`Caminho local inválido: ${path}`);
  return segments.filter(segment => segment !== '.').join('/');
}

function metadata(buffer, isBinary) {
  if (!isBinary) return JSON.parse(new TextDecoder().decode(buffer));
  if (buffer.byteLength < 20) throw new Error('GLB inválido: cabeçalho incompleto.');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2
      || view.getUint32(8, true) !== buffer.byteLength) throw new Error('GLB inválido: cabeçalho ou versão.');
  const size = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || size > buffer.byteLength - 20) {
    throw new Error('GLB inválido: primeiro chunk JSON ausente ou truncado.');
  }
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, size)));
}

function selectedPath(uri, baseURL) {
  if (typeof uri !== 'string' || !uri) throw new Error('URI de recurso local inválida.');
  if (uri.startsWith('data:')) return null;
  if (uri.startsWith('/') || uri.includes('\\') || /^[a-z][\w+.-]*:/i.test(uri)) {
    throw new Error(`Recurso externo não permitido: ${uri}`);
  }
  const url = new URL(uri, baseURL);
  if (url.origin !== virtualOrigin || url.search || url.hash) throw new Error(`URI de recurso não local: ${uri}`);
  return url.pathname.slice(1).split('/').map(segment => {
    const decoded = decodeURIComponent(segment);
    if (decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0')) {
      throw new Error(`URI de recurso ambígua: ${uri}`);
    }
    return decoded;
  }).join('/');
}

function extensionNames(json) {
  const names = new Set([...(json.extensionsUsed ?? []), ...(json.extensionsRequired ?? [])]);
  // Provision decoders even when an exporter omitted extensionsUsed. GLTFLoader
  // still decides whether the document itself meets the glTF specification.
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.extensions) for (const name of Object.keys(value.extensions)) names.add(name);
    for (const child of Object.values(value)) visit(child);
  }
  visit(json);
  return names;
}

/**
 * Parse one self-contained GLB, or one glTF plus all selected local dependencies.
 * Browser FileList/Array<File> inputs remain in memory. No user URL is fetched.
 * Materials are GLTFLoader originals, with WebGPURenderer conversion checked only.
 */
export async function parseLocalGLTF(files, renderer, { signal } = {}) {
  abortIfNeeded(signal);
  const entries = new Map();
  for (const file of Array.from(files ?? [])) {
    if (typeof file.arrayBuffer !== 'function') throw new Error('Selecione arquivos locais válidos.');
    const path = filePath(file);
    if (entries.has(path)) throw new Error(`Caminho local duplicado: ${path}`);
    entries.set(path, file);
  }
  const roots = [...entries.keys()].filter(path => /\.(gltf|glb)$/i.test(path));
  if (roots.length !== 1) throw new Error('Selecione exatamente um arquivo .gltf ou .glb.');
  const rootPath = roots[0];
  const isBinary = /\.glb$/i.test(rootPath);
  if (isBinary && entries.size !== 1) throw new Error('GLB deve ser um único arquivo autocontido.');
  const buffer = await entries.get(rootPath).arrayBuffer();
  abortIfNeeded(signal);
  const json = metadata(buffer, isBinary);
  if (!json.asset || String(json.asset.version) !== '2.0') throw new Error('O modelo deve usar glTF 2.0.');
  if (!Array.isArray(json.extensionsRequired ?? []) || !Array.isArray(json.extensionsUsed ?? [])) {
    throw new Error('Lista de extensões glTF inválida.');
  }
  for (const name of json.extensionsRequired ?? []) {
    if (!supportedExtensions.has(name)) throw new Error(`Extensão obrigatória não suportada: ${name}`);
  }
  const directory = rootPath.includes('/') ? rootPath.slice(0, rootPath.lastIndexOf('/') + 1) : '';
  const baseURL = `${virtualOrigin}/${directory.split('/').map(encodeURIComponent).join('/')}`;
  for (const source of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (source.uri === undefined) continue;
    const path = selectedPath(source.uri, baseURL);
    if (path === null) continue;
    if (isBinary) throw new Error(`GLB não autocontido: ${source.uri}`);
    if (!entries.has(path)) throw new Error(`Recurso local ausente: ${path}. Selecione-o junto ao .gltf.`);
  }
  const names = extensionNames(json);
  const allowedDecoderURLs = new Set();
  const blobs = new Set();
  const fileURLs = new Map();
  const errors = [];
  const manager = new LoadingManager();
  manager.onError = url => errors.push(url);
  manager.setURLModifier(url => {
    if (url.startsWith('data:')) return url;
    // GLTFLoader creates blob URLs for images stored in GLB bufferViews. Asset
    // metadata containing arbitrary blob: URIs was rejected above.
    if (url.startsWith('blob:')) { blobs.add(url); return url; }
    const parsedURL = new URL(url, baseURL);
    if (allowedDecoderURLs.has(parsedURL.href)) return parsedURL.href;
    if (parsedURL.origin !== virtualOrigin || parsedURL.search || parsedURL.hash) {
      throw new Error(`Recurso externo não permitido: ${url}`);
    }
    const path = selectedPath(parsedURL.pathname.slice(1), `${virtualOrigin}/`);
    const file = entries.get(path);
    if (!file) throw new Error(`Recurso local ausente: ${path}`);
    if (!fileURLs.has(path)) {
      const blobURL = URL.createObjectURL(file);
      fileURLs.set(path, blobURL); blobs.add(blobURL);
    }
    return fileURLs.get(path);
  });
  const loader = new GLTFLoader(manager);
  const owned = { geometries: new Set(), materials: new Set(), textures: new Set(), skeletons: new Set() };
  const pending = new Set();
  const observedPromises = new WeakSet();
  const failedParseOwner = { traverse() {} };
  registerAssetOwnership(failedParseOwner, owned);
  function remember(value, type) {
    if (Array.isArray(value)) { for (const item of value) remember(item, type); return; }
    if (value?.isBufferGeometry) owned.geometries.add(value);
    if (value?.isMaterial) owned.materials.add(value);
    if (value?.isTexture) owned.textures.add(value);
    if (type === 'skin' && value?.dispose) owned.skeletons.add(value);
  }
  function observe(promise, type) {
    // Observe but return the original promise: preserve GLTFLoader cache identity.
    if (observedPromises.has(promise)) return promise;
    observedPromises.add(promise);
    pending.add(Promise.resolve(promise).then(value => remember(value, type), () => {}));
    return promise;
  }
  loader.register(parser => {
    const getDependency = parser.getDependency;
    parser.getDependency = function (type, index) {
      return observe(getDependency.call(this, type, index), type);
    };
    const loadGeometries = parser.loadGeometries;
    parser.loadGeometries = function (primitives) {
      const result = loadGeometries.call(this, primitives);
      // r186 stores each already-started geometry promise here. Observe them
      // individually: Promise.all may reject while another geometry succeeds.
      for (const entry of Object.values(this.primitiveCache)) observe(entry.promise, 'geometry');
      return result;
    };
    return { name: 'LIV_local_resource_ownership' };
  });
  const decoders = [];
  let gltf = null;
  try {
    if (names.has('KHR_draco_mesh_compression')) {
      const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
      const path = new URL('./node_modules/three/examples/jsm/libs/draco/gltf/', import.meta.url).href;
      for (const filename of ['draco_decoder.js', 'draco_wasm_wrapper.js', 'draco_decoder.wasm']) {
        allowedDecoderURLs.add(new URL(filename, path).href);
      }
      const decoder = new DRACOLoader(manager).setDecoderPath(path).setWorkerLimit(1);
      decoders.push(decoder); loader.setDRACOLoader(decoder);
    }
    if (names.has('KHR_texture_basisu')) {
      if (!renderer) throw new Error('KTX2 requer um renderer inicializado.');
      // detectSupport reads actual backend features and must follow renderer.init().
      if (renderer.isWebGPURenderer) await renderer.init();
      const { KTX2Loader } = await import('three/addons/loaders/KTX2Loader.js');
      const path = new URL('./node_modules/three/examples/jsm/libs/basis/', import.meta.url).href;
      for (const filename of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
        allowedDecoderURLs.add(new URL(filename, path).href);
      }
      const decoder = new KTX2Loader(manager).setTranscoderPath(path).setWorkerLimit(1);
      decoders.push(decoder); decoder.detectSupport(renderer); loader.setKTX2Loader(decoder);
    }
    if (names.has('EXT_meshopt_compression') || names.has('KHR_meshopt_compression')) {
      const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
      await MeshoptDecoder.ready; loader.setMeshoptDecoder(MeshoptDecoder);
    }
    abortIfNeeded(signal);
    gltf = await loader.parseAsync(isBinary ? buffer : JSON.stringify(json), baseURL);
    registerAssetOwnership(gltf, owned);
    abortIfNeeded(signal);
    if (errors.length) throw new Error('Falha ao decodificar um recurso local do modelo.');
    const report = inspectMaterials(gltf, renderer);
    if (!report.compatible) throw new Error(report.issues.map(issue => `${issue.name || issue.type}: ${issue.message}`).join('\n'));
    gltf.localImport = { rootPath, files: [...entries.keys()], extensions: [...names], materialReport: report };
    return gltf;
  } catch (error) {
    // Wait only for dependencies the parser already initiated. No cleanup load
    // is started; late successful siblings are included before blob/worker cleanup.
    let observed = -1;
    while (observed !== pending.size) {
      observed = pending.size;
      await Promise.allSettled([...pending]);
    }
    if (gltf) disposeAsset(gltf);
    else disposeAsset(failedParseOwner);
    if (signal?.aborted) throw new DOMException('Importação cancelada.', 'AbortError');
    throw error;
  } finally {
    for (const url of blobs) URL.revokeObjectURL(url);
    for (const decoder of decoders) decoder.dispose();
  }
}
