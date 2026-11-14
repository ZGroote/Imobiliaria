import * as THREE from 'three/webgpu';
import {wallTopContours} from './interior-wall-top-contours.js?rev=2026-10-13-rodateto-selado-final';

export function unifiedWallTop(typology,sourceSHA256,color){
  const profile=wallTopContours[typology];
  if(!profile||profile.sourceSHA256!==sourceSHA256)throw Error('Topo das paredes pertence a outra fonte.');
  const positions=[],normals=[],colors=[],uv=[],rgb=new THREE.Color(color).toArray();
  const ring=points=>points.map(p=>new THREE.Vector2(Math.fround(p[0]),Math.fround(p[1])))
    .filter((p,i,all)=>!p.equals(all[(i+all.length-1)%all.length]));
  for(const contour of profile.contours){
    const outer=ring(contour.outer),holes=contour.holes.map(ring).filter(h=>h.length>=3);
    const points=[...outer,...holes.flat()];
    for(const triangle of THREE.ShapeUtils.triangulateShape(outer,holes)){
      // In the XZ plane, clockwise winding faces +Y.
      const [a,b,c]=triangle.map(i=>points[i]);
      const cross=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      if(Math.abs(cross)<1e-12)continue;
      for(const p of cross>0?[a,c,b]:[a,b,c]){
        positions.push(p.x,profile.height,p.y);normals.push(0,1,0);colors.push(...rgb);uv.push(p.x,p.y);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,data,size]of [['position',positions,3],['normal',normals,3],['color',colors,3],['uv',uv,2]])
    geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,size));
  geometry.computeBoundingSphere();return geometry;
}

export function removeOriginalWallTop(geometry,height){
  const position=geometry.attributes.position,indices=geometry.index,kept=[];
  const count=indices?.count??position.count;
  for(let offset=0;offset<count;offset+=3){
    const ids=[0,1,2].map(k=>indices?indices.getX(offset+k):offset+k);
    if(!ids.every(i=>Math.abs(position.getY(i)-height)<1e-6))kept.push(...ids);
  }
  // Retain every source attribute, including RGBM UV1. Remove the conflicting
  // faces from the draw list instead of layering a decal/offset above them.
  const result=geometry.clone();result.setIndex(kept);return result;
}

export function repairWallTops({scene,typology,sourceSHA256,baked,wallMaterial,color,own}){
  const profile=wallTopContours[typology];
  const mesh=scene.children.find(o=>o.userData.livSlot===profile?.slot);
  if(!mesh)throw Error('Malha das paredes ausente para a união dos topos.');
  const variants=new Map(),replace=geometry=>{
    if(!variants.has(geometry))variants.set(geometry,own(removeOriginalWallTop(geometry,profile.height)));
    return variants.get(geometry);
  };
  // Both the approved bake and the furniture-edit variant use the same clean
  // topology, so editing/resetting furniture cannot resurrect the overlap.
  mesh.geometry=replace(mesh.geometry);
  const target=baked.find(t=>t.mesh===mesh);
  if(target){target.geometry=replace(target.geometry);target.originalGeometry=replace(target.originalGeometry);}
  const top=new THREE.Mesh(own(unifiedWallTop(typology,sourceSHA256,color)),wallMaterial);
  top.name='Topo unido das paredes';top.userData.livWallTop=true;
  top.castShadow=top.receiveShadow=true;scene.add(top);
  return {sourceTriangles:profile.sourceTriangles,sourceArea:profile.sourceArea,
    unionArea:profile.unionArea,triangles:top.geometry.attributes.position.count/3};
}
