import {transfers,showTransferStatus} from './transfers.js';
import {typology} from './tipologias.js';
const stage=document.getElementById('stage'),overlay=document.getElementById('loading');
const message=document.getElementById('loadingText'),status=document.getElementById('status');
const requested=new URLSearchParams(location.search).get('backend');
const backend=['webgpu','webgl'].includes(requested)?requested:'auto';
const finish=new URLSearchParams(location.search).get('acabamento')==='base'?'base':'referencia';
const state=window.__livViewer={ready:false,mode:'maquete',typology:'canto',interiorSnapshots:{},view:'perspectiva',floor:-1,frame:null,error:null,backend:null,pendingCleanup:0,cleanupTimeouts:0};
const storageKey=`liv-viewer-v1:${location.pathname}`;
try {
  const saved=JSON.parse(sessionStorage.getItem(storageKey));
  if(saved?.version===1&&['maquete','planta2d','planta3d','visita'].includes(saved.mode)&&
    Number.isInteger(saved.floor)&&saved.floor>=-1&&saved.floor<=16&&
    ['perspectiva','fachada','aerea','portaria','implantacao','varandas','livre'].includes(saved.view)) {
    state.mode=saved.mode;state.view=saved.view;state.floor=saved.floor;
    if(['canto','meio'].includes(saved.typology))state.typology=saved.typology;
    if(saved.interiorSnapshots&&typeof saved.interiorSnapshots==='object')state.interiorSnapshots=saved.interiorSnapshots;
    const snapshot=saved.exteriorSnapshot,cam=snapshot?.camera;
    if(snapshot&&cam&&[cam.position,cam.target].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))state.exteriorSnapshot=snapshot;
    else if(state.view==='livre')state.view='perspectiva';
  }
} catch(error) {state.storageError=String(error);}
let generation=0,frameKind=null,openedOnce=false;
showTransferStatus(document.getElementById('transferStatus'));
for(let floor=1;floor<=16;floor++) document.getElementById('floor').add(new Option(`${floor}º pavimento tipo`,String(floor)));
document.getElementById('floor').value=String(state.floor);
document.getElementById('typology').value=state.typology;

