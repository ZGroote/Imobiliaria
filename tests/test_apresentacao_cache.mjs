import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as planRuler from '../experimentos/apresentacao-2026-11-01/site/demo/plan-ruler.js';
import {typology} from '../experimentos/apresentacao-2026-11-01/site/demo/tipologias.js';
import {unitById} from '../experimentos/apresentacao-2026-11-01/site/demo/unidades.js';
import {expandBuildingCatalog,floorOf,floorLabel,unitScope} from '../experimentos/apresentacao-2026-11-01/site/demo/catalogo-unidades.js';
import {requestedEdition} from '../experimentos/apresentacao-2026-11-01/site/demo/edicoes.js';
import {saleOf,saleLabel,priceLabel} from '../experimentos/apresentacao-2026-11-01/site/demo/comercial.js';
import {attachPresentationCommercial as attachCommercial} from '../experimentos/apresentacao-2026-11-01/site/demo/comercial-apresentacao.js';
import {requestedAmbience,AMBIENCES} from '../experimentos/apresentacao-2026-11-01/site/demo/ambiencia-perfis.js';
import {attachRelations} from '../experimentos/apresentacao-2026-11-01/site/demo/vinculos.js';
import {attachStock} from '../experimentos/apresentacao-2026-11-01/site/demo/estoque-adapter.js';
import {availableUnitIds} from '../experimentos/apresentacao-2026-11-01/site/demo/disponibilidade.js';
import {createBuyerUI} from '../experimentos/apresentacao-2026-11-01/site/demo/experiencia-compra.js';
import {normalizeHour,solarState,unitSolarContext} from '../experimentos/apresentacao-2026-11-01/site/demo/horario-solar.js';

const demo=new URL('../experimentos/apresentacao-2026-11-01/site/demo/',import.meta.url);
const read=name=>readFileSync(new URL(name,demo),'utf8');
const json=name=>JSON.parse(read(name));
const pilot=json('unidades.json');
const script=name=>read(name).replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url','moduleURL').replaceAll('export function','function');

class Element {
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.dataset={};this.attributes={};this.children=[];this.listeners={};
    this.value='';this.hiddenWrites=[];this.hidden=false;this.disabled=false;this.open=false;
    const styles=new Map();this.style={setProperty:(key,value)=>styles.set(key,value),getPropertyValue:key=>styles.get(key)||''};
  }
  set hidden(value){this.hiddenWrites.push(value);this._hidden=value;}
  get hidden(){return this._hidden;}
  getBoundingClientRect(){return {width:1040,height:650,left:0,top:0};}
  addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
  removeEventListener(type,listener){this.listeners[type]=(this.listeners[type]||[]).filter(fn=>fn!==listener);}
  setPointerCapture(id){(this.pointers??=new Set()).add(id);}
  hasPointerCapture(id){return this.pointers?.has(id)||false;}
  releasePointerCapture(id){this.pointers?.delete(id);}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='class')this.className=String(value);}
  getAttribute(key){return this.attributes[key]??null;}
  add(child){this.appendChild(child);}
  append(...children){for(const child of children)this.appendChild(child);}
  appendChild(child){child.remove();this.children.push(child);child.parent=this;return child;}
  get parentElement(){return this.parent||null;}
  prepend(child){child.remove();this.children.unshift(child);child.parent=this;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  set innerHTML(value){this.children=[];}
  querySelector(selector){
    const matches=node=>selector.startsWith('.')?(node.className||'').split(/\s+/).includes(selector.slice(1)):node.tagName===selector.toUpperCase();
    return this.children.find(matches)||this.children.map(child=>child.querySelector(selector)).find(Boolean)||null;
  }
  querySelectorAll(){return [];}
  showModal(){this.open=true;}
  close(){this.open=false;}
}

