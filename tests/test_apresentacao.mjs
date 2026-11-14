import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../experimentos/apresentacao-2026-11-01/site/site.js',import.meta.url),'utf8');
const unit='vila-aurora/pavimento-modelo-03/final-04';
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

function setup({cache={readyScenes:['exterior','interior:canto','interior:meio'],plans:{plans:{canto:{ready:true},meio:{ready:true}}}},prepare=()=>Promise.resolve(true),reducedMotion=true}={}){
  let document,now=1000,serial=0;
  const intervals=new Map();
  const observers=new Map();
  const tasks=[];
  class Element{
    constructor(){this.dataset={};this.attrs=new Map();this.listeners=new Map();this.children=new Map();this.hidden=false;this.disabled=false;this.open=true;this.srcWrites=0;this.value=0;this.textContent='';}
    querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Element());return this.children.get(selector);}
    querySelectorAll(){return [];}
    addEventListener(type,handler){const handlers=this.listeners.get(type)||[];handlers.push(handler);this.listeners.set(type,handlers);}
    emit(type,extra={}){for(const handler of this.listeners.get(type)||[])handler({target:this,preventDefault(){},...extra});}
    click(){if(!this.disabled)this.emit('click');}
    setAttribute(key,value){this.attrs.set(key,String(value));}
    getAttribute(key){return this.attrs.get(key)??null;}
    removeAttribute(key){this.attrs.delete(key);}
    set src(value){this.srcWrites++;this.setAttribute('src',value);}
    get src(){return this.getAttribute('src');}
    focus(){document.activeElement=this;}
    contains(element){return element===this||[...this.children.values()].includes(element);}
    matches(selector){return selector===':modal'&&this.modal;}
    close(){this.open=false;this.modal=false;tasks.push(()=>this.emit('close'));}
    show(){this.open=true;this.modal=false;}
    showModal(){this.open=true;this.modal=true;}
    animate(){return {cancel(){},finished:Promise.resolve()};}
  }
  const elements=new Map();
  const find=selector=>{
    if(selector==='.abertura-planta')return null;
    if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);
  };
  const tabs=['predio','planta','apartamento','tour'].map(modo=>Object.assign(new Element(),{dataset:{modo}}));
  const preparation=tabs.map(tab=>Object.assign(new Element(),{dataset:{preparo:tab.dataset.modo}}));
  const documentEvents=new Element(),windowEvents=new Element();
  document={body:new Element(),hidden:false,activeElement:null,querySelector:find,querySelectorAll:selector=>selector===".abas [role='tab']"?tabs:selector==='[data-preparo]'?preparation:[],
    addEventListener:(type,handler)=>documentEvents.addEventListener(type,handler)};
  const janela=find('.janela');janela.dataset={estado:'inicial',ativa:'false'};
  const iframe=janela.querySelector('iframe');iframe.contentWindow={};iframe.contentDocument=new Element();
  const calls=[],warmCalls=[];
  const api={ready:true,error:null,mode:'maquete',selectedUnitId:null,frame:{contentWindow:{document:new Element(),__livProva:{controls:{autoRotate:false}}}},units:{units:[{id:unit,relation:{orientation:'original',typology:'canto'}}]},
    selectUnit(id){calls.push(['select',id]);this.selectedUnitId=id;return true;},
    async setMode(mode){calls.push(['mode',mode]);this.mode=mode;this.ready=true;return true;},
    prepareViews(options){warmCalls.push(options);return prepare();},getCacheState(){return cache;}};
  runInNewContext(source,{document,window:windowEvents,navigator:{},location:{href:'http://localhost/'},URL,Date:class extends Date{static now(){return now;}},
    sessionStorage:{removeItem(){}},matchMedia:()=>({matches:reducedMotion}),
    IntersectionObserver:class{constructor(callback){this.callback=callback;}observe(target){observers.set(target,this.callback);}unobserve(target){observers.delete(target);}},
    setInterval(callback){const id=++serial;intervals.set(id,callback);return id;},clearInterval(id){intervals.delete(id);}});
  return {janela,iframe,api,calls,warmCalls,cache,preparation,tabs,find,active:()=>document.activeElement,
    window:windowEvents,intervalCount:()=>intervals.size,advance:milliseconds=>{now+=milliseconds;},
    inView(value){observers.get(janela)?.([{target:janela,isIntersecting:value}]);},
    hidden(value){document.hidden=value;documentEvents.emit('visibilitychange');},
    button:selector=>janela.querySelector(selector),
    async ready(){iframe.contentWindow={__livViewer:api};iframe.emit('load');await this.tick();},
    async tick(){for(const callback of intervals.values())callback();await flush();},
    async tasks(){while(tasks.length)tasks.shift()();await flush();}};
}

