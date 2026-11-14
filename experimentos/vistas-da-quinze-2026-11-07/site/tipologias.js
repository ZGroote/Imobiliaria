// Vistas da Quinze: medidas, régua e entrada vêm de plantas2d/dados.js, gerado por
// interiores/gerar_plantas2d.py a partir dos mesmos planta.json do construtor (plantas humanizadas, sem cotas).
import {PLANTAS2D} from './plantas2d/dados.js';

const tipo=(id,label,area,descricao)=>Object.freeze({id,label,area,image:`plantas2d/${id}.jpg`,
  imageMask:`plantas2d/${id}-recorte.svg`,entryMarker:PLANTAS2D[id].entryMarker,
  imageAlt:`Planta ${label} do Vistas da Quinze, ${area}, ${descricao}`,
  measurements:PLANTAS2D[id].measurements,ruler:PLANTAS2D[id].ruler});
export const typologies=Object.freeze({
  t01:tipo('t01','T01 · 2 dormitórios','44,79 m²','2 dormitórios (1 suíte), 2 banheiros, sala e cozinha integradas'),
  t02:tipo('t02','T02 · 1 dormitório','31,5 m²','1 dormitório, banheiro, sala e cozinha integradas'),
  t03:tipo('t03','T03 · 2 dormitórios com terraço','62,3 m²','suíte com closet, 2 banheiros e terraço com spa'),
  t04:tipo('t04','T04 · 2 dormitórios e escritório com terraço','77,6 m²','suíte, escritório, 2 banheiros e terraço com spa'),
  t05:tipo('t05','T05 · 2 dormitórios com terraço','62,4 m²','suíte com closet, 2 banheiros e terraço com spa'),
  t06:tipo('t06','T06 · 2 dormitórios com terraço frontal','71,1 m²','2 dormitórios (1 suíte) e terraço com spa na frente'),
});
export function typology(id){
  const value=typologies[id];
  if(!value)throw Error('Tipologia inválida.');
  return value;
}
