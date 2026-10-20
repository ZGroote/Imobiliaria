import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {boot,validateOpening, shareAddress, frameAddress, createOpeningStore, primarySection,
  wrapperForDestination} from '../rastreabilidade/public/runtime.mjs';
import {createMetrics, createDelivery} from '../rastreabilidade/public/metricas.mjs';
import {montar} from '../tools/montar_rastreabilidade.mjs';
import {createHash} from 'node:crypto';

const origin='https://imoveis.test', token='a'.repeat(32), child='b'.repeat(32);
const opening=()=>({visitId:'v'.repeat(32),receipt:'v'.repeat(32)+'.'+'r'.repeat(43),shareToken:child,
  shareUrl:origin+'/acesso.html?l='+child+'&pagina=maquete', sourceClass:'root',
  destinations:{tour:'/b/cedros-37/012345abcdef/tour.html',maquete:'/b/cedros-37/012345abcdef/maquete.html'},
  publishedBuild:'012345abcdef',propertyTitle:'Imóvel <teste>',contact:{brokerName:'Corretor',whatsappNumber:null}});

test('destinos precisam ser o mesmo imóvel/build e origem, sem redirecionamento nem parâmetros',()=>{
  assert.equal(validateOpening(opening(),origin).publishedBuild,'012345abcdef');
  for(const bad of ['https://evil.test/b/cedros-37/012345abcdef/tour.html','//evil.test/tour.html',
    '/b/outro/012345abcdef/tour.html','/b/cedros-37/999999999999/tour.html',
    '/b/cedros-37/012345abcdef/tour.html?receipt=segredo','/b/cedros-37/012345abcdef/../tour.html']){
    assert.throws(()=>validateOpening({...opening(),destinations:{...opening().destinations,tour:bad}},origin));
  }
  assert.throws(()=>validateOpening({...opening(),shareUrl:origin+'/acesso.html?l='+child+'&receipt=segredo'},origin));
});

test('barra e iframe preservam página/modo/hash e nunca compartilham o recibo',()=>{
  const url=origin+'/acesso.html?l='+token+'&pagina=tour&etapa=planta&modo=planta3d&receipt=segredo#vista';
  const share=new URL(shareAddress(url,opening()));
  assert.equal(share.searchParams.get('l'),child);
  assert.equal(share.searchParams.get('pagina'),'tour');
  assert.equal(share.searchParams.get('etapa'),'planta');
  assert.equal(share.searchParams.get('modo'),'planta3d');
  assert.equal(share.hash,'#vista');
  assert.equal(share.searchParams.has('receipt'),false);
  const frame=new URL(frameAddress(opening().destinations.tour,share.href));
  assert.equal(frame.searchParams.has('l'),false);
  assert.equal(frame.searchParams.get('etapa'),'planta');
  assert.equal(frame.searchParams.get('imovel'),'cedros-37');
  assert.equal(frame.searchParams.has('modo'),false,'modo da maquete não pode acionar deep link legado do tour');
  assert.equal(frame.hash,'#vista');
});

test('recibo privado retoma por token original ou pela barra substituída; retry mantém intento',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  let n=0;const random=()=>String(++n).padStart(32,'x');
  const store=createOpeningStore(storage,random);
  const request=store.prepare(token);
  assert.deepEqual(store.prepare(token),request);
  assert.equal(request.receipt,undefined);
  store.commit(token,opening());
  const reload=createOpeningStore(storage,random).prepare(child);
  assert.equal(reload.token,token);
  assert.equal(reload.receipt,opening().receipt);
  assert.notEqual(reload.attemptId,request.attemptId);
  assert.equal(new URL(shareAddress(origin+'/acesso.html?l='+token,opening())).searchParams.has('receipt'),false);
});