test('maquete começa automaticamente e clicar não reinicia o carregamento',async()=>{
  const f=setup();
  assert.equal(f.iframe.srcWrites,1,'inicia antes do primeiro clique');
  f.tabs[1].click();assert.equal(f.iframe.srcWrites,1,'trocar etapa não recria o documento');
  f.button('.janela-ativar').click();
  assert.equal(f.janela.dataset.estado,'carregando');
  await f.ready();
  assert.equal(f.janela.dataset.estado,'pronta');
  assert.equal(f.api.mode,'planta2d');
  const calls=f.calls.length;
  f.tabs[1].click();await f.tick();
  assert.equal(f.iframe.srcWrites,1);
  assert.equal(f.calls.length,calls);
});

test('apresentação tem um único visualizador e navega sem a antiga animação da abertura',async()=>{
  const html=readFileSync(new URL('../experimentos/apresentacao-2026-11-01/site/index.html',import.meta.url),'utf8');
  assert.equal((html.match(/<iframe\b/gi)||[]).length,1,'a experiência não duplica contextos da maquete');
  const f=setup();assert.equal(f.find('.abertura-planta'),null);
  await f.ready();f.tabs[1].click();await f.tick();
  assert.equal(f.api.mode,'planta2d');assert.equal(f.janela.dataset.estado,'pronta');
  assert.equal(f.iframe.srcWrites,1);
});

test('planta, apartamento e tour reutilizam o iframe e a unidade escolhida',async()=>{
  const f=setup();f.button('.janela-ativar').click();await f.ready();
  f.api.selectedUnitId='unidade-escolhida';
  f.api.units.units.push({id:'unidade-escolhida',relation:{orientation:'original',typology:'meio'}});
  for(const [index,mode] of [[1,'planta2d'],[2,'planta3d'],[3,'visita'],[0,'maquete']]){
    f.tabs[index].click();await f.tick();assert.equal(f.api.mode,mode);
  }
  assert.equal(f.iframe.srcWrites,1);
  assert.equal(f.api.selectedUnitId,'unidade-escolhida');
  assert.ok(f.calls.every(([kind])=>kind==='mode'),'não substitui a seleção do visitante');
});

test('aguarda os vínculos das plantas antes de selecionar a unidade',async()=>{
  const f=setup();delete f.api.units.units[0].relation;
  f.tabs[1].click();f.button('.janela-ativar').click();await f.ready();
  assert.equal(f.janela.dataset.estado,'carregando');assert.deepEqual(f.calls,[]);
  f.api.units.units[0].relation={orientation:'original',typology:'canto'};
  await f.tick();
  assert.deepEqual(f.calls,[['select',unit],['mode','planta2d']]);
  assert.equal(f.janela.dataset.estado,'pronta');
});

test('escolhas rápidas terminam na última etapa sem sobrepor transições',async()=>{
  const f=setup();f.button('.janela-ativar').click();await f.ready();
  let release;
  f.api.setMode=async function(mode){
    f.calls.push(['mode',mode]);this.ready=false;
    if(mode==='planta2d')await new Promise(resolve=>{release=resolve;});
    this.mode=mode;this.ready=true;return true;
  };
  f.tabs[1].click();await flush();
  f.tabs[2].click();f.tabs[3].click();await f.tick();
  assert.deepEqual(f.calls.filter(([kind])=>kind==='mode'),[['mode','planta2d']]);
  release();await flush();await f.tick();
  assert.equal(f.api.mode,'visita');assert.equal(f.janela.dataset.estado,'pronta');
  assert.deepEqual(f.calls.filter(([kind])=>kind==='mode'),[['mode','planta2d'],['mode','visita']]);
});

