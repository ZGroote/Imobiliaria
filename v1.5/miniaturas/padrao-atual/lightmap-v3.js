// Upload exact RGBM bytes. Never pass packed alpha through browser image decoding.
async function loadRGBMBytes(url){
 var response=await fetch(url);if(!response.ok)throw Error('Lightmap '+response.status);
 var compressed=await response.arrayBuffer();
 var raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 var header=new DataView(raw);var width=header.getUint32(0,true),height=header.getUint32(4,true);
 if(!width||!height||width>8192||height>8192||raw.byteLength!==8+width*height*4)throw Error('Invalid RGBM payload');
 var map=new THREE.DataTexture(new Uint8Array(raw,8),width,height,THREE.RGBAFormat,THREE.UnsignedByteType);
 map.premultiplyAlpha=false;map.unpackAlignment=1;map.flipY=false;map.colorSpace=THREE.NoColorSpace;
 map.generateMipmaps=false;map.minFilter=map.magFilter=THREE.LinearFilter;map.needsUpdate=true;return map;
}
// Diffuse transport baked on these actual surfaces. Camera remains fully free.
var V3={started:false,ready:false,error:null,materials:[],disabled:false};
var v3PreviousFrame=aplicaEstudoV2;
var v3Status=document.createElement('div');v3Status.style.cssText='position:fixed;left:18px;top:18px;z-index:90;padding:9px 14px;border-radius:8px;background:#132622e8;color:#e3f1e7;font:13px system-ui;pointer-events:none';
v3Status.textContent='Preparando iluminação…';v3Status.hidden=true;document.body.appendChild(v3Status);
var v3Manifest=JSON.parse(document.getElementById('v3-data').textContent);
function v3Load(){
 V3.started=true;v3Status.hidden=false;
 Promise.all([
   v3Manifest.geometry?Promise.resolve(v3Manifest.geometry):fetch(v3Manifest.geometryURL).then(r=>{if(!r.ok)throw Error('Geometry '+r.status);return r.json();}),
   loadRGBMBytes(v3Manifest.texture)
 ]).then(([data,map])=>{
   // Packed RGBM must not use automatically averaged encoded mip levels.
   map.generateMipmaps=false;map.minFilter=THREE.LinearFilter;map.magFilter=THREE.LinearFilter;
   map.colorSpace=THREE.NoColorSpace;map.channel=1;map.flipY=false;map.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy());map.needsUpdate=true;
   var original=[];planta3d.traverse(o=>{if(o.isMesh)original.push(o);});
   var oldGeometries=new Set(original.map(o=>o.geometry));
   var cache=new Map();
   function bakedMaterial(m){
     if(!m.isMeshStandardMaterial)return m;
     if(cache.has(m))return cache.get(m);
     var n=m.clone();n.lightMap=map;n.lightMapIntensity=Math.PI;n.envMapIntensity=.35;
     // No second ambient diffuse contribution over the transported diffuse light.
     n.onBeforeCompile=shader=>{
       shader.uniforms.v3Active={value:V3.disabled?0:1};n.userData.shader=shader;
       shader.fragmentShader='uniform float v3Active;\n'+shader.fragmentShader;
       var chunk=THREE.ShaderChunk.lights_fragment_maps
         .replace('lightMapTexel.rgb * lightMapIntensity','(lightMapTexel.rgb * lightMapTexel.a * '+v3Manifest.range.toFixed(1)+') * lightMapIntensity')
         .replace('iblIrradiance += getIBLIrradiance( geometryNormal );','iblIrradiance += (1.0-v3Active)*getIBLIrradiance( geometryNormal );');
       shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',chunk);
     };
     n.customProgramCacheKey=()=> 'cedros-transport-v3';n.needsUpdate=true;cache.set(m,n);V3.materials.push(n);return n;
   }
   data.forEach(d=>{
     var old=original[d.slot];if(!old)throw Error('Missing mesh slot '+d.slot);
     if(d.correctedWorldMatrix){old.parent.updateMatrixWorld(true);var corrected=new THREE.Matrix4().fromArray(d.correctedWorldMatrix);corrected.premultiply(old.parent.matrixWorld.clone().invert());corrected.decompose(old.position,old.quaternion,old.scale);old.updateMatrixWorld(true);}
     if(old.geometry.attributes.position.count!==d.sourceVertexCount)throw Error('Mesh layout changed at slot '+d.slot);
     var g=new THREE.BufferGeometry();
     for(var k of ['position','normal','uv','color']){
       var src=k==='color'&&old.userData.geoPlanta?old.userData.geoPlanta.attributes.color:old.geometry.attributes[k];
       if(k==='position'&&d.correctedPosition)src=new THREE.Float32BufferAttribute(d.correctedPosition,3);
       if(!src)continue;var size=src.itemSize,a=new Float32Array(d.indices.length*size);
       d.indices.forEach((ix,i)=>{a[i*size]=src.getX(ix);a[i*size+1]=src.getY(ix);if(size===3)a[i*size+2]=src.getZ(ix);});g.setAttribute(k,new THREE.BufferAttribute(a,size));
     }
     g.setAttribute('uv1',new THREE.Float32BufferAttribute(d.uv1,2));
     // Match supplied normals to the corrected outward winding used for transport.
     var pp=g.attributes.position,nn=g.attributes.normal;
     if(nn){var aa=new THREE.Vector3(),bb=new THREE.Vector3(),cc=new THREE.Vector3(),normal=new THREE.Vector3();
       for(var i=0;i<pp.count;i+=3){aa.fromBufferAttribute(pp,i);bb.fromBufferAttribute(pp,i+1).sub(aa);cc.fromBufferAttribute(pp,i+2).sub(aa);normal.fromBufferAttribute(nn,i);
         if(bb.cross(cc).dot(normal)<0)for(var j=0;j<3;j++)nn.setXYZ(i+j,-nn.getX(i+j),-nn.getY(i+j),-nn.getZ(i+j));
       }
     }
     d.groups.forEach(a=>g.addGroup(a.start,a.count,a.materialIndex));g.computeBoundingSphere();g.computeBoundingBox();
     var mat=Array.isArray(old.material)?old.material.map(bakedMaterial):bakedMaterial(old.material);
     if(d.instance!==null){
       var o=new THREE.Mesh(g,mat),a=new THREE.Matrix4();old.getMatrixAt(d.instance,a);o.matrix.copy(old.matrix).multiply(a);o.matrix.decompose(o.position,o.quaternion,o.scale);old.parent.add(o);old.visible=false;
     }else{
       old.geometry=g;old.material=mat;old.userData.geoVisita=g;delete old.userData.geoPlanta;delete old.userData.materialVisita;
     }
   });
   original.forEach(o=>{if(o.name==='contact-occlusion')o.visible=false;});
   var retained=new Set();cena.traverse(o=>{if(o.isMesh)retained.add(o.geometry);});oldGeometries.forEach(g=>{if(!retained.has(g))g.dispose();});
   V3.layout=planta3d.children.filter(o=>o.userData.movel).map(o=>({o,p:o.position.toArray(),r:o.rotation.toArray(),s:o.scale.toArray()}));
   V3.ready=true;v3Status.textContent='Sala revisada';setTimeout(()=>{if(!V3.disabled)v3Status.hidden=true;},2500);
 }).catch(e=>{V3.error=String(e);v3Status.textContent='Não foi possível carregar a iluminação. Atualize a página.';console.error(e);});
}
aplicaEstudoV2=function(){
 v3PreviousFrame();
 var inside=modo==='visita'||modo==='planta3d';
 if(inside&&V2.floorTint&&!BK.BAKE.fila&&!V3.started)v3Load();
 if(!V3.ready)return;
 if(!V3.disabled){
   var current=planta3d.children.filter(o=>o.userData.movel);
   // The editor rebuilds objects on move/resize/remove: transforms on detached
   // originals never change. Compare membership as well as transforms.
   var changed=current.length!==V3.layout.length||V3.layout.some(({o,p,r,s})=>!current.includes(o)||o.position.toArray().some((v,i)=>Math.abs(v-p[i])>1e-5)||o.scale.toArray().some((v,i)=>Math.abs(v-s[i])>1e-5)||o.rotation.toArray().some((v,i)=>v!==r[i]));
   if(changed){V3.disabled=true;V2.mode=null;V3.materials.forEach(m=>{m.lightMapIntensity=0;if(m.userData.shader)m.userData.shader.uniforms.v3Active.value=0;});v3Status.hidden=false;v3Status.textContent='Layout alterado: iluminação dinâmica. Recarregue para voltar à cena calculada.';}
 }
 if(inside&&!V3.disabled){V2.lights.visible=false;cena.children.filter(o=>o.isLight).forEach(o=>o.intensity=0);}
};
window.__bakeV3=V3;