test('retorno interno é wrapper; mapa externo e outro imóvel não recebem token',()=>{
  const outer=origin+'/acesso.html?l='+child+'&pagina=maquete&modo=visita#inicio';
  const target=wrapperForDestination(origin+opening().destinations.tour,outer,opening());
  assert.equal(new URL(target).pathname,'/acesso.html');
  assert.equal(new URL(target).searchParams.get('pagina'),'tour');
  assert.equal(new URL(target).searchParams.get('l'),child);
  assert.equal(wrapperForDestination('https://cidade.test/',outer,opening()),null);
  assert.equal(wrapperForDestination(origin+'/b/outro/012345abcdef/tour.html',outer,opening()),null);
});

test('seções têm uma fonte principal e transição/estado desconhecido fica carregando',()=>{
  assert.equal(primarySection({__maq:{modo:()=> 'visita'}},'maquete'),'visita');
  assert.equal(primarySection({__maq:{modo:()=> 'invalido'}},'maquete'),'carregando');
  assert.equal(primarySection({__int:{ETAPA:{atual:'planta'},PLANTA:{on:true},MAQ:{}}},'tour'),'planta');
  assert.equal(primarySection({__int:{ETAPA:{atual:'interior'},INT:{on:true,voo:{}},MAQ:{}}},'tour'),'carregando');
  assert.equal(primarySection({__int:{ETAPA:{atual:'mapa'},INT:{},MAQ:{}}},'tour'),'mapa');
});

test('seções do Liv acompanham modos prontos, ficha e mapa sem creditar carregamento',()=>{
  const dialogs={unitDetails:{open:false},mapPanel:{open:false}};
  const viewer={ready:true,mode:'maquete',mapReady:false};
  const frame={__livViewer:viewer,document:{getElementById:id=>dialogs[id]}};
  for(const mode of ['maquete','planta2d','planta3d','visita']) {
    viewer.mode=mode;
    assert.equal(primarySection(frame,'maquete'),mode);
    viewer.ready=false;
    assert.equal(primarySection(frame,'maquete'),'carregando');
    viewer.ready=true;
  }
  viewer.mode='desconhecido';
  assert.equal(primarySection(frame,'maquete'),'carregando');
  viewer.mode='visita';dialogs.unitDetails.open=true;
  assert.equal(primarySection(frame,'maquete'),'ficha');
  viewer.ready=false;
  assert.equal(primarySection(frame,'maquete'),'ficha','a ficha aberta é a seção principal mesmo com a cena carregando');
  dialogs.mapPanel.open=true;
  assert.equal(primarySection(frame,'maquete'),'carregando');
  viewer.mapReady=true;
  assert.equal(primarySection(frame,'maquete'),'mapa','mapa modal precede ficha e não depende do ready da cena suspensa');
  dialogs.mapPanel.open=false;
  assert.equal(primarySection(frame,'maquete'),'ficha','mapReady residual não mantém o mapa depois de fechar');
  dialogs.unitDetails.open=false;
  assert.equal(primarySection(frame,'maquete'),'carregando');
  viewer.ready=true;
  assert.equal(primarySection(frame,'maquete'),'visita');
});

test('Liv precede o estado legado e frames inacessíveis não são observados',()=>{
  assert.equal(primarySection({__livViewer:{ready:false,mode:'visita'},__maq:{modo:()=> 'maquete'}},'maquete'),'carregando');
  const inaccessible=new Proxy({}, {get(){throw new DOMException('Blocked a frame','SecurityError');}});
  assert.equal(primarySection(inaccessible,'maquete'),'carregando');
  assert.equal(primarySection(inaccessible,'tour'),'carregando');
  assert.equal(primarySection({__livViewer:{ready:true,mode:'visita'},get document(){throw new DOMException('Blocked a frame','SecurityError');}},'maquete'),'carregando');
});

