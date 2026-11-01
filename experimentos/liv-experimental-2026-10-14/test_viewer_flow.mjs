import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import * as planRuler from './plan-ruler.js';
import {typology} from './tipologias.js';
import {unitById} from './unidades.js';
import {expandBuildingCatalog,floorOf,floorLabel,unitScope} from './catalogo-unidades.js';
import {requestedEdition} from './edicoes.js';
import {attachCommercial,saleOf,saleLabel,priceLabel} from './comercial.js';
import {requestedAmbience,AMBIENCES} from './ambiencia-perfis.js';
import {attachRelations,PLAN_HASH} from './vinculos.js';
import {attachStock} from './estoque-adapter.js';
import {validarConfig} from './estoque-runtime.js';
import {availableUnitIds} from './disponibilidade.js';
import {createBuyerUI} from './experiencia-compra.js';
import {normalizeHour,solarState,unitSolarContext} from './horario-solar.js';

const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const pilot=read('./unidades.json'),interiors=read('./interiores/catalogo.json');
const emptyCommercial={schema:'liv-commercial-v1',status:'ausente',source:null,units:[]};
const emptyRelations={schema:'liv-unit-relations-v1',status:'ausente',source:null,units:[]};
const commercialFixture=()=>({schema:'liv-commercial-v1',status:'fornecido',bookSHA256:pilot.source.bookSHA256,
  source:{label:'FIXTURE SINTÉTICA — SEM OFERTA REAL',asOf:'2026-10-12'},
  units:[{id:pilot.units[0].id,commercialNumber:'TESTE 01',availability:'disponivel',priceCents:100001}]});
const relationFixture=()=>({schema:'liv-unit-relations-v1',status:'fornecido',bookSHA256:pilot.source.bookSHA256,
  source:{label:'FIXTURE SINTÉTICA — SEM VÍNCULO REAL',asOf:'2026-10-12'},units:[{id:pilot.units[0].id,
    typology:'canto',orientation:'original',interiorUnitSHA256:interiors.tipologias.canto.unitSHA256,
    interiorSourceSHA256:interiors.tipologias.canto.sourceSHA256,planSHA256:PLAN_HASH.canto}]});
