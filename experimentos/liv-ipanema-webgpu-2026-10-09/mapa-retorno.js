import {transfers,showTransferStatus} from './transfers.js';
// Adapt navigation and transfer priority; preserved map files stay intact.
const frame=document.getElementById('map'),destination=new URL('./maquete-liv-ipanema.html',location.href);
const stopStatus=showTransferStatus(document.getElementById('transferStatus'));
function redirectLink(anchor) {
  if(!anchor)return;
  const url=new URL(anchor.getAttribute('href')||'',frame.contentWindow.location.href);
  if(url.origin===location.origin&&url.pathname.endsWith('/maquete-liv-ipanema.html')) {
    anchor.href=destination.href;anchor.target='_top';
  }
}
frame.addEventListener('load',()=>{
  if(!frame.getAttribute('src'))return;
  const doc=frame.contentDocument;
  if(!doc?.querySelector('#livMapaBar')){document.getElementById('failure').hidden=false;return;}
  // Once the map's own UI is present, keep its bottom controls unobstructed.
  stopStatus();document.getElementById('transferStatus').hidden=true;
  for(const anchor of doc.querySelectorAll('a[href]'))redirectLink(anchor);
  doc.addEventListener('click',event=>redirectLink(event.target.closest?.('a[href]')),true);
  window.__livMapAdapter={ready:true,baselineURL:frame.src,returnURL:destination.href};
});
await transfers.prioritize('map');
frame.src='site-baseline/mapa-liv-ipanema-5km.html';