test('tentar novamente espera o novo documento em vez de reler a falha antiga',async()=>{
  const f=setup();f.button('.janela-ativar').click();await f.ready();
  f.api.error='falha de GPU';f.api.ready=false;await f.tick();
  assert.equal(f.janela.dataset.estado,'erro');assert.equal(f.button('.janela-repetir').hidden,false);
  f.button('.janela-repetir').click();
  // O documento antigo continua acessível enquanto a navegação não conclui.
  assert.equal(f.janela.dataset.estado,'carregando');
  await f.tick();assert.equal(f.janela.dataset.estado,'carregando');
  f.api.error=null;f.api.ready=true;await f.ready();
  assert.equal(f.janela.dataset.estado,'pronta');assert.equal(f.iframe.srcWrites,2);
});

test('ampliar e retornar mantêm o iframe, seleção e foco de retorno',async()=>{
  const f=setup();f.button('.janela-ativar').click();await f.ready();
  f.api.selectedUnitId=unit;
  f.button('.janela-tela-cheia').click();await f.tasks();
  assert.equal(f.janela.modal,true);assert.equal(f.janela.getAttribute('aria-modal'),'true');
  f.button('.maquete-voltar').click();await f.tasks();
  assert.equal(f.janela.open,true);assert.equal(f.janela.modal,false);
  assert.equal(f.janela.getAttribute('aria-modal'),null);
  assert.equal(f.iframe.srcWrites,1);assert.equal(f.api.selectedUnitId,unit);
  assert.equal(f.active(),f.button('.janela-tela-cheia'));
});

test('teclado navega pelas etapas com foco móvel sem reiniciar o preload',()=>{
  const f=setup();let prevented=0;
  f.tabs[0].focus();
  const key=key=>f.find('.abas').emit('keydown',{key,preventDefault(){prevented++;}});
  key('ArrowLeft');assert.equal(f.active(),f.tabs[3]);
  assert.equal(f.tabs[3].getAttribute('aria-selected'),'true');
  key('Home');assert.equal(f.active(),f.tabs[0]);
  key('End');assert.equal(f.active(),f.tabs[3]);
  key('ArrowRight');assert.equal(f.active(),f.tabs[0]);
  assert.equal(prevented,4);
  assert.equal(f.tabs.filter(tab=>tab.tabIndex===0).length,1);
  assert.equal(f.find('#painel-demonstracao').getAttribute('aria-labelledby'),'aba-predio');
  assert.equal(f.iframe.srcWrites,1);
});

test('escolher outra etapa após falha carrega um novo documento',async()=>{
  const f=setup();f.button('.janela-ativar').click();await f.ready();
  f.api.error='falha no prédio';f.api.ready=false;await f.tick();
  assert.equal(f.janela.dataset.estado,'erro');
  f.tabs[3].click();
  assert.equal(f.iframe.srcWrites,2);
  await f.tick();assert.equal(f.janela.dataset.estado,'carregando','ignora a falha do documento anterior');
  f.api.error=null;f.api.ready=true;await f.ready();
  assert.equal(f.api.mode,'visita');assert.equal(f.janela.dataset.estado,'pronta');
});

test('retorno pelo histórico reinicia um único monitor sem recarregar o iframe',async()=>{
  const f=setup();f.button('.janela-ativar').click();await f.ready();
  assert.equal(f.intervalCount(),1);
  f.window.emit('pagehide',{persisted:true});assert.equal(f.intervalCount(),0);
  f.api.mode='visita';await f.tick();
  assert.equal(f.tabs[0].getAttribute('aria-selected'),'true','monitor está suspenso');
  f.window.emit('pageshow',{persisted:true});assert.equal(f.intervalCount(),1);
  f.window.emit('pageshow',{persisted:true});assert.equal(f.intervalCount(),1,'não duplica monitor');
  await f.tick();assert.equal(f.tabs[3].getAttribute('aria-selected'),'true');
  assert.equal(f.iframe.srcWrites,1);
});

