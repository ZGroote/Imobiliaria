import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installOrientationControls} from './orientacao.js';

class Target {
  listeners=new Map();
  attributes=new Map();
  hidden=false;
  disabled=false;
  textContent='';
  addEventListener(name,callback){const handlers=this.listeners.get(name)||[];handlers.push(callback);this.listeners.set(name,handlers);}
  dispatch(name){return Promise.all((this.listeners.get(name)||[]).map(callback=>callback()));}
  setAttribute(name,value){this.attributes.set(name,value);}
  getAttribute(name){return this.attributes.get(name);}
}

function harness({mobile=true,horizontal=false,saved=null,storageBlocked=false,api=true,fullscreenError=false,lockError=false,externalFullscreen=false,fullscreenWait=null,lockWait=null}={}) {
  const ids=['orientationControls','orientationHint','orientationLandscape','orientationPortrait'];
  const elements=new Map(ids.map(id=>[id,new Target()])),calls=[],storage=new Map(saved?[['liv-orientacao',saved]]:[]);
  const mobileMedia=new Target(),horizontalMedia=new Target();mobileMedia.matches=mobile;horizontalMedia.matches=horizontal;
  const document=new Target(),window=new Target(),root={};let activation=false;
  document.getElementById=id=>elements.get(id);
  document.documentElement=root;document.fullscreenElement=externalFullscreen?{}:null;
  root.requestFullscreen=async()=>{
    calls.push({name:'fullscreen',activation});
    if(fullscreenError)throw Error('Fullscreen negado');
    if(fullscreenWait)await fullscreenWait;
    document.fullscreenElement=root;await document.dispatch('fullscreenchange');
  };
  document.exitFullscreen=async()=>{calls.push({name:'exit'});document.fullscreenElement=null;await document.dispatch('fullscreenchange');};
  window.document=document;window.matchMedia=query=>query.includes('orientation: landscape')?horizontalMedia:mobileMedia;
  window.localStorage={getItem(key){if(storageBlocked)throw Error('Storage bloqueado');return storage.get(key)||null;},setItem(key,value){if(storageBlocked)throw Error('Storage bloqueado');storage.set(key,value);}};
  window.screen={orientation:api?{
    async lock(value){calls.push({name:'lock',value,fullscreen:Boolean(document.fullscreenElement)});if(lockWait)await lockWait;if(lockError)throw Error('Lock negado');},
    unlock(){calls.push({name:'unlock'});},
  }:{}};
  installOrientationControls(window);
  return {calls,storage,window,document,element:id=>elements.get(id),
    click(id){activation=true;const promise=elements.get(id).dispatch('click');activation=false;return promise;},
    rotate(value){horizontalMedia.matches=value;return horizontalMedia.dispatch('change');},
    mobile(value){mobileMedia.matches=value;return mobileMedia.dispatch('change');},
    leave(){document.fullscreenElement=null;return document.dispatch('fullscreenchange');},
  };
}

test('celular oferece horizontal por padrão sem pedir tela cheia ao abrir o link',()=>{
  const app=harness();
  assert.equal(app.element('orientationControls').hidden,false);
  assert.equal(app.element('orientationLandscape').getAttribute('aria-pressed'),'true');
  assert.equal(app.element('orientationPortrait').getAttribute('aria-pressed'),'false');
  assert.match(app.element('orientationHint').textContent,/toque em Horizontal/);
  assert.deepEqual(app.calls,[]);
});

test('desktop esconde opções e a mudança para dispositivo móvel as revela',async()=>{
  const app=harness({mobile:false});
  assert.equal(app.element('orientationControls').hidden,true);
  await app.mobile(true);assert.equal(app.element('orientationControls').hidden,false);
});

test('preferência vertical é restaurada e pode ser trocada sem alterar o link',async()=>{
  const app=harness({saved:'vertical',api:false});
  assert.equal(app.element('orientationPortrait').getAttribute('aria-pressed'),'true');
  await app.click('orientationLandscape');
  assert.equal(app.storage.get('liv-orientacao'),'horizontal');
  await app.click('orientationPortrait');
  assert.equal(app.storage.get('liv-orientacao'),'vertical');
});

test('toque horizontal pede tela cheia no gesto antes de bloquear em paisagem',async()=>{
  const app=harness();await app.click('orientationLandscape');
  assert.deepEqual(app.calls,[{name:'fullscreen',activation:true},{name:'lock',value:'landscape',fullscreen:true}]);
  assert.equal(app.element('orientationLandscape').disabled,false);
});

test('sem API a maquete continua disponível com instrução para girar o celular',async()=>{
  const app=harness({api:false});await app.click('orientationLandscape');
  assert.deepEqual(app.calls,[]);
  assert.match(app.element('orientationHint').textContent,/Gire.*horizontal/);
  await app.rotate(true);assert.doesNotMatch(app.element('orientationHint').textContent,/Gire/);
});