test('tempo depende de consentimento/visibilidade, muda sem sobreposição, cessa após 60s inativo',()=>{
  let now=0;const events=[]; const m=createMetrics({now:()=>now,emit:e=>events.push(e),page:'maquete',section:'maquete'});
  now=10000;m.tick();assert.equal(events.length,0);
  m.consent(true);now=25000;m.tick();
  assert.deepEqual(events.at(-1),{type:'heartbeat',page:'maquete',section:'maquete',activeMs:15000});
  now=30000;m.context('maquete','visita');
  assert.equal(events.at(-2).activeMs,5000);
  assert.equal(events.at(-1).type,'view');
  now=35000;m.visible(false);now=100000;m.tick();
  assert.equal(events.reduce((n,e)=>n+e.activeMs,0),25000);
  m.visible(true);m.activity();now=160001;m.tick();
  assert.equal(events.at(-1).type,'pause');
  assert.equal(events.at(-1).activeMs,30000,'cada envio limitado a 30s mesmo após relógio suspenso');
  const count=events.length;now=200000;m.tick();assert.equal(events.length,count);
  m.consent(false);now=210000;m.activity();m.tick();assert.equal(events.length,count);
});

test('retry conserva sequência e payload; o próximo evento espera o anterior',async()=>{
  const sent=[];let fail=true;
  const q=createDelivery({send:async p=>{sent.push({...p});if(fail){fail=false;throw Error('offline');}return{accepted:true,seq:p.seq};}});
  q.add({visitId:'v',sessionId:'s',receipt:'privado',type:'view',page:'tour',section:'mapa',activeMs:0});
  q.add({visitId:'v',sessionId:'s',receipt:'privado',type:'heartbeat',page:'tour',section:'mapa',activeMs:15000});
  await q.drain();assert.equal(q.pending().length,2);
  await q.drain();
  assert.deepEqual(sent.map(x=>x.seq),[1,1,2]);
  assert.deepEqual(sent[0],sent[1]);assert.equal(q.pending().length,0);
});

test('conflito de outra aba recupera nextSeq uma vez, preservando payload e ordem',async()=>{
  const sent=[];let conflict=true;
  const q=createDelivery({send:async payload=>{sent.push({...payload});if(conflict){conflict=false;throw Object.assign(Error('conflito'),{code:'EVENT_CONFLICT'});}return{accepted:true,seq:payload.seq};},recover:async()=>5});
  q.add({type:'heartbeat',page:'tour',section:'mapa',activeMs:1000});
  q.add({type:'pause',page:'tour',section:'mapa',activeMs:2000});
  await q.drain();assert.deepEqual(sent.map(x=>x.seq),[1,5,6]);
  assert.equal(sent[0].activeMs,sent[1].activeMs);assert.equal(q.snapshot().nextSeq,7);
});

test('segundo conflito descarta o intervalo e não repete seu tempo indefinidamente',async()=>{
  let recoveries=0,sends=0;
  const q=createDelivery({send:async()=>{sends++;throw Object.assign(Error('conflito'),{code:'EVENT_CONFLICT'});},recover:async()=>{recoveries++;return 3;}});
  q.add({type:'heartbeat',page:'tour',section:'mapa',activeMs:15000});await q.drain();await q.drain();
  assert.equal(recoveries,1);assert.equal(sends,2);assert.equal(q.pending().length,0);
});

test('fila offline é limitada e descartar novo delta não consome sequência',async()=>{
  let online=false;const sent=[];
  const q=createDelivery({send:async item=>{if(!online)throw Error('offline');sent.push(item);return{accepted:true,seq:item.seq};}});
  for(let i=0;i<100;i++)q.add({type:'heartbeat',page:'tour',section:'mapa',activeMs:15000});
  await q.drain();assert.equal(q.pending().length,64);assert.equal(q.snapshot().nextSeq,65);
  online=true;await q.drain();q.add({type:'pause',page:'tour',section:'mapa',activeMs:500});await q.drain();
  assert.equal(sent.length,65);assert.equal(sent.at(-1).seq,65);
});