const dualRelations=()=>{
  const data=relationFixture(),id=pilot.units[1].id;
  data.units.push({id,typology:'meio',orientation:'original',interiorUnitSHA256:interiors.tipologias.meio.unitSHA256,
    interiorSourceSHA256:interiors.tipologias.meio.sourceSHA256,planSHA256:PLAN_HASH.meio});return data;
};
const source=readFileSync(new URL('./viewer.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url','moduleURL')
  .replace("import('./estoque-runtime.js')",'loadStockSDK()');
const uiSource=readFileSync(new URL('./unit-ui.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
const planSource=readFileSync(new URL('./planta2d.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export function','function');

class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.attributes={};this.children=[];
    this.listeners={};this.value='';this.hidden=false;this.disabled=false;this.open=false;
    const styles=new Map();this.style={setProperty:(key,value)=>styles.set(key,value),getPropertyValue:key=>styles.get(key)||''};}
  getBoundingClientRect(){return {width:1040,height:0};}
  addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
  removeEventListener(type,listener){this.listeners[type]=(this.listeners[type]||[]).filter(fn=>fn!==listener);}
  setPointerCapture(id){(this.pointers??=new Set()).add(id);}
  hasPointerCapture(id){return this.pointers?.has(id)||false;}
  releasePointerCapture(id){this.pointers?.delete(id);}
  dispatch(type,event={}){return Promise.all((this.listeners[type]||[]).map(listener=>listener(event)));}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='class')this.className=String(value);}
  getAttribute(key){return this.attributes[key]??null;}
  add(child){this.appendChild(child);}
  append(...children){for(const child of children)this.appendChild(child);}
  appendChild(child){child.remove();this.children.push(child);child.parent=this;}
  get parentElement(){return this.parent||null;}
  prepend(child){this.children.unshift(child);child.parent=this;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  set innerHTML(value){this.children=[];}
  querySelector(selector){
    const matches=node=>selector.startsWith('.')?(node.className||'').split(/\s+/).includes(selector.slice(1)):node.tagName===selector.toUpperCase();
    return this.children.find(matches)||this.children.map(child=>child.querySelector(selector)).find(Boolean)||null;
  }
  querySelectorAll(){return [];}
  showModal(){this.open=true;}
  close(){this.open=false;}
  click(){return this.dispatch('click',{target:this});}
}

function harness({search='?backend=webgl&unidades=edificio',fetchData=()=>emptyCommercial,saved=null,standalone=false,
  stockConfig={schema:'liv-sales-config-v1',mode:'desativado'},stockSnapshot=null,onFrameSource=()=>{},inline=false}={}){
  const elements=new Map(),calls=[],frames=[],subscriptions=[],observers=[],events=new Map(),idles=new Map(),images=[];
  const metrics={catalogLoads:0};
  const element=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  element('modalUnitDetails').appendChild(element('detailsBody'));
  const inlineMedia={matches:inline,addEventListener(type,listener){this.listener=listener;}};
  element('mapLink').href='http://localhost/mapa-liv-ipanema-5km.html';
  const modes=['maquete','planta2d','planta3d','visita'].map(mode=>{const button=new Element('button');button.dataset.mode=mode;return button;});
  const unitButtons=[...Array(2)].flatMap(()=>['planta2d','planta3d','visita'].map(mode=>{const button=new Element('button');button.dataset.unitOpen=mode;return button;}));
  element('unitDetails').querySelectorAll=()=>unitButtons.slice(3);
  const createElement=tag=>{
    const node=new Element(tag);
    if(tag==='iframe'){
      const contentWindow=new Element();
      const exterior={ready:true,active:false,backend:'webgl',data:{sourceModelSHA256:pilot.sourceModelSHA256},
        setView(){},setFloor(){},setSelectedUnit(){},setAvailableUnits(){},setUnitView(){},
        setActive(value){exterior.active=value;},dispose(){exterior.disposed=true;exterior.active=false;exterior.disposals=(exterior.disposals||0)+1;}};
      const api={ready:true,active:false,backend:'webgl',get typology(){return new URL(node.src,'http://localhost').searchParams.get('tipologia');},mode:'planta3d',
        setMode(mode){api.mode=mode;},getState:()=>({typology:api.typology,unitSHA256:'fixture-unit',sourceSHA256:'fixture-source',presentation:{enabled:false}}),
        setActive(value){api.active=value;},dispose(){api.disposed=true;api.active=false;api.disposals=(api.disposals||0)+1;},getRoomRoutes:()=>[{id:'sala',name:'Sala',reachable:true},{id:'bloqueado',name:'Área fechada',reachable:false}],
        goToRoom(id){api.lastRoom=id;return Promise.resolve(true);}};
      const map={ready:true,active:false,setActive(value){map.active=value;},dispose(){map.disposed=true;map.active=false;}};
      Object.defineProperties(contentWindow,{__livProva:{get:()=>node.dataset.scene==='exterior'?exterior:undefined},
        __livInterior:{get:()=>node.dataset.scene?.startsWith('interior:')?api:undefined},__livMapAdapter:{get:()=>node.dataset.scene==='map'?map:undefined}});
      node.api={exterior,interior:api,map};
      let src='';Object.defineProperty(node,'src',{get:()=>src,set:value=>{src=value;onFrameSource(node,value);}});
      node.contentWindow=contentWindow;frames.push(node);
    }
    return node;
  };
  const document={getElementById:element,createElement,createElementNS:(_,tag)=>{const node=createElement(tag);node.ownerDocument=document;return node;},querySelector:()=>element('mapLink'),
    querySelectorAll:selector=>selector==='[data-mode]'?modes:selector==='[data-unit-open]'?unitButtons:[]};
  const location={search,pathname:'/maquete-liv-ipanema.html',origin:'http://localhost',hostname:'localhost'};
  const context=vm.createContext({document,location,URL,URLSearchParams,AbortController,DecompressionStream,performance,setTimeout,clearTimeout,
    Option:class extends Element {constructor(text,value){super('option');this.textContent=text;this.value=value;}},
    Image:class extends Element {constructor(){super('img');this.naturalWidth=1200;this.naturalHeight=900;images.push(this);}decode(){this.decodes=(this.decodes||0)+1;return Promise.resolve();}},
    ResizeObserver:class {constructor(callback){this.callback=callback;this.observed=new Set();observers.push(this);}
      observe(node){this.observed.add(node);}disconnect(){this.observed.clear();}notify(){this.callback();}},
    navigator:{},matchMedia:query=>query.includes('min-width: 1000px')?inlineMedia:{matches:false},sessionStorage:{getItem:()=>saved?JSON.stringify(saved):null,setItem:(key,value)=>calls.push({name:'saved-session',value:JSON.parse(value)})},moduleURL:'http://localhost/viewer.js',
    transfers:{pause:async()=>{},prioritize:async()=>{},start:async()=>{},getState:()=>({})},showTransferStatus(){},
    ...planRuler,createBuyerUI,typology,layout:typology,unitById,floorOf,floorLabel,unitScope,requestedEdition,attachCommercial,saleOf,saleLabel,priceLabel,requestedAmbience,AMBIENCES,attachRelations,attachStock,availableUnitIds,
    normalizeHour,solarState,unitSolarContext,createTimeControl:()=>({update(){},dispose(){}}),
    // The viewer and data validators are real; DOM details, rendering and network are controlled boundaries.
    loadStockSDK:async()=>{
      calls.push({name:'estoque-runtime.js',ready:context.__livViewer.ready});
      return {validarConfig,assinarEstoque(checked,onSnapshot){subscriptions.push(checked);onSnapshot(stockSnapshot);return ()=>{};}};
    },
    loadUnitCatalog:async(signal,geometry,scope)=>{metrics.catalogLoads++;return structuredClone(scope==='edificio'?expandBuildingCatalog(pilot):pilot);},
    fetch:async url=>{
      const name=new URL(url).pathname.split('/').at(-1);calls.push({name,ready:context.__livViewer.ready});
      const data=name==='catalogo.json'?interiors:name==='estoque-config.json'||name==='estoque-demo-config.json'?stockConfig:await fetchData(name);
      return {ok:true,json:async()=>structuredClone(data)};
    }});
  context.window=context;context.parent=standalone?context:{};context.addEventListener=(type,listener)=>events.set(type,listener);
  context.requestIdleCallback=callback=>{const id=idles.size+1;idles.set(id,callback);return id;};context.cancelIdleCallback=id=>idles.delete(id);
  vm.runInContext(planSource,context,{filename:'planta2d.js'});
  vm.runInContext(uiSource,context,{filename:'unit-ui.js'});
  vm.runInContext(source,context,{filename:'viewer.js'});
  return {state:context.__livViewer,element,calls,frames,images,modes,unitButtons,subscriptions,observers,events,metrics,
    setInlineDetails(matches){inlineMedia.matches=matches;inlineMedia.listener();},
    runIdle(){const pending=[...idles.values()];idles.clear();for(const callback of pending)callback();}};
}
async function waitFor(test){
  const deadline=performance.now()+1500;
  while(!test()){assert.ok(performance.now()<deadline,'O estado esperado não foi alcançado.');await new Promise(resolve=>setTimeout(resolve,5));}
}

test('uma consulta comercial pendente começa depois da primeira cena utilizável',async()=>{
  let resolveCommercial;
  const pending=new Promise(resolve=>{resolveCommercial=resolve;});
  const app=harness({fetchData:name=>name==='comercial.json'?pending:emptyRelations});
  await waitFor(()=>app.state.ready);
  assert.equal(app.state.error,null);assert.equal(app.frames.length,1);
  assert.ok(app.calls.every(call=>call.ready),'Nenhum dado opcional deve anteceder a cena.');
  resolveCommercial(emptyCommercial);await waitFor(()=>app.state.commercialStatus==='ausente');
});

test('trocar telas durante os dados opcionais pendentes compartilha a consulta em andamento',async()=>{
  let resolveCommercial,resolveRelations;
  const commercial=new Promise(resolve=>{resolveCommercial=resolve;}),relations=new Promise(resolve=>{resolveRelations=resolve;});
  const app=harness({fetchData:name=>name==='comercial.json'?commercial:relations});
  await waitFor(()=>app.calls.some(call=>call.name==='vinculos.json'));
  await app.state.setMode('maquete');await app.state.setMode('maquete');
  assert.equal(app.calls.filter(call=>call.name==='comercial.json').length,1);
  assert.equal(app.calls.filter(call=>call.name==='vinculos.json').length,1);
  resolveCommercial(emptyCommercial);resolveRelations(dualRelations());await waitFor(()=>app.state.relationStatus==='fornecido');
  assert.equal(app.state.ready,true);app.state.dispose();
});

test('HTTP 200 inválido preserva a cena e o retry consulta novamente sem reutilizar JSON inválido',async()=>{
  let data={...commercialFixture(),bookSHA256:'0'.repeat(64)};
  const app=harness({fetchData:name=>name==='comercial.json'?data:emptyRelations});
  await waitFor(()=>app.state.commercialError);
  assert.equal(app.state.ready,true);assert.equal(app.state.error,null);
  assert.equal(app.element('commercialWarning').hidden,false);
  assert.equal(app.state.units.units.some(unit=>unit.commercial?.availability==='disponivel'),false);
  const attempts=app.calls.filter(call=>call.name==='comercial.json').length;
  await app.frames[0].contentWindow.dispatch('liv-renderer-error',{detail:{error:'Falha sintética do renderer'}});
  assert.equal(app.state.ready,false);assert.equal(app.element('retry').hidden,false);
  data=commercialFixture();await app.element('retry').click();
  await waitFor(()=>app.state.ready&&app.state.commercialStatus==='fornecido');
  assert.equal(app.element('commercialWarning').hidden,true);
  assert.equal(app.calls.filter(call=>call.name==='comercial.json').length,attempts+1);
  assert.equal(app.frames.length,2);
});

test('falhas comerciais e de vínculo mantêm snapshots validados entre modos e recuperam',async()=>{
  let commercial=commercialFixture(),relations=relationFixture();
  const app=harness({fetchData:name=>name==='comercial.json'?commercial:relations});
  await waitFor(()=>app.state.commercialStatus==='fornecido'&&app.state.relationStatus==='fornecido');
  const id=pilot.units[0].id;
  app.state.selectUnit(id);
  commercial={...commercial,bookSHA256:'0'.repeat(64)};relations={...relations,bookSHA256:'0'.repeat(64)};
  assert.equal(await app.state.reloadCommercial(),false);assert.equal(await app.state.reloadRelations(),false);
  await app.state.setMode('planta2d');await app.state.setMode('maquete');
  assert.equal(app.state.ready,true);assert.equal(app.state.error,null);
  assert.equal(app.state.units.units.find(unit=>unit.id===id).commercial.priceCents,100001);
  assert.equal(app.state.units.units.find(unit=>unit.id===id).relation.typology,'canto');
  assert.equal(app.element('commercialWarning').hidden,false);assert.equal(app.element('relationWarning').hidden,false);
  commercial=commercialFixture();relations=relationFixture();
  assert.equal(await app.state.reloadCommercial(),true);assert.equal(await app.state.reloadRelations(),true);
  assert.equal(app.element('commercialWarning').hidden,true);assert.equal(app.element('relationWarning').hidden,true);
});

test('vínculo HTTP 200 inválido mantém a primeira cena e recupera em nova navegação',async()=>{
  let relations={...relationFixture(),bookSHA256:'0'.repeat(64)};
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:relations});
  await waitFor(()=>app.state.relationError);
  assert.equal(app.state.ready,true);assert.equal(app.state.error,null);
  assert.equal(app.element('relationWarning').hidden,false);
  assert.equal(app.state.units.units.some(unit=>unit.relation),false);
  const attempts=app.calls.filter(call=>call.name==='vinculos.json').length;
  relations=relationFixture();await app.state.setMode('maquete');
  await waitFor(()=>app.state.relationStatus==='fornecido');
  assert.equal(app.calls.filter(call=>call.name==='vinculos.json').length,attempts+1);
  assert.equal(app.element('relationWarning').hidden,true);
});

