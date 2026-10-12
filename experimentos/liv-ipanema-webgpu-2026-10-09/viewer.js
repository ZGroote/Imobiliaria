import {transfers,showTransferStatus} from './transfers.js';
import {typology} from './tipologias.js';
import {unitById} from './unidades.js';
import {loadUnitCatalog,floorOf,unitScope} from './catalogo-unidades.js';
import {createUnitUI} from './unit-ui.js';
import {requestedEdition,exteriorEdition} from './edicoes.js';
import {attachCommercial} from './comercial.js';
import {requestedAmbience,AMBIENCES} from './ambiencia-perfis.js';
import {attachRelations} from './vinculos.js';
import {attachStock} from './estoque-adapter.js';
import {availableUnitIds} from './disponibilidade.js';
const stage=document.getElementById('stage'),overlay=document.getElementById('loading');
const message=document.getElementById('loadingText'),status=document.getElementById('status');
const requested=new URLSearchParams(location.search).get('backend');
const backend=['webgpu','webgl'].includes(requested)?requested:'auto';
const geometry=requestedEdition(location.search);
const demonstration=new URLSearchParams(location.search).get('demonstracao')==='1';
const scope=demonstration||new URLSearchParams(location.search).has('estoque')?'edificio':unitScope(location.search);
const finish=geometry!=='base'||new URLSearchParams(location.search).get('acabamento')==='base'?'base':'referencia';
const environment=new URLSearchParams(location.search).get('ambiente')==='procedural'?'procedural':'precalculado';
const state=window.__livViewer={ready:false,mode:'maquete',typology:'canto',interiorSnapshots:{},view:'perspectiva',floor:-1,selectedUnitId:null,frame:null,error:null,backend:null,pendingCleanup:0,cleanupTimeouts:0};
state.ambience=requestedAmbience(location.search);
state.availabilityFilter='todos';
let units,unitUI;
let commercialData=null,commercialVersion=0,commercialController=null;
let relationsData=null,interiorCatalog=null,relationVersion=0,relationController=null;
let stockData=null,stockControlled=demonstration||new URLSearchParams(location.search).has('estoque'),stockStart=null,stopStock=null,stockVersion=0;
const detailsDialog=document.getElementById('unitDetails');
document.getElementById('demonstrationNote').hidden=!demonstration;
state.geometry=geometry;
state.unitScope=scope;
const storageKey=`liv-viewer-v1:${location.pathname}${geometry==='base'?'':':'+geometry}${scope==='edificio'?':edificio':''}`;
function updateMapLink(){
  const mapLink=document.querySelector('.map-link'),destination=new URL(mapLink.href);
  if(geometry!=='base')destination.searchParams.set('geometria',geometry);
  if(scope==='edificio')destination.searchParams.set('unidades',scope);
  const stockId=new URLSearchParams(location.search).get('estoque');if(stockId)destination.searchParams.set('estoque',stockId);
  if(demonstration)destination.searchParams.set('demonstracao','1');
  if(state.ambience==='entardecer')destination.searchParams.set('luz',state.ambience);else destination.searchParams.delete('luz');
  mapLink.href=destination.href;
}
try {
  const saved=JSON.parse(sessionStorage.getItem(storageKey));
  if(saved?.version===1&&['maquete','planta2d','planta3d','visita'].includes(saved.mode)&&
    Number.isInteger(saved.floor)&&saved.floor>=-1&&saved.floor<=16&&
    ['perspectiva','fachada','aerea','portaria','implantacao','varandas','acesso','livre'].includes(saved.view)) {
    state.mode=saved.mode;state.view=saved.view;state.floor=saved.floor;
    if(!new URLSearchParams(location.search).has('luz')&&Object.hasOwn(AMBIENCES,saved.ambience))state.ambience=saved.ambience;
    if(typeof saved.selectedUnitId==='string'&&(saved.floor===1||(scope==='edificio'&&saved.floor>=0)))state.selectedUnitId=saved.selectedUnitId;
    if(['canto','meio'].includes(saved.typology))state.typology=saved.typology;
    if(saved.interiorSnapshots&&typeof saved.interiorSnapshots==='object')state.interiorSnapshots=saved.interiorSnapshots;
    const snapshot=saved.exteriorSnapshot,cam=snapshot?.camera;
    if(snapshot&&cam&&[cam.position,cam.target].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))state.exteriorSnapshot=snapshot;
    else if(state.view==='livre')state.view='perspectiva';
  }
} catch(error) {state.storageError=String(error);}
updateMapLink();
let generation=0,frameKind=null,openedOnce=false;
// At most Canto and Meio are retained while using interiors. Only one renders.
const parkedInteriors=new Map();
state.interiorReuseCount=0;
showTransferStatus(document.getElementById('transferStatus'));
for(let floor=1;floor<=16;floor++) document.getElementById('floor').add(new Option(`${floor}º pavimento tipo`,String(floor)));
document.getElementById('floor').value=String(state.floor);
document.getElementById('typology').value=state.typology;

