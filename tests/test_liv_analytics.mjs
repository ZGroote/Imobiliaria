import test from 'node:test';
import assert from 'node:assert/strict';
import {installLivAnalytics} from '../rastreabilidade/public/liv-analytics.mjs';

function target(extra={}) {
  const events=new Map();
  return {events,...extra,
    addEventListener(name,fn){const list=events.get(name)||[];list.push(fn);events.set(name,list);},
    removeEventListener(name,fn){events.set(name,(events.get(name)||[]).filter(item=>item!==fn));},
    fire(name,event={}){for(const fn of [...(events.get(name)||[])])fn({type:name,...event});}};
}
function node(tag) {
  const value=target({tag,children:[],style:{},hidden:false,attributes:{},parent:null,
    setAttribute(key,text){this.attributes[key]=text;},
    append(...items){for(const item of items){item.parent=this;this.children.push(item);}},
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);},
    focus(){this.focused=true;}});
  return value;
}
function fixture({version='novo',measurementId='G-TEST123',initialChoice=null,nativeTag=false,mobile=null}={}) {
  let time=0,cookie='_ga=old; _ga_TEST123=old; preference=ok';
  const stored=new Map(initialChoice?[['liv.analytics.choice.v1',initialChoice]]:[]),commands=[],loads=[],cookieWrites=[];
  const makeDocument=()=>target({visibilityState:'visible',body:node('body'),head:node('head'),frames:[],ids:new Map(),
    createElement:node,getElementById(id){return this.ids.get(id);},querySelectorAll(selector){assert.equal(selector,'iframe');return this.frames;}});
  const doc=makeDocument();
  const media=target({matches:mobile});
  if(mobile!==null)doc.ids.set('projectPanelDetails',node('div'));
  Object.defineProperty(doc,'cookie',{get:()=>cookie,set:value=>cookieWrites.push(value)});
  const href='https://visita.test/liv-novo/maquete-liv-ipanema.html?email=secret@example.com&apartamento=908#position=3,4,5';
  const timers=new Map();let timerId=0;
  const win=target({location:new URL(href),performance:{now:()=>time},
    localStorage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)},
    __livViewer:{ready:true,mode:'maquete',selectedUnitId:'908',position:[3,4,5]},
    setInterval(fn){timers.set(++timerId,fn);return timerId;},clearInterval:id=>timers.delete(id)});
  if(mobile!==null)win.matchMedia=()=>media;
  const options={win,doc,version,measurementId,send:(...args)=>commands.push(args)};
  if(!nativeTag)options.loadTag=payload=>loads.push(payload.measurementId);
  const api=installLivAnalytics(options);
  function tick(ms) {const end=time+ms;while(time<end){time=Math.min(time+1000,end);for(const fn of [...timers.values()])fn();}}
  return {api,doc,win,commands,loads,stored,cookieWrites,media,
    advance(ms){time+=ms;},tick,
    hidden(value){doc.visibilityState=value?'hidden':'visible';doc.fire('visibilitychange');},
    section(value){win.__livViewer.mode=value;tick(1000);},
    activity:()=>doc.fire('pointermove'),
    events:name=>commands.filter(args=>args[0]==='event'&&args[1]===name).map(args=>args[2]),
    addFrame(parentDoc=doc,{origin=win.location.origin}={}) {
      const childDoc=makeDocument(),childWin={location:{origin},document:childDoc};
      const frame=target({contentWindow:childWin,contentDocument:childDoc});parentDoc.frames.push(frame);
      return {frame,win:childWin,doc:childDoc};
    }};
}

test('configuração ausente, inválida ou versão desconhecida não cria UI, rede ou armazenamento',()=>{
  for(const options of [{measurementId:''},{measurementId:'G-OK&leak=1'},{measurementId:'UA-OLD'},{version:'user-supplied'}]) {
    const f=fixture(options);assert.deepEqual(f.api,{enabled:false});
    assert.equal(f.doc.body.children.length,0);assert.equal(f.commands.length,0);assert.equal(f.loads.length,0);
    assert.equal(f.stored.size,0);assert.equal(f.win.dataLayer,undefined);
  }
});

