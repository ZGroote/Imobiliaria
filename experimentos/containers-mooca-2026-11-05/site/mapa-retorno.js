import {transfers,showTransferStatus} from './transfers.js';
import {requestedEdition} from './edicoes.js';
import {unitScope} from './catalogo-unidades.js';
import {requestedAmbience} from './ambiencia-perfis.js';
import {normalizeHour,solarState} from './horario-solar.js';
// Adapt model edition, navigation and transfer priority; baseline files stay intact.
const frame=document.getElementById('map'),destination=new URL('./maquete-containers.html',location.href);
const focusId=document.documentElement.dataset.mapProperty||'containers-mooca';
if(focusId!=='containers-mooca')throw Error('Empreendimento indisponível.');
const focusName='Containers da Mooca';
document.title=focusName+' — mapa do entorno';frame.title='Mapa do entorno de '+focusName;
const embedded=new URLSearchParams(location.search).get('embed')==='1'&&window.parent!==window;
const geometry=requestedEdition(location.search);
if(geometry!=='base')destination.searchParams.set('geometria',geometry);
if(unitScope(location.search)==='edificio')destination.searchParams.set('unidades','edificio');
const stockId=new URLSearchParams(location.search).get('estoque');if(stockId)destination.searchParams.set('estoque',stockId);
if(new URLSearchParams(location.search).get('demonstracao')==='1')destination.searchParams.set('demonstracao','1');
if(requestedAmbience(location.search)==='entardecer')destination.searchParams.set('luz','entardecer');
const timeQuery=new URLSearchParams(location.search);
if(timeQuery.has('hora'))destination.searchParams.set('hora',String(normalizeHour(timeQuery.get('hora'))));
if(timeQuery.has('data')){try{destination.searchParams.set('data',solarState(12,{date:timeQuery.get('data')}).date);}catch{}}
const failure=document.getElementById('failure');
failure.querySelector('a[data-map-return],a[href="maquete-liv-ipanema.html"],a[href="maquete-laranjeiras.html"]').href=destination.href;
failure.querySelector('a[href="mapa-liv-ipanema-5km.html"]').href=location.href;
const stopStatus=showTransferStatus(document.getElementById('transferStatus'));
let disposed=false,active=new URLSearchParams(location.search).get('prewarm')!=='1';
const adapter=window.__livMapAdapter={ready:false,uiReady:false,returnURL:destination.href,
  setActive(value){
    if(disposed||typeof value!=='boolean')return false;active=value;adapter.active=value;
    frame.dataset.active=String(value);
    if(adapter.ready){
      frame.contentWindow.__livMap2D?.setActive(value);
      if(value)frame.contentWindow.dispatchEvent(new frame.contentWindow.Event('resize'));
    }
    return true;
  },
  dispose(){
    if(disposed)return;disposed=true;adapter.ready=false;adapter.active=false;
    stopStatus();frame.contentWindow.__livMap2D?.dispose();frame.remove();
  },
};
adapter.active=active;frame.dataset.active=String(active);
function redirectLink(anchor) {
  if(!anchor)return;
  const url=new URL(anchor.getAttribute('href')||'',frame.contentWindow.location.href);
  if(anchor.id==='return'||anchor.dataset.mapReturn==='true'||(url.origin===location.origin&&url.pathname===destination.pathname)) {
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
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='liv-map-solar')return;
  if(typeof event.data.hour!=='number'||!Number.isFinite(event.data.hour))return;
  try{
    const solar=solarState(event.data.hour,{date:event.data.date});
    destination.searchParams.set('hora',String(solar.hour));destination.searchParams.set('data',solar.date);adapter.returnURL=destination.href;
    for(const anchor of frame.contentDocument.querySelectorAll('a[href]'))redirectLink(anchor);
    if(embedded)window.parent.postMessage({type:'liv-map-solar',hour:solar.hour,date:solar.date},location.origin);
  }catch{}
});
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
  try {
    const deadline=performance.now()+30000;
    while(!frame.contentWindow.__livMap2D?.ready) {
      if(disposed)return;
      if(frame.contentWindow.__livMap2DError)throw Error(frame.contentWindow.__livMap2DError);
      if(performance.now()>deadline)throw Error('O mapa não iniciou.');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(disposed)return;
    adapter.model=frame.contentWindow.__livMap2D.building?.metadata;adapter.ready=true;adapter.setActive(active);
  } catch(error) {
    adapter.error=error.message;failure.hidden=false;
    frame.contentWindow.__livMap2D?.setActive(false);
  }
});
const mapHTML='mapa-runtime/mapa-2d.html';
const mapPrefix=document.documentElement.dataset.mapAssets||'';
void transfers.prioritize('map',[mapPrefix+mapHTML,mapPrefix+'mapa-pois.json',mapPrefix+'mapa-edificio.bundle.js',mapPrefix+'vendor/maplibre/']);
const mapQuery=new URLSearchParams({geometria:geometry,empreendimento:focusId});for(const key of ['hora','data'])if(destination.searchParams.has(key))mapQuery.set(key,destination.searchParams.get(key));const runtime=new URL(document.documentElement.dataset.mapRuntime||mapHTML,location.href);runtime.search=mapQuery.toString();frame.src=runtime.href;
