import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {parseLocalGLTF} from '../../asset-loader.js';
import {disposeAsset} from '../../materials.js';
import {environmentTexture,precomputedEnvironment} from '../../ambiente.js';
import {entryDetailView} from '../../cameras.js';

const state=window.__livEntryStudy={ready:false,busy:true,disposed:false,error:null,backend:null,model:null};
const canvas=document.querySelector('#canvas'),stage=document.querySelector('#stage'),status=document.querySelector('#status'),loading=document.querySelector('#loading');
const buttons=[...document.querySelectorAll('[data-model]')],view=document.querySelector('#view');
const requests=new AbortController();
let renderer,scene,camera,controls,observer,environment,manifest,current=null;
let pending=Promise.resolve(),disposal;
const shadowLights=[];

const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
function busy(value,message='Preparando a entrada…'){
  state.busy=value;loading.hidden=!value;loading.textContent=message;
  for(const element of [...buttons,view,document.querySelector('#capture')])element.disabled=value||state.disposed;
}
function resize(){
  if(state.disposed||!renderer||!camera)return;
  const width=Math.max(1,stage.clientWidth),height=Math.max(1,stage.clientHeight),aspect=width/height;
  if(camera.isPerspectiveCamera)camera.aspect=aspect;
  else{const half=8.2/Math.min(1,aspect);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;}
  camera.updateProjectionMatrix();renderer.setSize(width,height,false);
}
function setView(name){
  if(state.disposed||!controls)return;
  if(!['entrada','aerea'].includes(name))throw Error('Vista inválida.');
  const target=new THREE.Vector3(-29.3,2.3,43.9),aspect=stage.clientWidth/Math.max(1,stage.clientHeight);
  if(name==='aerea'){
    camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,900);camera.position.copy(target).add(new THREE.Vector3(0,100,0));camera.up.set(0,0,-1);
  }else{
    const spec=entryDetailView(),direction=new THREE.Vector3().fromArray(spec.position).sub(new THREE.Vector3().fromArray(spec.target)).normalize();
    const distance=Math.max(22,8.6/(Math.tan(25*Math.PI/180)*Math.min(1,aspect)));
    camera=new THREE.PerspectiveCamera(50,aspect,.2,900);camera.position.copy(target).addScaledVector(direction,distance);
  }
  controls.object=camera;controls.target.copy(target);controls.update();camera.lookAt(target);resize();state.camera=camera;state.view=name;view.value=name;
  renderer.render(scene,camera);
}
async function capture(download=true){
  if(!state.ready||state.disposed)throw Error('A entrada ainda não está pronta.');
  renderer.render(scene,camera);const png=canvas.toDataURL('image/png');
  if(download){const link=document.createElement('a');link.href=png;link.download=`liv-entrada-${state.model}-${state.backend}.png`;link.click();}
  return png;
}
async function load(model){
  if(!['original','candidato'].includes(model))throw Error('Modelo inválido.');
  const record=manifest.files[model],url=new URL(record.path,import.meta.url);url.searchParams.set('v',record.sha256);
  const response=await fetch(url,{signal:requests.signal});if(!response.ok)throw Error(`Entrada: HTTP ${response.status}.`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.length!==record.bytes||await sha(bytes)!==record.sha256)throw Error('O GLB da entrada não corresponde à edição conferida.');
  const asset=await parseLocalGLTF([new File([bytes],'entrada.glb')],renderer,{signal:requests.signal});
  if(state.disposed){disposeAsset(asset);return;}
  const previous=current;
  if(previous)scene.remove(previous.scene);scene.add(asset.scene);
  asset.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  for(const light of shadowLights)light.shadow.needsUpdate=true;
  try{
    await renderer.compileAsync(scene,camera);
    if(state.disposed){scene.remove(asset.scene);disposeAsset(asset);return;}
    renderer.render(scene,camera);
  }catch(error){
    scene.remove(asset.scene);disposeAsset(asset);if(previous&&!state.disposed)scene.add(previous.scene);throw error;
  }
  if(previous){state.lastDispose=disposeAsset(previous);state.disposalCount=(state.disposalCount||0)+1;}
  current=asset;state.asset=asset;state.model=model;state.loadedSHA256=record.sha256;state.materialReport=asset.localImport.materialReport;
  state.error=null;state.ready=true;
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.model===model));
  status.textContent=`${model==='candidato'?'Entrada revisada':'Entrada anterior'} carregada. Arraste para girar.`;
}
async function show(model){
  if(state.disposed||state.busy)return false;
  busy(true);state.ready=false;
  pending=load(model).catch(error=>{if(!state.disposed){state.error=String(error);state.ready=!!current;status.textContent=String(error.message||error);}throw error;})
    .finally(()=>{if(!state.disposed)busy(false);});
  await pending;return true;
}
function dispose(){
  if(disposal)return disposal;
  state.disposed=true;state.ready=false;requests.abort();renderer?.setAnimationLoop(null);observer?.disconnect();controls?.dispose();
  disposal=pending.catch(()=>{}).then(async()=>{
    if(current){state.finalDispose=disposeAsset(current);scene.remove(current.scene);current=null;}
    environment?.dispose();scene?.traverse(o=>o.shadow?.dispose());scene?.clear();await renderer?.dispose();
  });return disposal;
}
Object.assign(state,{show,setView,capture,dispose});
async function start(){
  const backend=new URLSearchParams(location.search).get('backend')||'auto';
  if(!['auto','webgpu','webgl'].includes(backend))throw Error('Backend inválido.');
  renderer=new THREE.WebGPURenderer({canvas,alpha:true,antialias:true,forceWebGL:backend==='webgl',powerPreference:'high-performance'});
  state.renderer=renderer;await renderer.init();if(state.disposed)return;
  state.backend=renderer.backend.isWebGPUBackend?'webgpu':'webgl';
  if(backend==='webgpu'&&state.backend!=='webgpu')throw Error('WebGPU nativo indisponível.');
  renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  const response=await fetch(new URL('manifest.json',import.meta.url),{cache:'no-cache',signal:requests.signal});
  if(!response.ok)throw Error('Manifesto da entrada indisponível.');manifest=await response.json();
  if(manifest.schema!=='liv-entry-preview-v1')throw Error('Manifesto da entrada incompatível.');state.manifest=manifest;
  renderer.toneMappingExposure=manifest.exposure;scene=new THREE.Scene();state.scene=scene;
  try{environment=await precomputedEnvironment(requests.signal);}
  catch(error){if(state.disposed)return;environment=environmentTexture();state.environmentFallbackError=String(error);}
  if(state.disposed)return;scene.environment=environment;
  for(const spec of manifest.lights){
    const color=new THREE.Color().fromArray(spec.color);
    const light=spec.type==='DirectionalLight'?new THREE.DirectionalLight(color,spec.intensity):new THREE.HemisphereLight(color,new THREE.Color().fromArray(spec.groundColor),spec.intensity);
    light.position.fromArray(spec.position);light.castShadow=!!spec.castShadow;
    if(spec.target){light.target.position.fromArray(spec.target);scene.add(light.target);}
    if(spec.shadow){light.shadow.mapSize.fromArray(spec.shadow.mapSize);light.shadow.bias=spec.shadow.bias;light.shadow.normalBias=spec.shadow.normalBias;Object.assign(light.shadow.camera,spec.shadow.camera);light.shadow.camera.updateProjectionMatrix();}
    if(light.castShadow){light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;shadowLights.push(light);}
    scene.add(light);
  }
  camera=new THREE.PerspectiveCamera();controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.enablePan=true;
  state.controls=controls;observer=new ResizeObserver(resize);observer.observe(stage);setView('entrada');
  await load('candidato');if(state.disposed)return;
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});busy(false);
}
for(const button of buttons)button.addEventListener('click',()=>show(button.dataset.model).catch(()=>{}));
view.addEventListener('change',()=>setView(view.value));document.querySelector('#capture').addEventListener('click',()=>capture().catch(error=>status.textContent=error.message));
window.addEventListener('pagehide',dispose,{once:true});
pending=start();
pending.catch(error=>{if(!state.disposed){state.error=String(error);busy(false);status.textContent=error.message;loading.hidden=false;loading.textContent=error.message;}dispose();});
