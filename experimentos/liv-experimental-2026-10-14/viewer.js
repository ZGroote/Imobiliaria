import {transfers,showTransferStatus} from './transfers.js';
import {typology,typologyIds} from './tipologias.js?rev=2026-10-13-medidas2';
import dados from './dados/maquete.js';
import {unitById} from './unidades.js';
import {loadUnitCatalog,floorOf,unitScope} from './catalogo-unidades.js';
import {createUnitUI} from './unit-ui.js';
import {requestedEdition} from './edicoes.js';
import {attachCommercial,priceLabel} from './comercial.js';
import {requestedAmbience,AMBIENCES} from './ambiencia-perfis.js';
import {attachRelations} from './vinculos.js';
import {attachStock} from './estoque-adapter.js';
import {availableUnitIds} from './disponibilidade.js';
import {createPlan2D} from './planta2d.js?rev=2026-10-13-medidas2';
import {createBuyerUI} from './experiencia-compra.js';
const buyerUI=createBuyerUI({document,location,navigator,standalone:window.parent===window});
const stage=document.getElementById('stage'),overlay=document.getElementById('loading');
const projectPanel=document.getElementById('projectPanel'),panelDetails=document.getElementById('projectPanelDetails'),panelFooter=document.getElementById('projectPanelFooter'),panelToggle=document.getElementById('toggleProjectPanel');
const floorControl=document.getElementById('floor'),ambienceControl=document.getElementById('ambience'),captureControl=document.getElementById('capture');
const message=document.getElementById('loadingText'),status=document.getElementById('status');
const requested=new URLSearchParams(location.search).get('backend');
const backend=['webgpu','webgl'].includes(requested)?requested:'auto';
const geometry=new URLSearchParams(location.search).has('geometria')?requestedEdition(location.search):dados.edicaoDaMaquete;
const lastFloor=dados.predio.pavimentos-1,pilotFloor=dados.predio.pavimentoPiloto;
const demonstration=new URLSearchParams(location.search).get('demonstracao')==='1';
const scope=demonstration||new URLSearchParams(location.search).has('estoque')||!new URLSearchParams(location.search).has('unidades')?'edificio':unitScope(location.search);
const finish=geometry!=='base'||new URLSearchParams(location.search).get('acabamento')==='base'?'base':'referencia';
const environment=new URLSearchParams(location.search).get('ambiente')==='procedural'?'procedural':'precalculado';
const state=window.__livViewer={ready:false,mode:'maquete',typology:typologyIds[0],interiorSnapshots:{},view:'perspectiva',floor:-1,selectedUnitId:null,panelCollapsed:false,frame:null,error:null,backend:null,pendingCleanup:0,cleanupTimeouts:0};
state.ambience=requestedAmbience(location.search);
state.availabilityFilter='disponiveis';
let units,unitUI;
let commercialData=null,commercialVersion=0,commercialController=null;
let relationsData=null,interiorCatalog=null,relationVersion=0,relationController=null;
let commercialLoad=null,relationLoad=null;
let stockData=null,stockControlled=demonstration||new URLSearchParams(location.search).has('estoque'),stockStart=null,stopStock=null,stockVersion=0;
const detailsDialog=document.getElementById('unitDetails');
// FICHA-LATERAL-20261023: a mesma ficha ocupa o painel quando há espaço na tela.
const inlineDetails=document.getElementById('inlineUnitDetails'),detailsBody=document.getElementById('detailsBody');
const inlineDetailsMedia=window.matchMedia?.('(min-width: 1000px) and (min-height: 720px)');
inlineDetailsMedia?.addEventListener('change',()=>updateInfoPanel());
document.getElementById('demonstrationNote').hidden=!demonstration;
state.geometry=geometry;
state.unitScope=scope;
const storageKey=`liv-viewer-v1:${location.pathname}${geometry==='base'?'':':'+geometry}${scope==='edificio'?':edificio':''}`;
let restoredInterior=null,pendingBuyerLayout=null;
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
    Number.isInteger(saved.floor)&&saved.floor>=-1&&saved.floor<=lastFloor&&
    [...Object.keys(dados.vistasDaCena),...Object.keys(dados.vistasExtras),'livre'].includes(saved.view)) {
    state.view=saved.view;state.floor=saved.floor;
    if(typeof saved.panelCollapsed==='boolean')state.panelCollapsed=saved.panelCollapsed;
    if(!new URLSearchParams(location.search).has('luz')&&Object.hasOwn(AMBIENCES,saved.ambience))state.ambience=saved.ambience;
    if(typeof saved.selectedUnitId==='string'&&(saved.floor===pilotFloor||(scope==='edificio'&&saved.floor>=0)))state.selectedUnitId=saved.selectedUnitId;
    if(saved.mode!=='maquete'&&state.selectedUnitId)restoredInterior={mode:saved.mode,unitId:state.selectedUnitId};
    if(typologyIds.includes(saved.typology))state.typology=saved.typology;
    if(saved.interiorSnapshots&&typeof saved.interiorSnapshots==='object')state.interiorSnapshots=saved.interiorSnapshots;
    const snapshot=saved.exteriorSnapshot,cam=snapshot?.camera;
    if(snapshot&&cam&&[cam.position,cam.target].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))state.exteriorSnapshot=snapshot;
    else if(state.view==='livre')state.view='perspectiva';
  }
} catch(error) {state.storageError=String(error);}
updateMapLink();
let generation=0,frameKind=null,openedOnce=false;
// One exterior, two interiors, two decoded plans and one map per page. Keep
// browsing contexts in place: moving an iframe would reload its resources.
const sceneCache=new Map(),sceneLoads=new Map();
let cacheEpoch=0,cacheStopped=false,warmJob=null,warmHandle=null,sceneSerial=0;
const planControls={in:document.getElementById('plan2dZoomIn'),out:document.getElementById('plan2dZoomOut'),reset:document.getElementById('plan2dReset'),value:document.getElementById('plan2dZoomValue'),measurements:document.getElementById('plan2dMeasurements'),measurementsNote:document.getElementById('plan2dMeasurementsNote')};
let plans=createPlan2D(stage,planControls);
const mapPanel=document.getElementById('mapPanel');
let mapFrame=null,mapLoad=null,mapReturnMode=null,mapURL=null;
state.interiorReuseCount=0;
state.sceneReuseCount=0;
showTransferStatus(document.getElementById('transferStatus'));
if(floorControl){
  for(let floor=1;floor<=lastFloor;floor++)floorControl.add(new Option(`${floor}º pavimento tipo`,String(floor)));
  floorControl.value=String(state.floor);
}
document.getElementById('typology').value=state.typology;

