// Dimensions are nominal estimates from the reconstructed rooms, between wall
// axes. Labels sit inside registered room outlines, without mirroring; adjacent
// bathrooms use opposite ends of their rooms to avoid covering one another.
// Canto: unidade.json + v1.5/miniaturas/liv-ipanema/interior/referencia.json.
// Meio: interiores/meio/{leitura,referencia}.json. L-shaped rooms use named parts.
const cantoMeasurements=[
  {name:'Suíte',x:.227,y:.413,widthMm:2700,depthMm:3550},
  {name:'Dormitório',x:.4695,y:.367,widthMm:2650,depthMm:2550},
  {name:'Banho suíte',x:.2475,y:.6155,widthMm:1350,depthMm:2400},
  {name:'Banho social',x:.3685,y:.7555,widthMm:1300,depthMm:2400},
  {name:'Jantar · trecho',x:.685,y:.469,widthMm:2100,depthMm:2350},
  {name:'Cozinha · faixa',x:.828,y:.65,widthMm:1050,depthMm:3900},
  {name:'Sala TV · trecho',x:.6045,y:.6465,widthMm:3900,depthMm:1550},
  {name:'Varanda/serviço',x:.733,y:.2935,widthMm:3150,depthMm:1500},
];
const meioMeasurements=[
  {name:'Suíte · quarto',x:.8345,y:.5325,widthMm:2600,depthMm:3250},
  {name:'Dormitório',x:.478,y:.416,widthMm:2650,depthMm:2600},
  {name:'Banho suíte',x:.658,y:.416,widthMm:1400,depthMm:2600},
  {name:'Banho social',x:.6175,y:.6815,widthMm:2300,depthMm:1400},
  {name:'Cozinha/jantar · trecho',x:.2275,y:.5735,widthMm:3000,depthMm:3850},
  {name:'Sala TV · trecho',x:.4375,y:.636,widthMm:1750,depthMm:2400},
  {name:'Varanda/serviço',x:.2275,y:.340,widthMm:3000,depthMm:1450},
];
// Catalog choices describe the published layouts; no final/unit assignment is inferred.
export const typologies=Object.freeze({
  canto:Object.freeze({id:'canto',label:'Canto',area:'47,59 m²',image:'plantas2d/canto.jpg',
    imageAlt:'Planta 1 de canto do LIV Ipanema, área publicada 47,59 m², incluindo varanda',measurements:cantoMeasurements}),
  meio:Object.freeze({id:'meio',label:'Meio',area:'47,5–47,89 m²',image:'plantas2d/meio.jpg',
    imageAlt:'Planta 2 de meio do LIV Ipanema, área publicada de 47,5 a 47,89 m², incluindo varanda',measurements:meioMeasurements}),
});
export function typology(id){
  if(!Object.hasOwn(typologies,id))throw Error('Tipologia inválida.');
  return typologies[id];
}
