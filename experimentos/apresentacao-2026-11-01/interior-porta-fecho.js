// A folha congelada começa 15 mm dentro da ombreira da dobradiça, mas fica
// 25 mm curta no trinco e 8 mm abaixo da travessa. Prolongue a própria madeira.
export function ajustarFolhaAoBatente(door,{marco=.03,sobreposicao=.015}={}){
  if(door.group?.userData.livDoorFit)return door.group.userData.livDoorFit;
  const {group,v,openAngle}=door;
  const parts=group?.children.filter(part=>part.geometry?.attributes?.position)||[];
  const leaves=parts.filter(part=>part.geometry.attributes.position.count===36);
  const leaf=leaves[0],handles=parts.filter(part=>part!==leaf);
  if(v?.tipo!=='giro'||!v.folha||!Number.isFinite(openAngle)||!Number.isFinite(v.L)||
    leaves.length!==1||handles.reduce((sum,part)=>sum+part.geometry.attributes.position.count,0)!==144||
    !(marco>sobreposicao&&sobreposicao>0))throw Error('Folha de giro incompatível com o ajuste do batente.');
  const position=leaf.geometry.attributes.position,ux=Math.cos(openAngle),uz=Math.sin(openAngle);
  let min=Infinity,max=-Infinity,bottom=Infinity,top=-Infinity;
  for(let i=0;i<position.count;i++){
    const along=position.getX(i)*ux+position.getZ(i)*uz;
    min=Math.min(min,along);max=Math.max(max,along);
    bottom=Math.min(bottom,position.getY(i));top=Math.max(top,position.getY(i));
  }
  const from=marco-sobreposicao,to=v.L-marco+sobreposicao,upper=v.y1-marco+sobreposicao;
  if(!(max-min>.1&&top-bottom>.1&&to>from&&upper>bottom))throw Error('Dimensões da folha inválidas.');
  const width=to-from,handleShift=to-max;
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i),along=x*ux+z*uz;
    const delta=from+(along-min)*width/(max-min)-along;
    position.setXYZ(i,x+ux*delta,bottom+(y-bottom)*(upper-bottom)/(top-bottom),z+uz*delta);
  }
  const changed=geometry=>{
    geometry.attributes.position.needsUpdate=true;
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
  };
  changed(leaf.geometry);
  // A ferragem conserva tamanho, altura e recuo em relação à borda do trinco.
  for(const part of handles){
    part.geometry.translate(ux*handleShift,0,uz*handleShift);changed(part.geometry);
  }
  v.folha.larg=to;
  const current=openAngle-group.rotation.y;
  v.folha.dx=Math.cos(current);v.folha.dz=Math.sin(current);
  const report={id:v.id,originalWidth:max-min,width,addedWidth:width-(max-min),
    originalTop:top,top:upper,addedHeight:upper-top,bottom,handleShift,
    hingeOverlap:marco-from,latchOverlap:to-(v.L-marco),topOverlap:upper-(v.y1-marco)};
  group.userData.livDoorFit=report;return report;
}