test('tempo em aba oculta não consome o prazo de carregamento',async()=>{
  const f=setup();f.api.ready=false;
  f.button('.janela-ativar').click();await f.ready();
  f.advance(30000);f.hidden(true);f.advance(300000);await f.tick();
  assert.equal(f.janela.dataset.estado,'carregando');
  f.hidden(false);f.advance(89999);await f.tick();
  assert.equal(f.janela.dataset.estado,'carregando','só transcorreram 119999ms visíveis');
  f.advance(2);await f.tick();
  assert.equal(f.janela.dataset.estado,'erro','falha após o prazo de tempo visível');
});

test('vínculo ausente também termina a espera ao exceder o prazo',async()=>{
  const f=setup();delete f.api.units.units[0].relation;
  f.tabs[1].click();f.button('.janela-ativar').click();await f.ready();
  assert.equal(f.janela.dataset.estado,'carregando');
  f.advance(120001);await f.tick();
  assert.equal(f.janela.dataset.estado,'erro');assert.deepEqual(f.calls,[]);
});

test('preload aquece tudo uma vez sem escolher unidade nem trocar o modo do visitante',async()=>{
  let finish;
  const f=setup({cache:{readyScenes:[],plans:{plans:{}}},prepare:()=>new Promise(resolve=>{finish=resolve;})});
  await f.ready();await f.tick();
  assert.equal(f.warmCalls.length,1);assert.equal(f.warmCalls[0].all,true);
  assert.deepEqual(f.calls,[]);assert.equal(f.api.mode,'maquete');assert.equal(f.api.selectedUnitId,null);
  assert.equal(f.find('.demo-progresso').value,0);
  f.cache.readyScenes.push('exterior');await f.tick();
  assert.equal(f.find('.demo-progresso').value,1);
  assert.equal(f.preparation[0].dataset.pronto,'true');
  f.cache.plans.plans={canto:{ready:true},meio:{ready:true}};await f.tick();
  assert.equal(f.find('.demo-progresso').value,2);
  assert.equal(f.preparation[1].dataset.pronto,'true');
  f.cache.readyScenes.push('interior:canto');await f.tick();
  assert.equal(f.find('.demo-progresso').value,2,'um interior só ainda não cobre todas as plantas');
  f.cache.readyScenes.push('interior:meio');finish(true);await flush();await f.tick();
  assert.equal(f.find('.demo-progresso').value,4);
  assert.ok(f.preparation.every(item=>item.dataset.pronto==='true'));
  assert.deepEqual(f.calls,[]);assert.equal(f.iframe.srcWrites,1);
});

test('falha no preload não bloqueia etapas que já ficaram prontas',async()=>{
  for(const prepare of [()=>Promise.resolve(false),()=>Promise.reject(Error('interior indisponível'))]){
    const f=setup({cache:{readyScenes:['exterior'],plans:{plans:{canto:{ready:true},meio:{ready:true}}}},prepare});
    await f.ready();await f.tick();
    assert.equal(f.janela.dataset.estado,'pronta');
    assert.equal(f.find('.demo-progresso').value,2);
    assert.equal(f.preparation[0].dataset.pronto,'true');assert.equal(f.preparation[1].dataset.pronto,'true');
    assert.equal(f.preparation[2].dataset.pronto,'false');assert.equal(f.preparation[3].dataset.pronto,'false');
    assert.ok(f.find('.demo-preparo-texto').textContent,'informa o estado parcial');
    f.tabs[1].click();await f.tick();
    assert.equal(f.api.mode,'planta2d');assert.equal(f.janela.dataset.estado,'pronta');
    assert.equal(f.iframe.srcWrites,1);assert.equal(f.warmCalls.length,1);
  }
});

