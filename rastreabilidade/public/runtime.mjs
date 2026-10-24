import {createMetrics,createDelivery} from './metricas.mjs';

const opaque=/^[A-Za-z0-9_-]{32,128}$/;
const modes=new Set(['maquete','planta2d','planta3d','visita']);
const stages=new Set(['mapa','interior','planta']);
const navKeys=['pagina','modo','etapa','em','r','p','t','noite','geometria','unidades','unidade','estoque','luz','experiencia'];
const openingKey='tracking.openings.v1',choicePrefix='tracking.choice.v1.',visitorKey='tracking.visitor.v1';

export function validateOpening(value,origin) {
  if(!value||!/^[A-Za-z0-9_-]{32}$/.test(value.visitId)||!/^[A-Za-z0-9_-]{32}\.[A-Za-z0-9_-]{43}$/.test(value.receipt)
    ||!value.receipt.startsWith(value.visitId+'.')||!/^[A-Za-z0-9_-]{32}$/.test(value.shareToken)
    ||!['root','forwarded','own_return','uncertain'].includes(value.sourceClass)
    ||!/^[0-9a-f]{12}$/.test(value.publishedBuild)||typeof value.propertyTitle!=='string'
    ||!value.contact||typeof value.contact.brokerName!=='string'
    ||!(value.contact.whatsappNumber===null||(typeof value.contact.whatsappNumber==='string'
      &&/^[1-9][0-9]{7,14}$/.test(value.contact.whatsappNumber))))throw Error('Abertura inválida');
  const base=new URL(origin);let unit;
  for(const page of ['tour','maquete']) {
    const raw=value.destinations?.[page];
    if(typeof raw!=='string'||raw.includes('..')||raw.includes('%')||raw.includes('\\'))throw Error('Destino inválido');
    const url=new URL(raw,base);
    const match=url.pathname.match(/^\/b\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([0-9a-f]{12})\/(tour|maquete)\.html$/);
    if(url.origin!==base.origin||url.username||url.password||url.search||url.hash||!match
      ||match[2]!==value.publishedBuild||match[3]!==page||(unit&&match[1]!==unit))throw Error('Destino inválido');
    unit=match[1];
  }
  const share=new URL(value.shareUrl,base);
  if(share.origin!==base.origin||share.pathname!=='/acesso.html'||share.hash||share.username||share.password
    ||share.searchParams.get('l')!==value.shareToken||share.searchParams.getAll('l').length!==1
    ||[...share.searchParams.keys()].some(key=>!['l','pagina'].includes(key)))throw Error('Compartilhamento inválido');
  return value;
}

function navigation(url) {
  const u=new URL(url),params=new URLSearchParams();
  for(const key of navKeys) {
    const value=u.searchParams.get(key);
    if(value!==null&&value.length<=160)params.set(key,value);
  }
  params.set('pagina',params.get('pagina')==='tour'?'tour':'maquete');
  if(params.has('modo')&&!modes.has(params.get('modo')))params.delete('modo');
  if(params.has('etapa')&&!stages.has(params.get('etapa')))params.delete('etapa');
  return {params,hash:u.hash.length<=512?u.hash:''};
}

export function shareAddress(current,opening) {
  const source=new URL(current),url=new URL('/acesso.html',source.origin),nav=navigation(current);
  url.search=nav.params.toString();url.searchParams.set('l',opening.shareToken);url.hash=nav.hash;
  return url.href;
}

