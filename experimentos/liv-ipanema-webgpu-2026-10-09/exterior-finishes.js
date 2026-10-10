// Appearance calibration from the official balcony render. The RGBM proof keeps
// its original finish; the integrated viewer opts into this isolated profile.
export const FINISH_SOURCE_SHA256='89f552ec2c030afdcd1ab2167df78e6ff530bf40dd3e7c598d356b5582ebd919';
const FRAME_MESH='Blender / esquadrias-varandas-esquadria / torre 0';
const SOURCE_COLOR=[0.01850022003054619,0.02518685907125473,0.024157632142305374];
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
  const painted=source.clone();
  painted.name='LIV — esquadrias e guarda-corpos pintados';
  // These values are visual estimates, not a manufacturer specification.
  painted.metalness=0;painted.roughness=.55;painted.needsUpdate=true;
  painted.userData.livReferenceFinish='painted-frames-v1';
  // The source material is also used by the gate lettering. Clone only the tower
  // assignment so that lettering, source properties and baked surfaces stay intact.
  mesh.material=painted;materials.push(painted);
  return {profile:'referencia',revision:'painted-frames-v1',changes:[{
    mesh:mesh.name,sourceMaterialIndex,type:painted.type,
    metalness:painted.metalness,roughness:painted.roughness
  }]};
}
