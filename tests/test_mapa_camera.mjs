import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../experimentos/liv-experimental-2026-10-14/node_modules/three/build/three.module.js';
import {applyMapCamera,withStandardDepthRange} from '../experimentos/liv-experimental-2026-10-14/mapa-camera.js';

test('sombras usam profundidade integral e devolvem o intervalo reservado ao mapa, inclusive após falha',()=>{
  let current=[0,.9999];
  const gl={DEPTH_RANGE:1,getParameter(key){assert.equal(key,1);return [...current];},depthRange(near,far){current=[near,far];}};
  const result=withStandardDepthRange(gl,()=>{assert.deepEqual(current,[0,1]);return 'desenhado';});
  assert.equal(result,'desenhado');assert.deepEqual(current,[0,.9999]);
  assert.throws(()=>withStandardDepthRange(gl,()=>{assert.deepEqual(current,[0,1]);throw Error('GPU');}),/GPU/);
  assert.deepEqual(current,[0,.9999]);
});

test('câmera do mapa recupera o olho para reflexos sem mover o prédio ou o picking',()=>{
  const original=new THREE.PerspectiveCamera(45,1.6,.1,3000),camera=new THREE.Camera();
  for(const position of [[300,200,180],[-180,80,320],[0,500,.1]]){
    original.position.set(...position);original.lookAt(0,0,0);original.updateMatrixWorld(true);
    const projection=new THREE.Matrix4().multiplyMatrices(original.projectionMatrix,original.matrixWorldInverse);
    applyMapCamera(camera,projection);
    assert.ok(camera.position.distanceTo(original.position)<1e-6,'olho no lugar real');
    const composite=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    assert.ok(composite.elements.every((value,i)=>Math.abs(value-projection.elements[i])<1e-8),'geometria continua amarrada ao mapa');
    const point=new THREE.Vector3(.2,-.3,-.5);
    assert.ok(point.clone().unproject(camera).distanceTo(point.clone().unproject(original))<1e-6,'raycast continua usando o mesmo raio');
  }
});