function selectedApartment(){return units?unitById(units,state.selectedUnitId):null;}
function hasApartmentLayout(unit=selectedApartment()){
  return Boolean(unit?.relation&&typologyIds.includes(unit.relation.typology)&&unit.relation.orientation==='original');
}
function revealOnMobile(id){
  if(!window.matchMedia?.('(max-width: 760px)').matches)return;
  document.getElementById(id)?.scrollIntoView({block:'start',
    behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}

function updateInfoPanel(){
  if(!projectPanel||!panelDetails||!panelFooter||!panelToggle)return;
  if(inlineDetails){
    const inline=Boolean(inlineDetailsMedia?.matches),target=inline?inlineDetails:document.getElementById('modalUnitDetails');
    if(detailsBody.parentElement!==target)target.appendChild(detailsBody);
    inlineDetails.hidden=!inline||!selectedApartment();
    if(inline&&detailsDialog.open)detailsDialog.close();
  }
  const collapsed=state.panelCollapsed,label=collapsed?'Restaurar informações':'Minimizar informações';
  panelToggle.setAttribute('aria-expanded',String(!collapsed));
  panelToggle.setAttribute('aria-label',label);panelToggle.title=label;
  document.getElementById('panelToggleIcon').textContent=collapsed?'+':'−';
  projectPanel.dataset.collapsed='false';panelDetails.hidden=false;panelFooter.hidden=false;
  let gained=0;
  if(collapsed){
    // Measure both layouts in one task, before painting. Wrapping, selected
    // apartment data and mode controls determine the actual space recovered.
    const expandedHeight=projectPanel.getBoundingClientRect().height;
    projectPanel.dataset.collapsed='true';panelDetails.hidden=true;panelFooter.hidden=true;
    gained=Math.max(0,expandedHeight-projectPanel.getBoundingClientRect().height);
  }
  const space=`${gained}px`;
  if(stage.style.getPropertyValue('--panel-space')!==space)stage.style.setProperty('--panel-space',space);
}
const panelResize=typeof ResizeObserver==='function'?new ResizeObserver(updateInfoPanel):null;

function update() {
  const exterior=state.mode==='maquete';
  const unit=selectedApartment(),associated=hasApartmentLayout(unit);
  if(!exterior&&associated&&state.typology!==unit.relation.typology){void setMode(state.mode);return;}
  if(associated){state.typology=unit.relation.typology;document.getElementById('typology').value=state.typology;}
  // A removed association or a cleared selection must never leave an unrelated
  // apartment's interior on screen. Keep the exterior selection workflow usable.
  if(!exterior&&!associated){void setMode('maquete');return;}
  const projectSummary=document.getElementById('projectSummary');
  if(projectSummary)projectSummary.hidden=!exterior;
  const referenceControls=document.getElementById('referenceControls');
  if(referenceControls)referenceControls.hidden=true;
  document.getElementById('typology').disabled=true;
  const modes=document.getElementById('viewModes');if(modes)modes.hidden=exterior||!associated;
  if(ambienceControl){ambienceControl.value=state.ambience;ambienceControl.disabled=!state.ready||!exterior;}
  for(const button of document.querySelectorAll('[data-mode]')) {
    button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode));
    button.disabled=button.dataset.mode!=='maquete'&&(!state.ready||!associated);
  }
  for(const button of document.querySelectorAll('[data-view]')) {
    button.disabled=!state.ready||state.mode!=='maquete';
    button.setAttribute('aria-pressed',String(button.dataset.view===state.view));
  }
  if(floorControl)floorControl.disabled=!state.ready||!exterior;
  if(captureControl)captureControl.disabled=!state.ready;
  document.getElementById('interiorNote').hidden=exterior;
  const selected=typology(state.typology);
  document.getElementById('interiorNote').textContent=`Planta de ${selected.label.toLowerCase()} · ${selected.area} de área publicada · interior ilustrativo, com medidas inferidas · sem vínculo com uma unidade específica.`;
  if(associated)document.getElementById('interiorNote').textContent=`Referência de ${selected.label.toLowerCase()} associada ao final ${unit.final} pelo cadastro fornecido · interior ilustrativo, com medidas inferidas.`;
  document.getElementById('hint').textContent=state.mode==='visita'?'Arraste para olhar · use o teclado ou o controle na tela para caminhar':
    state.mode==='planta2d'?`Planta comercial publicada · ${selected.label.toLowerCase()}, ${selected.area} incluindo varanda`:
    state.mode==='maquete'?'Arraste para girar · use a roda ou dois dedos para aproximar':'Arraste para girar · use a roda ou dois dedos para aproximar';
  unitUI?.update({...state,typology:selected.label.toLowerCase()});
  updateAvailability();
  if(state.ready&&exterior)state.frame?.contentWindow?.__livProva?.setParkingSpaces?.(unit?.parkingSpaces??[]);
  updateDetails();
  updateNavbar();
  updateInfoPanel();
  buyerUI.update(unit,unit?floorOf(units,unit):null,state.mode);
  // EXPERIMENTO-COMPRA-20261023: só ações do visitante abrem a planta automaticamente.
  if(buyerUI.enabled&&pendingBuyerLayout===unit?.id&&state.ready&&exterior&&associated){
    pendingBuyerLayout=null;state.panelCollapsed=false;void setMode('planta2d');
  }
  if(restoredInterior&&state.ready&&exterior&&associated&&restoredInterior.unitId===state.selectedUnitId){
    const mode=restoredInterior.mode;restoredInterior=null;void setMode(mode,{restore:true});
  }
}
function syncHostRooms(){
  const api=state.frame?.contentWindow?.__livInterior;
  if(!api||!api.ready)return;
  const routes=api.getRoomRoutes?api.getRoomRoutes():(api.rooms||[]);
  const select=document.getElementById('hostRoomSelect');
  if(!select)return;
  const current=select.value;
  select.innerHTML='';
  for(const r of routes){
    const opt=document.createElement('option');
    opt.value=r.id;
    opt.textContent=r.name+(r.reachable?'':' (bloqueado)');
    opt.disabled=!r.reachable;
    select.appendChild(opt);
  }
  const reachable=routes.filter(r=>r.reachable);
  select.value=reachable.some(r=>r.id===current)?current:reachable[0]?.id||'';
  select.disabled=!state.ready||!reachable.length;
  const go=document.getElementById('hostRoomGo');
  if(go)go.disabled=select.disabled;
}
function updateNavbar(){
  const navbar=document.getElementById('interiorNavbar');
  if(!navbar)return;
  navbar.hidden=state.mode==='maquete';
  if(state.mode==='maquete')return;
  const unit=units?unitById(units,state.selectedUnitId):null;
  const title=document.getElementById('interiorUnitTitle');
  const subtitle=document.getElementById('interiorUnitSubtitle');
  const sel=typology(state.typology);
  const associated=hasApartmentLayout(unit);
  if(associated){
    const num=unit.commercial?.commercialNumber?('Apartamento '+unit.commercial.commercialNumber):('Final '+unit.final);
    if(title)title.textContent=num;
    if(subtitle)subtitle.textContent='Planta '+sel.label+' · interior ilustrativo';
  } else {
    if(title)title.textContent='Planta de referência · '+sel.label;
    if(subtitle)subtitle.textContent=sel.area+' de área publicada · interior ilustrativo';
  }
  const card=document.getElementById('btnOpenUnitCard');
  if(card){card.hidden=true;card.disabled=!state.ready||!associated;}
  const hostTour=document.getElementById('hostTourControls');
  const hostPlan=document.getElementById('hostPlanControls');
  const hostPlan2d=document.getElementById('hostPlan2dControls');
  if(hostTour)hostTour.hidden=state.mode!=='visita';
  if(hostPlan)hostPlan.hidden=state.mode!=='planta3d';
  if(hostPlan2d)hostPlan2d.hidden=state.mode!=='planta2d';
  if(planControls.reset)planControls.reset.disabled=!state.ready||state.mode!=='planta2d';
  const cutBtn=document.getElementById('hostCutParedes');
  if(cutBtn&&state.frame?.contentWindow?.__livInterior){
    const enabled=Boolean(state.frame.contentWindow.__livInterior.getState?.()?.presentation?.enabled);
    cutBtn.setAttribute('aria-pressed',String(enabled));
    cutBtn.textContent=enabled?'Paredes inteiras':'Paredes baixas';
  }
  for(const id of ['hostCutParedes','hostFramePlan']){
    const control=document.getElementById(id);if(control)control.disabled=!state.ready||state.mode!=='planta3d';
  }
  if(state.mode==='visita'&&state.ready)syncHostRooms();
  else for(const id of ['hostRoomSelect','hostRoomGo']){
    const control=document.getElementById(id);if(control)control.disabled=true;
  }
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
    active?`${available.length} ${available.length===1?'disponível':'disponíveis'} em verde · ${buyerUI.enabled?'2 toques abrem a planta':'toque para ver a ficha'}`:
      `${available.length} ${available.length===1?'disponível':'disponíveis'} · selecione para destacar`;
  if(state.ready&&state.mode==='maquete')state.frame?.contentWindow?.__livProva?.setAvailableUnits(state.glowingUnitIds);
  renderAvailableList(available);
}
// Facade targets are small on a phone: the list is the buyer's main way in.
let listedUnits=null,listedKey='';
function renderAvailableList(available){
  const section=document.getElementById('availableUnits'),list=document.getElementById('availableUnitList');
  document.getElementById('selectionPrompt').textContent=buyerUI.enabled?
    'Um toque seleciona. Dois toques no mesmo apartamento abrem a planta. Você também pode escolher na lista.':
    available.length?'Toque num apartamento verde no prédio ou escolha na lista abaixo.':'Toque num apartamento do prédio para ver a planta e o Tour.';
  section.hidden=!state.ready||state.mode!=='maquete'||Boolean(selectedApartment())||!available.length;
  const key=available.join();
  if(section.hidden||(units===listedUnits&&key===listedKey))return;
  listedUnits=units;listedKey=key;
  document.getElementById('availableUnitsTitle').textContent=`${available.length} ${available.length===1?'apartamento disponível':'apartamentos disponíveis'}`;
  const number=new Intl.NumberFormat('pt-BR');
  const rows=available.map(id=>unitById(units,id)).sort((a,b)=>floorOf(units,a)-floorOf(units,b)||String(a.final).localeCompare(String(b.final)));
  list.innerHTML='';
  for(const unit of rows){
    const area=unit.salesDetails?.areaM2;
    const button=document.createElement('button');button.type='button';button.dataset.unitId=unit.id;
    const code=unit.commercial?.commercialNumber;
    for(const text of [code?(/^\d+$/.test(code)?`Apto ${code}`:code):`Final ${unit.final}`,
      area===null||area===undefined?'—':`${number.format(area)} m²`,priceLabel(unit)]){
      const cell=document.createElement('span');cell.textContent=text;button.append(cell);
    }
    const item=document.createElement('li');item.append(button);list.append(item);
  }
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
function showDetails(){
  if(!selectedApartment())return false;
  if(inlineDetails&&!inlineDetails.hidden){state.panelCollapsed=false;updateInfoPanel();return true;}
  if(!detailsDialog.open){updateDetails();detailsDialog.showModal();return true;}return false;
}
function busy(text,{warm=false}={}) {
  state.ready=false;state.error=null;overlay.hidden=warm;message.textContent=text;
  state.loadingProgress=null;document.getElementById('downloadProgress').hidden=true;
  document.getElementById('retry').hidden=true;document.getElementById('fallback').hidden=true;update();
}
function showError(error) {
  state.ready=false;state.error=String(error);overlay.hidden=false;message.textContent=error.message||String(error);
  status.textContent='Visualizador indisponível';document.getElementById('retry').hidden=false;
  document.getElementById('fallback').hidden=!hasApartmentLayout();update();
  document.getElementById('downloadProgress').hidden=true;
}
function retireFrame(frame) {
  if(frame?.dataset.disposing==='true')return;
  if(frame) {
    if(state.frame===frame)state.frame=null;
    for(const [kind,value]of sceneCache)if(value===frame)sceneCache.delete(kind);
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
function sceneAPI(frame){return frame?.dataset.scene==='exterior'?frame.contentWindow?.__livProva:frame?.contentWindow?.__livInterior;}
function reusableScene(frame){
  const api=sceneAPI(frame);
  return Boolean(frame?.livPrepared&&api?.ready&&!api.error&&!api.disposed&&typeof api.setActive==='function');
}
function parkFrame(frame){
  if(!frame)return;
  const api=sceneAPI(frame);
  frame.dataset.parked='true';frame.inert=true;frame.setAttribute('aria-hidden','true');
  return api?.setActive?.(false);
}
function release({preserveCache=false}={}) {
  const frame=state.frame;
  let suspension;
  if(preserveCache&&frame&&frame.dataset.disposing!=='true'){
    suspension=parkFrame(frame);state.frame=null;
  }else retireFrame(frame);
  if(!preserveCache)for(const cached of [...sceneCache.values()])retireFrame(cached);
  plans.hide();frameKind=null;
  return suspension;
}
async function until(test,token,{timeout=90000,progress=null,maximum=600000,current:stillCurrent=()=>token===generation}={}) {
  const hardDeadline=performance.now()+maximum;
  let deadline=performance.now()+timeout,lastVersion=-1,lastMessage='';
  while(performance.now()<hardDeadline) {
    if(!stillCurrent()) throw Error('Navegação substituída.');
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
  if(!hasApartmentLayout())return false;
  const key=state.typology;
  await plans.prepare(key,typology(key));if(token!==generation)return;
  plans.show(key);
  frameKind='image';state.ready=true;state.error=null;state.mode='planta2d';overlay.hidden=true;
  status.textContent='Planta comercial de referência';update();
  openedOnce=true;void transfers.start();
  refreshOptionalData();scheduleWarmViews();
}
async function refreshOptionalData(){
  if(scope!=='edificio')return;
  // The saved configuration can enable a property without a URL parameter.
  // Discover it after the scene is ready, before choosing its data source.
  await startStock();
  if(stockControlled)return;
  // Optional records never delay a usable scene. Failed responses are not
  // retained, and another navigation can retry while keeping validated data.
  if((!commercialData||state.commercialError)&&!commercialLoad){
    const job=refreshCommercial();commercialLoad=job;
    job.finally(()=>{if(commercialLoad===job)commercialLoad=null;});
  }
  if((!relationsData||state.relationError)&&!relationLoad){
    const job=refreshRelations();relationLoad=job;
    job.finally(()=>{if(relationLoad===job)relationLoad=null;});
  }
}
function sceneFailure(frame,error){
  const foreground=state.frame===frame;
  retireFrame(frame);
  if(foreground){frameKind=null;showError(error);}
}
function prepareScene(kind){
  const cached=sceneCache.get(kind);
  if(reusableScene(cached))return Promise.resolve(cached);
  if(sceneLoads.has(kind))return sceneLoads.get(kind);
  if(cached)retireFrame(cached);
  const epoch=cacheEpoch,key=kind.split(':')[1],exterior=kind==='exterior';
  const frame=document.createElement('iframe');frame.dataset.scene=kind;frame.dataset.instance=String(++sceneSerial);frame.dataset.parked='true';frame.inert=true;
  frame.setAttribute('aria-hidden','true');
  frame.title=exterior?`Maquete do ${dados.nome}`:`Planta e Tour do ${dados.nome} · ${typology(key).label}`;
  frame.src=exterior?`prova-rgbm.html?embed=1&prewarm=1&tema=escuro&backend=${backend}&acabamento=${finish}&geometria=${geometry}&selecao=${scope}&ambiente=${environment}&luz=${state.ambience}&experiencia=${buyerUI.enabled?'nova':'original'}`:
    `interior.html?embed=1&prewarm=1&backend=${backend}&tipologia=${key}&modo=planta3d`;
  sceneCache.set(kind,frame);stage.prepend(frame);
  const current=()=>!cacheStopped&&cacheEpoch===epoch&&sceneCache.get(kind)===frame;
  const job=(async()=>{
    const api=await until(()=>{
      const api=sceneAPI(frame);if(api?.error)throw Error(api.error);
      return api?.ready?api:null;
    },null,{current,progress:()=>state.frame===frame?sceneAPI(frame)?.progress:null});
    if(!current())throw Error('Visualizador encerrado.');
    if(exterior){
      if(units.sourceModelSHA256!==api.data.sourceModelSHA256)throw Error('O cadastro dos finais pertence a outra edição da maquete.');
      if(state.exteriorSnapshot)api.restoreState({...state.exteriorSnapshot,floor:state.floor,selectedUnitId:state.selectedUnitId,ambience:state.ambience});
      else {api.setView(state.view);api.setFloor(state.floor);}
      if(state.floor===pilotFloor||scope==='edificio')api.setSelectedUnit(state.selectedUnitId);
      frame.contentWindow.addEventListener('liv-unit-selected',event=>{
        if(state.frame===frame&&state.ready&&state.mode==='maquete')selectUnit(event.detail.id,{frameEvent:true,openLayout:buyerUI.enabled&&event.detail.activate===true});
      });
    }else{
      const snapshot=state.interiorSnapshots[key];
      if(snapshot){
        const now=api.getState();
        if(snapshot.unitSHA256===now.unitSHA256&&snapshot.sourceSHA256===now.sourceSHA256){
          try {api.restoreState(snapshot);}catch(error){state.snapshotError=String(error);delete state.interiorSnapshots[key];}
        }else delete state.interiorSnapshots[key];
      }
      frame.contentWindow.addEventListener('liv-interior-mode',event=>{
        if(state.frame===frame&&state.ready&&['planta3d','visita'].includes(event.detail.mode)){
          state.mode=event.detail.mode;update();
        }
      });
    }
    frame.contentWindow.addEventListener('liv-renderer-error',event=>sceneFailure(frame,Error(event.detail.error)));
    await api.setActive(false);
    if(!current())throw Error('Visualizador encerrado.');
    frame.livPrepared=true;frame.dataset.ready='true';return frame;
  })();
  sceneLoads.set(kind,job);
  job.catch(()=>{if(sceneCache.get(kind)===frame)retireFrame(frame);}).finally(()=>{if(sceneLoads.get(kind)===job)sceneLoads.delete(kind);});
  return job;
}
function scheduleWarmViews(){
  if(cacheStopped||warmJob||warmHandle!==null)return;
  const epoch=cacheEpoch;
  const run=()=>{warmHandle=null;if(cacheStopped||cacheEpoch!==epoch)return;void prepareViews();};
  warmHandle=window.requestIdleCallback?window.requestIdleCallback(run,{timeout:1000}):setTimeout(run,0);
}
function prepareViews(){
  if(warmJob)return warmJob;
  if(cacheStopped||!units)return Promise.resolve(false);
  const epoch=cacheEpoch,cacheStatus=document.getElementById('sceneCacheStatus');
  cacheStatus.textContent='Preparando as visualizações…';stage.dataset.cache='preparing';
  const job=(async()=>{
    const failures=[];
    const attempt=async task=>{try {await task();}catch(error){failures.push(String(error));if(!cacheStopped&&epoch===cacheEpoch)console.warn('Preparação de uma visualização:',error);}};
    await Promise.all(typologyIds.map(key=>attempt(()=>plans.prepare(key,typology(key)))));
    // Prepare one graphics context at a time. Navigation shares an in-flight
    // preparation instead of creating another copy of the same screen.
    // Only the selected apartment's interior: warming both interiors and the
    // map right after opening froze the maquette for ~10 s. The map and any
    // other interior are prepared when opened.
    const unit=selectedApartment(),kinds=['exterior'];
    if(hasApartmentLayout(unit))kinds.push(`interior:${unit.relation.typology}`);
    for(const kind of kinds){
      if(cacheStopped||epoch!==cacheEpoch)return false;
      await attempt(()=>prepareScene(kind));
    }
    if(cacheStopped||epoch!==cacheEpoch)return false;
    state.cacheErrors=failures;stage.dataset.cache=failures.length?'partial':'ready';
    cacheStatus.textContent=failures.length?'Algumas visualizações serão preparadas ao abrir.':'Visualizações prontas para reabrir.';
    return failures.length===0;
  })();
  warmJob=job;job.finally(()=>{if(warmJob===job)warmJob=null;});return job;
}
async function setMode(mode,{restore=false}={}) {
  if(!['maquete','planta2d','planta3d','visita'].includes(mode))throw Error('Modo inválido.');
  if(!restore)restoredInterior=null;
  if(mode!=='maquete'){
    const unit=selectedApartment();
    if(!hasApartmentLayout(unit))return false;
    state.typology=unit.relation.typology;document.getElementById('typology').value=state.typology;
  }
  if(cacheStopped){cacheStopped=false;plans=createPlan2D(stage,planControls);}
  if(state.mapOpen)closeMap({restore:false});
  if(projectPanel)panelResize?.observe(projectPanel);
  const token=++generation;state.mode=mode;
  const targetKind=mode==='maquete'?'exterior':`interior:${state.typology}`;
  const prepared=mode==='planta2d'?plans.getState().plans[state.typology]?.ready:reusableScene(sceneCache.get(targetKind));
  busy(mode==='maquete'?'Abrindo a maquete…':'Abrindo a planta do apartamento…',{warm:prepared});
  try {
    if(!units){
      const catalog=await loadUnitCatalog(undefined,geometry,scope);if(token!==generation)return;
      units=commercialData?attachCommercial(catalog,commercialData):catalog;state.units=units;
      const address=new URLSearchParams(location.search),requestedUnit=address.get('unidade');
      if(units.units.some(unit=>unit.id===requestedUnit)){
        state.selectedUnitId=requestedUnit;state.floor=floorOf(units,unitById(units,requestedUnit));
        const mode=address.get('modo');restoredInterior=['planta2d','planta3d','visita'].includes(mode)?{mode,unitId:requestedUnit}:null;
      }
      if(relationsData){units=attachRelations(units,relationsData,interiorCatalog);state.units=units;}
      if(stockControlled){units=attachStock(units,stockData,interiorCatalog);state.units=units;}
      try{unitById(units,state.selectedUnitId);}catch{state.selectedUnitId=null;restoredInterior=null;}
      if(unitUI)unitUI.setCatalog(units);else unitUI=createUnitUI(units);
      update();
    }
    const kind=mode==='maquete'?'exterior':mode==='planta2d'?'image':`interior:${state.typology}`;
    const warm=kind==='image'?plans.getState().plans[state.typology]?.ready:reusableScene(sceneCache.get(kind));
    await release({preserveCache:true});if(token!==generation)return;
    if(!warm){
      if(mode==='maquete'){
        if(openedOnce||navigator.serviceWorker?.controller)await transfers.pause();
      }else await transfers.prioritize(mode==='planta2d'?'planta2d':'tour',mode==='planta2d'?
        [typology(state.typology).image]:['interiores/catalogo.json','interiores/shared/',`interiores/${state.typology}/`]);
    }
    if(token!==generation)return;
    if(mode==='planta2d'){await fallback2D(token);return true;}
    const prepared=prepareScene(kind);state.frame=sceneCache.get(kind);frameKind=kind;
    const frame=await prepared;if(token!==generation)return;
    const api=sceneAPI(frame);
    if(kind==='exterior'){
      api.setFloor(state.floor);if(state.floor===pilotFloor||scope==='edificio')api.setSelectedUnit(state.selectedUnitId);
      if(api.ambience!==state.ambience)api.setAmbience?.(state.ambience);
    }else await api.setMode(mode);
    if(token!==generation)return;
    const activated=await api.setActive(true);
    if(token!==generation){if(state.frame!==frame)await parkFrame(frame);return;}
    if(activated===false||!api.ready||api.error||api.disposed||state.frame!==frame)throw Error(api.error||'Não foi possível retomar esta visualização.');
    frame.inert=false;frame.setAttribute('aria-hidden','false');delete frame.dataset.parked;
    state.backend=api.backend;
    if(warm){state.sceneReuseCount++;if(kind.startsWith('interior:'))state.interiorReuseCount++;}
    state.ready=true;overlay.hidden=true;status.textContent='';update();
    // Background prefetch (Tour, map) waits for the building's full lighting.
    openedOnce=true;void Promise.resolve(api.fullAtlas).finally(()=>transfers.start());refreshOptionalData();scheduleWarmViews();return true;
  } catch(error) {
    if(token!==generation)return;
    retireFrame(state.frame);frameKind=null;plans.hide();showError(error);
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
  if(!Number.isInteger(value)||value < -1||value >lastFloor)throw Error('Pavimento inválido.');
  state.frame?.contentWindow?.__livProva?.setFloor(value);state.floor=value;
  if(state.selectedUnitId&&floorOf(units,unitById(units,state.selectedUnitId))!==value)state.selectedUnitId=null;
  if(floorControl)floorControl.value=String(floor);
  update();
}
function showUnitSide(side,floor=scope==='edificio'&&state.floor>=0?state.floor:pilotFloor){
  const api=state.frame?.contentWindow?.__livProva;
  if(!state.ready||state.mode!=='maquete'||!api)return false;
  api.setUnitView(side,floor);state.floor=floor;state.view='livre';
  if(floorControl)floorControl.value=String(floor);update();return true;
}
function selectUnit(id,{frameEvent=false,showInformation=false,openLayout=false}={}){
  if(!units)return false;
  const unit=unitById(units,id),api=state.frame?.contentWindow?.__livProva;
  if(id!==null&&(!state.ready||state.mode!=='maquete'||!api))return false;
  restoredInterior=null;
  pendingBuyerLayout=buyerUI.enabled&&openLayout?id:null;
  // List selection reveals the appropriate face; canvas taps preserve the orbit.
  if(unit&&!frameEvent)showUnitSide(unit.side,floorOf(units,unit));
  if(unit&&frameEvent){state.floor=floorOf(units,unit);if(floorControl)floorControl.value=String(state.floor);}
  if(unit?.relation){state.typology=unit.relation.typology;document.getElementById('typology').value=state.typology;}
  state.selectedUnitId=id;api?.setSelectedUnit(id);update();
  if(unit&&openLayout)panelDetails.scrollTop=0;
  if(hasApartmentLayout(unit))scheduleWarmViews();
  if(unit&&frameEvent)revealOnMobile('selectedApartment');
  if(unit&&showInformation)showDetails();return true;
}
async function openUnitLayout(){
  const unit=units?unitById(units,state.selectedUnitId):null;
  if(!hasApartmentLayout(unit)||!state.ready)return false;
  state.typology=unit.relation.typology;document.getElementById('typology').value=state.typology;
  await setMode('planta2d');return true;
}
async function setTypology(id){
  typology(id);
  const unit=selectedApartment();
  if(!hasApartmentLayout(unit)||id!==unit.relation.typology){document.getElementById('typology').value=state.typology;return false;}
  state.typology=id;document.getElementById('typology').value=id;update();return true;
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
      'A planta deste apartamento ainda não pôde ser conferida. Consulte a equipe responsável.';
    update();
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
    const source=plans.getImage(state.typology);
    const image=new Image();image.src=source.tagName==='IMG'?source.src:source.getAttribute('href');await image.decode();
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;canvas.getContext('2d').drawImage(image,0,0);png=canvas.toDataURL('image/png');
  } else {
    png=await state.frame.contentWindow.__livInterior.capture();
  }
  const link=document.createElement('a');link.href=png;link.download=`${dados.arquivo}-${state.typology}-${state.mode}.png`;link.click();return png;
}
function discardMap(){
  mapFrame?.contentWindow?.__livMapAdapter?.dispose?.();mapFrame?.remove();mapFrame=null;mapLoad=null;mapURL=null;
  delete window.__livMapAdapter;
}
function prepareMap(){
  const destination=new URL(document.querySelector('.map-link').href);
  destination.searchParams.set('embed','1');destination.searchParams.set('prewarm','1');
  destination.searchParams.set('rev','2026-10-12-cache');
  if(mapFrame&&mapURL===destination.href){
    if(mapFrame.contentWindow?.__livMapAdapter?.ready)return Promise.resolve(mapFrame);
    if(mapLoad)return mapLoad;
  }
  discardMap();const epoch=cacheEpoch;
  const frame=document.createElement('iframe');frame.title=dados.mapa.titulo;
  frame.dataset.scene='map';frame.dataset.instance=String(++sceneSerial);frame.src=destination.href;mapFrame=frame;mapURL=destination.href;
  Object.defineProperty(window,'__livMapAdapter',{configurable:true,get:()=>mapFrame?.contentWindow?.__livMapAdapter});
  mapPanel.append(frame);
  const job=(async()=>{
    const api=await until(()=>{
      const api=frame.contentWindow?.__livMapAdapter;if(api?.error)throw Error(api.error);
      return api?.ready?api:null;
    },null,{current:()=>!cacheStopped&&epoch===cacheEpoch&&mapFrame===frame});
    if(!state.mapOpen)api.setActive(false);
    frame.dataset.ready='true';return frame;
  })();
  mapLoad=job;
  job.catch(()=>{if(mapFrame===frame)discardMap();}).finally(()=>{if(mapLoad===job)mapLoad=null;});return job;
}
function closeMap({restore=true}={}){
  if(!state.mapOpen)return Promise.resolve();
  generation++;state.mapOpen=false;
  mapFrame?.contentWindow?.__livMapAdapter?.setActive?.(false);
  mapPanel.inert=true;mapPanel.setAttribute('aria-hidden','true');
  if(mapPanel.open)mapPanel.close();
  return restore?setMode(mapReturnMode||'maquete'):Promise.resolve();
}
async function openMap(){
  if(state.mapOpen)return;
  mapReturnMode=state.mode;const token=++generation;
  state.mapOpen=true;busy('Abrindo o mapa…');mapPanel.inert=false;mapPanel.setAttribute('aria-hidden','false');mapPanel.showModal();
  await release({preserveCache:true});
  if(token!==generation||!state.mapOpen)return;
  const frame=await prepareMap();if(token!==generation||!state.mapOpen)return;
  frame.contentWindow.__livMapAdapter.setActive(true);state.mapReady=true;overlay.hidden=true;
}
function dispose(){
  generation++;cacheEpoch++;cacheStopped=true;state.ready=false;panelResize?.disconnect();
  if(warmHandle!==null){window.cancelIdleCallback?.(warmHandle);clearTimeout(warmHandle);warmHandle=null;}
  warmJob=null;void closeMap({restore:false});discardMap();release();sceneLoads.clear();plans.dispose();
}
Object.assign(state,{setMode,setView,setFloor,setTypology,selectUnit,showUnitSide,capture,setAmbience,setAvailabilityFilter,openUnitLayout,openMap,closeMap,reloadRelations:refreshRelations,reloadCommercial:refreshCommercial,prepareViews,getCacheState:()=>({scenes:[...sceneCache.keys()],plans:plans.getState(),mapReady:Boolean(mapFrame?.dataset.ready),reuses:state.sceneReuseCount}),getState:()=>({mode:state.mode,typology:state.typology,view:state.view,floor:state.floor,selectedUnitId:state.selectedUnitId,panelCollapsed:state.panelCollapsed,backend:state.backend,ambience:state.ambience,availabilityFilter:state.availabilityFilter}),dispose});
state.setContact=context=>{buyerUI.setContact(context);const unit=selectedApartment();buyerUI.update(unit,unit?floorOf(units,unit):null,state.mode);};
panelToggle?.addEventListener('click',()=>{state.panelCollapsed=!state.panelCollapsed;updateInfoPanel();});
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>{
  const opening=setMode(button.dataset.mode);
  revealOnMobile('stage');return opening;
});
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>setView(button.dataset.view));
floorControl?.addEventListener('change',event=>setFloor(event.target.value));
document.getElementById('typology').addEventListener('change',event=>setTypology(event.target.value));
ambienceControl?.addEventListener('change',event=>setAmbience(event.target.value));
document.getElementById('availability').addEventListener('change',event=>setAvailabilityFilter(event.target.value));
document.getElementById('hostRoomGo')?.addEventListener('click',()=>{
  const sel=document.getElementById('hostRoomSelect');
  if(sel?.value&&state.frame?.contentWindow?.__livInterior)state.frame.contentWindow.__livInterior.goToRoom(sel.value);
});
document.getElementById('hostCutParedes')?.addEventListener('click',()=>{
  const api=state.frame?.contentWindow?.__livInterior;
  if(!api?.ready)return;
  const current=Boolean(api.getState?.()?.presentation?.enabled);
  api.setWallCut(!current);
  update();
});
document.getElementById('hostFramePlan')?.addEventListener('click',()=>{
  state.frame?.contentWindow?.__livInterior?.framePlan();
});
document.getElementById('btnOpenUnitCard')?.addEventListener('click',()=>showDetails());
document.getElementById('btnApartmentInfo')?.addEventListener('click',()=>showDetails());
document.getElementById('btnBackToList').addEventListener('click',()=>{
  selectUnit(null);state.panelCollapsed=false;updateInfoPanel();
});
document.getElementById('availableUnitList').addEventListener('click',event=>{
  const button=event.target.closest?.('button[data-unit-id]');
  if(button&&selectUnit(button.dataset.unitId))revealOnMobile('selectedApartment');
});
document.getElementById('closeDetails').addEventListener('click',()=>detailsDialog.close());
detailsDialog.addEventListener('click',event=>{
  if(event.target!==detailsDialog)return;const r=detailsDialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)detailsDialog.close();
});
for(const button of document.querySelectorAll('[data-unit-open]'))button.addEventListener('click',async()=>{
  const unit=selectedApartment();if(!hasApartmentLayout(unit)||!state.ready)return;
  state.typology=unit.relation.typology;document.getElementById('typology').value=state.typology;
  detailsDialog.close();const opening=setMode(button.dataset.unitOpen);
  revealOnMobile('stage');await opening;
});
captureControl?.addEventListener('click',()=>capture().catch(error=>{status.textContent='Não foi possível capturar a imagem: '+error.message;}));
document.getElementById('retry').addEventListener('click',()=>setMode(state.mode));
document.getElementById('fallback').addEventListener('click',()=>{
  void setMode('planta2d');
});
document.querySelector('.map-link').addEventListener('click',event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();void openMap().catch(error=>{void closeMap();status.textContent='Não foi possível abrir o mapa: '+error.message;});
});
document.getElementById('closeMap').addEventListener('click',()=>void closeMap());
mapPanel.addEventListener('cancel',event=>{event.preventDefault();void closeMap();});
window.addEventListener('message',event=>{
  if(event.origin===location.origin&&event.source===mapFrame?.contentWindow&&event.data?.type==='liv-map-return')void closeMap();
});
window.addEventListener('pagehide',()=>{
  stockVersion++;void stopStock?.();stopStock=null;stockStart=null;
  commercialVersion++;commercialController?.abort();
  relationVersion++;relationController?.abort();
  commercialLoad=null;relationLoad=null;
  dispose();
  try {sessionStorage.setItem(storageKey,JSON.stringify({version:1,mode:state.mode,typology:state.typology,interiorSnapshots:state.interiorSnapshots,view:state.view,floor:state.floor,selectedUnitId:state.selectedUnitId,panelCollapsed:state.panelCollapsed,ambience:state.ambience,exteriorSnapshot:state.exteriorSnapshot}));}
  catch(error) {state.storageError=String(error);}
});
window.addEventListener('pageshow',event=>{if(event.persisted)setMode(state.mode);});
// Saved interiors are restored only after their apartment association has been
// validated by the optional records. The first usable scene is always exterior.
// The 3D frame (1 MB of script) starts after the page's first contentful paint,
// so it never competes with it. A hidden tab never paints; the timeout is a ceiling.
let opened=false;const openFirstScene=()=>{if(!opened){opened=true;setMode('maquete',{restore:true});}};
if(document.visibilityState==='hidden'||typeof PerformanceObserver==='undefined')openFirstScene();
else{
  new PerformanceObserver((list,observer)=>{
    if(list.getEntries().some(entry=>entry.name==='first-contentful-paint')){observer.disconnect();openFirstScene();}
  }).observe({type:'paint',buffered:true});
  setTimeout(openFirstScene,1000);
}
