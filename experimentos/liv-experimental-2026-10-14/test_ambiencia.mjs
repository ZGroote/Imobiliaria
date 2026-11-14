import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {exteriorAmbience,requestedAmbience} from './ambiencia.js';

test('ambiencia preserva identidade, restaura o dia e não refaz sombra',()=>{
  const material=new THREE.MeshPhysicalMaterial({color:0x9baab2,roughness:.24,metalness:.1,clearcoat:.8});
  const color=material.color.toArray(),scene=new THREE.Scene(),light=new THREE.DirectionalLight(0xffefd8,2);
  light.castShadow=true;light.shadow.autoUpdate=false;light.shadow.needsUpdate=false;scene.add(light);
  const lightColor=light.color.toArray(),renderer={toneMappingExposure:1.2},stage={style:{background:'original'}};
  const controller=exteriorAmbience({renderer,scene,materials:[material,material],stage});
  controller.setProfile('dia');assert.deepEqual(material.color.toArray(),color);assert.equal(scene.background,null);
  controller.setProfile('entardecer');const sunset=material.color.toArray();controller.setProfile('entardecer');
  assert.deepEqual(material.color.toArray(),sunset);assert.notDeepEqual(sunset,color);
  assert.equal(material.roughness,.24);assert.equal(material.metalness,.1);assert.equal(material.clearcoat,.8);
  assert.equal(light.shadow.needsUpdate,false);assert.equal(light.shadow.autoUpdate,false);
  assert.throws(()=>controller.setProfile('amanhecer'));assert.equal(controller.getState().profile,'entardecer');
  controller.setProfile('dia');assert.deepEqual(material.color.toArray(),color);assert.deepEqual(light.color.toArray(),lightColor);
  assert.equal(renderer.toneMappingExposure,1.2);assert.equal(material.envMapIntensity,1);assert.equal(stage.style.background,'original');
  controller.dispose();controller.dispose();assert.equal(controller.setProfile('entardecer'),false);material.dispose();light.shadow.dispose();
});
test('query de ambiencia reconhece apenas os dois estados publicados',()=>{
  assert.equal(requestedAmbience('?luz=entardecer'),'entardecer');assert.equal(requestedAmbience('?luz=aleatoria'),'dia');
});
