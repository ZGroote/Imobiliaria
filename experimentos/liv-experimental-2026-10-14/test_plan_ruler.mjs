import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {typology} from './tipologias.js';
import {planToScreen,screenToPlan,snapPlanPoint,planDistance} from './plan-ruler.js';

const area={width:1000,height:600},image={width:1000,height:1000};
const spec={mmPerPixel:10,paths:[[[100,100],[400,100],[400,300],[100,300]]]};
test('pontos usam o retângulo contido da imagem e descontam zoom e deslocamento',()=>{
  const point=screenToPlan({x:360,y:-150},{scale:2,x:120,y:-30},area,image);
  assert.deepEqual(point,{x:700,y:400});
  assert.deepEqual(planToScreen(point,{scale:2,x:120,y:-30},area,image),{x:360,y:-150});
  for(const scale of [1,1.25,3,6])for(const p of [{x:100,y:200},{x:950,y:20},{x:500,y:500}]){
    const view={scale,x:72,y:-15},roundtrip=screenToPlan(planToScreen(p,view,area,image),view,area,image);
    assert.ok(Math.hypot(roundtrip.x-p.x,roundtrip.y-p.y)<1e-9);
  }
});
test('encaixe prioriza o canto; tolerância é em pixels da tela e não cresce com o zoom',()=>{
  assert.deepEqual(snapPlanPoint({x:106,y:104},spec,1),{x:100,y:100,snap:'corner'});
  assert.deepEqual(snapPlanPoint({x:106,y:104},spec,3),{x:106,y:104,snap:null});
  assert.deepEqual(snapPlanPoint({x:220,y:106},spec,1),{x:220,y:100,snap:'wall'});
  assert.deepEqual(snapPlanPoint({x:220,y:150},spec,1),{x:220,y:150,snap:null});
});
test('régua mede diagonal em metros e conserva a distância sob zoom e pan',()=>{
  const a={x:100,y:100},b={x:400,y:500};assert.equal(planDistance(a,b,spec.mmPerPixel),5);
  for(const scale of [1,2,6]){
    const view={scale,x:37,y:-56};
    const a2=screenToPlan(planToScreen(a,view,area,image),view,area,image),b2=screenToPlan(planToScreen(b,view,area,image),view,area,image);
    assert.ok(Math.abs(planDistance(a2,b2,spec.mmPerPixel)-5)<1e-9);
  }
});

test('as duas réguas conservam a escala das referências e medem o dormitório publicado',()=>{
  for(const [kind,file]of [['canto','../../v1.5/miniaturas/liv-ipanema/interior/referencia.json'],['meio','./interiores/meio/referencia.json']]){
    const ref=JSON.parse(readFileSync(new URL(file,import.meta.url),'utf8')),spec=typology(kind).ruler;
    assert.equal(spec.mmPerPixel,ref.registro.mmPorPixel);assert.deepEqual([spec.width,spec.height],ref.tamanhoImagem);
    const [x,y,right,bottom]=ref.pontosObservados.dormitorio;
    const width=planDistance({x,y},{x:right,y},spec.mmPerPixel),depth=planDistance({x,y},{x,y:bottom},spec.mmPerPixel);
    assert.ok(Math.abs(width-2.65)<.05);assert.ok(Math.abs(depth-(kind==='canto'?2.55:2.6))<.05);
    assert.equal(snapPlanPoint({x:x+1,y:y+1},spec,1).snap,'corner');
  }
});
