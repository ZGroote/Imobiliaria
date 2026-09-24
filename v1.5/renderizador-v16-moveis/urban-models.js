/* Shared exterior assets. No city data, UI, or networking in this module.
   Mount/unmount follow the existing block streaming lifetime. */
(function(root){
  'use strict';
  const hash=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;};
  function inside(x,z,ring){
    let yes=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[j],b=ring[i];
      if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
    }
    return yes;
  }
  function containsRectangle(corners,ring){
    if(!corners.every(p=>inside(p[0],p[1],ring)))return false;
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    // Checking intersections also catches concave notches between the corners.
    for(let i=0;i<4;i++)for(let j=0;j<ring.length;j++){
      const a=corners[i],b=corners[(i+1)%4],c=ring[j],d=ring[(j+1)%ring.length];
      if(cross(a,b,c)*cross(a,b,d)<-1e-9&&cross(c,d,a)*cross(c,d,b)<-1e-9)return false;
    }
    return true;
  }
  function select(assets,b,ob,ring,category,neighbors=[]){
    if(b.lancamento||b.parede!=null||b.sacadas||!category)return null;
    // The build checked this full-size envelope against its lot, actual walls,
    // roads and neighboring buildings. No stretching of architectural details.
    if(b.urbanLot){
      const [index,x,z,theta]=b.urbanLot,a=assets[index];
      if(a&&a.category===category&&[x,z,theta].every(Number.isFinite)){
        const front=[Math.sin(theta),Math.cos(theta)],right=[front[1],-front[0]];
        const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[
          x+right[0]*u*a.size[0]/2+front[0]*v*a.size[2]/2,
          z+right[1]*u*a.size[0]/2+front[1]*v*a.size[2]/2]);
        return {asset:a,scale:1,theta,x,z,corners,score:1,lotFit:true};
      }
    }
    // Exact containment below also accepts valid space in irregular footprints.
    const seed=hash((Math.round(ob.cx*10)*73856093)^(Math.round(ob.cz*10)*19349663));
    const axes=[[ob.ux,ob.uz],[-ob.ux,-ob.uz],[-ob.uz,ob.ux],[ob.uz,-ob.ux]];
    const known=Number.isFinite(b.fa)&&b.fa>=0&&b.fa<=360;
    const desired=known?[Math.cos(b.fa*Math.PI/180),Math.sin(b.fa*Math.PI/180)]:axes[seed%2];
    const preferred=axes.reduce((a,v)=>v[0]*desired[0]+v[1]*desired[1]>a[0]*desired[0]+a[1]*desired[1]?v:a,axes[0]);
    const options=[];
    for(const front of known?[preferred]:[preferred,[-preferred[1],preferred[0]]]){
    const right=[front[1],-front[0]],theta=Math.atan2(front[0],front[1]);
    const longFront=Math.abs(front[0]*ob.ux+front[1]*ob.uz)>.5;
    const width=2*(longFront?ob.hv:ob.hu),depth=2*(longFront?ob.hu:ob.hv);
    for(const a of assets){
      if(a.category!==category)continue;
      // Existing footprints without verified lot space keep a tight size range.
      const scale=Math.min(category==='predios'?1.15:1.05,(width-.12)/a.size[0],(depth-.12)/a.size[2]);
      if(scale<(category==='predios'?.8:.95)||a.size[1]*scale<b.h*.65||a.size[1]*scale>b.h*1.4)continue;
      if(category==='predios'&&(scale<.8||Math.abs(a.size[1]*scale/b.h-1)>.2))continue;
      const hw=a.size[0]*scale/2,hd=a.size[2]*scale/2;
      // Concave footprints can have usable space away from the OBB centre.
      // Translate the intact model inside that same footprint; never stretch it.
      const dx=Math.max(0,(width/2-hw-.06)*.9),dz=Math.max(0,(depth/2-hd-.06)*.9);
      const offsets=[[0,0],[-dx,0],[dx,0],[0,-dz],[0,dz],[-dx,-dz],[dx,-dz],[-dx,dz],[dx,dz]];
      for(const [ox,oz] of offsets){
        const x=ob.cx+right[0]*ox+front[0]*oz,z=ob.cz+right[1]*ox+front[1]*oz;
        const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[
          x+right[0]*u*hw+front[0]*v*hd,z+right[1]*u*hw+front[1]*v*hd]);
        if(!containsRectangle(corners,ring))continue;
        options.push({asset:a,scale,theta,x,z,corners,
          score:a.size[0]*a.size[2]*scale*scale/(width*depth)});
        break;
      }
    }
    }
    if(!options.length)return null;
    options.sort((a,b)=>b.score-a.score||a.asset.id.localeCompare(b.asset.id));
    const best=options.filter(a=>a.score>=options[0].score*.8).slice(0,8);
    // Prefer compatible variants not already used nearby in this block. The
    // caller visits a stable spatial order, independent of streaming order.
    const usage=a=>neighbors.reduce((n,s)=>n+(s.asset.id===a.asset.id&&
      Math.hypot(s.x-ob.cx,s.z-ob.cz)<80?1:0),0);
    const least=Math.min(...best.map(usage));
    const varied=best.filter(a=>usage(a)===least);
    return varied[seed%varied.length];
  }
  function create(THREE,pack,parent,{cut,shadows=false,terrain}={}){
    if(!pack||pack.version!==1||pack.lod!==1||!Array.isArray(pack.assets)||pack.assets.length<40)throw new Error('Invalid urban asset pack');
    const ids=new Set();
    for(const a of pack.assets){
      if(ids.has(a.id)||!['casas','sobrados','predios'].includes(a.category)||!a.size?.every(v=>Number.isFinite(v)&&v>0))throw new Error('Invalid urban model');
      ids.add(a.id);
    }
    const pools=new Map(),geo=new Map(),dirty=new Set();let relief=0,height=1;
    const materials=[.77,.24].map(roughness=>{
      const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness});
      if(cut){
        m.onBeforeCompile=shader=>{
          shader.uniforms.uUrbanCut=cut;
          shader.vertexShader='varying vec3 vUrbanWorld;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',
            '#include <project_vertex>\nvUrbanWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;');
          shader.fragmentShader='uniform vec4 uUrbanCut;\nvarying vec3 vUrbanWorld;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',
            '#include <clipping_planes_fragment>\nif(uUrbanCut.z>0.0 && vUrbanWorld.y>uUrbanCut.w && distance(vUrbanWorld.xz,uUrbanCut.xy)<uUrbanCut.z) discard;');
        };
        m.customProgramCacheKey=()=> 'urban-exterior-cut-v1';
      }
      return m;
    });
    const decoded=(s,Type)=>{const bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return new Type(bytes.buffer);};
    function geometry(a){
      if(geo.has(a.id))return geo.get(a.id);
      const p=decoded(a.p,Int16Array),n=decoded(a.n,Int8Array),c=decoded(a.c,Uint8Array),idx=decoded(a.i,Uint16Array);
      if(p.length%3||n.length!==p.length||c.length!==p.length||idx.length%3||idx.some(i=>i>=p.length/3))throw new Error('Invalid buffers: '+a.id);
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(Float32Array.from(p,x=>x/100),3));
      g.setAttribute('normal',new THREE.BufferAttribute(Float32Array.from(n,x=>x/127),3));
      g.setAttribute('color',new THREE.BufferAttribute(c,3,true));g.setIndex(new THREE.BufferAttribute(idx,1));
      for(const group of a.groups)g.addGroup(group.start,group.count,group.material);
      g.computeBoundingBox();g.computeBoundingSphere();geo.set(a.id,g);return g;
    }
    // Validate all buffers once: a damaged pack falls back before any block mounts.
    for(const a of pack.assets)geometry(a);
    const foundationGeometry=new THREE.BoxGeometry(1,1,1).translate(0,-.5,0);
    const foundationMaterial=new THREE.MeshStandardMaterial({color:0x706b60,roughness:1});
    const scratch=new THREE.Object3D();
    function support(slot,sample=terrain){
      if(!sample){slot.low=slot.base;return;}
      const points=[...slot.corners,[slot.x,slot.z]];
      for(let i=0;i<4;i++)points.push([(slot.corners[i][0]+slot.corners[(i+1)%4][0])/2,
        (slot.corners[i][1]+slot.corners[(i+1)%4][1])/2]);
      const levels=points.map(p=>sample(slot.record,p[0],p[1]));
      slot.base=Math.max(...levels);slot.low=Math.min(...levels);
    }
    function foundationMatrix(slot){
      const a=slot.asset;
      scratch.position.set(slot.x,slot.base*relief,slot.z);scratch.rotation.set(0,slot.theta,0);
      scratch.scale.set(a.size[0]*slot.scale,Math.max(.08,(slot.base-slot.low)*relief+.08),a.size[2]*slot.scale);
      scratch.updateMatrix();return scratch.matrix;
    }
    function write(pool,index,slot){
      pool.mesh.setMatrixAt(index,matrix(slot));pool.foundation.setMatrixAt(index,foundationMatrix(slot));
    }
    function matrix(slot){
      scratch.position.set(slot.x,slot.base*relief,slot.z);scratch.rotation.set(0,slot.theta,0);
      scratch.scale.set(slot.scale,slot.scale*height,slot.scale);scratch.updateMatrix();return scratch.matrix;
    }
    function resize(pool,capacity){
      const previous=pool.mesh,previousFoundation=pool.foundation;
      const mesh=new THREE.InstancedMesh(geometry(pool.asset),materials,capacity);
      mesh.name='urban-'+pool.asset.id;mesh.count=pool.slots.length;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.urbanPool=pool;mesh.castShadow=false;mesh.receiveShadow=shadows;
      const foundation=new THREE.InstancedMesh(foundationGeometry,foundationMaterial,capacity);
      foundation.name='urban-foundation-'+pool.asset.id;foundation.count=pool.slots.length;
      foundation.instanceMatrix.setUsage(THREE.DynamicDrawUsage);foundation.userData.urbanPool=pool;
      foundation.receiveShadow=shadows;
      pool.foundation=foundation;pool.mesh=mesh;
      for(let j=0;j<pool.slots.length;j++)write(pool,j,pool.slots[j]);
      if(previous){parent.remove(previous,previousFoundation);previous.dispose();previousFoundation.dispose();}
      pool.mesh=mesh;pool.capacity=capacity;parent.add(mesh,foundation);dirty.add(pool);
    }
    function add(chosen,record,base){
      let pool=pools.get(chosen.asset.id);
      if(!pool){pool={asset:chosen.asset,slots:[],mesh:null,capacity:0};pools.set(chosen.asset.id,pool);}
      if(pool.slots.length===pool.capacity)resize(pool,Math.max(32,pool.capacity*2));
      const slot={...chosen,record,base,pool,index:pool.slots.length,alive:true};
      support(slot);pool.slots.push(slot);write(pool,slot.index,slot);pool.mesh.count=pool.foundation.count=pool.slots.length;dirty.add(pool);
      return slot;
    }
    function remove(slot){
      if(!slot||!slot.alive)return;
      const p=slot.pool,last=p.slots.pop();slot.alive=false;
      if(last!==slot){p.slots[slot.index]=last;last.index=slot.index;write(p,last.index,last);}
      p.mesh.count=p.foundation.count=p.slots.length;dirty.add(p);
    }
    function flush(){
      for(const p of dirty)for(const mesh of [p.mesh,p.foundation]){mesh.instanceMatrix.needsUpdate=true;mesh.visible=p.slots.length>0;if(p.slots.length)mesh.computeBoundingSphere();}
      dirty.clear();
    }
    function transform(r,h,terrain){
      relief=r;height=h;
      for(const p of pools.values()){
        for(const s of p.slots){
          if(terrain)support(s,terrain);
          write(p,s.index,s);
        }
        dirty.add(p);
      }
      flush();
    }
    function clear(){
      for(const p of pools.values()){for(const s of p.slots)s.alive=false;parent.remove(p.mesh,p.foundation);p.mesh.dispose();p.foundation.dispose();}
      pools.clear();dirty.clear();
    }
    return {select:(...args)=>select(pack.assets,...args),add,remove,flush,transform,clear,
      hit:hit=>hit.object.userData.urbanPool?.slots[hit.instanceId]?.record||null,
      stats:()=>({enabled:true,models:pack.assets.length,pools:pools.size,instances:[...pools.values()].reduce((n,p)=>n+p.slots.length,0),
        categories:Object.fromEntries(['casas','sobrados','predios'].map(c=>[c,[...pools.values()].filter(p=>p.asset.category===c).reduce((n,p)=>n+p.slots.length,0)])),
        drawCalls:[...pools.values()].reduce((n,p)=>n+(p.slots.length?p.asset.groups.length+1:0),0)}),
      sample:()=>[...pools.values()].flatMap(p=>p.slots.slice(0,2).map(s=>({id:p.asset.id,x:s.x,z:s.z,base:s.base,scale:s.scale,theta:s.theta}))),
      dispose(){clear();for(const g of geo.values())g.dispose();geo.clear();foundationGeometry.dispose();foundationMaterial.dispose();for(const m of materials)m.dispose();}};
  }
  root.UrbanModels={create,select,containsRectangle};
})(globalThis);
