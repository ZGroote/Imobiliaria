// Compact, explicitly dimensioned infill houses. Illustrative, never listing replicas.
// Doors and windows retain their architectural dimensions in every variant.
import fs from 'node:fs';
import vm from 'node:vm';
import {Document,NodeIO} from '@gltf-transform/core';
vm.runInThisContext(fs.readFileSync(new URL('../../renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8'));
const T=globalThis.THREE,b64=a=>Buffer.from(a.buffer).toString('base64'),assets=[];
const folder=new URL('./compactos/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
for(const floors of [1,2])for(const [index,[width,depth]] of [[3.6,5],[4.2,6.5],[4.8,5],[5.2,7],[5.8,6],[6.5,5],[4.2,9]].entries()){
  const P=[],N=[],C=[],I=[],colors=['d5c5aa','8c9c91','e1dcd0','b0bbc0','bca58e','c9baa4','bec3b6'];
  const box=(x,y,z,w,h,d,color)=>{
    const g=new T.BoxGeometry(w,h,d).translate(x,y,z),p=g.attributes.position,n=g.attributes.normal,c=new T.Color('#'+color),offset=P.length/3;
    for(let j=0;j<p.count;j++){P.push(p.getX(j),p.getY(j),p.getZ(j));N.push(n.getX(j),n.getY(j),n.getZ(j));C.push(c.r,c.g,c.b);}
    I.push(...Array.from(g.index.array,v=>v+offset));g.dispose();
  };
  const w=width-.16,d=depth-.16,h=3*floors;
  box(0,h/2,0,w,h,d,colors[index]);box(0,.1,0,width,.2,depth,'807d73');
  box(0,h+.07,0,width,.14,depth,'9c9b94');
  for(const x of [-1,1])box(x*(w/2-.06),h+.28,0,.12,.42,d,'d4cfc1');
  for(const z of [-1,1])box(0,h+.28,z*(d/2-.06),w,.42,.12,'d4cfc1');
  const window=(x,y,z)=>{box(x,y,z,1.3,1.25,.07,'e2e1da');box(x,y,z+.05,1.14,1.09,.025,'415661');box(x,y,z+.07,.045,1.1,.02,'c4c7c3');box(x,y-.67,z+.06,1.4,.09,.18,'babbb3');};
  box(-w*.27,1.08,d/2+.02,.99,2.16,.07,'e2e1da');box(-w*.27,1.04,d/2+.07,.85,2.08,.035,'765846');
  box(-w*.27+.3,1.05,d/2+.1,.045,.2,.04,'b1b2ac');
  window(w*.22,1.75,d/2+.025);
  if(floors===2){window(-w*.25,4.7,d/2+.025);window(w*.25,4.7,d/2+.025);box(0,3.05,0,w+.05,.14,d+.05,'ddd7c9');}
  // Rear windows: use the same frame dimensions, facing the opposite direction.
  for(let floor=0;floor<floors;floor++){
    box(0,1.75+floor*3,-d/2-.025,1.3,1.25,.07,'e2e1da');
    box(0,1.75+floor*3,-d/2-.07,1.14,1.09,.025,'415661');
  }
  const category=floors===1?'casas':'sobrados',id=category+'-compacta-'+(index+1);
  const size=[0,0,0];for(let j=0;j<P.length;j+=3){size[0]=Math.max(size[0],Math.abs(P[j])*2);size[1]=Math.max(size[1],P[j+1]);size[2]=Math.max(size[2],Math.abs(P[j+2])*2);}
  assets.push({id,category,floors,size,p:b64(Int16Array.from(P,v=>Math.round(v*100))),n:b64(Int8Array.from(N,v=>Math.round(v*127))),c:b64(Uint8Array.from(C,v=>Math.round(v*255))),i:b64(new Uint16Array(I)),groups:[{start:0,count:I.length,material:0}]});
  const doc=new Document(),buffer=doc.createBuffer(),attr=(name,type,array)=>doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
  const primitive=doc.createPrimitive().setAttribute('POSITION',attr('position','VEC3',new Float32Array(P))).setAttribute('NORMAL',attr('normal','VEC3',new Float32Array(N))).setAttribute('COLOR_0',attr('color','VEC3',new Float32Array(C))).setIndices(attr('indices','SCALAR',new Uint16Array(I))).setMaterial(doc.createMaterial().setRoughnessFactor(.85));
  doc.createScene().addChild(doc.createNode(id).setMesh(doc.createMesh(id).addPrimitive(primitive)));
  await new NodeIO().write(new URL(id+'.glb',folder).pathname.replace(/^\/([A-Z]:)/,'$1'),doc);
}
fs.writeFileSync(new URL('./compactos.json',import.meta.url),JSON.stringify({illustrative:true,assets}));
console.log(JSON.stringify({compactModels:assets.length}));
