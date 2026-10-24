import dados from './dados/maquete.js';
// Appearance calibration of named source meshes, from the property data (dados.acabamentos): which
// meshes, what their source material must be, and the finish that replaces it. The proof page keeps
// the original finish; the integrated viewer opts into this isolated profile.
const A=dados.acabamentos;
export const FINISH_SOURCE_SHA256=A?.modelo??null;
const near=(a,b)=>Math.abs(a-b)<1e-6;

export function applyReferenceFinishes(meshes,materials,sourceModelSHA256) {
  if(!A||sourceModelSHA256!==FINISH_SOURCE_SHA256)throw Error('O acabamento pertence a outra edição do modelo.');
  const P=A.pintura;
  const targets=meshes.filter(mesh=>mesh.name===P.malha&&mesh.userData.tower===P.torre);
  if(targets.length!==1)throw Error('A identificação das esquadrias da torre mudou.');
  const mesh=targets[0],source=mesh.material;
  const sourceMaterialIndex=materials.indexOf(source);
  // The exported material names are empty. Validate its semantic mesh and source
  // signature together, rather than silently editing an array index.
  if(sourceMaterialIndex<0||!source?.isMeshStandardMaterial||source.isNodeMaterial||
    source.userData.livBakedTransport||!near(source.metalness,P.metalness)||!near(source.roughness,P.roughness)||
    !source.color.toArray().every((value,i)=>near(value,P.cor[i])))
    throw Error('O material original das esquadrias não corresponde à referência preservada.');
  const entryTargets=A.acesso.map(spec=>{
    const matches=meshes.filter(target=>target.name===spec.malha&&target.userData.tower===spec.torre);
    if(matches.length!==1)throw Error('A identificação dos acabamentos do acesso mudou.');
    const target=matches[0],original=target.material,index=materials.indexOf(original);
    if(index<0||!original?.isMeshStandardMaterial||original.isNodeMaterial||original.userData.livBakedTransport||
      !near(original.metalness,spec.metalness)||!near(original.roughness,spec.roughness)||
      !original.color.toArray().every((value,i)=>near(value,spec.cor[i])))
      throw Error('O material original do acesso não corresponde à referência preservada.');
    return {spec,target,original,index};
  });
  const painted=source.clone();
  painted.name=P.nome;
  // These values are visual estimates, not a manufacturer specification.
  painted.metalness=P.metalnessDepois;painted.roughness=P.roughnessDepois;painted.needsUpdate=true;
  painted.userData.livReferenceFinish=P.acabamento;
  // The source material may be shared with other meshes. Clone only this assignment
  // so its settings do not propagate to them or to baked surfaces.
  mesh.material=painted;materials.push(painted);
  const changes=[{
    mesh:mesh.name,sourceMaterialIndex,type:painted.type,
    metalness:painted.metalness,roughness:painted.roughness
  }];
  // Dielectric glazing and painted lettering reuse the stock PBR path. Other meshes
  // sharing the original material retain their assignment.
  for(const {spec,target,original,index} of entryTargets){
    const finish=original.clone();finish.name=`${dados.nomeCurto} — ${spec.rotulo}`;
    finish.metalness=0;finish.roughness=spec.roughnessDepois;finish.needsUpdate=true;
    finish.userData.livReferenceFinish=spec.acabamento;
    target.material=finish;materials.push(finish);
    changes.push({mesh:target.name,sourceMaterialIndex:index,type:finish.type,metalness:finish.metalness,roughness:finish.roughness});
  }
  return {profile:'referencia',revision:'access-finishes-v1',changes};
}