test('sessão antiga sem apartamento volta à maquete e atualiza dados opcionais sem bloqueio',async()=>{
  const app=harness({saved:{version:1,mode:'planta2d',typology:'meio',floor:-1,view:'perspectiva'},
    fetchData:name=>name==='comercial.json'?emptyCommercial:emptyRelations});
  await waitFor(()=>app.state.ready&&app.state.commercialStatus==='ausente'&&app.state.relationStatus==='ausente');
  assert.equal(app.state.mode,'maquete');assert.equal(app.frames.length,1);
  assert.ok(app.calls.every(call=>call.ready));
});

test('configuração ativa descobre o imóvel sem parâmetro estoque e usa só o SDK após a cena',async()=>{
  const app=harness({stockConfig:{schema:'liv-sales-config-v1',mode:'firebase',propertyId:'imovel-fixture',
    firebase:{projectId:'liv-fixture',apiKey:'synthetic-key'}},fetchData(){throw Error('JSON local não deve ser consultado para estoque ativo.');}});
  await waitFor(()=>app.state.stockStatus==='nao-publicado');
  assert.equal(app.state.ready,true);assert.equal(app.state.error,null);
  assert.equal(app.state.stockPropertyId,'imovel-fixture');assert.equal(app.subscriptions.length,1);
  assert.deepEqual(app.calls.map(call=>call.name),['estoque-config.json','estoque-runtime.js']);
  assert.ok(app.calls.every(call=>call.ready));
  await app.state.setMode('planta2d');await app.state.setMode('maquete');
  assert.equal(app.subscriptions.length,1);assert.equal(app.calls.length,2);
});

test('configuração desativada consulta JSONs locais após a cena sem baixar o SDK',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?commercialFixture():emptyRelations});
  await waitFor(()=>app.state.commercialStatus==='fornecido'&&app.state.relationStatus==='ausente');
  assert.equal(app.state.ready,true);assert.equal(app.subscriptions.length,0);
  assert.deepEqual(app.calls.map(call=>call.name),['estoque-config.json','comercial.json','vinculos.json']);
  assert.ok(app.calls.every(call=>call.ready));
});

test('piloto explícito mostra as informações sem liberar plantas de uma unidade sem vínculo',async()=>{
  const app=harness({search:'?backend=webgl&unidades=piloto'});await waitFor(()=>app.state.ready);
  app.state.selectUnit(pilot.units[0].id);
  assert.equal(await app.state.setMode('planta2d'),false);
  assert.equal(await app.state.setMode('planta3d'),false);
  assert.equal(await app.state.setMode('visita'),false);
  assert.equal(app.state.mode,'maquete');assert.equal(app.frames.length,1);
  assert.equal(app.state.units.units.some(unit=>unit.relation),false);
  assert.equal(app.element('selectedApartment').hidden,false);assert.equal(app.element('viewModes').hidden,true);
  assert.ok(app.unitButtons.every(button=>button.hidden&&button.disabled));
  assert.equal(app.element('btnApartmentInfo').disabled,false);
  await app.element('btnApartmentInfo').click();assert.equal(app.element('unitDetails').open,true);
  assert.match(app.element('selectedApartmentNote').textContent,/em conferência/);
  assert.equal(await app.state.setTypology('meio'),false);assert.equal(app.state.typology,'canto');
  assert.equal(app.calls.length,0);
});

test('seletor de ambientes usa a API real de rotas e habilita só destinos alcançáveis',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:relationFixture()});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido');
  app.state.selectUnit(pilot.units[0].id);
  await app.state.setMode('visita');
  const rooms=app.element('hostRoomSelect');
  assert.equal(rooms.children.length,2);assert.equal(rooms.children[0].textContent,'Sala');
  assert.equal(rooms.children[1].disabled,true);assert.equal(rooms.disabled,false);
  assert.equal(app.element('hostRoomGo').disabled,false);
  rooms.value='sala';await app.element('hostRoomGo').click();
  assert.equal(app.state.frame.contentWindow.__livInterior.lastRoom,'sala');
  app.state.frame.contentWindow.__livInterior.getRoomRoutes=()=>[
    {id:'bloqueado',name:'Área fechada',reachable:false},{id:'quarto',name:'Quarto',reachable:true}];
  await app.state.setMode('visita');assert.equal(rooms.value,'quarto');
  app.state.frame.contentWindow.__livInterior.getRoomRoutes=()=>[];
  await app.state.setMode('visita');
  assert.equal(rooms.children.length,0);assert.equal(rooms.disabled,true);assert.equal(app.element('hostRoomGo').disabled,true);
});

test('produto sem parâmetros usa a edição de entrada e associa os 170 apartamentos do cadastro',async()=>{
  const app=harness({search:'?backend=webgl',fetchData:name=>name==='comercial.json'?emptyCommercial:read('./vinculos.json')});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido');
  assert.equal(app.state.geometry,'entrada');assert.equal(app.state.unitScope,'edificio');
  assert.equal(app.state.units.units.length,170);assert.equal(app.state.units.units.filter(unit=>unit.relation).length,170);
  assert.equal(app.element('viewModes').hidden,true);assert.equal(app.element('selectedApartment').hidden,true);
  assert.equal(await app.state.setMode('visita'),false);assert.equal(app.state.mode,'maquete');
});

test('seleção de Canto e Meio determina todas as plantas e o Tour, sem troca manual',async()=>{
  const app=harness({search:'?unidades=edificio&experiencia=original',fetchData:name=>name==='comercial.json'?commercialFixture():dualRelations()});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido'&&app.state.commercialStatus==='fornecido');
  const canto=pilot.units[0].id,meio=pilot.units[1].id;
  await app.frames[0].contentWindow.dispatch('liv-unit-selected',{detail:{id:canto}});
  assert.equal(app.element('unitDetails').open,false,'Seleção no modelo mostra o contexto, sem abrir um modal.');
  assert.equal(app.element('selectionPrompt').hidden,true);assert.equal(app.element('selectedApartment').hidden,false);
  assert.match(app.element('selectedApartmentTitle').textContent,/Apartamento TESTE 01/);
  assert.match(app.element('selectedApartmentNote').textContent,/Planta Canto/);
  assert.equal(app.element('viewModes').hidden,true);assert.equal(app.element('selectedApartmentActions').hidden,false);
  await app.unitButtons[0].click();assert.equal(app.state.mode,'planta2d');assert.equal(app.state.typology,'canto');
  assert.match(app.element('stage').querySelector('img').src,/canto\.jpg/);
  assert.equal(app.element('viewModes').hidden,false);assert.equal(app.element('selectedApartmentActions').hidden,true);
  assert.equal(await app.state.setTypology('meio'),false);assert.equal(app.state.typology,'canto');
  await app.state.setMode('maquete');assert.equal(app.state.selectedUnitId,canto);
  app.state.selectUnit(meio);assert.equal(app.state.typology,'meio');assert.match(app.element('selectedApartmentNote').textContent,/Planta Meio/);
  await app.state.setMode('planta2d');assert.match(app.element('stage').children.find(child=>child.dataset.plan==='meio'&&!child.hidden).querySelector('img').src,/meio\.jpg/);
  await app.state.setMode('planta3d');assert.match(app.state.frame.src,/tipologia=meio/);
  await app.state.setMode('visita');assert.equal(app.state.frame.contentWindow.__livInterior.mode,'visita');
  assert.match(app.element('interiorUnitTitle').textContent,new RegExp('Final '+pilot.units[1].final));
});

test('um toque seleciona na fachada; somente o toque duplo abre a planta',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?commercialFixture():dualRelations()});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido');
  const id=pilot.units[0].id;app.state.panelCollapsed=true;
  await app.frames[0].contentWindow.dispatch('liv-unit-selected',{detail:{id}});
  assert.equal(app.state.mode,'maquete');assert.equal(app.state.selectedUnitId,id);
  assert.equal(app.element('selectedApartment').hidden,false);
  await app.frames[0].contentWindow.dispatch('liv-unit-selected',{detail:{id,activate:true}});
  await waitFor(()=>app.state.ready&&app.state.mode==='planta2d');
  assert.equal(app.state.selectedUnitId,id);assert.equal(app.state.panelCollapsed,false);
  assert.equal(app.element('buyerContact').hidden,false);
  assert.equal(app.element('experienceCompare').hidden,true,'O aviso de versão em teste não aparece mais.');
  await app.state.setMode('maquete');
  assert.equal(app.state.selectedUnitId,id);
});

