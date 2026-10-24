import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buyerExperienceEnabled,apartmentContact,createBuyerUI} from './experiencia-compra.js';

test('experiência pode ser desligada por endereço sem mexer no estoque',()=>{
  assert.equal(buyerExperienceEnabled(''),true);
  assert.equal(buyerExperienceEnabled('?experiencia=original'),false);
  assert.equal(buyerExperienceEnabled('?experiencia=nova'),true);
});
test('HTML de build anterior continua utilizável com o bundle compartilhado atualizado',()=>{
  const ui=createBuyerUI({document:{getElementById:()=>null},location:{search:''},navigator:{}});
  assert.equal(ui.enabled,false);ui.update(null);ui.setContact({});
});
test('mensagem conserva token público e apartamento, descartando recibos e dados privados',()=>{
  const unit={id:'liv-ipanema/pavimento-modelo-14/final-06',final:'06',commercial:{commercialNumber:'1406'},salesDetails:{areaM2:47.89}};
  const result=apartmentContact(unit,14,{contact:{brokerName:'Equipe',whatsappNumber:'5581999990000'},shareUrl:'https://conectaimoveis3d.com.br/acesso.html?l=token-publico&receipt=privado&visitId=segredo&experiencia=original#stage'});
  assert.match(result.message,/apartamento 1406/);assert.doesNotMatch(result.message.split('\n').slice(0,-1).join('\n'),/andar|pavimento|Térreo/);assert.match(result.message,/47,89 m²/);
  const address=new URL(result.message.split('\n').at(-1));
  assert.equal(address.searchParams.get('l'),'token-publico');assert.equal(address.searchParams.get('unidade'),unit.id);
  assert.equal(address.searchParams.get('experiencia'),'original');assert.equal(address.searchParams.get('modo'),'planta2d');
  assert.equal(address.searchParams.has('receipt'),false);assert.equal(address.searchParams.has('visitId'),false);
  assert.equal(new URL(result.href).searchParams.get('text'),result.message);
  assert.equal(apartmentContact(unit,14,{shareUrl:address.href}).href,null);
  assert.throws(()=>apartmentContact(unit,14,{shareUrl:'javascript:alert(1)'}));
});
