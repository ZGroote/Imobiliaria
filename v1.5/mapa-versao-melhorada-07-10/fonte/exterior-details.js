/* Blender-made details, pooled by model and bounded by distance/count on phones.
   Yard placements are verified offline. Original wall strips remain the far LOD. */
(function(root){
  'use strict';
  function create(THREE,pack,scene,{terrain,roadHit,coverageRadius=()=>1800,groundTexture,compact=false}){
    if(pack?.version!==1||pack.assets?.length!==65)throw Error('Biblioteca de exteriores inválida');
    const group=new THREE.Group();group.name='exteriores-blender';scene.add(group);
    const materials=[.82,.22].map(roughness=>new THREE.MeshStandardMaterial({vertexColors:true,roughness}));
    const assets=pack.assets.concat(pack.props||[]);
    const pools=new Map(),geometries=new Map(),wallGrid=new Map(),yardGrid=new Map();
    const settings=compact?{range:240,walls:840,yards:120}:{range:360,walls:1680,yards:240};
    const parcelCache=new WeakMap();let dataDirty=false;
    const atlas=new THREE.TextureLoader().load(pack.aerial.image);atlas.colorSpace=THREE.SRGBColorSpace;
    const aerialMaterial=new THREE.MeshBasicMaterial({map:atlas,alphaTest:.25,side:THREE.DoubleSide,toneMapped:false});
    aerialMaterial.onBeforeCompile=sh=>{
      sh.vertexShader='attribute vec4 aAtlas; attribute float aNear; varying float vNear;\n'+sh.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv=aAtlas.xy+vMapUv*aAtlas.zw;vNear=aNear;');
      sh.fragmentShader='varying float vNear;\n'+sh.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vNear>.5)discard;');
    };
    aerialMaterial.customProgramCacheKey=()=> 'exterior-aerial-atlas';
    let aerial=null,aerialCapacity=0,aerialCount=0,aerialLots=new Map(),groundAnchor=null,groundCount=0,groundTriangles=0,aerialBuilds=0;
    function aerialCapacityFor(count){
      if(aerial&&aerialCapacity>=count)return;
      if(aerial){scene.remove(aerial);aerial.geometry.dispose();aerial.dispose();}
      aerialCapacity=Math.max(1024,Math.ceil(count*1.25));
      const g=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
      g.setAttribute('aAtlas',new THREE.InstancedBufferAttribute(new Float32Array(aerialCapacity*4),4));
      g.setAttribute('aNear',new THREE.InstancedBufferAttribute(new Float32Array(aerialCapacity),1).setUsage(THREE.DynamicDrawUsage));
      aerial=new THREE.InstancedMesh(g,aerialMaterial,aerialCapacity);aerial.name='quintais-vista-aerea';aerial.frustumCulled=false;scene.add(aerial);
    }
    const groundMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
    if(groundTexture){
      groundMaterial.onBeforeCompile=sh=>{
        sh.uniforms.yardTexture={value:groundTexture};
        sh.vertexShader='varying vec2 yardXZ;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nyardXZ=position.xz;');
        sh.fragmentShader='varying vec2 yardXZ;\nuniform sampler2D yardTexture;\n'+sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=dot(texture2D(yardTexture,yardXZ*.25).rgb,vec3(.299,.587,.114))/.557;diffuseColor.rgb*=mix(1.0,grain,.28);');
      };
      groundMaterial.customProgramCacheKey=()=> 'quintal-terreno-inteiro';
    }
    const groundMesh=new THREE.Mesh(new THREE.BufferGeometry(),groundMaterial);groundMesh.name='quintais-area-livre';scene.add(groundMesh);
    const key=(x,z)=>Math.floor(x/80)+','+Math.floor(z/80);
    const index=(grid,item)=>{const k=key(item.x,item.z);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(item);};
    const tileInfo=pack.parcelTiles,tileKeys=new Set(tileInfo.keys),tiles=new Map();let tileErrors=0,retryAt=Infinity,disposed=false,activeRequests=0,fetchQueue=[];
    function pumpTiles(){
      while(!disposed&&activeRequests<(compact?4:6)&&fetchQueue.length){
        const {k,item}=fetchQueue.shift();if(tiles.get(k)!==item)continue;activeRequests++;
        fetch(new URL(tileInfo.prefix+k+'.bin',location.href)).then(async response=>{
          if(!response.ok)throw Error('Quintais HTTP '+response.status);
          const parcels=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
          if(disposed||tiles.get(k)!==item)return;
          item.parcels=parcels;for(const p of parcels)index(yardGrid,p);dataDirty=true;
        }).catch(error=>{
          if(disposed||tiles.get(k)!==item)return;
          tileErrors++;item.retryAt=Date.now()+Math.min(30000,1000*2**Math.min(item.attempt,5));retryAt=Math.min(retryAt,item.retryAt);last=null;console.warn('Nova tentativa de carregar quintais em breve:',error);
        }).finally(()=>{activeRequests--;pumpTiles();});
      }
    }
    function loadParcels(x,z,range){
      const size=tileInfo.size,needed=new Set();retryAt=Infinity;
      for(let tx=Math.floor((x-range)/size);tx<=Math.floor((x+range)/size);tx++)for(let tz=Math.floor((z-range)/size);tz<=Math.floor((z+range)/size);tz++){
        const k=tx+'_'+tz;if(!tileKeys.has(k)||Math.hypot((tx+.5)*size-x,(tz+.5)*size-z)>range+size*.71)continue;needed.add(k);
        const previous=tiles.get(k);
        if(previous){
          tiles.delete(k);tiles.set(k,previous);
          if(!previous.retryAt||Date.now()<previous.retryAt){retryAt=Math.min(retryAt,previous.retryAt||Infinity);continue;}
        }
        const item={parcels:null,attempt:(previous?.attempt||0)+1};tiles.set(k,item);
        fetchQueue.push({k,item});
      }
      let evicted=false;
      for(const k of tiles.keys()){if(!needed.has(k)){tiles.delete(k);evicted=true;}}
      if(evicted){yardGrid.clear();for(const item of tiles.values())for(const p of item.parcels||[])index(yardGrid,p);}
      fetchQueue=fetchQueue.filter(v=>tiles.get(v.k)===v.item).sort((a,b)=>{const d=k=>{const [tx,tz]=k.split('_').map(Number);return Math.hypot((tx+.5)*size-x,(tz+.5)*size-z);};return d(a.k)-d(b.k);});pumpTiles();
    }
    const decode=(s,T)=>new T(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
    const palette=pack.palette.map(hex=>{const c=new THREE.Color('#'+hex);if(!THREE.ColorManagement?.enabled)c.convertSRGBToLinear();return [c.r,c.g,c.b];});
    function parcelData(p){
      if(parcelCache.has(p))return parcelCache.get(p);
      const gp=decode(p.gp,Int32Array),gc=decode(p.gc,Uint8Array),positions=new Float32Array(gp.length/2*3),colors=new Float32Array(positions.length);
      for(let j=0;j<gp.length;j+=2){const i=j/2*3,x=p.x+gp[j]/1000,z=p.z+gp[j+1]/1000;positions.set([x,terrain(x,z),z],i);colors.set(palette[gc[Math.floor(j/6)]],i);}
      const g=new THREE.BufferGeometry();
      // Refine the yard surface with the same tolerance as asphalt and block ground.
      for(let j=1;j<positions.length;j+=3)positions[j]=0;
      g.setAttribute('position',new THREE.BufferAttribute(positions,3));
      g.setAttribute('color',new THREE.BufferAttribute(colors,3));
      TerrainFit.refine(THREE,g,terrain);
      const fitted=g.attributes.position.array;
      for(let j=0;j<fitted.length;j+=3)fitted[j+1]=terrain(fitted[j],fitted[j+2]);
      const value={positions:fitted,colors:g.attributes.color.array,props:decode(p.pp,Int32Array)};
      g.dispose();parcelCache.set(p,value);return value;
    }
    function geometry(i){
      if(geometries.has(i))return geometries.get(i);
      const a=assets[i],p=decode(a.p,Int16Array),n=decode(a.n,Int8Array),c=decode(a.c,Uint8Array),idx=decode(a.i,Uint16Array);
      if(p.length!==n.length||p.length!==c.length||p.length%3||idx.length%3||idx.some(v=>v>=p.length/3))throw Error('Buffer de exterior inválido: '+a.id);
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(Float32Array.from(p,v=>v/pack.quantization),3));
      g.setAttribute('normal',new THREE.BufferAttribute(Float32Array.from(n,v=>v/127),3));
      g.setAttribute('color',new THREE.BufferAttribute(c,3,true));g.setIndex(new THREE.BufferAttribute(idx,1));
      for(const gr of a.groups)g.addGroup(gr.start,gr.count,gr.material);
      g.computeBoundingBox();g.computeBoundingSphere();geometries.set(i,g);return g;
    }
    // Fail before replacing any wall if one model is damaged.
    assets.forEach((_,i)=>geometry(i));
    const scratch=new THREE.Object3D();let wallAttribute=null,hidden=[],last=null,lastTime=-1e9;
    let counts={walls:0,yards:0,wallSegments:0,triangles:0,drawCalls:0};
    function restoreWalls(){
      if(wallAttribute&&hidden.length){
        wallAttribute.clearUpdateRanges();
        for(const w of hidden){wallAttribute.array.fill(0,w.vertex,w.vertex+6);wallAttribute.addUpdateRange(w.vertex,6);}
        wallAttribute.needsUpdate=true;
      }
      hidden=[];
    }
    function walls(segments,attribute,coarseColor){
      restoreWalls();wallGrid.clear();wallAttribute=attribute;last=null;
      const wallColors=pack.assets.slice(0,25).map(a=>decode(a.c,Uint8Array).slice(0,3));
      for(const w of segments){
        index(wallGrid,{...w,x:(w.ax+w.bx)/2,z:(w.az+w.bz)/2});
        if(coarseColor){const c=wallColors[(Math.imul(w.seed+1,2654435761)>>>0)%25];for(let j=w.vertex;j<w.vertex+6;j++)coarseColor.array.set(c,j*3);}
      }
      if(coarseColor)coarseColor.needsUpdate=true;
    }
    function candidates(grid,x,z,r){
      const out=[];const n=Math.ceil(r/80)+1,cx=Math.floor(x/80),cz=Math.floor(z/80);
      for(let dx=-n;dx<=n;dx++)for(let dz=-n;dz<=n;dz++)
        for(const p of grid.get((cx+dx)+','+(cz+dz))||[]){const d=Math.hypot(p.x-x,p.z-z);if(d<r)out.push({p,d});}
      // Interleave distance bands so the instance cap also reaches the outer region.
      const bands=[[],[],[]];for(const entry of out.sort((a,b)=>a.d-b.d))bands[Math.min(2,Math.floor(entry.d/r*3))].push(entry);
      const result=[];for(let i=0;i<Math.max(...bands.map(b=>b.length));i++)for(const band of bands)if(band[i])result.push(band[i]);return result;
    }
    function add(i,x,z,theta,sx,base,relief,slopeX=0,slopeZ=0,sz=1){
      i=assets[i].shared??i;
      let pool=pools.get(i);
      if(!pool){pool={mesh:null,count:0,capacity:0};pools.set(i,pool);}
      if(pool.count===pool.capacity){
        const old=pool.mesh,capacity=Math.max(16,pool.capacity*2),mesh=new THREE.InstancedMesh(geometry(i),materials,capacity);
        mesh.name='exterior-'+assets[i].id;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        if(old){mesh.instanceMatrix.array.set(old.instanceMatrix.array);group.remove(old);old.dispose();}
        pool.mesh=mesh;pool.capacity=capacity;group.add(mesh);
      }
      scratch.position.set(x,base*relief+.035,z);scratch.rotation.set(0,theta,0);scratch.scale.set(sx,1,sz);scratch.updateMatrix();
      scratch.matrix.elements[1]=slopeX*relief;scratch.matrix.elements[9]=slopeZ*relief;
      pool.mesh.setMatrixAt(pool.count++,scratch.matrix);
      counts.triangles+=assets[i].triangles;
    }
    function update(x,z,radius,relief,inside,time,force=false){
      // Camera distance no longer discards detailed walls. Bound work spatially instead.
      const enabled=!inside,coverage=coverageRadius();
      if(!force&&(!dataDirty||!enabled)&&Date.now()<retryAt&&last&&last.coverage===coverage&&last.enabled===enabled&&last.relief===relief&&Math.hypot(x-last.x,z-last.z)<18)return;
      if(!force&&time-lastTime<450&&last?.enabled===enabled&&last?.relief===relief)return;
      // Batch the city-wide mesh once the region finishes loading, not per response.
      const rebuildAerial=!groundAnchor||groundAnchor.relief!==relief||groundAnchor.coverage!==coverage||Math.hypot(x-groundAnchor.x,z-groundAnchor.z)>80||(dataDirty&&fetchQueue.length===0&&activeRequests===0);
      lastTime=time;last={x,z,relief,enabled,coverage};restoreWalls();
      for(const p of pools.values())p.count=0;
      counts={walls:0,yards:0,wallSegments:0,triangles:0,drawCalls:0,groundParcels:0,props:0,wallReach:0,yardReach:0};
      let groundPositions=null,groundColors=null,groundUsed=0;
      const nearLots=new Set();
      if(enabled){
        const {range,walls:wallLimit,yards:yardLimit}=settings;
        loadParcels(x,z,coverage+160);
        for(const {p:w} of candidates(wallGrid,x,z,range)){
          const dx=w.bx-w.ax,dz=w.bz-w.az,len=Math.hypot(dx,dz);
          if(len<1.4)continue;
          const n=Math.ceil(len/3.2);if(counts.walls+n>wallLimit)continue;
          const half=.39,corners=[[w.ax-dz/len*half,w.az+dx/len*half],[w.bx-dz/len*half,w.bz+dx/len*half],[w.bx+dz/len*half,w.bz-dx/len*half],[w.ax+dz/len*half,w.az-dx/len*half]];
          if(roadHit(corners))continue;
          const ai=((Math.imul(w.seed+1,2654435761)>>>0)%25),a=pack.assets[ai],theta=Math.atan2(-dz,dx),sx=len/n/a.size[0];
          for(let j=0;j<n;j++){
            const t=(j+.5)/n;
            add(ai,w.ax+dx*t,w.az+dz*t,theta,sx,w.da+(w.db-w.da)*t,relief,(w.db-w.da)/len*sx);
          }
          wallAttribute.array.fill(1,w.vertex,w.vertex+6);wallAttribute.addUpdateRange(w.vertex,6);hidden.push(w);
          counts.walls+=n;counts.wallSegments++;
          counts.wallReach=Math.max(counts.wallReach,Math.hypot(w.x-x,w.z-z));
        }
        if(hidden.length)wallAttribute.needsUpdate=true;
        const parcels=candidates(yardGrid,x,z,rebuildAerial?coverage+160:range);
        if(rebuildAerial){
          aerialCapacityFor(parcels.reduce((n,{p})=>n+parcelData(p).props.length/6,0));aerialCount=0;aerialLots.clear();groundCount=0;
          const length=parcels.reduce((n,{p})=>n+parcelData(p).positions.length,0),g=groundMesh.geometry;
          if(!g.attributes.position||g.attributes.position.array.length<length){
            g.dispose();groundMesh.geometry=new THREE.BufferGeometry();const capacity=Math.max(9,Math.ceil(length*1.25/9)*9);
            for(const name of ['position','color','normal'])groundMesh.geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(capacity),3).setUsage(THREE.DynamicDrawUsage));
          }
          groundPositions=groundMesh.geometry.attributes.position.array;groundColors=groundMesh.geometry.attributes.color.array;
        }
        for(const {p} of parcels){
          const cached=parcelData(p);
          if(rebuildAerial){
            for(let j=0;j<cached.positions.length;j+=3){
              groundPositions[groundUsed]=cached.positions[j];groundPositions[groundUsed+1]=cached.positions[j+1]*relief+.026;groundPositions[groundUsed+2]=cached.positions[j+2];
              groundColors[groundUsed]=cached.colors[j];groundColors[groundUsed+1]=cached.colors[j+1];groundColors[groundUsed+2]=cached.colors[j+2];groundUsed+=3;
            }
            groundCount++;const start=aerialCount;
            for(let j=0;j<cached.props.length;j+=6){
              const pp=cached.props,ai=pp[j]-65,px=pp[j+1]/1000,pz=pp[j+2]/1000,theta=pp[j+3]/1e6,span=pack.aerial.spans[ai];
              scratch.position.set(px,terrain(px,pz)*relief+.055,pz);scratch.rotation.set(0,theta,0);scratch.scale.set(span*pp[j+4]/1e6,1,span*pp[j+5]/1e6);scratch.updateMatrix();
              if(relief){
                const c=Math.cos(theta),s=Math.sin(theta),w=scratch.scale.x,d=scratch.scale.z;
                scratch.matrix.elements[1]=(terrain(px+c*w/2,pz-s*w/2)-terrain(px-c*w/2,pz+s*w/2))*relief;
                scratch.matrix.elements[9]=(terrain(px+s*d/2,pz+c*d/2)-terrain(px-s*d/2,pz-c*d/2))*relief;
              }
              aerial.setMatrixAt(aerialCount,scratch.matrix);aerial.geometry.attributes.aAtlas.setXYZW(aerialCount,(ai%16)/16,Math.floor(ai/16)/10,1/16,1/10);aerialCount++;
            }
            aerialLots.set(p.lot,[start,aerialCount]);
          }
          if(counts.yards>=yardLimit||Math.hypot(p.x-x,p.z-z)>range)continue;
          const pp=cached.props;
          for(let j=0;j<pp.length;j+=6){
            const ai=pp[j],px=pp[j+1]/1000,pz=pp[j+2]/1000,theta=pp[j+3]/1e6,sx=pp[j+4]/1e6,sz=pp[j+5]/1e6;
            const a=assets[ai],c=Math.cos(theta),s=Math.sin(theta),w=a.size[0]*sx,d=a.size[2]*sz;
            const tx=terrain(px+c*w/2,pz-s*w/2)-terrain(px-c*w/2,pz+s*w/2);
            const tz=terrain(px+s*d/2,pz+c*d/2)-terrain(px-s*d/2,pz-c*d/2);
            add(ai,px,pz,theta,sx,terrain(px,pz),relief,tx/a.size[0],tz/a.size[2],sz);counts.props++;
          }
          if(pp.length){nearLots.add(p.lot);counts.yards++;counts.yardReach=Math.max(counts.yardReach,Math.hypot(p.x-x,p.z-z));}
        }
      }
      if(enabled&&rebuildAerial){
        dataDirty=false;
        groundAnchor={x,z,relief,coverage};groundTriangles=groundUsed/9;aerialBuilds++;
        aerial.count=aerialCount;aerial.instanceMatrix.needsUpdate=true;aerial.geometry.attributes.aAtlas.needsUpdate=true;
        const geometry=groundMesh.geometry;
        if(geometry.attributes.position){geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;geometry.setDrawRange(0,groundUsed/3);geometry.computeVertexNormals();geometry.computeBoundingSphere();}
      }
      groundMesh.visible=enabled&&groundCount>0;
      if(aerial){aerial.visible=enabled&&aerialCount>0;const near=aerial.geometry.attributes.aNear;near.array.fill(0);for(const lot of nearLots){const span=aerialLots.get(lot);if(span)near.array.fill(1,span[0],span[1]);}near.needsUpdate=true;}
      if(enabled){counts.groundParcels=groundCount;counts.aerialProps=aerialCount;counts.triangles+=groundTriangles+aerialCount*2;counts.drawCalls+=(groundCount?1:0)+(aerialCount?1:0);}
      for(const [i,p] of pools){p.mesh.count=p.count;p.mesh.visible=p.count>0;if(p.count){p.mesh.instanceMatrix.needsUpdate=true;p.mesh.computeBoundingSphere();counts.drawCalls+=assets[i].groups.length;}}
    }
    return {walls,update,stats:()=>({...counts,range:settings.range,coverage:coverageRadius(),aerialBuilds,tileSize:tileInfo.size,pendingTiles:fetchQueue.length+activeRequests,models:65,placedYards:tileInfo.parcels,loadedTiles:tiles.size,tileErrors}),
      sample:()=> (pack.placements||[]).slice(0,5),placements:()=>pack.placements,
      reset(){restoreWalls();groundMesh.visible=false;if(aerial)aerial.visible=false;groundAnchor=null;for(const p of pools.values()){p.count=0;p.mesh.count=0;}last=null;},
      dispose(){disposed=true;fetchQueue=[];if(aerial){scene.remove(aerial);aerial.geometry.dispose();aerial.dispose();}atlas.dispose();aerialMaterial.dispose();restoreWalls();group.removeFromParent();groundMesh.removeFromParent();groundMesh.geometry.dispose();groundMaterial.dispose();for(const p of pools.values())p.mesh.dispose();for(const g of geometries.values())g.dispose();materials.forEach(m=>m.dispose());}};
  }
  root.ExteriorDetails={create};
})(globalThis);