test('recusa de tela cheia não tenta lock e permite tentar novamente',async()=>{
  const app=harness({fullscreenError:true});await app.click('orientationLandscape');
  assert.deepEqual(app.calls.map(call=>call.name),['fullscreen']);
  assert.equal(app.element('orientationPortrait').disabled,false);
  assert.match(app.element('orientationHint').textContent,/Gire.*horizontal/);
  await app.click('orientationLandscape');assert.equal(app.calls.length,2);
});

test('recusa de lock limpa somente a tela cheia criada pelo controle',async()=>{
  const app=harness({lockError:true});await app.click('orientationLandscape');
  assert.deepEqual(app.calls.map(call=>call.name),['fullscreen','lock','exit']);
  assert.equal(app.document.fullscreenElement,null);
  assert.match(app.element('orientationHint').textContent,/Gire.*horizontal/);
  const external=harness({externalFullscreen:true,lockError:true});await external.click('orientationLandscape');
  assert.deepEqual(external.calls.map(call=>call.name),['lock']);
  assert.ok(external.document.fullscreenElement);
});

test('vertical libera a orientação e sai da tela cheia que o próprio controle abriu',async()=>{
  const app=harness();await app.click('orientationLandscape');await app.rotate(true);await app.click('orientationPortrait');
  assert.deepEqual(app.calls.map(call=>call.name),['fullscreen','lock','unlock','exit']);
  assert.equal(app.element('orientationPortrait').getAttribute('aria-pressed'),'true');
  assert.match(app.element('orientationHint').textContent,/Gire.*vertical/);
  await app.rotate(false);assert.doesNotMatch(app.element('orientationHint').textContent,/Gire/);
});

test('vertical preserva uma tela cheia que já estava aberta por outro controle',async()=>{
  const app=harness({externalFullscreen:true});await app.click('orientationLandscape');await app.click('orientationPortrait');
  assert.deepEqual(app.calls.map(call=>call.name),['lock','unlock']);
  assert.ok(app.document.fullscreenElement);
});

test('storage bloqueado não impede trocar a orientação',async()=>{
  const app=harness({storageBlocked:true});await app.click('orientationLandscape');await app.click('orientationPortrait');
  assert.equal(app.element('orientationPortrait').getAttribute('aria-pressed'),'true');
  assert.equal(app.element('orientationLandscape').disabled,false);
});

test('cliques enquanto o lock está pendente não iniciam solicitações concorrentes',async()=>{
  let finish;const app=harness({lockWait:new Promise(resolve=>{finish=resolve;})});
  const first=app.click('orientationLandscape');
  await app.click('orientationLandscape');await app.click('orientationPortrait');
  assert.equal(app.element('orientationLandscape').disabled,true);
  finish();await first;
  assert.deepEqual(app.calls.map(call=>call.name),['fullscreen','lock']);
});

test('sair da tela cheia e abandonar a página liberam o bloqueio',async()=>{
  const app=harness();await app.click('orientationLandscape');await app.leave();
  assert.deepEqual(app.calls.map(call=>call.name),['fullscreen','lock','unlock']);
  const hidden=harness();await hidden.click('orientationLandscape');await hidden.window.dispatch('pagehide');
  assert.deepEqual(hidden.calls.map(call=>call.name),['fullscreen','lock','unlock','exit']);
});

test('sair durante lock pendente não deixa orientação presa quando a promessa termina',async()=>{
  let finish;const app=harness({lockWait:new Promise(resolve=>{finish=resolve;})});
  const pending=app.click('orientationLandscape');
  while(!app.calls.some(call=>call.name==='lock'))await Promise.resolve();
  await app.leave();finish();await pending;
  assert.equal(app.calls.filter(call=>call.name==='unlock').length,1);
});

test('abandonar a página durante lock pendente libera o resultado tardio',async()=>{
  let finish;const app=harness({lockWait:new Promise(resolve=>{finish=resolve;})});
  const pending=app.click('orientationLandscape');
  while(!app.calls.some(call=>call.name==='lock'))await Promise.resolve();
  await app.window.dispatch('pagehide');finish();await pending;
  assert.equal(app.calls.filter(call=>call.name==='unlock').length,1);
  assert.equal(app.document.fullscreenElement,null);
});

test('abandonar a página enquanto tela cheia abre cancela o lock e fecha a solicitação tardia',async()=>{
  let finish;const app=harness({fullscreenWait:new Promise(resolve=>{finish=resolve;})});
  const pending=app.click('orientationLandscape');
  await app.window.dispatch('pagehide');finish();await pending;
  assert.deepEqual(app.calls.map(call=>call.name),['fullscreen','exit']);
  assert.equal(app.document.fullscreenElement,null);
});
