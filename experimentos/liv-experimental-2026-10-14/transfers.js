// One scoped Service Worker owns both background transfers and native requests.
// No scenes, textures or renderers are created by this client.
const labels={tour:'Tour 3D',map:'Mapa',planta2d:'Planta 2D'};
let state={enabled:false,paused:true,active:null,groups:{},error:null},initialization=null,commands=Promise.resolve();
const listeners=new Set();
const retiredInstances=new Set();
function publish(next,worker=null){
  // A replacement worker can reuse the manifest version with a fresh counter.
  // A queued reply/broadcast from its predecessor must not resurrect old state.
  if(worker&&worker!==navigator.serviceWorker?.controller)return;
  if(next.workerInstance&&retiredInstances.has(next.workerInstance))return;
  if(state.workerInstance&&next.workerInstance&&state.workerInstance!==next.workerInstance) {
    retiredInstances.add(state.workerInstance);
  }
  // A broadcast can arrive before the older command acknowledgement.
  if(next.workerInstance===state.workerInstance&&next.version&&next.version===state.version&&
    next.progressVersion<state.progressVersion)return;
  state=next;for(const listener of listeners)listener(state);
}
const unavailable=error=>{publish({...state,enabled:false,unavailable:true,error:String(error)});return false;};
function timed(promise,ms,message){
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));
}
async function ensureControlled(){
  if(initialization)return initialization;
  initialization=(async()=>{
    if(!isSecureContext||!('serviceWorker' in navigator))return unavailable('Cache de preparação indisponível neste navegador.');
    try {
      const workerURL=new URL('./transfer-worker.js',import.meta.url),scope=new URL('./',import.meta.url).href;
      await timed(navigator.serviceWorker.register(workerURL,{scope,type:'module',updateViaCache:'none'}),10000,'Não foi possível preparar o cache.');
      const controlled=()=>navigator.serviceWorker.controller?.scriptURL===workerURL.href;
      if(!controlled()){
        let changed;
        try{await timed(new Promise(resolve=>{
          changed=()=>{if(controlled())resolve();};
          navigator.serviceWorker.addEventListener('controllerchange',changed);changed();
        }),10000,'O cache de preparação não assumiu esta página.');}
        finally{navigator.serviceWorker.removeEventListener('controllerchange',changed);}
      }
      return true;
    } catch(error){return unavailable(error.message);}
  })();
  return initialization;
}
navigator.serviceWorker?.addEventListener('message',event=>{
  if(event.data?.type==='LIV_TRANSFER_STATE')publish(event.data.state,event.source);
});
function command(command,group,prefixes){
  const result=commands.catch(()=>{}).then(async()=>{
    if(!await ensureControlled())return {ok:false,state};
    const channel=new MessageChannel(),worker=navigator.serviceWorker.controller;
    try {
      const reply=await timed(new Promise(resolve=>{
        channel.port1.onmessage=event=>resolve(event.data);
        worker.postMessage({type:'LIV_TRANSFER',command,group,...(prefixes?{prefixes}:{})},[channel.port2]);
      }),10000,'A preparação dos próximos conteúdos não respondeu.');
      if(reply.state)publish(reply.state,worker);
      if(!reply.ok&&reply.error&&worker===navigator.serviceWorker.controller)publish({...state,error:reply.error});
      return reply;
    }catch(error){
      if(worker===navigator.serviceWorker.controller)unavailable(error.message);
      return {ok:false,state};
    }
    finally{channel.port1.close();}
  });
  commands=result;
  return result;
}
export const transfers={
  ensureControlled,start:()=>command('start'),pause:()=>command('pause'),resume:()=>command('resume'),
  prioritize:(group,prefixes)=>command('prioritize',group,prefixes),refresh:()=>command('status'),getState:()=>state,
  subscribe(listener){listeners.add(listener);listener(state);return()=>listeners.delete(listener);},
};
window.__livTransfers=transfers;
navigator.serviceWorker?.addEventListener('controllerchange',()=>{
  // Activation can broadcast before clients.claim updates our controller.
  // Read the replacement's state after control changes instead of waiting for UI.
  if(initialization)void transfers.refresh();
});

export function showTransferStatus(container){
  const text=container.querySelector('[data-transfer-text]'),progress=container.querySelector('progress');
  let lastLabel='';
  return transfers.subscribe(current=>{
    const active=current.active,groups=Object.values(current.groups||{});
    const done=groups.length>0&&groups.every(group=>group.cached===group.total);
    container.hidden=(!current.enabled&&!current.unavailable&&!current.error)||(done&&!active);
    const label=active?`Preparando ${labels[active.group]||'conteúdo'} para abrir mais rápido`:
      current.unavailable?'Os conteúdos serão carregados quando você os abrir.':
      current.error?'Preparação interrompida. Você pode abrir cada conteúdo normalmente.':
      done?'Tour, mapa e planta preparados neste navegador.':
      current.paused?'Preparação aguardando a tela atual.':'Preparando os próximos conteúdos…';
    if(label!==lastLabel){text.textContent=label;lastLabel=label;}
    progress.hidden=!active||!active.total;
    if(active?.total){progress.max=active.total;progress.value=active.loaded;}
  });
}