test('montagem usa destino novo, versiona assets/config e não modifica site base',async t=>{
  const workspace=await mkdtemp(join(tmpdir(),'tracking-client-'));t.after(()=>rm(workspace,{recursive:true,force:true}));
  const base=join(workspace,'base');await mkdir(base);await writeFile(join(base,'index.html'),'original');
  await writeFile(join(base,'estado.json'),JSON.stringify({schema:1,arquivos:{'index.html':createHash('sha256').update('original').digest('hex')}}));
  const output=join(workspace,'publicacao','rastreabilidade','rodada');
  const res=await montar({workspace,output,baseSite:base,apiBase:'http://127.0.0.1:8833/',publicOrigin:'http://127.0.0.1:8834'});
  const html=await readFile(join(output,'acesso.html'),'utf8');
  assert.match(html,/127\.0\.0\.1:8833/);assert.match(html,new RegExp(res.release));
  assert.equal(await readFile(join(base,'index.html'),'utf8'),'original');
  assert.equal(await readFile(join(output,'index.html'),'utf8'),'original');
  await assert.rejects(montar({workspace,output,apiBase:'http://127.0.0.1:8833',publicOrigin:'http://127.0.0.1:8834'}),/exist|novo/i);
  await assert.rejects(montar({workspace,output:join(workspace,'publicacao','m1-1a','fora'),apiBase:'https://api.test',publicOrigin:origin}),/destino/i);
});

test('site base com arquivo fora do inventário é recusado sem produzir publicação',async t=>{
  const workspace=await mkdtemp(join(tmpdir(),'tracking-inventory-'));t.after(()=>rm(workspace,{recursive:true,force:true}));
  const base=join(workspace,'base');await mkdir(base);await writeFile(join(base,'estado.json'),JSON.stringify({schema:1,arquivos:{}}));
  await writeFile(join(base,'dados-privados.json'),'privado');
  await assert.rejects(montar({workspace,output:join(workspace,'publicacao','rastreabilidade','rodada'),baseSite:base,apiBase:'https://api.test',publicOrigin:origin}),/inventário|inventario/i);
});

test('WhatsApp: só aparece com número; leva imóvel e link de compartilhar, sem recibo; o clique registra o lead',async()=>{
  const sem=browser();await boot(sem.win,sem.doc);assert.equal(sem.elements.whatsapp.hidden,true);
  const b=browser({whatsapp:'5516999990000'});await boot(b.win,b.doc);
  const wa=b.elements.whatsapp;assert.equal(wa.hidden,false);assert.equal(wa.textContent,'Falar com Corretor');
  const url=new URL(wa.href);assert.equal(url.origin+url.pathname,'https://wa.me/5516999990000');
  const text=url.searchParams.get('text');assert.match(text,/Imóvel <teste>/);
  assert.equal(new URL(text.slice(text.indexOf('http'))).searchParams.get('l'),child);assert.equal(text.includes('rrrr'),false);
  await wa.dispatch('click');await b.settle();
  assert.deepEqual(b.requests.filter(r=>r.path==='/leads').map(r=>r.body),[{visitId:'v'.repeat(32),receipt:opening().receipt,channel:'whatsapp'}]);
});

