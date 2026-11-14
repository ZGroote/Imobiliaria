import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from './node_modules/three/build/three.webgpu.js';
import {validarConfig,validarSnapshot} from './estoque-runtime.js';
import {attachStock} from './estoque-adapter.js';
const book='c7dae676c82eab758370e386cea7fe6bd31dded9fa436eb53ebdfe70be7bb50b';
const empty=()=>({priceCents:null,areaM2:null,bedrooms:null,bathrooms:null,parking:null,description:null,conditions:null});
const stamp={revision:1,updatedAt:{toDate:()=>new Date('2026-10-11T23:00:00Z')},lastChangeId:'a'.repeat(20)};
function snapshot(){return {settings:{...stamp,schema:'liv-sales-v1',bookSHA256:book,model:'liv-ipanema',total:170,title:'TESTE SINTÉTICO',publicEnabled:true},
  profiles:['canto','meio'].map(id=>({...stamp,id,info:empty()})),units:Array.from({length:170},(_,i)=>{
    const floor=Math.floor(i/10),final=i%10+1,ff=String(final).padStart(2,'0'),pp=String(floor).padStart(2,'0');
    return {...stamp,id:`p${pp}-f${ff}`,floor,final,technicalId:`liv-ipanema/pavimento-modelo-${pp}/final-${ff}`,commercialNumber:null,availability:'nao_informada',profileId:null,overrides:empty()};})};}
test('configuração: padrão inativo, projetos/IDs inválidos e emulador fora de loopback rejeitados',()=>{
  assert.equal(validarConfig({schema:'liv-sales-config-v1',mode:'desativado'},'?estoque=x'),null);
  const cfg={schema:'liv-sales-config-v1',mode:'emulador',firebase:{projectId:'demo-painel',apiKey:'demo-key'},emulatorPort:8180};
  assert.equal(validarConfig(cfg,'?estoque=teste','127.0.0.1').id,'teste');
  assert.throws(()=>validarConfig(cfg,'?estoque=teste','example.com'));
  assert.throws(()=>validarConfig(cfg,'?estoque=../../users','127.0.0.1'));
  assert.throws(()=>validarConfig({...cfg,mode:'firebase'},'?estoque=teste'));
});
test('consulta exige todas as posições e duas plantas, sem disponibilidade presumida',()=>{
  const s=snapshot();assert.equal(validarSnapshot(s.settings,s.units,s.profiles).units.length,170);
  assert.throws(()=>validarSnapshot(s.settings,s.units.slice(1),s.profiles));
  assert.throws(()=>validarSnapshot(s.settings,s.units,[s.profiles[0],s.profiles[0]]));
  const bad=snapshot();bad.units[0].commercialNumber='101';bad.units[1].commercialNumber='101';
  assert.throws(()=>validarSnapshot(bad.settings,bad.units,bad.profiles));
});
test('dados herdados, exceções e vínculos alimentam o mesmo catálogo; retirada apaga dados públicos',async()=>{
  const s=snapshot(),catalog={schema:'liv-building-units-v1',source:{bookSHA256:book},units:s.units.map(u=>({id:u.technicalId}))};
  s.profiles[0].info={...empty(),priceCents:30000001,areaM2:47.59,bedrooms:2,description:'<img src=x> TEXTO'};
  s.units[0].profileId='canto';s.units[0].availability='vendida';s.units[0].overrides.priceCents=0;
  s.units[1].profileId='canto';s.units[1].availability='disponivel';
  const interiors=JSON.parse(await readFile(new URL('./interiores/catalogo.json',import.meta.url),'utf8'));
  const next=attachStock(catalog,validarSnapshot(s.settings,s.units,s.profiles),interiors);
  assert.equal(next.units[0].commercial.priceCents,0);assert.equal(next.units[1].commercial.priceCents,30000001);
  assert.equal(next.units[0].salesDetails.bedrooms,2);assert.equal(next.units[0].relation.typology,'canto');
  assert.equal(next.units[2].relation,null);assert.equal(next.units[2].commercial.availability,'nao_informada');
  const removed=attachStock(next,null,null);assert.equal(removed.commercialSource,null);assert.equal(removed.units[0].relation,null);assert.equal(removed.units[0].salesDetails,null);
  assert.ok(removed.units.every(u=>u.commercial.availability==='nao_informada'));
});
test('giro de implantação cruza a avenida e aponta a portaria para a faixa sudoeste',async()=>{
  const parcel=JSON.parse(await readFile(new URL('./mapa-parcela.json',import.meta.url),'utf8'));
  const context=vm.createContext({LivMapParcelData:parcel});vm.runInContext(await readFile(new URL('./mapa-implantacao.js',import.meta.url),'utf8'),context);
  const p=context.LivMapPlacement;assert.ok(Math.abs(p.rotation-p.previousRotation-Math.PI)<1e-12);
  const transform=(anchor,r,v)=>[anchor[0]+Math.cos(r)*v[0]+Math.sin(r)*v[1],anchor[1]-Math.sin(r)*v[0]+Math.cos(r)*v[1]];
  const inward=[-.7675478204052602,.6409916874586863];
  const road=parcel.roadPointXZ;
  const side=point=>point.reduce((sum,x,i)=>sum+(x-road[i])*inward[i],0);
  const gate=transform(p.anchor,p.rotation,p.entranceLocal);
  assert.ok(side(p.previousAnchor)<0);assert.ok(side(p.anchor)>0);
  assert.ok(Math.abs(side(gate)-14)<1e-6);
  for(const v of [[51.04,-39.585],[51.04,27.985],[43.5,35.525],[-36.54,49.445],[-36.54,-39.15]]){
    const point=transform(p.anchor,p.rotation,v);assert.ok(p.contains(...point),'Implantação saiu do contorno indicado');
  }
  assert.ok(Math.hypot(...p.anchor.map((x,i)=>x-p.previousAnchor[i]))>100);
  const v=[1,0],old=transform([0,0],p.previousRotation,v),now=transform([0,0],p.rotation,v);
  assert.ok(Math.hypot(...old.map((x,i)=>x+now[i]))<1e-10);
});

