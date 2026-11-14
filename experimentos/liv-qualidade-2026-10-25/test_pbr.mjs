import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../liv-experimental-2026-10-14/node_modules/three/build/three.webgpu.js';
import { createPBRSet, architecturalSurfaces } from './materials-pbr.js';

for (const type of ['wood', 'stone', 'fabric', 'plaster']) test(`${type}: mapas PBR determinísticos e normais válidas`, () => {
  const set = createPBRSet(THREE, type), duplicate = createPBRSet(THREE, type);
  assert.equal(set.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(set.normalMap.colorSpace, THREE.NoColorSpace);
  assert.equal(set.roughnessMap.colorSpace, THREE.NoColorSpace);
  for (const slot of ['map', 'normalMap', 'roughnessMap']) {
    const texture = set[slot];
    assert.equal(texture.image.width, 512); assert.equal(texture.image.height, 512);
    assert.equal(texture.wrapS, THREE.RepeatWrapping); assert.equal(texture.wrapT, THREE.RepeatWrapping);
    assert.deepEqual(texture.repeat.toArray(), [1, 1]);
    assert.deepEqual(texture.image.data, duplicate[slot].image.data);
    assert.ok(texture.generateMipmaps);
  }
  const normal = set.normalMap.image.data, roughness = set.roughnessMap.image.data;
  let maxSlope = 0, minRoughness = 255, maxRoughness = 0;
  for (let at = 0; at < normal.length; at += 4) {
    const nx = normal[at] / 255 * 2 - 1, ny = normal[at + 1] / 255 * 2 - 1, nz = normal[at + 2] / 255 * 2 - 1;
    assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < .012);
    assert.ok(nz > .8); maxSlope = Math.max(maxSlope, Math.abs(nx), Math.abs(ny));
    minRoughness = Math.min(minRoughness, roughness[at + 1]);
    maxRoughness = Math.max(maxRoughness, roughness[at + 1]);
  }
  assert.ok(maxSlope > .01, 'a normal descreve relevo real');
  assert.ok(maxRoughness - minRoughness > 10, 'rugosidade varia com o acabamento');
  assert.ok(!Object.keys(set).includes('dispose'), 'o set aceita spread nos parâmetros do material');
  let disposed = 0;
  for (const slot of ['map', 'normalMap', 'roughnessMap']) set[slot].addEventListener('dispose', () => disposed++);
  set.dispose(); set.dispose(); duplicate.dispose();
  assert.equal(disposed, 3);
});

test('pisos Node RGBM recebem textura na escala original e voltam à aparência anterior', () => {
  const scene = new THREE.Scene(), originalMap = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  const floor = new THREE.MeshStandardNodeMaterial({ map: originalMap, color: '#b89369',
    roughness: .52, normalScale: new THREE.Vector2(.2, .3), bumpMap: originalMap,
    bumpScale: .006, vertexColors: true });
  floor.userData.studioId = 'm2'; floor.userData.livBakedTransport = true;
  const transport = {}; floor.livIrradiance = transport;
  const coldFloor = new THREE.MeshStandardMaterial({ color: '#b4b5b1' }); coldFloor.userData.studioId = 'm1';
  const anonymous = new THREE.MeshStandardMaterial({ roughness: .37 });
  const sourceColor = floor.color.clone();
  scene.add(new THREE.Mesh(new THREE.BufferGeometry(), [floor, coldFloor, anonymous]));
  const surfaces = architecturalSurfaces({ THREE, scene, kind: 'interior' });
  assert.equal(surfaces.metrics.materials, 2);
  assert.equal(surfaces.metrics.textures, 0, 'texturas só são alocadas quando o estudo é ativado');
  surfaces.setEnabled(true);
  assert.notEqual(floor.map, originalMap); assert.ok(floor.normalMap); assert.ok(floor.roughnessMap);
  assert.deepEqual(floor.map.repeat.toArray(), [2.4, 2.4]);
  assert.deepEqual(coldFloor.map.repeat.toArray(), [1.2, 1.2]);
  assert.equal(floor.vertexColors, false); assert.equal(floor.bumpMap, null);
  assert.equal(floor.livIrradiance, transport); assert.equal(floor.userData.livBakedTransport, true);
  assert.equal(anonymous.map, null); assert.equal(anonymous.roughness, .37);
  const enhancedMap = floor.map;
  surfaces.setEnabled(false);
  assert.equal(floor.map, originalMap); assert.equal(floor.normalMap, null); assert.equal(floor.roughnessMap, null);
  assert.equal(floor.bumpMap, originalMap); assert.equal(floor.bumpScale, .006); assert.equal(floor.roughness, .52);
  assert.ok(floor.color.equals(sourceColor)); assert.equal(floor.vertexColors, true);
  assert.deepEqual(floor.normalScale.toArray(), [.2, .3]);
  surfaces.setEnabled(true); assert.equal(floor.map, enhancedMap); assert.equal(surfaces.metrics.textures, 6);
  let disposed = 0; enhancedMap.addEventListener('dispose', () => disposed++);
  surfaces.dispose(); surfaces.dispose();
  assert.equal(disposed, 1); assert.equal(floor.map, originalMap); assert.equal(surfaces.metrics.enabled, false);
  originalMap.dispose(); floor.dispose(); coldFloor.dispose(); anonymous.dispose();
});

test('materiais reconhecidos por nome são compartilhados e materiais sem PBR não são trocados', () => {
  const scene = new THREE.Scene(), named = new THREE.MeshStandardMaterial({ name: 'Reboco fachada' });
  const basic = new THREE.MeshBasicMaterial({ name: 'Parede sem iluminação' });
  scene.add(new THREE.Mesh(new THREE.BufferGeometry(), named), new THREE.Mesh(new THREE.BufferGeometry(), named),
    new THREE.Mesh(new THREE.BufferGeometry(), basic));
  const surfaces = architecturalSurfaces({ THREE, scene, kind: 'exterior' });
  surfaces.setEnabled(true);
  assert.equal(surfaces.metrics.materials, 1); assert.equal(surfaces.metrics.textures, 3);
  assert.ok(named.normalMap); assert.equal(basic.map, null);
  surfaces.dispose(); named.dispose(); basic.dispose();
  assert.throws(() => createPBRSet(THREE, 'ausente'), /desconhecida/);
});