function browser({visible=true,deferredFrame=false,whatsapp=null}={}) {
  const makeStorage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key),map};};
  const emitter=()=>{const events=new Map();return {addEventListener:(type,fn)=>{const fs=events.get(type)||[];fs.push(fn);events.set(type,fs);},
    dispatch:async(type,data={})=>{for(const fn of events.get(type)||[])await fn(data);}};};
  const ids=['configRastreabilidade','estado','conteudo','consentimento','escolha','privacidade','aceitar','recusar','paginaMaquete','paginaTour','copiar','compartilhar','whatsapp','titulo'];
  const elements=Object.fromEntries(ids.map(id=>[id,{...emitter(),id,hidden:true,textContent:'',dataset:{},setAttribute(){},removeAttribute(){},focus(){}}]));
  elements.configRastreabilidade.textContent=JSON.stringify({apiBase:'https://api.test/',publicOrigin:origin});
  const anchors=[];const innerDoc={...emitter(),querySelectorAll:()=>anchors};
  const inner={location:new URL(origin+'/blank'),__maq:{modo:()=> 'maquete'}};
  const frame=elements.conteudo;frame.contentWindow=inner;frame.contentDocument={...emitter(),querySelectorAll:()=>[]};
  let requested;
  const loadFrame=()=>{inner.location=new URL(requested);frame.contentDocument=innerDoc;};
  Object.defineProperty(frame,'src',{set:value=>{requested=value;if(!deferredFrame)loadFrame();},get:()=>requested||inner.location.href});
  const doc={...emitter(),visibilityState:visible?'visible':'hidden',getElementById:id=>elements[id]};
  const requests=[],timers=[],clipboard=[];let clock=0;
  const win={...emitter(),location:new URL(origin+'/acesso.html?l='+token),crypto:globalThis.crypto,
    sessionStorage:makeStorage(),localStorage:makeStorage(),performance:{now:()=>clock},
    history:{replaceState:(_s,_t,url)=>{win.location=new URL(url);}},setInterval:fn=>timers.push(fn),
    navigator:{clipboard:{writeText:async text=>clipboard.push(text)}},
    fetch:async(url,options)=>{const body=JSON.parse(options.body);requests.push({path:new URL(url).pathname,body});
      const result=new URL(url).pathname==='/open'?{...opening(),contact:{brokerName:'Corretor',whatsappNumber:whatsapp}}
        :new URL(url).pathname==='/sessions'?{sessionId:'s'.repeat(32),nextSeq:1}:{accepted:true,seq:body.seq};
      return {ok:true,json:async()=>result};}};
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  return {win,doc,elements,requests,timers,clipboard,anchors,inner,loadFrame,settle,setNow:value=>{clock=value;}};
}

test('page visible abre apenas uma vez; sem aceite não há identidade nem métricas; cópia só leva filho',async()=>{
  const b=browser({visible:false});await boot(b.win,b.doc);assert.equal(b.requests.length,0);
  b.doc.visibilityState='visible';await b.doc.dispatch('visibilitychange');await b.settle();
  assert.equal(b.requests.filter(r=>r.path==='/open').length,1);
  await b.win.dispatch('pageshow');await b.doc.dispatch('visibilitychange');
  await b.elements.conteudo.dispatch('load');
  await b.elements.recusar.dispatch('click');b.setNow(15000);b.timers[0]();await b.settle();
  assert.equal(b.requests.length,1);assert.equal(b.win.localStorage.map.size,0);
  await b.elements.copiar.dispatch('click');
  const shared=new URL(b.clipboard[0]);assert.equal(shared.searchParams.get('l'),child);assert.equal(shared.searchParams.has('receipt'),false);
});

test('aceite cria sessão; heartbeat para quando a aba oculta e revogação limpa identidade',async()=>{
  const b=browser();await boot(b.win,b.doc);await b.elements.conteudo.dispatch('load');
  await b.elements.aceitar.dispatch('click');await b.settle();
  assert.equal(b.requests.filter(r=>r.path==='/sessions').length,1);
  assert.equal(b.win.localStorage.map.size,1);
  b.setNow(15000);b.timers[0]();await b.settle();
  assert.equal(b.requests.at(-1).body.type,'heartbeat');assert.equal(b.requests.at(-1).body.activeMs,15000);
  b.setNow(20000);b.doc.visibilityState='hidden';await b.doc.dispatch('visibilitychange');await b.settle();
  const count=b.requests.length;b.setNow(50000);b.timers[0]();await b.settle();assert.equal(b.requests.length,count);
  await b.elements.recusar.dispatch('click');assert.equal(b.win.localStorage.map.size,0);
  assert.equal([...b.win.sessionStorage.map.keys()].some(k=>k.startsWith('tracking.analytics.')),false);
});

