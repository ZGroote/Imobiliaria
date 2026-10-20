import {createMetrics} from './metricas.mjs';

const measurementPattern=/^G-[A-Z0-9]+$/;
const versions=new Set(['classico','novo']);
const sections=new Set(['maquete','planta2d','planta3d','visita','mapa','ficha']);
const choiceKey='liv.analytics.choice.v1';
const denied={analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'};

function sectionOf(win,doc) {
  try {
    const viewer=win.__livViewer;
    if(viewer) {
      if(doc.getElementById('mapPanel')?.open)return viewer.mapReady?'mapa':'carregando';
      if(doc.getElementById('unitDetails')?.open)return 'ficha';
      return viewer.ready&&sections.has(viewer.mode)?viewer.mode:'carregando';
    }
    const interior=win.__livInterior;
    return interior?.ready&&sections.has(interior.mode)?interior.mode:'carregando';
  }catch{return 'carregando';}
}

function loadGoogleTag({win,doc,measurementId}) {
  const script=doc.createElement('script');
  script.async=true;script.referrerPolicy='no-referrer';
  script.src=`https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  doc.head.append(script);
}

function forgetAnalyticsCookies(win,doc) {
  try {
    const names=doc.cookie.split(';').map(item=>item.split('=')[0].trim()).filter(name=>/^_ga(?:_|$)/.test(name));
    const host=win.location.hostname,parts=host.split('.'),domains=['',host];
    for(let i=1;i<parts.length-1;i++)domains.push(parts.slice(i).join('.'));
    const paths=['/'];let path='';
    for(const part of win.location.pathname.split('/').filter(Boolean).slice(0,-1)){path+=`/${part}`;paths.push(path,`${path}/`);}
    for(const name of names)for(const scope of paths)for(const domain of domains) {
      doc.cookie=`${name}=; Max-Age=0; Path=${scope}; SameSite=Lax${domain?`; Domain=${domain}`:''}`;
    }
  }catch{ /* A blocked cookie store must not block the visit. */ }
}

// Install only in the outer Liv page. No Google code or identifier exists before opt-in.
export function installLivAnalytics({win=window,doc=document,measurementId,version,loadTag=loadGoogleTag,send}={}) {
  if(typeof measurementId!=='string'||!measurementPattern.test(measurementId)||!versions.has(version)||(win.top&&win.top!==win))return {enabled:false};
  if(win.__livAnalytics)return win.__livAnalytics;
  let choice=null,loaded=false,disposed=false,lastPageSection=null,entrySent=false,ledger;
  const cleanups=[],boundDocuments=new WeakSet(),boundFrames=new WeakSet();
  const origin=new URL(win.location.href).origin;
  const rootPath=`/liv-${version==='novo'?'novo':'classico'}/`;
  const now=()=>win.performance.now();
  const command=(...args)=>{try{if(send)send(...args);else win.gtag(...args);}catch{}};
  const readChoice=()=>{try{return win.localStorage.getItem(choiceKey);}catch{return null;}};
  const storeChoice=value=>{try{win.localStorage.setItem(choiceKey,value);}catch{}};
  const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);cleanups.push(()=>target.removeEventListener(type,fn,options));};
  const locationFor=section=>origin+rootPath+section;
  const pageParameters=section=>({liv_version:version,liv_section:section,
    page_title:`Liv ${version} — ${section}`,page_location:locationFor(section),page_referrer:''});
  function emit(event) {
    if(choice!=='yes'||disposed||!sections.has(event.section))return;
    const params=pageParameters(event.section);
    if(event.type==='view'&&lastPageSection!==event.section) {
      lastPageSection=event.section;
      command('set',{page_location:params.page_location,page_title:params.page_title,page_referrer:''});
      command('event','page_view',{...params,send_to:measurementId});
    }
    if(event.activeMs>0)command('event','liv_active_time',{...params,active_ms:event.activeMs,send_to:measurementId});
  }
  function sync() {
    if(disposed)return;
    bindTree(win,doc,0);
    ledger?.context('liv',sectionOf(win,doc));ledger?.tick();
  }
  function activity() {
    if(doc.visibilityState!=='hidden')ledger?.activity();
  }
  function bindTree(frame,frameDoc,depth) {
    try {
      if(frame.location.origin!==origin)return;
      if(!boundDocuments.has(frameDoc)) {
        boundDocuments.add(frameDoc);
        for(const name of ['pointerdown','pointermove','keydown','wheel','touchstart'])listen(frameDoc,name,activity,{passive:true,capture:true});
      }
      if(depth>=3)return;
      for(const node of frameDoc.querySelectorAll('iframe')) {
        if(!boundFrames.has(node)) {
          boundFrames.add(node);
          listen(node,'load',()=>{try{bindTree(node.contentWindow,node.contentDocument,depth+1);}catch{}});
        }
        try{if(node.contentDocument)bindTree(node.contentWindow,node.contentDocument,depth+1);}catch{}
      }
    }catch{ /* Cross-origin maps and external destinations are never observed. */ }
  }
  function startTag() {
    win[`ga-disable-${measurementId}`]=false;
    if(!loaded) {
      loaded=true;
      win.dataLayer=win.dataLayer||[];
      if(typeof win.gtag!=='function')win.gtag=function(){win.dataLayer.push(arguments);};
      command('consent','default',{...denied});
      command('js',new Date());
      command('set',{ads_data_redaction:true,url_passthrough:false,allow_google_signals:false,allow_ad_personalization_signals:false});
    }
    command('consent','update',{...denied,analytics_storage:'granted'});
    const initial=sectionOf(win,doc),section=sections.has(initial)?initial:'maquete';
    command('config',measurementId,{...pageParameters(section),send_page_view:false,
      allow_google_signals:false,allow_ad_personalization_signals:false,cookie_flags:'SameSite=Lax;Secure'});
    // Config and consent precede the asynchronously loaded tag, including cached loads.
    if(!tagRequested) {
      tagRequested=true;
      try{Promise.resolve(loadTag({win,doc,measurementId})).catch(()=>{});}catch{}
    }
  }
  let tagRequested=false;
  const box=doc.createElement('aside');box.id='liv-analytics-consent';
  box.setAttribute('aria-label','Privacidade e métricas');
  box.style.cssText='position:fixed;bottom:16px;left:16px;z-index:100000;max-width:370px;padding:16px;border:1px solid #8c99a6;border-radius:10px;background:#fff;color:#17212b;font:14px/1.5 system-ui;box-shadow:0 4px 24px #0003';
  const text=doc.createElement('p');text.style.cssText='margin:0 0 12px';
  text.textContent='Permitir métricas de uso? Se aceitar, o Google Analytics mede visitas, seções acessadas e tempo de uso ativo. É opcional e não exige cadastro.';
  box.append(text);
  function button(label,handler) {
    const el=doc.createElement('button');el.type='button';el.textContent=label;
    el.style.cssText='min-height:40px;padding:8px 12px;margin:3px;border:1px solid #657586;border-radius:6px;background:#fff;color:#17212b;cursor:pointer;font:inherit';
    listen(el,'click',handler);return el;
  }
  const acceptButton=button('Aceitar métricas',()=>choose('yes'));
  const rejectButton=button('Continuar sem métricas',()=>choose('no'));
  const revokeButton=button('Revogar e apagar cookies',()=>choose('no'));
  const closeButton=button('Fechar',()=>{box.hidden=true;privacy.focus();});
  const privacy=button('Privacidade',()=>{box.hidden=false;(choice==='yes'?revokeButton:acceptButton).focus();});
  privacy.id='liv-analytics-privacy';privacy.style.cssText+=';position:fixed;bottom:8px;left:8px;z-index:99999;font-size:12px;min-height:32px';
  box.append(acceptButton,rejectButton,revokeButton,closeButton);doc.body.append(box,privacy);
  function renderChoice() {
    box.hidden=choice==='yes'||choice==='no';
    acceptButton.hidden=choice==='yes';rejectButton.hidden=choice==='yes';revokeButton.hidden=choice!=='yes';
    closeButton.hidden=choice===null;
    text.textContent=choice==='yes'?'Você permitiu métricas opcionais de visitas, seções e tempo ativo pelo Google Analytics. Você pode revogar a permissão e apagar os cookies neste navegador.':
      'Permitir métricas de uso? Se aceitar, o Google Analytics mede visitas, seções acessadas e tempo de uso ativo. É opcional e não exige cadastro.';
  }
  function choose(next,{persist=true}={}) {
    if(disposed||!['yes','no'].includes(next))return;
    if(next===choice){renderChoice();return;}
    choice=next;if(persist)storeChoice(choice);
    if(choice==='yes') {
      startTag();lastPageSection=null;
      // Consenting document openings are neither all link clicks nor distinct people.
      if(!entrySent) {
        entrySent=true;
        command('event','liv_entry',{liv_version:version,page_location:origin+rootPath,
          page_title:`Liv ${version} — entrada`,page_referrer:'',send_to:measurementId});
      }
      ledger=createMetrics({now,emit,page:'liv',section:sectionOf(win,doc)});
      ledger.visible(doc.visibilityState!=='hidden');ledger.consent(true);
    }else {
      ledger?.consent(false);ledger=null;
      win[`ga-disable-${measurementId}`]=true;
      if(loaded)command('consent','update',{...denied});
      forgetAnalyticsCookies(win,doc);
    }
    renderChoice();
  }
  listen(doc,'visibilitychange',()=>ledger?.visible(doc.visibilityState!=='hidden'));
  listen(win,'pagehide',()=>ledger?.pause());
  listen(win,'pageshow',()=>ledger?.visible(doc.visibilityState!=='hidden'));
  listen(win,'storage',event=>{if(event.key===choiceKey)choose(event.newValue==='yes'?'yes':'no',{persist:false});});
  bindTree(win,doc,0);
  const interval=win.setInterval(sync,1000);
  const api={enabled:true,accept:()=>choose('yes'),reject:()=>choose('no'),revoke:()=>choose('no'),
    showConsent(){if(!disposed){box.hidden=false;(choice==='yes'?revokeButton:acceptButton).focus();}},
    getState:()=>({choice,tagRequested,section:sectionOf(win,doc),version}),
    destroy(){if(disposed)return;ledger?.pause();ledger?.consent(false);disposed=true;win.clearInterval(interval);
      for(const cleanup of cleanups)cleanup();box.remove();privacy.remove();delete win.__livAnalytics;}};
  win.__livAnalytics=api;
  const stored=readChoice();if(stored==='yes'||stored==='no')choose(stored,{persist:false});else renderChoice();
  return api;
}
