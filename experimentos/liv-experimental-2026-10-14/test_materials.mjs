import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, RawShaderMaterial, ShaderMaterial, Texture, Vector2 } from 'three';
import { createStockMaterial, inspectMaterials, disposeAsset, registerAssetOwnership } from './materials.js';
import { parseLocalGLTF } from './asset-loader.js';

const renderer = { library: { getMaterialNodeClass: type => ({
  MeshBasicMaterial: class MeshBasicNodeMaterial {},
  MeshStandardMaterial: class MeshStandardNodeMaterial {},
  MeshPhysicalMaterial: class MeshPhysicalNodeMaterial {},
})[type] ?? null } };

test('stock material constructors preserve physical settings and texture references', () => {
  const normalMap = new Texture();
  const material = createStockMaterial('MeshPhysicalMaterial', {
    name: 'vidro', transmission: 0.9, thickness: 0.35, ior: 1.45, roughness: 0.08,
    clearcoat: 0.6, anisotropy: 0.4, sheen: 0.3, iridescence: 0.2,
    dispersion: 0.15, normalMap, normalScale: new Vector2(0.4, 0.7),
  });
  assert.equal(material.constructor, MeshPhysicalMaterial);
  assert.equal(material.isNodeMaterial, undefined);
  assert.equal(material.normalMap, normalMap);
  assert.equal(material.transmission, 0.9);
  assert.equal(material.dispersion, 0.15);
  assert.deepEqual(material.normalScale.toArray(), [0.4, 0.7]);
  assert.equal(createStockMaterial('basic').constructor, MeshBasicMaterial);
  assert.equal(createStockMaterial('standard').constructor, MeshStandardMaterial);
  assert.throws(() => createStockMaterial('constructor'), /não suportado/);
});

test('inspection reports properties, UV channels and color spaces without mutating references', () => {
  const texture = new Texture({ width: 64, height: 32 });
  texture.colorSpace = 'srgb'; texture.channel = 1; texture.repeat.set(2, 3);
  const material = createStockMaterial('physical', { map: texture, clearcoat: 0.5, thickness: 0.7 });
  const mesh = new Mesh(new BoxGeometry(), material);
  const materialVersion = material.version;
  const textureVersion = texture.version;
  const report = inspectMaterials(mesh, renderer);
  assert.equal(report.compatible, true);
  assert.equal(report.materials[0].type, 'MeshPhysicalMaterial');
  assert.equal(report.materials[0].properties.clearcoat, 0.5);
  assert.equal(report.materials[0].properties.attenuationDistance, 'Infinity');
  assert.equal(report.materials[0].textures[0].channel, 1);
  assert.equal(report.materials[0].textures[0].colorSpace, 'srgb');
  assert.deepEqual(report.materials[0].textures[0].repeat, [2, 3]);
  assert.equal(mesh.material, material); assert.equal(material.map, texture);
  assert.equal(material.version, materialVersion); assert.equal(texture.version, textureVersion);
  assert.equal(report.textureCount, 1); assert.equal(report.meshCount, 1);
  JSON.stringify(report);
});

test('shader materials, custom compile hooks and missing conversion fail explicitly', () => {
  for (const material of [new ShaderMaterial(), new RawShaderMaterial()]) {
    const report = inspectMaterials(new Mesh(new BoxGeometry(), material), renderer);
    assert.equal(report.compatible, false);
    assert.ok(report.issues.some(issue => /adaptação explícita/.test(issue.message)));
  }
  const material = createStockMaterial('standard');
  material.onBeforeCompile = shader => { shader.fragmentShader += 'custom'; };
  const report = inspectMaterials(new Mesh(new BoxGeometry(), material), renderer);
  assert.equal(report.compatible, false);
  assert.ok(report.issues.some(issue => /onBeforeCompile/.test(issue.message)));
  assert.equal(inspectMaterials(new Mesh(new BoxGeometry(), createStockMaterial('basic')), {}).compatible, false);
});

