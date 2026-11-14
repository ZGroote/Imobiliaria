import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import * as THREE from '../liv-experimental-2026-10-14/node_modules/three/build/three.webgpu.js';
import { upgradeExterior } from './model-exterior.js';

const asset = new URL('../../publicacao/liv-duplo-20261017/payload/liv-classico/modelo/entrada/candidato/assets/scene.json.gz', import.meta.url);
const data = JSON.parse(gunzipSync(await readFile(asset)));
function attribute(spec, instance = false) {
  const bytes = Buffer.from(spec.base64, 'base64');
  const copied = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new (instance ? THREE.InstancedBufferAttribute : THREE.BufferAttribute)(new globalThis[spec.type](copied), spec.itemSize, spec.normalized);
}
const scene = new THREE.Scene();
const geometries = data.geometries.map(spec => {
  const geometry = new THREE.BufferGeometry();
  for (const [name, value] of Object.entries(spec.attributes)) geometry.setAttribute(name, attribute(value));
  if (spec.index) geometry.setIndex(attribute(spec.index));
  return geometry;
});
const materials = data.materials.map(spec => new THREE.MeshStandardMaterial({ name: spec.name,
  color: new THREE.Color().fromArray(spec.color || [1, 1, 1]) }));
const originals = data.meshes.map(spec => {
  const object = spec.instances ? new THREE.InstancedMesh(geometries[spec.geometry], materials[spec.material], spec.instances.count)
    : new THREE.Mesh(geometries[spec.geometry], materials[spec.material]);
  if (spec.instances) object.instanceMatrix = attribute(spec.instances.matrix, true);
  object.matrix.fromArray(spec.matrix); object.matrixAutoUpdate = false; object.userData = spec.userData;
  object.name = spec.name; scene.add(object); return object;
});
const originalSnapshot = originals.map(object => ({ object, visible: object.visible, geometry: object.geometry,
  material: object.material, matrix: object.matrix.clone(), instances: object.instanceMatrix?.array.slice() }));
const architecture = originals.filter(object => !/folha|tronco|palmeira|agua|infantil/.test(object.material.name));
const upgrade = upgradeExterior({ THREE, scene });
assert.equal(upgrade.metrics.canopyVolumes, 646);
assert.equal(upgrade.metrics.trees, 146);
assert.equal(upgrade.metrics.palms, 13);
assert.equal(upgrade.metrics.pools, 2);
assert(upgrade.metrics.leaves > 100000);
assert(upgrade.metrics.triangles < 1850000, 'Orçamento de triângulos da vegetação/piscinas ultrapassado');
assert(upgrade.metrics.drawCalls <= 7);
const added = scene.children.find(object => object.userData.livModelUpgrade);
assert(added && !added.visible);
const generatedResources = new Set(); let resourceDisposals = 0;
added.traverse(object => {
  if (!object.isMesh) return;
  generatedResources.add(object.geometry); generatedResources.add(object.material);
  for (const value of Object.values(object.material)) if (value?.isTexture) generatedResources.add(value);
  const positions = object.geometry.getAttribute('position').array;
  assert(positions.every(Number.isFinite), `${object.name}: posição inválida`);
  if (object.isInstancedMesh) assert(object.instanceMatrix.array.every(Number.isFinite), `${object.name}: matriz inválida`);
});
for (const resource of generatedResources) resource.addEventListener('dispose', () => resourceDisposals++);

// A/B devolve exatamente as mesmas referências, visibilidades e matrizes de entrada.
for (let toggle = 0; toggle < 3; toggle++) {
  upgrade.setEnabled(true); assert(added.visible);
  for (const object of architecture) assert(object.visible, `${object.name}: arquitetura alterada`);
  upgrade.setEnabled(false);
  for (const saved of originalSnapshot) {
    assert.equal(saved.object.visible, saved.visible); assert.equal(saved.object.geometry, saved.geometry);
    assert.equal(saved.object.material, saved.material); assert(saved.object.matrix.equals(saved.matrix));
    if (saved.instances) assert.deepEqual(saved.object.instanceMatrix.array, saved.instances);
  }
}

// Toda folha de cada instância fica dentro do volume elipsoidal original.
const leaves = added.children.find(object => object.name.startsWith('Folhas'));
const sourceFoliage = originals.filter(object => object.isInstancedMesh && /^MAT-site-folha-(media|escura|clara)$/.test(object.material.name) && object.count > 10);
let sprayIndex = 0;
for (const source of sourceFoliage) for (let instance = 0; instance < source.count; instance++) {
  const sourceMatrix = new THREE.Matrix4(); source.getMatrixAt(instance, sourceMatrix);
  sourceMatrix.premultiply(source.matrixWorld); const inverse = sourceMatrix.clone().invert();
  const scale = new THREE.Vector3(); sourceMatrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  const count = Math.max(scale.x, scale.y, scale.z) < .7 ? 22 : 40;
  for (let spray = 0; spray < count; spray++, sprayIndex++) {
    const instanceMatrix = new THREE.Matrix4(); leaves.getMatrixAt(sprayIndex, instanceMatrix);
    const relative = inverse.clone().multiply(instanceMatrix), position = leaves.geometry.getAttribute('position');
    for (let vertex = 0; vertex < position.count; vertex++) {
      const point = new THREE.Vector3().fromBufferAttribute(position, vertex).applyMatrix4(relative);
      assert(Math.abs(point.x) <= .9511 && Math.abs(point.y) <= 1 && Math.abs(point.z) <= 1, 'Folhagem saiu do limite original');
    }
  }
}
assert.equal(sprayIndex, upgrade.metrics.leafSprays);
upgrade.setEnabled(true); upgrade.dispose();
assert(!scene.children.includes(added));
assert.equal(resourceDisposals, generatedResources.size, 'Recurso gráfico visível não foi liberado');
upgrade.dispose(); upgrade.setEnabled(true);
assert.equal(resourceDisposals, generatedResources.size, 'Dispose não é idempotente');
for (const saved of originalSnapshot) assert.equal(saved.object.visible, saved.visible);
console.log(JSON.stringify({ passed: true, metrics: upgrade.metrics, resourcesVerified: generatedResources.size }, null, 2));
for (const geometry of geometries) geometry.dispose();
for (const material of materials) material.dispose();
