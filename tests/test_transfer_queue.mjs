import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
for(const runtime of ['liv-experimental-2026-10-14','laranjeiras-2026-10-30/site']){
 const source=readFileSync(new URL(`../experimentos/${runtime}/transfer-worker.js`,import.meta.url),'utf8');
 const harness=()=>{
  const context=vm.createContext({URL,crypto:{randomUUID:()=> 'fixture'},self:{location:{href:'https://example.test/assets/transfer-worker.js'},addEventListener(){}},AbortController,DOMException,setTimeout,clearTimeout});
  vm.runInContext(source+`;globalThis.api={jobs,running,next:pickJob,enable(){enabled=true;paused=false;},add(id,bytes,{demand=true,essential=false,group='tour'}={}){const job={meta:{path:id,url:id,bytes,group,essential,index:jobs.size,background:!demand},status:'pending',waiters:new Set(demand?[{}]:[]),demandOrder:jobs.size};jobs.set(id,job);return job;},start(job){job.status='downloading';running.set(job,{job});}};`,context);return context.api;
 };
 test(`${runtime}: limite de buffers adia arquivos grandes e usa espaço com os menores`,()=>{
  const q=harness(),mb=1024*1024,first=q.add('first',10*mb),large=q.add('large',10*mb),small=q.add('small',4*mb),last=q.add('last',2*mb);
  assert.equal(q.next(),first);q.start(first);assert.equal(q.next(),small);q.start(small);assert.equal(q.next(),last);q.start(last);assert.equal(q.next(),null);
  q.running.clear();first.status=small.status=last.status='cached';assert.equal(q.next(),large);
 });
 test(`${runtime}: arquivo acima do orçamento roda sozinho; fundo e pré-requisito não disputam a abertura`,()=>{
  const q=harness(),big=q.add('big',32*1024*1024),tiny=q.add('tiny',100);assert.equal(q.next(),big);q.start(big);assert.equal(q.next(),null);
  const bg=harness();bg.enable();const one=bg.add('bg1',100,{demand:false}),two=bg.add('bg2',100,{demand:false});assert.equal(bg.next(),one);bg.start(one);assert.equal(bg.next(),null,'Só um download de fundo.');
  const pre=harness(),needed=pre.add('scene',100),catalog=pre.add('catalog',100,{demand:false,essential:true});assert.equal(pre.next(),catalog);pre.start(catalog);assert.equal(pre.next(),null);pre.running.clear();catalog.status='cached';assert.equal(pre.next(),needed);
 });
}