test('recorte do lote preserva vizinhos externos e trechos de muro fora de uma máscara côncava',async()=>{
  const parcel=JSON.parse(await readFile(new URL('./mapa-parcela.json',import.meta.url),'utf8'));
  const context=vm.createContext({LivMapParcelData:parcel});vm.runInContext(await readFile(new URL('./mapa-implantacao.js',import.meta.url),'utf8'),context);
  const p=context.LivMapPlacement,[x,z]=parcel.anchor;
  const inside={r:[[x-1,z-1],[x+1,z-1],[x+1,z+1],[x-1,z+1]]},outside={r:[[0,0],[1,0],[1,1],[0,1]]};
  assert.ok(p.excludeBuilding(inside));assert.ok(p.excludeBuilding(inside));assert.equal(p.stats().excludedBuildings,1);
  assert.equal(p.excludeBuilding(outside),false);
  const yards=[{x,z,lot:1},{x:0,z:0,lot:2}];assert.equal(p.filterParcels(yards)[0].lot,2);assert.equal(yards.length,2);
  const a=[-3500,z],b=[-3200,z],intervals=p.wallIntervals([[0,1]],a,b);
  assert.ok(intervals.length>=2);
  for(const [lo,hi] of intervals){const mid=(lo+hi)/2;assert.equal(p.contains(a[0]+(b[0]-a[0])*mid,z),false);}
  const far=[[0,1]];assert.equal(p.wallIntervals(far,[0,0],[1,1]),far);
  const avenue={k:2,name:'avenida',pts:[a,b]};assert.equal(p.clipRoad(avenue)[0],avenue);
  const service=p.clipRoad({...avenue,k:9});assert.equal(service.length,2);
  for(const road of service)for(let i=1;i<road.pts.length;i++){
    const v=road.pts[i-1],w=road.pts[i];assert.equal(p.contains((v[0]+w[0])/2,(v[1]+w[1])/2),false);
  }
  assert.deepEqual(parcel.mapScale,[1,1,1]);assert.equal(parcel.polygonXZ.length,19);
});

test('recorte de piso conserva área externa e atributos; contorno de referência não gera sobra de terreno',async()=>{
  const raw=await readFile(new URL('./mapa-parcela.json',import.meta.url)),parcel=JSON.parse(raw);
  const context=vm.createContext({LivMapParcelData:parcel,TerrainFit:{refine(){}}});vm.runInContext(await readFile(new URL('./mapa-implantacao.js',import.meta.url),'utf8'),context);
  const p=context.LivMapPlacement,xs=parcel.polygonXZ.map(p=>p[0]),zs=parcel.polygonXZ.map(p=>p[1]);
  const x0=Math.min(...xs)-20,x1=Math.max(...xs)+20,z0=Math.min(...zs)-20,z1=Math.max(...zs)+20;
  const vertices=[[x0,z0],[x1,z0],[x1,z1],[x0,z0],[x1,z1],[x0,z1]],g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flatMap(([x,z])=>[x,0,z]),3));
  g.setAttribute('testValue',new THREE.Float32BufferAttribute(vertices.map(([x,z])=>x+z),1));
  const area=ring=>Math.abs(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p[0]*q[1]-q[0]*p[1];},0))/2;
  p.clipContextGeometry(THREE,g);const pos=g.attributes.position;let kept=0;
  for(let i=0;i<pos.count;i+=3){
    kept+=area([0,1,2].map(j=>[pos.getX(i+j),pos.getZ(i+j)]));
    assert.equal(p.contains((pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3,(pos.getZ(i)+pos.getZ(i+1)+pos.getZ(i+2))/3),false);
  }
  assert.ok(Math.abs(kept-((x1-x0)*(z1-z0)-area(parcel.polygonXZ)))<.2);
  for(let i=0;i<pos.count;i++)assert.ok(Math.abs(g.attributes.testValue.getX(i)-pos.getX(i)-pos.getZ(i))<.001);
  const before=g.attributes.position;assert.equal(p.clipContextGeometry(THREE,g).attributes.position,before);
  const scene=new THREE.Scene(),access=p.addParcel(THREE,scene,{sample:()=>0,amount:()=>0});
  assert.equal(access.group.children.length,1);assert.equal(access.group.children[0].name,'liv-acesso-avenida');
  const apron=access.group.children[0].geometry.attributes.position;let accessArea=0;
  for(let i=0;i<apron.count;i+=3)accessArea+=area([0,1,2].map(j=>[apron.getX(i+j),apron.getZ(i+j)]));
  assert.ok(accessArea<40,'Only the small gate access remains, without filling the parcel.');
  const renderer=await readFile(new URL('./renderer.js',import.meta.url),'utf8');
  assert.equal(renderer.includes('createParcelContext'),false);
  access.group.children[0].geometry.dispose();access.group.children[0].material.dispose();g.dispose();
});
