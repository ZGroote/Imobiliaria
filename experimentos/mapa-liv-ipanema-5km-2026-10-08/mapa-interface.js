/* Interface de exploração exclusiva do LIV: maquete completa e entorno. */
(function(root){
  'use strict';
  var css='\n'
    +'#panel,#houses,#hsheet,#usheet,#nearby,#psheet,#mobileNav,#mobileHint,#etapas,#isair,#hud,#livComparar,#livLocalizacao{display:none!important}\n'
    +'#livMapaBar{left:12px!important;right:auto!important;top:12px!important;bottom:auto!important;max-width:calc(100vw - 100px)!important;width:max-content;box-sizing:border-box;display:flex!important;align-items:center;gap:8px;padding:9px 12px!important;font:12px system-ui;line-height:1.3}\n'
    +'#livMapaBar strong{max-width:100%;white-space:normal;line-height:1.3}#livMapaBar a,#livMapaBar button{min-height:40px;box-sizing:border-box;display:flex;align-items:center;margin:0;padding:7px 10px;white-space:normal;text-align:center}\n'
    +'@media(max-width:680px){#livMapaBar{max-width:calc(100vw - 80px)!important;gap:4px;padding:8px!important}#livMapaBar strong{flex:1 1 100%;font-size:12px;margin:0}#livMapaBar a,#livMapaBar button{font-size:11px;min-height:44px;flex:1 1 80px;padding:5px 7px}#minimapa{top:var(--liv-header-bottom,110px)!important;bottom:auto!important}}\n';
  function style(){
    if(document.getElementById('livMapaInterfaceStyle'))return;
    var element=document.createElement('style');element.id='livMapaInterfaceStyle';element.textContent=css;
    (document.head||document.documentElement).appendChild(element);
  }
  function start(){
    style();
    var tries=0;
    function ready(){
      var I=root.__int;
      if(!I||!I.scene){if(++tries<300)setTimeout(ready,100);return;}
      ['panel','houses','hsheet','usheet','mobileNav','etapas','isair','hud'].forEach(function(id){
        var el=document.getElementById(id);if(el){el.hidden=true;el.inert=true;}
      });
      var compare=document.getElementById('livComparar');if(compare)compare.remove();
      var title=document.querySelector('#livMapaBar strong');if(title)title.textContent='LIV Ipanema · São Carlos';
      var focus=document.getElementById('livFocar');if(focus)focus.textContent='Centralizar';
      var nav=document.getElementById('livMapaBar');if(nav){nav.setAttribute('aria-label','LIV Ipanema e entorno de 5 km');nav.dataset.livInterface='complete';}
      var relief=document.getElementById('tRelief');
      // A fonte já inicia relevo em 1; o fallback usa seu handler real se uma
      // página montada anteriormente ainda iniciar plana.
      if(relief&&I.livTerrain&&I.livTerrain.amount()<.999)relief.click();
      if(I.enterInterior)I.enterInterior=function(){return false;};
      root.__livMapInterface={completeOnly:true,terrainAlwaysOn:true,inspectionEnabled:false,version:1};
      if(root.LivNearby)root.LivNearby.start();
    }
    ready();
  }
  root.LivMapInterface={start:start,css:css};
  if(typeof document!=='undefined')start();
})(globalThis);
