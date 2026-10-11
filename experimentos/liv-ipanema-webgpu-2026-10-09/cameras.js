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
export function buildingFacadeView(aspect,side){
  if(!Number.isFinite(aspect)||aspect<=0||!['lazer','estacionamento'].includes(side))throw Error('Vista da fachada inválida.');
  const fov=34,halfHeight=Math.max(25.7,26/aspect),targetY=48.45/2;
  const distance=halfHeight/Math.tan(fov*Math.PI/360)+7.02;
  return {type:'PerspectiveCamera',fov,near:.2,far:900,aspect,zoom:1,
    position:[0,targetY,(side==='lazer'?1:-1)*distance],target:[0,targetY,0]};
}
