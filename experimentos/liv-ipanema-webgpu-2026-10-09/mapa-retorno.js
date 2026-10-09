// Adapt only navigation; the regional data, renderer and preserved files stay intact.
const frame=document.getElementById('map'),destination=new URL('./maquete-liv-ipanema.html',location.href);
function redirectLink(anchor) {
  if(!anchor)return;
  const url=new URL(anchor.getAttribute('href')||'',frame.contentWindow.location.href);
  if(url.origin===location.origin&&url.pathname.endsWith('/maquete-liv-ipanema.html')) {
    anchor.href=destination.href;anchor.target='_top';
  }
}
frame.addEventListener('load',()=>{
  const doc=frame.contentDocument;
  if(!doc?.querySelector('#livMapaBar')){document.getElementById('failure').hidden=false;return;}
  for(const anchor of doc.querySelectorAll('a[href]'))redirectLink(anchor);
  doc.addEventListener('click',event=>redirectLink(event.target.closest?.('a[href]')),true);
  window.__livMapAdapter={ready:true,baselineURL:frame.src,returnURL:destination.href};
});
