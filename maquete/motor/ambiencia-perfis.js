export const AMBIENCES=Object.freeze({
  dia:Object.freeze({label:'Dia',exposure:1,color:[1,1,1],reflection:1,lightColor:[1,1,1],lightIntensity:1}),
  entardecer:Object.freeze({label:'Entardecer ilustrativo',exposure:.82,color:[1,.90,.79],reflection:.78,lightColor:[1,.82,.66],lightIntensity:.85})
});
export function requestedAmbience(search){
  const key=new URLSearchParams(search).get('luz');
  return Object.hasOwn(AMBIENCES,key)?key:'dia';
}
