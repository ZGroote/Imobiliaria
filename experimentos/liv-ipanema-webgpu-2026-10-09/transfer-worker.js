/* One verified transfer at a time. This worker never opens a scene or renderer. */
const GROUP_ORDER=['tour','map','planta2d'];
const SCOPE=new URL('./',self.location.href);
const MANIFEST_URL=new URL('transfer-manifest.json',SCOPE).href;
const CACHE_PREFIX='liv-transfer-';
const WORKER_INSTANCE=crypto.randomUUID();
const jobs=new Map();
const clientDemands=new Map();
let catalog=null,catalogPromise=null,cache=null,pumpPromise=null,active=null,commandQueue=Promise.resolve();
let enabled=false,paused=true,preferredGroup=null,storageFailed=false,error=null;
let preferredFiles=null;
let progressVersion=0,demandSequence=0,catalogEpoch=0,lastBroadcast=0,broadcastTimer=null;

function abortError(message='Transferência substituída.') {
  return new DOMException(message,'AbortError');
}
function groupState(group) {
  const entries=[...jobs.values()].filter(job=>job.meta.group===group);
  const counts={label:catalog?.groups[group]?.label||({tour:'Tour 3D',map:'Mapa',planta2d:'Planta 2D'})[group],
    total:entries.length,pending:0,downloading:0,cached:0,failed:0,downloadFailed:0,bytesTotal:0,bytesCached:0,error:null};
  for(const job of entries) {
    counts[job.status]++;
    if(job.failureKind==='download')counts.downloadFailed++;
    counts.bytesTotal+=job.meta.bytes;
    if(job.status==='cached')counts.bytesCached+=job.meta.bytes;
    if(job.error)counts.error=job.error;
  }
  counts.status=counts.downloading?'downloading':counts.failed?'failed':
    counts.total>0&&counts.cached===counts.total?'cached':'pending';
  return counts;
}
function snapshot() {
  return {enabled,paused,version:catalog?.version||null,workerInstance:WORKER_INSTANCE,progressVersion,preferredGroup,
    preferredFiles:preferredFiles?[...preferredFiles].map(url=>jobs.get(url)?.meta.path):null,
    active:active?{group:active.job.meta.group,path:active.job.meta.path,loaded:active.job.loaded,
      total:active.job.meta.bytes,version:progressVersion,message:active.message}:null,
    groups:Object.fromEntries(GROUP_ORDER.map(group=>[group,groupState(group)])),
    error,storageFailed,ready:!!catalog};
}
async function broadcast() {
  lastBroadcast=Date.now();
  const message={type:'LIV_TRANSFER_STATE',state:snapshot()};
  try {
    for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})) {
      if(client.url.startsWith(SCOPE.href))client.postMessage(message);
    }
  } catch(_) { /* A closing page must not fail a valid download. */ }
}
function changed(immediate=false) {
  progressVersion++;
  if(immediate||Date.now()-lastBroadcast>=120) {
    if(broadcastTimer!==null){clearTimeout(broadcastTimer);broadcastTimer=null;}
    void broadcast();
  } else if(broadcastTimer===null) {
    broadcastTimer=setTimeout(()=>{broadcastTimer=null;void broadcast();},120);
  }
}
function validateCatalog(value) {
  if(value?.schema!=='liv-transfer-manifest-v1'||!/^[a-f0-9]{64}$/i.test(value.version||'')||
    !Array.isArray(value.order)||value.order.join(',')!==GROUP_ORDER.join(',')||
    !Array.isArray(value.files)||!value.files.length||value.files.length>1000) {
    throw Error('Catálogo de transferências inválido.');
  }
  for(const group of GROUP_ORDER) {
    if(typeof value.groups?.[group]?.label!=='string'||!value.groups[group].label.trim()||
      value.groups[group].label.length>80)throw Error('Grupo de transferência inválido.');
  }
  const urls=new Set();
  const files=value.files.map((file,index)=>{
    if(!GROUP_ORDER.includes(file.group)||typeof file.path!=='string'||
      !/^[A-Za-z0-9._/-]+$/.test(file.path)||file.path.startsWith('/')||
      file.path.split('/').some(part=>!part||part==='.'||part==='..')||
      !/^(?:site-baseline|plantas2d|interiores)\//.test(file.path)||
      !Number.isSafeInteger(file.bytes)||file.bytes<=0||file.bytes>150*1024*1024||
      !/^[a-f0-9]{64}$/i.test(file.sha256||'')||typeof file.essential!=='boolean') {
      throw Error('Arquivo de transferência inválido.');
    }
    const url=new URL(file.path,SCOPE);
    if(url.origin!==SCOPE.origin||!url.href.startsWith(SCOPE.href)||urls.has(url.href)) {
      throw Error('Arquivo fora do catálogo permitido.');
    }
    urls.add(url.href);
    return {...file,url:url.href,sha256:file.sha256.toLowerCase(),index};
  });
  return {...value,version:value.version.toLowerCase(),files};
}
function isVerifiedCacheResponse(response,meta) {
  return response?.ok&&response.headers.get('X-Liv-Sha256')===meta.sha256&&
    response.headers.get('X-Liv-Bytes')===String(meta.bytes);
}
async function removeObsoleteScopedCaches() {
  for(const name of await caches.keys()) {
    if(!name.startsWith(CACHE_PREFIX)||name===CACHE_PREFIX+catalog.version)continue;
    const old=await caches.open(name),keys=await old.keys();
    // Cache names are origin-wide. Never delete another experiment's resources.
    if(keys.length&&keys.every(request=>request.url.startsWith(SCOPE.href)))await caches.delete(name);
  }
}
async function readCatalog() {
    const response=await fetch(MANIFEST_URL,{cache:'no-store',credentials:'same-origin',redirect:'error'});
    if(!response.ok)throw Error('Não foi possível carregar o catálogo de transferências.');
    return validateCatalog(await response.json());
}
async function installCatalog(next) {
    catalog=next;jobs.clear();cache=null;storageFailed=false;error=null;preferredFiles=null;
    for(const meta of catalog.files)jobs.set(meta.url,{meta,status:'pending',loaded:0,error:null,failureKind:null,
      waiters:new Set(),demandOrder:Infinity});
    try {
      cache=await caches.open(CACHE_PREFIX+catalog.version);
      await Promise.all([...jobs.values()].map(async job=>{
        const cached=await cache.match(job.meta.url);
        if(isVerifiedCacheResponse(cached,job.meta))job.status='cached';
        else if(cached)await cache.delete(job.meta.url);
      }));
      await removeObsoleteScopedCaches();
    } catch(cacheError) {
      cache=null;storageFailed=true;enabled=false;paused=true;
      error='Armazenamento indisponível; carregamento sob demanda ativo.';
    }
    changed(true);return catalog;
}
function catalogFailure(catalogError) {
    enabled=false;paused=true;error=catalogError.message||'Catálogo de transferências indisponível.';
    changed(true);catalogPromise=null;throw catalogError;
}
async function ensureCatalog() {
  if(catalogPromise)return catalogPromise;
  catalogPromise=readCatalog().then(installCatalog).catch(catalogFailure);
  return catalogPromise;
}
function catalogIdentity(value) {
  return JSON.stringify({version:value.version,order:value.order,groups:value.groups,
    files:value.files.map(({path,group,bytes,sha256,essential})=>({path,group,bytes,sha256,essential}))});
}
async function refreshCatalog() {
  await ensureCatalog();
  const next=await readCatalog();
  if(next.version===catalog.version) {
    if(catalogIdentity(next)!==catalogIdentity(catalog))throw Error('Catálogo alterado sem uma nova versão.');
    return catalog;
  }
  catalogEpoch++;
  enabled=false;paused=true;cancelForeground(()=>true);interruptActive();
  const previousPump=pumpPromise;
  // New fetches wait for the catalog transition; no old worker job can populate
  // the new version's cache, and partially received files are discarded.
  catalogPromise=(async()=>{
    if(previousPump)await previousPump;
    return installCatalog(next);
  })().catch(catalogFailure);
  return catalogPromise;
}
function settleWaiters(job,response,failure=null) {
  for(const waiter of job.waiters) {
    waiter.detach?.();
    if(failure)waiter.reject(failure);
    else waiter.resolve(response.clone());
  }
  job.waiters.clear();job.demandOrder=Infinity;
}
function removeWaiters(job,predicate) {
  for(const waiter of job.waiters)if(predicate(waiter)) {
    job.waiters.delete(waiter);waiter.detach?.();waiter.reject(abortError());
  }
  job.demandOrder=Math.min(Infinity,...[...job.waiters].map(waiter=>waiter.order));
}
function cancelForeground(predicate,clientId=null) {
  for(const job of jobs.values())if(predicate(job)) {
    removeWaiters(job,waiter=>clientId===null||waiter.clientId===clientId);
  }
}
async function pruneClosedClients() {
  const ids=new Set(clientDemands.keys());
  for(const job of jobs.values())for(const waiter of job.waiters) {
    if(waiter.clientId&&!waiter.navigation)ids.add(waiter.clientId);
  }
  await Promise.all([...ids].filter(Boolean).map(async id=>{
    if(await self.clients.get(id))return;
    cancelForeground(()=>true,id);clientDemands.delete(id);
  }));
}
function clientPriority(clientId) {
  return clientDemands.get(clientId)||{epoch:0,paused:false,group:null,files:null};
}
function updateClientPriority(clientId,priority) {
  clientDemands.set(clientId,{...priority,epoch:clientPriority(clientId).epoch+1});
}
function selectedForClient(job,priority) {
  return job.meta.group===priority.group&&(!priority.files||priority.files.has(job.meta.url));
}
function interruptActive() {
  if(active&&!active.controller.signal.aborted)active.controller.abort(abortError());
}
function selectedJob(job){
  return job.meta.group===preferredGroup&&(!preferredFiles||preferredFiles.has(job.meta.url));
}
function pickJob() {
  const candidates=[...jobs.values()].filter(job=>job.status==='pending');
  const demanded=candidates.filter(job=>job.waiters.size).sort((a,b)=>a.demandOrder-b.demandOrder);
  if(demanded.length){
    const requested=demanded[0];
    // The chosen map needs its HTML/model before its many visible detail tiles.
    const prerequisite=candidates.filter(job=>job.meta.group===requested.meta.group&&job.meta.essential&&
      (!preferredFiles||job.meta.group!==preferredGroup||preferredFiles.has(job.meta.url)))
      .sort((a,b)=>a.meta.index-b.meta.index)[0];
    return prerequisite||requested;
  }
  if(!enabled||paused||storageFailed)return null;
  const order=preferredGroup?[preferredGroup,...GROUP_ORDER.filter(group=>group!==preferredGroup)]:GROUP_ORDER;
  return candidates.sort((a,b)=>order.indexOf(a.meta.group)-order.indexOf(b.meta.group)||
    Number(selectedJob(b))-Number(selectedJob(a))||
    Number(b.meta.essential)-Number(a.meta.essential)||a.meta.index-b.meta.index)[0]||null;
}
function hex(buffer) {
  return [...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function download(job) {
  const controller=new AbortController();
  const context={job,controller,message:`Baixando ${catalog.groups[job.meta.group].label}`};
  active=context;job.status='downloading';job.loaded=0;job.error=null;job.failureKind=null;changed(true);
  let reader=null;
  try {
    const response=await fetch(job.meta.url,{cache:'no-store',credentials:'same-origin',redirect:'error',
      signal:controller.signal,priority:job.waiters.size||job.meta.group===preferredGroup?'high':'low'});
    if(!response.ok||response.type==='opaque'||!response.body) {
      throw Error(`Falha ao baixar ${catalog.groups[job.meta.group].label} (HTTP ${response.status}).`);
    }
    // Streams expose decoded bytes; the manifest records those bytes, not HTTP gzip size.
    const bytes=new Uint8Array(job.meta.bytes);
    reader=response.body.getReader();
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      if(job.loaded+value.byteLength>bytes.byteLength)throw Error('Tamanho do arquivo não confere.');
      bytes.set(value,job.loaded);job.loaded+=value.byteLength;changed();
    }
    reader.releaseLock();reader=null;
    if(job.loaded!==job.meta.bytes)throw Error('Tamanho do arquivo não confere.');
    context.message=`Conferindo ${catalog.groups[job.meta.group].label}`;changed(true);
    const sha256=hex(await crypto.subtle.digest('SHA-256',bytes));
    if(controller.signal.aborted)throw abortError();
    if(sha256!==job.meta.sha256)throw Error('Identidade do arquivo não confere.');
    const headers=new Headers(response.headers);
    for(const name of ['Content-Encoding','Transfer-Encoding','Trailer','Vary'])headers.delete(name);
    headers.set('Content-Length',String(bytes.byteLength));
    headers.set('X-Liv-Sha256',sha256);headers.set('X-Liv-Bytes',String(bytes.byteLength));
    const verified=new Response(bytes,{status:response.status,statusText:response.statusText,headers});
    let stored=false;
    if(cache&&!storageFailed) {
      context.message=`Guardando ${catalog.groups[job.meta.group].label}`;changed(true);
      try {await cache.put(job.meta.url,verified.clone());stored=true;}
      catch(cacheError) {
        storageFailed=true;enabled=false;paused=true;
        error='Armazenamento cheio ou indisponível; fila suspensa.';
      }
    }
    job.status=stored?'cached':'failed';
    if(!stored){job.error='Arquivo carregado sem armazenamento local.';job.failureKind='storage';}
    // Foreground consumers can use verified bytes even when CacheStorage is unavailable.
    settleWaiters(job,verified);
  } catch(failure) {
    if(reader)try {await reader.cancel();}catch(_) {}
    if(controller.signal.aborted||failure.name==='AbortError') {
      job.status='pending';job.loaded=0;
      // Waiters added after the interruption belong to a new demand; keep them queued.
    } else {
      job.status='failed';job.failureKind='download';job.error=failure.message||'Falha na transferência.';error=job.error;
      settleWaiters(job,null,failure);
    }
  } finally {
    if(active===context)active=null;
    changed(true);
  }
}
function ensurePump() {
  if(pumpPromise)return pumpPromise;
  pumpPromise=(async()=>{
    let job;
    while((job=pickJob()))await download(job);
  })().finally(()=>{
    pumpPromise=null;
    // A demand can arrive just as the previous loop becomes idle.
    if(pickJob())return ensurePump();
  });
  return pumpPromise;
}
async function cachedResponse(job) {
  if(!cache)return null;
  const wasCached=job.status==='cached';
  try {
    const response=await cache.match(job.meta.url);
    if(isVerifiedCacheResponse(response,job.meta)) {
      if(job.status!=='cached'){job.status='cached';job.error=null;job.failureKind=null;changed(true);}
      return response;
    }
    if(response)await cache.delete(job.meta.url);
    if(wasCached&&job.status==='cached'){job.status='pending';changed(true);}
  } catch(cacheError) {
    cache=null;storageFailed=true;enabled=false;paused=true;
    error='Armazenamento indisponível; carregamento sob demanda ativo.';changed(true);
  }
  return null;
}
async function foreground(request,clientId='',navigation=false) {
  const epoch=clientPriority(clientId).epoch,versionEpoch=catalogEpoch;
  await ensureCatalog();
  const job=jobs.get(request.url);
  if(!job)return fetch(request); // Exact allowlist; never cache wrappers or application JS.
  function checkDemand(){
    // Cache lookup is asynchronous. A removed scene must not re-enter the queue
    // after a newer priority command canceled its demands during that lookup.
    const priority=clientPriority(clientId);
    if(request.signal.aborted||catalogEpoch!==versionEpoch||jobs.get(request.url)!==job||
      (epoch!==priority.epoch&&(priority.paused||!selectedForClient(job,priority))))throw abortError();
  }
  checkDemand();
  let cached=await cachedResponse(job);checkDemand();if(cached)return cached;
  // A background cache.put can finish while the first cache.match is in flight.
  // Recheck that completion before creating a new job demand.
  if(job.status==='cached'){cached=await cachedResponse(job);checkDemand();if(cached)return cached;}
  // Parent commands and iframe fetches have different client IDs. A removed
  // iframe has no WindowClient; a still-open iframe in another tab stays valid.
  // Navigation's resulting client does not exist until its response is delivered.
  if(clientId&&!navigation&&!await self.clients.get(clientId))throw abortError();
  checkDemand();
  if(job.status==='failed'){job.status='pending';job.error=null;job.failureKind=null;}
  const response=new Promise((resolve,reject)=>{
    const waiter={resolve,reject,clientId,navigation,order:++demandSequence};
    const onAbort=()=>{
      removeWaiters(job,value=>value===waiter);
      if(active?.job===job&&!job.waiters.size&&
        (paused||!enabled||storageFailed||preferredGroup&&!selectedJob(job)))interruptActive();
      changed(true);void ensurePump();
    };
    waiter.detach=()=>request.signal.removeEventListener('abort',onAbort);
    job.waiters.add(waiter);job.demandOrder=Math.min(job.demandOrder,waiter.order);
    request.signal.addEventListener('abort',onAbort,{once:true});
  });
  // Rejections are also awaited below; this handler prevents cancellation races from
  // creating an unhandled promise before respondWith has attached its continuation.
  response.catch(()=>{});
  const sameGroupPrerequisite=active?.job.meta.group===job.meta.group&&active.job.meta.essential&&!job.meta.essential;
  if(active&&active.job!==job&&!sameGroupPrerequisite&&(!active.job.waiters.size||active.job.meta.group!==job.meta.group)) {
    if(active.job.meta.group!==job.meta.group)cancelForeground(old=>old.meta.group!==job.meta.group,clientId);
    // A priority change in another tab must not cancel or restart a shared
    // foreground download. Its selected job runs next, after this verified file.
    if(!active.job.waiters.size)interruptActive();
  }
  void ensurePump();
  return response;
}
async function command(message,clientId='') {
  if(message.command==='start')await refreshCatalog();
  else await ensureCatalog();
  await pruneClosedClients();
  const group=message.group;
  if(message.command==='prioritize'&&!GROUP_ORDER.includes(group))throw Error('Grupo inválido.');
  let selected=null;
  if(message.command==='prioritize'&&message.prefixes!==undefined){
    const prefixes=message.prefixes;
    if(!Array.isArray(prefixes)||!prefixes.length||prefixes.length>8||
      prefixes.some(prefix=>typeof prefix!=='string'||!prefix.length||prefix.length>200))throw Error('Prioridade de arquivos inválida.');
    const entries=[...jobs.values()].filter(job=>job.meta.group===group);
    if(prefixes.some(prefix=>!entries.some(job=>job.meta.path===prefix||prefix.endsWith('/')&&job.meta.path.startsWith(prefix))))
      throw Error('Prioridade fora do catálogo.');
    selected=new Set(entries.filter(job=>prefixes.some(prefix=>job.meta.path===prefix||prefix.endsWith('/')&&job.meta.path.startsWith(prefix)))
      .map(job=>job.meta.url));
  }
  switch(message.command) {
    case 'start':case 'resume':
      if(!storageFailed){enabled=true;paused=false;error=null;}
      break;
    case 'prioritize':
      preferredGroup=group;preferredFiles=selected;
      updateClientPriority(clientId,{paused:false,group,files:selected});
      cancelForeground(job=>!selectedJob(job),clientId);
      if(active&&!selectedJob(active.job)&&!active.job.waiters.size)interruptActive();
      for(const job of jobs.values())if(job.meta.group===group&&job.status==='failed') {
        job.status='pending';job.error=null;job.failureKind=null;job.loaded=0;
      }
      if(!storageFailed){enabled=true;paused=false;error=null;}
      break;
    case 'pause':
      updateClientPriority(clientId,{paused:true,group:null,files:null});
      paused=true;preferredGroup=null;preferredFiles=null;cancelForeground(()=>true,clientId);
      if(active&&!active.job.waiters.size)interruptActive();
      break;
    case 'status':break;
    default:throw Error('Comando de transferência inválido.');
  }
  changed(true);
  return snapshot();
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  try {await ensureCatalog();}catch(_) {}
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  const message=event.data;if(message?.type!=='LIV_TRANSFER')return;
  const port=event.ports?.[0];
  // Reply after scheduling, never after downloading the group.
  const lifecycle=(async()=>{
    try {
      const operation=commandQueue.then(()=>command(message,event.source?.id||''));
      commandQueue=operation.catch(()=>{});
      const state=await operation;
      port?.postMessage({ok:true,state});
      await ensurePump();
    } catch(failure) {
      port?.postMessage({ok:false,state:snapshot(),error:failure.message});
    }
  })();
  event.waitUntil(lifecycle);
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==SCOPE.origin||url.search||!url.href.startsWith(SCOPE.href))return;
  const relative=url.pathname.slice(SCOPE.pathname.length);
  // This guard also works after the browser has restarted the worker. The catalog
  // then makes the exact URL decision before any cache lookup or queued transfer.
  if(!/^(?:site-baseline|plantas2d|interiores)\//.test(relative))return;
  const response=foreground(event.request,event.resultingClientId||event.clientId||'',event.request.mode==='navigate');
  event.respondWith(response);
  event.waitUntil(response.then(()=>ensurePump()).catch(()=>ensurePump()));
});
