import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expandBuildingCatalog} from './catalogo-unidades.js';
import {validateCommercial,attachCommercial,saleOf,saleLabel,priceLabel} from './comercial.js';
const catalog=expandBuildingCatalog(JSON.parse(readFileSync(new URL('modelo/entrada/unidades-entrada.json',import.meta.url),'utf8')));
// Fictional values only exercise the parser; they are never written to commercial.json.
const sample=()=>({schema:'liv-commercial-v1',status:'fornecido',bookSHA256:catalog.source.bookSHA256,
  source:{label:'Fixture sintética de teste',asOf:'2026-10-11'},units:[{id:catalog.units[0].id,commercialNumber:'TESTE-001',availability:'reservada',priceCents:12345678}]});
test('absent data leaves all 170 offers and numbers unknown',()=>{
  const absent={schema:'liv-commercial-v1',status:'ausente',bookSHA256:catalog.source.bookSHA256,source:null,units:[]};
  const result=attachCommercial(catalog,absent);assert.equal(result.commercialStatus,'ausente');
  assert.ok(result.units.every(unit=>saleOf(unit).priceCents===null&&saleOf(unit).availability==='nao_informada'));
  assert.equal(saleLabel(result.units[0]),'Não informada · preço não informado');
});
test('provided data binds only explicit IDs and retains the source/date and missing fields',()=>{
  const before=JSON.stringify(catalog),result=attachCommercial(catalog,sample());
  assert.equal(JSON.stringify(catalog),before);assert.equal(result.commercialSource.label,'Fixture sintética de teste');
  assert.equal(saleOf(result.units[0]).commercialNumber,'TESTE-001');assert.equal(saleOf(result.units[0]).parking,null);
  assert.equal(saleOf(result.units[1]).commercialNumber,null);assert.equal(result.units[0].typology,null);
  assert.match(saleLabel(result.units[0]),/^Reservada · R\$/);
});
test('duplicates, unknown IDs, invalid states/dates/centavos and stale registration fail atomically',()=>{
  for(const change of [d=>d.units.push({...d.units[0]}),d=>d.units[0].id='101',
    d=>d.units[0].availability='__proto__',d=>d.units[0].priceCents=12.34,d=>d.units[0].priceCents=-1,
    d=>d.units[0].priceCents=Number.MAX_SAFE_INTEGER+1,d=>d.bookSHA256='f'.repeat(64),
    d=>d.source.asOf='2026-02-30',d=>d.source.label='',d=>d.units[0].price=123,
    d=>d.units.push({...d.units[0],id:catalog.units[1].id,commercialNumber:' teste-001 '}),
    d=>{d.status='ausente';d.source=null;}]){
    const data=sample();change(data);assert.throws(()=>validateCommercial(data,catalog));
  }
});
test('price formatting preserves centavos at zero, one cent and the safe integer limit',()=>{
  for(const [priceCents,end] of [[0,',00'],[1,',01'],[Number.MAX_SAFE_INTEGER,',91']]){
    const data=sample();data.units[0].priceCents=priceCents;
    assert.ok(priceLabel(attachCommercial(catalog,data).units[0]).endsWith(end));
  }
});
