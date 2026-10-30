import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {inspectMaterials,disposeAsset} from './materials.js';
import {parseLocalGLTF} from './asset-loader.js';

const state=window.__livMaterials={ready:false,busy:false,error:null,lastLoadError:null,backend:null,report:null,asset:null};
const canvas=document.querySelector('#canvas'),viewport=document.querySelector('#viewport');
const loading=document.querySelector('#loading'),status=document.querySelector('#status'),errorBox=document.querySelector('#error');
let renderer,scene,camera,controls,observer,environment,current=null,serial=0,pending=null,disposed=false;
let adoption=Promise.resolve();
let disposal=null;

function environmentSource(){
  const width=64,height=32,bytes=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const t=y/(height-1),band=Math.exp(-Math.pow((t-.48)/.12,2));
    const light=Math.exp(-Math.pow((x/width-.27)/.09,2))*Math.exp(-Math.pow((t-.28)/.2,2));
    const i=(y*width+x)*4;
    bytes[i]=Math.min(255,35+160*(1-t)+95*band+80*light);
    bytes[i+1]=Math.min(255,45+155*(1-t)+100*band+70*light);
    bytes[i+2]=Math.min(255,57+150*(1-t)+110*band+60*light);bytes[i+3]=255;
  }
  const texture=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);
  texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  return texture;
}

function setBusy(value,message='Abrindo o modelo…'){
  state.busy=value;loading.hidden=!value;loading.textContent=message;
  for(const id of ['fit','capture'])document.querySelector(`#${id}`).disabled=value||!current||!state.ready;
}

function showReport(report,origin){
  const rows=document.querySelector('#materials');rows.replaceChildren();
  for(const material of report.materials){
    const row=document.createElement('li'),title=document.createElement('strong'),details=document.createElement('span');
    title.textContent=material.name||'Material sem nome';
    const parts=[material.type];
    const props=material.properties;
    if(props.roughness!==undefined)parts.push(`rugosidade ${Number(props.roughness).toFixed(2)}`);
    if(props.metalness!==undefined)parts.push(`metal ${Number(props.metalness).toFixed(2)}`);
    if(props.clearcoat>0)parts.push(`verniz ${Number(props.clearcoat).toFixed(2)}`);
    if(props.transmission>0)parts.push(`transmissão ${Number(props.transmission).toFixed(2)}`);
    details.textContent=parts.join(' · ');row.append(title,details);rows.append(row);
  }
  status.textContent=`${origin.name} · ${report.meshCount} malhas · ${report.materials.length} materiais · ${report.textureCount} texturas`;
}

function fit(){
  if(!current)return;
  const box=new THREE.Box3().setFromObject(current.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(box.isEmpty()||![...size.toArray(),...center.toArray()].every(Number.isFinite))throw Error('O modelo não possui um volume visível válido.');
  const radius=Math.max(size.length()/2,.01),vertical=camera.fov*Math.PI/180;
  const horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect);
  const direction=new THREE.Vector3(1,.55,1.6).normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
  const up=new THREE.Vector3().crossVectors(direction,right).normalize();
  let distance=radius*.15;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const delta=new THREE.Vector3(x,y,z).sub(center);
    distance=Math.max(distance,delta.dot(direction)+Math.max(Math.abs(delta.dot(right))/Math.tan(horizontal/2),Math.abs(delta.dot(up))/Math.tan(vertical/2)));
  }
  distance*=1.1;
  camera.near=Math.max(radius/1000,.0001);camera.far=Math.max(radius*100,10);
  camera.position.copy(center).addScaledVector(direction,distance);
  controls.target.copy(center);controls.minDistance=radius*.15;controls.maxDistance=radius*20;
  controls.update();camera.updateProjectionMatrix();state.bounds={min:box.min.toArray(),max:box.max.toArray()};
  renderer.render(scene,camera);
}

async function capture(download=true){
  if(!state.ready||!current)throw Error('Nenhum modelo está pronto para fotografar.');
  renderer.render(scene,camera);const png=canvas.toDataURL('image/png');
  if(download){const link=document.createElement('a');link.href=png;link.download=`materiais-${state.backend}.png`;link.click();}
  return png;
}

