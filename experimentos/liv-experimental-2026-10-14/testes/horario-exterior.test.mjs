import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../node_modules/three/build/three.webgpu.js';
import {exteriorTimeLighting} from '../horario-exterior.js';

test('o exterior usa um sol móvel, apaga fontes no dia e reverte sem criar recursos',()=>{
  const scene=new THREE.Scene(),sun=new THREE.DirectionalLight(),fill=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight();
  sun.castShadow=true;scene.add(sun,sun.target,fill,fill.target,sky);
  const fixtures=new THREE.MeshStandardMaterial(),wall=new THREE.MeshStandardMaterial();
  let invalidations=0;
  const renderer={toneMappingExposure:9},data={visibleBounds:{min:[-10,0,-8],max:[10,60,8]},materials:[{name:'MAT-luz-varanda'},{name:'Parede'}]};
  const clock=exteriorTimeLighting({scene,renderer,data,materials:[fixtures,wall],shadowLights:[sun],invalidateShadows:()=>invalidations++});
  const options={date:'2026-10-26'},count=scene.children.length;
  const morning=clock.setTime(8,options),position=sun.position.clone();
  assert.ok(sun.intensity>0);assert.equal(fill.intensity,0);assert.equal(fixtures.emissiveIntensity,0);
  clock.setTime(17,options);assert.ok(sun.position.distanceTo(position)>50);
  clock.setTime(0,options);assert.equal(sun.intensity,0);assert.equal(fixtures.emissiveIntensity,2.4);
  assert.equal(wall.emissiveIntensity,1,'Somente a luminária identificada recebe a mudança de emissão.');
  for(let minute=0;minute<=1440;minute++)clock.setTime(minute/60,options);
  assert.equal(scene.children.length,count);
  assert.deepEqual(clock.setTime(8,options),morning);assert.deepEqual(sun.position,position);
  assert.equal(fixtures.emissiveIntensity,0);assert.ok(invalidations>1440);
  fixtures.dispose();wall.dispose();sun.dispose();fill.dispose();
});