test('toque duplo aguarda a relação e abre a planta correta uma única vez',async()=>{
  let resolveRelations;const pending=new Promise(resolve=>{resolveRelations=resolve;});
  const app=harness({fetchData:name=>name==='comercial.json'?commercialFixture():pending});
  await waitFor(()=>app.state.ready&&app.state.commercialStatus==='fornecido');
  const id=pilot.units[0].id;
  await app.frames[0].contentWindow.dispatch('liv-unit-selected',{detail:{id,activate:true}});
  assert.equal(app.state.mode,'maquete');resolveRelations(dualRelations());
  await waitFor(()=>app.state.ready&&app.state.mode==='planta2d');
  assert.equal(app.state.typology,'canto');await app.state.setMode('maquete');
  assert.equal(app.state.mode,'maquete','Voltar ao prédio não reabre a planta automaticamente.');
});

test('seleção na fachada permite abrir a planta pelo botão Ver planta',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?commercialFixture():dualRelations()});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido');
  const id=pilot.units[1].id;
  await app.frames[0].contentWindow.dispatch('liv-unit-selected',{detail:{id}});
  assert.equal(app.state.mode,'maquete');assert.equal(app.state.selectedUnitId,id);
  await app.unitButtons[0].click();assert.equal(app.state.mode,'planta2d');assert.equal(app.state.typology,'meio');
});

test('entrada pública independente oferece WhatsApp no apartamento; iframe aguarda contato do link',async()=>{
  const direct=harness({standalone:true,fetchData:()=>dualRelations()});
  await waitFor(()=>direct.state.ready&&direct.state.relationStatus==='fornecido');
  direct.state.selectUnit(pilot.units[0].id);
  assert.equal(direct.element('buyerContactLink').hidden,false);
  assert.equal(new URL(direct.element('buyerContactLink').href).pathname,'/5516981288075');
  assert.match(direct.element('buyerContactNote').textContent,/Conecta/);
  const home=direct.element('experienceBar').children.find(child=>child.id==='siteHomeLink');
  assert.equal(home.href,'https://conectaimoveis3d.com.br/');assert.equal(home.textContent,'← Voltar ao site');
  const linked=harness({fetchData:()=>dualRelations()});
  await waitFor(()=>linked.state.ready&&linked.state.relationStatus==='fornecido');
  linked.state.selectUnit(pilot.units[0].id);
  assert.equal(linked.element('buyerContactLink').hidden,true);
  assert.equal(linked.element('buyerContactCopy').hidden,false);
  assert.equal(linked.element('experienceBar').children.some(child=>child.id==='siteHomeLink'),false);
});

test('WhatsApp acompanha o corretor validado sem usar telefone da URL nem o contato institucional',async()=>{
  const id=pilot.units[0].id;
  const app=harness({search:'?unidades=edificio&unidade='+encodeURIComponent(id)+'&modo=planta2d&whatsapp=5511000000000',fetchData:()=>dualRelations()});
  await waitFor(()=>app.state.ready&&app.state.mode==='planta2d');
  assert.equal(app.element('buyerContactLink').hidden,true);
  for(const [brokerName,whatsappNumber] of [['Corretora A','5516999990001'],['Corretor B','5516999990002']]){
    app.state.setContact({contact:{brokerName,whatsappNumber},shareUrl:'http://localhost/acesso.html?l='+ 'a'.repeat(32)});
    const link=app.element('buyerContactLink');
    assert.equal(link.hidden,false);assert.equal(new URL(link.href).pathname,'/'+whatsappNumber);
    assert.match(app.element('buyerContactNote').textContent,new RegExp(brokerName));
    for(const mode of ['maquete','planta3d','visita','planta2d']){
      await app.state.setMode(mode);assert.equal(new URL(link.href).pathname,'/'+whatsappNumber);
    }
  }
  app.state.setContact({contact:{brokerName:'Sem telefone',whatsappNumber:null},shareUrl:'http://localhost/acesso.html?l='+ 'a'.repeat(32)});
  assert.equal(app.element('buyerContactLink').hidden,true);assert.equal(app.element('buyerContactCopy').hidden,false);
});

test('link de unidade sem modo abre a planta e mantém a seleção entre visualizações',async()=>{
  const id=pilot.units[0].id;
  const app=harness({search:'?unidades=edificio&unidade='+encodeURIComponent(id),fetchData:()=>dualRelations()});
  await waitFor(()=>app.state.ready&&app.state.mode==='planta2d');
  for(const mode of ['planta3d','visita','maquete','planta2d']){
    await app.state.setMode(mode);assert.equal(app.state.selectedUnitId,id);
  }
  assert.equal(app.element('projectPanel').dataset.apartment,'true');
  assert.equal(app.element('projectPanel').dataset.mode,'planta2d');
});

test('interesse direto restaura a unidade e contato individual usa apenas telefone público válido',async()=>{
  const id=pilot.units[0].id;
  const app=harness({search:'?unidades=edificio&unidade='+encodeURIComponent(id)+'&modo=planta2d',fetchData:name=>name==='comercial.json'?commercialFixture():dualRelations()});
  await waitFor(()=>app.state.ready&&app.state.mode==='planta2d');
  assert.equal(app.state.selectedUnitId,id);
  app.state.setContact({contact:{brokerName:'Responsável de teste',whatsappNumber:'5581999990000'},shareUrl:'http://localhost/acesso.html?l='+ 'a'.repeat(32)});
  assert.equal(app.element('buyerContactLink').hidden,false);
  const wa=new URL(app.element('buyerContactLink').href);
  assert.equal(wa.hostname,'wa.me');assert.match(wa.searchParams.get('text'),/TESTE 01/);
  assert.match(wa.searchParams.get('text'),/l=aaaaaaaa/);
  app.state.setContact({contact:{brokerName:'Teste',whatsappNumber:'javascript:alert(1)'},shareUrl:'http://localhost/acesso.html?l='+ 'a'.repeat(32)});
  assert.equal(app.element('buyerContactLink').hidden,true);assert.equal(app.element('buyerContactCopy').hidden,false);
});

test('contato atualiza o número quando a tabela comercial chega depois da seleção',async()=>{
  let resolveCommercial;const pending=new Promise(resolve=>{resolveCommercial=resolve;});
  const app=harness({fetchData:name=>name==='comercial.json'?pending:dualRelations()});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido');
  app.state.selectUnit(pilot.units[0].id);
  assert.match(app.element('buyerContactCopy').textContent,/final/);
  resolveCommercial(commercialFixture());await waitFor(()=>app.state.commercialStatus==='fornecido');
  assert.match(app.element('buyerContactCopy').textContent,/TESTE 01/);
});

test('recorte mantém a imagem original e o indicador de entrada acompanha o zoom',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?commercialFixture():dualRelations()});
  app.element('stage').getBoundingClientRect=()=>({width:800,height:600});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido');
  app.state.selectUnit(pilot.units[0].id);await app.state.setMode('planta2d');
  const image=app.images.at(-1);image.naturalWidth=1000;image.naturalHeight=1000;
  await app.element('plan2dReset').click();
  const marker=app.element('stage').querySelector('.plan2d-entry');
  assert.match(image.src,/canto\.jpg$/);assert.match(image.style.maskImage,/canto-recorte\.svg/);
  assert.equal(marker.getAttribute('aria-label'),'Entrada do apartamento');
  const offset=value=>Number(value.match(/\+ ([-\d.]+)px/)[1]);
  assert.ok(Math.abs(offset(marker.style.left)-135.3)<.001);
  await app.element('plan2dZoomIn').click();
  assert.ok(Math.abs(offset(marker.style.left)-169.125)<.001);
  assert.ok(Math.abs(offset(marker.style.top)-177.75)<.001);
});