test('sessão expirada retoma a escolha e abre outra sessão sem criar outro encaminhamento',async()=>{
  const b=browser(),fetch=b.win.fetch;let expired=false,sessions=0;
  b.win.fetch=async(url,options)=>{
    const path=new URL(url).pathname,body=JSON.parse(options.body);
    if(path==='/events'&&body.type==='heartbeat'&&!expired){expired=true;b.requests.push({path,body});return{ok:false,status:410,json:async()=>({error:'Sessão expirada',code:'SESSION_EXPIRED'})};}
    if(path==='/sessions'){sessions++;b.requests.push({path,body});return{ok:true,json:async()=>({sessionId:(sessions===1?'s':'t').repeat(32),nextSeq:1})};}
    return fetch(url,options);
  };
  await boot(b.win,b.doc);await b.elements.conteudo.dispatch('load');await b.elements.aceitar.dispatch('click');await b.settle();
  b.setNow(15000);b.timers[0]();await b.settle();await b.settle();
  assert.equal(b.requests.filter(r=>r.path==='/open').length,1);
  assert.equal(sessions,2);
  assert.equal(b.requests.at(-1).body.sessionId,'t'.repeat(32));
  assert.equal(b.requests.at(-1).body.seq,1);
  assert.equal(new URL(b.win.location).searchParams.get('l'),child);
});

function delayedFirstSession(b) {
  const fetch=b.win.fetch;let release,count=0;
  const waiting=new Promise(resolve=>{release=resolve;});
  b.win.fetch=async(url,options)=>{
    if(new URL(url).pathname==='/sessions') {
      count++;b.requests.push({path:'/sessions',body:JSON.parse(options.body)});
      if(count===1)await waiting;
      return{ok:true,json:async()=>({sessionId:(count===1?'s':'t').repeat(32),nextSeq:1})};
    }
    return fetch(url,options);
  };
  return release;
}

test('recusar durante criação de sessão impede resposta atrasada de restaurar identidade/coleta',async()=>{
  const b=browser(),release=delayedFirstSession(b);await boot(b.win,b.doc);await b.elements.conteudo.dispatch('load');
  await b.elements.aceitar.dispatch('click');await b.settle();
  await b.elements.recusar.dispatch('click');release();await b.settle();await b.settle();
  assert.equal(b.win.localStorage.map.size,0);
  assert.equal(b.requests.some(r=>r.path==='/events'),false);
  assert.equal([...b.win.sessionStorage.map.keys()].some(k=>k.startsWith('tracking.analytics.')),false);
});

test('recusar e reaceitar antes da resposta cria sessão da identidade nova, sem ressuscitar a antiga',async()=>{
  const b=browser(),release=delayedFirstSession(b);await boot(b.win,b.doc);await b.elements.conteudo.dispatch('load');
  await b.elements.aceitar.dispatch('click');await b.settle();
  const first=b.requests.find(r=>r.path==='/sessions').body.visitorKey;
  await b.elements.recusar.dispatch('click');await b.elements.aceitar.dispatch('click');release();await b.settle();await b.settle();
  const sessions=b.requests.filter(r=>r.path==='/sessions');assert.equal(sessions.length,2);
  assert.notEqual(sessions[1].body.visitorKey,first);
  assert.equal(b.requests.filter(r=>r.path==='/events').every(r=>r.body.sessionId==='t'.repeat(32)),true);
});

test('API tardia aplica planta2d realmente uma vez antes de sobrescrever a barra; bfcache não reinicializa',async()=>{
  const b=browser();b.win.location.searchParams.set('pagina','maquete');b.win.location.searchParams.set('modo','planta2d');b.win.location.hash='#vista';
  delete b.inner.__maq;await boot(b.win,b.doc);await b.elements.conteudo.dispatch('load');
  b.timers[0]();assert.equal(b.win.location.searchParams.get('modo'),'planta2d');
  let mode='maquete',calls=0;b.inner.__maq={modo:()=>mode,vaiPara:next=>{mode=next;calls++;}};
  b.timers[0]();assert.equal(mode,'planta2d');assert.equal(calls,1);
  assert.equal(b.win.location.searchParams.get('modo'),'planta2d');
  mode='visita';await b.win.dispatch('pageshow');b.timers[0]();assert.equal(calls,1);
  assert.equal(b.win.location.searchParams.get('modo'),'visita');
});

