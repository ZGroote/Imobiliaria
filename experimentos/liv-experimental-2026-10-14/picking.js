import * as THREE from 'three/webgpu';
import {unitById} from './unidades.js';
import {floorOf} from './catalogo-unidades.js';
import {containsPoint,intersectPrism} from './unit-footprint.js';

// Only the first exterior envelope hit can select a zone. The roof and other
// floors must not become transparent to picking when seen from above or obliquely.
export function createUnitResolver(catalog){
  const envelope=new THREE.Box3(new THREE.Vector3(-23.85,0,-7.02),new THREE.Vector3(23.85,48.45,7.02));
  const zones=catalog.units.map(unit=>({unit,box:new THREE.Box3(
    new THREE.Vector3().fromArray(unit.bounds.min),new THREE.Vector3().fromArray(unit.bounds.max))}));
  const point=new THREE.Vector3();
  return ray=>{
    if(catalog.selectionEnvelope){
      if(!intersectPrism(ray,catalog.selectionEnvelope,point))return null;
      const matches=zones.filter(({unit,box})=>point.y>=box.min.y&&point.y<=box.max.y&&
        containsPoint(unit.footprint,point.x,point.z));
      return matches.length===1?matches[0].unit.id:null;
    }
    if(envelope.containsPoint(ray.origin)||!ray.intersectBox(envelope,point))return null;
    // Floating point intersection can land a few ulps beyond an exterior face.
    point.clamp(envelope.min,envelope.max);
    // Boundaries and the central corridor have no implied apartment assignment.
    const matches=zones.filter(({box})=>box.containsPoint(point));
    return matches.length===1?matches[0].unit.id:null;
  };
}
function contourHighlight(catalog){
  const fills=[],lines=[],ranges=new Map(),shared=new Map();
  for(const unit of catalog.units){
    const a=unit.bounds.min,b=unit.bounds.max;
    const key=JSON.stringify([unit.footprint,a[0],b[0],a[2],b[2]]);
    if(shared.has(key)){ranges.set(unit.id,shared.get(key));continue;}
    const shape=new THREE.Shape(unit.footprint.map(([x,z])=>new THREE.Vector2(
      (x-(a[0]+b[0])/2)/(b[0]-a[0]),-(z-(a[2]+b[2])/2)/(b[2]-a[2]))));
    const prism=new THREE.ExtrudeGeometry(shape,{depth:1,steps:1,bevelEnabled:false});
    prism.rotateX(-Math.PI/2);prism.translate(0,-.5,0);
    const edge=new THREE.EdgesGeometry(prism);
    const range={fill:[fills.length/3,prism.getAttribute('position').count],
      line:[lines.length/3,edge.getAttribute('position').count]};
    ranges.set(unit.id,range);shared.set(key,range);
    fills.push(...prism.getAttribute('position').array);lines.push(...edge.getAttribute('position').array);
    prism.dispose();edge.dispose();
  }
  const geometry=new THREE.BufferGeometry(),edges=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(fills,3));
  geometry.computeVertexNormals();
  edges.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  geometry.setDrawRange(0,0);edges.setDrawRange(0,0);
  return {geometry,edges,ranges};
}
export function createUnitPicking({scene,canvas,catalog,getCamera,getFloor,onSelect}){
  const resolve=createUnitResolver(catalog),raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2();
  const contour=catalog.selectionEnvelope?contourHighlight(catalog):null;
  const geometry=contour?.geometry??new THREE.BoxGeometry(1,1,1),edges=contour?.edges??new THREE.EdgesGeometry(geometry);
  // Gold and drawn after the green "available" glow, or the choice drowns in it.
  // Keep a constant depth bias: slope bias pulls edge-on prism caps through the tower.
  const fillMaterial=new THREE.MeshBasicMaterial({color:0xffc84a,toneMapped:false,transparent:true,opacity:.8,depthWrite:false,
    polygonOffset:!!contour,polygonOffsetFactor:0,polygonOffsetUnits:-3});
  const lineMaterial=new THREE.LineBasicMaterial({color:0xffffff,toneMapped:false});
  const highlight=new THREE.Group();highlight.name='Posição aproximada do final selecionado';highlight.visible=false;
  highlight.userData.livPresentation=true;
  const fillMesh=new THREE.Mesh(geometry,fillMaterial),outline=new THREE.LineSegments(edges,lineMaterial);
  fillMesh.renderOrder=outline.renderOrder=1;highlight.add(fillMesh,outline);
  scene.add(highlight);
  const availability=createAvailabilityHighlight(scene,catalog,contour,geometry,edges);
  let selectedId=null,disposed=false,gesture=null,lastTap=null;
  const pointers=new Set(),stats={pickQueries:0};
  const activeFloor=()=>Number.isInteger(getFloor())&&getFloor()>=0&&
    (catalog.floorIndex===null||getFloor()===catalog.floorIndex);
  const canPick=()=>catalog.floorIndex===null||activeFloor();
  function refresh(){highlight.visible=!disposed&&activeFloor()&&selectedId!==null&&
    floorOf(catalog,unitById(catalog,selectedId))===getFloor();}
  function select(id){
    if(disposed)return false;
    const unit=unitById(catalog,id);selectedId=id;
    if(unit){
      if(contour){
        const range=contour.ranges.get(id);geometry.setDrawRange(...range.fill);edges.setDrawRange(...range.line);
      }
      const a=unit.bounds.min,b=unit.bounds.max;
      highlight.position.set(...a.map((v,i)=>(v+b[i])/2));
      highlight.scale.set(...a.map((v,i)=>b[i]-v));highlight.updateMatrixWorld(true);
    }
    refresh();return true;
  }
  function pick(x,y){
    if(disposed||!canPick())return null;
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height||x<rect.left||x>rect.right||y<rect.top||y>rect.bottom)return null;
    ndc.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(ndc,getCamera());stats.pickQueries++;
    const id=resolve(raycaster.ray);
    return id!==null&&(catalog.floorIndex===null||floorOf(catalog,unitById(catalog,id))===getFloor())?id:null;
  }
  function down(event){
    pointers.add(event.pointerId);
    if(pointers.size!==1||!event.isPrimary||event.button!==0){gesture=null;lastTap=null;return;}
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  }
  function move(event){
    if(gesture?.id===event.pointerId&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>6){gesture.moved=true;lastTap=null;}
  }
  function up(event){
    move(event);pointers.delete(event.pointerId);
    const tap=gesture?.id===event.pointerId&&!gesture.moved&&pointers.size===0;gesture=null;
    if(tap&&canPick()){
      // DUPLO-TOQUE-20261023: selection is immediate; opening needs a second deliberate tap.
      const id=pick(event.clientX,event.clientY),time=event.timeStamp;
      const activate=id!==null&&lastTap?.id===id&&lastTap.pointerType===event.pointerType&&
        time>=lastTap.time&&time-lastTap.time<=500&&Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y)<=24;
      lastTap=id!==null&&!activate?{id,time,pointerType:event.pointerType,x:event.clientX,y:event.clientY}:null;
      onSelect(id,{activate});
    }
  }
  function cancel(event){
    // Touch capture is normally released after a successful pointerup; preserve that tap.
    if(gesture?.id===event.pointerId||pointers.has(event.pointerId)){gesture=null;lastTap=null;}
    pointers.delete(event.pointerId);
  }
  const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:cancel};
  for(const [name,listener] of Object.entries(events))canvas.addEventListener(name,listener,true);
  return {select,refresh,pick,highlight,availability,stats,getState:()=>({selectedId,active:highlight.visible}),dispose(){
    if(disposed)return;disposed=true;gesture=null;lastTap=null;pointers.clear();
    for(const [name,listener] of Object.entries(events))canvas.removeEventListener(name,listener,true);
    availability.dispose();scene.remove(highlight);geometry.dispose();edges.dispose();fillMaterial.dispose();lineMaterial.dispose();
  }};
}

