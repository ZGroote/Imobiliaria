import contatoPublico from './contato-publico.json' with {type:'json'};
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
    Number.isFinite(area)?`${new Intl.NumberFormat('pt-BR').format(area)} m².`:'',
    'Gostaria de confirmar disponibilidade, valor e condições.',url.href].filter(Boolean).join('\n');
  const phone=typeof contact.whatsappNumber==='string'&&/^[1-9][0-9]{7,14}$/.test(contact.whatsappNumber)?contact.whatsappNumber:null;
  return {label,message:description,href:phone?`https://wa.me/${phone}?text=${encodeURIComponent(description)}`:null};
}

export function createBuyerUI({document:doc,location,navigator,standalone=false}){
  // Builds antigos compartilham os bundles, mas não têm o HTML do experimento.
  if(!doc.getElementById('experienceBar'))return {enabled:false,setContact(){},update(){}};
  const enabled=buyerExperienceEnabled(location.search),el=id=>doc.getElementById(id);
  // A entrada institucional tem contato próprio; links individuais sempre aguardam o responsável da API.
  let context=standalone?{contact:contatoPublico}:null,current=null,lastKey='';
  doc.documentElement?.setAttribute('data-experiencia-compra',String(enabled));
  el('experienceBar').hidden=false;
  // VOLTAR-AO-SITE-20261023: a entrada pública retorna ao site; links de corretores usam o contato da API.
  if(standalone){
    const home=doc.createElement('a');home.id='siteHomeLink';home.href='https://conectaimoveis3d.com.br/';
    home.textContent='← Voltar ao site';home.setAttribute('aria-label','Voltar ao site principal da Conecta');
    home.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:6px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font-size:12px;text-decoration:none';
    el('experienceBar').prepend(home);el('experienceBar').style.flexWrap='wrap';
  }
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
    if(current.href){
      link.href=current.href;
      link.innerHTML='<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 2 17.7L.4 23.6l6-1.6A11.8 11.8 0 0 0 20.5 3.5ZM12.1 21a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.6.9 1-3.5-.3-.4A9.8 9.8 0 1 1 12.1 21Zm5.4-7.4-1.7-.8c-.3-.1-.5-.2-.7.1l-.8 1c-.2.2-.3.2-.6.1a8 8 0 0 1-3.9-3.4c-.2-.3 0-.4.1-.6l.6-.8c.1-.2.1-.4 0-.6l-.8-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.6.6-.9 1.3-.9 2.1 0 1.3.9 2.5 1.1 2.7.1.2 1.9 3 4.6 4.2 2.2 1 2.7.8 3.2.7.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3Z"/></svg>';
      link.style.cssText='position:fixed;right:16px;bottom:16px;z-index:50;display:flex;align-items:center;justify-content:center;width:56px;height:56px;min-height:56px;padding:0;border:0;border-radius:50%;background:#128c4a;color:#fff;box-shadow:0 3px 14px #0006';
      link.dataset.whatsappFloating='true';
      link.setAttribute('aria-label',`Conversar pelo WhatsApp sobre o ${current.label}, em nova aba`);
      link.title='Conversar pelo WhatsApp';
    }
    copy.textContent=`Copiar interesse no ${current.label}`;
    el('buyerContactNote').textContent=current.href?`Atendimento com ${context.contact.brokerName}`:'Compartilhe a mensagem com seu corretor.';
    el('buyerContactNote').hidden=Boolean(current.href);
    el('buyerContactMessage').hidden=true;el('buyerContactStatus').textContent='';
  }};
}
