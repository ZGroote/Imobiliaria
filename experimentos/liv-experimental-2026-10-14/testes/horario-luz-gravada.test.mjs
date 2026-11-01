import test from 'node:test';
import assert from 'node:assert/strict';
import {timeLightWeights} from '../interior-luz-horario.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);
const key=(side,hour,extra={})=>({id:`${side}-${hour}`,side,hour,daylight:1,sunStrength:1,sunIrradianceRGB:[100,80,60],...extra});
const manifest={exposureEV:3,keys:[key('lazer',8),key('lazer',10,{sunIrradianceRGB:[140,120,100]}),key('lazer',18,{daylight:.5,sunStrength:.2}),key('estacionamento',8)],night:{id:'noite'}};
const time=(hour,extra={})=>({hour,daylight:1,sunStrength:1,night:0,context:{side:'lazer'},...extra});

test('entre duas horas gravadas mistura as vizinhas do mesmo lado, com a exposição da câmera',()=>{
  const w=timeLightWeights(manifest,time(9.5));
  assert.equal(w.a,'lazer-8');assert.equal(w.b,'lazer-10');
  near(w.wa,.25*8);near(w.wb,.75*8);near(w.wn,0);
  near(w.sun[0],(100+.75*40)*8);
});

test('fora das horas gravadas usa a borda, reescalada pela luz do dia do momento',()=>{
  const dawn=timeLightWeights(manifest,time(5,{daylight:.25,sunStrength:0,night:.75}));
  assert.equal(dawn.a,'lazer-8');assert.equal(dawn.b,'lazer-8');
  near(dawn.wa,.25*8);near(dawn.wb,0);near(dawn.wn,.75);assert.deepEqual(dawn.sun,[0,0,0]);
  const late=timeLightWeights(manifest,time(20,{daylight:0,sunStrength:0,night:1}));
  assert.equal(late.a,'lazer-18');near(late.wa,0);near(late.wn,1);
});

test('o outro lado nunca recebe a luz gravada da fachada oposta',()=>{
  const w=timeLightWeights(manifest,time(12,{context:{side:'estacionamento'}}));
  assert.equal(w.a,'estacionamento-8');assert.equal(w.b,'estacionamento-8');
  assert.throws(()=>timeLightWeights({...manifest,keys:[]},time(12)),/Sem luz gravada/);
});

test('a troca de lado mantém a última luz até as horas do outro lado chegarem, sem baixar duas vezes',async()=>{
  const {createTimeLightmaps}=await import('../interior-luz-horario.js');
  const entry=(id,extra)=>({id,path:`interiores/canto/luz-horario/${id}.rgbm.gz`,...extra});
  const tiny={...manifest,width:1,height:1,range:16,lightMapIntensity:Math.PI,
    keys:manifest.keys.map(k=>entry(k.id,k)),night:entry('noite',{})};
  const asked=[],releases=new Map();
  const load=file=>{asked.push(file.id);return new Promise(resolve=>releases.set(file.id,()=>resolve(new Uint8Array(4))));};
  const lights=createTimeLightmaps({manifest:tiny,load});
  assert.equal(lights.apply(time(9)),null,'sem textura não há luz gravada');
  const first=lights.ensure(time(9));
  assert.deepEqual(asked.slice(0,3),['lazer-8','lazer-10','noite']);
  for(const release of releases.values())release();await first;
  assert.equal(lights.apply(time(9)).stale,undefined);
  const other=lights.apply(time(9,{context:{side:'estacionamento'}}));
  assert.equal(other.stale,true);assert.equal(other.a,'lazer-8');
  lights.ensure(time(9));assert.equal(asked.filter(id=>id==='lazer-8').length,1);
});

test('só carrega as horas usadas e limita o cache, sem descartar a mistura ativa',async()=>{
  const {createTimeLightmaps}=await import('../interior-luz-horario.js');
  const asked=[],released=[];
  const tiny={width:1,height:1,range:16,lightMapIntensity:Math.PI,exposureEV:0,
    keys:Array.from({length:10},(_,i)=>key('lazer',i*2)),night:{id:'noite'}};
  const lights=createTimeLightmaps({manifest:tiny,load:async file=>{asked.push(file.id);return new Uint8Array(4);},release:value=>{released.push(value);value.dispose();}});
  await lights.ensure(time(1));lights.apply(time(1));
  assert.deepEqual(asked,['lazer-0','lazer-2','noite'],'Nenhuma outra hora compete com a abertura.');
  for(const hour of [5,9,13,17]){await lights.ensure(time(hour));assert.ok(!lights.apply(time(hour)).stale);}
  assert.ok(lights.getState().loaded.length<=5);assert.ok(released.length>0);
  const loaded=lights.getState().loaded;
  assert.ok(loaded.includes('lazer-16')&&loaded.includes('lazer-18')&&loaded.includes('noite'));
  const before=asked.length;await lights.ensure(time(17));assert.equal(asked.length,before,'Mistura ativa permanece reaproveitável.');
});
