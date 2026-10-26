import * as THREE from 'three/webgpu';

/* Folhas de giro (runtime.js geoDasEsquadrias): caixa de 12 triângulos com a cor de porta na
   malha pintada e quatro peças de maçaneta (48 triângulos) na de alumínio, em torno da dobradiça.
   A fonte congelada do Canto tem a folha a 78° (construtor antigo) e o cadastro atual diz 90°:
   a direção real sai da própria geometria, não de v.folha.
   Aqui cada folha sai da malha comum e vira um grupo que gira; v.folha acompanha o giro,
   então a colisão do Tour bloqueia a porta fechada sem código próprio. */
const LEAF_TRIANGLES=12,HANDLE_TRIANGLES=48,SPEED=Math.PI*1.6;

function local(frame,x,z){const dx=x-frame.hx,dz=z-frame.hz;return [dx*frame.fx+dz*frame.fz,dx*frame.gx+dz*frame.gz];}
const leafTest=(v,color)=>{
  const f=v.folha,reach=Math.hypot(f.larg+.002,.018);  // ponta da folha: comprimento + meia espessura
  return (x,y,z,id,attributes)=>{
    const c=attributes.color;if(!c||Math.hypot(x-f.x,z-f.z)>reach||y<v.y0||y>v.y1-.032)return false;
    return Math.abs(c.getComponent(id,0)-color.r)<.004&&Math.abs(c.getComponent(id,1)-color.g)<.004&&Math.abs(c.getComponent(id,2)-color.b)<.004;
  };
};
const handleTest=frame=>(x,y,z)=>{const [t,s]=local(frame,x,z);return t>0&&t<frame.larg+.01&&Math.abs(s)<.06&&y>frame.y0+.95&&y<frame.y0+1.13;};
function frameFrom(v,leaf){
  const p=leaf.attributes.position;let x=0,z=0;for(let i=0;i<p.count;i++){x+=p.getX(i);z+=p.getZ(i);}
  const dx=x/p.count-v.folha.x,dz=z/p.count-v.folha.z,length=Math.hypot(dx,dz);
  return {hx:v.folha.x,hz:v.folha.z,fx:dx/length,fz:dz/length,gx:-dz/length,gz:dx/length,larg:v.folha.larg,y0:v.y0,y1:v.y1};
}

/** Separa os triângulos cujos três vértices passam no teste; devolve as duas metades sem índice. */
export function splitTriangles(geometry,test){
  const index=geometry.index,position=geometry.attributes.position,count=index?index.count:position.count;
  const corner=i=>index?index.getX(i):i,keep=[],take=[];
  for(let i=0;i<count;i+=3){
    const ids=[corner(i),corner(i+1),corner(i+2)];
    (ids.every(id=>test(position.getX(id),position.getY(id),position.getZ(id),id,geometry.attributes))?take:keep).push(...ids);
  }
  const build=ids=>{
    const out=new THREE.BufferGeometry();
    for(const [name,attribute]of Object.entries(geometry.attributes)){
      const size=attribute.itemSize,data=new Float32Array(ids.length*size);
      // getComponent já desnormaliza cores em byte; a cópia em float não leva a marca.
      ids.forEach((id,i)=>{for(let k=0;k<size;k++)data[i*size+k]=attribute.getComponent(id,k);});
      out.setAttribute(name,new THREE.BufferAttribute(data,size));
    }
    out.computeBoundingSphere();return out;
  };
  return {kept:build(keep),taken:build(take),triangles:take.length/3};
}

const angleOf=(x,z)=>Math.atan2(z,x);
function wrap(angle){return Math.atan2(Math.sin(angle),Math.cos(angle));}

