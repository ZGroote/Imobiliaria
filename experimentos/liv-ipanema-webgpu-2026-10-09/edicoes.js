// Paths for a complete exterior edition. Runtime manifests bind actual identities.
export const EXTERIOR_EDITIONS=Object.freeze({
  base:Object.freeze({assets:'assets-prova/',units:'unidades.json',glb:'site-baseline/liv-ipanema.glb'}),
  contorno:Object.freeze({assets:'modelo/variante/assets/',units:'modelo/unidades-contorno.json',glb:'modelo/variante/liv-contorno.glb'}),
  entrada:Object.freeze({assets:'modelo/entrada/candidato/assets/',units:'modelo/entrada/unidades-entrada.json',glb:'modelo/entrada/candidato/liv-contorno.glb'})
});
export function exteriorEdition(key){
  if(!Object.hasOwn(EXTERIOR_EDITIONS,key))throw Error('Perfil de geometria inválido.');
  return EXTERIOR_EDITIONS[key];
}
export function requestedEdition(search){
  const key=new URLSearchParams(search).get('geometria')||'base';
  return Object.hasOwn(EXTERIOR_EDITIONS,key)?key:'base';
}
