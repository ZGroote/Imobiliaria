import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePreparedScene} from '../prepared-scene.js';
import {decodePreparedHDR} from '../prepared-hdr.js';
import {geometryFromSpec} from '../interior-geometry.js';
import {createNavigation,navigationKey} from '../interior-navigation.js';
function fixture(change=()=>{}){
 const positions=new Float32Array([0,0,0,1,0,0,0,0,1]),header={schema:'liv-prepared-interior-v1',sourceSHA256:'source',compactSHA256:'compact',scene:{geometries:{g:{prepared:true,position:{offset:0,length:9,type:'f32'},groups:[],boundingSphere:{center:[.5,0,.5],radius:Math.SQRT1_2}}},textures:{},preparedBake:{objects:[]}}};
 change(header);const json=Buffer.from(JSON.stringify(header)),base=(12+json.length+3)&~3,out=Buffer.alloc(base+positions.byteLength);out.write('LIVBUF01');out.writeUInt32LE(json.length,8);json.copy(out,12);Buffer.from(positions.buffer).copy(out,base);return new Uint8Array(out);
}
const identity={sourceSHA:'source',compactSHA:'compact'};
test('cena preparada usa as posições finais sem cópia nem nova correção de normais',()=>{
 const bytes=fixture(),scene=decodePreparedScene(bytes,identity),g=geometryFromSpec(scene.geometries.g);
 assert.equal(g.attributes.position.array.buffer,bytes.buffer);assert.deepEqual([...g.attributes.position.array],[0,0,0,1,0,0,0,0,1]);assert.equal(g.boundingSphere.radius,Math.SQRT1_2);g.dispose();
});
test('cena preparada rejeita revisão, cabeçalho, tipo, alinhamento e extensão de buffer inválidos',()=>{
 assert.throws(()=>decodePreparedScene(fixture(),{...identity,sourceSHA:'old'}));
 for(const change of [h=>h.schema='old',h=>h.scene.geometries.g.position.offset=-1,h=>h.scene.geometries.g.position.offset=1,h=>h.scene.geometries.g.position.length=100,h=>h.scene.geometries.g.position.type='f64'])assert.throws(()=>decodePreparedScene(fixture(change),identity));
 assert.throws(()=>decodePreparedScene(new Uint8Array(10),identity));const bytes=fixture();new DataView(bytes.buffer,bytes.byteOffset).setUint32(8,0xffffffff,true);assert.throws(()=>decodePreparedScene(bytes,identity));
});
test('HDR preparado conserva exatamente os bits half-float e rejeita dimensões incompatíveis',()=>{
 const b=new Uint8Array(24),v=new DataView(b.buffer);b.set(new TextEncoder().encode('LIVHDR01'));v.setUint32(8,1,true);v.setUint32(12,1,true);const pixels=new Uint16Array(b.buffer,16);pixels.set([1,15360,31743,0]);
 const decoded=decodePreparedHDR(b);assert.deepEqual([...decoded.data],[1,15360,31743,0]);assert.equal(decoded.data.buffer,b.buffer);assert.throws(()=>decodePreparedHDR(b.subarray(0,22)));v.setUint32(8,0,true);assert.throws(()=>decodePreparedHDR(b));
});
test('rotas preparadas preservam o resultado e são invalidadas quando a colisão muda',()=>{
 const layout={rooms:[{id:'sala',name:'Sala',poly:[[0,0],[2,0],[2,2],[0,2]],cx:1,cz:1}],walls:[],joinery:[],bounds:{x0:0,x1:2,z0:0,z1:2}};
 const original=createNavigation(layout,()=>[],{step:.2}),entry=original.entry(),routes=original.routes(entry),prepared={key:navigationKey(layout,[],.3,.2),entry,routes};
 const fast=createNavigation(layout,()=>[],{step:.2,prepared});assert.deepEqual(fast.entry(),entry);assert.deepEqual(fast.routes(entry),routes);const copy=fast.routes(entry);copy[0].reachable=false;assert.equal(fast.routes(entry)[0].reachable,true);
 layout.joinery.push({folha:{x:1,z:0,dx:0,dz:1,larg:2}});fast.invalidate();const newEntry=fast.entry();assert.notDeepEqual(newEntry,entry);assert.ok(fast.free(...newEntry));
 const stale=createNavigation(layout,()=>[],{step:.2,prepared});assert.deepEqual(stale.entry(),newEntry);
});
import {classicAtlas,classicProbes} from '../classic-lighting.js';
import * as THREE from 'three/webgpu';
test('luz temporal usa um binding por atlas e copia canais sem alterar os texels',()=>{
 const api=classicAtlas({width:2,height:1,range:16,intensity:1}),textures=[0,1,2].map(i=>new THREE.DataTexture(Uint8Array.from({length:8},(_,k)=>i*50+k),2,1));
 api.set({a:textures[0],b:textures[1],night:textures[2],wa:1,wb:0,wn:0});const packed=api.node.uniforms.livAtlas.value,version=packed.version;
 assert.deepEqual([...packed.image.data],[...textures[0].image.data,...textures[1].image.data,...textures[2].image.data]);assert.equal(Object.values(api.node.uniforms).filter(u=>u.value.isTexture).length,1);
 api.set({a:textures[0],b:textures[1],night:textures[2],wa:.2,wb:.3,wn:.5});assert.equal(packed.version,version,'Trocar só pesos não reenvia a imagem.');assert.deepEqual(api.node.uniforms.livWeights.value.toArray(),[.2,.3,.5]);api.resources.forEach(x=>x.dispose());
});
test('sondas empacotadas em X preservam as seis faces e não multiplicam a profundidade',()=>{
 const probes={width:2,height:2,depth:6,rows:1,roomMap:{data:btoa(String.fromCharCode(0)),width:1,height:1,x0:0,z0:0,cell:1},rooms:[{origin:[0,0,0],step:[1,1,1],n:[2,2,1],zOffset:0}]},api=classicProbes(probes,1),textures=[0,1,2].map(c=>new THREE.Data3DTexture(Uint16Array.from({length:96},(_,i)=>c*1000+i),2,2,6));
 api.set({a:textures[0],b:textures[1],night:textures[2],wa:1,wb:0,wn:0});const packed=api.node.uniforms.livVolume.value;assert.equal(packed.image.width,6);assert.equal(packed.image.depth,6);
 for(let row=0;row<12;row++)for(let channel=0;channel<3;channel++)assert.deepEqual(packed.image.data.slice((row*3+channel)*8,(row*3+channel+1)*8),textures[channel].image.data.slice(row*8,(row+1)*8));
 assert.equal(Object.values(api.node.uniforms).filter(u=>u.value.isTexture).length,2);assert.ok(!api.node.shader.includes('sampler3D a,'));api.resources.forEach(x=>x.dispose());api.rooms.dispose();
});

