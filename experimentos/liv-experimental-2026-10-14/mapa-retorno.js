import {transfers,showTransferStatus} from './transfers.js';
import {requestedEdition,exteriorEdition} from './edicoes.js';
import {unitScope} from './catalogo-unidades.js';
import {requestedAmbience} from './ambiencia-perfis.js';
import {createFrameScheduler} from './frame-scheduler.js';
import dados from './dados/maquete.js';
// Adapt model edition, navigation and transfer priority; baseline files stay intact.
const frame=document.getElementById('map'),destination=new URL('./'+dados.pagina,location.href);
const embedded=new URLSearchParams(location.search).get('embed')==='1'&&window.parent!==window;
const geometry=requestedEdition(location.search);
if(geometry!=='base')destination.searchParams.set('geometria',geometry);
if(unitScope(location.search)==='edificio')destination.searchParams.set('unidades','edificio');
const stockId=new URLSearchParams(location.search).get('estoque');if(stockId)destination.searchParams.set('estoque',stockId);
if(new URLSearchParams(location.search).get('demonstracao')==='1')destination.searchParams.set('demonstracao','1');
if(requestedAmbience(location.search)==='entardecer')destination.searchParams.set('luz','entardecer');
const failure=document.getElementById('failure');
failure.querySelector(`a[href="${dados.pagina}"]`).href=destination.href;
failure.querySelector(`a[href="${dados.mapa.pagina}"]`).href=location.href;
const stopStatus=showTransferStatus(document.getElementById('transferStatus'));
let scheduler=null,disposed=false,active=new URLSearchParams(location.search).get('prewarm')!=='1';
const adapter=window.__livMapAdapter={ready:false,uiReady:false,returnURL:destination.href,
  setActive(value){
    if(disposed||typeof value!=='boolean')return false;active=value;adapter.active=value;
    frame.dataset.active=String(value);
    if(adapter.ready){
      scheduler?.setActive(value);
      if(value)frame.contentWindow.dispatchEvent(new frame.contentWindow.Event('resize'));
    }
    return true;
  },
  dispose(){
    if(disposed)return;disposed=true;adapter.ready=false;adapter.active=false;
    stopStatus();scheduler?.dispose();frame.remove();
  },
};
adapter.active=active;frame.dataset.active=String(active);
function redirectLink(anchor) {
  if(!anchor)return;
  const url=new URL(anchor.getAttribute('href')||'',frame.contentWindow.location.href);
  if(url.origin===location.origin&&url.pathname.endsWith('/'+dados.pagina)) {
    anchor.href=destination.href;anchor.target='_top';
  }
}
function returnToViewer(event){
  const anchor=event.target.closest?.('a[href]');if(!anchor||!embedded||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const url=new URL(anchor.href);
  if(url.origin===location.origin&&url.pathname===destination.pathname){
    event.preventDefault();window.parent.postMessage({type:'liv-map-return'},location.origin);
  }
}
failure.addEventListener('click',returnToViewer);
frame.addEventListener('load',async()=>{
  if(disposed||!frame.getAttribute('src'))return;
  const doc=frame.contentDocument;
  if(!doc?.querySelector('#livMapaBar')){adapter.error='O mapa não carregou.';failure.hidden=false;return;}
  // Once the map's own UI is present, keep its bottom controls unobstructed.
  stopStatus();document.getElementById('transferStatus').hidden=true;
  for(const anchor of doc.querySelectorAll('a[href]'))redirectLink(anchor);
  doc.addEventListener('click',event=>redirectLink(event.target.closest?.('a[href]')),true);
  doc.addEventListener('click',returnToViewer,true);
  adapter.uiReady=true;adapter.runtimeURL=frame.src;
  scheduler=createFrameScheduler(frame.contentWindow);
  try {
    const deadline=performance.now()+30000;
    while(!frame.contentWindow.__livModelReady) {
      if(disposed)return;
      if(performance.now()>deadline)throw Error('O modelo não iniciou.');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    const metadata=await frame.contentWindow.__livModelReady;
    if(disposed)return;
    if(metadata.edition!==geometry||!metadata.geometryVerified)throw Error('Modelo de outra edição.');
    // Upload the inserted model and compile its materials before parking the
    // legacy map's animation callbacks. Its camera and filters stay in memory.
    const {renderer,scene,camera}=frame.contentWindow.__int;
    renderer.compile(scene,camera);renderer.render(scene,camera);
    adapter.model=metadata;adapter.ready=true;adapter.setActive(active);
  } catch(error) {
    adapter.error=error.message;failure.hidden=false;
    scheduler?.setActive(false);
  }
});
const mapHTML=dados.mapa.runtime;
await transfers.prioritize('map',[mapHTML,exteriorEdition(geometry).glb,...(dados.mapa.preparar??[])]);
frame.src=mapHTML+(geometry==='base'?'':'#'+geometry);
