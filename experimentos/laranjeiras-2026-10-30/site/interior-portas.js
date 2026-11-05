import * as THREE from 'three/webgpu';

/* Folhas de giro (runtime.js geoDasEsquadrias): caixa de 12 triângulos com a cor de porta na
   malha pintada e quatro peças de maçaneta (48 triângulos) na de alumínio, em torno da dobradiça.
   A fonte congelada do Canto tem a folha a 78° (construtor antigo) e o cadastro atual diz 90°:
   a direção real sai da própria geometria, não de v.folha.
   Aqui cada folha sai da malha comum e vira um grupo que gira; v.folha acompanha o giro,
   então a colisão do Tour bloqueia a porta fechada sem código próprio. */
const LEAF_TRIANGLES=12,HANDLE_TRIANGLES=48,SPEED=Math.PI*1.6;
// Mesma seção do marco gerado em geoDasEsquadrias. A folga da folha é medida
// a partir da face interna desse marco, incluindo a ombreira da dobradiça.
const JAMB_WIDTH=.03, LEAF_CLEARANCE=.003, STOP_WIDTH=.015, STOP_DEPTH=.012;
const HALF_WALL=.065, CASING_WIDTH=.055, CASING_DEPTH=.014;

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

function coveredEntranceJambs(layout, opening) {
  if (!opening.entrada) return [0, 0];
  // Um retorno perpendicular que termina no eixo do vão ocupa meia
  // espessura da abertura no lado de dentro do apartamento.
  return [opening.a, opening.b].map(endpoint => {
    const covered = layout.walls.some(wall => {
      if (wall.y0 > .02 || wall.y1 < opening.y1) return false;
      return [[wall.a, wall.b], [wall.b, wall.a]].some(([end, other]) => {
        if (Math.hypot(end[0] - endpoint[0], end[1] - endpoint[1]) > .001) return false;
        const dx = other[0] - end[0], dz = other[1] - end[1];
        const perpendicular = Math.abs(dx * opening.ux + dz * opening.uz) < .001;
        return perpendicular && (dx * opening.nx + dz * opening.nz) * opening.lado > HALF_WALL;
      });
    });
    return covered ? HALF_WALL : 0;
  });
}

function fitDoorLeaf(group, leafParts, frame, opening, closed, covered) {
  const hingeEnd=opening.eixo?opening.b:opening.a;
  const hingeOffset=(hingeEnd[0]-frame.hx)*closed[0]+(hingeEnd[1]-frame.hz)*closed[1];
  const width=Math.hypot(opening.b[0]-opening.a[0],opening.b[1]-opening.a[1]);
  const near=hingeOffset+covered[opening.eixo]+JAMB_WIDTH+LEAF_CLEARANCE;
  const far=hingeOffset+width-covered[1-opening.eixo]-JAMB_WIDTH-LEAF_CLEARANCE;
  const top=opening.y1-JAMB_WIDTH-LEAF_CLEARANCE;
  let oldNear=Infinity,oldFar=-Infinity,bottom=Infinity,oldTop=-Infinity,halfDepth=0;
  for(const part of leafParts){
    const p=part.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=x*frame.fx+z*frame.fz;
      oldNear=Math.min(oldNear,t);oldFar=Math.max(oldFar,t);
      bottom=Math.min(bottom,y);oldTop=Math.max(oldTop,y);
      halfDepth=Math.max(halfDepth,Math.abs(x*frame.gx+z*frame.gz));
    }
  }
  if(!(near<far&&oldNear<oldFar&&bottom<top&&bottom<oldTop))return null;
  const leafSet=new Set(leafParts);
  for(const part of group.children){
    const p=part.geometry.attributes.position,isLeaf=leafSet.has(part);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=x*frame.fx+z*frame.fz;
      const shift=isLeaf?near+(t-oldNear)*(far-near)/(oldFar-oldNear)-t:far-oldFar;
      const height=isLeaf?bottom+(y-bottom)*(top-bottom)/(oldTop-bottom):y;
      p.setXYZ(i,x+shift*frame.fx,height,z+shift*frame.fz);
    }
    p.needsUpdate=true;part.geometry.computeBoundingBox();part.geometry.computeBoundingSphere();
  }
  opening.folha.larg=far;
  return {halfDepth,width};
}

