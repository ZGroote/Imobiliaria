// Technical pilot records are independent of the decorative meshes and interiors.
export function validateUnits(data) {
  const fail=()=>{throw Error('Cadastro do pavimento piloto inválido.');};
  if(data?.schema!=='liv-pilot-units-v1'||data.floorIndex!==1||data.units?.length!==10||
    !/^[a-f0-9]{64}$/.test(data.sourceModelSHA256)||data.registration?.confidence!=='inferido')fail();
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
      (unit.side==='lazer'?(min[2]!==.16||max[2]!==7.02):(min[2]!==-7.02||max[2]!==-.16))||
      (Number(unit.final)%2===0)!==(unit.side==='lazer'))fail();
    ids.add(unit.id);finals.add(unit.final);
  }
  for(const side of ['lazer','estacionamento']){
    const ordered=data.units.filter(u=>u.side===side).sort((a,b)=>Number(a.final)-Number(b.final));
    for(let i=1;i<ordered.length;i++)if(ordered[i-1].bounds.max[0]>ordered[i].bounds.min[0])fail();
  }
  return data;
}
export async function loadUnits(signal){
  const response=await fetch(new URL('./unidades.json',import.meta.url),{signal,cache:'no-cache'});
  if(!response.ok)throw Error('Não foi possível carregar os finais do pavimento piloto.');
  return validateUnits(await response.json());
}
export function unitById(data,id){
  if(id===null)return null;
  const unit=data.units.find(unit=>unit.id===id);
  if(!unit)throw Error('Final fora do pavimento piloto.');
  return unit;
}
