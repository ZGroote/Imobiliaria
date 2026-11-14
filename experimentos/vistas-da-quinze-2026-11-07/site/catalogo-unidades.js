import {loadUnits} from './unidades.js';
export function unitScope(search){return new URLSearchParams(search).get('unidades')==='edificio'?'edificio':'piloto';}
export function floorOf(catalog,unit){return unit?.floorIndex??catalog.floorIndex;}
export function floorLabel(index){
  if(!Number.isInteger(index)||index<0||index>20)throw Error('Pavimento fora do modelo.');
  return index<3?'Garagem':`${index}º andar`;   // 0..2 = embasamento
}
// O cadastro já vem com o prédio inteiro (2 alas, 3º ao 20º andar).
export async function loadUnitCatalog(signal,geometry){return loadUnits(signal,geometry);}
export function unitsAtFloor(catalog,floor){return catalog.units.filter(unit=>floorOf(catalog,unit)===floor);}