test('disponíveis acendem de saída e a fachada leva ao cartão do apartamento',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?commercialFixture():dualRelations()});
  await waitFor(()=>app.state.ready&&app.state.commercialStatus==='fornecido');
  assert.equal(app.state.getState().availabilityFilter,'disponiveis');
  assert.equal(app.state.glowingUnitIds.length,1);
  const id=pilot.units[0].id;app.state.selectUnit(id);
  assert.equal(app.element('selectedApartment').hidden,false);
  assert.match(app.element('selectedApartmentSale').textContent,/Disponível/);
  assert.equal(app.element('selectedApartmentTitle').textContent,'Apartamento TESTE 01');
  assert.equal(app.element('detailsTitle').textContent,'Apartamento TESTE 01');
});

test('abertura fixa 6h30, ignora horário antigo e mantém o controle do sol utilizável',async()=>{
  const app=harness({search:'?hora=18',saved:{version:1,mode:'maquete',floor:-1,view:'perspectiva',hour:20}});
  await waitFor(()=>app.state.ready);
  assert.equal(app.state.hour,6.5);
  assert.equal(new URL(app.frames[0].src,'http://localhost').searchParams.get('hora'),'6.5');
  app.state.setTimeOfDay(9);assert.equal(app.state.hour,9);
});

test('iframe do apartamento recebe hora, data e lado antes de iniciar a preparação',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?commercialFixture():relationFixture()});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido');
  app.state.selectUnit(pilot.units[0].id);app.state.setTimeOfDay(7.5);
  await app.state.setMode('planta3d');
  const address=new URL(app.state.frame.src,'http://localhost');
  assert.equal(address.searchParams.get('hora'),'7.5');
  assert.equal(address.searchParams.get('data'),app.state.solarDate);
  const context=JSON.parse(address.searchParams.get('contexto'));
  assert.equal(context.unitId,pilot.units[0].id);
  assert.equal(context.side,unitSolarContext(pilot.units[0]).side);
});

test('informações abre a mesma ficha na maquete e no interior sem alterar a seleção',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?commercialFixture():relationFixture()});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido'&&app.state.commercialStatus==='fornecido');
  app.state.selectUnit(pilot.units[0].id);const initial=app.state.getState();
  await app.element('btnApartmentInfo').click();assert.equal(app.element('unitDetails').open,true);
  assert.deepEqual(app.state.getState(),initial);assert.match(app.element('detailsTitle').textContent,/TESTE 01/);
  await app.element('closeDetails').click();await app.state.setMode('visita');
  const interior=app.state.getState();await app.element('btnApartmentInfo').click();
  assert.equal(app.element('unitDetails').open,true);assert.deepEqual(app.state.getState(),interior);
  assert.match(app.element('detailsTitle').textContent,/TESTE 01/);
});

test('ficha ocupa o painel no desktop e retorna ao modal ao diminuir a tela',async()=>{
  const app=harness({inline:true,fetchData:name=>name==='comercial.json'?commercialFixture():relationFixture()});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido'&&app.state.commercialStatus==='fornecido');
  const body=app.element('detailsBody'),slot=app.element('inlineUnitDetails');
  assert.equal(slot.hidden,true);
  app.state.selectUnit(pilot.units[0].id);
  assert.equal(slot.hidden,false);assert.equal(body.parentElement,slot);
  assert.equal(slot.open,false);
  await app.state.setMode('planta3d');
  assert.equal(body.parentElement,slot);assert.equal(app.element('unitDetails').open,false);
  assert.equal(app.element('interiorUnitTitle').textContent,'Apartamento TESTE 01');
  await app.element('toggleProjectPanel').click();
  await app.element('btnApartmentInfo').click();
  assert.equal(slot.open,true);
  assert.equal(app.state.panelCollapsed,false);assert.equal(app.element('unitDetails').open,false);
  app.setInlineDetails(false);
  assert.equal(slot.hidden,true);assert.equal(body.parentElement,app.element('modalUnitDetails'));
  await app.element('btnApartmentInfo').click();assert.equal(app.element('unitDetails').open,true);
  app.setInlineDetails(true);
  assert.equal(body.parentElement,slot);assert.equal(app.element('unitDetails').open,false);
  app.state.selectUnit(null);assert.equal(slot.hidden,true);
});

test('recolher informações preserva seleção e controles nos quatro modos sem redimensionar a cena',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:relationFixture()});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido');
  const id=pilot.units[0].id;app.state.selectUnit(id);
  const expanded={maquete:420.5,planta2d:260.5,planta3d:312.5,visita:308.5};
  const compact={maquete:82,planta2d:82,planta3d:134,visita:130};
  app.element('projectPanel').getBoundingClientRect=()=>({height:
    (app.element('projectPanelDetails').hidden?compact:expanded)[app.state.mode]});
  assert.equal(app.state.panelCollapsed,true);
  for(const mode of ['maquete','planta2d','planta3d','visita']){
    await app.state.setMode(mode);
    assert.equal(app.element('stage').style.getPropertyValue('--panel-space'),'');
    assert.equal(app.element('projectPanelDetails').hidden,true);assert.equal(app.element('projectPanelFooter').hidden,true);
    assert.equal(app.element('toggleProjectPanel').attributes['aria-expanded'],'false');
    assert.equal(app.element('projectSummary').hidden,mode!=='maquete');
    assert.equal(app.state.selectedUnitId,id);assert.equal(app.state.ready,true);
    assert.equal(app.element(mode==='maquete'?'selectedApartmentActions':'viewModes').hidden,false);
    assert.equal(app.element('interiorNavbar').hidden,mode==='maquete');
  }
  await app.element('toggleProjectPanel').click();
  assert.equal(app.element('stage').style.getPropertyValue('--panel-space'),'');
  assert.equal(app.element('projectPanelDetails').hidden,false);assert.equal(app.element('projectPanelFooter').hidden,false);
  assert.equal(app.element('projectSummary').hidden,true);assert.equal(app.state.mode,'visita');
  await app.state.setMode('maquete');assert.equal(app.element('projectSummary').hidden,false);
});

test('painel começa fechado mesmo quando a sessão anterior estava aberta',async()=>{
  const app=harness({saved:{version:1,mode:'maquete',floor:-1,view:'perspectiva',panelCollapsed:false}});
  await waitFor(()=>app.state.ready);
  assert.equal(app.state.panelCollapsed,true);
  assert.equal(app.element('projectPanelDetails').hidden,true);
  await app.element('toggleProjectPanel').click();
  assert.equal(app.element('projectPanelDetails').hidden,false);
});

test('painel minimizado se ajusta à nova largura e restaura a preferência após recarregar',async()=>{
  const app=harness({saved:{version:1,mode:'maquete',floor:-1,view:'perspectiva',panelCollapsed:true}});
  await waitFor(()=>app.state.ready);
  let expanded=400,compact=82;
  app.element('projectPanel').getBoundingClientRect=()=>({height:app.element('projectPanelDetails').hidden?compact:expanded});
  const observer=app.observers.find(item=>item.observed.has(app.element('projectPanel')));observer.notify();
  assert.equal(app.element('stage').style.getPropertyValue('--panel-space'),'');
  expanded=560;compact=182;observer.notify();
  assert.equal(app.element('stage').style.getPropertyValue('--panel-space'),'');
  app.events.get('pagehide')();assert.equal(observer.observed.size,0);
  assert.equal(app.calls.find(call=>call.name==='saved-session').value.panelCollapsed,true);
  app.events.get('pageshow')({persisted:true});
  await waitFor(()=>app.state.ready);assert.ok(observer.observed.has(app.element('projectPanel')));
  assert.equal(app.element('projectPanelDetails').hidden,true);
});

test('vínculo assíncrono libera as ações só após validar a unidade já selecionada',async()=>{
  let resolveRelations;
  const pending=new Promise(resolve=>{resolveRelations=resolve;});
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:pending});
  await waitFor(()=>app.state.ready);app.state.selectUnit(pilot.units[0].id);
  assert.equal(app.element('selectedApartmentActions').hidden,true);assert.ok(app.unitButtons.every(button=>button.hidden));
  assert.match(app.element('selectedApartmentNote').textContent,/Conferindo/);
  assert.equal(await app.state.setMode('planta3d'),false);assert.equal(app.state.mode,'maquete');
  resolveRelations(relationFixture());await waitFor(()=>app.state.relationStatus==='fornecido');
  assert.equal(app.element('selectedApartmentActions').hidden,false);assert.ok(app.unitButtons.every(button=>!button.hidden&&!button.disabled));
  await app.unitButtons[1].click();assert.equal(app.state.mode,'planta3d');
});

