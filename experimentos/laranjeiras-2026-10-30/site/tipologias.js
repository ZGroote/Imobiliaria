// Parque das Laranjeiras: medidas, régua e entrada vêm de plantas2d/dados.js, gerado por
// interiores/gerar_plantas2d.py a partir dos mesmos planta.json do construtor (entre eixos, sem cotas).
import {PLANTAS2D} from './plantas2d/dados.js';

export const typologies=({
  canto:Object.freeze({id:'canto',label:'Canto',area:'39,12 m²',image:'plantas2d/canto.jpg',
    imageMask:'plantas2d/canto-recorte.svg',entryMarker:PLANTAS2D.canto.entryMarker,
    imageAlt:'Planta tipo canto do Parque das Laranjeiras, 39,12 m², 2 quartos com varanda gourmet',
    measurements:PLANTAS2D.canto.measurements,ruler:PLANTAS2D.canto.ruler}),
  meio:Object.freeze({id:'meio',label:'Meio',area:'até 40,79 m²',image:'plantas2d/meio.jpg',
    imageMask:'plantas2d/meio-recorte.svg',entryMarker:PLANTAS2D.meio.entryMarker,
    imageAlt:'Planta tipo meio do Parque das Laranjeiras, até 40,79 m², 2 quartos com varanda gourmet',
    measurements:PLANTAS2D.meio.measurements,ruler:PLANTAS2D.meio.ruler}),
});
// Finais 02/07 (canto) e 03/06 (meio): Planta 3D e Tour espelhados; a 2D segue a do book (texto não espelha).
for(const id of ['canto','meio'])typologies[`${id}-espelhado`]=Object.freeze({...typologies[id],id:`${id}-espelhado`,
  label:`${typologies[id].label} espelhada`,mirrored:true});
Object.freeze(typologies);
export function typology(id){
  if(!Object.hasOwn(typologies,id))throw Error('Tipologia inválida.');
  return typologies[id];
}
