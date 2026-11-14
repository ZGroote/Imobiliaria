/* Ilha de terreno para a implantação inferida do LIV. Dados fonte preservados. */
(function(root){
  'use strict';
  function create(options){
    var base=options.baseFit,center=options.center,angle=options.rotation||0;
    var transition=options.transitionMeters||12,step=options.stepMeters||5;
    var local=[[51.04,-39.585],[51.04,27.985],[43.5,35.525],[-36.54,49.445],[-36.54,-39.15]];
    var cs=Math.cos(angle),sn=Math.sin(angle);
    var polygon=local.map(p=>[center[0]+cs*p[0]+sn*p[1],center[1]-sn*p[0]+cs*p[1]]);
    var edges=polygon.map((p,i)=>{var q=polygon[(i+1)%polygon.length];return {a:p,dx:q[0]-p[0],dz:q[1]-p[1],length:Math.hypot(q[0]-p[0],q[1]-p[1])};});
    var bounds=[Math.min(...polygon.map(p=>p[0]))-transition*2,Math.min(...polygon.map(p=>p[1]))-transition*2,
      Math.max(...polygon.map(p=>p[0]))+transition*2,Math.max(...polygon.map(p=>p[1]))+transition*2];
    var lastGrid,lastN,lastHalf,centerRaw=0;
    var stats={transitionMeters:transition,stepMeters:step,refinedGeometries:0,cutTriangles:0,generatedTriangles:0,
      center:center.slice(),rotationRadians:angle,polygon:polygon,centerHeightMeters:0};
    function signed(edge,x,z){return (edge.dx*(z-edge.a[1])-edge.dz*(x-edge.a[0]))/edge.length;}
    function distance(x,z){
      var inside=true,dist=Infinity;
      for(var edge of edges){
        if(signed(edge,x,z)<-1e-6)inside=false;
        var t=Math.max(0,Math.min(1,((x-edge.a[0])*edge.dx+(z-edge.a[1])*edge.dz)/(edge.length*edge.length)));
        dist=Math.min(dist,Math.hypot(x-edge.a[0]-t*edge.dx,z-edge.a[1]-t*edge.dz));
      }
      return inside?0:dist;
    }
    function sample(grid,n,half,x,z){
      var original=base.sample(grid,n,half,x,z);
      if(grid!==lastGrid||n!==lastN||half!==lastHalf){
        lastGrid=grid;lastN=n;lastHalf=half;centerRaw=base.sample(grid,n,half,center[0],center[1]);
        stats.centerHeightMeters=centerRaw*(options.exaggeration||1);
      }
      if(x<bounds[0]||z<bounds[1]||x>bounds[2]||z>bounds[3])return original;
      var d=distance(x,z);
      if(d===0)return centerRaw;
      if(d>=transition)return original;
      var t=d/transition,s=t*t*(3-2*t);
      return centerRaw+(original-centerRaw)*s;
    }
    function refine(T,g,force){
      if(g.userData.livTerrainRefined||g.userData.dynamicHeight||g.userData.presetDY)return g;
      if(!force&&!g.userData.ground&&!g.userData.chaoDetalhe&&!g.attributes.aVia)return g;
      if(!g.boundingBox)g.computeBoundingBox();
      var box=g.boundingBox;
      if(box.max.x<bounds[0]||box.max.z<bounds[1]||box.min.x>bounds[2]||box.min.z>bounds[3])return g;
      var names=Object.keys(g.attributes).filter(n=>n!=='normal'),attrs=names.map(n=>g.attributes[n]);
      var offsets=[],stride=0;attrs.forEach(a=>{offsets.push(stride);stride+=a.itemSize;});
      var pi=offsets[names.indexOf('position')],out=names.map(()=>[]),pos=g.attributes.position;
      var idx=g.index&&g.index.array,total=idx?idx.length:pos.count,changed=0;
      function read(i){var v=[];for(var a of attrs)for(var k=0;k<a.itemSize;k++)v.push(a.array[i*a.itemSize+k]);return v;}
      function emit(a,b,c){for(var v of [a,b,c])for(var j=0;j<attrs.length;j++)for(var k=0;k<attrs[j].itemSize;k++)out[j].push(v[offsets[j]+k]);}
      function clip(poly,edge,margin,positive){
        var result=[];
        for(var j=0;j<poly.length;j++){
          var a=poly[j],b=poly[(j+1)%poly.length],da=(signed(edge,a[pi],a[pi+2])+margin)*(positive?1:-1),db=(signed(edge,b[pi],b[pi+2])+margin)*(positive?1:-1);
          if(da>=-1e-9)result.push(a);
          if((da<0&&db>0)||(da>0&&db<0)){var t=da/(da-db);result.push(a.map((v,k)=>v+(b[k]-v)*t));}
        }
        return result;
      }
      function partition(poly,margin){var outside=[];for(var edge of edges){var piece=clip(poly,edge,margin,false);if(piece.length>=3)outside.push(piece);poly=clip(poly,edge,margin,true);if(!poly.length)break;}return {inside:poly,outside:outside};}
      function small(a,b,c,depth){
        var verts=[a,b,c],lengths=verts.map((v,i)=>Math.hypot(v[pi]-verts[(i+1)%3][pi],v[pi+2]-verts[(i+1)%3][pi+2]));
        var longest=Math.max(...lengths);
        if(longest<=step||depth>=12){emit(a,b,c);return;}
        var i=lengths.indexOf(longest),u=verts[i],v=verts[(i+1)%3],w=verts[(i+2)%3],mid=u.map((x,k)=>(x+v[k])/2);
        small(u,mid,w,depth+1);small(mid,v,w,depth+1);
      }
      function fan(poly,dense){for(var i=1;i+1<poly.length;i++){if(dense)small(poly[0],poly[i],poly[i+1],0);else emit(poly[0],poly[i],poly[i+1]);}}
      for(var i=0;i<total;i+=3){
        var a=read(idx?idx[i]:i),b=read(idx?idx[i+1]:i+1),c=read(idx?idx[i+2]:i+2);
        var xs=[a[pi],b[pi],c[pi]],zs=[a[pi+2],b[pi+2],c[pi+2]];
        if(Math.max(...xs)<bounds[0]||Math.max(...zs)<bounds[1]||Math.min(...xs)>bounds[2]||Math.min(...zs)>bounds[3]){emit(a,b,c);continue;}
        var outer=partition([a,b,c],transition);
        if(outer.inside.length<3){emit(a,b,c);continue;}
        changed++;outer.outside.forEach(p=>fan(p,false));
        var inner=partition(outer.inside,0);
        fan(inner.inside,false);inner.outside.forEach(p=>fan(p,true));
      }
      if(!changed)return g;
      g.setIndex(null);names.forEach((name,j)=>g.setAttribute(name,new T.BufferAttribute(new attrs[j].array.constructor(out[j]),attrs[j].itemSize,attrs[j].normalized)));
      if(g.attributes.normal){g.deleteAttribute('normal');g.computeVertexNormals();}
      g.computeBoundingBox();g.computeBoundingSphere();
      g.userData.livTerrainRefined=true;stats.refinedGeometries++;stats.cutTriangles+=changed;stats.generatedTriangles+=g.attributes.position.count/3;
      return g;
    }
    return {sample:sample,refine:refine,diagnostics:()=>JSON.parse(JSON.stringify(stats)),
      sampleOriginal:(x,z)=>lastGrid?base.sample(lastGrid,lastN,lastHalf,x,z)*(options.exaggeration||1):0};
  }
  root.LivTerrain={create:create};
})(globalThis);
