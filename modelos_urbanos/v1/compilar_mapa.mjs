// Offline conversion of the validated GLBs to the map's self-contained asset block.
// No Blender geometry generation or glTF parser runs in the visitor's browser.
import {NodeIO} from '@gltf-transform/core';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'catalogo.json'),'utf8'));
const io=new NodeIO();const assets=[];
const b64=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
for(const a of catalog.assets){
  const doc=await io.read(path.join(root,a.lod1.file));
  const node=doc.getRoot().listNodes().find(n=>n.getMesh()),m=node.getWorldMatrix();
  const P=[],N=[],C=[],I=[],groups=[];
  for(const prim of node.getMesh().listPrimitives()){
    const p=prim.getAttribute('POSITION'),n=prim.getAttribute('NORMAL'),c=prim.getAttribute('COLOR_0');
    const offset=P.length/3,start=I.length;
    for(let j=0;j<p.getCount();j++){
      const v=p.getElement(j,[]),normal=n.getElement(j,[]),color=c.getElement(j,[]);
      for(let k=0;k<3;k++){
        const pos=Math.round((m[k]*v[0]+m[k+4]*v[1]+m[k+8]*v[2]+m[k+12])*100);
        if(!Number.isFinite(pos)||Math.abs(pos)>32767)throw new Error('Position out of range: '+a.id);
        P.push(pos);N.push(Math.round((m[k]*normal[0]+m[k+4]*normal[1]+m[k+8]*normal[2])*127));
        C.push(Math.max(0,Math.min(255,Math.round(color[k]*255))));
      }
    }
    const idx=prim.getIndices();
    for(let j=0;j<(idx?idx.getCount():p.getCount());j++)I.push(offset+(idx?idx.getScalar(j):j));
    groups.push({start,count:I.length-start,material:prim.getMaterial().getRoughnessFactor()<.5?1:0});
  }
  if(P.length/3>65535)throw new Error('Index range: '+a.id);
  // Some simplified balconies extend beyond LOD0. Reserve the union around the
  // shared origin so neither level can cross a parcel boundary after placement.
  const size=[a.lod0.dimensions_m[0],a.lod0.dimensions_m[2],a.lod0.dimensions_m[1]];
  for(let j=0;j<P.length;j+=3){
    size[0]=Math.max(size[0],2*Math.abs(P[j])/100);
    size[1]=Math.max(size[1],P[j+1]/100);
    size[2]=Math.max(size[2],2*Math.abs(P[j+2])/100);
  }
  assets.push({id:a.id,category:a.category,floors:a.floors,
    size,
    p:b64(new Int16Array(P)),n:b64(new Int8Array(N)),c:b64(new Uint8Array(C)),i:b64(new Uint16Array(I)),groups});
}
const output=JSON.stringify({version:1,lod:1,units:'m',front:'+Z',assets});
fs.writeFileSync(path.join(root,'mapa-casas.json'),output);
console.log(JSON.stringify({models:assets.length,bytes:Buffer.byteLength(output)}));