async function replaceAsset(files,origin,{sample=false,signal}={}){
  const gltf=await parseLocalGLTF(files,renderer,{signal});
  if(disposed||signal?.aborted){disposeAsset(gltf);throw new DOMException('Abertura cancelada.','AbortError');}
  const report=inspectMaterials(gltf,renderer);
  if(!report.compatible){disposeAsset(gltf);throw Error(report.issues.map(issue=>typeof issue==='string'?issue:issue.message).join('; '));}
  const box=new THREE.Box3().setFromObject(gltf.scene);
  if(box.isEmpty()||![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite)){
    disposeAsset(gltf);throw Error('O arquivo não contém uma geometria visível válida.');
  }
  // Serial commits prevent concurrent compileAsync calls on a changing scene.
  // Keep the previous asset alive until the new one compiles successfully.
  const commit=adoption.catch(()=>{}).then(async()=>{
    if(disposed||signal?.aborted){disposeAsset(gltf);throw new DOMException('Abertura cancelada.','AbortError');}
    const previous=current;
    if(previous)scene.remove(previous.scene);
    current=gltf;scene.add(gltf.scene);
    try{
      // Fit the camera; imported geometry, transforms and materials keep identity.
      fit();await renderer.compileAsync(scene,camera);
      if(disposed||signal?.aborted)throw new DOMException('Abertura cancelada.','AbortError');
      renderer.render(scene,camera);
    }catch(error){
      scene.remove(gltf.scene);disposeAsset(gltf);current=disposed?null:previous;
      if(current){scene.add(current.scene);if(!state.error)fit();}else if(previous)disposeAsset(previous);
      throw error;
    }
    if(previous)disposeAsset(previous);
    state.asset=gltf;state.report=report;state.origin=origin;
    document.querySelector('#legend').hidden=!sample;showReport(report,origin);
  });
  adoption=commit;await commit;
}

async function runLoad(producer,origin,{sample=false}={}){
  if(disposed||!renderer)throw Error('A bancada foi encerrada.');
  if(state.error)throw Error('O contexto gráfico foi interrompido. Reabra a bancada.');
  pending?.abort();const token=++serial,controller=pending=new AbortController();
  state.lastLoadError=null;errorBox.hidden=true;setBusy(true);
  try{
    const files=await producer(controller.signal);
    if(controller.signal.aborted||token!==serial)return;
    await replaceAsset(files,origin,{sample,signal:controller.signal});
    if(token!==serial||disposed)return;
    state.ready=true;setBusy(false);
  }catch(error){
    if(token!==serial||disposed||error.name==='AbortError')return;
    state.lastLoadError=String(error);errorBox.textContent=error.message;errorBox.hidden=false;
    status.textContent=current?'O modelo anterior continua disponível.':'Não foi possível abrir o modelo.';
    setBusy(false);
  }
}

async function loadSample(){
  return runLoad(async signal=>{
    const manifestResponse=await fetch('assets-materiais/manifest.json',{cache:'no-cache',signal});
    if(!manifestResponse.ok)throw Error(`Manifesto da amostra: HTTP ${manifestResponse.status}.`);
    const manifest=await manifestResponse.json(),record=manifest.files?.['amostra.glb'];
    if(manifest.schema!=='liv-pbr-fixture-v1'||!record||!/^[a-f0-9]{64}$/.test(record.sha256))throw Error('Manifesto da amostra inválido.');
    const response=await fetch(`assets-materiais/amostra.glb?v=${record.sha256}`,{signal});
    if(!response.ok)throw Error(`Amostra: HTTP ${response.status}.`);
    const buffer=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(b=>b.toString(16).padStart(2,'0')).join('');
    if(buffer.byteLength!==record.bytes||hash!==record.sha256)throw Error('A amostra não corresponde ao manifesto.');
    return [new File([buffer],'amostra.glb',{type:'model/gltf-binary'})];
  },{name:'Amostra própria',architecturalReference:false},{sample:true});
}

async function loadFiles(files){
  const selected=Array.from(files),root=selected.find(file=>/\.(glb|gltf)$/i.test(file.name));
  return runLoad(async()=>selected,{name:root?.name||'Arquivo local',fileNames:selected.map(f=>f.webkitRelativePath||f.name),local:true});
}

