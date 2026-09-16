import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','1ad2a59:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2e6});
const original=app.slice(app.indexOf('const SONDA_OFF'),app.indexOf('/* ---- planta FORNECIDA'));
function fixture(modular,disabled=false) {
  const log=[]; let id=0, fail=false;
  const resource=kind=>({kind,id:++id,dispose(){log.push(['dispose',this.kind,this.id]);}});
  const base=resource('base');
  const materials=[{isMeshStandardMaterial:true,envMapIntensity:.55,envMap:base},
    {isMeshStandardMaterial:true,envMapIntensity:.3,envMap:base},{isMeshStandardMaterial:false,envMap:null}];
  const clone={isMeshStandardMaterial:true,envMapIntensity:.4,envMap:base};
  const renderer={toneMapping:4,toneMappingExposure:.8};
  const scene={add:()=>log.push(['add']),remove:()=>log.push(['remove'])};
  const THREE={HalfFloatType:1016,NoToneMapping:0,
    WebGLCubeRenderTarget:class {
      constructor(size,opts){log.push(['target',size,opts.type]);Object.assign(this,resource('cube'));this.texture=resource('cube-texture');}
    },
    CubeCamera:class {
      constructor(near,far){log.push(['camera',near,far]);this.position={set:(...p)=>log.push(['position',...p])};}
      update(r){log.push(['capture',r.toneMapping,r.toneMappingExposure]);if(fail)throw Error('capture failed');}
    },
    PMREMGenerator:class {
      fromCubemap(tex){log.push(['prefilter',tex.id]);return {texture:resource('filtered')};}
      dispose(){log.push(['dispose-generator']);}
    }};
  const INT={baseY:12,raiz:{traverse(fn){fn({material:materials[0]});fn({material:[clone,materials[2]]});fn({});}}};
  const ctx=vm.createContext({THREE,renderer,scene,INT,OLHO:1.62,QS:new URLSearchParams(disabled?'sonda=0':''),ambientePBR:base,MATS_INT:materials});
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/interior/environment-probe.js',import.meta.url),'utf8'),ctx);
    vm.runInContext('globalThis.api=InteriorEnvironmentProbe.create({THREE,renderer,scene,INT,OLHO,QS,ambientePBR,MATS_INT});',ctx);
  }else vm.runInContext(original+'\nglobalThis.api={sondaDeAmbiente,soltaSonda};',ctx);
  return {ctx,log,renderer,materials:[...materials,clone],fail:()=>{fail=true;},
    snapshot:()=>JSON.stringify([...materials,clone].map(m=>[m.envMap?.id,m.envMapIntensity,m._envBase,m.needsUpdate]))};
}
for(const disabled of [false,true]) test('environment capture, material gain and release match the original; disabled='+disabled,()=>{
  const a=fixture(false,disabled),b=fixture(true,disabled);
  for(const command of ['api.soltaSonda()','api.sondaDeAmbiente({comodos:[{cx:3,cz:7}]})',
    'api.sondaDeAmbiente({comodos:[{cx:8,cz:2}]})','api.soltaSonda()','api.soltaSonda()']) {
    for(const f of [a,b]) vm.runInContext(command,f.ctx);
    assert.deepEqual(b.log,a.log);assert.equal(b.snapshot(),a.snapshot());
    assert.deepEqual(b.renderer,{toneMapping:4,toneMappingExposure:.8});
    assert.equal(b.materials[2].envMap,null,'non-PBR lamp remains unaffected');
  }
});
test('capture failure restores renderer exposure and removes the cube camera',()=>{
  const a=fixture(false),b=fixture(true);
  for(const f of [a,b]) {f.fail();assert.throws(()=>vm.runInContext('api.sondaDeAmbiente({comodos:[{cx:0,cz:0}]})',f.ctx),/capture failed/);}
  assert.deepEqual(b.log,a.log);assert.deepEqual(b.log.at(-1),['remove']);
  assert.deepEqual(b.renderer,{toneMapping:4,toneMappingExposure:.8});
});
