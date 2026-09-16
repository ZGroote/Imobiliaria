import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','cf9f01f:renderizador-v16-moveis/app.js'],{encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
const source=app.slice(app.indexOf('/* ---- governador de resolução'),app.indexOf('/* ---- medidor'));
function create(modular,level) {
  const calls=[],ctx=vm.createContext({document:{hidden:false},devicePixelRatio:2,NIVEL:{dpr:1.5,dprMin:.6},NIVEL_NOME:level,
    streaming:{pending:0},INT:{voo:null},renderer:{setPixelRatio:d=>calls.push(['dpr',d])},
    resize:()=>calls.push(['resize']),guarda:{grava:(...args)=>calls.push(['save',...args])},atualizaBotaoQual:()=>calls.push(['button'])});
  if(modular){vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/scene/resolution-governor.js',import.meta.url),'utf8'),ctx);
    vm.runInContext('globalThis.api=ResolutionGovernor.create({document,getDevicePixelRatio:()=>devicePixelRatio,NIVEL,NIVEL_NOME,streaming,INT,renderer,resize,guarda,atualizaBotaoQual});',ctx);
  } else vm.runInContext(source+'\nglobalThis.api={update:governa,get dpr(){return dprAtual;},get frameMs(){return _cpuMed;}};',ctx);
  return {ctx,calls};
}
test('resolution governor matches slow, fast, hidden, throttled, loading and flight frame sequences',()=>{
  for(const level of ['baixo','medio','alto']) {
    const a=create(false,level),b=create(true,level);let now=1;
    const batch=(dt,n,patch={})=>{
      for(const c of [a,b]) {c.ctx.document.hidden=!!patch.hidden;c.ctx.streaming.pending=patch.pending||0;c.ctx.INT.voo=patch.flight?{}:null;}
      for(let i=0;i<n;i++) {now+=dt;for(const c of [a,b])c.ctx.api.update(now);
        assert.equal(b.ctx.api.dpr,a.ctx.api.dpr);assert.equal(b.ctx.api.frameMs,a.ctx.api.frameMs);assert.deepEqual(b.calls,a.calls);}
    };
    batch(16,50);batch(90,70,{pending:3});batch(90,70,{flight:true});
    batch(1000,10);batch(100,70,{hidden:true});batch(100,200);
    assert.equal(b.ctx.api.dpr,.6);batch(10,600);assert(b.ctx.api.dpr>1.4);
    assert.equal(b.calls.filter(c=>c[0]==='save').length,level==='baixo'?0:1);
  }
});
