/* Referência aproximada indicada pelo responsável; contexto regional, sem alterar o GLB. */
(function(root){
  'use strict';
  const parcel=root.LivMapParcelData,polygon=parcel.polygonXZ;
  const previousRotation=-Math.PI/3,rotation=previousRotation+Math.PI;
  const previousAnchor=[-3208.4283207855997,-3185.4802476268346],anchor=parcel.anchor;
  const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]);
  const bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];
  const removedBuildings=new WeakSet(),buildingResults=new WeakMap(),removedParcels=new Set();let buildingCount=0,clippedWalls=0,clippedGroundTriangles=0;
  function contains(x,z){
    if(x<bounds[0]||z<bounds[1]||x>bounds[2]||z>bounds[3])return false;
    let hit=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[i],b=polygon[j];
      if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
    }
    return hit;
  }
  function excludeBuilding(b){
    if(buildingResults.has(b))return buildingResults.get(b);
    // Preserve block indices and all source data. Only the rendering list changes.
    const ring=b.r;let twiceArea=0,cx=0,cz=0;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[j],p=ring[i],cross=a[0]*p[1]-p[0]*a[1];
      twiceArea+=cross;cx+=(a[0]+p[0])*cross;cz+=(a[1]+p[1])*cross;
    }
    if(!twiceArea||!contains(cx/(3*twiceArea),cz/(3*twiceArea))){buildingResults.set(b,false);return false;}
    buildingResults.set(b,true);
    if(!removedBuildings.has(b)){removedBuildings.add(b);buildingCount++;}return true;
  }
  function filterParcels(parcels){
    return parcels.filter(p=>{
      if(!contains(p.x,p.z))return true;
      removedParcels.add(p.lot??`${p.x},${p.z}`);return false;
    });
  }
  function wallIntervals(intervals,a,b,track=true){
    if(Math.max(a[0],b[0])<bounds[0]||Math.min(a[0],b[0])>bounds[2]||
       Math.max(a[1],b[1])<bounds[1]||Math.min(a[1],b[1])>bounds[3])return intervals;
    const dx=b[0]-a[0],dz=b[1]-a[1],cuts=[0,1];
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const p=polygon[j],q=polygon[i],ex=q[0]-p[0],ez=q[1]-p[1],den=dx*ez-dz*ex;
      if(Math.abs(den)<1e-10)continue;
      const px=p[0]-a[0],pz=p[1]-a[1],t=(px*ez-pz*ex)/den,u=(px*dz-pz*dx)/den;
      if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
    }
    cuts.sort((x,y)=>x-y);const result=[];
    for(const [lo,hi] of intervals)for(let i=1;i<cuts.length;i++){
      const start=Math.max(lo,cuts[i-1]),end=Math.min(hi,cuts[i]);if(end-start<1e-9)continue;
      const mid=(start+end)/2;
      if(!contains(a[0]+mid*dx,a[1]+mid*dz))result.push([start,end]);
    }
    if(track&&JSON.stringify(result)!==JSON.stringify(intervals))clippedWalls++;
    return result;
  }
  function clipRoad(road){
    // Only obsolete service paths inside the indicated construction lot.
    // Public roads keep their original points, names and classification.
    if(road.k!==9)return [road];
    const result=[];let current=null;
    for(let i=1;i<road.pts.length;i++){
      const a=road.pts[i-1],b=road.pts[i],dx=b[0]-a[0],dz=b[1]-a[1];
      for(const [lo,hi] of wallIntervals([[0,1]],a,b,false)){
        const start=[a[0]+lo*dx,a[1]+lo*dz],end=[a[0]+hi*dx,a[1]+hi*dz],last=current?.pts.at(-1);
        if(!last||Math.hypot(last[0]-start[0],last[1]-start[1])>1e-6){current={...road,pts:[start]};result.push(current);}
        current.pts.push(end);
      }
    }return result;
  }
  function clipContextGeometry(THREE,g){
    if(g.userData.livParcelClipped||g.groups.length||!g.attributes.position)return g;
    g.userData.livParcelClipped=true;
    if(!g.boundingBox)g.computeBoundingBox();const box=g.boundingBox;
    if(box.max.x<bounds[0]||box.min.x>bounds[2]||box.max.z<bounds[1]||box.min.z>bounds[3])return g;
    const masks=THREE.ShapeUtils.triangulateShape(polygon.map(p=>new THREE.Vector2(...p)),[]).map(face=>{
      const ring=face.map(i=>polygon[i]);
      if((ring[1][0]-ring[0][0])*(ring[2][1]-ring[0][1])-(ring[1][1]-ring[0][1])*(ring[2][0]-ring[0][0])<0)ring.reverse();return ring;
    });
    const names=Object.keys(g.attributes),attrs=names.map(name=>g.attributes[name]),offsets=[];let stride=0;
    for(const a of attrs){offsets.push(stride);stride+=a.itemSize;}
    const pi=offsets[names.indexOf('position')],output=names.map(()=>[]),index=g.index?.array,total=index?.length??g.attributes.position.count;
    const read=i=>attrs.flatMap(a=>Array.from(a.array.subarray(i*a.itemSize,(i+1)*a.itemSize)));
    function clip(poly,a,b,positive){
      const out=[],sign=positive?1:-1,dx=b[0]-a[0],dz=b[1]-a[1];
      const dist=p=>sign*(dx*(p[pi+2]-a[1])-dz*(p[pi]-a[0]));
      for(let i=0;i<poly.length;i++){
        const p=poly[i],q=poly[(i+1)%poly.length],dp=dist(p),dq=dist(q);
        if(dp>=-1e-8)out.push(p);
        if((dp<0&&dq>0)||(dp>0&&dq<0)){const t=dp/(dp-dq);out.push(p.map((v,k)=>v+(q[k]-v)*t));}
      }return out;
    }
    function emit(poly){
      for(let i=1;i+1<poly.length;i++){
        const a=poly[0],b=poly[i],c=poly[i+1];
        if(Math.abs((b[pi]-a[pi])*(c[pi+2]-a[pi+2])-(b[pi+2]-a[pi+2])*(c[pi]-a[pi]))<1e-8)continue;
        for(const p of [a,b,c])for(let j=0;j<attrs.length;j++)for(let k=0;k<attrs[j].itemSize;k++)output[j].push(p[offsets[j]+k]);
      }
    }
    for(let i=0;i<total;i+=3){
      const tri=[read(index?index[i]:i),read(index?index[i+1]:i+1),read(index?index[i+2]:i+2)];
      const xs=tri.map(p=>p[pi]),zs=tri.map(p=>p[pi+2]);
      if(Math.max(...xs)<bounds[0]||Math.min(...xs)>bounds[2]||Math.max(...zs)<bounds[1]||Math.min(...zs)>bounds[3]){emit(tri);continue;}
      let pieces=[tri];
      for(const ring of masks){
        const remaining=[];
        for(let poly of pieces){
          for(let j=0;j<3&&poly.length>=3;j++){
            const outside=clip(poly,ring[j],ring[(j+1)%3],false);if(outside.length>=3)remaining.push(outside);
            poly=clip(poly,ring[j],ring[(j+1)%3],true);
          }
        }pieces=remaining;if(!pieces.length)break;
      }
      pieces.forEach(emit);clippedGroundTriangles++;
    }
    g.setIndex(null);names.forEach((name,i)=>g.setAttribute(name,new THREE.BufferAttribute(new attrs[i].array.constructor(output[i]),attrs[i].itemSize,attrs[i].normalized)));
    g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function addParcel(THREE,scene,terrain){
    const group=new THREE.Group();group.name='liv-contorno-terreno';
    function surface(ring,color,name,hole=[]){
      const vectors=ring.map(p=>new THREE.Vector2(p[0],p[1])),holeVectors=hole.map(p=>new THREE.Vector2(p[0],p[1]));
      const faces=THREE.ShapeUtils.triangulateShape(vectors,hole.length?[holeVectors]:[]),points=[...ring,...hole];
      const geometry=new THREE.BufferGeometry(),xyz=[];
      for(const face of faces)for(const index of face)xyz.push(points[index][0],0,points[index][1]);
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
      TerrainFit.refine(THREE,geometry,terrain.sample);
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false}));
      mesh.name=name;group.add(mesh);return geometry;
    }
    const cs=Math.cos(rotation),sn=Math.sin(rotation),entry=parcel.entranceLocalXZ;
    const gate=[anchor[0]+cs*entry[0]+sn*entry[1],anchor[1]-sn*entry[0]+cs*entry[1]];
    const normal=[-.7675478204052602,.6409916874586863],tangent=[normal[1],-normal[0]],width=3.2;
    const curb=[gate[0]-normal[0]*6,gate[1]-normal[1]*6];
    const apron=[gate,curb].flatMap((p,i)=>i===0?[[p[0]-tangent[0]*width,p[1]-tangent[1]*width],[p[0]+tangent[0]*width,p[1]+tangent[1]*width]]:
      [[p[0]+tangent[0]*width,p[1]+tangent[1]*width],[p[0]-tangent[0]*width,p[1]-tangent[1]*width]]);
    const access=surface(apron,0xb8b6a8,'liv-acesso-avenida');
    let lastAmount=null;
    function update(){
      const amount=terrain.amount();if(amount===lastAmount)return;lastAmount=amount;
      for(const [g,offset] of [[access,.11]]){
        const pos=g.attributes.position;
        for(let i=0;i<pos.count;i++)pos.setY(i,terrain.sample(pos.getX(i),pos.getZ(i))*amount+offset);
        pos.needsUpdate=true;g.computeBoundingSphere();g.computeVertexNormals();
      }
    }
    scene.add(group);update();return {update,group,gate,source:parcel.source};
  }
  root.LivMapPlacement=Object.freeze({rotation,anchor:Object.freeze(anchor),previousRotation,
    previousAnchor:Object.freeze(previousAnchor),pivotLocal:Object.freeze([7.25,4.93]),
    entranceLocal:Object.freeze(parcel.entranceLocalXZ),parcel,contains,excludeBuilding,filterParcels,wallIntervals,clipRoad,clipContextGeometry,addParcel,
    stats:()=>({excludedBuildings:buildingCount,excludedYards:removedParcels.size,clippedWalls,clippedGroundTriangles,parcelVertices:polygon.length}),
    offsetFromMapCenter:Object.freeze([anchor[0]+3216.4283207855997,anchor[1]+3179.4802476268346]),
    facing:'Avenida Miguel Petroni / João de Guzzi — implantação aproximada conforme imagem indicada pelo responsável',
    positionApproximate:true});
})(globalThis);
