import {observeRenderer,resourceTimings} from './diagnostic-recorder.js';
const element=id=>document.getElementById(id),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const report=window.__livDiagnostic={schema:'liv-device-diagnostic-v1',recordedAt:new Date().toISOString(),
  origin:location.origin,userAgent:navigator.userAgent,secureContext:isSecureContext,
  qualification:'pendente-de-revisao',openings:[],segments:[],failures:[]};
let frame=null,recorder=null,active=null,busy=false;
const status=text=>element('status').textContent=text;
function controls(){
  element('open').disabled=busy||!!active;element('start').disabled=busy||!frame||!!active;
  element('stop').disabled=busy||!active;element('export').disabled=!report.openings.length||busy||!!active;
  for(const id of ['edition','backend','segment'])element(id).disabled=busy||!!active;
}
function declaration(){
  return {device:element('device').value.trim(),physicalDevice:element('physical').value==='fisico'?true:
    ['desktop','emulado'].includes(element('physical').value)?false:null,
    executionDeclared:element('physical').value,networkDeclared:element('network').value.trim(),
    cacheDeclared:element('cache').value,viewport:[innerWidth,innerHeight],pixelRatio:devicePixelRatio,
    hardwareConcurrency:navigator.hardwareConcurrency??null,deviceMemoryGiB:navigator.deviceMemory??null,
    connection:navigator.connection?{effectiveType:navigator.connection.effectiveType,rttMs:navigator.connection.rtt,
      downlinkMbps:navigator.connection.downlink,saveData:navigator.connection.saveData}:null};
}
async function ready(){
  const deadline=performance.now()+600000;
  while(performance.now()<deadline){
    const viewer=frame?.contentWindow?.__livViewer;
    if(viewer?.error)throw Error(viewer.error);
    if(viewer?.ready)return viewer;
    await sleep(100);
  }
  throw Error('A página não respondeu em dez minutos.');
}
function resources(){
  const viewer=frame?.contentWindow?.__livViewer;
  return {viewer:frame?resourceTimings(frame.contentWindow):[],
    scene:viewer?.frame?resourceTimings(viewer.frame.contentWindow):[],
    note:'Tempos dos documentos; não somar como tráfego integral do worker ou pico de rede.'};
}
async function opening(){
  busy=true;controls();status('Abrindo a maquete…');const sample={...declaration(),edition:element('edition').value,backendRequested:element('backend').value};
  const start=performance.now();report.openings.push(sample);
  try{
    if(frame){
      frame.hidden=true;const previous=frame.contentWindow.__livViewer;previous?.dispose();
      const deadline=performance.now()+31000;
      while(previous?.pendingCleanup&&performance.now()<deadline)await sleep(50);
      frame.remove();
    }
    frame=document.createElement('iframe');frame.title='LIV Ipanema em teste';
    const navigationStart=performance.now();sample.cleanupDelayMs=navigationStart-start;
    frame.src=`maquete-liv-ipanema.html?geometria=${sample.edition}&backend=${sample.backendRequested}`;
    element('stage').append(frame);const viewer=await ready();
    Object.assign(sample,{readyMs:performance.now()-navigationStart,modeUponReady:viewer.mode,
      backendEffective:viewer.backend,resources:resources(),status:'carregado'});
    status('Maquete aberta. Escolha um trecho e inicie a medição.');
  }catch(error){sample.status='falhou';sample.error=String(error);report.failures.push(String(error));status(String(error));}
  finally{busy=false;controls();}
}
async function start(){
  busy=true;controls();const [typologyOrMode,mode]=element('segment').value.split(':');
  const sample={...declaration(),label:element('segment').value,startedAt:new Date().toISOString()};
  const before=performance.now();
  try{
    const viewer=await ready();
    if(mode)await viewer.setTypology(typologyOrMode);
    await viewer.setMode(mode||typologyOrMode);await ready();
    sample.openMs=performance.now()-before;sample.backendEffective=viewer.backend;sample.initialViewerState=viewer.getState();
    const win=viewer.frame?.contentWindow,api=win?.__livInterior||win?.__livProva;
    recorder=api?.renderer?observeRenderer(api,win):null;active=sample;
    status('Medindo: caminhe ou gire por pelo menos 15 segundos; depois conclua o trecho.');
  }catch(error){sample.error=String(error);report.segments.push(sample);report.failures.push(String(error));status(String(error));}
  finally{busy=false;controls();}
}
function stop(){
  if(!active)return;
  active.measurement=recorder?.stop()??null;active.observation=element('note').value.trim();active.resources=resources();
  const viewer=frame.contentWindow.__livViewer;active.viewerState=viewer.getState();active.error=viewer.error||active.measurement?.error||null;
  active.interrupted=active.measurement?.disposed===true||active.viewerState.mode!==active.initialViewerState.mode||
    active.viewerState.typology!==active.initialViewerState.typology;
  if(active.error)report.failures.push(active.error);
  report.segments.push(active);active=null;recorder=null;
  element('summary').textContent=`${report.openings.length} abertura(s), ${report.segments.length} trecho(s), ${report.failures.length} falha(s) registrada(s).`;
  status('Trecho registrado. Repita com a outra planta ou baixe o relatório.');controls();
}
function download(){
  report.exportedAt=new Date().toISOString();const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='liv-teste-aparelho.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
element('open').addEventListener('click',opening);element('start').addEventListener('click',start);
element('stop').addEventListener('click',stop);element('export').addEventListener('click',download);
window.addEventListener('pagehide',()=>recorder?.stop());
Object.assign(report,{open:opening,start,stop,download});controls();