test('destino já preparado permanece visível durante a troca e conserva a seleção',async()=>{
  const f=setup();await f.ready();
  f.api.selectedUnitId='unidade-do-visitante';
  f.api.units.units.push({id:f.api.selectedUnitId,relation:{orientation:'original',typology:'meio'}});
  let finish;
  f.api.setMode=async function(mode){
    f.calls.push(['mode',mode]);this.ready=false;
    await new Promise(resolve=>{finish=resolve;});
    this.ready=true;this.mode=mode;return true;
  };
  f.tabs[1].click();await flush();
  assert.equal(f.janela.dataset.estado,'pronta','a troca preparada não oculta o visualizador');
  assert.equal(f.iframe.getAttribute('aria-hidden'),'false');
  assert.equal(f.iframe.srcWrites,1);
  finish();await flush();await f.tick();
  assert.equal(f.api.mode,'planta2d');assert.equal(f.api.selectedUnitId,'unidade-do-visitante');
  assert.ok(f.calls.every(([kind])=>kind==='mode'));
});

test('retry após timeout ignora a transição antiga sem desbloquear a transição nova',async()=>{
  for(const resultado of ['resolve','reject']){
    const f=setup();await f.ready();
    const setMode=f.api.setMode;
    let resolveOld,rejectOld;
    f.api.setMode=async function(mode){
      f.calls.push(['mode',mode]);this.ready=false;
      await new Promise((resolve,reject)=>{resolveOld=resolve;rejectOld=reject;});
      this.ready=true;this.mode=mode;this.error='falha do documento antigo';
    };
    f.tabs[1].click();await flush();
    f.advance(120001);await f.tick();
    assert.equal(f.janela.dataset.estado,'erro','o prazo expira mesmo com setMode pendente');
    f.button('.janela-repetir').click();
    const novaApi={...f.api,ready:true,error:null,mode:'maquete',selectedUnitId:null,setMode};
    f.iframe.contentWindow={__livViewer:novaApi};f.iframe.emit('load');await f.tick();
    assert.equal(novaApi.mode,'planta2d');assert.equal(f.janela.dataset.estado,'pronta');

    let finishNew;
    novaApi.setMode=async function(mode){
      f.calls.push(['mode',mode]);this.ready=false;
      await new Promise(resolve=>{finishNew=resolve;});
      this.mode=mode;this.ready=true;return true;
    };
    f.tabs[3].click();await flush();
    if(resultado==='resolve')resolveOld();else rejectOld(Error('falha atrasada'));
    await flush();await f.tick();
    assert.equal(f.janela.dataset.estado,'pronta','a conclusão antiga não sobrescreve a interface nova');
    assert.equal(f.calls.filter(([kind,mode])=>kind==='mode'&&mode==='visita').length,1,'a operação antiga não libera uma transição concorrente');
    finishNew();await flush();await f.tick();
    assert.equal(novaApi.mode,'visita');assert.equal(f.tabs[3].getAttribute('aria-selected'),'true');
    assert.equal(f.janela.dataset.estado,'pronta');assert.equal(f.iframe.srcWrites,2);
  }
});

test('passeio guiado só fica disponível depois das quatro visualizações prontas',async()=>{
  const f=setup({cache:{readyScenes:['exterior'],plans:{plans:{}}}});
  const passeio=f.button('.demo-passeio');
  await f.ready();
  assert.equal(passeio.disabled,true);
  assert.equal(f.button('.demo-passeio-progresso').hidden,true);
  passeio.click();f.advance(30000);await f.tick();
  assert.equal(f.api.mode,'maquete');assert.deepEqual(f.calls,[]);
  assert.doesNotMatch(passeio.textContent,/pausar/i);

  f.cache.plans.plans={canto:{ready:true},meio:{ready:true}};
  f.cache.readyScenes.push('interior:canto');await f.tick();
  assert.equal(passeio.disabled,true,'um interior pronto não libera o roteiro completo');
  f.cache.readyScenes.push('interior:meio');await f.tick();
  assert.equal(passeio.disabled,false);
  passeio.click();await f.tick();
  assert.match(passeio.textContent,/pausar/i);
  assert.match(f.button('.demo-passeio-etapa').textContent,/prédio/i);
  assert.equal(f.iframe.srcWrites,1);
});

