import {attachCommercial,BOOK_SHA_LARANJEIRAS} from './comercial.js';

const semTabela={schema:'liv-commercial-v1',status:'ausente',source:null,units:[]};

export function attachStock(catalog,snapshot){
  if(!snapshot){
    const next=attachCommercial(catalog,semTabela);
    return {...next,units:next.units.map(unit=>({...unit,salesDetails:null}))};
  }
  const {settings,units,profiles}=snapshot;
  if(settings.model!=='vistas-da-quinze'||settings.bookSHA256!==BOOK_SHA_LARANJEIRAS||
      units.length!==catalog.units.length)throw Error('Estoque de outro empreendimento ou revisão.');

  const base=new Map(profiles.map(profile=>[profile.id,profile.info]));
  const details=new Map();
  const rows=units.map(unit=>{
    const get=field=>unit.overrides[field]??base.get(unit.profileId)?.[field]??null;
    details.set(unit.technicalId,{areaM2:get('areaM2'),bedrooms:get('bedrooms'),bathrooms:get('bathrooms'),
      description:get('description')});
    return {id:unit.technicalId,commercialNumber:unit.commercialNumber,availability:unit.availability,
      priceCents:get('priceCents'),parking:get('parking'),conditions:get('conditions')};
  });
  const dates=[settings,...units,...profiles].map(row=>row.updatedAt?.toDate?.())
    .filter(date=>date instanceof Date&&Number.isFinite(date.getTime()));
  if(!dates.length)throw Error('Data do cadastro indisponível.');
  const source={label:`Cadastro do responsável · ${settings.title}`,asOf:new Date(Math.max(...dates.map(d=>d.getTime()))).toISOString().slice(0,10)};
  const next=attachCommercial(catalog,{schema:'liv-commercial-v1',status:'fornecido',bookSHA256:settings.bookSHA256,source,units:rows});
  // O estoque comercial nunca muda a tipologia ou o espelhamento definidos na maquete.
  return {...next,units:next.units.map(unit=>{
    const info=details.get(unit.id);
    return {...unit,salesDetails:{areaM2:info.areaM2??unit.areaM2??null,bedrooms:info.bedrooms??2,
      bathrooms:info.bathrooms??1,description:info.description}};
  })};
}