test('atlas guarda só as camadas distintas e troca armazenamento sem perder a mistura',()=>{
 const api=classicAtlas({width:2,height:1,range:16,intensity:1}),a=new THREE.DataTexture(new Uint8Array(8).fill(17),2,1),b=new THREE.DataTexture(new Uint8Array(8).fill(99),2,1);
 api.set({a,b:a,night:a,wa:1,wb:0,wn:0});const single=api.node.uniforms.livAtlas.value;let disposed=0;single.addEventListener('dispose',()=>disposed++);
 assert.equal(single.image.depth,1);assert.equal(single.image.data.length,8);assert.deepEqual(api.node.uniforms.livLayers.value.toArray(),[0,0,0]);
 api.set({a,b,night:a,wa:.4,wb:.3,wn:.3});const pair=api.node.uniforms.livAtlas.value;assert.equal(disposed,1);assert.equal(pair.image.depth,2);assert.deepEqual([...pair.image.data],[...a.image.data,...b.image.data]);assert.deepEqual(api.node.uniforms.livLayers.value.toArray(),[0,1,0]);
 api.set({a:b,b,night:b,wa:0,wb:0,wn:1});assert.equal(api.node.uniforms.livAtlas.value.image.depth,1);assert.deepEqual([...api.node.uniforms.livAtlas.value.image.data],[...b.image.data]);api.resources.forEach(x=>x.dispose());
});
