// EXPERIMENTO-COMPRA-20261023: desligar esta chave remove o novo fluxo de navegação.
export const EXPERIENCE_DEFAULT=true;
export function buyerExperienceEnabled(search=''){
  const value=new URLSearchParams(search).get('experiencia');
  return value==='nova'||(value!=='original'&&EXPERIENCE_DEFAULT);
}

export function apartmentContact(unit,floor,{contact={},shareUrl}={}){
  const number=unit.commercial?.commercialNumber;
  const label=number?`apartamento ${number}`:`apartamento final ${unit.final}`;
  const url=new URL(shareUrl);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Endereço de interesse inválido.');
  // Somente navegação pública; recibos e identificadores de sessão nunca vão ao atendimento.
  for(const key of [...url.searchParams.keys()])if(!['l','pagina','geometria','unidades','estoque','luz','experiencia'].includes(key))url.searchParams.delete(key);
  url.searchParams.set('unidade',unit.id);url.searchParams.set('modo','planta2d');
  if(url.pathname==='/acesso.html')url.searchParams.set('pagina','maquete');
  url.hash='';
  const area=unit.salesDetails?.areaM2;
  const description=[`Olá! Tenho interesse no ${label} do LIV Ipanema, em São Carlos.`,
    floor===0?'Térreo.':`${floor}º andar.`,
    Number.isFinite(area)?`${new Intl.NumberFormat('pt-BR').format(area)} m².`:'',
    'Gostaria de confirmar disponibilidade, valor e condições.',url.href].filter(Boolean).join('\n');
  const phone=typeof contact.whatsappNumber==='string'&&/^[1-9][0-9]{7,14}$/.test(contact.whatsappNumber)?contact.whatsappNumber:null;
  return {label,message:description,href:phone?`https://wa.me/${phone}?text=${encodeURIComponent(description)}`:null};
}

export function createBuyerUI({document:doc,location,navigator}){
  // Builds antigos compartilham os bundles, mas não têm o HTML do experimento.
  if(!doc.getElementById('experienceBar'))return {enabled:false,setContact(){},update(){}};
  const enabled=buyerExperienceEnabled(location.search),el=id=>doc.getElementById(id);
  let context=null,current=null,lastKey='';
  doc.documentElement?.setAttribute('data-experiencia-compra',String(enabled));
  el('experienceBar').hidden=false;
  el('experienceLabel').textContent=enabled?'Experiência em teste':'Experiência anterior';
  const comparison=new URL(location.href||location.pathname+location.search,location.origin);
  comparison.searchParams.set('experiencia',enabled?'original':'nova');
  el('experienceCompare').href=comparison.href;
  el('experienceCompare').textContent=enabled?'Usar versão anterior':'Voltar ao teste';
  if(enabled){
    el('btnBackToMaquete').textContent='← Prédio';el('btnBackToMaquete').setAttribute('aria-label','Voltar ao prédio');
    for(const button of doc.querySelectorAll('[data-mode="planta2d"]'))button.textContent='Planta';
    for(const button of doc.querySelectorAll('[data-mode="planta3d"], [data-unit-open="planta3d"]'))button.textContent='Ver em 3D';
    for(const button of doc.querySelectorAll('[data-mode="visita"], [data-unit-open="visita"]')){button.textContent='Entrar';button.setAttribute('aria-label','Entrar no apartamento · Tour 3D');}
    doc.querySelector('.map-link').textContent='Conhecer a região';
  }
  el('buyerContactCopy').addEventListener('click',async()=>{
    if(!current)return;
    try{await navigator.clipboard.writeText(current.message);el('buyerContactStatus').textContent='Mensagem copiada. Envie ao seu corretor.';}
    catch{el('buyerContactMessage').value=current.message;el('buyerContactMessage').hidden=false;el('buyerContactStatus').textContent='Selecione e copie a mensagem abaixo para enviar ao seu corretor.';}
  });
  return {enabled,setContact(value){context=value;},update(unit,floor,mode='maquete'){
    doc.documentElement?.setAttribute('data-buyer-mode',mode);
    if(unit)comparison.searchParams.set('unidade',unit.id);else comparison.searchParams.delete('unidade');
    comparison.searchParams.set('modo',mode);el('experienceCompare').href=comparison.href;
    delete el('experienceCompare').dataset.trackingDestination;
    el('buyerContact').hidden=!enabled||!unit;
    if(!enabled||!unit){current=null;lastKey='';return;}
    const key=JSON.stringify([unit.id,unit.commercial?.commercialNumber,unit.salesDetails?.areaM2,floor,context]);if(key===lastKey)return;lastKey=key;
    current=apartmentContact(unit,floor,{contact:context?.contact,shareUrl:context?.shareUrl||new URL(location.href||location.pathname+location.search,location.origin).href});
    const link=el('buyerContactLink'),copy=el('buyerContactCopy');
    link.hidden=!current.href;copy.hidden=Boolean(current.href);
    if(current.href){link.href=current.href;link.textContent=`Falar sobre o ${current.label}`;}
    copy.textContent=`Copiar interesse no ${current.label}`;
    el('buyerContactNote').textContent=current.href?`Atendimento com ${context.contact.brokerName}`:'Compartilhe a mensagem com seu corretor.';
    el('buyerContactMessage').hidden=true;el('buyerContactStatus').textContent='';
  }};
}
