export const AVAILABILITY=Object.freeze({nao_informada:'Não informada',disponivel:'Disponível',reservada:'Reservada',vendida:'Vendida',bloqueada:'Bloqueada'});
// Vistas: a perspectiva colorida (cadastro unidade -> tipologia) faz o papel do book.
export const BOOK_SHA='f5f6c5e2c8febd11f906feb48838bfd627451119a7a7bf285571f447a005ea49';
const empty=Object.freeze({commercialNumber:null,availability:'nao_informada',priceCents:null,parking:null,conditions:null});
const fields=new Set(['id','commercialNumber','availability','priceCents','parking','conditions']);
function text(value,max){
  if(value===null||value===undefined)return null;
  if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Texto comercial inválido.');
  return value.trim();
}
function date(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const parsed=new Date(value+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export function validateCommercial(data,catalog){
  const fail=message=>{throw Error(message||'Tabela comercial inválida.');};
  if(data?.schema!=='liv-commercial-v1'||!['ausente','fornecido','simulado'].includes(data.status)||
    !Array.isArray(data.units)||data.units.length>catalog.units.length)fail();
  if(data.status==='ausente'){
    if(data.units.length||data.source!==null)fail('Tabela ausente não pode atribuir ofertas.');
    return {schema:data.schema,status:'ausente',source:null,units:[]};
  }
  if(data.bookSHA256!==BOOK_SHA||!data.units.length||!date(data.source?.asOf))fail('Origem, revisão ou data comercial ausente.');
  const label=text(data.source.label,200);if(!label)fail('Identifique a tabela fornecida.');
  const known=new Set(catalog.units.map(unit=>unit.id)),ids=new Set(),numbers=new Set();
  const units=data.units.map(row=>{
    if(!row||typeof row!=='object'||Object.keys(row).some(key=>!fields.has(key))||!known.has(row.id)||ids.has(row.id))fail('ID ausente, duplicado ou fora do cadastro técnico.');
    const availability=row.availability??'nao_informada',priceCents=row.priceCents??null;
    if(!Object.hasOwn(AVAILABILITY,availability)||(priceCents!==null&&(!Number.isSafeInteger(priceCents)||priceCents<0)))fail('Disponibilidade ou preço em centavos inválido.');
    const commercialNumber=text(row.commercialNumber,100),parking=text(row.parking,200),conditions=text(row.conditions,2000);
    if(data.status==='simulado'&&[priceCents,commercialNumber,parking,conditions].some(value=>value!==null))
      fail('A simulação aceita somente a disponibilidade.');
    const numberKey=commercialNumber?.normalize('NFKC').toLocaleUpperCase('pt-BR');
    if(numberKey&&numbers.has(numberKey))fail('Número comercial atribuído a mais de uma posição.');
    if(numberKey)numbers.add(numberKey);ids.add(row.id);
    return {id:row.id,commercialNumber,availability,priceCents,parking,conditions};
  });
  return {schema:data.schema,status:data.status,bookSHA256:data.bookSHA256,source:{label,asOf:data.source.asOf},units};
}
export function attachCommercial(catalog,input){
  const data=validateCommercial(input,catalog),rows=new Map(data.units.map(row=>[row.id,row]));
  return {...catalog,commercialSource:data.source,commercialStatus:data.status,
    units:catalog.units.map(unit=>({...unit,commercial:rows.get(unit.id)??empty}))};
}
export function saleOf(unit){return unit?.commercial??empty;}
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function formatPrice(cents){
  return money.formatToParts(BigInt(cents)/100n).map(part=>
    part.type==='fraction'?String(cents%100).padStart(2,'0'):part.value).join('');
}
export function saleLabel(unit,simulated=false){
  const sale=saleOf(unit);
  const status=AVAILABILITY[sale.availability]+(simulated?' (simulação)':'');
  return `${status} · ${sale.priceCents===null?'preço sob consulta':formatPrice(sale.priceCents)}`;
}
export function priceLabel(unit){const sale=saleOf(unit);return sale.priceCents===null?'Sob consulta':formatPrice(sale.priceCents);}
