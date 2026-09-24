/* Clip surfaces to the elevation grid's triangles. All layers then interpolate
   the very same planes, including roads crossing a grid edge. */
(function(root){
  function sample(grid,n,half,x,z){
    const u=Math.max(0,Math.min(n-1,(x+half)/(2*half)*(n-1))),v=Math.max(0,Math.min(n-1,(z+half)/(2*half)*(n-1)));
    const i=Math.min(n-2,Math.floor(u)),j=Math.min(n-2,Math.floor(v)),fx=u-i,fz=v-j;
    const a=grid[j*n+i],b=grid[j*n+i+1],c=grid[(j+1)*n+i],d=grid[(j+1)*n+i+1];
    return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);
  }
  function refine(THREE,g,terrain){
    const names=Object.keys(g.attributes).filter(n=>n!=='normal'),attrs=names.map(n=>g.attributes[n]);
    const offset=[];let stride=0;for(const a of attrs){offset.push(stride);stride+=a.itemSize;}
    const pi=offset[names.indexOf('position')],out=names.map(()=>[]),p=g.attributes.position;
    const read=i=>attrs.flatMap(a=>Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize)));
    const emit=verts=>{for(const vertex of verts)for(let j=0;j<attrs.length;j++)
      for(let k=0;k<attrs[j].itemSize;k++)out[j].push(vertex[offset[j]+k]);};
    function clip(poly,axis,value,positive){
      if(!poly.length)return poly;
      const distance=v=>((axis===3?v[pi]+v[pi+2]:v[pi+axis])-value)*(positive?1:-1),result=[];
      for(let j=0;j<poly.length;j++){
        const a=poly[j],b=poly[(j+1)%poly.length],da=distance(a),db=distance(b);
        if(da>=0)result.push(a);
        if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);result.push(a.map((v,k)=>v+(b[k]-v)*t));}
      }
      return result;
    }
    function gridTriangle(a,b,c){
      const {half,n}=terrain.grid,step=2*half/(n-1),vertices=[a,b,c];
      const cell=value=>Math.max(-1,Math.min(n-1,Math.floor((value+half)/step)));
      const xs=vertices.map(v=>v[pi]),zs=vertices.map(v=>v[pi+2]);
      const fan=poly=>{for(let k=1;k+1<poly.length;k++)emit([poly[0],poly[k],poly[k+1]]);};
      for(let x=cell(Math.min(...xs));x<=cell(Math.max(...xs));x++)for(let z=cell(Math.min(...zs));z<=cell(Math.max(...zs));z++){
        let poly=vertices;
        if(x>=0)poly=clip(poly,0,-half+x*step,true);
        if(x<n-1)poly=clip(poly,0,-half+(x+1)*step,false);
        if(z>=0)poly=clip(poly,2,-half+z*step,true);
        if(z<n-1)poly=clip(poly,2,-half+(z+1)*step,false);
        if(x>=0&&x<n-1&&z>=0&&z<n-1){
          const diagonal=-2*half+(x+z+1)*step;
          fan(clip(poly,3,diagonal,false));fan(clip(poly,3,diagonal,true));
        }else fan(poly);
      }
    }
    const indices=g.index?.array;
    for(let i=0;i<(indices?.length||p.count);i+=3)gridTriangle(read(indices?indices[i]:i),read(indices?indices[i+1]:i+1),read(indices?indices[i+2]:i+2),0);
    g.setIndex(null);
    names.forEach((name,j)=>g.setAttribute(name,new THREE.BufferAttribute(new attrs[j].array.constructor(out[j]),attrs[j].itemSize,attrs[j].normalized)));
    if(g.attributes.normal)g.computeVertexNormals();
    g.computeBoundingSphere();return g;
  }
  root.TerrainFit={refine,sample};
})(globalThis);