test('disposal is unique across meshes/scenes, closes shared bitmaps and ignores environment', () => {
  const events = { geometry: 0, material: 0, texture: 0, bitmap: 0, environment: 0, skeleton: 0 };
  const image = { close: () => events.bitmap++ };
  const firstTexture = new Texture(image);
  const secondTexture = new Texture(image);
  const environment = new Texture();
  const material = createStockMaterial('physical', { map: firstTexture, normalMap: secondTexture });
  const geometry = new BoxGeometry();
  geometry.addEventListener('dispose', () => events.geometry++);
  material.addEventListener('dispose', () => events.material++);
  firstTexture.addEventListener('dispose', () => events.texture++);
  secondTexture.addEventListener('dispose', () => events.texture++);
  environment.addEventListener('dispose', () => events.environment++);
  const sceneA = new Group(); const sceneB = new Group();
  sceneA.environment = environment;
  const meshA = new Mesh(geometry, material);
  const meshB = new Mesh(geometry, material);
  const skeleton = { dispose: () => events.skeleton++ };
  meshA.skeleton = skeleton; meshB.skeleton = skeleton;
  sceneA.add(meshA); sceneB.add(meshB);
  const asset = { scene: sceneA, scenes: [sceneA, sceneB] };
  assert.deepEqual(disposeAsset(asset), { geometries: 1, materials: 1, textures: 2, imageBitmaps: 1, skeletons: 1 });
  assert.deepEqual(events, { geometry: 1, material: 1, texture: 2, bitmap: 1, environment: 0, skeleton: 1 });
  assert.deepEqual(disposeAsset(asset), { geometries: 0, materials: 0, textures: 0, imageBitmaps: 0, skeletons: 0 });
  assert.equal(disposeAsset(sceneB).materials, 0);
});

test('inspection excludes unassigned owned originals while disposal releases both resource sets', () => {
  const usedTexture = new Texture(); const unusedTexture = new Texture();
  const assigned = createStockMaterial('physical', { map: usedTexture, transmission: 0.4 });
  const original = createStockMaterial('physical', { map: unusedTexture, transmission: 0.4 });
  const assignedGeometry = new BoxGeometry(); const unusedGeometry = new BoxGeometry();
  const root = new Group(); root.add(new Mesh(assignedGeometry, assigned));
  const asset = { scene: root, scenes: [root] };
  registerAssetOwnership(asset, {
    materials: new Set([assigned, original]), textures: new Set([usedTexture, unusedTexture]),
    geometries: new Set([assignedGeometry, unusedGeometry]), skeletons: new Set(),
  });
  const report = inspectMaterials(asset, renderer);
  assert.deepEqual(report.materials.map(material => material.uuid), [assigned.uuid]);
  assert.equal(report.materialCount, 1); assert.equal(report.textureCount, 1); assert.equal(report.geometryCount, 1);
  assert.deepEqual(report.materials[0].textures.map(texture => texture.uuid), [usedTexture.uuid]);
  assert.equal(root.children[0].material, assigned); assert.equal(assigned.map, usedTexture);
  assert.deepEqual(disposeAsset(asset), { geometries: 2, materials: 2, textures: 2, imageBitmaps: 0, skeletons: 0 });
  assert.deepEqual(disposeAsset(asset), { geometries: 0, materials: 0, textures: 0, imageBitmaps: 0, skeletons: 0 });
});

function localFile(name, contents, relativePath = '') {
  const file = new Blob([typeof contents === 'object' && !(contents instanceof ArrayBuffer) && !ArrayBuffer.isView(contents)
    ? JSON.stringify(contents) : contents]);
  Object.defineProperties(file, { name: { value: name }, webkitRelativePath: { value: relativePath } });
  return file;
}

