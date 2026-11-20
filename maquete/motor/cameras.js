import dados from './dados/maquete.js';

// A detail view of the property (dados.vistasExtras): an orbit around a target, framed by its bounds.
export function orbitView(v) {
  const target=[...v.alvo],{r,th,ph}=v;
  return {type:'PerspectiveCamera',fov:v.fov,near:.2,far:900,zoom:1,aspect:1.8461538461538463,
    position:[target[0]+r*Math.sin(th)*Math.sin(ph),target[1]+r*Math.cos(ph),target[2]+r*Math.cos(th)*Math.sin(ph)],
    target,orbit:{r,th,ph}};
}

function sideSign(side,message){
  if(!Object.hasOwn(dados.lados,side))throw Error(message);
  return dados.lados[side].sinal;
}

// Frame the pilot facade across the viewport, keeping the ground near the bottom.
export function pilotFloorView(aspect,side){
  if(!Number.isFinite(aspect)||aspect<=0)throw Error('Vista do pavimento inválida.');
  const sign=sideSign(side,'Vista do pavimento inválida.'),v=dados.vistaDoPavimento;
  const fov=34,halfHeight=v.meiaLargura/aspect,targetY=Math.max(v.alturaMinima,halfHeight-2);
  const distance=halfHeight/Math.tan(fov*Math.PI/360)+v.profundidade;
  return {type:'PerspectiveCamera',fov,near:.2,far:900,aspect,zoom:1,
    position:[0,targetY,sign*distance],target:[0,targetY,0]};
}

// The building mirror keeps every model floor visible on the chosen facade.
export function buildingFacadeView(aspect,side,bounds=null){
  if(!Number.isFinite(aspect)||aspect<=0)throw Error('Vista da fachada inválida.');
  const sign=sideSign(side,'Vista da fachada inválida.'),v=dados.vistaDaFachada;
  let target=[0,v.altura/2,0],halfHeight=Math.max(v.meiaAlturaMinima,v.meiaLargura/aspect),depth=v.profundidade;
  if(bounds){
    const {min,max}=bounds;
    if(![min,max].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))||max.some((n,i)=>n<=min[i]))throw Error('Limites da torre inválidos.');
    target=min.map((n,i)=>(n+max[i])/2);
    halfHeight=Math.max((max[1]-min[1])/2+1.5,((max[0]-min[0])/2+1.5)/aspect);depth=(max[2]-min[2])/2;
  }
  const fov=34,distance=halfHeight/Math.tan(fov*Math.PI/360)+depth;
  return {type:'PerspectiveCamera',fov,near:.2,far:900,aspect,zoom:1,
    position:[target[0],target[1],target[2]+sign*distance],target};
}
