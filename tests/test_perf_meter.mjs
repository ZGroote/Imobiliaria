import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
const app=execFileSync('git',['-c','safe.directory='+root,'show','118f4ce:renderizador-v16-moveis/app.js'],
  {encoding:'utf8',maxBuffer:2e6}).replaceAll('\r','');
// `_cpuMs` é escrito pelo laço e continua no app.js; no módulo ele entra por leitor.
const source=app.slice(app.indexOf('const perfBox = $("perf");'),app.indexOf('const alvoSombra ='))
  .replace('_cpuMs.toFixed(1)','getCpuMs().toFixed(1)');

function fixture(modular,{perf='0',gpu='GeForce RTX 4070'}={}) {
  const el=new Map();
  const node=id=>{
    if(el.has(id)) return el.get(id);
    el.set(id,{id,textContent:'',className:'',hidden:undefined}); return el.get(id);
  };
  const ctx=vm.createContext({console,QS:new URLSearchParams('perf='+perf),GPU:gpu,$:node,
    NIVEL:{somMap:2048,somSuave:true}, NIVEL_NOME:'alto',
    governor:{dpr:1.5,frameMs:16.4},
    renderer:{info:{render:{calls:273,triangles:1482000},programs:[1,2,3],memory:{geometries:1107}}},
    gLive:new Map([['a',1],['b',2]]), streaming:{pending:4},
    getCpuMs:()=>7.25});
  if(modular) {
    vm.runInContext(fs.readFileSync(new URL('../v1.5/renderizador-v16-moveis/ui/perf-meter.js',import.meta.url),'utf8'),ctx);
    vm.runInContext(`globalThis.api=PerfMeter.create({$, QS, GPU, governor, renderer, NIVEL,
      NIVEL_NOME, gLive, streaming, getCpuMs});`,ctx);
  } else vm.runInContext(source+'\nglobalThis.api={mostraPerf,pintaPerf,ligado:()=>perfOn};',ctx);
  return {ctx,node,
    estado:()=>JSON.stringify([...el].map(([k,e])=>[k,e.textContent,e.className,e.hidden]))
      +vm.runInContext('JSON.stringify(api.ligado())',ctx)};
}

test('the HUD meter fields, throttle and FPS colour match the pre-extraction application',()=>{
  for(const op of [{},{perf:'1'},{gpu:''}]) {
    const a=fixture(false,op),b=fixture(true,op);
    assert.equal(b.estado(),a.estado(),'criação '+JSON.stringify(op));
    const passos=[
      `api.pintaPerf(1000)`,              // apagado: não escreve nada
      `api.mostraPerf(true)`,
      `api.pintaPerf(1000)`,              // primeiro desenho
      `api.pintaPerf(1100)`,              // dentro dos 260 ms: não reescreve
      `governor.frameMs=40; api.pintaPerf(1400)`,      // 25 FPS: cor "bad"
      `governor.frameMs=19; api.pintaPerf(1700)`,      // 52 FPS: cor "ok"
      `governor.frameMs=30; api.pintaPerf(2000)`,      // 33 FPS: cor "mid"
      `governor.frameMs=0; api.pintaPerf(2300)`,       // sem medida ainda
      `streaming.pending=0; api.pintaPerf(2600)`,      // fila vazia: só o vivo
      `api.mostraPerf(false); api.pintaPerf(2900)`,
      `api.mostraPerf(true); api.pintaPerf(3200)`,
    ];
    for(const passo of passos) {
      vm.runInContext(passo,a.ctx); vm.runInContext(passo,b.ctx);
      assert.equal(b.estado(),a.estado(),passo);
    }
  }
});

test('?perf=1 opens the meter already showing, and the GPU falls back to a message',()=>{
  const ligado=fixture(true,{perf:'1'});
  assert.equal(ligado.node('perf').hidden,false);
  assert.match(ligado.node('pfGpu').textContent,/GeForce/);
  const semGpu=fixture(true,{perf:'1',gpu:''});
  assert.match(semGpu.node('pfGpu').textContent,/GPU não identificada/);
  const apagado=fixture(true,{});
  assert.equal(apagado.node('perf').hidden,true);
  assert.equal(apagado.node('pfGpu').textContent,'','com o medidor apagado nem a GPU é lida');
});
