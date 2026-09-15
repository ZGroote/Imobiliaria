import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/listings/identity.js',import.meta.url),'utf8'),ctx);
const building=x=>({r:[[x,0],[x+10,0],[x+10,10],[x,10]]});

test('listing resolution retains saved, registered and nearest-anchor priorities',()=>{
  const a=building(0),b=building(50),units=[],saved=new Map();
  let groups=[{cx:30,cz:0,rad:50,B:[a,b]}];
  const resolver=ctx.ListingIdentity.create({units,getGroups:()=>groups,slug:'city',storage:{le:k=>saved.get(k)},
    px:x=>x,pz:z=>z,recDoLancamento:u=>u.record,recsDoLancamento:u=>u.records||[]});
  const unit={id:'one',predio_id:resolver.idDoRegistro(a),ancora:{lon:55,lat:5},planta:{comodos:[{}]}};units.push(unit);
  assert.equal(resolver.predioDaUnidade(unit).rec,a);
  saved.set(resolver.chaveAncora(unit.id),resolver.idDoRegistro(b));assert.equal(resolver.predioDaUnidade(unit).rec,b);
  assert.equal(resolver.unidadeDoPredio(b),unit);assert.equal(resolver.unidadeDoPredio(a),null);
  saved.clear();delete unit.predio_id;assert.equal(resolver.predioDaUnidade(unit).rec,b);
  assert.equal(resolver.predioDaUnidade(unit).confirmado,false);
  unit.ancora.confirmado=true;assert.equal(resolver.predioDaUnidade(unit).confirmado,true);
  assert.equal(resolver.chaveAncora('one'),'ancora_city_one');
  groups=[];assert.equal(resolver.predioDaUnidade(unit),null);
});

test('lots own only declared buildings; forced plans remain a fallback',()=>{
  const a=building(0),b=building(50),units=[];
  const resolver=ctx.ListingIdentity.create({units,getGroups:()=>[{cx:0,cz:0,rad:100,B:[a,b]}],slug:'city',
    storage:{le:()=>{throw Error('blocked');}},px:x=>x,pz:z=>z,
    recDoLancamento:u=>u.record||null,recsDoLancamento:u=>u.records||[],forcedPlan:'forced'});
  const lot={id:'lot',lote:{lon:5,lat:5,confirmado:true},planta:{comodos:[{}]}};units.push(lot);
  assert.equal(resolver.predioDaUnidade(lot).rec,null);assert.equal(resolver.unidadeDoPredio(a),null);
  lot.record=a;lot.records=[a,b];assert.equal(resolver.unidadeDoPredio(b),lot);
  const forced={id:'forced',planta:{comodos:[{}]}};units.push(forced);
  assert.equal(resolver.unidadeDoPredio(building(200)),forced);
  assert.equal(resolver.unidadeDoPredio(a),lot);
});
