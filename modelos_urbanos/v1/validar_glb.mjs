import {NodeIO} from '@gltf-transform/core';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'catalogo.json'),'utf8'));
const io=new NodeIO();
const checks=[];
function assert(test,msg){if(!test)throw new Error(msg);}
assert(catalog.assets.length===60,'Expected 60 assets');
for(const category of ['casas','sobrados','predios'])assert(catalog.assets.filter(x=>x.category===category).length===20,category);
for(const asset of catalog.assets){
  for(const lod of ['lod0','lod1']){
    const source=asset[lod];
    const doc=await io.read(path.join(root,source.file));
    const r=doc.getRoot();
    assert(r.listMeshes().length===1,asset.id+' single mesh');
    assert(r.listAnimations().length===0,asset.id+' static');
    const node=r.listNodes().find(n=>n.getMesh());
    const matrix=node.getWorldMatrix();
    let triangles=0,colors=new Set(),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const p of node.getMesh().listPrimitives()){
      assert(p.getMode()===4,'Triangle primitive required');
      assert(p.getAttribute('COLOR_0'),asset.id+' vertex colours lost');
      assert(p.getAttribute('NORMAL'),asset.id+' normals lost');
      const pos=p.getAttribute('POSITION'),col=p.getAttribute('COLOR_0'),idx=p.getIndices();
      triangles+=(idx?idx.getCount():pos.getCount())/3;
      const array=pos.getArray();
      assert(Array.from(array).every(Number.isFinite),asset.id+' finite positions');
      if(idx)assert(Array.from(idx.getArray()).every(i=>i>=0&&i<pos.getCount()),asset.id+' index bounds');
      for(let i=0;i<pos.getCount();i++){
        const v=pos.getElement(i,[]);
        const world=[0,1,2].map(a=>matrix[a]*v[0]+matrix[a+4]*v[1]+matrix[a+8]*v[2]+matrix[a+12]);
        for(let a=0;a<3;a++){min[a]=Math.min(min[a],world[a]);max[a]=Math.max(max[a],world[a]);}
        colors.add(col.getElement(i,[]).slice(0,3).map(x=>Math.round(x*1000)).join(','));
      }
    }
    assert(triangles===source.triangles,asset.id+' triangle count changed');
    assert(colors.size>=4,asset.id+' colour variation');
    assert(Math.abs(min[1])<0.02,asset.id+' ground origin');
    const dims=max.map((v,i)=>v-min[i]);
    const expected=[source.dimensions_m[0],source.dimensions_m[2],source.dimensions_m[1]];
    assert(dims.every((v,i)=>Math.abs(v-expected[i])<0.025),asset.id+' axis/size mismatch');
    checks.push({id:asset.id,lod,triangles,primitives:node.getMesh().listPrimitives().length,colors:colors.size,dimensions_glb_m:dims.map(x=>+x.toFixed(3)),pass:true});
  }
}
const totals={assets:60,glbs:checks.length,all_pass:true,
  near_bytes:catalog.assets.reduce((s,a)=>s+a.lod0.bytes,0),
  far_bytes:catalog.assets.reduce((s,a)=>s+a.lod1.bytes,0),
  by_category:Object.fromEntries(['casas','sobrados','predios'].map(c=>{
    const a=catalog.assets.filter(x=>x.category===c);
    return [c,{models:a.length,lod0_triangles_min:Math.min(...a.map(x=>x.lod0.triangles)),lod0_triangles_max:Math.max(...a.map(x=>x.lod0.triangles)),lod1_triangles_min:Math.min(...a.map(x=>x.lod1.triangles)),lod1_triangles_max:Math.max(...a.map(x=>x.lod1.triangles)),near_bytes:a.reduce((s,x)=>s+x.lod0.bytes,0),far_bytes:a.reduce((s,x)=>s+x.lod1.bytes,0)}];
  }))};
fs.writeFileSync(path.join(root,'validation','glb_report.json'),JSON.stringify({totals,checks},null,2));
console.log(JSON.stringify(totals,null,2));