export function whatsappAddress(current,opening) {
  const phone=opening.contact?.whatsappNumber;
  if(typeof phone!=='string'||!/^[1-9][0-9]{7,14}$/.test(phone))return null;
  const message=`Olá! Tenho interesse em ${opening.propertyTitle}.\n${shareAddress(current,opening)}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function frameAddress(destination,outer) {
  const url=new URL(destination,new URL(outer).origin),nav=navigation(outer);
  nav.params.delete('pagina');
  if(url.pathname.endsWith('/tour.html')) {
    nav.params.delete('modo'); // The legacy tour treats any non-aerial modo as interior.
    nav.params.set('imovel',url.pathname.split('/')[2]);
  } else nav.params.delete('etapa');
  url.search=nav.params.toString();url.hash=nav.hash;
  return url.href;
}

export function wrapperForDestination(destination,outer,opening) {
  try {
    const url=new URL(destination,outer),base=new URL(outer);
    const page=['tour','maquete'].find(name=>{
      const approved=new URL(opening.destinations[name],base.origin);
      return url.origin===approved.origin&&url.pathname===approved.pathname;
    });
    if(!page)return null;
    const wrapper=new URL(shareAddress(outer,opening));wrapper.searchParams.set('pagina',page);
    for(const key of navKeys.filter(key=>key!=='pagina')) {
      if(url.searchParams.has(key))wrapper.searchParams.set(key,url.searchParams.get(key));
    }
    if(url.hash)wrapper.hash=url.hash;
    return shareAddress(wrapper.href,opening);
  } catch {return null;}
}

export function primarySection(frame,page) {
  try {
    if(page==='maquete') {
      const liv=frame.__livViewer;
      if(liv) {
        const doc=frame.document;
        if(doc?.getElementById('mapPanel')?.open)return liv.mapReady?'mapa':'carregando';
        if(doc?.getElementById('unitDetails')?.open)return 'ficha';
        return liv.ready&&modes.has(liv.mode)?liv.mode:'carregando';
      }
      const mode=frame.__maq?.modo();return modes.has(mode)?mode:'carregando';
    }
    if(frame.__livMapAdapter)return frame.__livMapAdapter.ready?'mapa':'carregando';
    const state=frame.__int;
    if(!state||state.MAQ?.anim||state.INT?.voo)return 'carregando';
    const stage=state.ETAPA?.atual;
    if(stage==='mapa')return 'mapa';
    if(stage==='planta'&&state.PLANTA?.on)return 'planta';
    if(stage==='interior'&&state.INT?.on&&!state.PLANTA?.on)return 'interior';
  } catch { /* A frame that leaves the approved origin is not observed. */ }
  return 'carregando';
}

export function randomId(crypto=globalThis.crypto) {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function canonicalAddress(current,publicOrigin){
  const url=new URL(current),origin=new URL(publicOrigin)
  const hosts=new Set(['https://imobilaria-deccb-miniaturas.web.app','https://imobilaria-deccb-miniaturas.firebaseapp.com','https://conectaimoveis3d.com.br'])
  if(url.origin===origin.origin)return null
  if(!hosts.has(url.origin)||!hosts.has(origin.origin)||origin.href!==origin.origin+'/'||url.pathname!=='/acesso.html')throw Error('Origem inválida')
  return origin.origin+url.pathname+url.search+url.hash
}

export function createOpeningStore(storage,random=randomId) {
  let entries=[];
  try {const parsed=JSON.parse(storage.getItem(openingKey));if(Array.isArray(parsed))entries=parsed.slice(-8);}catch{}
  const pending=new Map();
  const save=()=>{try{storage.setItem(openingKey,JSON.stringify(entries.slice(-8)));}catch{}};
  return {
    prepare(token) {
      if(!opaque.test(token))throw Error('Link inválido');
      if(pending.has(token))return {...pending.get(token)};
      let entry=entries.find(item=>item.originalToken===token||item.opening?.shareToken===token);
      if(!entry) {entry={originalToken:token,attemptId:random()};entries.push(entry);save();}
      const payload={token:entry.originalToken,attemptId:entry.opening?random():entry.attemptId};
      if(entry.opening)payload.receipt=entry.opening.receipt;
      pending.set(token,payload);return {...payload};
    },
    commit(token,opening) {
      const entry=entries.find(item=>item.originalToken===token||item.opening?.shareToken===token);
      if(!entry)throw Error('Abertura não preparada');
      entry.opening=opening;save();pending.delete(token);
    },
    forget(token) {entries=entries.filter(item=>item.originalToken!==token&&item.opening?.shareToken!==token);pending.delete(token);save();},
  };
}

function storageOf(win,name) {
  try{return win[name];}catch{return {getItem:()=>null,setItem:()=>{},removeItem:()=>{}};}
}
function get(storage,key) {try{return storage.getItem(key);}catch{return null;}}
function put(storage,key,value) {try{storage.setItem(key,value);}catch{}}
function drop(storage,key) {try{storage.removeItem(key);}catch{}}

export async function boot(win=window,doc=document) {
  const el=id=>doc.getElementById(id),status=text=>{el('estado').textContent=text;};
  const frame=el('conteudo'),sessionStorage=storageOf(win,'sessionStorage'),local=storageOf(win,'localStorage');
  let config,opening,page='maquete',ledger,delivery,analytics,startingSession=false,stopped=false;
  let choice=null,started=false,choiceKey,consentEpoch=0,frameRequest,sessionRetryAt=0,observedFrame=false;
  const boundDocuments=new WeakSet();
  const store=createOpeningStore(sessionStorage,()=>randomId(win.crypto));
  function approvedFrame() {
    if(!opening||stopped)return false;
    try {
      const current=frame.contentWindow.location;
      return current.origin===win.location.origin&&['tour','maquete'].some(name=>
        new URL(opening.destinations[name],win.location.origin).pathname===current.pathname);
    }catch{return false;}
  }
  function armFrame(url) {
    const requested=new URL(url).searchParams;
    frameRequest={mode:requested.get('modo'),unit:requested.get('unidade'),before:frame.contentDocument,complete:false,attempted:false};
    frame.src=url;
  }
  function initializeFrame() {
    if(!approvedFrame())return false;
    // EXPERIMENTO-COMPRA-20261023: somente o contato público do responsável validado pela API.
    if(page==='maquete')frame.contentWindow.__livViewer?.setContact?.({contact:opening.contact,shareUrl:shareAddress(win.location.href,opening)});
    if(!frameRequest||frameRequest.complete)return true;
    if(frame.contentDocument===frameRequest.before)return false;
    const liv=page==='maquete'&&frame.contentWindow.__livViewer;
    if(liv) {
      if(!liv.ready)return false;
      if(frameRequest.unit&&liv.selectedUnitId!==frameRequest.unit
        &&liv.units?.units?.some(unit=>unit.id===frameRequest.unit)&&typeof liv.selectUnit==='function')liv.selectUnit(frameRequest.unit);
      const requested=modes.has(frameRequest.mode)&&liv.selectedUnitId?frameRequest.mode:'maquete';
      if(liv.mode!==requested&&!frameRequest.attempted&&typeof liv.setMode==='function') {
        const request=frameRequest;request.attempted=true;
        // A cena pode estar pronta antes de chegar a relação do apartamento com a planta.
        void Promise.resolve(liv.setMode(requested)).then(result=>{
          if(result===false)request.attempted=false;
        },()=>{request.attempted=false;});
        return false;
      }
      if(liv.mode!==requested||!liv.ready)return false;
      frameRequest.complete=true;return true;
    }
    if(page==='maquete'&&modes.has(frameRequest.mode)) {
      const api=frame.contentWindow.__maq;
      if(!api||typeof api.modo!=='function'||typeof api.vaiPara!=='function')return false;
      if(api.modo()!==frameRequest.mode&&!frameRequest.attempted) {
        frameRequest.attempted=true;api.vaiPara(frameRequest.mode);
      }
      if(api.modo()!==frameRequest.mode)return false;
    }
    frameRequest.complete=true;return true;
  }
  function activity() {if(approvedFrame())ledger?.activity();else{ledger?.pause();ledger?.visible(false);}}
  function visibility() {ledger?.visible(doc.visibilityState!=='hidden'&&approvedFrame());}
  const analyticKey=()=>`tracking.analytics.${opening.visitId}`;
  const consentUI=()=>{el('consentimento').hidden=choice==='yes'||choice==='no';el('escolha').hidden=!opening;
    el('privacidade').textContent=choice==='yes'?'Métricas aceitas. Você pode alterar a escolha.':choice==='no'?'Você continua sem métricas.':'A escolha de métricas é sua.';};
  try {
    config=JSON.parse(el('configRastreabilidade').textContent);
    const api=new URL(config.apiBase),pub=new URL(config.publicOrigin);
    const canonical=canonicalAddress(win.location.href,config.publicOrigin);
    if(canonical){win.location.replace(canonical);return;}
    if(pub.origin!==win.location.origin||pub.href!==pub.origin+'/'||api.username||api.password||api.search||api.hash
      ||!(api.protocol==='https:'||(api.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(api.hostname))))throw Error('Configuração inválida');
    config.apiBase=api.href.endsWith('/')?api.href:api.href+'/';
  } catch {status('Não consegui abrir este link. A página precisa da configuração de acesso da imobiliária.');return;}

  async function post(route,body) {
    const response=await win.fetch(new URL(route,config.apiBase),{method:'POST',headers:{'Content-Type':'application/json'},
      credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok) {const error=Error('A solicitação não foi concluída.');error.status=response.status;error.code=result.code||result.error;throw error;}
    return result;
  }
  function failClosed(message) {
    stopped=true;consentEpoch++;ledger?.consent(false);delivery?.clear();frame.hidden=true;frame.removeAttribute('src');status(message);
    for(const id of ['paginaTour','paginaMaquete','compartilhar','consentimento','escolha','whatsapp'])el(id).hidden=true;
    el('whatsapp').removeAttribute('href');
    el('copiar').disabled=true;
  }
  function saveAnalytics(snapshot) {
    if(choice==='yes'&&analytics)put(sessionStorage,analyticKey(),JSON.stringify({...analytics,...snapshot}));
  }
  function apiFailure(error) {
    if(['LINK_DISABLED','VISIT_EXPIRED'].includes(error.code)) {failClosed('Este link não está mais disponível. Solicite um novo link à imobiliária.');return;}
    if(error.code==='SESSION_EXPIRED') {
      ledger?.consent(false);delivery?.clear();ledger=null;delivery=null;drop(sessionStorage,analyticKey());analytics=null;sessionRetryAt=0;
      if(choice==='yes')void startMetrics();
    }
  }
  async function startMetrics() {
    if(choice!=='yes'||!approvedFrame()||ledger||startingSession||win.performance.now()<sessionRetryAt)return;
    startingSession=true;const epoch=consentEpoch;
    try {
      let visitor=get(local,visitorKey);
      if(!opaque.test(visitor||'')) {visitor=randomId(win.crypto);put(local,visitorKey,visitor);}
      let candidate=analytics;
      if(!candidate) {
        try {const old=JSON.parse(get(sessionStorage,analyticKey()));if(old?.visitorKey===visitor)candidate=old;}catch{}
      }
      if(!candidate) {
        const result=await post('sessions',{visitId:opening.visitId,receipt:opening.receipt,visitorKey:visitor,page});
        if(!opaque.test(result.sessionId)||!Number.isSafeInteger(result.nextSeq)||result.nextSeq<1)throw Error('Sessão inválida');
        candidate={sessionId:result.sessionId,visitorKey:visitor,nextSeq:result.nextSeq,items:[]};
      }
      if(epoch!==consentEpoch||choice!=='yes'||stopped)return;
      analytics=candidate;
      delivery=createDelivery({initial:analytics.items,nextSeq:analytics.nextSeq,retried:analytics.retried,changed:saveAnalytics,
        send:payload=>post('events',payload),failed:error=>{if(epoch===consentEpoch)apiFailure(error);},recover:async()=>{
          const result=await post('sessions',{visitId:opening.visitId,receipt:opening.receipt,visitorKey:visitor,page});
          if(result.sessionId!==analytics.sessionId)throw Object.assign(Error('Sessão renovada'),{code:'SESSION_EXPIRED'});
          return result.nextSeq;
        }});
      ledger=createMetrics({now:()=>win.performance.now(),page,section:initializeFrame()?primarySection(frame.contentWindow,page):'carregando',
        emit:event=>{if(choice!=='yes'||!approvedFrame())return;
          if(!delivery.add({visitId:opening.visitId,receipt:opening.receipt,sessionId:analytics.sessionId,...event}))status('A conexão está indisponível. Parte das métricas pode não ser registrada.');
          void delivery.drain();}});
      visibility();ledger.consent(true);saveAnalytics(delivery.snapshot());
    } catch(error) {if(epoch===consentEpoch){apiFailure(error);sessionRetryAt=win.performance.now()+15000;if(!stopped)status('O imóvel está disponível. As métricas estão temporariamente indisponíveis.');}}
    finally{startingSession=false;if(epoch!==consentEpoch&&choice==='yes'&&!stopped)void startMetrics();}
  }
  function changeChoice(value) {
    if(!opening||stopped)return;
    if(choice===value){consentUI();return;}
    consentEpoch++;
    sessionRetryAt=0;
    choice=value;put(sessionStorage,choiceKey,value);consentUI();
    if(value==='yes')void startMetrics();
    else {ledger?.consent(false);delivery?.clear();ledger=null;delivery=null;drop(local,visitorKey);drop(sessionStorage,analyticKey());analytics=null;}
  }
  el('aceitar').addEventListener('click',()=>changeChoice('yes'));
  el('recusar').addEventListener('click',()=>changeChoice('no'));
  el('escolha').addEventListener('click',()=>{el('consentimento').hidden=false;el('aceitar').focus();});

  function syncContact() {
    const link=el('whatsapp'),address=whatsappAddress(win.location.href,opening);
    let inside=false;
    try {
      const inner=page==='maquete'&&frame.contentDocument;
      const contact=inner?.getElementById?.('buyerContact'),action=inner?.getElementById?.('buyerContactLink');
      inside=contact?.hidden===false&&action?.hidden===false&&action?.dataset.whatsappFloating==='true';
    }catch{}
    link.hidden=!address||inside;
    if(address) {
      link.href=address;
      link.setAttribute('aria-label',`Conversar com ${opening.contact.brokerName} pelo WhatsApp, em nova aba`);
      link.title=`WhatsApp de ${opening.contact.brokerName}`;
    } else link.removeAttribute('href');
  }
  function syncNavigation() {
    if(!initializeFrame()){ledger?.context(page,'carregando');return;}
    const current=new URL(shareAddress(win.location.href,opening));current.searchParams.set('pagina',page);
    const section=primarySection(frame.contentWindow,page);
    if(page==='maquete'&&modes.has(section))current.searchParams.set('modo',section);
    const liv=page==='maquete'&&frame.contentWindow.__livViewer;
    if(liv?.selectedUnitId)current.searchParams.set('unidade',liv.selectedUnitId);
    else if(liv)current.searchParams.delete('unidade');
    if(page==='tour'&&stages.has(section)) {
      if(section==='mapa')current.searchParams.delete('etapa');else current.searchParams.set('etapa',section);
    }
    if(current.href!==win.location.href)win.history.replaceState(null,'',current.href);
    for(const [id,targetPage] of [['paginaMaquete','maquete'],['paginaTour','tour']]) {
      const link=new URL(current);link.searchParams.set('pagina',targetPage);el(id).href=link.href;el(id).hidden=false;
      if(targetPage===page)el(id).setAttribute('aria-current','page');else el(id).removeAttribute('aria-current');
    }
    syncContact();ledger?.context(page,section);
  }
  function navigate(nextPage,destination) {
    if(!opening||stopped)return;
    ledger?.pause();page=nextPage;ledger?.context(page,'carregando');
    const url=new URL(shareAddress(destination||win.location.href,opening));url.searchParams.set('pagina',page);
    win.history.replaceState(null,'',url.href);armFrame(frameAddress(opening.destinations[page],url.href));
    syncNavigation();
  }
  for(const [id,nextPage] of [['paginaMaquete','maquete'],['paginaTour','tour']])el(id).addEventListener('click',event=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.button!==0)return;
    event.preventDefault();if(nextPage!==page)navigate(nextPage,el(id).href);
  });
  async function copy() {
    try {await win.navigator.clipboard.writeText(shareAddress(win.location.href,opening));status('Link copiado. O corretor de origem acompanha o encaminhamento.');}
    catch {status('Não consegui copiar automaticamente. Você pode copiar o endereço da barra.');}
  }
  el('copiar').addEventListener('click',copy);
  el('compartilhar').addEventListener('click',async()=>{
    try{await win.navigator.share({title:opening.propertyTitle,url:shareAddress(win.location.href,opening)});}catch(error){if(error.name!=='AbortError')await copy();}
  });
  function bindFrame() {
    if(stopped||!opening)return;
    try {
      const current=frame.contentWindow.location;
      if(current.origin!==win.location.origin) {ledger?.pause();ledger?.visible(false);status('Você saiu para outra página. A navegação nesse destino não é medida.');return;}
      const matching=['tour','maquete'].find(name=>new URL(opening.destinations[name],win.location.origin).pathname===current.pathname);
      if(!matching) {ledger?.pause();ledger?.visible(false);return;}
      page=matching;const liveDocument=frame.contentDocument;
      visibility();observedFrame=true;if(choice==='yes'&&!ledger)void startMetrics();
      if(boundDocuments.has(liveDocument)) {syncNavigation();return;}
      boundDocuments.add(liveDocument);
      const decorate=()=>{
        for(const anchor of liveDocument.querySelectorAll('a[href]')) {
          const original=anchor.dataset.trackingDestination||anchor.href;
          const wrapper=wrapperForDestination(original,win.location.href,opening);
          if(wrapper) {anchor.dataset.trackingDestination=original;anchor.href=wrapper;}
        }
      };
      decorate();
      // Rewrite the actual href, so middle-click and Copy link also use the child.
      liveDocument.addEventListener('pointerdown',decorate,true);
      liveDocument.addEventListener('click',event=>{
        const anchor=event.target.closest?.('a[href]');if(!anchor)return;
        const original=anchor.dataset.trackingDestination||anchor.href;
        const wrapper=wrapperForDestination(original,win.location.href,opening);
        if(wrapper&&event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey
          &&(!anchor.target||anchor.target.toLowerCase()==='_self')) {
          event.preventDefault();event.stopImmediatePropagation();navigate(new URL(wrapper).searchParams.get('pagina'),wrapper);
        } else if(!wrapper&&new URL(anchor.href,current.href).origin!==win.location.origin)ledger?.pause();
      },true);
      for(const event of ['pointerdown','keydown','wheel','touchstart'])liveDocument.addEventListener(event,activity,{passive:true,capture:true});
      activity();syncNavigation();
    } catch {ledger?.pause();}
  }
  frame.addEventListener('load',bindFrame);
  for(const event of ['pointerdown','keydown','wheel','touchstart'])doc.addEventListener(event,activity,{passive:true,capture:true});
  doc.addEventListener('visibilitychange',()=>{visibility();if(!started&&doc.visibilityState!=='hidden')void open();});
  win.addEventListener('pagehide',()=>{ledger?.pause();void delivery?.drain();});
  win.addEventListener('pageshow',()=>{visibility();if(opening&&!stopped)bindFrame();});
  win.setInterval(()=>{
    if(!opening||stopped)return;
    try {
      const approved=approvedFrame();
      if(approved!==observedFrame){observedFrame=approved;visibility();}
      if(!approved) {ledger?.pause();ledger?.visible(false);return;}
      if(choice==='yes'&&!ledger)void startMetrics();
      syncNavigation();ledger?.tick();void delivery?.drain();
    } catch {ledger?.pause();}
  },1000);
  async function open() {
    if(started||doc.visibilityState==='hidden')return;started=true;
    const token=new URL(win.location.href).searchParams.get('l');
    try {
      opening=validateOpening(await post('open',store.prepare(token)),win.location.origin);store.commit(token,opening);
      choiceKey=choicePrefix+new URL(opening.destinations.tour,win.location.origin).pathname.split('/')[2];
      choice=get(sessionStorage,choiceKey);
      const url=shareAddress(win.location.href,opening);win.history.replaceState(null,'',url);
      page=new URL(url).searchParams.get('pagina');el('titulo').textContent=opening.propertyTitle;doc.title=opening.propertyTitle;
      syncContact();
      el('copiar').disabled=false;el('compartilhar').hidden=!win.navigator.share;
      consentUI();frame.hidden=false;armFrame(frameAddress(opening.destinations[page],url));status('');
      if(choice==='yes')void startMetrics();
    } catch(error) {
      if(error.code==='VISIT_EXPIRED')store.forget(token);
      failClosed(['LINK_DISABLED','VISIT_EXPIRED'].includes(error.code)?'Este link não está mais disponível. Solicite um novo link à imobiliária.':'Não consegui abrir este imóvel. Recarregue a página para tentar novamente.');
    }
  }
  await open();
}

if(typeof window!=='undefined'&&typeof document!=='undefined')void boot();