function update() {
  for(const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode));
  for(const button of document.querySelectorAll('[data-view]')) {
    button.disabled=!state.ready||state.mode!=='maquete';
    button.setAttribute('aria-pressed',String(button.dataset.view===state.view));
  }
  document.getElementById('floor').disabled=!state.ready||state.mode!=='maquete';
  document.getElementById('capture').disabled=!state.ready;
  document.getElementById('interiorNote').hidden=state.mode==='maquete';
  const selected=typology(state.typology);
  document.getElementById('interiorNote').textContent=`Planta de ${selected.label.toLowerCase()} · ${selected.area} de área publicada · interior ilustrativo, com medidas inferidas · sem vínculo com uma unidade específica.`;
  document.getElementById('hint').textContent=state.mode==='visita'?'Arraste para olhar · use o teclado ou o controle na tela para caminhar':
    state.mode==='planta2d'?`Planta comercial publicada · ${selected.label.toLowerCase()}, ${selected.area} incluindo varanda`:'Arraste para girar · use a roda ou dois dedos para aproximar';
}
function busy(text) {
  state.ready=false;state.error=null;overlay.hidden=false;message.textContent=text;
  state.loadingProgress=null;document.getElementById('downloadProgress').hidden=true;
  document.getElementById('retry').hidden=true;document.getElementById('fallback').hidden=true;update();
}
function showError(error) {
  state.ready=false;state.error=String(error);overlay.hidden=false;message.textContent=error.message||String(error);
  status.textContent='Visualizador indisponível';document.getElementById('retry').hidden=false;
  document.getElementById('fallback').hidden=false;update();
  document.getElementById('downloadProgress').hidden=true;
}
function release() {
  const frame=state.frame;
  if(frame) {
    state.frame=null;let disposal;
    try {
      const api=frame.contentWindow.__livProva;
      if(api?.getState&&!api.disposed){state.exteriorSnapshot=api.getState();state.view=state.exteriorSnapshot.view;}
      disposal=api?.dispose();
      const interior=frame.contentWindow.__livInterior;
      // A ready child may still be waiting for the host to restore its snapshot.
      // Only a prepared frame can replace the last valid camera/layout state.
      if(interior?.getState&&!interior.disposed&&frame.livPrepared)state.interiorSnapshots[interior.typology]=interior.getState();
      if(interior?.dispose)disposal=interior.dispose();
      const legacy=frame.contentWindow.__maq;
      if(legacy){
        const geometries=new Set(),materials=new Set(),textures=new Set();
        legacy.cena.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
        for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
        frame.contentWindow.__livLightmap?.texture?.dispose();
        legacy.cena.environment?.dispose();legacy.cena.traverse(o=>o.shadow?.dispose());
        for(const geometry of geometries)geometry.dispose();for(const texture of textures)texture.dispose();
        legacy.ren.dispose();legacy.ren.forceContextLoss();
      }
    } catch(error) {state.cleanupError=String(error);}
    if(disposal&&typeof disposal.then==='function') {
      // Keep the realm alive until pending init/render work has settled. Removing
      // it first can strand requestDevice's promise before resources are freed.
      // dispose stops rendering synchronously; the retired frame is never active.
      frame.hidden=true;frame.inert=true;frame.dataset.disposing='true';state.pendingCleanup++;
      let removed=false;
      const remove=()=>{
        if(removed)return;removed=true;clearTimeout(timer);state.pendingCleanup--;
        frame.src='about:blank';frame.remove();
      };
      // A genuinely stuck driver must not block the chosen view indefinitely.
      // Tearing down its browsing context is the final browser-owned fallback.
      const timer=setTimeout(()=>{state.cleanupTimeouts++;remove();},30000);
      Promise.resolve(disposal).catch(error=>{state.cleanupError=String(error);}).then(remove);
    } else {frame.src='about:blank';frame.remove();}
  }
  stage.querySelector('img')?.remove();frameKind=null;
}
async function until(test,token,{timeout=90000,progress=null,maximum=600000}={}) {
  const hardDeadline=performance.now()+maximum;
  let deadline=performance.now()+timeout,lastVersion=-1,lastMessage='';
  while(performance.now()<hardDeadline) {
    if(token!==generation) throw Error('Navegação substituída.');
    const current=progress?.();
    if(current&&current.version!==lastVersion){
      lastVersion=current.version;deadline=performance.now()+timeout;state.loadingProgress=current;
      const download=document.getElementById('downloadProgress');
      const ratio=current.total>0?Math.min(1,current.loaded/current.total):null;
      download.hidden=ratio===null;
      if(ratio!==null){download.max=current.total;download.value=current.loaded;}
      // Announce a phase or each ten percent, rather than every streamed chunk.
      const text=current.message+(ratio===null?'…':` · ${Math.floor(ratio*10)*10}%`);
      if(text!==lastMessage){message.textContent=text;lastMessage=text;}
    }
    const value=test();if(value)return value;
    if(performance.now()>=deadline)break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('O visualizador demorou para responder. Tente novamente.');
}
async function fallback2D(token) {
  release();const selected=typology(state.typology),image=new Image();image.alt=selected.imageAlt;
  image.src=selected.image;stage.prepend(image);
  await image.decode();if(token!==generation)return;
  frameKind='image';state.ready=true;state.error=null;state.mode='planta2d';overlay.hidden=true;
  status.textContent='Planta comercial de referência';update();
  openedOnce=true;void transfers.start();
}
async function setMode(mode) {
  if(!['maquete','planta2d','planta3d','visita'].includes(mode))throw Error('Modo inválido.');
  const token=++generation;state.mode=mode;
  busy(mode==='maquete'?'Abrindo a maquete…':'Abrindo a planta de referência…');
  try {
    const kind=mode==='maquete'?'exterior':mode==='planta2d'?'image':`interior:${state.typology}`;
    // Cancel the previous scene immediately, before waiting for the queue ack.
    if(frameKind!==kind)release();
    if(mode==='maquete'){
      // Initial screen starts without waiting for Service Worker registration.
      if(openedOnce||navigator.serviceWorker?.controller)await transfers.pause();
    } else await transfers.prioritize(mode==='planta2d'?'planta2d':'tour',mode==='planta2d'?
      [typology(state.typology).image]:['interiores/catalogo.json','interiores/shared/',`interiores/${state.typology}/`]);
    if(token!==generation)return;
    if(mode==='planta2d'){await fallback2D(token);return;}
    if(frameKind!==kind) {
      release();const frame=document.createElement('iframe');frame.title=kind==='exterior'?'Maquete do LIV Ipanema':'Planta e interior de referência do LIV Ipanema';
      frame.src=kind==='exterior'?`prova-rgbm.html?embed=1&backend=${backend}&acabamento=${finish}`:
        `interior.html?embed=1&backend=${backend}&tipologia=${state.typology}&modo=${mode}`;
      stage.prepend(frame);state.frame=frame;frameKind=kind;
    }
    const frame=state.frame;
    if(kind==='exterior') {
        const api=await until(()=>{
          const api=frame.contentWindow?.__livProva;if(api?.error)throw Error(api.error);
          return api?.ready&&api.setFloor?api:null;
        },token,{progress:()=>frame.contentWindow?.__livProva?.progress});
        if(!frame.livPrepared){
          if(state.exteriorSnapshot)api.restoreState({...state.exteriorSnapshot,floor:state.floor});
          else {api.setView(state.view);api.setFloor(state.floor);}
          frame.contentWindow.addEventListener('liv-renderer-error',event=>{
            if(state.frame===frame&&frameKind==='exterior'){
              // Keep the last camera/floor before the renderer releases resources.
              // A single retry must create a fresh frame instead of reusing its error.
              release();showError(Error(event.detail.error));
            }
          });
          frame.livPrepared=true;
        }
        state.backend=api.backend;
    } else {
      if(!frame.livPrepared){
        const api=await until(()=>{
          const api=frame.contentWindow?.__livInterior;
          if(api?.error)throw Error(api.error);
          return api?.ready?api:null;
        },token,{progress:()=>{
          const queue=transfers.getState(),active=queue.active;
          if(active?.group==='tour')return {version:`queue:${queue.progressVersion}`,phase:'download',
            message:'Baixando o interior selecionado',loaded:active.loaded,total:active.total};
          return frame.contentWindow?.__livInterior?.progress;
        }});
        const snapshot=state.interiorSnapshots[state.typology];
        if(snapshot){
          const current=api.getState();
          if(snapshot.unitSHA256===current.unitSHA256&&snapshot.sourceSHA256===current.sourceSHA256){
            try {api.restoreState(snapshot);}catch(error){state.snapshotError=String(error);delete state.interiorSnapshots[state.typology];}
          } else delete state.interiorSnapshots[state.typology];
        }
        frame.contentWindow.addEventListener('liv-interior-mode',event=>{
          if(state.frame===frame&&['planta3d','visita'].includes(event.detail.mode)){
            state.mode=event.detail.mode;update();
          }
        });
        frame.contentWindow.addEventListener('liv-renderer-error',event=>{
          if(state.frame===frame&&frameKind.startsWith('interior:')){
            release();showError(Error(event.detail.error));
          }
        });
        frame.livPrepared=true;
      }
      state.backend=frame.contentWindow.__livInterior.backend;
    }
    if(kind.startsWith('interior:')) {
      const win=state.frame.contentWindow;
      await win.__livInterior.setMode(mode);
      await until(()=>win.__livInterior.mode===mode,token);
    }
    if(token!==generation)return;
    state.ready=true;overlay.hidden=true;status.textContent=mode==='maquete'?'Maquete completa carregada':`Planta de referência de ${typology(state.typology).label.toLowerCase()}`;update();
    openedOnce=true;void transfers.start();
  } catch(error) {
    if(token!==generation)return;
    if(mode==='planta2d') {
      try {await fallback2D(token);return;}catch(fallbackError){error=fallbackError;}
    }
    if(token!==generation)return;
    release();showError(error);
  }
}
function setView(view) {
  const api=state.frame?.contentWindow?.__livProva;if(!state.ready||!api)return;
  api.setView(view);state.view=view;update();
}
function setFloor(floor) {
  state.frame?.contentWindow?.__livProva?.setFloor(Number(floor));state.floor=Number(floor);
  document.getElementById('floor').value=String(floor);
}
async function setTypology(id){
  typology(id);if(id===state.typology)return;
  state.typology=id;document.getElementById('typology').value=id;update();
  if(state.mode!=='maquete')await setMode(state.mode);
}
async function capture() {
  if(!state.ready)return;
  if(state.mode==='maquete')return state.frame.contentWindow.__livProva.capture();
  const canvas=document.createElement('canvas');let png;
  if(state.mode==='planta2d') {
    const source=stage.querySelector('img')||state.frame.contentWindow.document.querySelector('#p2d image');
    const image=new Image();image.src=source.tagName==='IMG'?source.src:source.getAttribute('href');await image.decode();
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);png=canvas.toDataURL('image/png');
  } else {
    png=await state.frame.contentWindow.__livInterior.capture();
  }
  const link=document.createElement('a');link.href=png;link.download=`liv-ipanema-${state.typology}-${state.mode}.png`;link.click();return png;
}
Object.assign(state,{setMode,setView,setFloor,setTypology,capture,getState:()=>({mode:state.mode,typology:state.typology,view:state.view,floor:state.floor,backend:state.backend}),dispose:release});
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>setMode(button.dataset.mode));
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>setView(button.dataset.view));
document.getElementById('floor').addEventListener('change',event=>setFloor(event.target.value));
document.getElementById('typology').addEventListener('change',event=>setTypology(event.target.value));
document.getElementById('capture').addEventListener('click',()=>capture().catch(error=>{status.textContent='Não foi possível capturar a imagem: '+error.message;}));
document.getElementById('retry').addEventListener('click',()=>setMode(state.mode));
document.getElementById('fallback').addEventListener('click',()=>{
  void setMode('planta2d');
});
document.querySelector('.map-link').addEventListener('click',event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();const destination=event.currentTarget.href,token=++generation;
  state.ready=false;release();busy('Abrindo o mapa…');
  transfers.prioritize('map').then(()=>{if(token===generation)location.assign(destination);});
});
window.addEventListener('pagehide',()=>{
  generation++;state.ready=false;release();
  try {sessionStorage.setItem(storageKey,JSON.stringify({version:1,mode:state.mode,typology:state.typology,interiorSnapshots:state.interiorSnapshots,view:state.view,floor:state.floor,exteriorSnapshot:state.exteriorSnapshot}));}
  catch(error) {state.storageError=String(error);}
});
window.addEventListener('pageshow',event=>{if(event.persisted)setMode(state.mode);});
setMode(state.mode);
