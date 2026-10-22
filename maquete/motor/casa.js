// The entry page of a single-unit property (MG-3, dados.tipo casa or apartamento): the exterior, the ficha
// and the Planta 2D. No unit list and no floors; a building (tipo predio) opens in its own page (viewer.js).
// The build adds vitrine_ao_vivo.js after this module, as a module script so it runs after the ficha is
// filled: it swaps the last text node of #fPreco for the panel's price or situation, and covers the page
// when the property is taken off the air.
import dados from './dados/maquete.js';
import {requestedEdition} from './edicoes.js';
import {desenharPlanta} from './planta-desenho.js';

const $=id=>document.getElementById(id);
const state=window.__maquete={ready:false,modo:'maquete',error:null};
const stage=$('palco'),frame=$('exterior'),plan=$('planta');

function fail(error){
  state.error=String(error?.message??error);
  $('carregando').hidden=true;$('erro').textContent=state.error;$('falha').hidden=false;
}

function fillSheet(){
  const sheet=dados.ficha;
  document.title=`${dados.nome} · maquete 3D`;
  $('fTag').textContent=sheet.tag;$('fTitulo').textContent=sheet.titulo;
  $('fSub').textContent=[sheet.subtitulo,sheet.endereco].filter(Boolean).join(' · ');
  $('fPreco').append(sheet.preco);
  for(const [label,value] of sheet.linhas){
    const term=document.createElement('dt'),detail=document.createElement('dd');
    term.textContent=label;detail.textContent=value;$('fLinhas').append(term,detail);
  }
  const map=$('perto');map.href=dados.mapa.pagina;map.title=dados.mapa.titulo;
}

function drawPlan(){
  const {width,height}=stage.getBoundingClientRect();
  plan.innerHTML=desenharPlanta(dados.planta,Math.round(width),Math.round(height));
}
const resize=new ResizeObserver(()=>{if(state.modo==='planta')drawPlan();});

function setMode(mode){
  state.modo=mode;plan.hidden=mode!=='planta';
  if(mode==='planta'){drawPlan();resize.observe(stage);}else resize.disconnect();
  // The exterior stops rendering while the plan covers it (once it is ready: it compiles hidden meshes before).
  const exteriorState=frame.contentWindow?.__livProva;
  if(exteriorState?.ready)exteriorState.setActive(mode==='maquete');
  for(const button of document.querySelectorAll('[data-modo]'))button.setAttribute('aria-pressed',String(button.dataset.modo===mode));
}

try{
  if(!['casa','apartamento'].includes(dados.tipo))throw Error('Esta página mostra um imóvel de uma unidade; o prédio abre na página dele.');
  fillSheet();
  const parameters=new URLSearchParams(location.search),exterior=new URL('prova-rgbm.html',import.meta.url);
  exterior.search=new URLSearchParams({embed:'1',tema:'escuro',geometria:requestedEdition(location.search),
    ...(parameters.has('backend')?{backend:parameters.get('backend')}:{})});
  frame.title=`Maquete 3D de ${dados.nome}`;frame.src=exterior.href;
  for(const button of document.querySelectorAll('[data-modo]'))button.addEventListener('click',()=>setMode(button.dataset.modo));
  // The exterior shows its own failure (and the WebGL2 retry) inside the frame.
  const wait=setInterval(()=>{
    const exteriorState=frame.contentWindow?.__livProva;
    if(exteriorState?.error){clearInterval(wait);state.error=exteriorState.error;$('carregando').hidden=true;}
    else if(exteriorState?.ready){
      clearInterval(wait);state.ready=true;$('carregando').hidden=true;
      if(state.modo!=='maquete')exteriorState.setActive(false);
    }
    else if(exteriorState?.progress)$('carregandoTexto').textContent=`${exteriorState.progress.message}…`;
  },100);
}catch(error){fail(error);}
