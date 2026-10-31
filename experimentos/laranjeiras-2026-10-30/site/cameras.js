// Detail view of the two balcony stacks at the gate end of the published face.
// Coordinates use the source-locked model; no commercial unit is assigned.
export const BALCONY_DETAIL_BOUNDS={min:[-21,20.0,4.2],max:[-11.5,29.0,6.9]};

export function balconyDetailView() {
  const target=[-16.25,24.5,5.55],r=24,th=.08,ph=1.53;
  return {type:'PerspectiveCamera',fov:34,near:.2,far:900,zoom:1,aspect:1.8461538461538463,
    position:[target[0]+r*Math.sin(th)*Math.sin(ph),target[1]+r*Math.cos(ph),target[2]+r*Math.cos(th)*Math.sin(ph)],
    target,orbit:{r,th,ph}};
}

// Canopy, vehicle portal and sign in the approximate source-locked site model.
// These bounds frame the access; they are not surveyed building dimensions.
export const ENTRY_DETAIL_BOUNDS={min:[-36.9,.1,35.5],max:[-22.8,4.55,49.1]};
export function entryDetailView(){
  const target=[-29.85,2.5,42.3],r=28,th=-.18,ph=1.585;
  return {type:'PerspectiveCamera',fov:50,near:.2,far:900,zoom:1,aspect:1.8461538461538463,
    position:[target[0]+r*Math.sin(th)*Math.sin(ph),target[1]+r*Math.cos(ph),target[2]+r*Math.cos(th)*Math.sin(ph)],
    target,orbit:{r,th,ph}};
}

// Frame the pilot facade across the viewport, keeping the ground near the bottom.
export function pilotFloorView(aspect,side){
  if(!Number.isFinite(aspect)||aspect<=0||!['lazer','estacionamento'].includes(side))throw Error('Vista do pavimento inválida.');
  const fov=34,halfHeight=26/aspect,targetY=Math.max(10,halfHeight-2);
  const distance=halfHeight/Math.tan(fov*Math.PI/360)+7.02;
  return {type:'PerspectiveCamera',fov,near:.2,far:900,aspect,zoom:1,
    position:[0,targetY,(side==='lazer'?1:-1)*distance],target:[0,targetY,0]};
}

// The building mirror keeps every model floor visible on the chosen facade.
export function buildingFacadeView(aspect,side,bounds=null){
  if(!Number.isFinite(aspect)||aspect<=0||!['lazer','estacionamento'].includes(side))throw Error('Vista da fachada inválida.');
  let target=[0,48.45/2,0],halfHeight=Math.max(25.7,26/aspect),depth=7.02;
  if(bounds){
    const {min,max}=bounds;
    if(![min,max].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))||max.some((n,i)=>n<=min[i]))throw Error('Limites da torre inválidos.');
    target=min.map((n,i)=>(n+max[i])/2);
    halfHeight=Math.max((max[1]-min[1])/2+1.5,((max[0]-min[0])/2+1.5)/aspect);depth=(max[2]-min[2])/2;
  }
  const fov=34,distance=halfHeight/Math.tan(fov*Math.PI/360)+depth;
  return {type:'PerspectiveCamera',fov,near:.2,far:900,aspect,zoom:1,
    position:[target[0],target[1],target[2]+(side==='lazer'?1:-1)*distance],target};
}

// Laranjeiras: enquadra a face de uma torre. dir = '+x'|'-x'|'+z'|'-z' (lado para onde o apartamento dá).
// Se outra torre fica na frente dessa face, a câmera para antes dela (2 m de folga), abre o ângulo até 75° e
// centraliza no pavimento escolhido; sem obstáculo, o enquadramento é o mesmo de antes.
export function towerFacadeView(aspect,dir,bounds,others=[],focusY=null){
  if(!Number.isFinite(aspect)||aspect<=0||!/^[+-][xz]$/.test(dir))throw Error('Vista da fachada inválida.');
  const {min,max}=bounds,target=min.map((n,i)=>(n+max[i])/2),axis=dir[1]==='x'?0:2,across=axis===0?2:0,sign=dir[0]==='+'?1:-1;
  let halfHeight=Math.max((max[1]-min[1])/2+1.5,((max[across]-min[across])/2+1.5)/aspect),fov=34;
  const depth=(max[axis]-min[axis])/2;
  let distance=halfHeight/Math.tan(fov*Math.PI/360);
  let free=Infinity;
  for(const other of others){
    const gap=sign>0?other.min[axis]-max[axis]:min[axis]-other.max[axis];
    if(gap>0&&other.min[across]<max[across]&&other.max[across]>min[across])free=Math.min(free,gap-2);
  }
  if(distance>free&&free>4){
    distance=free;
    if(Number.isFinite(focusY))target[1]=focusY;
    fov=Math.min(75,2*Math.atan(halfHeight/distance)*180/Math.PI);
  }
  const position=[...target];position[axis]+=sign*(distance+depth);
  return {type:'PerspectiveCamera',fov,near:.2,far:900,aspect,zoom:1,position,target};
}
