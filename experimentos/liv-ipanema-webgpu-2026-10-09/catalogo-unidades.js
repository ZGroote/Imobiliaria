import {loadUnits,validateUnits} from './unidades.js';
export function unitScope(search){return new URLSearchParams(search).get('unidades')==='edificio'?'edificio':'piloto';}
export function floorOf(catalog,unit){return unit?.floorIndex??catalog.floorIndex;}
export function floorLabel(index){
  if(!Number.isInteger(index)||index<0||index>16)throw Error('Pavimento fora do modelo.');
  return index===0?'Térreo':`${index}º pavimento tipo`;
}
// Replication follows the existing model's floor spacing. It is not an official
// apartment numbering rule or an architectural verification of the gardens.
export function expandBuildingCatalog(pilot){
  validateUnits(pilot);
  const units=[];
  for(let floor=0;floor<=16;floor++)for(const seed of pilot.units){
    const unit=structuredClone(seed),shift=(floor-1)*2.85;
    unit.id=`liv-ipanema/pavimento-modelo-${String(floor).padStart(2,'0')}/final-${seed.final}`;
    unit.floorIndex=floor;
    for(const point of [unit.bounds.min,unit.bounds.max,unit.pickPoint].filter(Boolean))point[1]=Math.round((point[1]+shift)*1e6)/1e6;
    unit.garden=floor===0?{areaM2:null,bounds:null,confidence:'pendente'}:null;
    units.push(unit);
  }
  return {...structuredClone(pilot),schema:'liv-building-units-v1',floorIndex:null,pilotFloorIndex:1,units,
    reconciliation:{publishedUnits:170,modelLevels:17,finalsPerLevel:10,technicalPositions:units.length,
      publishedParkingSpaces:175,assignedParkingSpaces:0,commercialNumbersVerified:0,
      source:{...pilot.source,page:16},
      limitations:['Posições repetidas com o espaçamento do modelo, sem cotas executivas.',
        'Numeração comercial, tipologia e espelhamento por final não confirmados.',
        'Gardens do térreo existem na fonte; limites e áreas por final continuam pendentes.']}};
}
export async function loadUnitCatalog(signal,geometry,scope='piloto'){
  if(!['piloto','edificio'].includes(scope))throw Error('Escopo do cadastro inválido.');
  const pilot=await loadUnits(signal,geometry);
  return scope==='edificio'?expandBuildingCatalog(pilot):pilot;
}
export function unitsAtFloor(catalog,floor){return catalog.units.filter(unit=>floorOf(catalog,unit)===floor);}
