// Independent projection checks; no GPU device or browser is created.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {planFrame,roomLook} from './interior-camera.js';

let checked=0;
for(const aspect of [.32,.46,1,1.6,2.2])for(const limits of [{x:.9,y:.8},{x:.86,y:.45}]){
  const box=new THREE.Box3(new THREE.Vector3(-4.9,0,-3.24),new THREE.Vector3(4.9,2.76,3.24));
  const before=box.clone(),pose=planFrame(box,48,aspect,limits),camera=new THREE.PerspectiveCamera(48,aspect,.02,100);
  camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld(true);
  // The camera's actual projection is the oracle, not the fit formula.
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const p=new THREE.Vector3(x,y,z).project(camera);
    assert.ok(Math.abs(p.x)<=limits.x&&Math.abs(p.y)<=limits.y&&Math.abs(p.z)<1,{aspect,p});checked++;
  }
  assert.ok(box.equals(before),'Framing mutated the shared scene bounds.');
}
const layout={rooms:[{id:'suite',name:'Suíte',cx:2,cz:2,poly:[[0,0],[4,0],[4,4],[0,4]]}]};
const bed={id:'bed',tipo:'cama',position:[3,2],h:.95};
const excluded={...bed,id:'other-room',position:[6,2]};
const position=[1,2],furniture=[bed,excluded],original=JSON.stringify({layout,position,furniture});
const view=roomLook(position,layout,furniture,'suite');
assert.equal(view.focusId,'bed');assert.equal(view.roomId,'suite');
assert.ok(Math.abs(view.yaw+Math.PI/2)<1e-12&&view.pitch<0);
const blocked=roomLook(position,layout,furniture,'suite',candidate=>candidate.id!=='bed');
assert.equal(blocked.focusId,null,'An occluded bed must not be selected.');
assert.equal(roomLook(position,layout,furniture,'suite',()=>false),null);
assert.equal(JSON.stringify({layout,position,furniture}),original,'Room views mutated the nominal layout.');
console.log(JSON.stringify({status:'PASS',projectionCorners:checked,focusCases:3}));
