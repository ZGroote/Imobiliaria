// Detail view of the two balcony stacks at the gate end of the published face.
// Coordinates use the source-locked model; no commercial unit is assigned.
export const BALCONY_DETAIL_BOUNDS={min:[-21,20.0,4.2],max:[-11.5,29.0,6.9]};

export function balconyDetailView() {
  const target=[-16.25,24.5,5.55],r=24,th=.08,ph=1.53;
  return {type:'PerspectiveCamera',fov:34,near:.2,far:900,zoom:1,aspect:1.8461538461538463,
    position:[target[0]+r*Math.sin(th)*Math.sin(ph),target[1]+r*Math.cos(ph),target[2]+r*Math.cos(th)*Math.sin(ph)],
    target,orbit:{r,th,ph}};
}
