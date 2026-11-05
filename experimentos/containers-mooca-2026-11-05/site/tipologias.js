// Containers da Mooca: medidas, régua e entrada vêm de plantas2d/dados.js, gerado por
// interiores/gerar_plantas2d.py a partir dos mesmos planta.json do construtor (container 1:50, sem cotas).
import {PLANTAS2D} from './plantas2d/dados.js';

const tipo=(id,label,area,container,descricao)=>Object.freeze({id,label,area,image:`plantas2d/${id}.jpg`,
  imageMask:`plantas2d/${id}-recorte.svg`,entryMarker:PLANTAS2D[id].entryMarker,
  imageAlt:`Planta do dormitório ${label.toLowerCase()} (container ${container}), ${area}, ${descricao}`,
  measurements:PLANTAS2D[id].measurements,ruler:PLANTAS2D[id].ruler});
export const typologies=Object.freeze({
  individual:tipo('individual','Individual','14,8 m²','6 m','cama, escrivaninha, copa e banheiro'),
  'individual-pne':tipo('individual-pne','Individual PNE','14,8 m²','6 m','cama, escrivaninha e banheiro acessível'),
  casal:tipo('casal','Casal','14,8 m²','6 m','cama de casal, copa, escrivaninha e banheiro'),
  quadruplo:tipo('quadruplo','Quádruplo','29,7 m²','12 m','dois beliches, bancada de estudo para 4, copa e banheiro'),
  'casal-bebe':tipo('casal-bebe','Casal com bebê','29,7 m²','12 m','cama de casal, berço, estudo, copa e banheiro'),
});
export function typology(id){
  if(!Object.hasOwn(typologies,id))throw Error('Tipologia inválida.');
  return typologies[id];
}
