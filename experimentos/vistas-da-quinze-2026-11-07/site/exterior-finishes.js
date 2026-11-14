// Appearance calibration from the official balcony render. The RGBM proof keeps
// its original finish; the integrated viewer opts into this isolated profile.
export const FINISH_SOURCE_SHA256='89f552ec2c030afdcd1ab2167df78e6ff530bf40dd3e7c598d356b5582ebd919';
const FRAME_MESH='Blender / esquadrias-varandas-esquadria / torre 0';
const SOURCE_COLOR=[0.01850022003054619,0.02518685907125473,0.024157632142305374];
const ENTRY_GLASS_MESH='Blender / SITE-implantacao-site-vidro / torre -1';
const LETTERING_MESH='Blender / LIV-IPANEMA-tipografia / torre -1';
const GLASS_COLOR=[0.040915198624134064,0.08228270709514618,0.07818742096424103];
const near=(a,b)=>Math.abs(a-b)<1e-6;

export function applyReferenceFinishes(meshes,materials,sourceModelSHA256) {
  if(sourceModelSHA256!==FINISH_SOURCE_SHA256)throw Error('O acabamento pertence a outra edição do modelo.');
  const targets=meshes.filter(mesh=>mesh.name===FRAME_MESH&&mesh.userData.tower===0);
  if(targets.length!==1)throw Error('A identificação das esquadrias da torre mudou.');
  const mesh=targets[0],source=mesh.material;
  const sourceMaterialIndex=materials.indexOf(source);
  // The exported material names are empty. Validate its semantic mesh and source
  // signature together, rather than silently editing an array index.
  if(sourceMaterialIndex<0||!source?.isMeshStandardMaterial||source.isNodeMaterial||
    source.userData.livBakedTransport||!near(source.metalness,1)||!near(source.roughness,.38)||
    !source.color.toArray().every((value,i)=>near(value,SOURCE_COLOR[i])))
    throw Error('O material original das esquadrias não corresponde à referência preservada.');
  const entryTargets=[
    {name:ENTRY_GLASS_MESH,color:GLASS_COLOR,metalness:.25,roughness:.16,label:'vidros da implantação',finish:'entry-glass-v1',roughnessAfter:.16},
    {name:LETTERING_MESH,color:SOURCE_COLOR,metalness:1,roughness:.38,label:'letreiro pintado',finish:'entry-lettering-v1',roughnessAfter:.65}
  ].map(spec=>{
    const matches=meshes.filter(target=>target.name===spec.name&&target.userData.tower===-1);
    if(matches.length!==1)throw Error('A identificação dos acabamentos do acesso mudou.');
    const target=matches[0],original=target.material,index=materials.indexOf(original);
    if(index<0||!original?.isMeshStandardMaterial||original.isNodeMaterial||original.userData.livBakedTransport||
      !near(original.metalness,spec.metalness)||!near(original.roughness,spec.roughness)||
      !original.color.toArray().every((value,i)=>near(value,spec.color[i])))
      throw Error('O material original do acesso não corresponde à referência preservada.');
    return {spec,target,original,index};
  });
  const painted=source.clone();
  painted.name='LIV — esquadrias e guarda-corpos pintados';
  // These values are visual estimates, not a manufacturer specification.
  painted.metalness=0;painted.roughness=.55;painted.needsUpdate=true;
  painted.userData.livReferenceFinish='painted-frames-v1';
  // The source material is also used by the gate lettering. Clone only the tower
  // assignment so its settings do not propagate to lettering or baked surfaces.
  mesh.material=painted;materials.push(painted);
  const changes=[{
    mesh:mesh.name,sourceMaterialIndex,type:painted.type,
    metalness:painted.metalness,roughness:painted.roughness
  }];
  // Dielectric glazing and painted lettering reuse the stock PBR path. The car
  // windows share the original glass material and must retain their assignment.
  for(const {spec,target,original,index} of entryTargets){
    const finish=original.clone();finish.name=`LIV — ${spec.label}`;
    finish.metalness=0;finish.roughness=spec.roughnessAfter;finish.needsUpdate=true;
    finish.userData.livReferenceFinish=spec.finish;
    target.material=finish;materials.push(finish);
    changes.push({mesh:target.name,sourceMaterialIndex:index,type:finish.type,metalness:finish.metalness,roughness:finish.roughness});
  }
  return {profile:'referencia',revision:'access-finishes-v1',changes};
}