test('passeio percorre prédio, planta, apartamento e tour nos tempos previstos sem recarregar',async()=>{
  const f=setup();await f.ready();
  const passeio=f.button('.demo-passeio');
  const progresso=f.button('.demo-passeio-progresso');
  passeio.click();await f.tick();
  assert.equal(progresso.hidden,false);assert.equal(progresso.value,0);
  for(const [duracao,anterior,seguinte,rotulo] of [
    [10000,'maquete','planta2d',/planta/i],
    [10000,'planta2d','planta3d',/apartamento|ambientes em 3D/i],
    [12000,'planta3d','visita',/tour|sala/i],
  ]){
    f.advance(duracao-1);await f.tick();
    assert.equal(f.api.mode,anterior,'preserva o tempo de exploração da etapa');
    f.advance(1);await f.tick();await f.tick();
    assert.equal(f.api.mode,seguinte);
    assert.match(f.button('.demo-passeio-etapa').textContent,rotulo);
  }
  f.advance(13999);await f.tick();assert.match(passeio.textContent,/pausar/i);
  f.advance(1);await f.tick();
  assert.match(passeio.textContent,/repetir/i);assert.equal(f.api.mode,'visita');
  assert.equal(progresso.value,1,'o roteiro completo preenche o progresso');
  assert.deepEqual(f.calls.filter(([kind])=>kind==='mode'),[
    ['mode','planta2d'],['mode','planta3d'],['mode','visita'],
  ]);
  assert.equal(f.iframe.srcWrites,1);
  passeio.click();await f.tick();await f.tick();
  assert.equal(f.api.mode,'maquete');assert.match(passeio.textContent,/pausar/i);
  assert.equal(f.iframe.srcWrites,1,'repetir também reutiliza o visualizador');
});

test('pausar e continuar o passeio preserva o tempo restante da etapa',async()=>{
  const f=setup();await f.ready();
  const passeio=f.button('.demo-passeio');
  passeio.click();await f.tick();
  f.advance(4000);await f.tick();
  const progresso=f.button('.demo-passeio-progresso');
  assert.ok(Math.abs(progresso.value-.1)<1e-9,'quatro segundos correspondem a 40% da primeira etapa');
  passeio.click();
  assert.match(passeio.textContent,/continuar/i);
  f.advance(30000);await f.tick();
  assert.equal(f.api.mode,'maquete');assert.deepEqual(f.calls,[]);
  assert.ok(Math.abs(progresso.value-.1)<1e-9,'tempo pausado não avança a barra');
  passeio.click();await f.tick();
  assert.match(passeio.textContent,/pausar/i);
  f.advance(5999);await f.tick();assert.equal(f.api.mode,'maquete');
  f.advance(1);await f.tick();await f.tick();assert.equal(f.api.mode,'planta2d');
  assert.equal(f.iframe.srcWrites,1);
});

test('escolher uma aba encerra o passeio e mantém a exploração manual',async()=>{
  const f=setup();await f.ready();
  const passeio=f.button('.demo-passeio');
  passeio.click();await f.tick();
  f.advance(10000);await f.tick();await f.tick();
  assert.equal(f.api.mode,'planta2d');
  f.tabs[2].click();await f.tick();
  assert.equal(f.api.mode,'planta3d');
  assert.doesNotMatch(passeio.textContent,/pausar|continuar/i);
  f.advance(60000);await f.tick();
  assert.equal(f.api.mode,'planta3d','o roteiro não toma o controle de volta');
  assert.equal(f.tabs[2].getAttribute('aria-selected'),'true');
  assert.equal(f.janela.dataset.estado,'pronta');assert.equal(f.iframe.srcWrites,1);
});

