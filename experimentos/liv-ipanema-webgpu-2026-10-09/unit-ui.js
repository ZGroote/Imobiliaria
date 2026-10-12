import {unitById} from './unidades.js';
import {floorOf,floorLabel} from './catalogo-unidades.js';
import {saleOf,saleLabel} from './comercial.js';
import {typology as layout} from './tipologias.js';
export function createUnitUI(catalog){
  return {setCatalog(data){catalog=data;},update({selectedUnitId,ready,mode,typology}){
    const unit=unitById(catalog,selectedUnitId);
    document.getElementById('unitAnnouncement').textContent=unit?`Final ${unit.final} selecionado, posição aproximada, ${saleLabel(unit)}.`:'Nenhum final selecionado.';
    if(!unit)return;
    const label=floorLabel(floorOf(catalog,unit));
    document.getElementById('detailsTitle').textContent=unit.commercial?.commercialNumber?`Apartamento ${unit.commercial.commercialNumber} · ${label}`:`Final ${unit.final} · ${label}`;
    const sale=saleOf(unit),informed=sale.availability!=='nao_informada'||sale.priceCents!==null;
    const details=unit.salesDetails;
    document.getElementById('unitArea').textContent=details?.areaM2!==null&&details?.areaM2!==undefined?`${new Intl.NumberFormat('pt-BR').format(details.areaM2)} m²`:'A confirmar';
    document.getElementById('unitRooms').textContent=details?`${details.bedrooms??'—'} quartos · ${details.bathrooms??'—'} banheiros`:'Não informados';
    document.getElementById('unitDescription').hidden=!details?.description;
    document.getElementById('unitDescription').textContent=details?.description||'';
    document.getElementById('unitSale').textContent=informed?saleLabel(unit):'Não informados';
    document.getElementById('unitCommercial').textContent=sale.commercialNumber!==null||sale.parking!==null?
      `${sale.commercialNumber??'Número não informado'} · ${sale.parking??'vaga não informada'}`:'Não informados';
    document.getElementById('commercialSource').hidden=!catalog.commercialSource;
    document.getElementById('commercialSource').textContent=catalog.commercialSource?
      `Fonte: ${catalog.commercialSource.label} · ${catalog.commercialSource.asOf}`:'';
    document.getElementById('commercialConditions').hidden=!sale.conditions;
    document.getElementById('commercialConditions').textContent=sale.conditions||'';
    document.getElementById('gardenNote').hidden=floorOf(catalog,unit)!==0;
    document.getElementById('unitPosition').textContent=unit.side==='lazer'?'Lado do lazer':'Lado do estacionamento';
    const relation=unit.relation;
    document.getElementById('unitLayout').textContent=relation?`${layout(relation.typology).label} · orientação original`:'Em conferência';
    for(const button of document.querySelectorAll('#unitDetails [data-unit-open]')){button.hidden=!relation;button.disabled=!ready;}
    document.getElementById('relationSource').hidden=!relation;
    document.getElementById('relationSource').textContent=relation?`Associação informada por ${catalog.relationSource.label} · ${catalog.relationSource.asOf}`:'';
    document.getElementById('unitReferenceNote').textContent=mode==='maquete'?
      'As plantas Canto e Meio são referências gerais. A planta e o espelhamento deste final estão em conferência.':
      `Você está vendo a referência de ${typology}. A associação com o final ${unit.final} está em conferência.`;
    if(relation)document.getElementById('unitReferenceNote').textContent=`Planta ${layout(relation.typology).label} associada pelo cadastro fornecido. `+
      (mode!=='maquete'&&typology!==layout(relation.typology).label.toLowerCase()?`Você está vendo a referência geral de ${typology}.`:'O 3D/Tour é ilustrativo, com medidas inferidas.');
  }};
}
