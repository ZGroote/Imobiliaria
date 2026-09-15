import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../renderizador-v16-moveis/listings/sheet.js',import.meta.url),'utf8'),ctx);

function sheet(){
  const els={},comodos={hidden:false};
  const $=id=>els[id]||(els[id]={hidden:false,textContent:'',innerHTML:''});
  const s=ctx.ListingSheet.create({$,esc:t=>String(t).replace(/</g,'&lt;'),brl:v=>'R$ '+v,
    cidade:{nome:'Cidade',uf:'SP'},sheet:{querySelector:q=>q==='.comodos'?comodos:null},
    listingModels:{has:id=>String(id)==='7'}});
  return {s,$,comodos};
}

test('sheet lists sale stats, numbers repeated rooms and falls back to polygon area',()=>{
  const {s,$,comodos}=sheet();
  s.preenche({id:'u1',andar:3,ficha:{preco:500,tipo:'venda',bairro:'Centro',quartos:2,vagas:0},
    planta:{pe_direito:2.7,comodos:[{nome:'Banho',area:4},{nome:'Banho',poly:[[0,0],[2,0],[2,3],[0,3]]},{nome:'Sala<',area:20}]}},false);
  assert.equal($('uTag').textContent,'À venda');assert.equal($('uName').textContent,'u1');
  assert.equal($('uAddr').textContent,'Centro · Cidade/SP · 3º andar');
  assert.equal($('uAviso').hidden,false);assert.equal($('uAviso').textContent,'Prédio ainda não confirmado');
  assert.equal($('uStats').innerHTML,'<div>Preço<b>R$ 500</b></div><div>Área medida<b>30 m²</b></div>'+
    '<div>Quartos<b>2</b></div><div>Vagas<b>0</b></div><div>Pé-direito<b>2,7 m</b></div>');
  assert.equal($('uNCom').textContent,'3 · 30 m² de piso');
  assert.equal($('uCom').innerHTML,'<div class="ci"><span>Banho 1</span><b>4 m²</b></div>'+
    '<div class="ci"><span>Banho 2</span><b>6 m²</b></div><div class="ci"><span>Sala&lt;</span><b>20 m²</b></div>');
  assert.equal(comodos.hidden,false);assert.equal($('uEnter').hidden,false);
});

test('rental lot without plan hides rooms and entry',()=>{
  const {s,$,comodos}=sheet();
  s.preenche({id:'l',lote:{},ficha:{empreendimento:'Torre',preco:900,tipo:'aluguel',area_util:50,area_total:50,municipio:'Outra/MG'}},true);
  assert.equal($('uTag').textContent,'Para alugar');assert.equal($('uName').textContent,'Torre');
  assert.equal($('uAddr').textContent,'Outra/MG');assert.equal($('uAviso').hidden,true);
  assert.equal($('uAviso').textContent,'Terreno ainda não confirmado');
  assert.equal($('uStats').innerHTML,'<div>Preço<b>R$ 900/mês</b></div><div>Área útil<b>50 m²</b></div>');
  assert.equal($('uNCom').textContent,'sem planta');assert.equal($('uCom').innerHTML,'');
  assert.equal(comodos.hidden,true);assert.equal($('uEnter').hidden,true);
});

test('ad sheet shows price, placeholders and model availability',()=>{
  const {s,$}=sheet();
  s.preencheAnuncio({id:7,tipo:'aluguel',titulo:'Casa',bairro:'Vila',preco:1200,quartos:0,url:'https://x/7'});
  assert.equal($('hTag').textContent,'Para alugar');assert.equal($('hAddr').textContent,'Vila · São Carlos/SP');
  assert.equal($('hPrice').textContent,'R$ 1200/mês');assert.equal($('hRooms').textContent,0);
  assert.equal($('hGar').textContent,'—');assert.equal($('hLink').href,'https://x/7');
  assert.equal($('hModel').hidden,false);assert.match($('hModelNote').textContent,/^Exterior modelado/);
  s.preencheAnuncio({id:57194,tipo:'venda',titulo:'B',bairro:'C',preco:1,url:''});
  assert.equal($('hTag').textContent,'À venda');assert.equal($('hModel').hidden,true);
  assert.match($('hModelNote').textContent,/indisponível/);
  s.preencheAnuncio({id:8,tipo:'venda',titulo:'B',bairro:'C',preco:1,url:''});
  assert.match($('hModelNote').textContent,/modelagem individual/);
});
