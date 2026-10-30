import {exteriorEdition} from './edicoes.js';
// Cadastro do Parque das Laranjeiras: 3 torres x 13 pavimentos x 8 finais, gerado por
// modelo/exportar_cena.py a partir do mesmo modelo.json da cena (sourceModelSHA256).
export function validateUnits(data) {
  const fail=why=>{throw Error('Cadastro de apartamentos inválido: '+why+'.');};
  if(data?.schema!=='laranjeiras-units-v1'||data.floorIndex!==null||!/^[a-f0-9]{64}$/.test(data.sourceModelSHA256))fail('cabeçalho');
  if(!Number.isInteger(data.floors)||data.floors<1||!Array.isArray(data.towers)||!data.towers.length)fail('torres');
  const box=b=>[b?.min,b?.max].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite))&&b.min.every((v,i)=>v<b.max[i]);
  const towers=new Set();
  for(const tower of data.towers){if(!box(tower.bounds)||towers.has(tower.id))fail('torre '+tower.id);towers.add(tower.id);}
  if(data.units?.length!==data.towers.length*data.floors*8)fail('quantidade');
  const ids=new Set();
  for(const unit of data.units){
    if(!/^0[1-8]$/.test(unit.final)||!towers.has(unit.tower)||ids.has(unit.id)||
      unit.id!==`laranjeiras/${unit.tower}/pavimento-${String(unit.floorIndex).padStart(2,'0')}/final-${unit.final}`||
      !Number.isInteger(unit.floorIndex)||unit.floorIndex<0||unit.floorIndex>=data.floors||
      !['canto','meio'].includes(unit.typology)||!box(unit.bounds)||!/^[\w-]+:[+-][xz]$/.test(unit.side))fail(unit.id);
    ids.add(unit.id);
  }
  return data;
}
export async function loadUnits(signal,geometry='base'){
  const response=await fetch(new URL(exteriorEdition(geometry).units,import.meta.url),{signal,cache:'no-cache'});
  if(!response.ok)throw Error('Não foi possível carregar os apartamentos.');
  return validateUnits(await response.json());
}
export function unitById(data,id){
  if(id===null)return null;
  const unit=data.units.find(unit=>unit.id===id);
  if(!unit)throw Error('Apartamento fora do cadastro.');
  return unit;
}