test('antes do aceite e na recusa não carrega Google, não cria identidade e não envia eventos',()=>{
  const f=fixture();f.tick(30000);f.activity();
  assert.equal(f.doc.body.children.length,2);assert.equal(f.commands.length,0);assert.equal(f.loads.length,0);
  assert.equal(f.win.dataLayer,undefined);assert.equal(f.stored.size,0);
  f.api.reject();f.tick(90000);f.activity();
  assert.equal(f.commands.length,0);assert.equal(f.loads.length,0);assert.equal(f.win.dataLayer,undefined);
  assert.deepEqual([...f.stored],[['liv.analytics.choice.v1','no']]);
});

test('celular abre sem aviso, faixa reservada ou aceite automático',()=>{
  const f=fixture({version:'classico',mobile:true});
  assert.equal(f.doc.body.children[0].hidden,true);
  assert.equal(f.doc.body.children[1].hidden,true);
  assert.equal(f.doc.body.style.paddingBottom,'0px');
  assert.equal(f.api.getState().choice,null);
  f.tick(600000);assert.equal(f.loads.length,0);assert.equal(f.commands.length,0);assert.equal(f.stored.size,0);
  const settings=f.doc.getElementById('projectPanelDetails').children[0];assert.equal(settings.hidden,false);
  settings.fire('click');assert.equal(f.doc.body.children[0].hidden,false);
});

test('preferências no celular permitem aceitar e revogar sem botão flutuante',()=>{
  const f=fixture({version:'classico',mobile:true});
  f.api.showConsent();f.api.accept();assert.equal(f.loads.length,1);assert.equal(f.stored.get('liv.analytics.choice.v1'),'yes');
  assert.equal(f.doc.body.children[0].hidden,true);assert.equal(f.doc.body.children[1].hidden,true);
  f.api.showConsent();f.api.revoke();assert.equal(f.api.getState().choice,'no');assert.equal(f.stored.get('liv.analytics.choice.v1'),'no');
  assert.ok(f.cookieWrites.length>0);assert.equal(f.doc.body.style.paddingBottom,'0px');
});

test('celular respeita escolha anterior e desktop mantém o aviso sem aceitar por mudança de tela',()=>{
  const accepted=fixture({version:'classico',mobile:true,initialChoice:'yes'});
  assert.equal(accepted.loads.length,1);assert.equal(accepted.doc.body.children[0].hidden,true);
  const f=fixture({version:'classico',mobile:true});f.media.matches=false;f.media.fire('change');
  assert.equal(f.doc.body.children[0].hidden,false);assert.equal(f.doc.body.children[1].hidden,false);
  assert.equal(f.loads.length,0);assert.equal(f.stored.size,0);
});

test('tag carrega apenas após consentimento e configuração desliga publicidade e pageview automático',()=>{
  const f=fixture();f.api.accept();
  assert.deepEqual(f.loads,['G-TEST123']);
  const config=f.commands.find(args=>args[0]==='config');
  assert.equal(config[2].send_page_view,false);assert.equal(config[2].allow_google_signals,false);
  assert.equal(config[2].allow_ad_personalization_signals,false);
  const consent=f.commands.filter(args=>args[0]==='consent');
  assert.equal(consent[0][1],'default');assert.equal(consent[0][2].analytics_storage,'denied');
  assert.equal(consent[1][2].analytics_storage,'granted');assert.equal(consent[1][2].ad_storage,'denied');
  assert.deepEqual([...f.stored],[['liv.analytics.choice.v1','yes']]);
  f.api.accept();assert.equal(f.loads.length,1);assert.equal(f.events('page_view').length,1);
});

test('pageviews correspondem à entrada e mudança de seção, nunca ao heartbeat ou retorno de inatividade',()=>{
  const f=fixture();f.api.accept();f.tick(30000);
  assert.equal(f.events('page_view').length,1);assert.equal(f.events('liv_active_time').length,2);
  f.section('planta2d');f.tick(15000);f.section('visita');f.tick(90000);f.activity();f.tick(1000);
  assert.deepEqual(f.events('page_view').map(event=>event.liv_section),['maquete','planta2d','visita']);
  assert.ok(f.events('liv_active_time').every(event=>Number.isInteger(event.active_ms)&&event.active_ms>0&&event.active_ms<=30000));
});

