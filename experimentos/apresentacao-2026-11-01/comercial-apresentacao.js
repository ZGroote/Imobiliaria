import {attachCommercial as attachBaseCommercial} from './comercial.js';

// This demo has175 physical spaces; a count such as "1 vaga" is never an assignment.
export function attachPresentationCommercial(catalog,input){
  const next=attachBaseCommercial(catalog,input);
  return {...next,units:next.units.map(unit=>{
    const match=/^Vaga ([1-9]\d*)$/.exec(unit.commercial?.parking??'');
    const number=match?Number(match[1]):null;
    const parkingSpaces=Number.isSafeInteger(number)&&number<=175?[number]:[];
    return {...unit,parkingSpaces};
  })};
}