/** paint/alu: malhas da esquadria; baked: alvos do atlas (geometria com e sem UV1). */
export function createDoors({scene,layout,paint,alu,doorColor,baked=[],own=value=>value,roomAt=()=>null}){
  const doors=[],skipped=[];
  const replace=(mesh,test)=>{
    const target=baked.find(item=>item.mesh===mesh),source=target?target.originalGeometry:mesh.geometry;
    const split=splitTriangles(source,test);own(split.kept);own(split.taken);
    if(target){
      const bakedSplit=splitTriangles(target.geometry,test);own(bakedSplit.kept);own(bakedSplit.taken);bakedSplit.taken.dispose();
      const active=mesh.geometry===target.geometry;target.originalGeometry=split.kept;target.geometry=bakedSplit.kept;
      mesh.geometry=active?bakedSplit.kept:split.kept;
    }else mesh.geometry=split.kept;
    return split;
  };
  for(const v of layout.joinery){
    if(v.tipo!=='giro'||!v.folha)continue;
    const leafTestFn=leafTest(v,doorColor);
    // Conta antes de mexer: só separa a folha se a malha for a que o construtor desenha.
    const probe=paint.map(mesh=>splitTriangles(mesh.geometry,leafTestFn)),leaf=probe.find(split=>split.triangles);
    const frame=leaf?frameFrom(v,leaf.taken):null,handleTestFn=frame&&handleTest(frame);
    const found=[probe.reduce((sum,split)=>sum+split.triangles,0),frame?alu.reduce((sum,mesh)=>sum+splitTriangles(mesh.geometry,handleTestFn).triangles,0):0];
    for(const split of probe){split.kept.dispose();split.taken.dispose();}
    if(found[0]!==LEAF_TRIANGLES||found[1]!==HANDLE_TRIANGLES){skipped.push({id:v.id,found});continue;}
    const group=new THREE.Group();group.name=`Porta ${v.id}`;group.position.set(frame.hx,0,frame.hz);group.userData.livDoor=v.id;
    for(const [meshes,test]of [[paint,leafTestFn],[alu,handleTestFn]])for(const mesh of meshes){
      const split=replace(mesh,test);if(!split.triangles)continue;
      split.taken.translate(-frame.hx,0,-frame.hz);
      const part=new THREE.Mesh(split.taken,mesh.material);part.castShadow=part.receiveShadow=true;part.name=`${group.name} · ${mesh.name}`;
      group.add(part);
    }
    scene.add(group);
    // Fechada, a folha volta ao eixo da parede: no Three, girar θ em Y diminui o ângulo θ no plano XZ.
    const closed=v.eixo?[-v.ux,-v.uz]:[v.ux,v.uz];
    const openAngle=angleOf(frame.fx,frame.fz),closeRotation=wrap(openAngle-angleOf(...closed));
    const room=roomAt(frame.hx+frame.fx*.4,frame.hz+frame.fz*.4);
    doors.push({id:v.id,v,group,openAngle,closeRotation,entrance:Boolean(v.entrada),room,open:1,target:1,
      center:[(v.a[0]+v.b[0])/2,(v.a[1]+v.b[1])/2]});
  }
  function pose(door){
    door.group.rotation.y=(1-door.open)*door.closeRotation;
    const angle=door.openAngle-door.group.rotation.y;door.v.folha.dx=Math.cos(angle);door.v.folha.dz=Math.sin(angle);
  }
  const byId=id=>doors.find(door=>door.id===id);
  return {doors,skipped,
    setOpen(id,open,{instant=false}={}){
      const door=byId(id);if(!door)return false;door.target=open?1:0;
      if(instant){door.open=door.target;pose(door);}
      return true;
    },
    toggle(id){const door=byId(id);return door?this.setOpen(id,door.target<.5):false;},
    /** Avança a animação; true quando alguma folha mexeu (sombras e colisão precisam saber). */
    update(dt){
      let moved=false;
      for(const door of doors){
        if(door.open===door.target)continue;
        const step=SPEED*dt/Math.max(.1,Math.abs(door.closeRotation));
        door.open=door.target>door.open?Math.min(door.target,door.open+step):Math.max(door.target,door.open-step);
        pose(door);moved=true;
      }
      return moved;
    },
    /** A porta de dentro mais próxima à frente de quem caminha. */
    nearest(x,z,yaw,{reach=1.5}={}){
      const forward=[-Math.sin(yaw),-Math.cos(yaw)];let best=null;
      for(const door of doors){
        if(door.entrance)continue;
        const dx=door.center[0]-x,dz=door.center[1]-z,distance=Math.hypot(dx,dz);
        if(distance>reach||(distance>.35&&(dx*forward[0]+dz*forward[1])/distance<.2))continue;
        if(!best||distance<best.distance)best={door,distance};
      }
      return best?.door||null;
    },
    getState:()=>({doors:doors.map(door=>({id:door.id,room:door.room,entrance:door.entrance,open:door.target>.5,center:[...door.center]})),skipped:structuredClone(skipped)}),
  };
}