test('sessão com apartamento associado restaura o interior depois da primeira maquete utilizável',async()=>{
  let resolveRelations;
  const pending=new Promise(resolve=>{resolveRelations=resolve;});
  const app=harness({saved:{version:1,mode:'visita',typology:'meio',floor:1,view:'perspectiva',selectedUnitId:pilot.units[0].id},
    fetchData:name=>name==='comercial.json'?emptyCommercial:pending});
  await waitFor(()=>app.state.ready);assert.equal(app.state.mode,'maquete');assert.equal(app.frames.length,1);
  resolveRelations(relationFixture());await waitFor(()=>app.state.ready&&app.state.mode==='visita');
  assert.equal(app.state.typology,'canto');assert.match(app.state.frame.src,/tipologia=canto/);
  assert.ok(app.calls.every(call=>call.ready));assert.equal(app.state.selectedUnitId,pilot.units[0].id);
});

test('sessão com apartamento sem vínculo permanece na maquete',async()=>{
  const app=harness({saved:{version:1,mode:'planta3d',typology:'meio',floor:1,view:'perspectiva',selectedUnitId:pilot.units[0].id},
    fetchData:name=>name==='comercial.json'?emptyCommercial:emptyRelations});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='ausente');
  assert.equal(app.state.mode,'maquete');assert.equal(app.frames.length,1);assert.equal(app.element('viewModes').hidden,true);
  assert.equal(app.element('selectedApartmentActions').hidden,true);assert.match(app.element('selectedApartmentNote').textContent,/em conferência/);
});

test('limpar a seleção no Tour volta à maquete e esconde todas as ações de apartamento',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:relationFixture()});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido');
  app.state.selectUnit(pilot.units[0].id);await app.state.setMode('visita');app.state.selectUnit(null);
  await waitFor(()=>app.state.ready&&app.state.mode==='maquete');
  assert.equal(app.state.selectedUnitId,null);assert.equal(app.element('selectedApartment').hidden,true);
  assert.equal(app.element('selectionPrompt').hidden,false);assert.equal(app.element('viewModes').hidden,true);
  assert.ok(app.unitButtons.every(button=>button.hidden&&button.disabled));assert.equal(await app.state.setMode('planta2d'),false);
});

test('erro da maquete sem apartamento associado não oferece fallback para planta genérica',async()=>{
  const app=harness({search:'?backend=webgl&unidades=piloto'});await waitFor(()=>app.state.ready);
  await app.frames[0].contentWindow.dispatch('liv-renderer-error',{detail:{error:'Falha sintética'}});
  assert.equal(app.element('fallback').hidden,true);await app.element('fallback').click();
  assert.equal(app.state.mode,'maquete');assert.equal(app.element('stage').querySelector('img'),null);
});

test('alteração validada da planta recarrega o interior e retirada do vínculo retorna à maquete',async()=>{
  let relations=relationFixture();
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:relations});
  await waitFor(()=>app.state.ready&&app.state.relationStatus==='fornecido');
  app.state.selectUnit(pilot.units[0].id);await app.state.setMode('visita');assert.match(app.state.frame.src,/tipologia=canto/);
  relations=dualRelations();relations.units=[{...relations.units[1],id:pilot.units[0].id}];
  assert.equal(await app.state.reloadRelations(),true);
  await waitFor(()=>app.state.ready&&app.state.mode==='visita'&&app.state.typology==='meio');
  assert.match(app.state.frame.src,/tipologia=meio/);assert.match(app.element('selectedApartmentNote').textContent,/Planta Meio/);
  relations=emptyRelations;assert.equal(await app.state.reloadRelations(),true);
  await waitFor(()=>app.state.ready&&app.state.mode==='maquete');
  assert.equal(app.element('viewModes').hidden,true);assert.equal(app.element('selectedApartmentActions').hidden,true);
});

test('escolher outro apartamento durante a consulta cancela a restauração de interior da sessão',async()=>{
  let resolveRelations;
  const pending=new Promise(resolve=>{resolveRelations=resolve;});
  const app=harness({saved:{version:1,mode:'visita',typology:'canto',floor:1,view:'perspectiva',selectedUnitId:pilot.units[0].id},
    fetchData:name=>name==='comercial.json'?emptyCommercial:pending});
  await waitFor(()=>app.state.ready);app.state.selectUnit(pilot.units[1].id);
  resolveRelations(dualRelations());await waitFor(()=>app.state.relationStatus==='fornecido');
  assert.equal(app.state.mode,'maquete');assert.equal(app.state.selectedUnitId,pilot.units[1].id);
  assert.equal(app.state.typology,'meio');assert.equal(app.element('selectedApartmentActions').hidden,false);
});

test('abertura prepara só o prédio e as cenas abertas são reaproveitadas sem reconstruir',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations()});
  await waitFor(()=>app.state.relationStatus==='fornecido');app.runIdle();
  await waitFor(()=>app.element('stage').dataset.cache==='ready');
  // Interiors and map are heavy: none is built before the visitor asks.
  assert.equal(app.frames.length,1);assert.equal(app.images.length,2);
  assert.equal(app.metrics.catalogLoads,1);
  assert.ok(app.images.every(image=>image.decodes===1));
  let firstFrames=null;const firstImages=[...app.images],exterior=app.state.frame;
  for(let cycle=0;cycle<3;cycle++){
    if(cycle===1){firstFrames=[...app.frames];assert.equal(firstFrames.length,4);}
    for(const id of [pilot.units[0].id,pilot.units[1].id]){
      app.state.selectUnit(id);
      for(const mode of ['planta2d','planta3d','visita']){
        await app.state.setMode(mode);
        const active=app.frames.filter(frame=>Object.values(frame.api).some(api=>api.active));
        assert.equal(active.length,mode==='planta2d'?0:1);
        assert.equal(app.element('hostPlan2dControls').hidden,mode!=='planta2d');
      }
      await app.state.openMap();assert.equal(app.frames.find(frame=>frame.dataset.scene==='map').api.map.active,true);
      assert.ok(app.frames.filter(frame=>frame.dataset.scene!=='map').every(frame=>!frame.api.exterior.active&&!frame.api.interior.active));
      await app.state.closeMap();assert.equal(app.state.mode,'visita');
      await app.state.setMode('maquete');assert.equal(app.state.frame,exterior);
    }
  }
  assert.deepEqual(app.frames,firstFrames);assert.deepEqual(app.images,firstImages);
  assert.equal(app.metrics.catalogLoads,1);assert.ok(app.images.every(image=>image.decodes===1));
  app.state.dispose();
});

test('zoom de cada planta é preservado ao sair e continua disponível com informações minimizadas',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations()});
  app.element('stage').getBoundingClientRect=()=>({width:1000,height:700,left:0,top:0});
  await waitFor(()=>app.state.relationStatus==='fornecido');await app.state.prepareViews();
  app.state.selectUnit(pilot.units[0].id);await app.state.setMode('planta2d');
  await app.element('plan2dZoomIn').click();await app.element('plan2dZoomIn').click();
  assert.equal(app.element('plan2dZoomValue').textContent,'156%');
  await app.element('toggleProjectPanel').click();assert.equal(app.element('hostPlan2dControls').hidden,false);
  await app.state.setMode('visita');await app.state.setMode('planta2d');
  assert.equal(app.element('plan2dZoomValue').textContent,'156%');
  await app.state.setMode('maquete');app.state.selectUnit(pilot.units[1].id);await app.state.setMode('planta2d');
  assert.equal(app.element('plan2dZoomValue').textContent,'100%');
  await app.element('plan2dZoomIn').click();await app.element('plan2dReset').click();
  assert.equal(app.element('plan2dZoomValue').textContent,'100%');assert.equal(app.element('plan2dZoomOut').disabled,true);
  app.state.dispose();
});