function doorFrameBox(scene, opening, material, color, own, name, t, offset, y, width, height, depth) {
  const geometry = own(new THREE.BoxGeometry(width, height, depth));
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${name} · ${opening.id}`;
  mesh.position.set(opening.a[0] + opening.ux * t + opening.nx * offset, y,
    opening.a[1] + opening.uz * t + opening.nz * offset);
  mesh.rotation.y = -angleOf(opening.ux, opening.uz);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
}

function addCornerCasing(scene, opening, covered, material, color, own) {
  for (const side of [0, 1]) {
    if (!covered[side]) continue;
    const t = distance => side === 0 ? distance : opening.L - distance;
    const height = opening.y1 - opening.y0;
    doorFrameBox(scene, opening, material, color, own, 'Marco no retorno da entrada',
      t(covered[side] + JAMB_WIDTH / 2), 0, opening.y0 + height / 2, JAMB_WIDTH, height, 2 * HALF_WALL + .012);
    // A guarnição abraça a face perpendicular, em vez de continuar atrás dela.
    const casingHeight = height + CASING_WIDTH;
    doorFrameBox(scene, opening, material, color, own, 'Guarnição no retorno da entrada',
      t(covered[side] + CASING_DEPTH / 2 - .001), opening.lado * (HALF_WALL + CASING_WIDTH / 2),
      opening.y0 + casingHeight / 2, CASING_DEPTH, casingHeight, CASING_WIDTH);
  }
}

function addDoorStop(scene,opening,frame,closed,fit,covered,material,color,own){
  const normal=[-closed[1],closed[0]];
  const swing=Math.sign(frame.fx*normal[0]+frame.fz*normal[1]);
  if(!swing)return;
  const closedOffset=(frame.hx-opening.a[0])*normal[0]+(frame.hz-opening.a[1])*normal[1]
    -swing*(fit.halfDepth+STOP_DEPTH/2+.001);
  const offset=closedOffset*(opening.eixo?-1:1);
  const clearHeight=opening.y1-JAMB_WIDTH-opening.y0;
  const add=(t,y,width,height)=>doorFrameBox(scene,opening,material,color,own,
    'Batente de encosto',t,offset,y,width,height,STOP_DEPTH);
  const edge=JAMB_WIDTH+STOP_WIDTH/2;
  const left=covered[0]+JAMB_WIDTH,right=fit.width-covered[1]-JAMB_WIDTH;
  add(left+STOP_WIDTH/2,opening.y0+clearHeight/2,STOP_WIDTH,clearHeight);
  add(right-STOP_WIDTH/2,opening.y0+clearHeight/2,STOP_WIDTH,clearHeight);
  add((left+right)/2,opening.y1-edge,right-left,STOP_WIDTH);
}

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
    const leafParts=[];
    for(const [meshes,test]of [[paint,leafTestFn],[alu,handleTestFn]])for(const mesh of meshes){
      const split=replace(mesh,test);if(!split.triangles)continue;
      split.taken.translate(-frame.hx,0,-frame.hz);
      const part=new THREE.Mesh(split.taken,mesh.material);part.castShadow=part.receiveShadow=true;part.name=`${group.name} · ${mesh.name}`;
      group.add(part);
      if(test===leafTestFn)leafParts.push(part);
    }
    scene.add(group);
    // Fechada, a folha volta ao eixo da parede: no Three, girar θ em Y diminui o ângulo θ no plano XZ.
    const closed=v.eixo?[-v.ux,-v.uz]:[v.ux,v.uz];
    const covered=coveredEntranceJambs(layout,v);
    if (covered[v.eixo]) {
      // O eixo fica na face interna do novo marco. Assim a espessura da
      // folha também fica fora da parede durante a abertura.
      const shift=covered[v.eixo]+JAMB_WIDTH;
      frame.hx+=closed[0]*shift;
      frame.hz+=closed[1]*shift;
      group.position.set(frame.hx,0,frame.hz);
      v.folha.x=frame.hx;
      v.folha.z=frame.hz;
    }
    const fit=fitDoorLeaf(group,leafParts,frame,v,closed,covered);
    if(fit){
      const material=leafParts[0].material,color=new THREE.Color(layout.unit?.cores?.esquadria??0xF2EFE9);
      addDoorStop(scene,v,frame,closed,fit,covered,material,color,own);
      addCornerCasing(scene,v,covered,material,color,own);
    }
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
