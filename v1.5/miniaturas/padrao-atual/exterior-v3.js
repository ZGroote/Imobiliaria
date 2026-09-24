// Baked exterior transport on the original building meshes, batched per material.
var EX={started:false,ready:false,error:null};window.__exteriorV3=EX;
var exManifest=JSON.parse(document.getElementById('exterior-data').textContent);
var exFrame=aplicaEstudoV2;
function exLoad(){
 EX.started=true;
 Promise.all([exManifest.geometry?Promise.resolve(exManifest.geometry):fetch(exManifest.geometryURL).then(r=>{if(!r.ok)throw Error('Exterior UV '+r.status);return r.json();}),loadRGBMBytes(exManifest.texture)]).then(([data,map])=>{
  map.colorSpace=THREE.NoColorSpace;map.channel=1;map.flipY=false;map.generateMipmaps=false;map.minFilter=map.magFilter=THREE.LinearFilter;map.needsUpdate=true;
  var originals=[];predio.traverse(o=>{if(o.isMesh)originals.push(o);});var materials=new Map(),buckets=new Map();
  function material(m){
   if(materials.has(m))return materials.get(m);
   var n=m.clone();n.lightMap=map;n.lightMapIntensity=Math.PI;n.envMap=ambientePBR;n.envMapIntensity=.45;
   n.onBeforeCompile=shader=>{
    var chunk=THREE.ShaderChunk.lights_fragment_maps.replace('lightMapTexel.rgb * lightMapIntensity','(lightMapTexel.rgb * lightMapTexel.a * '+exManifest.range.toFixed(1)+') * lightMapIntensity').replace('iblIrradiance += getIBLIrradiance( geometryNormal );','');
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',chunk).replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directDiffuse=vec3(0.0);');
   };n.customProgramCacheKey=()=> 'cedros-exterior-bake';n.needsUpdate=true;materials.set(m,n);return n;
  }
  data.forEach(d=>{if(!buckets.has(d.slot))buckets.set(d.slot,[]);buckets.get(d.slot).push(d);});
  buckets.forEach((items,slot)=>{
   var old=originals[slot];if(!old)throw Error('Exterior mesh missing '+slot);
   var merged={position:[],normal:[],uv:[],color:[],uv1:[]},groups=[],offset=0;
   items.forEach(d=>{
    if(old.geometry.attributes.position.count!==d.sourceVertexCount)throw Error('Exterior geometry mismatch');
    var g=new THREE.BufferGeometry();
    for(var key of ['position','normal','uv','color']){var src=old.geometry.attributes[key];if(!src)continue;var a=new Float32Array(d.indices.length*src.itemSize);d.indices.forEach((ix,i)=>{a[i*src.itemSize]=src.getX(ix);a[i*src.itemSize+1]=src.getY(ix);if(src.itemSize===3)a[i*3+2]=src.getZ(ix);});g.setAttribute(key,new THREE.BufferAttribute(a,src.itemSize));}
    if(d.instance!==null){var transform=new THREE.Matrix4();old.getMatrixAt(d.instance,transform);g.applyMatrix4(transform);}
    for(var key of ['position','normal','uv','color'])if(g.attributes[key])for(var v of g.attributes[key].array)merged[key].push(v);
    for(var v of d.uv1)merged.uv1.push(v);
    for(var gr of d.groups)groups.push({start:offset+gr.start,count:gr.count,materialIndex:gr.materialIndex});offset+=d.indices.length;g.dispose();
   });
   var g=new THREE.BufferGeometry();for(var key of Object.keys(merged))if(merged[key].length)g.setAttribute(key,new THREE.Float32BufferAttribute(merged[key],key==='uv'||key==='uv1'?2:3));
   // Each source batch has one material; a single group keeps original draw calls.
   if(Array.isArray(old.material))groups.forEach(gr=>g.addGroup(gr.start,gr.count,gr.materialIndex));
   g.computeBoundingSphere();g.computeBoundingBox();
   var mat=Array.isArray(old.material)?old.material.map(material):material(old.material);
   if(old.isInstancedMesh){var replacement=new THREE.Mesh(g,mat);replacement.name=old.name;replacement.userData={...old.userData};replacement.position.copy(old.position);replacement.quaternion.copy(old.quaternion);replacement.scale.copy(old.scale);replacement.visible=old.visible;replacement.castShadow=replacement.receiveShadow=true;old.parent.add(replacement);old.parent.remove(old);}else{old.geometry=g;old.material=mat;old.castShadow=old.receiveShadow=true;}
  });
  // Ground receives live shadows; architectural diffuse light is already baked.
  v2Ground.geometry.dispose();v2Ground.geometry=new THREE.BoxGeometry(1,1,1);v2Ground.rotation.set(0,0,0);
  v2Ground.material=new THREE.MeshStandardMaterial({color:0x34464a,roughness:1,metalness:0});v2Ground.receiveShadow=true;
  EX.ready=true;
 }).catch(e=>{EX.error=String(e);console.error(e);});
}
aplicaEstudoV2=function(){
 exFrame();
 if(modo!=='maquete')return;
 if(!EX.started)exLoad();
 if(!EX.ready)return;
 v2Ground.scale.set(conjuntoCompleto?88:42,.45,conjuntoCompleto?36:24);v2Ground.position.set(conjuntoCompleto?22:0,-.27,conjuntoCompleto?4:0);
 sol.position.set(-18,110,55);sol.target.position.set(22,25,0);sol.target.updateMatrixWorld(true);sol.intensity=2.5;
 var e=85;sol.shadow.camera.left=-e;sol.shadow.camera.right=e;sol.shadow.camera.top=e;sol.shadow.camera.bottom=-e;sol.shadow.camera.near=.5;sol.shadow.camera.far=260;sol.shadow.camera.updateProjectionMatrix();sol.shadow.normalBias=.035;sol.shadow.bias=-.00008;
 cena.children.filter(o=>o.isDirectionalLight&&o!==sol).forEach(o=>o.intensity=0);
 var hemi=cena.children.find(o=>o.isHemisphereLight);if(hemi)hemi.intensity=.7;
};
setTimeout(()=>{if(new URLSearchParams(location.search).get('conjunto')==='1'&&!conjuntoCompleto)document.getElementById('verConjunto').click();},0);
