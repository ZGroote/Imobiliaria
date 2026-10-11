import {unitById} from './unidades.js';
import {floorOf,floorLabel,unitsAtFloor} from './catalogo-unidades.js';
import {saleOf,saleLabel} from './comercial.js';
export function createUnitUI(catalog,{onSelect,onClear,onSide}){
  const list=document.getElementById('unitList');let buttons=[],displayFloor=null;
  function renderFloor(floor){
    if(floor===displayFloor)return;displayFloor=floor;list.replaceChildren();buttons=[];
    for(const unit of unitsAtFloor(catalog,floor)){
    const button=document.createElement('button');button.type='button';button.dataset.unitId=unit.id;
    button.textContent=unit.final;
    button.setAttribute('aria-label',`Final ${unit.final}, lado do ${unit.side}, posição aproximada`);
    button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>onSelect(unit.id));
    list.append(button);buttons.push(button);
    }
  }
  document.getElementById('clearUnit').addEventListener('click',onClear);
  for(const button of document.querySelectorAll('[data-unit-side]'))button.addEventListener('click',()=>onSide(button.dataset.unitSide));
  return {setCatalog(data){catalog=data;},update({selectedUnitId,ready,mode,floor,typology}){
    const unit=unitById(catalog,selectedUnitId);
    const building=catalog.schema==='liv-building-units-v1';
    renderFloor(building?(floor>=0?floor:displayFloor??1):catalog.floorIndex);
    for(const button of buttons){
      button.disabled=!ready||mode!=='maquete';button.setAttribute('aria-pressed',String(button.dataset.unitId===selectedUnitId));
      button.dataset.availability=saleOf(unitById(catalog,button.dataset.unitId)).availability;
    }
    for(const button of document.querySelectorAll('[data-unit-side]'))button.disabled=!ready||mode!=='maquete';
    document.getElementById('unitHelp').textContent=mode!=='maquete'?'Volte à maquete para explorar os finais.':
      (building&&floor>=0)||floor===catalog.floorIndex?'Toque no pavimento destacado ou escolha um final.':
        `Escolha um final para explorar o ${building?floorLabel(displayFloor).toLowerCase():'1º pavimento tipo'}.`;
    document.getElementById('unitFloorNote').textContent=`${floorLabel(displayFloor)} · posições aproximadas`;
    document.getElementById('unitCard').hidden=!unit;
    document.getElementById('selectedUnitLabel').hidden=!unit||mode!=='maquete';
    document.getElementById('clearUnit').disabled=!unit;
    document.getElementById('unitAnnouncement').textContent=unit?`Final ${unit.final} selecionado, posição aproximada, disponibilidade não informada.`:'Nenhum final selecionado.';
    if(!unit)return;
    const label=floorLabel(floorOf(catalog,unit));
    document.getElementById('unitTitle').textContent=`Final ${unit.final} · ${label}`;
    document.getElementById('selectedUnitLabel').textContent=`Final ${unit.final} · ${label} · posição aproximada`;
    const sale=saleOf(unit),informed=sale.availability!=='nao_informada'||sale.priceCents!==null;
    document.getElementById('unitSale').textContent=informed?saleLabel(unit):'Não informados';
    document.getElementById('unitCommercial').textContent=sale.commercialNumber!==null||sale.parking!==null?
      `${sale.commercialNumber??'Número não informado'} · ${sale.parking??'vaga não informada'}`:'Não informados';
    if(informed)document.getElementById('selectedUnitLabel').textContent+=` · ${saleLabel(unit)}`;
    document.getElementById('commercialSource').hidden=!catalog.commercialSource;
    document.getElementById('commercialSource').textContent=catalog.commercialSource?
      `Fonte: ${catalog.commercialSource.label} · ${catalog.commercialSource.asOf}`:'';
    document.getElementById('commercialConditions').hidden=!sale.conditions;
    document.getElementById('commercialConditions').textContent=sale.conditions||'';
    document.getElementById('gardenNote').hidden=floorOf(catalog,unit)!==0;
    document.getElementById('unitPosition').textContent=unit.side==='lazer'?'Lado do lazer':'Lado do estacionamento';
    document.getElementById('unitReferenceNote').textContent=mode==='maquete'?
      'As plantas Canto e Meio são referências gerais. A planta e o espelhamento deste final estão em conferência.':
      `Você está vendo a referência de ${typology}. A associação com o final ${unit.final} está em conferência.`;
  }};
}
