import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three/webgpu';
import {float,vec3} from 'three/tsl';
import {installInteriorLook} from '../interior-look.js';

const hash=bytes=>createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const buffer=value=>value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength);
function fixture(){
  const data=new Float32Array(2**3*4);
  for(let index=0;index<data.length;index+=4)data.set([index/32,.25,.75,1],index);
  const bytes=data.buffer,record={schema:'liv-color-look-log3d-v1',path:'look.bin',bytes:bytes.byteLength,sha256:hash(bytes),edge:2,
    domainMinEV:-16,domainMaxEV:8,lookupExposureEV:0,sourceDisplayDevice:'sRGB',sourceLook:'AgX - Medium Low Contrast',
    encoding:'little-endian float32 RGBA',axisOrder:'X=red, Y=green, Z=blue; red fastest',validationPassed:true};
  const functions=new Map(),renderer={toneMapping:THREE.AgXToneMapping,toneMappingExposure:1,outputColorSpace:THREE.SRGBColorSpace,
    library:{addToneMapping(fn,mode){functions.set(mode,fn);},getToneMappingFunction(mode){return functions.get(mode)||null;}}};
  const owned=new Set(),statuses=[],requests=[];
  return {record,bytes,renderer,owned,statuses,functions,requests,options:{renderer,base:'https://viewer.test/interior/',record,
    own:value=>{owned.add(value);return value;},onStatus:value=>statuses.push(value),
    fetchImpl:async url=>{requests.push(url);return {ok:true,arrayBuffer:async()=>bytes};}}};
}

test('look registra um único texture3D RGBA16F linear e mantém exposição e saída sRGB',async()=>{
  const f=fixture(),state=await installInteriorLook(f.options);
  assert.equal(state.status,'ready');assert.equal(f.renderer.toneMapping,THREE.CustomToneMapping);
  assert.equal(f.renderer.toneMappingExposure,1);assert.equal(f.renderer.outputColorSpace,THREE.SRGBColorSpace);
  assert.equal(f.owned.size,1);assert.equal(f.requests[0].searchParams.get('v'),f.record.sha256);
  const texture=[...f.owned][0];
  assert.ok(texture.isData3DTexture);assert.ok(texture.image.data instanceof Uint16Array);
  assert.equal(texture.type,THREE.HalfFloatType);assert.equal(texture.colorSpace,THREE.NoColorSpace);
  assert.equal(texture.minFilter,THREE.LinearFilter);assert.equal(texture.magFilter,THREE.LinearFilter);
  assert.equal(texture.wrapS,THREE.ClampToEdgeWrapping);assert.equal(texture.wrapT,THREE.ClampToEdgeWrapping);assert.equal(texture.wrapR,THREE.ClampToEdgeWrapping);
  assert.equal(texture.generateMipmaps,false);assert.equal(texture.flipY,false);
  const tone=f.functions.get(THREE.CustomToneMapping);
  assert.ok(tone(vec3(.18,.18,.18),float(1)).isNode);
  assert.equal(f.functions.size,1);assert.equal(f.statuses.at(-1).status,'ready');
  let disposals=0;texture.addEventListener('dispose',()=>disposals++);
  for(const resource of f.owned)resource.dispose();assert.equal(disposals,1);
});

test('contrato ausente preserva o AgX sem download ou recurso extra',async()=>{
  const f=fixture(),state=await installInteriorLook({...f.options,record:null});
  assert.equal(state.status,'default');assert.equal(f.renderer.toneMapping,THREE.AgXToneMapping);
  assert.equal(f.requests.length,0);assert.equal(f.owned.size,0);
});

test('metadados, tamanho, hash e dados inválidos geram fallback observável',async t=>{
  for(const kind of ['schema','edge','domain','path','length','hash','nan','alpha','http','registration'])await t.test(kind,async()=>{
    const f=fixture();
    if(kind==='schema')f.record.schema='unknown';
    if(kind==='edge')f.record.edge=1;
    if(kind==='domain')f.record.domainMaxEV=f.record.domainMinEV;
    if(kind==='path')f.record.path='../look.bin';
    if(kind==='length')f.options.fetchImpl=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});
    if(kind==='hash')f.record.sha256='0'.repeat(64);
    if(kind==='nan'||kind==='alpha'){
      new DataView(f.bytes).setFloat32(kind==='nan'?0:12,kind==='nan'?NaN:.5,true);f.record.sha256=hash(f.bytes);
    }
    if(kind==='http')f.options.fetchImpl=async()=>({ok:false,status:404});
    if(kind==='registration')f.renderer.library.getToneMappingFunction=()=>null;
    const state=await installInteriorLook(f.options);
    assert.equal(state.status,'fallback');assert.equal(f.renderer.toneMapping,THREE.AgXToneMapping);
    assert.ok(state.error);assert.equal(f.statuses.at(-1).error,state.error);
    assert.equal(f.owned.size,kind==='registration'?1:0);
    for(const resource of f.owned)resource.dispose();
  });
});

test('cancelamento interrompe o carregamento sem mascarar AbortError como fallback',async()=>{
  const f=fixture(),controller=new AbortController();controller.abort();
  await assert.rejects(installInteriorLook({...f.options,signal:controller.signal}),{name:'AbortError'});
  assert.equal(f.requests.length,0);assert.equal(f.owned.size,0);assert.equal(f.statuses.length,0);
});

test('LUT real validada preserva as 48 sentinelas Blender após quantização half float',async()=>{
  const directory=new URL('../interiores/melhorias/',import.meta.url),catalog=JSON.parse(readFileSync(new URL('catalogo.json',directory),'utf8'));
  const reference=JSON.parse(readFileSync(new URL('look-agx-medio-baixo.json',directory),'utf8'));
  const bytes=buffer(readFileSync(new URL(catalog.look.path,directory))),f=fixture();
  const state=await installInteriorLook({...f.options,record:catalog.look,fetchImpl:async()=>({ok:true,arrayBuffer:async()=>bytes})});
  assert.equal(state.status,'ready');assert.equal(state.sha256,reference.sha256);assert.equal(f.owned.size,1);
  const texture=[...f.owned][0],edge=reference.edge,data=texture.image.data;
  const display=value=>value<=.0031308?12.92*value:1.055*value**(1/2.4)-.055;
  const samples=reference.validation.gridSentinels.samples;assert.equal(samples.length,48);
  let maxDisplayError=0;
  for(const sample of samples){
    const xyz=sample.inputLinearRGB.map(value=>Math.round((Math.log2(value)-reference.domainMinEV)/(reference.domainMaxEV-reference.domainMinEV)*(edge-1)));
    const index=((xyz[2]*edge+xyz[1])*edge+xyz[0])*4;
    for(let channel=0;channel<3;channel++){
      const actual=display(THREE.DataUtils.fromHalfFloat(data[index+channel]));
      maxDisplayError=Math.max(maxDisplayError,Math.abs(actual-sample.referenceDisplaySRGB[channel]));
    }
  }
  assert.ok(maxDisplayError<.0005,`erro display RGBA16F: ${maxDisplayError}`);
  texture.dispose();
});