test('órbita respeita visibilidade e movimento reduzido, e cede ao primeiro gesto do visitante',async()=>{
  for(const reducedMotion of [false,true]){
    const f=setup({reducedMotion});await f.ready();
    const controls=f.api.frame.contentWindow.__livProva.controls;
    assert.equal(controls.autoRotate,false,'não gira fora da área visível');
    f.inView(true);await f.tick();
    assert.equal(controls.autoRotate,!reducedMotion);
    f.inView(false);assert.equal(controls.autoRotate,false);
    f.inView(true);assert.equal(controls.autoRotate,!reducedMotion);
    f.api.frame.contentWindow.document.emit('pointerdown');
    assert.equal(controls.autoRotate,false,'o gesto no 3D encerra a órbita');
    f.inView(false);f.inView(true);await f.tick();
    assert.equal(controls.autoRotate,false,'voltar à área visível não retoma a câmera após o gesto');
    if(reducedMotion){
      f.button('.demo-passeio').click();await f.tick();
      assert.equal(controls.autoRotate,false,'nem o passeio força movimento automático quando ele foi reduzido');
    }
    assert.equal(f.iframe.srcWrites,1);
  }
});

test('ocultar a página pausa o passeio e o retorno exige continuação explícita',async()=>{
  const f=setup({reducedMotion:false});f.inView(true);await f.ready();
  const passeio=f.button('.demo-passeio');
  const controls=f.api.frame.contentWindow.__livProva.controls;
  passeio.click();await f.tick();
  f.advance(4000);await f.tick();
  assert.equal(controls.autoRotate,true);
  f.hidden(true);
  assert.match(passeio.textContent,/continuar/i);assert.equal(controls.autoRotate,false);
  f.advance(30000);await f.tick();f.hidden(false);await f.tick();
  assert.equal(f.api.mode,'maquete');assert.match(passeio.textContent,/continuar/i);
  assert.equal(controls.autoRotate,false,'o retorno não reinicia a órbita pausada');
  passeio.click();await f.tick();
  f.advance(5999);await f.tick();assert.equal(f.api.mode,'maquete');
  f.advance(1);await f.tick();await f.tick();assert.equal(f.api.mode,'planta2d');
  assert.equal(f.iframe.srcWrites,1);
});

test('preparação do passeio mantém controles de paredes e ambiente sincronizados com a cena',async()=>{
  const f=setup();
  const paredes=f.iframe.contentDocument.querySelector('#hostCutParedes');
  const ambientes=f.iframe.contentDocument.querySelector('#hostRoomSelect');
  const cortes=[],destinos=[];
  paredes.setAttribute('aria-pressed','false');
  paredes.textContent='Paredes baixas';
  ambientes.value='suite';
  const interior={
    setWallCut(ativo){cortes.push(ativo);},
    getRoomRoutes(){return [{id:'suite',name:'Suíte',reachable:true},{id:'sala',name:'Sala de estar',reachable:true}];},
    goToRoom(id,{instant}){destinos.push({id,instant,selecionado:ambientes.value});return Promise.resolve(true);},
  };
  f.api.frame.contentWindow.__livInterior=interior;
  paredes.addEventListener('click',()=>{
    const ativo=paredes.getAttribute('aria-pressed')!=='true';
    interior.setWallCut(ativo);
    paredes.setAttribute('aria-pressed',String(ativo));
    paredes.textContent=ativo?'Paredes inteiras':'Paredes baixas';
  });
  await f.ready();
  const passeio=f.button('.demo-passeio');
  passeio.click();await f.tick();
  f.advance(10000);await f.tick();await f.tick();
  f.advance(10000);await f.tick();await f.tick();
  assert.equal(f.api.mode,'planta3d');
  assert.equal(paredes.getAttribute('aria-pressed'),'true');
  assert.equal(paredes.textContent,'Paredes inteiras','a ação do próprio controle atualiza sua indicação');
  assert.deepEqual(cortes,[true]);
  passeio.click();passeio.click();await f.tick();
  assert.equal(paredes.getAttribute('aria-pressed'),'true');
  assert.deepEqual(cortes,[true],'continuar não desativa paredes baixas que já estavam ativas');
  f.advance(12000);await f.tick();await f.tick();
  assert.equal(f.api.mode,'visita');
  assert.equal(ambientes.value,'sala');
  assert.deepEqual(destinos,[{id:'sala',instant:true,selecionado:'sala'}],'o menu já indica a sala quando a navegação começa');
  assert.equal(f.iframe.srcWrites,1);
});

