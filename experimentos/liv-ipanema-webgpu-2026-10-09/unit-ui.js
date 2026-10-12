import {unitById} from './unidades.js';
import {floorOf,floorLabel,unitsAtFloor} from './catalogo-unidades.js';
import {saleOf,saleLabel} from './comercial.js';
import {typology as layout} from './tipologias.js';
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
    document.getElementById('unitAnnouncement').textContent=unit?`Final ${unit.final} selecionado, posição aproximada, ${saleLabel(unit)}.`:'Nenhum final selecionado.';
    if(!unit)return;
    const label=floorLabel(floorOf(catalog,unit));
    document.getElementById('unitTitle').textContent=unit.commercial?.commercialNumber?`Apartamento ${unit.commercial.commercialNumber} · ${label}`:`Final ${unit.final} · ${label}`;
    document.getElementById('selectedUnitLabel').textContent=`Final ${unit.final} · ${label} · posição aproximada`;
    const sale=saleOf(unit),informed=sale.availability!=='nao_informada'||sale.priceCents!==null;
    const details=unit.salesDetails;
    document.getElementById('unitArea').textContent=details?.areaM2!==null&&details?.areaM2!==undefined?`${new Intl.NumberFormat('pt-BR').format(details.areaM2)} m²`:'A confirmar';
    document.getElementById('unitRooms').textContent=details?`${details.bedrooms??'—'} quartos · ${details.bathrooms??'—'} banheiros`:'Não informados';
    document.getElementById('unitDescription').hidden=!details?.description;
    document.getElementById('unitDescription').textContent=details?.description||'';
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
    const relation=unit.relation;
    document.getElementById('unitLayout').textContent=relation?`${layout(relation.typology).label} · orientação original`:'Em conferência';
    document.getElementById('openUnitPlant').hidden=!relation;document.getElementById('openUnitPlant').disabled=!ready;
    document.getElementById('relationSource').hidden=!relation;
    document.getElementById('relationSource').textContent=relation?`Associação informada por ${catalog.relationSource.label} · ${catalog.relationSource.asOf}`:'';
    document.getElementById('unitReferenceNote').textContent=mode==='maquete'?
      'As plantas Canto e Meio são referências gerais. A planta e o espelhamento deste final estão em conferência.':
      `Você está vendo a referência de ${typology}. A associação com o final ${unit.final} está em conferência.`;
    if(relation)document.getElementById('unitReferenceNote').textContent=`Planta ${layout(relation.typology).label} associada pelo cadastro fornecido. `+
      (mode!=='maquete'&&typology!==layout(relation.typology).label.toLowerCase()?`Você está vendo a referência geral de ${typology}.`:'O 3D/Tour é ilustrativo, com medidas inferidas.');
  }};
}