test('target blank conserva abertura nova aba com href rastreável',async()=>{
  const b=browser();const anchor={href:origin+opening().destinations.tour,target:'_blank',dataset:{}};b.anchors.push(anchor);
  await boot(b.win,b.doc);await b.elements.conteudo.dispatch('load');const before=b.elements.conteudo.src;
  let prevented=false;await b.elements.conteudo.contentDocument.dispatch('click',{button:0,target:{closest:()=>anchor},preventDefault:()=>{prevented=true;},stopImmediatePropagation(){}});
  assert.equal(prevented,false);assert.equal(b.elements.conteudo.src,before);
  assert.equal(new URL(anchor.href).searchParams.get('l'),child);
});

test('saída para frame externo não retoma coleta com interação, visibilidade ou pageshow no wrapper',async()=>{
  const b=browser();await boot(b.win,b.doc);await b.elements.conteudo.dispatch('load');await b.elements.aceitar.dispatch('click');await b.settle();
  b.inner.location=new URL('https://externo.test/');await b.elements.conteudo.dispatch('load');await b.settle();
  const before=b.requests.length;
  await b.doc.dispatch('pointerdown');b.doc.visibilityState='hidden';await b.doc.dispatch('visibilitychange');
  b.doc.visibilityState='visible';await b.doc.dispatch('visibilitychange');await b.win.dispatch('pageshow');
  b.setNow(15000);b.timers[0]();await b.settle();assert.equal(b.requests.length,before);
});

test('aceite antes do frame carregar inicia quando destino aprovado chega, mesmo sem novo load',async()=>{
  const b=browser({deferredFrame:true});await boot(b.win,b.doc);await b.elements.aceitar.dispatch('click');await b.settle();
  assert.equal(b.requests.filter(r=>r.path==='/sessions').length,0);
  b.loadFrame();b.timers[0]();await b.settle();
  assert.equal(b.requests.filter(r=>r.path==='/sessions').length,1);
  b.setNow(1000);b.timers[0]();await b.settle();assert.equal(b.requests.filter(r=>r.path==='/sessions').length,1);
});

test('escolha yes guardada no reload inicia apenas após frame aprovado e não reinicia em ticks',async()=>{
  const b=browser({deferredFrame:true});b.win.sessionStorage.setItem('tracking.choice.v1.cedros-37','yes');await boot(b.win,b.doc);
  assert.equal(b.requests.filter(r=>r.path==='/sessions').length,0);
  b.loadFrame();await b.elements.conteudo.dispatch('load');await b.settle();
  for(const time of [1000,5000,15000]){b.setNow(time);b.timers[0]();await b.settle();}
  assert.equal(b.requests.filter(r=>r.path==='/sessions').length,1);
  assert.equal(b.requests.at(-1).body.type,'heartbeat');
});

test('falha ao criar sessão aguarda retry e não solicita a cada tick',async()=>{
  const b=browser(),fetch=b.win.fetch;let attempts=0;
  b.win.fetch=async(url,options)=>{if(new URL(url).pathname==='/sessions'){attempts++;if(attempts===1)return{ok:false,status:503,json:async()=>({error:'indisponível'})};}return fetch(url,options);};
  await boot(b.win,b.doc);await b.elements.conteudo.dispatch('load');await b.elements.aceitar.dispatch('click');await b.settle();
  for(const time of [1000,2000,5000,14999]){b.setNow(time);b.timers[0]();await b.settle();}
  assert.equal(attempts,1);
  b.setNow(15000);b.timers[0]();await b.settle();assert.equal(attempts,2);
});

test('retorno de frame aprovado restaura visibilidade uma vez e preserva pausa idle de 60s',async()=>{
  const b=browser();await boot(b.win,b.doc);await b.elements.conteudo.dispatch('load');await b.elements.aceitar.dispatch('click');await b.settle();
  b.inner.location=new URL('https://externo.test/');await b.elements.conteudo.dispatch('load');
  b.setNow(10000);b.loadFrame();await b.elements.conteudo.dispatch('load');await b.settle();
  for(const time of [25000,40000,55000,70001]){b.setNow(time);b.timers[0]();await b.settle();}
  assert.equal(b.requests.at(-1).body.type,'pause');
  const before=b.requests.length;b.setNow(90000);b.timers[0]();await b.settle();assert.equal(b.requests.length,before);
});