function harness(t,{exteriorReady=true,interiorReady=()=>true}={}){
  const elements=new Map(),frames=[],images=[],timers=new Set(),idles=new Map();
  let commercial=json('comercial.json');
  const element=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  element('modalUnitDetails').appendChild(element('detailsBody'));
  element('mapLink').href='http://localhost/mapa.html';
  const modes=['maquete','planta2d','planta3d','visita'].map(mode=>Object.assign(new Element('button'),{dataset:{mode}}));
  const createElement=tag=>{
    const node=new Element(tag);
    if(tag==='iframe'){
      const api={ready:exteriorReady,active:false,backend:'webgl',activeCalls:[],disposals:0,parkingCalls:[],
        data:{sourceModelSHA256:pilot.sourceModelSHA256},
        get typology(){return new URL(node.src,'http://localhost').searchParams.get('tipologia');},
        setView(){},setFloor(){},setSelectedUnit(){},setAvailableUnits(){},setUnitView(){},
        setParkingSpaces(numbers){api.parkingSpaces=[...numbers];api.parkingCalls.push([...numbers]);return api.parkingSpaces;},
        setMode(mode){api.mode=mode;return true;},
        getState:()=>({typology:api.typology,unitSHA256:'test-unit',sourceSHA256:'test-source',presentation:{enabled:false}}),
        setActive(value){api.activeCalls.push(value);api.active=value;return true;},
        dispose(){api.disposals++;api.disposed=true;api.active=false;},
        getRoomRoutes:()=>[{id:'sala',name:'Sala',reachable:true}],goToRoom:()=>true};
      const child=new Element();
      Object.defineProperties(child,{
        __livProva:{get:()=>node.dataset.scene==='exterior'?api:undefined},
        __livInterior:{get:()=>node.dataset.scene?.startsWith('interior:')?api:undefined}
      });
      let src='';node.srcWrites=0;
      Object.defineProperty(node,'src',{get:()=>src,set:value=>{src=value;node.srcWrites++;api.ready=node.dataset.scene==='exterior'?exteriorReady:interiorReady(api.typology);}});
      node.contentWindow=child;node.api=api;frames.push(node);
    }
    return node;
  };
  const document={documentElement:new Element('html'),hidden:false,visibilityState:'visible',
    getElementById:element,createElement,createElementNS:(_,tag)=>{const node=createElement(tag);node.ownerDocument=document;return node;},
    querySelector:()=>element('mapLink'),querySelectorAll:selector=>selector==='[data-mode]'?modes:[]};
  document.documentElement.dataset.apresentacao='viewer';
  const location={search:'?backend=webgl&unidades=edificio&experiencia=original',pathname:'/demo/index.html',origin:'http://localhost',hostname:'localhost'};
  const context=vm.createContext({document,location,URL,URLSearchParams,AbortController,DecompressionStream,performance,console,
    setTimeout(callback,delay){const timer=setTimeout(()=>{timers.delete(timer);callback();},delay);timers.add(timer);return timer;},
    clearTimeout(timer){timers.delete(timer);clearTimeout(timer);},
    Option:class extends Element {constructor(text,value){super('option');this.textContent=text;this.value=value;}},
    Image:class extends Element {constructor(){super('img');this.naturalWidth=1000;this.naturalHeight=1000;images.push(this);}decode(){this.decodes=(this.decodes||0)+1;return Promise.resolve();}},
    ResizeObserver:class {observe(){}disconnect(){}},navigator:{},matchMedia:()=>({matches:false,addEventListener(){}}),
    sessionStorage:{getItem:()=>null,setItem(){}},moduleURL:'http://localhost/demo/viewer.js',
    transfers:{pause:async()=>{},prioritize:async()=>{},start:async()=>{},getState:()=>({})},showTransferStatus(){},
    ...planRuler,createBuyerUI,typology,layout:typology,unitById,floorOf,floorLabel,unitScope,requestedEdition,
    attachCommercial,saleOf,saleLabel,priceLabel,requestedAmbience,AMBIENCES,attachRelations,attachStock,availableUnitIds,
    normalizeHour,solarState,unitSolarContext,createTimeControl:()=>({update(){},dispose(){}}),
    loadUnitCatalog:async()=>expandBuildingCatalog(pilot),
    fetch:async url=>{
      const name=new URL(url).pathname.replace('/demo/','');
      const data=name==='estoque-config.json'?{schema:'liv-sales-config-v1',mode:'desativado'}:name==='comercial.json'?commercial:json(name);
      return {ok:true,json:async()=>structuredClone(data)};
    }});
  context.window=context;context.parent={};context.addEventListener=()=>{};
  context.requestIdleCallback=callback=>{const id=idles.size+1;idles.set(id,callback);return id;};
  context.cancelIdleCallback=id=>idles.delete(id);
  vm.runInContext(script('planta2d.js'),context,{filename:'demo/planta2d.js'});
  vm.runInContext(script('unit-ui.js'),context,{filename:'demo/unit-ui.js'});
  vm.runInContext(script('viewer.js'),context,{filename:'demo/viewer.js'});
  t.after(()=>{context.__livViewer.dispose();for(const timer of timers)clearTimeout(timer);});
  return {state:context.__livViewer,element,frames,images,setCommercial(data){commercial=structuredClone(data);}};
}

