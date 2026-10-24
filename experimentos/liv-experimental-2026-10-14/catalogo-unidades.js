import dados from './dados/maquete.js';
import {loadUnits,validateUnits} from './unidades.js';
const P=dados.predio,lastFloor=P.pavimentos-1;
export function unitScope(search){return new URLSearchParams(search).get('unidades')==='edificio'?'edificio':'piloto';}
export function floorOf(catalog,unit){return unit?.floorIndex??catalog.floorIndex;}
export function floorLabel(index){
  if(!Number.isInteger(index)||index<0||index>lastFloor)throw Error('Pavimento fora do modelo.');
  return index===0?'Térreo':`${index}º pavimento tipo`;
}
// Replication follows the existing model's floor spacing. It is not an official
// apartment numbering rule or an architectural verification of the gardens.
export function expandBuildingCatalog(pilot){
  validateUnits(pilot);
  const units=[];
  for(let floor=0;floor<=lastFloor;floor++)for(const seed of pilot.units){
    const unit=structuredClone(seed),shift=(floor-P.pavimentoPiloto)*P.alturaPavimentoM;
    unit.id=P.idUnidade.replace('{pavimento}',String(floor).padStart(2,'0')).replace('{final}',seed.final);
    unit.floorIndex=floor;
    for(const point of [unit.bounds.min,unit.bounds.max,unit.pickPoint].filter(Boolean))point[1]=Math.round((point[1]+shift)*1e6)/1e6;
    unit.garden=P.gardenNoTerreo&&floor===0?{areaM2:null,bounds:null,confidence:'pendente'}:null;
    units.push(unit);
  }
  const C=P.reconciliacao;
  return {...structuredClone(pilot),schema:'liv-building-units-v1',floorIndex:null,pilotFloorIndex:P.pavimentoPiloto,units,
    reconciliation:{publishedUnits:C.publishedUnits,modelLevels:P.pavimentos,finalsPerLevel:dados.unidades.quantidade,technicalPositions:units.length,
      publishedParkingSpaces:C.publishedParkingSpaces,assignedParkingSpaces:0,commercialNumbersVerified:0,
      source:{...pilot.source,page:C.paginaDaFonte},
      limitations:[...C.limitations]}};
}
export async function loadUnitCatalog(signal,geometry,scope='piloto'){
  if(!['piloto','edificio'].includes(scope))throw Error('Escopo do cadastro inválido.');
  const pilot=await loadUnits(signal,geometry);
  return scope==='edificio'?expandBuildingCatalog(pilot):pilot;
}
export function unitsAtFloor(catalog,floor){return catalog.units.filter(unit=>floorOf(catalog,unit)===floor);}
