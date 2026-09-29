import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const url=process.argv[2];
if(!url) throw Error('usage: node tests/browser_runtime_v2.mjs <url>');
const chromeBin=process.env.CHROME;
if(!chromeBin) throw Error('CHROME env is required');

const profile=await fs.mkdtemp(path.join(os.tmpdir(),'imob-runtime-v2-'));
const chrome=spawn(chromeBin,[
 '--headless=new','--no-sandbox','--disable-dev-shm-usage','--remote-debugging-port=0','--user-data-dir='+profile,
 '--window-size=1280,900','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 '--no-first-run','--disable-background-networking','about:blank'
],{stdio:['ignore','ignore','pipe']});
let chromeErr=''; chrome.stderr.on('data',d=>{chromeErr+=d.toString();});
let socket,seq=0;
const pending=new Map(),errors=[],httpErrors=[],chunkUrls=new Set();
try{
 let port;
 for(let i=0;i<120;i++){
  try{port=(await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}
  catch{await delay(100);}
 }
 if(!port) throw Error('Chrome did not start: '+chromeErr.slice(-2000));
 const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 socket.onmessage=e=>{
  const d=JSON.parse(e.data),call=pending.get(d.id);
  if(call){pending.delete(d.id);clearTimeout(call.timer);d.error?call.reject(Error(JSON.stringify(d.error))):call.resolve(d.result);}
  if(d.method==='Runtime.exceptionThrown') errors.push(d.params.exceptionDetails);
  if(d.method==='Network.responseReceived'){
   const r=d.params.response;
   if(r.status>=400&&!r.url.endsWith('/favicon.ico')) httpErrors.push({url:r.url,status:r.status});
   if(r.url.includes('/runtime-v2/chunks/')) chunkUrls.add(r.url);
  }
 };
 function send(method,params={}){
  return new Promise((resolve,reject)=>{
   const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},45000);
   pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });
 }
 async function read(expression){
  const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
 }
 await send('Runtime.enable');await send('Network.enable');await send('Page.enable');
 await send('Page.navigate',{url});
 let stats;
 for(let i=0;i<240;i++){
  stats=await read("(()=>{try{window.__perf?.passo(performance.now());}catch{};return window.__runtimeV2?.stats?.()||null})()");
  if(stats?.mounted>0&&stats?.resident>=stats.mounted) break;
  await delay(250);
 }
 assert.ok(stats,'Runtime V2 diagnostics not exposed');
 assert.equal(stats.chunks,3876);
 assert.equal(stats.buildings,89895);
 assert.ok(stats.mounted>0,'no V2 chunks mounted');
 assert.ok(stats.resident<stats.chunks/2,'startup loaded too much of the city');
 assert.ok(chunkUrls.size>0,'no chunk requests observed');
 assert.ok(chunkUrls.size<stats.chunks/2,'network fetched too much of the city');
 assert.equal(httpErrors.length,0,JSON.stringify(httpErrors));
 assert.equal(errors.length,0,JSON.stringify(errors));

 const before=await read('Array.from(window.__runtimeV2.bridge.mountedIds()).sort()');
 await read('window.__int.sph.theta+=Math.PI; window.__perf.passo(performance.now()); true');
 for(let i=0;i<80;i++){await read('window.__perf.passo(performance.now()); true');await delay(100);}
 const after=await read('Array.from(window.__runtimeV2.bridge.mountedIds()).sort()');
 assert.notDeepEqual(after,before,'180 degree camera turn did not change visible chunk set');

 console.log('RUNTIME_V2_BROWSER',JSON.stringify({...stats,chunkRequests:chunkUrls.size,before:before.length,after:after.length}));
}finally{
 socket?.close();
 for(const c of pending.values()) clearTimeout(c.timer);
 chrome.kill('SIGKILL');
}