function triangleGLTF(uri) {
  return {
    asset: { version: '2.0' },
    extensionsUsed: ['KHR_materials_clearcoat', 'KHR_materials_transmission', 'KHR_materials_ior'],
    buffers: [{ uri, byteLength: 36 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
    materials: [{ name: 'vidro-importado', pbrMetallicRoughness: { roughnessFactor: 0.1, metallicFactor: 0.2 },
      extensions: { KHR_materials_clearcoat: { clearcoatFactor: 0.7 },
        KHR_materials_transmission: { transmissionFactor: 0.8 }, KHR_materials_ior: { ior: 1.4 } } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
  };
}

// ProgressEvent is a browser API used by Three's FileLoader; the local Node
// contract tests need only its event payload, not DOM or a GPU renderer.
globalThis.ProgressEvent ??= class ProgressEvent extends Event {
  constructor(type, values) { super(type); Object.assign(this, values); }
};

test('local selection rejects missing/duplicate dependencies and remote resource URLs before fetch', async () => {
  let requests = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (...args) => { requests++; return originalFetch(...args); };
  try {
    await assert.rejects(parseLocalGLTF([localFile('model.gltf', triangleGLTF('mesh.bin'))], renderer), /Recurso local ausente: mesh.bin/);
    const duplicate = localFile('mesh.bin', new Uint8Array(36));
    await assert.rejects(parseLocalGLTF([duplicate, duplicate], renderer), /Caminho local duplicado/);
    await assert.rejects(parseLocalGLTF([localFile('model.gltf', triangleGLTF('https:\/\/example.com\/mesh.bin'))], renderer), /Recurso externo/);
    await assert.rejects(parseLocalGLTF([localFile('model.gltf', triangleGLTF('mesh.bin?v=1')), duplicate], renderer), /não local/);
    const required = { asset: { version: '2.0' }, extensionsRequired: ['KHR_gaussian_splatting'] };
    await assert.rejects(parseLocalGLTF([localFile('model.gltf', required)], renderer), /Extensão obrigatória não suportada/);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('multifile VFS resolves relative paths exactly and keeps GLTFLoader Physical materials intact', async () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const files = [localFile('model.gltf', triangleGLTF('../buffers/mesh%20data.bin'), 'pacote/model/model.gltf'),
    localFile('mesh data.bin', positions, 'pacote/buffers/mesh data.bin')];
  const originalRevoke = URL.revokeObjectURL;
  const revoked = [];
  URL.revokeObjectURL = url => { revoked.push(url); originalRevoke(url); };
  let gltf;
  try {
    gltf = await parseLocalGLTF(files, renderer);
    const material = gltf.scene.children[0].material;
    assert.equal(material.constructor, MeshPhysicalMaterial);
    assert.equal(material.transmission, 0.8); assert.equal(material.clearcoat, 0.7);
    assert.equal(material.ior, 1.4); assert.equal(material.roughness, 0.1);
    assert.equal(material.isNodeMaterial, undefined);
    assert.equal(gltf.localImport.materialReport.compatible, true);
    assert.equal(gltf.localImport.materialReport.materials[0].uuid, material.uuid);
    assert.equal(revoked.length, 1); assert.ok(revoked[0].startsWith('blob:'));
  } finally { URL.revokeObjectURL = originalRevoke; if (gltf) disposeAsset(gltf); }
});

test('data URIs stay in memory and cancellation after parse disposes the produced asset', async () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const uri = `data:application/octet-stream;base64,${Buffer.from(positions.buffer).toString('base64')}`;
  const controller = new AbortController();
  const originalFetch = globalThis.fetch;
  const originalDispose = MeshPhysicalMaterial.prototype.dispose;
  const disposed = new Set(); let requests = 0;
  MeshPhysicalMaterial.prototype.dispose = function () { assert.ok(!disposed.has(this.uuid)); disposed.add(this.uuid); originalDispose.call(this); };
  globalThis.fetch = (...args) => { requests++; controller.abort(); return originalFetch(...args); };
  try {
    await assert.rejects(parseLocalGLTF([localFile('model.gltf', triangleGLTF(uri))], renderer,
      { signal: controller.signal }), error => error.name === 'AbortError');
    assert.equal(requests, 1); assert.ok(disposed.size >= 1);
    await assert.rejects(parseLocalGLTF([], renderer, { signal: controller.signal }), error => error.name === 'AbortError');
  } finally { globalThis.fetch = originalFetch; delete MeshPhysicalMaterial.prototype.dispose; }
});

function glbFrom(json, binary) {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonSize = Math.ceil(text.byteLength / 4) * 4;
  const binSize = Math.ceil(binary.byteLength / 4) * 4;
  const buffer = new ArrayBuffer(12 + 8 + jsonSize + 8 + binSize);
  const view = new DataView(buffer); const bytes = new Uint8Array(buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, jsonSize, true); view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + jsonSize); bytes.set(text, 20);
  view.setUint32(20 + jsonSize, binSize, true); view.setUint32(24 + jsonSize, 0x004e4942, true);
  bytes.set(new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength), 28 + jsonSize);
  return buffer;
}

test('a self-contained GLB parses; incomplete headers and external GLB dependencies fail', async () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const json = triangleGLTF(undefined);
  const bytes = glbFrom(json, positions);
  const gltf = await parseLocalGLTF([localFile('modelo.glb', bytes)], renderer);
  assert.equal(gltf.scene.children[0].material.constructor, MeshPhysicalMaterial);
  assert.equal(gltf.scene.children[0].geometry.attributes.position.count, 3);
  assert.equal(gltf.localImport.rootPath, 'modelo.glb'); disposeAsset(gltf);
  await assert.rejects(parseLocalGLTF([localFile('modelo.glb', new ArrayBuffer(2))], renderer), /cabeçalho incompleto/);
  const external = glbFrom(triangleGLTF('mesh.bin'), positions);
  await assert.rejects(parseLocalGLTF([localFile('modelo.glb', external)], renderer), /não autocontido/);
  await assert.rejects(parseLocalGLTF([localFile('modelo.glb', bytes), localFile('mesh.bin', positions)], renderer), /único arquivo autocontido/);
});

test('a failed geometry sibling disposes the material and bitmap that already loaded', async () => {
  const json = triangleGLTF('corrompido.bin');
  json.images = [{ uri: 'data:image/png;base64,iVBORw0KGgo=' }];
  json.textures = [{ source: 0 }];
  json.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  const originalSelf = globalThis.self;
  const originalBitmap = globalThis.createImageBitmap;
  const originalFetch = globalThis.fetch;
  const originalMaterialDispose = MeshPhysicalMaterial.prototype.dispose;
  const originalTextureDispose = Texture.prototype.dispose;
  let bitmapLoaded = false; let bitmapClosed = 0; let materialDisposed = 0; let textureDisposed = 0; let delayedBuffers = 0;
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async () => {
    bitmapLoaded = true;
    return { width: 1, height: 1, close: () => bitmapClosed++ };
  };
  // Let the image/material finish first, then deliver an invalid position buffer.
  globalThis.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    if (url.startsWith('blob:')) { delayedBuffers++; await new Promise(resolve => setTimeout(resolve, 25)); }
    return originalFetch(...args);
  };
  MeshPhysicalMaterial.prototype.dispose = function () {
    assert.equal(bitmapLoaded, true); materialDisposed++; originalMaterialDispose.call(this);
  };
  Texture.prototype.dispose = function () { textureDisposed++; originalTextureDispose.call(this); };
  try {
    await assert.rejects(parseLocalGLTF([localFile('model.gltf', json),
      localFile('corrompido.bin', new Uint8Array(1))], renderer), /buffer|length|offset/i);
    assert.equal(delayedBuffers, 1); assert.equal(bitmapLoaded, true); assert.equal(bitmapClosed, 1);
    assert.equal(materialDisposed, 1); assert.equal(textureDisposed, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSelf === undefined) delete globalThis.self; else globalThis.self = originalSelf;
    if (originalBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = originalBitmap;
    delete MeshPhysicalMaterial.prototype.dispose; Texture.prototype.dispose = originalTextureDispose;
  }
});