async function waitFor(check,message){
  const deadline=performance.now()+2000;
  while(!check()){
    assert.ok(performance.now()<deadline,message||'O viewer não alcançou o estado esperado.');
    await new Promise(resolve=>setTimeout(resolve,5));
  }
}

test('o viewer gerado prepara as duas plantas e interiores sem clique mesmo com exterior pendente',async t=>{
  const app=harness(t,{exteriorReady:false});
  await waitFor(()=>app.frames.length===3,'O exterior pendente não pode bloquear Canto e Meio.');
  await waitFor(()=>app.state.getCacheState().readyScenes.length===2);
  assert.equal(app.state.ready,false);
  assert.deepEqual(app.frames.map(frame=>frame.dataset.scene).sort(),['exterior','interior:canto','interior:meio']);
  const plans=app.state.getCacheState().plans.plans;
  assert.ok(plans.canto.ready&&plans.meio.ready);
  assert.equal(app.images.length,2);assert.ok(app.images.every(image=>image.decodes===1));
  assert.ok(app.frames.every(frame=>frame.srcWrites===1&&frame.api.disposals===0));
  app.frames.find(frame=>frame.dataset.scene==='exterior').api.ready=true;
  await waitFor(()=>app.state.ready&&app.state.getCacheState().readyScenes.length===3);
});

test('ciclos dos quatro modos e Canto/Meio retomam as mesmas cenas sem overlay nem descarte',async t=>{
  const app=harness(t);
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido'&&app.state.getCacheState().readyScenes.length===3);
  const originalFrames=new Map(app.frames.map(frame=>[frame.dataset.scene,frame]));
  const overlay=app.element('loading');overlay.hiddenWrites.length=0;
  for(let cycle=0;cycle<2;cycle++)for(const key of ['canto','meio']){
    const unit=app.state.units.units.find(item=>item.relation?.typology===key);
    assert.ok(unit,`Cadastro deve associar uma unidade à planta ${key}.`);
    assert.equal(app.state.selectUnit(unit.id),true);
    assert.equal(await app.state.setMode('planta2d'),true);
    assert.equal(app.state.typology,key);assert.equal(overlay.hidden,true);
    assert.equal(await app.state.setMode('planta3d'),true);
    const frame=originalFrames.get(`interior:${key}`);
    assert.equal(app.state.frame,frame);assert.equal(frame.api.active,true);
    const calls=frame.api.activeCalls.length;
    for(const mode of ['visita','planta3d','visita']){
      assert.equal(await app.state.setMode(mode),true);assert.equal(app.state.frame,frame);
      assert.equal(app.state.ready,true);assert.equal(overlay.hidden,true);
    }
    assert.equal(frame.api.activeCalls.slice(calls).includes(false),false,'Planta 3D e Tour compartilham o renderer ativo.');
    assert.equal(await app.state.setMode('maquete'),true);
    assert.equal(app.state.frame,originalFrames.get('exterior'));
    assert.equal(app.state.ready,true);assert.equal(app.state.error,null);
  }
  assert.equal(app.frames.length,3);
  assert.ok(app.frames.every(frame=>frame===originalFrames.get(frame.dataset.scene)&&frame.srcWrites===1&&frame.api.disposals===0));
  assert.equal(overlay.hiddenWrites.includes(false),false,'Nenhuma retomada pronta deve piscar o carregamento.');
  assert.equal(app.images.length,2);assert.ok(app.images.every(image=>image.decodes===1));
});