test('medidas permanecem opcionais nas duas plantas e disponíveis com as informações minimizadas',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations()});
  app.element('stage').getBoundingClientRect=()=>({width:1000,height:700,left:0,top:0});
  await waitFor(()=>app.state.relationStatus==='fornecido');await app.state.prepareViews();
  const button=app.element('plan2dMeasurements'),note=app.element('plan2dMeasurementsNote');
  assert.equal(button.hidden,true);assert.equal(note.hidden,true);
  app.state.selectUnit(pilot.units[0].id);await app.state.setMode('planta2d');
  const layers=app.element('stage').children.filter(node=>node.className==='plan2d-layer');
  const canto=layers.find(node=>node.dataset.plan==='canto'),meio=layers.find(node=>node.dataset.plan==='meio');
  assert.equal(button.hidden,false);assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.equal(canto.querySelector('.plan2d-measurements').hidden,true);
  await button.click();assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(note.hidden,false);
  assert.equal(canto.querySelector('.plan2d-measurements').hidden,false);
  assert.equal(app.state.panelCollapsed,true);
  assert.equal(app.element('hostPlan2dControls').hidden,false);assert.equal(button.hidden,false);assert.equal(note.hidden,false);
  await app.state.setMode('visita');assert.equal(button.hidden,true);assert.equal(note.hidden,true);
  await app.state.setMode('planta2d');assert.equal(button.hidden,false);assert.equal(button.getAttribute('aria-pressed'),'true');
  await app.state.setMode('maquete');app.state.selectUnit(pilot.units[1].id);await app.state.setMode('planta2d');
  assert.equal(canto.hidden,true);assert.equal(meio.hidden,false);assert.equal(meio.querySelector('.plan2d-measurements').hidden,false);
  await button.click();assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(note.hidden,true);
  await app.state.openMap();assert.equal(button.hidden,true);assert.equal(note.hidden,true);await app.state.closeMap();
  assert.equal(button.hidden,false);assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.equal(meio.querySelector('.plan2d-measurements').hidden,true);app.state.dispose();
});

test('régua usa dois toques, mantém cotas sob zoom e separa medições das duas plantas',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations()});
  const bounds={width:1000,height:700,left:0,top:0};app.element('stage').getBoundingClientRect=()=>bounds;
  await waitFor(()=>app.state.relationStatus==='fornecido');app.state.selectUnit(pilot.units[0].id);await app.state.setMode('planta2d');
  const layer=app.element('stage').children.find(node=>node.dataset.plan==='canto');layer.getBoundingClientRect=()=>bounds;
  const ruler=app.element('plan2dRuler'),hint=app.element('plan2dRulerHint');
  assert.equal(ruler.hidden,false);await ruler.click();assert.equal(ruler.getAttribute('aria-pressed'),'true');
  const tap=async(x,y)=>{
    const view=app.state.getCacheState().plans.plans.canto;
    const p=planRuler.planToScreen({x,y},view,bounds,typology('canto').ruler),event={pointerId:1,button:0,clientX:p.x+500,clientY:p.y+350,preventDefault(){}};
    await layer.dispatch('pointerdown',event);await layer.dispatch('pointerup',event);
  };
  await tap(108,253);assert.match(hint.textContent,/Primeiro ponto marcado no canto/);
  await app.element('plan2dZoomIn').click();await tap(349,250);
  const plans=()=>app.state.getCacheState().plans.plans;
  assert.equal(plans().canto.rulerMeasures.length,1);assert.equal(plans().canto.rulerMeasures[0].a.x,105);
  assert.match(hint.textContent,/2,68 m/);await app.element('plan2dZoomIn').click();
  assert.equal(plans().canto.rulerMeasures[0].b.x,349);
  await app.state.setMode('maquete');assert.equal(ruler.hidden,true);assert.equal(app.element('plan2dRulerControls').hidden,true);
  app.state.selectUnit(pilot.units[1].id);await app.state.setMode('planta2d');assert.equal(plans().meio.rulerMeasures.length,0);
  await app.state.setMode('maquete');app.state.selectUnit(pilot.units[0].id);await app.state.setMode('planta2d');
  assert.equal(plans().canto.rulerMeasures.length,1);await ruler.click();await app.element('plan2dRulerUndo').click();
  assert.equal(plans().canto.rulerMeasures.length,0);assert.equal(app.element('plan2dRulerUndo').disabled,true);
  await tap(105,250);await layer.dispatch('keydown',{key:'Escape',preventDefault(){}});
  assert.equal(app.element('plan2dRulerUndo').disabled,true);
  for(const key of ['Enter','ArrowRight','ArrowRight','ArrowDown','Enter'])await layer.dispatch('keydown',{key,shiftKey:true,preventDefault(){}});
  assert.equal(plans().canto.rulerMeasures.length,1);await app.element('plan2dRulerClear').click();
  assert.equal(plans().canto.rulerMeasures.length,0);app.state.dispose();
});

test('arrastar, pinçar ou cancelar toque não grava pontos da régua',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:relationFixture()});
  const bounds={width:1000,height:700,left:0,top:0};app.element('stage').getBoundingClientRect=()=>bounds;
  await waitFor(()=>app.state.relationStatus==='fornecido');app.state.selectUnit(pilot.units[0].id);await app.state.setMode('planta2d');
  const layer=app.element('stage').children.find(node=>node.dataset.plan==='canto');layer.getBoundingClientRect=()=>bounds;
  await app.element('plan2dRuler').click();
  const event=(id,x,y)=>({pointerId:id,button:0,clientX:x,clientY:y,preventDefault(){}});
  await layer.dispatch('pointerdown',event(1,300,250));await layer.dispatch('pointermove',event(1,350,270));await layer.dispatch('pointerup',event(1,350,270));
  assert.equal(app.element('plan2dRulerUndo').disabled,true);
  await layer.dispatch('pointerdown',event(1,300,250));await layer.dispatch('pointerdown',event(2,400,250));
  await layer.dispatch('pointermove',event(2,500,250));await layer.dispatch('pointerup',event(1,300,250));await layer.dispatch('pointerup',event(2,500,250));
  assert.equal(app.element('plan2dRulerUndo').disabled,true);
  await layer.dispatch('pointerdown',event(1,300,250));await layer.dispatch('pointercancel',event(1,300,250));
  assert.equal(app.element('plan2dRulerUndo').disabled,true);app.state.dispose();
});

test('escolher um apartamento prepara só o interior dele',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations()});
  await waitFor(()=>app.state.relationStatus==='fornecido');app.runIdle();
  await waitFor(()=>app.element('stage').dataset.cache==='ready');
  app.state.selectUnit(pilot.units[1].id);app.runIdle();
  await waitFor(()=>app.element('stage').dataset.cache==='ready'&&app.frames.length===2);
  assert.deepEqual([...app.state.getCacheState().scenes].sort(),['exterior','interior:meio']);
  assert.equal(app.state.getCacheState().mapReady,false);app.state.dispose();
});

test('navegação e preparação concorrentes compartilham o mesmo interior pendente',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations(),
    onFrameSource:(node,src)=>{if(src.includes('tipologia=canto'))node.api.interior.ready=false;}});
  await waitFor(()=>app.state.relationStatus==='fornecido');app.state.selectUnit(pilot.units[0].id);
  const preload=app.state.prepareViews();
  await waitFor(()=>app.frames.some(node=>node.dataset.scene==='interior:canto'));
  const frame=app.frames.find(node=>node.dataset.scene==='interior:canto'),opening=app.state.setMode('visita');
  await waitFor(()=>app.state.frame===frame);frame.api.interior.ready=true;
  await opening;await preload;
  assert.equal(app.state.frame,frame);assert.equal(app.state.mode,'visita');
  assert.equal(app.frames.filter(node=>node.dataset.scene==='interior:canto').length,1);
  assert.equal(app.frames.length,2);app.state.dispose();
});

test('cena pendente substituída fica no cache sem assumir a tela atual',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations(),
    onFrameSource:(node,src)=>{if(src.includes('tipologia=canto'))node.api.interior.ready=false;}});
  await waitFor(()=>app.state.relationStatus==='fornecido');app.state.selectUnit(pilot.units[0].id);
  const opening=app.state.setMode('visita');await waitFor(()=>app.state.frame?.dataset.scene==='interior:canto');
  const frame=app.state.frame;await app.state.setMode('maquete');frame.api.interior.ready=true;await opening;
  assert.equal(app.state.mode,'maquete');assert.equal(app.state.frame.dataset.scene,'exterior');
  assert.equal(frame.dataset.parked,'true');assert.equal(frame.api.interior.active,false);
  await app.state.setMode('visita');assert.equal(app.state.frame,frame);assert.equal(app.frames.length,2);
  app.state.dispose();
});