function dispose(){
  if(disposal)return disposal;disposed=true;state.ready=false;serial++;pending?.abort();
  renderer?.setAnimationLoop(null);observer?.disconnect();controls?.dispose();
  // compileAsync can allocate after an await. Drain the serialized commit before
  // closing its ImageBitmaps and disposing the renderer it still uses.
  disposal=(async()=>{
    await adoption.catch(()=>{});
    if(current){scene.remove(current.scene);disposeAsset(current);current=null;}
    state.asset=null;environment?.dispose();scene?.clear();await renderer?.dispose();
  })();
  return disposal;
}

function fatal(error){
  if(disposed)return;state.ready=false;state.error=String(error);serial++;pending?.abort();renderer?.setAnimationLoop(null);
  errorBox.textContent=error.message||String(error);errorBox.hidden=false;setBusy(false);
  for(const button of document.querySelectorAll('button'))button.disabled=true;
  status.textContent='A bancada gráfica foi interrompida. Reabra a página para tentar novamente.';
}

async function start(){
  const requested=new URLSearchParams(location.search).get('backend')||'auto';
  if(!['auto','webgl','webgpu'].includes(requested))throw Error('Backend inválido.');
  let adapter=null;
  if(requested!=='webgl'&&navigator.gpu)try{adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});}catch{}
  if(requested==='webgpu'&&!adapter)throw Error('WebGPU indisponível. Abra a bancada com ?backend=webgl.');
  const options={canvas,antialias:true,powerPreference:'high-performance',forceWebGL:requested==='webgl'||!adapter};
  renderer=new THREE.WebGPURenderer(options);
  try{await renderer.init();}catch(error){
    if(requested!=='auto'||options.forceWebGL)throw error;
    await renderer.dispose();renderer=new THREE.WebGPURenderer({...options,forceWebGL:true});await renderer.init();
  }
  if(disposed){await renderer.dispose();return;}
  state.backend=renderer.backend.isWebGPUBackend?'webgpu':'webgl';
  if(requested==='webgpu'&&state.backend!=='webgpu')throw Error('O backend WebGPU não foi ativado.');
  renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  const onDeviceLost=renderer.onDeviceLost.bind(renderer);
  renderer.onDeviceLost=info=>{onDeviceLost(info);fatal(Error('O contexto gráfico foi interrompido.'));};
  renderer.onError=info=>fatal(Error(info.message||'Falha do renderizador.'));
  scene=new THREE.Scene();scene.background=new THREE.Color('#101922');environment=environmentSource();scene.environment=environment;
  scene.add(new THREE.HemisphereLight(0xeaf1ff,0x54685d,1.5));
  const sun=new THREE.DirectionalLight(0xffead3,2.5);sun.position.set(5,9,7);scene.add(sun);
  camera=new THREE.PerspectiveCamera(38,1,.01,1000);camera.position.set(9,7,15);
  controls=new OrbitControls(camera,canvas);controls.enableDamping=true;
  observer=new ResizeObserver(()=>{
    const {width,height}=viewport.getBoundingClientRect();renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
  });observer.observe(viewport);
  const rect=viewport.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
  Object.assign(state,{renderer,scene,camera,controls,loadFiles,loadSample,fit,capture,dispose});
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
  document.querySelector('#backend').textContent=`${state.backend==='webgpu'?'WebGPU':'WebGL2'} · Three.js r${THREE.REVISION}`;
  for(const id of ['sample','open','folder'])document.querySelector(`#${id}`).disabled=false;
  document.querySelector('#sample').onclick=()=>loadSample();
  document.querySelector('#open').onclick=()=>document.querySelector('#files').click();
  document.querySelector('#folder').onclick=()=>document.querySelector('#directory').click();
  for(const id of ['files','directory'])document.querySelector(`#${id}`).onchange=event=>{loadFiles(event.target.files);event.target.value='';};
  document.querySelector('#fit').onclick=fit;
  document.querySelector('#capture').onclick=()=>capture().catch(fatal);
  await loadSample();
}

window.addEventListener('pagehide',()=>dispose().catch(()=>{}));
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
start().catch(fatal);
