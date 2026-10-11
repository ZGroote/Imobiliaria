import {containsPoint,validFootprint} from './unit-footprint.js';
// Technical pilot records are independent of the decorative meshes and interiors.
export function validateUnits(data) {
  const fail=()=>{throw Error('Cadastro do pavimento piloto inválido.');};
  const contour=data?.schema==='liv-pilot-units-v2';
  if(!['liv-pilot-units-v1','liv-pilot-units-v2'].includes(data?.schema)||data.floorIndex!==1||data.units?.length!==10||
    !/^[a-f0-9]{64}$/.test(data.sourceModelSHA256)||data.registration?.confidence!=='inferido')fail();
  const envelope=data.selectionEnvelope;
  if(!contour&&(envelope!==undefined||data.units.some(u=>u.footprint!==undefined||u.pickPoint!==undefined)))fail();
  if(contour&&(!validFootprint(envelope?.footprint)||envelope.minY!==0||envelope.maxY!==48.45||
    envelope.footprint.some(([x,z])=>Math.abs(x)>23.85||Math.abs(z)>7.5)))fail();
  const ids=new Set(),finals=new Set();
  for(const unit of data.units){
    if(!/^0[1-9]$|^10$/.test(unit.final)||
      unit.id!==`liv-ipanema/pavimento-modelo-01/final-${unit.final}`||ids.has(unit.id)||finals.has(unit.final)||
      !['estacionamento','lazer'].includes(unit.side)||unit.positionConfidence!=='inferido'||
      unit.typology!==null||unit.plan2d!==null||unit.mirroring!==null||unit.areaM2!==null||
      unit.commercialNumber!==null||unit.price!==null||unit.parking!==null||unit.availability!=='nao_informada')fail();
    const {min,max}=unit.bounds||{};
    if(![min,max].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite))||
      min.some((v,i)=>v>=max[i])||min[1]!==3.02||max[1]!==5.68||
      min[0]<-23.85||max[0]>23.85||
      (contour?(unit.side==='lazer'?(min[2]!==.16||max[2]>6.35):(min[2]<-6.35||max[2]!==-.16)):
        (unit.side==='lazer'?(min[2]!==.16||max[2]!==7.02):(min[2]!==-7.02||max[2]!==-.16)))||
      (Number(unit.final)%2===0)!==(unit.side==='lazer'))fail();
    if(contour){
      if(!validFootprint(unit.footprint)||unit.footprint.some(([x,z])=>
        x<min[0]||x>max[0]||z<min[2]||z>max[2]||!containsPoint(envelope.footprint,x,z))||
        Math.min(...unit.footprint.map(p=>p[0]))!==min[0]||Math.max(...unit.footprint.map(p=>p[0]))!==max[0]||
        Math.min(...unit.footprint.map(p=>p[1]))!==min[2]||Math.max(...unit.footprint.map(p=>p[1]))!==max[2]||
        !Array.isArray(unit.pickPoint)||unit.pickPoint.length!==3||!unit.pickPoint.every(Number.isFinite)||
        unit.pickPoint[1]!==4.35||!containsPoint(unit.footprint,unit.pickPoint[0],unit.pickPoint[2]))fail();
      // Vertices alone do not exclude an edge cutting across an envelope notch.
      for(let i=0;i<unit.footprint.length;i++){
        const a=unit.footprint[i],b=unit.footprint[(i+1)%unit.footprint.length];
        const cuts=[0,1];
        for(const p of envelope.footprint){
          const t=a[0]===b[0]?(p[1]-a[1])/(b[1]-a[1]):(p[0]-a[0])/(b[0]-a[0]);
          if(t>0&&t<1)cuts.push(t);
        }
        cuts.sort((a,b)=>a-b);
        for(let k=1;k<cuts.length;k++){
          const t=(cuts[k-1]+cuts[k])/2;
          if(!containsPoint(envelope.footprint,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t))fail();
        }
      }
    }
    ids.add(unit.id);finals.add(unit.final);
  }
  for(const side of ['lazer','estacionamento']){
    const ordered=data.units.filter(u=>u.side===side).sort((a,b)=>Number(a.final)-Number(b.final));
    for(let i=1;i<ordered.length;i++)if(ordered[i-1].bounds.max[0]>ordered[i].bounds.min[0])fail();
  }
  return data;
}
export async function loadUnits(signal,geometry='base'){
  if(!['base','contorno'].includes(geometry))throw Error('Perfil de geometria inválido.');
  const response=await fetch(new URL(geometry==='contorno'?'./modelo/unidades-contorno.json':'./unidades.json',import.meta.url),{signal,cache:'no-cache'});
  if(!response.ok)throw Error('Não foi possível carregar os finais do pavimento piloto.');
  return validateUnits(await response.json());
}
export function unitById(data,id){
  if(id===null)return null;
  const unit=data.units.find(unit=>unit.id===id);
  if(!unit)throw Error('Final fora do pavimento piloto.');
  return unit;
}
