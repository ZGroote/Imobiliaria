// Paths for a complete exterior edition. Runtime manifests bind actual identities.
export const EXTERIOR_EDITIONS=Object.freeze({
  base:Object.freeze({assets:'../assets/',units:'../assets/unidades.json',glb:'../modelo/laranjeiras.glb'}),
});
export function exteriorEdition(key){
  if(!Object.hasOwn(EXTERIOR_EDITIONS,key))throw Error('Perfil de geometria inválido.');
  return EXTERIOR_EDITIONS[key];
}
export function requestedEdition(search){
  const key=new URLSearchParams(search).get('geometria')||'base';
  return Object.hasOwn(EXTERIOR_EDITIONS,key)?key:'base';
}
