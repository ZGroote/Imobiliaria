import {unitById} from './unidades.js';
export function createUnitUI(catalog,{onSelect,onClear,onSide}){
  const list=document.getElementById('unitList'),buttons=[];
  for(const unit of catalog.units){
    const button=document.createElement('button');button.type='button';button.dataset.unitId=unit.id;
    button.textContent=unit.final;
    button.setAttribute('aria-label',`Final ${unit.final}, lado do ${unit.side}, posição aproximada`);
    button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>onSelect(unit.id));
    list.append(button);buttons.push(button);
  }
  document.getElementById('clearUnit').addEventListener('click',onClear);
  for(const button of document.querySelectorAll('[data-unit-side]'))button.addEventListener('click',()=>onSide(button.dataset.unitSide));
  return {setCatalog(data){catalog=data;},update({selectedUnitId,ready,mode,floor,typology}){
    const unit=unitById(catalog,selectedUnitId);
    for(const button of buttons){
      button.disabled=!ready||mode!=='maquete';button.setAttribute('aria-pressed',String(button.dataset.unitId===selectedUnitId));
    }
    for(const button of document.querySelectorAll('[data-unit-side]'))button.disabled=!ready||mode!=='maquete';
    document.getElementById('unitHelp').textContent=mode!=='maquete'?'Volte à maquete para explorar os finais.':
      floor===catalog.floorIndex?'Toque no pavimento destacado ou escolha um final.':'Escolha um final para explorar o 1º pavimento tipo.';
    document.getElementById('unitCard').hidden=!unit;
    document.getElementById('selectedUnitLabel').hidden=!unit||mode!=='maquete';
    document.getElementById('clearUnit').disabled=!unit;
    document.getElementById('unitAnnouncement').textContent=unit?`Final ${unit.final} selecionado, posição aproximada, disponibilidade não informada.`:'Nenhum final selecionado.';
    if(!unit)return;
    document.getElementById('unitTitle').textContent=`Final ${unit.final} · 1º pavimento tipo`;
    document.getElementById('selectedUnitLabel').textContent=`Final ${unit.final} · 1º pavimento tipo · posição aproximada`;
    document.getElementById('unitPosition').textContent=unit.side==='lazer'?'Lado do lazer':'Lado do estacionamento';
    document.getElementById('unitReferenceNote').textContent=mode==='maquete'?
      'As plantas Canto e Meio são referências gerais. A planta e o espelhamento deste final estão em conferência.':
      `Você está vendo a referência de ${typology}. A associação com o final ${unit.final} está em conferência.`;
  }};
}
