import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../node_modules/three/build/three.webgpu.js';
import {createDoors,splitTriangles} from '../interior-portas.js';

const door=new THREE.Color(0xEDE7DD),frame=new THREE.Color(0xF2EFE9);
// Caixa não indexada com cor por vértice, como o pecaOr do construtor.
function box(center,size,color,rotation=0){
  const geometry=new THREE.BoxGeometry(...size).toNonIndexed();geometry.rotateY(rotation);geometry.translate(...center);
  const colors=new Float32Array(geometry.attributes.position.count*3);for(let i=0;i<colors.length;i+=3)colors.set(color.toArray(),i);
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));return geometry;
}
function merge(parts){
  const names=['position','normal','color'],out=new THREE.BufferGeometry();
  for(const name of names){
    const arrays=parts.map(part=>part.attributes[name].array),data=new Float32Array(arrays.reduce((sum,array)=>sum+array.length,0));
    let at=0;for(const array of arrays){data.set(array,at);at+=array.length;}out.setAttribute(name,new THREE.BufferAttribute(data,name==='uv'?2:3));
  }
  return out;
}
// Parede ao longo de +x em z=0; dobradiça em (0,0); folha aberta a 78° para +z, 0,7 m.
function scene78({entrada=false}={}){
  const angle=78*Math.PI/180,f=[Math.cos(angle),Math.sin(angle)],larg=.7;
  const v={id:entrada?'a5':'a4',entrada,tipo:'giro',y0:0,y1:2.1,a:[0,0],b:[.8,0],ux:1,uz:0,eixo:false,folha:{x:0,z:0,dx:0,dz:1,larg}};
  const mid=[f[0]*larg/2,1.04,f[1]*larg/2],rot=-angle;
  const paint=new THREE.Mesh(merge([box(mid,[larg,2.05,.035],door,rot),box([.4,2.085,0],[.8,.03,.14],frame)]),new THREE.MeshStandardMaterial({vertexColors:true}));
  const handle=t=>box([f[0]*t,1.05,f[1]*t],[.06,.05,.09],frame,rot);
  const alu=new THREE.Mesh(merge([handle(.55),handle(.5),handle(.6),handle(.45),box([3,1,3],[.1,.1,.1],frame)]),new THREE.MeshStandardMaterial());
  const scene=new THREE.Scene();scene.add(paint,alu);
  return {scene,paint,alu,v,layout:{joinery:[v]}};
}

test('separa os 12 triângulos da folha e as 4 maçanetas, e gira a folha de volta ao vão',()=>{
  const {scene,paint,alu,v,layout}=scene78(),before=[paint.geometry.attributes.position.count,alu.geometry.attributes.position.count];
  const doors=createDoors({scene,layout,paint:[paint],alu:[alu],doorColor:door,roomAt:()=>'Banho'});
  assert.deepEqual(doors.getState().skipped,[]);assert.equal(doors.doors.length,1);
  assert.equal(paint.geometry.attributes.position.count,before[0]-36);assert.equal(alu.geometry.attributes.position.count,before[1]-144);
  const [item]=doors.doors;assert.equal(item.group.children.length,2);assert.equal(item.room,'Banho');
  doors.setOpen('a4',false,{instant:true});
  // Fechada, a folha (e a colisão do Tour) ficam ao longo da parede.
  assert.ok(Math.abs(v.folha.dx-1)<1e-6&&Math.abs(v.folha.dz)<1e-6,`${v.folha.dx},${v.folha.dz}`);
  item.group.updateMatrixWorld(true);
  const position=item.group.children[0].geometry.attributes.position,point=new THREE.Vector3();let far=0;
  for(let i=0;i<position.count;i++){
    point.fromBufferAttribute(position,i).applyMatrix4(item.group.matrixWorld);
    assert.ok(Math.abs(point.z)<.03,`vértice fora do vão: ${point.toArray()}`);far=Math.max(far,point.x);
  }
  assert.ok(Math.abs(far-.7)<.01,'a folha fechada vai da dobradiça ao outro batente');
  doors.setOpen('a4',true);for(let i=0;i<60;i++)doors.update(1/60);
  assert.ok(Math.abs(v.folha.dz-Math.sin(78*Math.PI/180))<1e-6,`reaberta: ${v.folha.dx},${v.folha.dz} open ${item.open}`);
});

test('a porta de dentro aparece de perto e de frente; a entrada nunca',()=>{
  const inner=scene78(),doors=createDoors({scene:inner.scene,layout:inner.layout,paint:[inner.paint],alu:[inner.alu],doorColor:door});
  // No Tour, olhar para +z é yaw π (forward = -sin, -cos).
  assert.equal(doors.nearest(.4,-1,Math.PI)?.id,'a4','de frente, a 1 m');
  assert.equal(doors.nearest(.4,-1,0),null,'de costas');
  assert.equal(doors.nearest(.4,-3,Math.PI),null,'longe');
  const entrance=scene78({entrada:true}),locked=createDoors({scene:entrance.scene,layout:entrance.layout,paint:[entrance.paint],alu:[entrance.alu],doorColor:door});
  assert.equal(locked.nearest(.4,-1,Math.PI),null);
});

test('folha com outra cor ou com triângulos a mais não é separada',()=>{
  const {scene,paint,alu,layout}=scene78(),count=paint.geometry.attributes.position.count;
  const doors=createDoors({scene,layout,paint:[paint],alu:[alu],doorColor:new THREE.Color(0x112233)});
  assert.equal(doors.doors.length,0);assert.deepEqual(doors.getState().skipped,[{id:'a4',found:[0,0]}]);
  assert.equal(paint.geometry.attributes.position.count,count,'malha intacta');
  assert.equal(splitTriangles(paint.geometry,()=>true).triangles,count/3);
});
