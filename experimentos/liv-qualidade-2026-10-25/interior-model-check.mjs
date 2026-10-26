import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';
import * as THREE from '../liv-experimental-2026-10-14/node_modules/three/build/three.webgpu.js';

const here = dirname(fileURLToPath(import.meta.url));
const three = resolve(here, '../liv-experimental-2026-10-14/node_modules/three');
const bundle = await build({ entryPoints: [join(here, 'model-interior.js')], write: false, bundle: true, format: 'esm', platform: 'node',
  plugins: [{ name: 'three-local', setup(builder) {
    builder.onResolve({ filter: /^three(?:\/|$)/ }, ({ path }) => ({ path: path === 'three' || path === 'three/webgpu'
      ? join(three, 'build/three.webgpu.js') : join(three, 'examples/jsm', path.replace('three/addons/', '')) }));
  } }] });
const { upgradeInterior } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

for (const typology of ['canto', 'meio']) {
  const unit = JSON.parse(await readFile(join(here, '../../publicacao/liv-duplo-20261017/payload/liv-classico/interiores', typology, 'unidade.json'), 'utf8'));
  const snapshot = JSON.stringify(unit), points = unit.planta.comodos.flatMap(room => room.poly);
  const center = [0, 1].map(axis => (Math.min(...points.map(p => p[axis])) + Math.max(...points.map(p => p[axis]))) / 2);
  const scene = new THREE.Scene(), originalGeometry = new THREE.BoxGeometry(), originalMaterial = new THREE.MeshStandardMaterial();
  const originals = unit.planta.moveis.map((item, i) => {
    const mesh = new THREE.Mesh(originalGeometry, originalMaterial); mesh.userData.furnitureId = `movel-${i}`;
    mesh.visible = i !== 1; scene.add(mesh); return { mesh, visible: mesh.visible };
  });
  const architecture = new THREE.Mesh(originalGeometry, originalMaterial); scene.add(architecture);
  const result = upgradeInterior({ THREE, scene, layout: { unit, center, pd: 2.7 } });
  assert.equal(result.metrics.replacements, 12);
  assert.ok(result.metrics.meshes > 100);
  assert.ok(result.metrics.placementChecks.every(check => check.insideFootprint));
  assert.equal(JSON.stringify(unit), snapshot, 'A unidade de origem deve permanecer intacta.');
  for (const check of result.metrics.placementChecks) {
    const item = unit.planta.moveis[Number(check.id.replace('movel-', ''))];
    assert.deepEqual(check.position, [item.p[0] - center[0], .03, item.p[1] - center[1]]);
    assert.equal(check.rotation, (item.rot || 0) * Math.PI / 2);
  }
  const replacement = scene.getObjectByName('mobiliario-estudo-detalhado');
  assert.equal(replacement.visible, false);
  result.setEnabled(true); assert.equal(replacement.visible, true); assert.equal(architecture.visible, true);
  for (const check of result.metrics.placementChecks) assert.equal(originals[Number(check.id.replace('movel-', ''))].mesh.visible, false);
  result.setEnabled(false);
  for (const original of originals) assert.equal(original.mesh.visible, original.visible);
  let disposedGeometry = 0, disposedMaterial = 0;
  const replacementGeometry = new Set(), replacementMaterial = new Set();
  replacement.traverse(mesh => { if (mesh.isMesh) { replacementGeometry.add(mesh.geometry); replacementMaterial.add(mesh.material); } });
  for (const geometry of replacementGeometry) geometry.addEventListener('dispose', () => disposedGeometry++);
  for (const material of replacementMaterial) material.addEventListener('dispose', () => disposedMaterial++);
  result.setEnabled(true); result.dispose(); result.dispose(); result.setEnabled(true);
  assert.equal(scene.getObjectByName('mobiliario-estudo-detalhado'), undefined);
  assert.equal(disposedGeometry, replacementGeometry.size); assert.equal(disposedMaterial, replacementMaterial.size);
  for (const original of originals) assert.equal(original.mesh.visible, original.visible);
  originalGeometry.dispose(); originalMaterial.dispose();
  console.log(`${typology}: ${result.metrics.replacements} modelos; ${result.metrics.meshes} malhas; ${Math.round(result.metrics.triangles)} triângulos; footprint, origem e dispose aprovados.`);
}
