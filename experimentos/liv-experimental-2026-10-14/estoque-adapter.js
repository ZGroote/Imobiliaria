import {attachCommercial} from './comercial.js';
import {attachRelations,PLAN_HASH} from './vinculos.js';
const fields=['priceCents','areaM2','bedrooms','bathrooms','parking','description','conditions'];
export function attachStock(catalog,snapshot,interiors){
  if(!snapshot)return {...attachRelations(attachCommercial(catalog,{schema:'liv-commercial-v1',status:'ausente',source:null,units:[]}),
    {schema:'liv-unit-relations-v1',status:'ausente',source:null,units:[]},null),units:catalog.units.map(u=>({...u,commercial:{commercialNumber:null,availability:'nao_informada',priceCents:null,parking:null,conditions:null},relation:null,salesDetails:null}))};
  if(snapshot.settings.bookSHA256!==catalog.source.bookSHA256)throw Error('Cadastro de outro empreendimento ou revisão.');
  const profiles=new Map(snapshot.profiles.map(p=>[p.id,p.info]));
  const details=new Map(snapshot.units.map(u=>[u.technicalId,Object.fromEntries(fields.map(k=>[k,u.overrides[k]??profiles.get(u.profileId)?.[k]??null]))]));
  const rows=snapshot.units.map(u=>({id:u.technicalId,commercialNumber:u.commercialNumber,availability:u.availability,
    priceCents:details.get(u.technicalId).priceCents,parking:details.get(u.technicalId).parking,conditions:details.get(u.technicalId).conditions}));
  const dates=[snapshot.settings,...snapshot.units,...snapshot.profiles].map(v=>v.updatedAt?.toDate?.()).filter(v=>v instanceof Date&&Number.isFinite(v.getTime()));
  if(!dates.length)throw Error('Data do cadastro indisponível.');
  const source={label:`Cadastro do responsável · ${snapshot.settings.title}`,asOf:new Date(Math.max(...dates.map(v=>v.getTime()))).toISOString().slice(0,10)};
  let next=attachCommercial(catalog,{schema:'liv-commercial-v1',status:'fornecido',bookSHA256:snapshot.settings.bookSHA256,source,units:rows});
  const associated=snapshot.units.filter(u=>u.profileId!==null).map(u=>{
    const interior=interiors?.tipologias?.[u.profileId];if(!interior)throw Error('Catálogo de interiores ausente.');
    return {id:u.technicalId,typology:u.profileId,orientation:'original',interiorUnitSHA256:interior.unitSHA256,interiorSourceSHA256:interior.sourceSHA256,planSHA256:PLAN_HASH[u.profileId]};
  });
  next=attachRelations(next,{schema:'liv-unit-relations-v1',status:associated.length?'fornecido':'ausente',bookSHA256:snapshot.settings.bookSHA256,
    source:associated.length?source:null,units:associated},interiors);
  return {...next,units:next.units.map(u=>({...u,salesDetails:details.get(u.id)}))};
}
