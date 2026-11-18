import {useEffect,useState} from 'react';
import {api} from './api';
import {CompanySelect} from './CompanySelect';
import {stageLabels,type CompanyRef,type Opportunity} from './commercialTypes';

export function OpportunityEditor({initial,initialCompany,onSaved,onDirtyChange}:{initial:Opportunity|null;initialCompany?:CompanyRef;onSaved:(item:Opportunity)=>void;onDirtyChange:(dirty:boolean)=>void}){
  const original={company:initial?{id:initial.company_id,name:initial.company_name}:initialCompany||null,title:initial?.title||'',stage:initial?.stage||'qualification',amount:initial?.amount_minor==null?'':(initial.amount_minor/100).toFixed(2).replace('.',','),currency:initial?.currency||'BRL',next_step:initial?.next_step||'',due_on:initial?.due_on||'',notes:initial?.notes||''};
  const [form,setForm]=useState(original),[requestId]=useState(()=>crypto.randomUUID().replaceAll('-','')),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const dirty=JSON.stringify(form)!==JSON.stringify(original);
  useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
  function field(key:string,value:string){setForm({...form,[key]:value});}
  async function save(){setBusy(true);setError('');try{
    if(!form.company)throw Error('Escolha uma empresa já revisada.');
    let amount:number|null=null;
    if(form.amount.trim()){
      if(!/^\d{1,11}([,.]\d{1,2})?$/.test(form.amount.trim()))throw Error('Use um valor como 1500,00, sem separador de milhares.');
      const [whole,fraction='']=form.amount.trim().replace(',','.').split('.');amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
      if(!Number.isSafeInteger(amount)||amount>1_000_000_000_000)throw Error('O valor estimado excede o limite aceito.');
    }
    const body={confirm:true,title:form.title,stage:form.stage,amount_minor:amount,currency:amount===null?null:form.currency,next_step:form.next_step,due_on:form.due_on||null,notes:form.notes};
    const saved=initial?await api<Opportunity>('/opportunities/'+initial.id,{...body,version:initial.version},'PUT'):await api<Opportunity>('/opportunities',{...body,company_id:form.company.id,request_id:requestId});
    onDirtyChange(false);onSaved(saved);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="opportunity-editor commercial-card"><h2>{initial?'Editar oportunidade':'Nova oportunidade'}</h2><p className="form-hint">Registro comercial local. Etapas e datas não enviam mensagens nem executam ações automaticamente.</p>
    {initial?<p>Empresa: <strong>{initial.company_name}</strong> · versão {initial.version}</p>:<CompanySelect value={form.company} onChange={company=>setForm({...form,company})} disabled={busy}/>}
    <label>Título da oportunidade<input maxLength={180} value={form.title} disabled={busy} onChange={e=>field('title',e.target.value)}/></label>
    <div className="editor-fields"><label>Etapa comercial<select value={form.stage} disabled={busy} onChange={e=>field('stage',e.target.value)}>{Object.entries(stageLabels).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>Data da próxima ação<input type="date" value={form.due_on} disabled={busy} onChange={e=>field('due_on',e.target.value)}/></label><label>Valor estimado · opcional<input inputMode="decimal" placeholder="Ex.: 1500,00" maxLength={15} value={form.amount} disabled={busy} onChange={e=>field('amount',e.target.value)}/></label><label>Moeda do valor estimado<select value={form.currency} disabled={busy} onChange={e=>field('currency',e.target.value)}><option value="BRL">BRL · Real</option><option value="USD">USD · Dólar americano</option></select></label></div>
    <label>Próxima ação<input maxLength={1000} value={form.next_step} disabled={busy} onChange={e=>field('next_step',e.target.value)}/></label><label>Notas comerciais<textarea rows={5} maxLength={8000} value={form.notes} disabled={busy} onChange={e=>field('notes',e.target.value)}/></label>
    {error&&<p role="alert" className="alert error">{error}</p>}<div className="editor-actions"><button className="primary" disabled={busy||!form.company||!form.title.trim()||!!form.due_on&&!form.next_step.trim()} onClick={save}>{busy?'Salvando…':'Salvar oportunidade'}</button><button disabled={busy||!dirty} onClick={()=>{setForm(original);setError('');}}>Descartar alterações</button>{dirty&&<span className="form-hint">Alterações ainda não salvas.</span>}</div>
  </section>;
}
