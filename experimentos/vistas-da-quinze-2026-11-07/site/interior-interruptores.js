import * as THREE from 'three/webgpu';
import {inside} from './interior-navigation.js';

const HALF_WALL=.065,HEIGHT=1.1,FROM_JAMB=.14,PLATE=[.08,.12,.012];

/** Um interruptor por cômodo com plafon, na parede ao lado da porta (lado da maçaneta), por dentro do cômodo.
 * A porta é do menor dos dois cômodos que ela liga (a do quarto é do quarto, não da sala); a entrada é da sala.
 * rooms: nomes dos cômodos com luz. Uma só malha instanciada: 1 desenho para todos. */
export function createSwitches({scene,layout,doors,rooms,own=value=>value}){
  const roomAt=(x,z)=>layout.rooms.find(room=>inside(room.poly,x,z))||null;
  const owners=new Map();
  const openings=layout.joinery.filter(v=>v.porta).sort((a,b)=>Number(b.entrada)-Number(a.entrada));
  for(const v of openings){
    const c=[(v.a[0]+v.b[0])/2,(v.a[1]+v.b[1])/2];
    const sides=[1,-1].map(s=>({s,room:roomAt(c[0]+s*v.nx*.3,c[1]+s*v.nz*.3)})).filter(side=>side.room&&rooms.includes(side.room.name));
    if(!sides.length)continue;
    const {s,room}=sides.sort((a,b)=>a.room.area-b.room.area)[0];
    if(owners.has(room.name))continue;
    // Lado da maçaneta: a ponta longe da dobradiça. Sem folha (correr, passagem), a ponta b.
    const hinge=doors?.doors.find(door=>door.id===v.id)?.group.position;
    const far=hinge&&Math.hypot(v.a[0]-hinge.x,v.a[1]-hinge.z)>Math.hypot(v.b[0]-hinge.x,v.b[1]-hinge.z);
    const ends=far?[[v.a,-1],[v.b,1]]:[[v.b,1],[v.a,-1]];
    // Parede livre além do batente? Senão a quina engoliria a placa: tenta o outro lado.
    const fits=([end,t])=>inside(room.poly,end[0]+t*v.ux*(FROM_JAMB+.12)+s*v.nx*.2,end[1]+t*v.uz*(FROM_JAMB+.12)+s*v.nz*.2);
    const [end,t]=ends.find(fits)||ends[0];
    owners.set(room.name,{room:room.name,
      x:end[0]+t*v.ux*FROM_JAMB+s*v.nx*(HALF_WALL+PLATE[2]/2),z:end[1]+t*v.uz*FROM_JAMB+s*v.nz*(HALF_WALL+PLATE[2]/2),
      yaw:Math.atan2(-v.uz,v.ux),facing:[s*v.nx,s*v.nz]});
  }
  const switches=[...owners.values()];
  const mesh=new THREE.InstancedMesh(own(new THREE.BoxGeometry(...PLATE)),own(new THREE.MeshStandardMaterial({name:'Interruptor',color:0xf4f2ee,roughness:.45})),Math.max(1,switches.length));
  mesh.name='Interruptores';mesh.count=switches.length;mesh.userData.livSwitches=true;
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),one=new THREE.Vector3(1,1,1);
  switches.forEach((item,index)=>{
    rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),item.yaw);
    mesh.setMatrixAt(index,matrix.compose(new THREE.Vector3(item.x,HEIGHT,item.z),rotation,one));
  });
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);
  return {mesh,switches,
    /** O interruptor mais próximo à frente de quem caminha, do lado de dentro da parede dele. */
    nearest(x,z,yaw,{reach=1.6}={}){
      const forward=[-Math.sin(yaw),-Math.cos(yaw)];let best=null;
      for(const item of switches){
        const dx=item.x-x,dz=item.z-z,distance=Math.hypot(dx,dz);
        if(distance>reach||dx*item.facing[0]+dz*item.facing[1]>0)continue;   // do outro lado da parede
        if(distance>.35&&(dx*forward[0]+dz*forward[1])/distance<.2)continue;
        if(!best||distance<best.distance)best={item,distance};
      }
      return best?.item||null;
    },
  };
}
