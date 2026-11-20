import * as THREE from 'three/webgpu';
import {inside} from './interior-navigation.js';

// Fit all eight bounds corners in the usable part of the perspective view.
// Wall height and depth towards the camera matter as much as floor width.
export function planFrame(bounds,fov,aspect,limits={x:.9,y:.8}){
  const target=bounds.getCenter(new THREE.Vector3());
  const outward=new THREE.Vector3(0,.95,.62).normalize();
  const right=new THREE.Vector3(1,0,0),up=new THREE.Vector3().crossVectors(outward,right);
  const tangent=Math.tan(THREE.MathUtils.degToRad(fov)/2);
  let distance=3;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const offset=new THREE.Vector3(x,y,z).sub(target),depth=offset.dot(outward);
    distance=Math.max(distance,depth+Math.abs(offset.dot(right))/(tangent*aspect*limits.x),
      depth+Math.abs(offset.dot(up))/(tangent*limits.y));
  }
  return {target,position:target.clone().addScaledVector(outward,distance*1.015),distance};
}

// The room request should reveal that room rather than aim along a corridor.
// These targets use the current nominal furniture, including customer edits.
export function roomLook(position,layout,furniture,roomId,visible=()=>true){
  const room=layout.rooms.find(r=>r.id===roomId)||layout.rooms.find(r=>inside(r.poly,...position));
  if(!room)return null;
  const preferred=/^(su[ií]te|dormit[oó]rio)/i.test(room.name)?['cama']:
    /^(sala|estar|living)/i.test(room.name)?['sofa','mesa']:
    /^banho/i.test(room.name)?['pia','bancada']:['mesa','bancada'];
  const candidates=furniture.filter(m=>preferred.includes(m.tipo)&&inside(room.poly,...m.position)).map(m=>({
    id:m.id,point:[m.position[0],Math.max(.65,Math.min(1.1,m.h*.85)),m.position[1]],priority:preferred.indexOf(m.tipo)}));
  candidates.push({id:null,point:[room.cx,1.1,room.cz],priority:preferred.length});
  candidates.sort((a,b)=>a.priority-b.priority||Math.hypot(b.point[0]-position[0],b.point[2]-position[1])-Math.hypot(a.point[0]-position[0],a.point[2]-position[1]));
  for(const candidate of candidates){
    const [x,y,z]=candidate.point,dx=x-position[0],dz=z-position[1],distance=Math.hypot(dx,dz);
    if(distance<.65||!inside(room.poly,x,z)||!visible(candidate))continue;
    return {roomId:room.id,focusId:candidate.id,target:candidate.point,
      yaw:Math.atan2(-dx,-dz),pitch:Math.max(-.55,Math.atan2(y-1.62,distance))};
  }
  return null;
}
