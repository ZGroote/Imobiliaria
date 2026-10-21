import dados from './dados/maquete.js';
// Paths for a complete exterior edition, from the property data. Runtime manifests bind actual identities.
export const EXTERIOR_EDITIONS=Object.freeze(Object.fromEntries(Object.entries(dados.edicoes).map(([key,e])=>
  [key,Object.freeze({assets:e.assets,units:e.units,glb:e.glb})])));
export function exteriorEdition(key){
  if(!Object.hasOwn(EXTERIOR_EDITIONS,key))throw Error('Perfil de geometria inválido.');
  return EXTERIOR_EDITIONS[key];
}
export function requestedEdition(search){
  const key=new URLSearchParams(search).get('geometria')||dados.edicaoPadrao;
  return Object.hasOwn(EXTERIOR_EDITIONS,key)?key:dados.edicaoPadrao;
}
