import {loadUnits} from './unidades.js';
export function unitScope(search){return new URLSearchParams(search).get('unidades')==='edificio'?'edificio':'piloto';}
export function floorOf(catalog,unit){return unit?.floorIndex??catalog.floorIndex;}
export function floorLabel(index){
  if(!Number.isInteger(index)||index<0||index>12)throw Error('Pavimento fora do modelo.');
  return index===0?'Térreo':`${index}º pavimento`;
}
// O cadastro do Laranjeiras já vem com o prédio inteiro (3 torres x 13 pavimentos).
export async function loadUnitCatalog(signal,geometry){return loadUnits(signal,geometry);}
export function unitsAtFloor(catalog,floor){return catalog.units.filter(unit=>floorOf(catalog,unit)===floor);}
