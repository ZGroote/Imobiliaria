import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three/webgpu';
import {validarSnapshot} from './estoque-runtime.js';
import {attachStock} from './estoque-adapter.js';
import {createParkingHighlight,validarVagas} from './vagas.js';
const book='c7dae676c82eab758370e386cea7fe6bd31dded9fa436eb53ebdfe70be7bb50b';
const empty=()=>({priceCents:null,areaM2:null,bedrooms:null,bathrooms:null,parking:null,description:null,conditions:null});
const stamp={revision:1,updatedAt:{toDate:()=>new Date('2026-10-24T12:00:00Z')},lastChangeId:'a'.repeat(20)};
const units=Array.from({length:170},(_,i)=>{const pp=String(Math.floor(i/10)).padStart(2,'0'),ff=String(i%10+1).padStart(2,'0');
  return {...stamp,id:`p${pp}-f${ff}`,floor:Math.floor(i/10),final:i%10+1,technicalId:`liv-ipanema/pavimento-modelo-${pp}/final-${ff}`,commercialNumber:null,availability:'nao_informada',profileId:null,overrides:empty()};});
const settings={...stamp,schema:'liv-sales-v1',bookSHA256:book,model:'liv-ipanema',total:170,title:'TESTE SINTÉTICO',publicEnabled:true};
const profiles=['canto','meio'].map(id=>({...stamp,id,info:empty()}));
const vagas=JSON.parse(await readFile(new URL('./modelo/entrada/candidato/vagas.json',import.meta.url),'utf8'));

test('vagas.json traz as 175 vagas numeradas, uma vez cada',()=>{
  const byNumber=validarVagas(vagas);
  assert.equal(byNumber.size,175);assert.deepEqual([...byNumber.keys()].sort((a,b)=>a-b),Array.from({length:175},(_,i)=>i+1));
  assert.deepEqual([...byNumber.values()].filter(v=>v.acessivel).map(v=>v.numero).sort((a,b)=>a-b),[12,13,30,31,32,33,34,35,36]);
});

test('mapa do painel vira a lista de vagas de cada apartamento; sem mapa, nenhuma',()=>{
  const catalog={schema:'liv-building-units-v1',source:{bookSHA256:book},units:units.map(u=>({id:u.technicalId}))};
  const snap=validarSnapshot(settings,units,profiles,{spaces:{87:'p01-f02',13:'p00-f01',12:'p00-f01'}});
  const next=attachStock(catalog,snap,null);
  assert.deepEqual(next.units[0].parkingSpaces,[12,13]);assert.deepEqual(next.units[11].parkingSpaces,[87]);assert.deepEqual(next.units[2].parkingSpaces,[]);
  assert.deepEqual(attachStock(catalog,validarSnapshot(settings,units,profiles),null).units[0].parkingSpaces,[]);
  assert.deepEqual(attachStock(next,null,null).units[0].parkingSpaces,[]);
  // Mapa malformado: nenhuma vaga, mas o estoque continua valendo.
  assert.deepEqual(validarSnapshot(settings,units,profiles,{spaces:{176:'p00-f01'}}).parking,{});
  assert.deepEqual(validarSnapshot(settings,units,profiles,{spaces:{1:'p99-f01'}}).parking,{});
});

test('destaque acende só vagas conhecidas, no lugar e no tamanho do vagas.json',()=>{
  const scene=new THREE.Scene(),h=createParkingHighlight(scene,vagas);
  assert.deepEqual(h.setSpaces([13,12,999,12]),[12,13]);assert.equal(h.group.visible,true);
  const v12=vagas.vagas.find(v=>v.numero===12),mesh=h.group.children.find(o=>o.name==='Vaga 12');
  assert.deepEqual([mesh.position.x,mesh.position.z],[v12.x,v12.z]);assert.equal(mesh.scale.z,v12.comprimento);
  h.setSpaces([]);assert.equal(h.group.visible,false);assert.equal(h.group.children.length,0);
  h.dispose();assert.equal(scene.children.length,0);
});
