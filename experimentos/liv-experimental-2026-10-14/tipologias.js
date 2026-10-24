import dados from './dados/maquete.js';
// The property's typologies (labels, published areas, 2D plan and estimated room measurements) live in
// its data; this module only looks them up.
export const typologies=Object.freeze(Object.fromEntries(Object.entries(dados.tipologias).map(([key,t])=>
  [key,Object.freeze({id:t.id,label:t.label,area:t.area,image:t.image,imageMask:t.imageMask,entryMarker:t.entryMarker,imageAlt:t.imageAlt,measurements:t.measurements})])));
export const typologyIds=Object.freeze(Object.keys(typologies));
export function typology(id){
  if(!Object.hasOwn(typologies,id))throw Error('Tipologia inválida.');
  return typologies[id];
}
