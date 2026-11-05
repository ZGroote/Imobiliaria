import { Material, MeshBasicMaterial, MeshStandardMaterial, MeshPhysicalMaterial } from 'three';

const constructors = {
  basic: MeshBasicMaterial, MeshBasicMaterial,
  standard: MeshStandardMaterial, MeshStandardMaterial,
  physical: MeshPhysicalMaterial, MeshPhysicalMaterial,
};

/** Keep stock PBR materials intact; WebGPURenderer's library performs its own conversion. */
export function createStockMaterial(type, props = {}) {
  const Constructor = Object.hasOwn(constructors, type) ? constructors[type] : null;
  if (!Constructor) throw new Error(`Tipo de material não suportado: ${type}`);
  return new Constructor(props);
}

function rootsOf(asset) {
  const roots = asset?.scenes?.length ? asset.scenes : [asset?.scene ?? asset];
  return [...new Set(roots.filter(root => typeof root?.traverse === 'function'))];
}

const assetOwnership = new WeakMap();

// GLTFLoader can create textures/materials before a sibling dependency rejects.
// Its parser plugin records those resources here without converting any material.
export function registerAssetOwnership(asset, owned) {
  assetOwnership.set(asset, owned);
}

function resourcesOf(asset, includeOwned = false) {
  const roots = rootsOf(asset);
  const objects = new Set();
  const materials = new Set();
  const geometries = new Set();
  const textures = new Set();
  const skeletons = new Set();
  // The viewer's shared lighting is owned by the viewer, not an imported model.
  const environments = new Set(roots.map(root => root.environment).filter(Boolean));
  for (const root of roots) root.traverse(object => {
    objects.add(object);
    if (object.geometry?.isBufferGeometry) geometries.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material?.isMaterial) materials.add(material);
    }
  });
  const owned = includeOwned ? assetOwnership.get(asset) : null;
  for (const value of owned?.geometries ?? []) geometries.add(value);
  for (const value of owned?.materials ?? []) materials.add(value);
  for (const value of owned?.textures ?? []) if (!environments.has(value)) textures.add(value);
  for (const value of owned?.skeletons ?? []) skeletons.add(value);
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value?.isTexture && !environments.has(value)) textures.add(value);
    }
  }
  return { roots, objects, materials, geometries, textures, skeletons };
}

const properties = [
  'color', 'opacity', 'transparent', 'alphaTest', 'side', 'depthWrite', 'depthTest',
  'roughness', 'metalness', 'emissive', 'emissiveIntensity', 'normalScale',
  'aoMapIntensity', 'lightMapIntensity', 'envMapIntensity', 'bumpScale',
  'clearcoat', 'clearcoatRoughness', 'clearcoatNormalScale', 'transmission',
  'thickness', 'ior', 'attenuationDistance', 'attenuationColor', 'sheen',
  'sheenColor', 'sheenRoughness', 'iridescence', 'iridescenceIOR',
  'iridescenceThicknessRange', 'anisotropy', 'anisotropyRotation',
  'specularIntensity', 'specularColor', 'dispersion', 'reflectivity',
];

function describeValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (value?.toArray) return value.toArray();
  if (Array.isArray(value)) return [...value];
  return value;
}

function describeTexture(slot, texture) {
  const image = texture.image;
  return {
    slot, uuid: texture.uuid, name: texture.name, type: texture.constructor.name,
    colorSpace: texture.colorSpace, channel: texture.channel, flipY: texture.flipY,
    repeat: texture.repeat.toArray(), offset: texture.offset.toArray(),
    center: texture.center.toArray(), rotation: texture.rotation,
    wrapS: texture.wrapS, wrapT: texture.wrapT,
    width: image?.width ?? null, height: image?.height ?? null,
    compressed: Boolean(texture.isCompressedTexture),
  };
}

/** Describe assigned tree resources only. Cleanup's unassigned originals are omitted. */
export function inspectMaterials(asset, renderer) {
  const resources = resourcesOf(asset);
  const issues = [];
  const materials = [];
  for (const material of resources.materials) {
    const materialIssues = [];
    if (material.isShaderMaterial || material.isRawShaderMaterial) {
      materialIssues.push('ShaderMaterial/RawShaderMaterial requer adaptação explícita para TSL.');
    }
    if (material.onBeforeCompile !== Material.prototype.onBeforeCompile) {
      materialIssues.push('onBeforeCompile personalizado não é convertido automaticamente.');
    }
    const nodeClass = material.isNodeMaterial ? material.constructor
      : renderer?.library?.getMaterialNodeClass?.(material.type);
    if (!nodeClass) materialIssues.push(`A biblioteca do renderer não converte ${material.type}.`);
    for (const message of materialIssues) issues.push({ uuid: material.uuid, name: material.name, type: material.type, message });
    const settings = {};
    for (const key of properties) if (material[key] !== undefined) settings[key] = describeValue(material[key]);
    materials.push({
      uuid: material.uuid, name: material.name, type: material.type,
      nodeMaterial: Boolean(material.isNodeMaterial), convertedBy: nodeClass?.name ?? null,
      compatible: materialIssues.length === 0, properties: settings,
      textures: Object.entries(material).filter(([, value]) => value?.isTexture)
        .map(([slot, texture]) => describeTexture(slot, texture)),
    });
  }
  return {
    compatible: issues.length === 0, issues, materials,
    meshCount: [...resources.objects].filter(object => object.isMesh).length,
    geometryCount: resources.geometries.size, textureCount: resources.textures.size,
    materialCount: materials.length, sceneCount: resources.roots.length,
  };
}

const disposedRoots = new WeakSet();
const disposedResources = new WeakSet();

function disposeOnce(resource, method, counter, counts) {
  if (!resource || disposedResources.has(resource)) return;
  disposedResources.add(resource);
  resource[method]?.();
  counts[counter]++;
}

/** Dispose the model's own mesh resources across every GLTF scene; never scene.environment. */
export function disposeAsset(asset) {
  const roots = rootsOf(asset).filter(root => !disposedRoots.has(root));
  const counts = { geometries: 0, materials: 0, textures: 0, imageBitmaps: 0, skeletons: 0 };
  const owned = assetOwnership.get(asset);
  if (!roots.length && !owned) return counts;
  const scope = { scenes: roots };
  if (owned) registerAssetOwnership(scope, owned);
  const resources = resourcesOf(scope, true);
  for (const root of roots) disposedRoots.add(root);
  for (const texture of resources.textures) {
    const images = Array.isArray(texture.image) ? texture.image : [texture.image];
    for (const image of images) {
      // ImageBitmap has close(); HTMLImageElement and typed-array data do not.
      if (typeof image?.close === 'function') disposeOnce(image, 'close', 'imageBitmaps', counts);
    }
    disposeOnce(texture, 'dispose', 'textures', counts);
  }
  for (const geometry of resources.geometries) disposeOnce(geometry, 'dispose', 'geometries', counts);
  for (const material of resources.materials) disposeOnce(material, 'dispose', 'materials', counts);
  for (const skeleton of resources.skeletons) disposeOnce(skeleton, 'dispose', 'skeletons', counts);
  return counts;
}
