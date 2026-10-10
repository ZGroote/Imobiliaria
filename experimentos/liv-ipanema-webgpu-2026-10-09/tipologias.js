// Catalog choices describe the published layouts; no final/unit assignment is inferred.
export const typologies=Object.freeze({
  canto:Object.freeze({id:'canto',label:'Canto',area:'47,59 m²',image:'plantas2d/canto.jpg',
    imageAlt:'Planta 1 de canto do LIV Ipanema, área publicada 47,59 m², incluindo varanda'}),
  meio:Object.freeze({id:'meio',label:'Meio',area:'47,5–47,89 m²',image:'plantas2d/meio.jpg',
    imageAlt:'Planta 2 de meio do LIV Ipanema, área publicada de 47,5 a 47,89 m², incluindo varanda'}),
});
export function typology(id){
  if(!Object.hasOwn(typologies,id))throw Error('Tipologia inválida.');
  return typologies[id];
}
