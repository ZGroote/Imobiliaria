import {typology} from './tipologias.js';

export const PLAN_HASH=Object.freeze({canto:'a25114ef2c6fb455b38c787ae6b3c8420c81b534e19031a8cc0a34e4e1d95971',
  meio:'bc846b68c7ce1204578336829d205ea3c60aee80258429aed6f45d331a3e032a'});
const fields=new Set(['id','typology','orientation','interiorUnitSHA256','interiorSourceSHA256','planSHA256']);
export function validateRelations(input,catalog,interiors){
  const fail=message=>{throw Error(message||'Vínculos de plantas inválidos.');};
  if(input?.schema!=='liv-unit-relations-v1'||!['ausente','fornecido'].includes(input.status)||
    !Array.isArray(input.units)||input.units.length>catalog.units.length)fail();
  if(input.status==='ausente'){
    if(input.source!==null||input.units.length)fail('Vínculo ausente não pode atribuir plantas.');
    return {schema:input.schema,status:'ausente',source:null,units:[]};
  }
  const date=input.source?.asOf,parsed=new Date(date+'T00:00:00Z'),label=input.source?.label;
  if(input.bookSHA256!==catalog.source.bookSHA256||!input.units.length||
    typeof label!=='string'||!label.trim()||label.length>200||typeof date!=='string'||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||
    interiors?.schema!=='liv-interior-catalog-v1')fail('Informe fonte, data, book e catálogo de interiores correspondentes.');
  const known=new Set(catalog.units.map(unit=>unit.id)),seen=new Set();
  const units=input.units.map(row=>{
    if(!row||Object.keys(row).some(key=>!fields.has(key))||!known.has(row.id)||seen.has(row.id))fail('ID de vínculo ausente, duplicado ou fora do cadastro.');
    typology(row.typology);const interior=interiors.tipologias[row.typology];
    // Mirrored variants require a qualified geometry/navigation/2D bundle. Do
    // not flip only a picture or label an unchanged tour as a mirrored apartment.
    if(row.orientation!=='original')fail('Esta entrega aceita apenas a orientação original. O espelhamento requer uma variante de planta e Tour conferida.');
    if(!interior||row.interiorUnitSHA256!==interior.unitSHA256||row.interiorSourceSHA256!==interior.sourceSHA256||
      row.planSHA256!==PLAN_HASH[row.typology])fail('Planta/interior de outra revisão.');
    seen.add(row.id);return {...row};
  });
  return {schema:input.schema,status:input.status,bookSHA256:input.bookSHA256,source:{label:label.trim(),asOf:date},units};
}
export function attachRelations(catalog,input,interiors){
  const data=validateRelations(input,catalog,interiors),rows=new Map(data.units.map(row=>[row.id,row]));
  return {...catalog,relationSource:data.source,relationStatus:data.status,
    units:catalog.units.map(unit=>({...unit,relation:rows.get(unit.id)??null}))};
}