test('landing preserva a marca oficial e não oferece os planos comerciais descontinuados',()=>{
  const landing=new URL('../experimentos/apresentacao-2026-11-01/site/index.html',import.meta.url);
  const html=readFileSync(landing,'utf8');
  const oficial=readFileSync(new URL('../fachada/assets/logo-conecta.webp',import.meta.url));
  for(const tag of ['header','footer']){
    const area=html.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`,'i'))?.[0]||'';
    const imagem=area.match(/<img\b[^>]*\bsrc=["']([^"']*logo-conecta\.webp(?:\?[^"']*)?)["']/i);
    assert.ok(imagem,`${tag} apresenta o logo oficial em imagem`);
    assert.ok(readFileSync(new URL(imagem[1],landing)).equals(oficial),`${tag} conserva a arte fornecida`);
  }
  assert.doesNotMatch(html,/\b(?:LEVE|PREMIUM)\b/i,'não mantém catálogo, contato ou FAQ dos planos antigos');
  assert.doesNotMatch(html,/href=["']#planos["']/i,'a navegação acompanha a retirada do catálogo');
  const css=readFileSync(new URL('../experimentos/apresentacao-2026-11-01/site/styles.css',import.meta.url),'utf8');
  const identidade=readFileSync(new URL('../fachada/assets/visual-novo.css',import.meta.url),'utf8');
  const token=(texto,nome)=>texto.match(new RegExp(`--${nome}\\s*:\\s*([^;}]+)`))?.[1].trim();
  for(const nome of ['papel','tinta']){
    assert.equal(token(css,nome),token(identidade,nome),`a cor de ${nome} segue a identidade institucional`);
  }
});

test('prepara todas as visualizações assim que o catálogo chega, antes do prédio ficar pronto',async()=>{
  const f=setup({cache:{readyScenes:[],plans:{plans:{}}}});
  f.api.ready=false;
  await f.ready();
  assert.equal(f.janela.dataset.estado,'carregando');
  assert.equal(f.warmCalls.length,1,'o preparo não fica esperando a cena exterior');
  assert.equal(f.warmCalls[0].all,true);
  assert.deepEqual(f.calls,[],'aquecer não muda a seleção nem a vista do visitante');
  await f.tick();assert.equal(f.warmCalls.length,1,'o monitor não dispara aquecimentos concorrentes');
  f.api.ready=true;await f.tick();
  assert.equal(f.janela.dataset.estado,'pronta');assert.equal(f.warmCalls.length,1);
  assert.equal(f.iframe.srcWrites,1);
});

test('apartamento e tour já preparados abrem sem espera pela outra tipologia',async()=>{
  for(const selecao of ['padrao','visitante']){
    const f=setup({cache:{readyScenes:['exterior','interior:meio'],plans:{plans:{meio:{ready:true}}}}});
    if(selecao==='padrao')f.api.units.units[0].relation.typology='meio';
    else{
      f.api.selectedUnitId='unidade-do-visitante';
      f.api.units.units.push({id:f.api.selectedUnitId,relation:{orientation:'original',typology:'meio'}});
    }
    await f.ready();
    assert.ok(f.find('.demo-progresso').value<4,'o preparo completo continua separado do destino atual');
    assert.equal(f.button('.demo-passeio').disabled,true,'o roteiro completo ainda aguarda a outra tipologia');
    for(const [aba,destino] of [[2,'planta3d'],[3,'visita']]){
      f.tabs[aba].click();
      assert.equal(f.janela.dataset.estado,'pronta',`${destino} da unidade ${selecao} já está preparado`);
      assert.equal(f.iframe.getAttribute('aria-hidden'),'false','a cena não desaparece durante a troca');
      await f.tick();assert.equal(f.api.mode,destino);
      assert.equal(f.janela.dataset.estado,'pronta');
    }
    if(selecao==='visitante')assert.equal(f.api.selectedUnitId,'unidade-do-visitante');
    assert.equal(f.iframe.srcWrites,1);
  }
});
