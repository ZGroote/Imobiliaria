const STORAGE_KEY='liv-orientacao';

export function installOrientationControls(window) {
  const {document}=window;
  const controls=document.getElementById('orientationControls');
  if(!controls)return;
  const hint=document.getElementById('orientationHint');
  const landscape=document.getElementById('orientationLandscape');
  const portrait=document.getElementById('orientationPortrait');
  const mobile=window.matchMedia('(any-pointer: coarse), (max-width: 760px)');
  const horizontal=window.matchMedia('(orientation: landscape)');
  let preferred='horizontal',pending=false,ownedFullscreen=false,locked=false,attempted=false,cancelled=false;
  try {if(window.localStorage.getItem(STORAGE_KEY)==='vertical')preferred='vertical';}catch {}

  function update() {
    controls.hidden=!mobile.matches;
    landscape.setAttribute('aria-pressed',String(preferred==='horizontal'));
    portrait.setAttribute('aria-pressed',String(preferred==='vertical'));
    landscape.disabled=portrait.disabled=pending;
    if(pending){hint.textContent='Ajustando a tela…';return;}
    const matches=horizontal.matches===(preferred==='horizontal');
    hint.textContent=matches?'Escolha como explorar.':preferred==='vertical'?'Gire o celular para a vertical.':
      attempted?'Gire o celular para a horizontal.':'Mais espaço: toque em Horizontal.';
  }

  function unlock() {
    if(!locked)return;
    locked=false;
    try {window.screen.orientation.unlock();}catch {}
  }

  async function leaveFullscreen() {
    if(!ownedFullscreen)return;
    ownedFullscreen=false;
    if(document.fullscreenElement)try {await document.exitFullscreen();}catch {}
  }

  async function choose(value) {
    if(pending)return;
    preferred=value;attempted=true;pending=true;cancelled=false;update();
    try {window.localStorage.setItem(STORAGE_KEY,value);}catch {}
    try {
      if(value==='vertical'){
        unlock();await leaveFullscreen();
      }else{
        const orientation=window.screen?.orientation;
        if(typeof orientation?.lock==='function'){
          if(!document.fullscreenElement){
            // Browsers require a user gesture and usually fullscreen to lock orientation.
            await document.documentElement.requestFullscreen();ownedFullscreen=true;
          }
          if(cancelled){await leaveFullscreen();return;}
          await orientation.lock('landscape');locked=true;
          if(cancelled||!document.fullscreenElement){unlock();await leaveFullscreen();}
        }
      }
    }catch {
      unlock();await leaveFullscreen();
    }finally {pending=false;update();}
  }

  landscape.addEventListener('click',()=>choose('horizontal'));
  portrait.addEventListener('click',()=>choose('vertical'));
  mobile.addEventListener('change',update);
  horizontal.addEventListener('change',update);
  document.addEventListener('fullscreenchange',()=>{
    if(!document.fullscreenElement){cancelled=true;ownedFullscreen=false;unlock();update();}
  });
  window.addEventListener('pagehide',()=>{cancelled=true;unlock();void leaveFullscreen();});
  update();
}

if(typeof window!=='undefined')installOrientationControls(window);
