import dados from './dados/maquete.js';
import {containsPoint,validFootprint} from './unit-footprint.js';
import {exteriorEdition} from './edicoes.js';
// The inner face of a side (next to the core) is exact; the outer one is exact on the base model and
// bounded on the contour model (dados.lados).
function outsideSide(side,min,max,contour){
  const positive=side.interno>0,inner=positive?min[2]:max[2],outer=positive?max[2]:min[2];
  if(inner!==side.interno)return true;
  if(!contour)return outer!==side.externo.base;
  return positive?outer>side.externo.contorno:outer<side.externo.contorno;
}
// Technical pilot records are independent of the decorative meshes and interiors. What a valid pilot
// catalog looks like for this property (how many finals, where they sit) comes from dados.unidades.
export function validateUnits(data) {
  const fail=()=>{throw Error('Cadastro do pavimento piloto inválido.');};
  const R=dados.unidades,E=R.envelope;
  const contour=data?.schema===R.esquemaComContorno;
  if(!R.esquemas.includes(data?.schema)||data.floorIndex!==dados.predio.pavimentoPiloto||data.units?.length!==R.quantidade||
    !/^[a-f0-9]{64}$/.test(data.sourceModelSHA256)||data.registration?.confidence!==R.confianca)fail();
  const envelope=data.selectionEnvelope;
  if(!contour&&(envelope!==undefined||data.units.some(u=>u.footprint!==undefined||u.pickPoint!==undefined)))fail();
  if(contour&&(!validFootprint(envelope?.footprint)||envelope.minY!==E.minY||envelope.maxY!==E.maxY||
    envelope.footprint.some(([x,z])=>Math.abs(x)>E.meiaLarguraX||Math.abs(z)>E.meiaProfundidadeZ)))fail();
  const ids=new Set(),finals=new Set(),finalPattern=new RegExp(R.final);
  for(const unit of data.units){
    const side=Object.hasOwn(dados.lados,unit.side)?dados.lados[unit.side]:null;
    if(!finalPattern.test(unit.final)||
      unit.id!==R.idPiloto.replace('{final}',unit.final)||ids.has(unit.id)||finals.has(unit.final)||
      !side||unit.positionConfidence!==R.confianca||
      unit.typology!==null||unit.plan2d!==null||unit.mirroring!==null||unit.areaM2!==null||
      unit.commercialNumber!==null||unit.price!==null||unit.parking!==null||unit.availability!=='nao_informada')fail();
    const {min,max}=unit.bounds||{};
    if(![min,max].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite))||
      min.some((v,i)=>v>=max[i])||min[1]!==R.faixaY[0]||max[1]!==R.faixaY[1]||
      min[0]<-R.meiaLarguraX||max[0]>R.meiaLarguraX||outsideSide(side,min,max,contour)||
      (Number(unit.final)%2===0)!==side.par)fail();
    if(contour){
      if(!validFootprint(unit.footprint)||unit.footprint.some(([x,z])=>
        x<min[0]||x>max[0]||z<min[2]||z>max[2]||!containsPoint(envelope.footprint,x,z))||
        Math.min(...unit.footprint.map(p=>p[0]))!==min[0]||Math.max(...unit.footprint.map(p=>p[0]))!==max[0]||
        Math.min(...unit.footprint.map(p=>p[1]))!==min[2]||Math.max(...unit.footprint.map(p=>p[1]))!==max[2]||
        !Array.isArray(unit.pickPoint)||unit.pickPoint.length!==3||!unit.pickPoint.every(Number.isFinite)||
        unit.pickPoint[1]!==R.alturaDoClique||!containsPoint(unit.footprint,unit.pickPoint[0],unit.pickPoint[2]))fail();
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
  for(const side of Object.keys(dados.lados)){
    const ordered=data.units.filter(u=>u.side===side).sort((a,b)=>Number(a.final)-Number(b.final));
    for(let i=1;i<ordered.length;i++)if(ordered[i-1].bounds.max[0]>ordered[i].bounds.min[0])fail();
  }
  return data;
}
export async function loadUnits(signal,geometry='base'){
  const response=await fetch(new URL(exteriorEdition(geometry).units,import.meta.url),{signal,cache:'no-cache'});
  if(!response.ok)throw Error('Não foi possível carregar os finais do pavimento piloto.');
  return validateUnits(await response.json());
}
export function unitById(data,id){
  if(id===null)return null;
  const unit=data.units.find(unit=>unit.id===id);
  if(!unit)throw Error('Final fora do pavimento piloto.');
  return unit;
}
