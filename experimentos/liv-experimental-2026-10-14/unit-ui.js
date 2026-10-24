import {unitById} from './unidades.js';
import {floorOf} from './catalogo-unidades.js';
import {saleOf,saleLabel} from './comercial.js';
import {typology as layout} from './tipologias.js';
export function createUnitUI(catalog){
  return {setCatalog(data){catalog=data;},update({selectedUnitId,ready,mode,relationError,stockError,unitScope}){
    const unit=unitById(catalog,selectedUnitId);
    const title=unit?(unit.commercial?.commercialNumber?`Apartamento ${unit.commercial.commercialNumber}`:`Final ${unit.final}`):'';
    document.getElementById('unitAnnouncement').textContent=unit?`${title} selecionado, posição aproximada, ${saleLabel(unit)}.`:'Nenhum apartamento selecionado.';
    const panel=document.getElementById('selectedApartment'),prompt=document.getElementById('selectionPrompt');
    if(panel)panel.hidden=!unit;if(prompt)prompt.hidden=Boolean(unit);
    const info=document.getElementById('btnApartmentInfo');if(info){info.hidden=!unit;info.disabled=!unit;}
    const relation=unit?.relation,associated=Boolean(relation&&['canto','meio'].includes(relation.typology)&&relation.orientation==='original');
    for(const button of document.querySelectorAll('[data-unit-open]')){button.hidden=!associated;button.disabled=!ready||!associated;}
    const actions=document.getElementById('selectedApartmentActions');if(actions)actions.hidden=!associated||mode!=='maquete';
    if(!unit)return;
    document.getElementById('detailsTitle').textContent=title;
    const sale=saleOf(unit),informed=sale.availability!=='nao_informada'||sale.priceCents!==null;
    const details=unit.salesDetails;
    const area=details?.areaM2!==null&&details?.areaM2!==undefined?`${new Intl.NumberFormat('pt-BR').format(details.areaM2)} m²`:null;
    const count=(n,one,many)=>n===null||n===undefined?null:`${n} ${n===1?one:many}`;
    const rooms=details?[count(details.bedrooms,'quarto','quartos'),count(details.bathrooms,'banheiro','banheiros')].filter(Boolean).join(' · '):'';
    document.getElementById('unitArea').textContent=area??'A confirmar';
    document.getElementById('unitRooms').textContent=rooms||'Não informados';
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
    document.getElementById('unitLayout').textContent=associated?layout(relation.typology).label:'Em conferência';
    document.getElementById('relationSource').hidden=!associated;
    document.getElementById('relationSource').textContent=associated&&catalog.relationSource?`Associação informada por ${catalog.relationSource.label} · ${catalog.relationSource.asOf}`:'';
    const pending=unitScope==='edificio'&&!catalog.relationStatus&&!relationError&&!stockError;
    const note=associated?`Planta ${layout(relation.typology).label} associada pelo cadastro fornecido. O 3D/Tour é ilustrativo, com medidas inferidas.`:
      pending?'Conferindo a planta deste apartamento…':'A planta deste apartamento está em conferência. Consulte a equipe para confirmar.';
    document.getElementById('unitReferenceNote').textContent=note;
    const panelTitle=document.getElementById('selectedApartmentTitle');if(panelTitle)panelTitle.textContent=title;
    // Buyer card: price and size first; provenance stays in the full sheet.
    const meta=document.getElementById('selectedApartmentMeta');
    if(meta)meta.textContent=[area,rooms,sale.parking].filter(Boolean).join(' · ');
    const panelSale=document.getElementById('selectedApartmentSale');if(panelSale)panelSale.textContent=informed?saleLabel(unit):'Disponibilidade e preço a confirmar';
    const side=unit.side==='lazer'?'lado do lazer':'lado do estacionamento';
    const panelNote=document.getElementById('selectedApartmentNote');if(panelNote)panelNote.textContent=associated?`Planta ${layout(relation.typology).label} · ${side}`:note;
  }};
}
