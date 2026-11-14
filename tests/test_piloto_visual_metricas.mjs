import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../experimentos/piloto-qualidade-visual-2026-10-04/metricas.js',import.meta.url),'utf8');

function harness({walls}={}) {
  const frames=[], nodes=[], docEvents=new Map(), windowEvents=new Map();
  let mode='planta3d', enabled=false, wallPreference=walls, forbiddenCalls=0;
  const forbidden=()=>{forbiddenCalls++;throw new Error('Métricas devem permanecer locais');};
  const document={visibilityState:'visible',body:{append:node=>nodes.push(node)},
    createElement:tag=>({tag,textContent:'',hidden:false}),
    addEventListener(name,fn){docEvents.set(name,[...(docEvents.get(name)||[]),fn]);}};
  const gl={RENDERER:7937,getParameter:()=> 'GPU simulada para teste'};
  const context={document,location:{href:'https://piloto.test/maquete.html'},URL,innerWidth:1280,innerHeight:720,
    requestAnimationFrame:fn=>frames.push(fn),
    addEventListener(name,fn){windowEvents.set(name,[...(windowEvents.get(name)||[]),fn]);},
    __pilotoRelease:'teste-local',__pilotoVisual:{snapshot:()=>({enabled,
      ...(typeof wallPreference==='boolean'?{wallsEnabled:wallPreference}:{})})},
    __maq:{modo:()=>mode,cam:{position:{toArray:()=>[3,4,5]}},alvo:{toArray:()=>[0,0,0]},
      ren:{info:{render:{calls:7,triangles:999},memory:{textures:2,geometries:4}},
        getContext:()=>gl,getPixelRatio:()=>1.25}},
    fetch:forbidden,navigator:{sendBeacon:forbidden},XMLHttpRequest:forbidden,WebSocket:forbidden};
  for(const name of ['localStorage','sessionStorage','indexedDB'])Object.defineProperty(context,name,{get:forbidden});
  context.window=context;
  vm.runInNewContext(source,context,{filename:'metricas.js'});
  const frame=now=>{assert.equal(frames.length,1);frames.shift()(now);};
  return {frame,nodes,
    run(from,to,step=16){for(let now=from;now<=to;now+=step)frame(now);},
    visibility(value){document.visibilityState=value;for(const fn of docEvents.get('visibilitychange')||[])fn();},
    switch({finish=enabled,page=mode,walls=wallPreference}={}){enabled=finish;mode=page;wallPreference=walls;},
    snapshot(){return JSON.parse(nodes[0].textContent);},forbiddenCalls:()=>forbiddenCalls};
}

test('aba oculta e retomada descartam lacuna da primeira amostra, com e sem rAF oculto',()=>{
  for(const hiddenRaf of [false,true]) {
    const h=harness();h.run(0,2000);
    h.visibility('hidden');
    if(hiddenRaf)h.frame(200000);
    h.visibility('visible');h.frame(400000);
    let metrics=h.snapshot().sampling['planta3d|false'];
    assert.ok(metrics.samples>0);
    assert.equal(metrics.maxMs,16);
    assert.equal(metrics.p95Ms,16);
    h.run(400016,400600);
    metrics=h.snapshot().sampling['planta3d|false'];
    assert.equal(metrics.maxMs,16);
    assert.equal(metrics.startupMaxMs,16);
  }
});

test('trocar A/B e modo separa grupos e não atribui intervalo de transição a outro acabamento',()=>{
  const h=harness();h.run(0,2000);
  h.switch({finish:true});h.frame(200000);
  const before=h.snapshot().sampling['planta3d|false'];
  h.run(200016,202000);
  let snapshot=h.snapshot();
  assert.deepEqual(snapshot.sampling['planta3d|false'],before);
  assert.equal(snapshot.sampling['planta3d|true'].maxMs,16);
  assert.equal(snapshot.sampling['planta3d|true'].startupMaxMs,16);
  h.switch({page:'visita'});h.frame(400000);h.run(400016,402000);
  snapshot=h.snapshot();
  assert.equal(Object.keys(snapshot.sampling).length,3);
  assert.equal(snapshot.sampling['visita|true'].maxMs,16);
  assert.equal(snapshot.sampling['visita|true'].startupMaxMs,16);
});

test('alternar somente parede separa as amostras e descarta o primeiro delta da transição',()=>{
  const h=harness({walls:true});h.switch({finish:true});h.run(0,2000);
  h.switch({walls:false});h.frame(200000);
  let snapshot=h.snapshot();
  // A exportação tem throttle; a transição exporta os contadores anteriores completos.
  const textured=snapshot.sampling['planta3d|true|paredes:true'];
  assert.ok(textured?.samples>0);
  assert.equal(snapshot.sampling['planta3d|true|paredes:false'].samples,0);
  assert.equal(snapshot.sampling['planta3d|true|paredes:false'].startupMaxMs,0);
  h.run(200016,202000);snapshot=h.snapshot();
  assert.equal(snapshot.sampling['planta3d|true|paredes:false'].maxMs,16);
  assert.equal(snapshot.sampling['planta3d|true|paredes:false'].startupMaxMs,16);
  assert.deepEqual(snapshot.sampling['planta3d|true|paredes:true'],textured);
  h.switch({walls:true});h.frame(400000);
  snapshot=h.snapshot();
  const smooth=snapshot.sampling['planta3d|true|paredes:false'];
  assert.deepEqual(snapshot.sampling['planta3d|true|paredes:true'],textured);
  h.run(400016,402000);
  snapshot=h.snapshot();
  assert.equal(Object.keys(snapshot.sampling).length,2);
  assert.deepEqual(snapshot.sampling['planta3d|true|paredes:false'],smooth);
  assert.equal(snapshot.sampling['planta3d|true|paredes:true'].maxMs,16);
  assert.equal(snapshot.sampling['planta3d|true|paredes:true'].startupMaxMs,16);
});

test('preferência da parede em Base não divide amostras com o mesmo acabamento aplicado',()=>{
  const h=harness({walls:true});h.run(0,2000);
  const before=h.snapshot().sampling['planta3d|false|paredes:false'];
  assert.ok(before.samples>0);
  h.switch({walls:false});h.run(2016,4000);
  const snapshot=h.snapshot();
  assert.deepEqual(Object.keys(snapshot.sampling),['planta3d|false|paredes:false']);
  assert.ok(snapshot.sampling['planta3d|false|paredes:false'].samples>before.samples);
  assert.equal(snapshot.sampling['planta3d|false|paredes:false'].maxMs,16);
});

test('instrumentação escreve somente output DOM oculto, sem persistência nem envio',()=>{
  const h=harness();h.run(0,2000);h.switch({finish:true});h.run(2016,4000);
  h.visibility('hidden');h.frame(5000);h.visibility('visible');h.run(8000,10000);
  assert.equal(h.forbiddenCalls(),0);
  assert.equal(h.nodes.length,1);
  assert.equal(h.nodes[0].id,'piloto-metricas');
  assert.equal(h.nodes[0].hidden,true);
  assert.equal(h.snapshot().renderer,'GPU simulada para teste');
  assert.deepEqual(h.snapshot().errors,[]);
});
