import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
const root=new URL('./',import.meta.url),catalog=JSON.parse(fs.readFileSync(new URL('catalogo.json',root)));
const io=new NodeIO(),report=[];
for(const a of catalog.assets){
 const doc=await io.read(new URL(`glb/${a.id}.glb`,root).pathname.replace(/^\/([A-Z]:)/,'$1'));
 const node=doc.getRoot().listNodes().find(n=>n.getMesh());if(!node)throw Error('Missing mesh '+a.id);
 const matrix=node.getWorldMatrix(),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];let tris=0;
 for(const prim of node.getMesh().listPrimitives()){
  const p=prim.getAttribute('POSITION'),c=prim.getAttribute('COLOR_0'),n=prim.getAttribute('NORMAL'),idx=prim.getIndices();
  if(!c||!n)throw Error('Missing colors or normals');
  for(let i=0;i<p.getCount();i++){
   const v=p.getElement(i,[]);for(let k=0;k<3;k++){
    const val=matrix[k]*v[0]+matrix[k+4]*v[1]+matrix[k+8]*v[2]+matrix[k+12];
    if(!Number.isFinite(val))throw Error('Nonfinite');lo[k]=Math.min(lo[k],val);hi[k]=Math.max(hi[k],val);
   }
  }
  tris+=(idx?idx.getCount():p.getCount())/3;
 }
 const expected=[a.dimensions_m[0],a.dimensions_m[2],a.dimensions_m[1]];
 if(expected.some((v,k)=>Math.abs(v-(hi[k]-lo[k]))>.003))throw Error('Scale/axis '+a.id);
 if(tris!==a.triangles)throw Error('Triangle mismatch '+a.id);
 report.push({id:a.id,triangles:tris,bytes:fs.statSync(new URL(`glb/${a.id}.glb`,root)).size,ok:true});
}
if(report.length!==65)throw Error('Count');
fs.writeFileSync(new URL('validacao-glb.json',root),JSON.stringify({count:report.length,assets:report},null,2));
console.log(JSON.stringify({count:report.length,triangles:report.reduce((n,a)=>n+a.triangles,0),largest:Math.max(...report.map(a=>a.triangles)),bytes:report.reduce((n,a)=>n+a.bytes,0)}));
