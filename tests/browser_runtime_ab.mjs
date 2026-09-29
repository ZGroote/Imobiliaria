import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const [v1Url,v2Url]=process.argv.slice(2);
const chromeBin=process.env.CHROME;
if(!v1Url||!v2Url) throw Error('usage: node tests/browser_runtime_ab.mjs <v1-url> <v2-url>');
if(!chromeBin) throw Error('CHROME env is required');
for(const raw of [v1Url,v2Url]){
  const u=new URL(raw);
  if(!['127.0.0.1','localhost'].includes(u.hostname)) throw Error('benchmark must use local HTTP');
}

async function headBytes(url){
  const r=await fetch(url,{method:'HEAD'});
  if(!r.ok) throw Error('HEAD '+r.status+' '+url);
  return Number(r.headers.get('content-length')||0);
}

async function runCase(label,url,isV2){
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'imob-ab-'+label+'-'));
  const chrome=spawn(chromeBin,[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0',
    '--user-data-dir='+profile,'--window-size=1280,900','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--no-first-run','--disable-background-networking','about:blank'
  ],{stdio:['ignore','ignore','pipe']});
  let chromeErr='';chrome.stderr.on('data',d=>{chromeErr+=d.toString();});
  let socket,seq=0,lastNetworkAt=0;
  const pending=new Map(),requests=new Map(),errors=[],httpErrors=[];
  let networkBytes=0,requestCount=0,chunkBytes=0,chunkRequests=0;
  try{
    let port;
    for(let i=0;i<120;i++){
      try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}
      catch{await delay(100);}
    }
    if(!port) throw Error('Chrome did not start: '+chromeErr.slice(-1500));
    const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
    socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    socket.onmessage=e=>{
      const d=JSON.parse(e.data),call=pending.get(d.id);
      if(call){pending.delete(d.id);clearTimeout(call.timer);d.error?call.reject(Error(JSON.stringify(d.error))):call.resolve(d.result);}
      if(d.method==='Runtime.exceptionThrown') errors.push(d.params.exceptionDetails);
      if(d.method==='Network.responseReceived'){
        const r=d.params.response; requests.set(d.params.requestId,r.url); lastNetworkAt=Date.now();
        if(r.status>=400&&!r.url.endsWith('/favicon.ico')) httpErrors.push({url:r.url,status:r.status});
      }
      if(d.method==='Network.loadingFinished'){
        const u=requests.get(d.params.requestId);
        if(!u) return;
        const n=d.params.encodedDataLength||0;
        networkBytes+=n; requestCount++; lastNetworkAt=Date.now();
        if(u.includes('/runtime-v2/chunks/')){chunkBytes+=n;chunkRequests++;}
      }
    };
    function send(method,params={}){
      return new Promise((resolve,reject)=>{
        const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},60000);
        pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
      });
    }
    async function read(expression){
      const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }

    await send('Runtime.enable');await send('Network.enable');await send('Page.enable');
    const t0=Date.now();
    await send('Page.navigate',{url});
    let first=null;
    for(let i=0;i<360;i++){
      first=await read(`(()=>{try{window.__perf?.passo();}catch{};const v2=window.__runtimeV2?.stats?.();return {
        perf:!!window.__perf,live:window.__int?.vivos?.().size||0,mounted:v2?.mounted||0,resident:v2?.resident||0};})()`);
      if(first.perf && first.live>0 && (!${isV2} || first.mounted>0)) break;
      await delay(100);
    }
    assert.ok(first?.perf,label+' perf probe missing');
    assert.ok(first.live>0,label+' never built scene groups');
    if(isV2) assert.ok(first.mounted>0,label+' never mounted a V2 chunk');
    const firstSceneMs=Date.now()-t0;

    await read(`(()=>{const i=window.__int;i.target.set(0,0,0);i.sph.radius=480;i.sph.phi=.98;i.sph.theta=.55;
      try{window.__runtimeV2?.controller?.update(true);}catch{};try{window.__perf.passo();}catch{};return true;})()`);

    let settled=null,stable=0,lastSig='';
    for(let i=0;i<480;i++){
      settled=await read(`(()=>{try{window.__perf?.passo();window.__perf?.bombeia(200);}catch{}
        const v=window.__runtimeV2;const s=v?.stats?.();return {
          queue:window.__perf?.fila?.()??-1,live:window.__int?.vivos?.().size||0,
          mounted:s?.mounted||0,resident:s?.resident||0,
          loading:v?.loader?.pendingIds?.().size||0,syncing:v?.bridge?.syncing?.()||0};})()`);
      const done=settled.queue===0 && (!isV2 || (settled.loading===0&&settled.syncing===0&&settled.mounted>0));
      const sig=JSON.stringify(settled);
      stable=(done&&sig===lastSig)?stable+1:0;lastSig=sig;
      if(stable>=5 && Date.now()-lastNetworkAt>400) break;
      await delay(100);
    }
    const settledMs=Date.now()-t0;
    assert.equal(settled.queue,0,label+' streaming queue did not settle');
    if(isV2){assert.equal(settled.loading,0);assert.equal(settled.syncing,0);}

    await read('(()=>{for(let i=0;i<3;i++)window.__perf.mede(1,false);return true})()');
    const render=await read('window.__perf.mede(15,false)');
    const scene=await read(`(()=>({geometries:window.__perf.renderer.info.memory.geometries,
      live:window.__int.vivos().size,dpr:window.__perf.dpr(),level:window.__perf.nivel,
      v2:window.__runtimeV2?.stats?.()||null}))()`);
    const heap=await send('Runtime.getHeapUsage');

    await delay(300);
    assert.equal(httpErrors.length,0,label+' HTTP errors: '+JSON.stringify(httpErrors));
    assert.equal(errors.length,0,label+' runtime errors: '+JSON.stringify(errors));
    return {
      label,htmlBytes:await headBytes(url),firstSceneMs,settledMs,networkBytes,requestCount,
      chunkRequests,chunkBytes,heapUsedBytes:heap.usedSize,renderMs:render.ms,
      drawCalls:render.calls,triangles:render.tris,geometries:scene.geometries,
      liveGroups:scene.live,dpr:scene.dpr,quality:scene.level,
      resident:scene.v2?.resident||0,mounted:scene.v2?.mounted||0
    };
  } finally {
    socket?.close();
    for(const c of pending.values()) clearTimeout(c.timer);
    chrome.kill('SIGKILL');
  }
}

const v1=await runCase('v1',v1Url,false);
const v2=await runCase('v2',v2Url,true);
const pct=(a,b)=>b?Math.round((a/b-1)*1000)/10:null;
const delta={
  htmlBytesPct:pct(v2.htmlBytes,v1.htmlBytes),
  networkBytesPct:pct(v2.networkBytes,v1.networkBytes),
  firstSceneMsPct:pct(v2.firstSceneMs,v1.firstSceneMs),
  settledMsPct:pct(v2.settledMs,v1.settledMs),
  heapUsedPct:pct(v2.heapUsedBytes,v1.heapUsedBytes),
  renderMsPct:pct(v2.renderMs,v1.renderMs),
  drawCallsPct:pct(v2.drawCalls,v1.drawCalls),
  geometriesPct:pct(v2.geometries,v1.geometries)
};
assert.ok(v2.htmlBytes<v1.htmlBytes,'slim V2 HTML did not remove monolithic payload');
assert.ok(v2.chunkRequests>0,'V2 made no chunk requests');
assert.ok(v2.networkBytes<v1.networkBytes,'V2 startup transferred no less data than V1');
console.log('RUNTIME_AB',JSON.stringify({v1,v2,delta}));
