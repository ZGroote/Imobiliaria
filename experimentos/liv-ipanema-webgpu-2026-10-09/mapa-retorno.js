import {transfers,showTransferStatus} from './transfers.js';
import {requestedEdition,exteriorEdition} from './edicoes.js';
import {unitScope} from './catalogo-unidades.js';
import {requestedAmbience} from './ambiencia-perfis.js';
// Adapt model edition, navigation and transfer priority; baseline files stay intact.
const frame=document.getElementById('map'),destination=new URL('./maquete-liv-ipanema.html',location.href);
const embedded=new URLSearchParams(location.search).get('embed')==='1'&&window.parent!==window;
const geometry=requestedEdition(location.search);
if(geometry!=='base')destination.searchParams.set('geometria',geometry);
if(unitScope(location.search)==='edificio')destination.searchParams.set('unidades','edificio');
const stockId=new URLSearchParams(location.search).get('estoque');if(stockId)destination.searchParams.set('estoque',stockId);
if(new URLSearchParams(location.search).get('demonstracao')==='1')destination.searchParams.set('demonstracao','1');
if(requestedAmbience(location.search)==='entardecer')destination.searchParams.set('luz','entardecer');
const failure=document.getElementById('failure');
failure.querySelector('a[href="maquete-liv-ipanema.html"]').href=destination.href;
failure.querySelector('a[href="mapa-liv-ipanema-5km.html"]').href=location.href;
const stopStatus=showTransferStatus(document.getElementById('transferStatus'));
function redirectLink(anchor) {
  if(!anchor)return;
  const url=new URL(anchor.getAttribute('href')||'',frame.contentWindow.location.href);
  if(url.origin===location.origin&&url.pathname.endsWith('/maquete-liv-ipanema.html')) {
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
  if(!frame.getAttribute('src'))return;
  const doc=frame.contentDocument;
  if(!doc?.querySelector('#livMapaBar')){document.getElementById('failure').hidden=false;return;}
  // Once the map's own UI is present, keep its bottom controls unobstructed.
  stopStatus();document.getElementById('transferStatus').hidden=true;
  for(const anchor of doc.querySelectorAll('a[href]'))redirectLink(anchor);
  doc.addEventListener('click',event=>redirectLink(event.target.closest?.('a[href]')),true);
  doc.addEventListener('click',returnToViewer,true);
  const adapter=window.__livMapAdapter={ready:false,uiReady:true,runtimeURL:frame.src,returnURL:destination.href};
  try {
    const deadline=performance.now()+30000;
    while(!frame.contentWindow.__livModelReady) {
      if(performance.now()>deadline)throw Error('O modelo não iniciou.');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    const metadata=await frame.contentWindow.__livModelReady;
    if(metadata.edition!==geometry||!metadata.geometryVerified)throw Error('Modelo de outra edição.');
    adapter.model=metadata;adapter.ready=true;
  } catch(error) {
    adapter.error=error.message;failure.hidden=false;
  }
});
const mapHTML='mapa-runtime/mapa-liv-ipanema-5km.html';
await transfers.prioritize('map',[mapHTML,exteriorEdition(geometry).glb,'site-baseline/quintais/']);
frame.src=mapHTML+(geometry==='base'?'':'#'+geometry);
