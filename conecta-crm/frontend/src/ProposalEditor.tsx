import {useEffect,useState} from 'react';
import {api} from './api';
import {money,type Opportunity} from './commercialTypes';
import type {Proposal,ProposalPayload} from './proposalTypes';

export const proposalFields:Record<string,string>={project_name:'Nome do projeto',contact_name:'Destinatário da proposta',sender_name:'Responsável pela proposta',scope:'Escopo',deliverables:'Entregas previstas',materials:'Materiais necessários',timeline:'Prazo e marcos',revisions:'Revisões incluídas',support:'Suporte e disponibilização',payment_terms:'Condições de pagamento',exclusions:'Exclusões e observações · opcional'};
export function ProposalEditor({initial,opportunity,onSaved,onDirtyChange}:{initial:Proposal|null;opportunity:Opportunity;onSaved:(p:Proposal)=>void;onDirtyChange:(dirty:boolean)=>void}){
  const original={profile_id:initial?.payload.profile_id||'',project_name:initial?.payload.project_name||'',contact_name:initial?.payload.contact_name||'',sender_name:initial?.payload.sender_name||'',scope:initial?.payload.scope||'',deliverables:initial?.payload.deliverables||'',materials:initial?.payload.materials||'',timeline:initial?.payload.timeline||'',revisions:initial?.payload.revisions||'',support:initial?.payload.support||'',payment_terms:initial?.payload.payment_terms||'',exclusions:initial?.payload.exclusions||'',amount:initial?.payload.amount_minor==null?'':(initial.payload.amount_minor/100).toFixed(2).replace('.',','),currency:initial?.payload.currency||opportunity.currency||'BRL',valid_until:initial?.payload.valid_until||''};
  const [form,setForm]=useState(original),[requestId]=useState(()=>crypto.randomUUID().replaceAll('-','')),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dirty=JSON.stringify(form)!==JSON.stringify(original);
  useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
  function field(key:string,value:string){setForm({...form,[key]:value});}
  async function save(){setBusy(true);setError('');try{
    if(!form.profile_id)throw Error('Escolha explicitamente o mercado e o idioma da proposta.');
    let amount:number|null=null;
    if(form.amount.trim()){
      if(!/^\d{1,11}([,.]\d{1,2})?$/.test(form.amount.trim()))throw Error('Use um valor como 1500,00, sem separador de milhares.');
      const [whole,fraction='']=form.amount.trim().replace(',','.').split('.');amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
      if(!Number.isSafeInteger(amount)||amount>1_000_000_000_000)throw Error('O preço excede o limite aceito.');
    }
    const {amount:ignored,...values}=form;
    const body={...values,amount_minor:amount,currency:amount===null?null:form.currency,valid_until:form.valid_until||null,opportunity_version:initial?.current_opportunity.opportunity_version||opportunity.version};
    const saved=initial?await api<Proposal>('/proposals/'+initial.id,{...body,version:initial.version},'PUT'):await api<Proposal>('/proposals',{...body,opportunity_id:opportunity.id,request_id:requestId});
    onDirtyChange(false);onSaved(saved);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="proposal-editor"><h3>{initial?'Editar condições da proposta':'Preparar proposta'}</h3><p className="form-hint">A proposta usa o papel timbrado e os campos de escopo dos documentos fornecidos. Preencha apenas serviços e condições que você pode oferecer.</p>
    <div className="editor-fields"><label>Mercado e idioma da proposta<select value={form.profile_id} disabled={busy} onChange={e=>field('profile_id',e.target.value)}><option value="">Escolha o mercado do destinatário</option><option value="BR">BR · Português · site .com.br</option><option value="US">US · English · site .com</option></select></label><label>Validade da proposta<input type="date" disabled={busy} value={form.valid_until} onChange={e=>field('valid_until',e.target.value)}/></label></div><p className="form-hint">No perfil US, os rótulos do documento e o rodapé ficam em inglês/.com. O texto que você escrever nos campos não é traduzido automaticamente.</p>
    {Object.entries(proposalFields).map(([key,label])=><label key={key}>{label}{['project_name','contact_name','sender_name'].includes(key)?<input value={form[key as keyof typeof form]} maxLength={180} disabled={busy} onChange={e=>field(key,e.target.value)}/>:<textarea value={form[key as keyof typeof form]} maxLength={2000} rows={3} disabled={busy} onChange={e=>field(key,e.target.value)}/>}</label>)}
    <div className="editor-fields"><label>Preço da proposta · conferir<input inputMode="decimal" maxLength={15} value={form.amount} disabled={busy} onChange={e=>field('amount',e.target.value)}/></label><label>Moeda da proposta<select value={form.currency} disabled={busy} onChange={e=>field('currency',e.target.value)}><option value="BRL">BRL · Real</option><option value="USD">USD · Dólar americano</option></select></label></div>
    <p className="form-hint">Estimativa da oportunidade: {money(opportunity.amount_minor,opportunity.currency)}. O preço da proposta pode ser diferente e exige sua revisão.</p><button disabled={busy||opportunity.amount_minor===null} onClick={()=>setForm({...form,amount:(opportunity.amount_minor!/100).toFixed(2).replace('.',','),currency:opportunity.currency||'BRL'})}>Usar estimativa como preço de rascunho</button>
    {error&&<p className="alert error" role="alert">{error}</p>}<div className="editor-actions"><button className="primary" disabled={busy||!form.profile_id} onClick={save}>{busy?'Salvando…':'Salvar rascunho da proposta'}</button><button disabled={busy||!dirty} onClick={()=>{setForm(original);setError('');}}>Descartar alterações da proposta</button>{dirty&&<span className="form-hint">Salve para atualizar a prévia e revisar.</span>}</div>
  </section>;
}