test('fechar e reabrir mapa durante a preparação reutiliza uma única instância',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations(),
    onFrameSource:(node,src)=>{if(src.includes('mapa-liv'))node.api.map.ready=false;}});
  await waitFor(()=>app.state.relationStatus==='fornecido');
  const first=app.state.openMap();await waitFor(()=>app.frames.some(node=>node.dataset.scene==='map'));
  const frame=app.frames.find(node=>node.dataset.scene==='map');await app.state.closeMap();
  const second=app.state.openMap();frame.api.map.ready=true;await first;await second;
  assert.equal(app.frames.filter(node=>node.dataset.scene==='map').length,1);assert.equal(frame.api.map.active,true);
  assert.equal(app.element('mapPanel').open,true);await app.state.closeMap();
  assert.equal(frame.api.map.active,false);assert.equal(app.element('mapPanel').attributes['aria-hidden'],'true');
  assert.equal(frame.parent,app.element('mapPanel'));app.state.dispose();
});

test('falha em cena oculta não desmonta as outras e abandono libera o cache inteiro',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations()});
  await waitFor(()=>app.state.relationStatus==='fornecido');app.state.selectUnit(pilot.units[0].id);await app.state.prepareViews();
  const exterior=app.state.frame,canto=app.frames.find(frame=>frame.dataset.scene==='interior:canto');
  await canto.contentWindow.dispatch('liv-renderer-error',{detail:{error:'Falha sintética oculta'}});
  assert.equal(app.state.ready,true);assert.equal(app.state.frame,exterior);assert.equal(app.state.error,null);
  await app.state.setMode('visita');
  assert.notEqual(app.state.frame,canto);assert.equal(app.frames.length,3);
  app.events.get('pagehide')();
  assert.equal(app.element('stage').children.filter(node=>node.tagName==='IFRAME'||node.dataset.plan).length,0);
  assert.equal(app.element('mapPanel').children.length,0);
  assert.ok(app.frames.every(frame=>Object.values(frame.api).some(api=>api.disposed)));
  app.events.get('pageshow')({persisted:true});await waitFor(()=>app.state.ready);
  await app.state.prepareViews();assert.equal(app.state.getCacheState().scenes.length,2);
  assert.equal(app.element('mapPanel').children.length,0);assert.equal(app.images.length,4);
  app.state.dispose();
});

test('falha ao retomar uma cena quente não marca uma tela vazia como pronta',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations()});
  await waitFor(()=>app.state.relationStatus==='fornecido');app.state.selectUnit(pilot.units[0].id);await app.state.prepareViews();
  const frame=app.frames.find(node=>node.dataset.scene==='interior:canto'),api=frame.api.interior;
  api.setActive=async active=>{if(active){api.ready=false;api.error='Falha sintética ao retomar';return false;}};
  await app.state.setMode('visita');assert.equal(app.state.ready,false);assert.match(app.state.error,/Falha sintética ao retomar/);
  assert.equal(app.element('retry').hidden,false);assert.equal(app.state.getCacheState().scenes.length,1);
  await app.element('retry').click();assert.equal(app.state.ready,true);assert.equal(app.state.mode,'visita');
  assert.notEqual(app.state.frame,frame);assert.equal(app.state.getCacheState().scenes.length,2);app.state.dispose();
});

test('abrir a planta de outra tipologia cancela a preparação pendente da anterior',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations(),
    onFrameSource:(node,src)=>{if(src.includes('tipologia=canto'))node.api.interior.ready=false;}});
  await waitFor(()=>app.state.relationStatus==='fornecido');app.state.selectUnit(pilot.units[0].id);
  const opening=app.state.setMode('planta3d');await waitFor(()=>app.state.frame?.dataset.scene==='interior:canto');
  const canto=app.state.frame;await app.state.setMode('maquete');
  assert.equal(app.state.selectUnit(pilot.units[1].id),true);await app.state.setMode('planta3d');await opening;
  assert.equal(canto.api.interior.disposed,true,'A planta pendente de canto disputaria o aparelho com a de meio.');
  assert.equal(app.state.frame.dataset.scene,'interior:meio');assert.equal(app.state.mode,'planta3d');
  assert.deepEqual([...app.state.getCacheState().scenes].sort(),['exterior','interior:meio']);
  app.state.dispose();
});

test('planta já pronta de outra tipologia continua guardada para voltar na hora',async()=>{
  const app=harness({fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations()});
  await waitFor(()=>app.state.relationStatus==='fornecido');app.state.selectUnit(pilot.units[0].id);
  await app.state.setMode('planta3d');const canto=app.state.frame;await app.state.setMode('maquete');
  assert.equal(app.state.selectUnit(pilot.units[1].id),true);await app.state.setMode('planta3d');
  assert.notEqual(canto.api.interior.disposed,true);
  assert.deepEqual([...app.state.getCacheState().scenes].sort(),['exterior','interior:canto','interior:meio']);
  await app.state.setMode('maquete');app.state.selectUnit(pilot.units[0].id);await app.state.setMode('planta3d');assert.equal(app.state.frame,canto);
  app.state.dispose();
});

test('falha gráfica inicial do WebGPU tenta WebGL uma vez em iframe novo',async()=>{
  const app=harness({search:'?unidades=edificio',onFrameSource:(node,src)=>{
    if(src.includes('backend=auto'))Object.assign(node.api.exterior,{ready:false,error:'GPUCanvasContext.configure falhou',graphicsFailure:true,backendAttempt:'webgpu'});
  }});
  await waitFor(()=>app.state.ready);
  assert.equal(app.frames.length,2);assert.equal(app.frames[0].api.exterior.disposed,true);
  assert.match(app.frames[1].src,/backend=webgl/);assert.equal(app.state.error,null);app.state.dispose();
});

test('falha de dados na entrada não dispara tentativa gráfica extra',async()=>{
  const app=harness({search:'?unidades=edificio',onFrameSource:(node,src)=>{
    if(src.includes('prova-rgbm'))Object.assign(node.api.exterior,{ready:false,error:'Catálogo inválido',graphicsFailure:false,backendAttempt:'webgpu'});
  }});
  await waitFor(()=>app.state.error);assert.equal(app.frames.length,1);app.state.dispose();
});

test('sem GPU carrega vínculos, oferece seleção validada e abre 2D sem renderer',async()=>{
  const app=harness({search:'?unidades=edificio',fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations(),onFrameSource:(node,src)=>{
    if(src.includes('prova-rgbm'))Object.assign(node.api.exterior,{ready:false,error:"Cannot read properties of null (reading 'getSupportedExtensions')",graphicsFailure:true,backendAttempt:'webgl'});
  }});
  await waitFor(()=>app.state.error&&app.state.relationStatus==='fornecido');
  assert.equal(app.frames.length,1);assert.match(app.element('loadingText').textContent,/gráficos 3D/);
  const select=app.element('loading').querySelector('select');assert.ok(select);assert.equal(select.children.length,3);
  select.value=pilot.units[1].id;await select.dispatch('change');
  await waitFor(()=>app.state.ready&&app.state.mode==='planta2d');
  assert.equal(app.state.selectedUnitId,pilot.units[1].id);assert.equal(app.state.typology,'meio');app.runIdle();await app.state.prepareViews();
  assert.equal(app.frames.length,1,'2D não dispara outro contexto quebrado em segundo plano.');app.state.dispose();
});

test('link 2D conhecido valida associação e abre sem construir maquete',async()=>{
  const app=harness({search:'?unidades=edificio&unidade='+encodeURIComponent(pilot.units[0].id)+'&modo=planta2d',fetchData:name=>name==='comercial.json'?emptyCommercial:dualRelations()});
  await waitFor(()=>app.state.ready&&app.state.mode==='planta2d');assert.equal(app.frames.length,0);
  app.runIdle();await app.state.prepareViews();assert.equal(app.frames.length,0);app.state.dispose();
});