test('aberturas consentidas são distintas de pageviews e não duplicam em heartbeat, seção ou novo aceite',()=>{
  for(const version of ['novo','classico']) {
    const f=fixture({version});f.win.__livViewer.ready=false;f.tick(15000);
    assert.equal(f.events('liv_entry').length,0);f.api.accept();
    assert.deepEqual(f.events('liv_entry'),[{liv_version:version,page_location:`https://visita.test/liv-${version}/`,
      page_title:`Liv ${version} — entrada`,page_referrer:'',send_to:'G-TEST123'}]);
    assert.equal(f.events('page_view').length,0);
    f.win.__livViewer.ready=true;f.tick(15000);f.section('visita');f.tick(30000);f.api.revoke();f.api.accept();
    assert.equal(f.events('liv_entry').length,1);
  }
});

test('cada versão usa parâmetros e páginas virtuais distintos, sem query, hash, referrer ou dados do apartamento',()=>{
  for(const version of ['novo','classico']) {
    const f=fixture({version});f.api.accept();f.tick(15000);f.section('visita');
    const serialized=JSON.stringify(f.commands);
    for(const secret of ['secret@example.com','908','position','apartamento','email='])assert.equal(serialized.includes(secret),false);
    for(const event of [...f.events('page_view'),...f.events('liv_active_time')]) {
      assert.equal(event.liv_version,version);assert.equal(event.page_referrer,'');
      assert.ok(event.page_location.startsWith(`https://visita.test/liv-${version}/`));
      assert.equal(event.page_location.includes('?'),false);assert.equal(event.page_location.includes('#'),false);
      assert.match(event.page_title,new RegExp(`^Liv ${version} — `));
    }
  }
});

test('tempo ativo pausa quando a aba fica oculta e recomeça sem incluir o intervalo oculto',()=>{
  const f=fixture();f.api.accept();f.tick(7000);f.hidden(true);f.tick(120000);f.activity();
  assert.equal(f.events('liv_active_time').reduce((total,event)=>total+event.active_ms,0),7000);
  f.hidden(false);f.tick(15000);
  assert.equal(f.events('liv_active_time').reduce((total,event)=>total+event.active_ms,0),22000);
  assert.equal(f.events('page_view').length,1);
});

test('sem interação a contagem para aos 60 segundos e atividade real retoma a mesma seção',()=>{
  const f=fixture();f.api.accept();f.tick(120000);
  assert.equal(f.events('liv_active_time').reduce((total,event)=>total+event.active_ms,0),60000);
  f.activity();f.tick(15000);
  assert.equal(f.events('liv_active_time').reduce((total,event)=>total+event.active_ms,0),75000);
  assert.equal(f.events('page_view').length,1);
});

test('ficha e mapa substituem a seção principal sem enviar seleção de unidade',()=>{
  const f=fixture();f.api.accept();
  f.doc.ids.set('unitDetails',{open:true});f.tick(1000);
  f.doc.ids.set('mapPanel',{open:true});f.win.__livViewer.mapReady=true;f.tick(1000);
  f.doc.ids.get('mapPanel').open=false;f.doc.ids.get('unitDetails').open=false;f.tick(1000);
  assert.deepEqual(f.events('page_view').map(event=>event.liv_section),['maquete','ficha','mapa','maquete']);
});

test('carregando não fabrica pageviews e a primeira seção pronta é registrada uma vez',()=>{
  const f=fixture();f.win.__livViewer.ready=false;f.api.accept();f.tick(20000);
  assert.equal(f.events('page_view').length,0);assert.equal(f.events('liv_active_time').length,0);
  f.win.__livViewer.ready=true;f.tick(1000);
  assert.equal(f.events('page_view').length,1);assert.equal(f.events('page_view')[0].liv_section,'maquete');
});

test('atividade em iframe same-origin aninhado retoma métricas, com limite de profundidade e sem listeners duplicados',()=>{
  const f=fixture();const first=f.addFrame(),second=f.addFrame(first.doc),third=f.addFrame(second.doc),fourth=f.addFrame(third.doc);
  const external=f.addFrame(f.doc,{origin:'https://external.test'});
  f.api.accept();f.tick(90000);
  assert.equal(first.doc.events.get('pointermove').length,1);assert.equal(second.doc.events.get('pointermove').length,1);
  assert.equal(third.doc.events.get('pointermove').length,1);assert.equal(fourth.doc.events.has('pointermove'),false);
  assert.equal(external.doc.events.has('pointermove'),false);
  third.doc.fire('pointerdown');f.tick(15000);
  assert.equal(f.events('liv_active_time').reduce((total,event)=>total+event.active_ms,0),75000);
});

