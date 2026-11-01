import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {createTimeIrradiance,createProbeIrradiance} from '../material-rgbm.js';
const builder=()=>{const nodes=new Map();return {getNodeFromHash:key=>nodes.get(key),setHashNode:(node,key)=>nodes.set(key,node)};};
const textures=node=>{const out=[];node.traverse(child=>{if(child.isTextureNode&&!out.includes(child))out.push(child);});return out;};
test('canais de atlas mantêm bindings distintos quando partem da mesma textura',()=>{
 const api=createTimeIrradiance({range:16,intensity:Math.PI}),shared=new THREE.DataTexture(new Uint8Array(4),1,1);
 api.set({a:shared,b:shared,night:shared,wa:1,wb:0,wn:0});
 const samples=textures(api.node),cache=builder(),bindings=samples.map(n=>n.getSharedNode(cache));
 assert.equal(samples.length,3);assert.equal(new Set(bindings).size,3,'Pesos que viram positivos depois precisam de samplers independentes.');
 const next=[0,1,2].map(()=>new THREE.DataTexture(new Uint8Array(4),1,1));
 api.set({a:next[0],b:next[1],night:next[2],wa:.2,wb:.3,wn:.5});
 assert.deepEqual(new Set(bindings.map(n=>n.value)),new Set(next));
});
test('faces da mesma sonda compartilham o canal sem misturar as três horas',()=>{
 const probes={width:2,height:2,depth:12,rows:2,roomMap:{data:btoa(String.fromCharCode(0)),width:1,height:1,x0:0,z0:0,cell:1},rooms:[{origin:[0,0,0],step:[1,1,1],n:[2,2,2],zOffset:0}]};
 const api=createProbeIrradiance(probes,1),shared=new THREE.Data3DTexture(new Uint16Array(4),1,1,1);
 api.set({a:shared,b:shared,night:shared,wa:1,wb:0,wn:0});
 const samples=textures(api.node).filter(n=>n.value.isData3DTexture),cache=builder(),bindings=samples.map(n=>n.getSharedNode(cache));
 assert.equal(samples.length,18);assert.equal(new Set(bindings).size,3,'Seis faces compartilham o mesmo canal; horas diferentes têm identidade própria.');
 const next=[0,1,2].map(()=>new THREE.Data3DTexture(new Uint16Array(4),1,1,1));
 api.set({a:next[0],b:next[1],night:next[2],wa:.2,wb:.3,wn:.5});
 assert.deepEqual(new Set(bindings.map(n=>n.value)),new Set(next));
});

test('atlas com bilinear decodificado do Laranjeiras conserva três bindings no WebGPU',async()=>{
 const {readFile}=await import('node:fs/promises');
 let source=await readFile(new URL('../../laranjeiras-2026-10-30/site/material-rgbm.js',import.meta.url),'utf8');
 for(const [name,path]of [['three/webgpu','../node_modules/three/build/three.webgpu.js'],['three/tsl','../node_modules/three/build/three.tsl.js'],['./classic-lighting.js','../classic-lighting.js']])source=source.replace("'"+name+"'",JSON.stringify(new URL(path,import.meta.url).href));
 const {createTimeIrradiance}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const api=createTimeIrradiance({range:16,intensity:Math.PI,width:2,height:2}),shared=new THREE.DataTexture(new Uint8Array(16),2,2);
 api.set({a:shared,b:shared,night:shared,wa:1,wb:0,wn:0});const samples=textures(api.node),cache=builder(),bindings=samples.map(n=>n.getSharedNode(cache));
 assert.equal(samples.length,12);assert.equal(new Set(bindings).size,3);const next=[0,1,2].map(()=>new THREE.DataTexture(new Uint8Array(16),2,2));api.set({a:next[0],b:next[1],night:next[2],wa:.2,wb:.3,wn:.5});assert.deepEqual(new Set(bindings.map(n=>n.value)),new Set(next));
});
