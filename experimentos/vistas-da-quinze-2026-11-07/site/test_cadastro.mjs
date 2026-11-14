// node --test experimentos/laranjeiras-2026-10-30/site/test_cadastro.mjs  (depois de modelo/exportar_cena.py)
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateUnits} from './unidades.js';
import {attachStock} from './estoque-adapter.js';
import {attachCommercial,BOOK_SHA} from './comercial.js';
import {availableUnitIds} from './disponibilidade.js';

const catalog=JSON.parse(readFileSync(new URL('../assets/unidades.json',import.meta.url),'utf8'));

test('312 apartamentos: 3 torres x 13 pavimentos x 8 finais, canto nas pontas', () => {
  validateUnits(catalog);
  assert.equal(catalog.units.length, 312);
  for (const unit of catalog.units) {
    assert.equal(unit.typology, ['01','02','07','08'].includes(unit.final) ? 'canto' : 'meio', unit.id);
    // 02/07 (canto) e 03/06 (meio) são o espelho da planta do book; 01/04/05 são ela girada.
    assert.equal(unit.relation.typology, unit.typology + (['02','07','03','06'].includes(unit.final) ? '-espelhado' : ''), unit.id);
  }
  const areas = new Set(catalog.units.filter(u => u.floorIndex === 0).map(u => u.areaM2));
  assert.deepEqual([...areas].sort(), [54.17, 60.11]);
});

test('caixas dos finais não se sobrepõem e ficam dentro da torre', () => {
  const inside = (b, t) => b.min.every((v, i) => v >= t.min[i] - 1e-6) && b.max.every((v, i) => v <= t.max[i] + 1e-6);
  const overlap = (a, b) => a.min.every((v, i) => v < b.max[i] - 1e-6 && b.min[i] < a.max[i] - 1e-6);
  for (const tower of catalog.towers) {
    const units = catalog.units.filter(u => u.tower === tower.id && u.floorIndex === 3);
    assert.equal(units.length, 8);
    for (const u of units) assert.ok(inside(u.bounds, tower.bounds), u.id);
    for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++)
      assert.ok(!overlap(units[i].bounds, units[j].bounds), `${units[i].id} x ${units[j].id}`);
  }
});

test('cadastro adulterado é recusado', () => {
  const broken = structuredClone(catalog);
  broken.units.pop();
  assert.throws(() => validateUnits(broken), /quantidade/);
});

test('o estoque atualiza só a torre correta e preserva as plantas ao ligar ou desligar', () => {
  const id='laranjeiras/torre-02/pavimento-10/final-03';
  const similar='laranjeiras/torre-01/pavimento-10/final-03';
  const settings={model:'parque-das-laranjeiras',bookSHA256:BOOK_SHA,title:'Teste',
    updatedAt:{toDate:()=>new Date('2026-11-05T00:00:00Z')}};
  const snapshot={settings,profiles:[],units:catalog.units.map(({id:technicalId})=>({
    technicalId,commercialNumber:null,availability:technicalId===id?'disponivel':'nao_informada',
    overrides:{priceCents:technicalId===id?25000000:null}
  }))};
  const next=attachStock(catalog,snapshot);
  assert.deepEqual(availableUnitIds(next),[id]);
  assert.equal(next.units.find(u=>u.id===similar).commercial.availability,'nao_informada');
  assert.equal(next.units.find(u=>u.id===id).relation.typology,'meio-espelhado');
  assert.equal(next.units.find(u=>u.id===id).salesDetails.areaM2,40.79);
  const disabled=attachStock(next,null);
  assert.deepEqual(availableUnitIds(disabled),[]);
  assert.equal(disabled.units.find(u=>u.id===id).commercial.priceCents,null);
  assert.deepEqual(disabled.units.map(u=>u.relation),catalog.units.map(u=>u.relation));
  assert.throws(()=>attachStock(catalog,{...snapshot,settings:{...settings,model:'liv-ipanema'}}),/outro empreendimento/);
});

test('a demonstração tem vagas únicas e todas as unidades disponíveis recebem uma vaga', () => {
  const ler=nome=>JSON.parse(readFileSync(new URL(nome,import.meta.url),'utf8'));
  const tabela=ler('comercial.json'), mapa=ler('vagas.json');
  const unidades=attachCommercial(catalog,tabela);
  const ids=new Set(catalog.units.map(u=>u.id)), vinculadas=new Set(mapa.vagas.map(v=>v.unitId));
  assert.equal(unidades.commercialStatus,'simulado');
  assert.equal(tabela.units.length,312);
  assert.equal(availableUnitIds(unidades).length,187);
  assert.equal(mapa.simulated,true);
  assert.equal(mapa.vagas.length,285);
  assert.equal(new Set(mapa.vagas.map(v=>v.numero)).size,285);
  assert.equal(vinculadas.size,285);
  assert([...vinculadas].every(id=>ids.has(id)));
  assert(availableUnitIds(unidades).every(id=>vinculadas.has(id)));
  assert(unidades.units.every(u=>u.commercial.priceCents===null));
});