// Two draws for the whole building, rebuilt only when the available ID set
// changes. Unlit materials preserve the model's PBR and baked illumination.
function createAvailabilityHighlight(scene,catalog,contour,sourceFill,sourceLine){
  const fill=new THREE.BufferGeometry(),line=new THREE.BufferGeometry();
  const fillMaterial=new THREE.MeshBasicMaterial({color:0x5bff9d,toneMapped:false,
    transparent:true,opacity:.42,depthWrite:false,polygonOffset:true,polygonOffsetFactor:0,polygonOffsetUnits:-2});
  const lineMaterial=new THREE.LineBasicMaterial({color:0xafffd1,toneMapped:false,transparent:true,opacity:.95,depthWrite:false});
  const group=new THREE.Group();group.name='Apartamentos disponíveis';group.userData.livPresentation=true;group.visible=false;
  group.add(new THREE.Mesh(fill,fillMaterial),new THREE.LineSegments(line,lineMaterial));scene.add(group);
  let ids=[],signature='',disposed=false;
  const stats={geometryBuilds:0};
  function setUnits(requested){
    if(disposed)return false;
    if(!Array.isArray(requested))throw Error('Lista de disponibilidade inválida.');
    const next=[...new Set(requested)].sort(),units=next.map(id=>{
      const unit=unitById(catalog,id);if(!unit)throw Error('Unidade disponível inválida.');return unit;
    }),key=JSON.stringify(next);
    if(key===signature)return false;
    const positions=[],edges=[];
    function append(target,source,range,unit,expand){
      const a=unit.bounds.min,b=unit.bounds.max;
      const attribute=source.getAttribute('position');
      for(let i=range[0];i<range[0]+range[1];i++){
        const vertex=source.index?source.index.getX(i):i;
        for(let axis=0;axis<3;axis++){
          const value=attribute.array[vertex*3+axis];
          target.push((a[axis]+b[axis])/2+value*(b[axis]-a[axis]+expand));
        }
      }
    }
    for(const unit of units){
      const range=contour?.ranges.get(unit.id);
      append(positions,sourceFill,range?.fill??[0,sourceFill.index?.count??sourceFill.getAttribute('position').count],unit,0);
      append(edges,sourceLine,range?.line??[0,sourceLine.getAttribute('position').count],unit,.025);
    }
    // Replacing attributes must also release the previous GPU buffers.
    fill.dispose();line.dispose();
    fill.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    line.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));
    if(next.length){fill.computeBoundingSphere();line.computeBoundingSphere();}
    ids=next;signature=key;group.visible=ids.length>0;stats.geometryBuilds++;return true;
  }
  return {setUnits,group,stats,getState:()=>({ids:[...ids],active:group.visible}),dispose(){
    if(disposed)return;disposed=true;group.visible=false;ids=[];scene.remove(group);
    fill.dispose();line.dispose();fillMaterial.dispose();lineMaterial.dispose();
  }};
}