test('revogar interrompe eventos, desativa GA e apaga cookies, com novo aceite sem reinjetar tag',()=>{
  const f=fixture();f.api.accept();f.tick(15000);f.api.revoke();
  assert.equal(f.win['ga-disable-G-TEST123'],true);
  const count=f.commands.length;f.tick(45000);f.activity();assert.equal(f.commands.length,count);
  assert.ok(f.cookieWrites.some(value=>value.startsWith('_ga=; Max-Age=0;')));
  assert.ok(f.cookieWrites.some(value=>value.startsWith('_ga_TEST123=; Max-Age=0;')));
  assert.equal(f.cookieWrites.some(value=>value.startsWith('preference=')),false);
  assert.equal(f.commands.at(-1)[2].analytics_storage,'denied');
  f.api.accept();assert.equal(f.loads.length,1);assert.equal(f.win['ga-disable-G-TEST123'],false);
});

test('revogação em outra aba sincroniza a escolha e encerra os envios locais',()=>{
  const f=fixture();f.api.accept();f.tick(15000);
  f.win.fire('storage',{key:'other-preference',newValue:'no'});assert.equal(f.api.getState().choice,'yes');
  f.win.fire('storage',{key:'liv.analytics.choice.v1',newValue:'no'});
  assert.equal(f.api.getState().choice,'no');assert.equal(f.win['ga-disable-G-TEST123'],true);
  const count=f.commands.length;f.tick(30000);f.section('visita');assert.equal(f.commands.length,count);
  f.win.fire('storage',{key:'liv.analytics.choice.v1',newValue:'yes'});
  assert.equal(f.api.getState().choice,'yes');assert.equal(f.loads.length,1);
  f.win.fire('storage',{key:'liv.analytics.choice.v1',newValue:null});
  assert.equal(f.api.getState().choice,'no');
});

test('escolha persistida respeita recusa e aceite sem cadastrar visitante',()=>{
  const no=fixture({initialChoice:'no'});assert.equal(no.loads.length,0);assert.equal(no.doc.body.children[0].hidden,true);
  const yes=fixture({initialChoice:'yes'});assert.equal(yes.loads.length,1);assert.equal(yes.events('page_view').length,1);
  assert.equal(yes.stored.size,1);
});

test('preferências podem ser abertas e fechadas sem revogar nem forçar o aceite',()=>{
  const f=fixture();f.api.accept();f.api.showConsent();const box=f.doc.body.children[0];
  assert.equal(box.hidden,false);const close=box.children.find(item=>item.textContent==='Fechar');close.fire('click');
  assert.equal(box.hidden,true);assert.equal(f.api.getState().choice,'yes');
  f.api.revoke();f.api.showConsent();close.fire('click');assert.equal(f.api.getState().choice,'no');
});

test('uma página em iframe não instala a coleta nem a interface',()=>{
  const f=fixture();f.api.destroy();f.win.top={};
  const result=installLivAnalytics({win:f.win,doc:f.doc,measurementId:'G-TEST123',version:'novo'});
  assert.deepEqual(result,{enabled:false});assert.equal(f.doc.body.children.length,0);assert.equal(f.loads.length,0);
});

test('carregador padrão injeta o script com id validado somente após aceite',()=>{
  const f=fixture({nativeTag:true});assert.equal(f.doc.head.children.length,0);f.api.accept();
  assert.equal(f.doc.head.children.length,1);const script=f.doc.head.children[0];
  assert.equal(script.tag,'script');assert.equal(script.async,true);assert.equal(script.referrerPolicy,'no-referrer');
  assert.equal(script.src,'https://www.googletagmanager.com/gtag/js?id=G-TEST123');
});

test('destroy remove timers e listeners sem deixar contagem do tempo em segundo plano',()=>{
  const f=fixture();f.api.accept();f.tick(1000);f.api.destroy();const count=f.commands.length;
  f.tick(30000);f.activity();assert.equal(f.commands.length,count);assert.equal(f.doc.body.children.length,0);
  assert.equal(f.doc.events.get('pointermove').length,0);assert.equal(f.win.__livAnalytics,undefined);
});
