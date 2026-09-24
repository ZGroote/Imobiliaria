/* Consome malhas avaliadas e exportadas pelo Blender.
   Fonte: modelar_castanheiras.py / castanheiras.blend. */
function montaCastanheiras(bl) {
  if(!bl.principal)return {};
  var asset=CASTANHEIRAS_BLENDER, geometrias={}, materiais={}, resultado={};
  Object.keys(asset.geometries).forEach(function(key){
    var dados=asset.geometries[key],g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(dados.position,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(dados.normal,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(dados.uv,2));
    if(dados.index)g.setIndex(dados.index);
    g.computeBoundingSphere();geometrias[key]=g;
  });
  Object.keys(asset.materials).forEach(function(key){
    var data=asset.materials[key],m=new THREE.MeshStandardMaterial({
      roughness:data.roughness,metalness:data.metalness,
      emissiveIntensity:data.emissiveIntensity,envMapIntensity:0.8});
    m.color.setRGB.apply(m.color,data.color);
    m.emissive.setRGB.apply(m.emissive,data.emissive);
    if(key==='MAT-reboco')m.setValues(reboco);
    if(key==='MAT-concreto')m.setValues(concreto);
    materiais[key]=m;
  });
  var o=new THREE.Object3D();
  asset.groups.forEach(function(group){
    var instances=group.instances.slice().sort((a,b)=>a.floor-b.floor);
    var mesh=new THREE.InstancedMesh(geometrias[group.geometry],materiais[group.material],instances.length);
    mesh.name='Blender / '+group.geometry+' / torre '+group.tower;
    instances.forEach(function(it,i){
      if(it.matrix)o.matrix.fromArray(it.matrix);
      else {o.position.fromArray(it.p);o.scale.fromArray(it.s);o.updateMatrix();}
      mesh.setMatrixAt(i,o.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    mesh.castShadow=mesh.receiveShadow=true;mesh.userData.tower=group.tower;predio.add(mesh);
    if(group.tower===0 && group.role==='lajes')resultado.lajes=mesh;
    if(group.tower===0 && group.role==='paredes')resultado.pars=mesh;
  });
  if(!resultado.lajes || !resultado.pars)throw Error('Exportacao Blender sem pavimentos selecionaveis');
  predio.userData.fonte=asset.source;
  return resultado;
}
