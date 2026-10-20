/* Limite geográfico fixo. O recorte acontece na CPU, antes dos buffers de relevo. */
(function (root) {
  'use strict';
  const SIDES = 720, EPS = 1e-8;
  let center, radius, innerRadius, edges;
  const assets = new WeakMap();
  const stats = {geometries:0, clippedTriangles:0, removedTriangles:0, outputTriangles:0};

  function init(point, meters) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) ||
        !Number.isFinite(meters) || meters <= .01) throw new Error('Limite circular inválido');
    center = point.slice(); radius = meters;
    // Dois milímetros absorvem o arredondamento dos buffers Float32 na borda.
    const edgeRadius = radius - .002;
    innerRadius = edgeRadius * Math.cos(Math.PI / SIDES);
    edges = Array.from({length:SIDES}, (_, i) => {
      const a = (i+.5)*Math.PI*2/SIDES;
      return [Math.cos(a), Math.sin(a), innerRadius];
    });
    return api;
  }
  function containsPoint(x, z, margin=0) {
    if (Array.isArray(x)) { margin=z||0; z=x[1]; x=x[0]; }
    const r = radius-.002-margin;
    return Number.isFinite(x) && Number.isFinite(z) && r >= 0 &&
      (x-center[0])**2+(z-center[1])**2 <= r*r;
  }
  function containsRing(points, margin=0) {
    return !!points?.length && points.every(p=>containsPoint(p[0],p[1],margin));
  }
  function containsBounds(box, x=0, z=0, theta=0, sx=1, sz=1) {
    const c=Math.cos(theta),s=Math.sin(theta);
    return [[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]].every(p=>
      containsPoint(x+c*p[0]*sx+s*p[1]*sz,z-s*p[0]*sx+c*p[1]*sz));
  }
  function boundsFromPositions(p, stride=3) {
    const b=[Infinity,Infinity,-Infinity,-Infinity];
    for(let i=0;i+2<p.length;i+=stride){
      b[0]=Math.min(b[0],p[i]);b[1]=Math.min(b[1],p[i+2]);
      b[2]=Math.max(b[2],p[i]);b[3]=Math.max(b[3],p[i+2]);
    }
    return b;
  }
  function assetBounds(asset, quantization=100) {
    let cached=assets.get(asset);
    if(cached?.quantization===quantization)return cached.bounds;
    const bytes=Uint8Array.from(atob(asset.p),c=>c.charCodeAt(0));
    const b=boundsFromPositions(new Int16Array(bytes.buffer));
    const box=b.map(v=>v/quantization);
    assets.set(asset,{quantization,bounds:box});return box;
  }
  function tileIntersects(key, size) {
    const [tx,tz]=key.split('_').map(Number);
    if(!Number.isFinite(tx)||!Number.isFinite(tz)||!Number.isFinite(size)||size<=0)return false;
    const x=Math.max(tx*size,Math.min((tx+1)*size,center[0]));
    const z=Math.max(tz*size,Math.min((tz+1)*size,center[1]));
    return (x-center[0])**2+(z-center[1])**2<=radius*radius;
  }
  function layout(g) {
    const names=Object.keys(g.attributes),attrs=names.map(n=>g.attributes[n]);
    const offsets=[];let stride=0;
    for(const a of attrs){
      if(a.isInterleavedBufferAttribute||a.isInstancedBufferAttribute||a.count!==g.attributes.position.count)
        throw new Error('Atributo incompatível com recorte mundial');
      offsets.push(stride);stride+=a.itemSize;
    }
    const pi=offsets[names.indexOf('position')],normalIndex=names.indexOf('normal');
    return {names,attrs,offsets,stride,pi,normalIndex,
      read(i){const v=[];for(const a of attrs)for(let k=0;k<a.itemSize;k++)v.push(a.array[i*a.itemSize+k]);return v;}};
  }
  function storageScale(a){
    if(!a.normalized)return 1;
    return a.array instanceof Int8Array?127:a.array instanceof Uint8Array?255:
      a.array instanceof Int16Array?32767:a.array instanceof Uint16Array?65535:1;
  }
  function finish(T,g,l,out,groups) {
    g.dispose();g.setIndex(null);
    l.names.forEach((name,j)=>{
      const old=l.attrs[j],array=new old.array.constructor(out[j].length);
      for(let k=0;k<array.length;k++)array[k]=ArrayBuffer.isView(array)&&!(array instanceof Float32Array)&&!(array instanceof Float64Array)?Math.round(out[j][k]):out[j][k];
      const a=new T.BufferAttribute(array,old.itemSize,old.normalized);
      a.setUsage(old.usage);a.name=old.name;a.gpuType=old.gpuType;a.needsUpdate=true;g.setAttribute(name,a);
    });
    g.clearGroups();for(const group of groups)g.addGroup(group.start,group.count,group.materialIndex);
    g.setDrawRange(0,g.attributes.position.count);g.computeBoundingBox();g.computeBoundingSphere();
    return g;
  }
  function clipGeometry(T,g,force=false) {
    if(!g?.attributes.position)return g;
    if(!force&&(g.userData.dynamicHeight||g.userData.presetDY||
      !(g.userData.chaoDetalhe||g.attributes.aVia||g.userData.regionalTriangles)))return g;
    if(g.userData.regionalCircleClipped)return g;
    if(Object.keys(g.morphAttributes||{}).length)throw new Error('Recorte mundial não aceita morph targets');
    if(!g.boundingBox)g.computeBoundingBox();
    const box=g.boundingBox;
    if([[box.min.x,box.min.z],[box.max.x,box.min.z],[box.max.x,box.max.z],[box.min.x,box.max.z]].every(p=>
      (p[0]-center[0])**2+(p[1]-center[1])**2<=innerRadius*innerRadius)){
      g.userData.regionalCircleClipped=true;stats.geometries++;return g;
    }
    const p=g.attributes.position,idx=g.index?.array,total=idx?idx.length:p.count;
    const start=Math.max(0,g.drawRange.start),end=Math.min(total,start+g.drawRange.count);
    if(start%3||(end-start)%3)throw new Error('Recorte mundial exige triângulos completos');
    const l=layout(g),out=l.names.map(()=>[]),groups=[],originalGroups=g.groups.slice();
    let changed=false,output=0;
    const interior=v=>(v[l.pi]-center[0])**2+(v[l.pi+2]-center[1])**2<=innerRadius*innerRadius;
    function emit(a,b,c,material){
      for(const v of [a,b,c]){
        if(l.normalIndex>=0){
          const off=l.offsets[l.normalIndex],scale=storageScale(l.attrs[l.normalIndex]);
          const n=Math.hypot(v[off],v[off+1],v[off+2]);
          if(n>0)for(let k=0;k<3;k++)v[off+k]=v[off+k]/n*scale;
        }
        for(let j=0;j<l.attrs.length;j++)for(let k=0;k<l.attrs[j].itemSize;k++)out[j].push(v[l.offsets[j]+k]);
      }
      if(originalGroups.length){
        const last=groups[groups.length-1];
        if(last?.materialIndex===material)last.count+=3;else groups.push({start:output,count:3,materialIndex:material});
      }
      output+=3;
    }
    for(let i=start;i+2<end;i+=3){
      const v=[l.read(idx?idx[i]:i),l.read(idx?idx[i+1]:i+1),l.read(idx?idx[i+2]:i+2)];
      const material=originalGroups.find(q=>i>=q.start&&i<q.start+q.count)?.materialIndex||0;
      if(v.every(interior)){emit(v[0],v[1],v[2],material);continue;}
      changed=true;let poly=v;
      for(const edge of edges){
        if(!poly.length)break;
        const next=[];
        for(let j=0;j<poly.length;j++){
          const a=poly[j],b=poly[(j+1)%poly.length];
          const da=edge[2]-edge[0]*(a[l.pi]-center[0])-edge[1]*(a[l.pi+2]-center[1]);
          const db=edge[2]-edge[0]*(b[l.pi]-center[0])-edge[1]*(b[l.pi+2]-center[1]);
          if(da>=-EPS)next.push(a);
          if((da<0&&db>0)||(da>0&&db<0)){
            const t=da/(da-db);next.push(a.map((n,k)=>n+(b[k]-n)*t));
          }
        }
        poly=next;
      }
      if(poly.length<3){stats.removedTriangles++;continue;}
      stats.clippedTriangles++;
      for(let j=1;j+1<poly.length;j++){
        const a=poly[0],b=poly[j],c=poly[j+1];
        // Full XYZ area retains vertical walls; XZ area alone would discard them.
        const ux=b[l.pi]-a[l.pi],uy=b[l.pi+1]-a[l.pi+1],uz=b[l.pi+2]-a[l.pi+2];
        const vx=c[l.pi]-a[l.pi],vy=c[l.pi+1]-a[l.pi+1],vz=c[l.pi+2]-a[l.pi+2];
        if(Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)>1e-10)emit(a,b,c,material);
      }
    }
    g.userData.regionalCircleClipped=true;stats.geometries++;stats.outputTriangles+=output/3;
    if(!changed&&start===0&&end===total)return g;
    return finish(T,g,l,out,groups);
  }
  function clipLines(T,g) {
    const p=g.attributes.position;if(!p)return g;
    const l=layout(g),out=l.names.map(()=>[]),idx=g.index?.array,total=idx?idx.length:p.count;
    let changed=false;
    for(let i=0;i+1<total;i+=2){
      const a=l.read(idx?idx[i]:i),b=l.read(idx?idx[i+1]:i+1);
      let lo=0,hi=1;
      if(![a,b].every(v=>(v[l.pi]-center[0])**2+(v[l.pi+2]-center[1])**2<=innerRadius*innerRadius)){
        for(const edge of edges){
          const da=edge[2]-edge[0]*(a[l.pi]-center[0])-edge[1]*(a[l.pi+2]-center[1]);
          const db=edge[2]-edge[0]*(b[l.pi]-center[0])-edge[1]*(b[l.pi+2]-center[1]);
          if(da<0&&db<0){hi=-1;break;}
          if(da<0)lo=Math.max(lo,da/(da-db));else if(db<0)hi=Math.min(hi,da/(da-db));
        }
      }
      if(hi<lo){changed=true;continue;}
      if(lo!==0||hi!==1)changed=true;
      for(const t of [lo,hi])for(let j=0;j<l.attrs.length;j++)for(let k=0;k<l.attrs[j].itemSize;k++){
        const off=l.offsets[j]+k;out[j].push(a[off]+(b[off]-a[off])*t);
      }
    }
    return changed?finish(T,g,l,out,[]):g;
  }
  const api={init,containsPoint,containsRing,containsBounds,bounds:containsBounds,
    boundsFromPositions,assetBounds,tileIntersects,clipGeometry,clipLines,
    diagnostics:()=>({...stats,center:center?.slice(),radius,sides:SIDES})};
  root.LivCircle=api;
})(globalThis);