test('abrir Meio durante o preparo de Canto compartilha a fila sem inicializar dois interiores',async t=>{
  const app=harness(t,{interiorReady:key=>key!=='canto'});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido'&&app.frames.some(frame=>frame.dataset.scene==='interior:canto'));
  const canto=app.frames.find(frame=>frame.dataset.scene==='interior:canto');
  assert.equal(canto.api.ready,false);
  const unit=app.state.units.units.find(item=>item.relation?.typology==='meio');
  assert.ok(unit);assert.equal(app.state.selectUnit(unit.id),true);
  const opening=app.state.setMode('planta3d');
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(app.state.mode,'planta3d');
  assert.deepEqual(app.frames.filter(frame=>frame.dataset.scene.startsWith('interior:')).map(frame=>frame.dataset.scene),['interior:canto'],
    'Meio deve esperar Canto terminar, mesmo quando a navegação pede sua abertura.');
  assert.equal(app.frames.filter(frame=>frame.dataset.scene.startsWith('interior:')&&!frame.api.ready).length,1);
  assert.equal(app.state.ready,false);
  canto.api.ready=true;
  assert.equal(await opening,true);
  await waitFor(()=>app.state.getCacheState().readyScenes.length===3);
  const meio=app.frames.find(frame=>frame.dataset.scene==='interior:meio');
  assert.equal(app.state.frame,meio);assert.equal(meio.api.active,true);
  assert.equal(app.state.mode,'planta3d');assert.equal(app.state.typology,'meio');
  assert.equal(app.state.ready,true);assert.equal(app.state.error,null);
  assert.equal(app.frames.length,3);
  assert.ok(app.frames.every(frame=>frame.srcWrites===1&&frame.api.disposals===0));
});

test('selecionar apartamentos envia suas vagas ao renderer com filtro verde desligado, inclusive após refresh',async t=>{
  const app=harness(t);
  await waitFor(()=>app.state.ready&&app.state.commercialStatus==='fornecido'&&app.state.relationStatus==='fornecido');
  const exterior=app.frames.find(frame=>frame.dataset.scene==='exterior'),api=exterior.api;
  const first='vila-aurora/pavimento-modelo-00/final-01',last='vila-aurora/pavimento-modelo-16/final-10';
  assert.equal(app.state.availabilityFilter,'todos');
  assert.equal(app.element('presentationAvailability').getAttribute('aria-pressed'),'false');
  assert.equal(app.state.selectUnit(first),true);assert.deepEqual(api.parkingSpaces,[1]);
  app.state.setAvailabilityFilter('disponiveis');assert.deepEqual(api.parkingSpaces,[1]);
  app.state.setAvailabilityFilter('todos');assert.deepEqual(api.parkingSpaces,[1]);
  assert.equal(app.state.selectUnit(last),true);assert.deepEqual(api.parkingSpaces,[170]);
  await app.state.setMode('planta2d');await app.state.setMode('maquete');
  assert.equal(app.state.frame,exterior);assert.deepEqual(api.parkingSpaces,[170]);
  assert.equal(app.state.selectUnit(null),true);assert.deepEqual(api.parkingSpaces,[]);
  assert.equal(app.state.selectUnit(first),true);assert.deepEqual(api.parkingSpaces,[1]);
  const changed=json('comercial.json');changed.units[0].parking='Vaga 175';app.setCommercial(changed);
  assert.equal(await app.state.reloadCommercial(),true);assert.deepEqual(api.parkingSpaces,[175]);
  changed.units[0].parking=null;app.setCommercial(changed);
  assert.equal(await app.state.reloadCommercial(),true);assert.deepEqual(api.parkingSpaces,[]);
  changed.units[0].parking='Vaga 2';app.setCommercial(changed);
  assert.equal(await app.state.reloadCommercial(),true);assert.deepEqual(api.parkingSpaces,[2]);
  changed.units.shift();app.setCommercial(changed);
  assert.equal(await app.state.reloadCommercial(),true);assert.deepEqual(api.parkingSpaces,[]);
  assert.equal(exterior.srcWrites,1);assert.equal(api.disposals,0);
});