function update() {
  document.getElementById('ambience').value=state.ambience;
  document.getElementById('ambience').disabled=!state.ready||state.mode!=='maquete';
  for(const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode));
  for(const button of document.querySelectorAll('[data-view]')) {
    button.disabled=!state.ready||state.mode!=='maquete';
    button.setAttribute('aria-pressed',String(button.dataset.view===state.view));
  }
  document.getElementById('floor').disabled=!state.ready||state.mode!=='maquete';
  document.getElementById('capture').disabled=!state.ready;
  document.getElementById('interiorNote').hidden=state.mode==='maquete';
  const selected=typology(state.typology);
  document.getElementById('interiorNote').textContent=`Planta de ${selected.label.toLowerCase()} · ${selected.area} de área publicada · interior ilustrativo, com medidas inferidas · sem vínculo com uma unidade específica.`;
  const unit=units?unitById(units,state.selectedUnitId):null,associated=unit?.relation?.typology===state.typology;
  if(associated)document.getElementById('interiorNote').textContent=`Referência de ${selected.label.toLowerCase()} associada ao final ${unit.final} pelo cadastro fornecido · interior ilustrativo, com medidas inferidas.`;
  document.getElementById('hint').textContent=state.mode==='visita'?'Arraste para olhar · use o teclado ou o controle na tela para caminhar':
    state.mode==='planta2d'?`Planta comercial publicada · ${selected.label.toLowerCase()}, ${selected.area} incluindo varanda`:
    state.mode==='maquete'?'Clique ou toque num apartamento para ver a ficha · arraste para girar':'Arraste para girar · use a roda ou dois dedos para aproximar';
  unitUI?.update({...state,typology:selected.label.toLowerCase()});
  updateAvailability();
  updateDetails();
}
function updateAvailability(){
  const filter=document.getElementById('availabilityFilter'),select=document.getElementById('availability');
  filter.hidden=!state.ready||state.mode!=='maquete';select.value=state.availabilityFilter;
  const unverified=Boolean(stockControlled?state.stockError:state.commercialError);
  const available=availableUnitIds(units,{unverified}),active=state.availabilityFilter==='disponiveis';
  state.availableUnitCount=available.length;
  state.glowingUnitIds=active?available:[];
  const informed=!unverified&&units?.units.some(unit=>unit.commercial?.availability&&unit.commercial.availability!=='nao_informada');
  filter.dataset.active=String(active&&available.length>0);
  document.getElementById('availabilitySummary').textContent=unverified?'Disponibilidade em atualização. Confirme com a equipe.':
    !informed?'Disponibilidade ainda não informada.':
    available.length===0?'Nenhum apartamento cadastrado como disponível.':
    active?`${available.length} ${available.length===1?'disponível':'disponíveis'} em verde · toque para ver a ficha`:
      `${available.length} ${available.length===1?'disponível':'disponíveis'} · selecione para destacar`;
  if(state.ready&&state.mode==='maquete')state.frame?.contentWindow?.__livProva?.setAvailableUnits(state.glowingUnitIds);
}
function setAvailabilityFilter(value){
  if(!['todos','disponiveis'].includes(value))throw Error('Filtro de disponibilidade inválido.');
  state.availabilityFilter=value;update();
}
function updateDetails(){
  if(!units)return;
  const unit=unitById(units,state.selectedUnitId);
  if(!unit&&detailsDialog.open)detailsDialog.close();
}
function showDetails(){if(state.selectedUnitId&&!detailsDialog.open){updateDetails();detailsDialog.showModal();}}
function busy(text) {
  state.ready=false;state.error=null;overlay.hidden=false;message.textContent=text;
  state.loadingProgress=null;document.getElementById('downloadProgress').hidden=true;
  document.getElementById('retry').hidden=true;document.getElementById('fallback').hidden=true;update();
}
function showError(error) {
  state.ready=false;state.error=String(error);overlay.hidden=false;message.textContent=error.message||String(error);
  status.textContent='Visualizador indisponível';document.getElementById('retry').hidden=false;
  document.getElementById('fallback').hidden=false;update();
  document.getElementById('downloadProgress').hidden=true;
}
function retireFrame(frame) {
  if(frame?.dataset.disposing==='true')return;
  if(frame) {
    if(state.frame===frame)state.frame=null;
    for(const [kind,value]of parkedInteriors)if(value===frame)parkedInteriors.delete(kind);
    let disposal;
    try {
      const api=frame.contentWindow.__livProva;
      if(api?.getState&&!api.disposed){state.exteriorSnapshot=api.getState();state.view=state.exteriorSnapshot.view;}
      disposal=api?.dispose();
      const interior=frame.contentWindow.__livInterior;
      // A ready child may still be waiting for the host to restore its snapshot.
      // Only a prepared frame can replace the last valid camera/layout state.
      if(interior?.getState&&!interior.disposed&&frame.livPrepared)state.interiorSnapshots[interior.typology]=interior.getState();
      if(interior?.dispose)disposal=interior.dispose();
      const legacy=frame.contentWindow.__maq;
      if(legacy){
        const geometries=new Set(),materials=new Set(),textures=new Set();
        legacy.cena.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
        for(const material of materials){for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();}
        frame.contentWindow.__livLightmap?.texture?.dispose();
        legacy.cena.environment?.dispose();legacy.cena.traverse(o=>o.shadow?.dispose());
        for(const geometry of geometries)geometry.dispose();for(const texture of textures)texture.dispose();
        legacy.ren.dispose();legacy.ren.forceContextLoss();
      }
    } catch(error) {state.cleanupError=String(error);}
    if(disposal&&typeof disposal.then==='function') {
      // Keep the realm alive until pending init/render work has settled. Removing
      // it first can strand requestDevice's promise before resources are freed.
      // dispose stops rendering synchronously; the retired frame is never active.
      frame.hidden=true;frame.inert=true;frame.dataset.disposing='true';state.pendingCleanup++;
      let removed=false;
      const remove=()=>{
        if(removed)return;removed=true;clearTimeout(timer);state.pendingCleanup--;
        frame.src='about:blank';frame.remove();
      };
      // A genuinely stuck driver must not block the chosen view indefinitely.
      // Tearing down its browsing context is the final browser-owned fallback.
      const timer=setTimeout(()=>{state.cleanupTimeouts++;remove();},30000);
      Promise.resolve(disposal).catch(error=>{state.cleanupError=String(error);}).then(remove);
    } else {frame.src='about:blank';frame.remove();}
  }
}
function reusableInterior(frame){
  const api=frame?.contentWindow?.__livInterior;
  return Boolean(frame?.livPrepared&&api?.ready&&!api.error&&!api.disposed&&typeof api.setActive==='function');
}
function release({preserveInteriors=false}={}) {
  const frame=state.frame;
  let suspension;
  if(preserveInteriors&&frameKind?.startsWith('interior:')&&reusableInterior(frame)){
    const api=frame.contentWindow.__livInterior;
    state.interiorSnapshots[api.typology]=api.getState();
    suspension=api.setActive(false);
    frame.hidden=true;frame.inert=true;frame.dataset.parked='true';
    parkedInteriors.set(frameKind,frame);state.frame=null;
  }else retireFrame(frame);
  if(!preserveInteriors)for(const cached of [...parkedInteriors.values()])retireFrame(cached);
  stage.querySelector('img')?.remove();frameKind=null;
  return suspension;
}
async function until(test,token,{timeout=90000,progress=null,maximum=600000}={}) {
  const hardDeadline=performance.now()+maximum;
  let deadline=performance.now()+timeout,lastVersion=-1,lastMessage='';
  while(performance.now()<hardDeadline) {
    if(token!==generation) throw Error('Navegação substituída.');
    const current=progress?.();
    if(current&&current.version!==lastVersion){
      lastVersion=current.version;deadline=performance.now()+timeout;state.loadingProgress=current;
      const download=document.getElementById('downloadProgress');
      const ratio=current.total>0?Math.min(1,current.loaded/current.total):null;
      download.hidden=ratio===null;
      if(ratio!==null){download.max=current.total;download.value=current.loaded;}
      // Announce a phase or each ten percent, rather than every streamed chunk.
      const text=current.message+(ratio===null?'…':` · ${Math.floor(ratio*10)*10}%`);
      if(text!==lastMessage){message.textContent=text;lastMessage=text;}
    }
    const value=test();if(value)return value;
    if(performance.now()>=deadline)break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('O visualizador demorou para responder. Tente novamente.');
}
async function fallback2D(token) {
  release();const selected=typology(state.typology),image=new Image();image.alt=selected.imageAlt;
  image.src=selected.image;stage.prepend(image);
  await image.decode();if(token!==generation)return;
  frameKind='image';state.ready=true;state.error=null;state.mode='planta2d';overlay.hidden=true;
  status.textContent='Planta comercial de referência';update();
  openedOnce=true;void transfers.start();
  if(scope==='edificio')void startStock();
}
async function setMode(mode) {
  if(!['maquete','planta2d','planta3d','visita'].includes(mode))throw Error('Modo inválido.');
  const token=++generation;state.mode=mode;
  busy(mode==='maquete'?'Abrindo a maquete…':'Abrindo a planta de referência…');
  try {
    if(!units||mode==='maquete'){
      const catalog=await loadUnitCatalog(undefined,geometry,scope);if(token!==generation)return;
      units=commercialData?attachCommercial(catalog,commercialData):catalog;state.units=units;
      if(relationsData){units=attachRelations(units,relationsData,interiorCatalog);state.units=units;}
      if(stockControlled){units=attachStock(units,stockData,interiorCatalog);state.units=units;}
      try{unitById(units,state.selectedUnitId);}catch{state.selectedUnitId=null;}
      if(unitUI)unitUI.setCatalog(units);
      else unitUI=createUnitUI(units);

      update();
    }
    const kind=mode==='maquete'?'exterior':mode==='planta2d'?'image':`interior:${state.typology}`;
    // Cancel the previous scene immediately, before waiting for the queue ack.
    if(frameKind!==kind)await release({preserveInteriors:kind.startsWith('interior:')});
    if(token!==generation)return;
    const cached=parkedInteriors.get(kind);
    const warm=kind.startsWith('interior:')&&reusableInterior(frameKind===kind?state.frame:cached);
    if(mode==='maquete'){
      // Initial screen starts without waiting for Service Worker registration.
      if(openedOnce||navigator.serviceWorker?.controller)await transfers.pause();
    } else {
      const priority=transfers.prioritize(mode==='planta2d'?'planta2d':'tour',mode==='planta2d'?
        [typology(state.typology).image]:['interiores/catalogo.json','interiores/shared/',`interiores/${state.typology}/`]);
      // A prepared scene needs no downloads or queue acknowledgement to resume.
      if(!warm)await priority;
    }
    if(token!==generation)return;
    if(mode==='planta2d'){await fallback2D(token);return;}
    if(frameKind!==kind) {
      if(warm){
        parkedInteriors.delete(kind);state.frame=cached;frameKind=kind;
        // Keep its browsing context in place; moving an iframe would reload it.
        cached.hidden=false;cached.inert=false;delete cached.dataset.parked;
        await cached.contentWindow.__livInterior.setActive(true);
        if(token!==generation)return;state.interiorReuseCount++;
      }else{
        if(cached)retireFrame(cached);
        const frame=document.createElement('iframe');frame.title=kind==='exterior'?'Maquete do LIV Ipanema':'Planta e interior de referência do LIV Ipanema';
        frame.src=kind==='exterior'?`prova-rgbm.html?embed=1&backend=${backend}&acabamento=${finish}&geometria=${geometry}&selecao=${scope}&ambiente=${environment}&luz=${state.ambience}`:
          `interior.html?embed=1&backend=${backend}&tipologia=${state.typology}&modo=${mode}`;
        stage.prepend(frame);state.frame=frame;frameKind=kind;
      }
    }
    const frame=state.frame;
    if(kind==='exterior') {
        const api=await until(()=>{
          const api=frame.contentWindow?.__livProva;if(api?.error)throw Error(api.error);
          return api?.ready&&api.setFloor?api:null;
        },token,{progress:()=>frame.contentWindow?.__livProva?.progress});
        if(units.sourceModelSHA256!==api.data.sourceModelSHA256)throw Error('O cadastro dos finais pertence a outra edição da maquete.');
        if(!frame.livPrepared){
          if(state.exteriorSnapshot)api.restoreState({...state.exteriorSnapshot,floor:state.floor,selectedUnitId:state.selectedUnitId,ambience:state.ambience});
          else {api.setView(state.view);api.setFloor(state.floor);}
          if(state.floor===1||scope==='edificio')api.setSelectedUnit(state.selectedUnitId);
          frame.contentWindow.addEventListener('liv-unit-selected',event=>{
            if(state.frame===frame&&state.ready&&state.mode==='maquete')selectUnit(event.detail.id,{frameEvent:true});
          });
          frame.contentWindow.addEventListener('liv-renderer-error',event=>{
            if(state.frame===frame&&frameKind==='exterior'){
              // Keep the last camera/floor before the renderer releases resources.
              // A single retry must create a fresh frame instead of reusing its error.
              release();showError(Error(event.detail.error));
            }
          });
          frame.livPrepared=true;
        }
        state.backend=api.backend;
    } else {
      if(!frame.livPrepared){
        const api=await until(()=>{
          const api=frame.contentWindow?.__livInterior;
          if(api?.error)throw Error(api.error);
          return api?.ready?api:null;
        },token,{progress:()=>{
          const queue=transfers.getState(),active=queue.active;
          if(active?.group==='tour')return {version:`queue:${queue.progressVersion}`,phase:'download',
            message:'Baixando o interior selecionado',loaded:active.loaded,total:active.total};
          return frame.contentWindow?.__livInterior?.progress;
        }});
        const snapshot=state.interiorSnapshots[state.typology];
        if(snapshot){
          const current=api.getState();
          if(snapshot.unitSHA256===current.unitSHA256&&snapshot.sourceSHA256===current.sourceSHA256){
            try {api.restoreState(snapshot);}catch(error){state.snapshotError=String(error);delete state.interiorSnapshots[state.typology];}
          } else delete state.interiorSnapshots[state.typology];
        }
        frame.contentWindow.addEventListener('liv-interior-mode',event=>{
          if(state.frame===frame&&['planta3d','visita'].includes(event.detail.mode)){
            state.mode=event.detail.mode;update();
          }
        });
        frame.contentWindow.addEventListener('liv-renderer-error',event=>{
          if(state.frame===frame&&frameKind.startsWith('interior:')){
            release();showError(Error(event.detail.error));
          }else retireFrame(frame);
        });
        frame.livPrepared=true;
      }
      state.backend=frame.contentWindow.__livInterior.backend;
    }
    if(kind.startsWith('interior:')) {
      const win=state.frame.contentWindow;
      await win.__livInterior.setMode(mode);
      await until(()=>win.__livInterior.mode===mode,token);
    }
    if(token!==generation)return;
    state.ready=true;overlay.hidden=true;status.textContent=mode==='maquete'?'Maquete completa carregada':`Planta de referência de ${typology(state.typology).label.toLowerCase()}`;update();
    openedOnce=true;void transfers.start();
    if(scope==='edificio')void startStock();
    if(scope==='edificio'&&!commercialData)void refreshCommercial();
    if(scope==='edificio'&&!relationsData)void refreshRelations();
  } catch(error) {
    if(token!==generation)return;
    if(mode==='planta2d') {
      try {await fallback2D(token);return;}catch(fallbackError){error=fallbackError;}
    }
    if(token!==generation)return;
    release();showError(error);
  }
}
function setView(view) {
  const api=state.frame?.contentWindow?.__livProva;if(!state.ready||!api)return;
  api.setView(view);state.view=view;update();
}
function setAmbience(profile){
  if(!Object.hasOwn(AMBIENCES,profile))throw Error('Ambiência inválida.');
  state.frame?.contentWindow?.__livProva?.setAmbience(profile);state.ambience=profile;
  updateMapLink();update();return true;
}
function setFloor(floor) {
  const value=Number(floor);
  if(!Number.isInteger(value)||value < -1||value >16)throw Error('Pavimento inválido.');
  state.frame?.contentWindow?.__livProva?.setFloor(value);state.floor=value;
  if(state.selectedUnitId&&floorOf(units,unitById(units,state.selectedUnitId))!==value)state.selectedUnitId=null;
  document.getElementById('floor').value=String(floor);
  update();
}
function showUnitSide(side,floor=scope==='edificio'&&state.floor>=0?state.floor:1){
  const api=state.frame?.contentWindow?.__livProva;
  if(!state.ready||state.mode!=='maquete'||!api)return false;
  api.setUnitView(side,floor);state.floor=floor;state.view='livre';
  document.getElementById('floor').value=String(floor);update();return true;
}
function selectUnit(id,{frameEvent=false,showInformation=false}={}){
  if(!units)return false;
  const unit=unitById(units,id),api=state.frame?.contentWindow?.__livProva;
  if(id!==null&&(!state.ready||state.mode!=='maquete'||!api))return false;
  // List selection reveals the appropriate face; canvas taps preserve the orbit.
  if(unit&&!frameEvent)showUnitSide(unit.side,floorOf(units,unit));
  if(unit&&frameEvent){state.floor=floorOf(units,unit);document.getElementById('floor').value=String(state.floor);}
  if(unit?.relation){state.typology=unit.relation.typology;document.getElementById('typology').value=state.typology;}
  state.selectedUnitId=id;api?.setSelectedUnit(id);update();
  if(unit&&(frameEvent||showInformation))showDetails();return true;
}
async function openUnitLayout(){
  const unit=units?unitById(units,state.selectedUnitId):null;
  if(!unit?.relation||!state.ready)return false;
  state.typology=unit.relation.typology;document.getElementById('typology').value=state.typology;
  await setMode('planta2d');return true;
}
async function setTypology(id){
  typology(id);if(id===state.typology)return;
  state.typology=id;document.getElementById('typology').value=id;update();
  if(state.mode!=='maquete')await setMode(state.mode);
}
async function refreshCommercial(){
  if(scope!=='edificio'||!units)return false;
  if(stockControlled)return Boolean(stockData);
  const version=++commercialVersion;commercialController?.abort();
  commercialController=new AbortController();
  try{
    const response=await fetch(new URL('./comercial.json',import.meta.url),{cache:'no-cache',signal:commercialController.signal});
    if(!response.ok)throw Error(`Tabela comercial: HTTP ${response.status}.`);
    const data=await response.json(),next=attachCommercial(units,data);
    if(version!==commercialVersion)return false;
    commercialData=data;units=next;state.units=units;state.commercialStatus=next.commercialStatus;state.commercialError=null;
    document.getElementById('commercialWarning').hidden=true;
    unitUI?.setCatalog(units);update();return true;
  }catch(error){
    if(version!==commercialVersion)return false;
    state.commercialError=String(error);
    document.getElementById('commercialWarning').hidden=false;
    document.getElementById('commercialWarning').textContent=commercialData?.status==='fornecido'?
      'Não foi possível atualizar a tabela. As informações da fonte e data indicadas foram preservadas.':
      'Dados comerciais indisponíveis. Consulte a equipe responsável para confirmar disponibilidade e preço.';
    update();
    return false;
  }
}
async function refreshRelations(){
  if(scope!=='edificio'||!units)return false;
  if(stockControlled)return Boolean(stockData);
  const version=++relationVersion;relationController?.abort();relationController=new AbortController();
  try{
    const response=await fetch(new URL('./vinculos.json',import.meta.url),{cache:'no-cache',signal:relationController.signal});
    if(!response.ok)throw Error(`Vínculos: HTTP ${response.status}.`);
    const data=await response.json();let catalog=interiorCatalog;
    if(data.status==='fornecido'&&!catalog){
      const response=await fetch(new URL('./interiores/catalogo.json',import.meta.url),{cache:'no-cache',signal:relationController.signal});
      if(!response.ok)throw Error('Não foi possível conferir a revisão dos interiores.');
      catalog=await response.json();
    }
    const next=attachRelations(units,data,catalog);if(version!==relationVersion)return false;
    relationsData=data;interiorCatalog=catalog;units=next;state.units=units;state.relationStatus=next.relationStatus;state.relationError=null;
    document.getElementById('relationWarning').hidden=true;
    unitUI?.setCatalog(units);update();return true;
  }catch(error){
    if(error.name==='AbortError'||version!==relationVersion)return false;
    state.relationError=String(error);const warning=document.getElementById('relationWarning');warning.hidden=false;
    warning.textContent=relationsData?'A associação de plantas não pôde ser atualizada. Os últimos vínculos validados foram mantidos.':
      'A associação de plantas não pôde ser conferida. Canto e Meio continuam como referências gerais.';
    return false;
  }
}
function stockWarning(message){
  state.stockError=message||null;
  for(const id of ['stockWarning','detailsStockWarning']){
    const warning=document.getElementById(id);warning.hidden=!message;warning.textContent=message;
  }
  updateAvailability();
}
function startStock(){
  if(stockStart)return stockStart;
  const version=++stockVersion;
  stockStart=(async()=>{
    const response=await fetch(new URL(demonstration?'./estoque-demo-config.json':'./estoque-config.json',import.meta.url),{cache:'no-cache'});
    if(!response.ok)throw Error('Configuração da consulta indisponível.');
    const config=await response.json();if(version!==stockVersion)return false;
    // Disabled/default pages do not download the Firebase bundle or contact the database.
    if(config.mode==='desativado'||(!config.propertyId&&!new URLSearchParams(location.search).get('estoque'))){
      if(stockControlled)stockWarning('A ligação com o painel ainda não está habilitada nesta versão.');return false;
    }
    stockControlled=true;commercialVersion++;commercialController?.abort();relationVersion++;relationController?.abort();
    units=attachStock(units,null,null);state.units=units;unitUI?.setCatalog(units);update();
    const sdk=await import('./estoque-runtime.js');if(version!==stockVersion)return false;
    const checked=sdk.validarConfig(config,location.search,location.hostname);if(!checked)return false;
    state.stockPropertyId=checked.id;state.stockStatus='conectando';let latest=0;
    stopStock=sdk.assinarEstoque(checked,snapshot=>{
      const sequence=++latest;
      void (async()=>{
        if(snapshot?.units.some(u=>u.profileId!==null)&&!interiorCatalog){
          const response=await fetch(new URL('./interiores/catalogo.json',import.meta.url),{cache:'no-cache'});
          if(!response.ok)throw Error('Catálogo das plantas indisponível.');interiorCatalog=await response.json();
        }
        if(version!==stockVersion||sequence!==latest)return;
        const next=attachStock(units,snapshot,interiorCatalog);stockData=snapshot;units=next;state.units=units;
        state.stockStatus=snapshot?'ao-vivo':'nao-publicado';state.commercialStatus=next.commercialStatus;state.relationStatus=next.relationStatus;
        document.getElementById('commercialWarning').hidden=true;document.getElementById('relationWarning').hidden=true;
        unitUI?.setCatalog(units);update();
      })().catch(()=>{if(version===stockVersion)stockWarning('Não foi possível conferir o cadastro. Confirme a disponibilidade com a equipe responsável.');});
    },message=>{if(version===stockVersion)stockWarning(message);});
    return true;
  })().catch(()=>{if(version===stockVersion)stockWarning('Não foi possível conectar ao painel. A disponibilidade precisa ser confirmada com a equipe responsável.');return false;});
  return stockStart;
}
async function capture() {
  if(!state.ready)return;
  if(state.mode==='maquete')return state.frame.contentWindow.__livProva.capture();
  const canvas=document.createElement('canvas');let png;
  if(state.mode==='planta2d') {
    const source=stage.querySelector('img')||state.frame.contentWindow.document.querySelector('#p2d image');
    const image=new Image();image.src=source.tagName==='IMG'?source.src:source.getAttribute('href');await image.decode();
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);png=canvas.toDataURL('image/png');
  } else {
    png=await state.frame.contentWindow.__livInterior.capture();
  }
  const link=document.createElement('a');link.href=png;link.download=`liv-ipanema-${state.typology}-${state.mode}.png`;link.click();return png;
}
Object.assign(state,{setMode,setView,setFloor,setTypology,selectUnit,showUnitSide,capture,setAmbience,setAvailabilityFilter,openUnitLayout,reloadRelations:refreshRelations,reloadCommercial:refreshCommercial,getState:()=>({mode:state.mode,typology:state.typology,view:state.view,floor:state.floor,selectedUnitId:state.selectedUnitId,backend:state.backend,ambience:state.ambience,availabilityFilter:state.availabilityFilter}),dispose:release});
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>setMode(button.dataset.mode));
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>setView(button.dataset.view));
document.getElementById('floor').addEventListener('change',event=>setFloor(event.target.value));
document.getElementById('typology').addEventListener('change',event=>setTypology(event.target.value));
document.getElementById('ambience').addEventListener('change',event=>setAmbience(event.target.value));
document.getElementById('availability').addEventListener('change',event=>setAvailabilityFilter(event.target.value));
document.getElementById('closeDetails').addEventListener('click',()=>detailsDialog.close());
detailsDialog.addEventListener('click',event=>{
  if(event.target!==detailsDialog)return;const r=detailsDialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)detailsDialog.close();
});
for(const button of detailsDialog.querySelectorAll('[data-unit-open]'))button.addEventListener('click',async()=>{
  const unit=unitById(units,state.selectedUnitId);if(!unit?.relation)return;
  state.typology=unit.relation.typology;document.getElementById('typology').value=state.typology;
  detailsDialog.close();await setMode(button.dataset.unitOpen);
});
document.getElementById('capture').addEventListener('click',()=>capture().catch(error=>{status.textContent='Não foi possível capturar a imagem: '+error.message;}));
document.getElementById('retry').addEventListener('click',()=>setMode(state.mode));
document.getElementById('fallback').addEventListener('click',()=>{
  void setMode('planta2d');
});
document.querySelector('.map-link').addEventListener('click',event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();const destination=event.currentTarget.href,token=++generation;
  state.ready=false;release();busy('Abrindo o mapa…');
  transfers.prioritize('map',['mapa-runtime/mapa-liv-ipanema-5km.html',exteriorEdition(geometry).glb,'site-baseline/quintais/'])
    .then(()=>{if(token===generation)location.assign(destination);});
});
window.addEventListener('pagehide',()=>{
  stockVersion++;void stopStock?.();stopStock=null;stockStart=null;
  commercialVersion++;commercialController?.abort();
  relationVersion++;relationController?.abort();
  generation++;state.ready=false;release();
  try {sessionStorage.setItem(storageKey,JSON.stringify({version:1,mode:state.mode,typology:state.typology,interiorSnapshots:state.interiorSnapshots,view:state.view,floor:state.floor,selectedUnitId:state.selectedUnitId,ambience:state.ambience,exteriorSnapshot:state.exteriorSnapshot}));}
  catch(error) {state.storageError=String(error);}
});
window.addEventListener('pageshow',event=>{if(event.persisted)setMode(state.mode);});
setMode(state.mode);
