import {useEffect,useState} from 'react';
import {api} from './api';
import {inputFrom,statusLabels,type Draft,type DraftInput,type Policy,type ReplyContext,type Template} from './outboundTypes';

type Props={draft:Draft|null;reply:ReplyContext|null;templates:Template[];policy:Policy|null;onSaved:(draft:Draft)=>void;onDirty:(dirty:boolean)=>void};
const fields:Record<string,string>={company_name:'Empresa destinatária',sender_name:'Seu nome',postal_address:'Endereço postal comercial',contact_name:'Nome do cliente',project_name:'Projeto',solution_name:'Solução contratada',project_url:'Link de acesso conferido',original_subject:'Assunto da conversa',reply_text:'Texto da resposta'};

export function DraftEditor({draft,reply,templates,policy,onSaved,onDirty}:Props){
  const [form,setForm]=useState<DraftInput>(()=>draft?inputFrom(draft):{account_id:reply?.account_id||'contact',profile_id:reply?(reply.profile_id||''):'US',recipient:reply?.recipient||'',subject:reply?'Re: '+reply.original_subject:'',body_text:'',purpose:reply?'reply':'outreach',thread_id:reply?.thread_id||null,metadata:{postal_address:'',project_completed:false,delivery_confirmed:false}});
  const [current,setCurrent]=useState(draft);
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [templateId,setTemplateId]=useState(reply?'reply':'cold_intro_minimal');
  const [values,setValues]=useState<Record<string,string>>({sender_name:'João Groote',original_subject:reply?.original_subject||''});
  const [zone,setZone]=useState((reply?.profile_id||draft?.profile_id)==='BR'?'America/Sao_Paulo':'America/New_York');
  const [localTime,setLocalTime]=useState('');
  const [mobile,setMobile]=useState(false);
  const selected=templates.find(t=>t.id===templateId&&t.profile_id===form.profile_id);
  useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{if(dirty)e.preventDefault();};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[dirty]);
  function changed(next:DraftInput){setForm(next);setDirty(true);onDirty(true);setNotice('');}
  function accept(result:Draft){setCurrent(result);setForm(inputFrom(result));setDirty(false);onDirty(false);onSaved(result);}
  async function save(){
    setBusy(true);setError('');setNotice('');
    try{const result=await api<Draft>(current?'/outbound/drafts/'+current.id:'/outbound/drafts',current?{...form,version:current.version}:form,current?'PUT':undefined);accept(result);setNotice('Rascunho salvo. Qualquer edição exige nova aprovação.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function approve(){
    if(!current||dirty||!window.confirm(`Aprovar o texto da versão ${current.version}? Isso não envia e-mail.`))return;
    setBusy(true);setError('');
    try{accept(await api<Draft>(`/outbound/drafts/${current.id}/approve`,{version:current.version,content_hash:current.content_hash,confirm:true}));setNotice('Texto aprovado. Você pode agendar uma simulação.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function cancel(){
    if(!current||!window.confirm('Cancelar este rascunho e sua simulação pendente? O histórico será preservado.'))return;
    setBusy(true);setError('');
    try{accept(await api<Draft>(`/outbound/drafts/${current.id}/cancel`,{version:current.version,confirm:true}));setNotice('Rascunho cancelado.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function applyTemplate(){
    if(!selected)return;setBusy(true);setError('');
    try{const result=await api<Pick<DraftInput,'subject'|'body_text'|'purpose'|'metadata'>>('/outbound/templates/render',{template_id:templateId,profile_id:form.profile_id,values:Object.fromEntries(selected.required_fields.map(field=>[field,values[field]||'']))});changed({...form,...result});}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function schedule(){
    if(!current||dirty)return;setBusy(true);setError('');
    try{await api('/outbound/schedule',{draft_id:current.id,version:current.version,content_hash:current.content_hash,confirm:true,local_time:localTime,recipient_timezone:zone});accept(await api<Draft>('/outbound/drafts/'+current.id));setNotice('Agendado apenas para simulação. Nenhum e-mail será enviado.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const words=form.body_text.trim()?form.body_text.trim().split(/\s+/).length:0;
  return <section className="draft-editor" aria-label="Editor de rascunho"><div className="editor-heading"><h2>{current?'Editar rascunho':'Novo rascunho'}</h2><span className="pill">{dirty?'Alterações não salvas':current?statusLabels[current.status]:'Ainda não salvo'}{current?' · v'+current.version:''}</span></div>
    {error&&<p className="alert error" role="alert">{error}</p>}{notice&&<p className="alert" role="status">{notice}</p>}
    <fieldset disabled={busy}><legend>Identidade e destinatário</legend><div className="editor-fields"><label>Caixa de saída<select disabled={!!form.thread_id} value={form.account_id} onChange={e=>changed({...form,account_id:e.target.value})}><option value="contact">contact · atendimento</option><option value="team">team · equipe</option><option value="demo">Demonstração · dados fictícios</option></select></label><label>Mercado do destinatário<select disabled={!!reply?.profile_id} value={form.profile_id} onChange={e=>{changed({...form,profile_id:e.target.value});setTemplateId(reply?'reply':'cold_intro_minimal');setZone(e.target.value==='BR'?'America/Sao_Paulo':'America/New_York');}}><option value="" disabled>Escolha o mercado</option><option value="US">Estados Unidos · EN-US</option><option value="BR">Brasil · PT-BR</option></select></label><label className="wide">Destinatário<input type="email" maxLength={254} value={form.recipient} onChange={e=>changed({...form,recipient:e.target.value})}/></label></div>
      {form.thread_id&&<p className="form-hint">Resposta vinculada à conversa de origem. O perfil comercial será preservado nos próximos rascunhos desta conversa.</p>}
      <details className="template-builder"><summary>Preencher a partir de um modelo</summary><label>Modelo<select value={templateId} onChange={e=>setTemplateId(e.target.value)}>{templates.filter(t=>t.profile_id===form.profile_id).map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>{selected&&<><div className="editor-fields">{selected.required_fields.map(field=><label key={field} className={field==='reply_text'?'wide':''}>{fields[field]||field}{field==='reply_text'?<textarea rows={4} maxLength={3000} value={values[field]||''} onChange={e=>setValues({...values,[field]:e.target.value})}/>:<input maxLength={1000} value={values[field]||''} onChange={e=>setValues({...values,[field]:e.target.value})}/>}</label>)}</div><button onClick={applyTemplate}>Aplicar modelo ao editor</button><p className="form-hint">Campos ausentes ficam destacados entre chaves. Os documentos da biblioteca não são anexados automaticamente.</p></>}</details>
      <label>Finalidade<select value={form.purpose} onChange={e=>changed({...form,purpose:e.target.value})}><option value="outreach">Primeiro contato comercial</option><option value="followup">Seguimento de conversa</option><option value="reply">Resposta a conversa</option><option value="delivery">Entrega de projeto concluído</option><option value="after_sale">Pós-venda e feedback</option></select></label>
      <label>Assunto<input maxLength={200} value={form.subject} onChange={e=>changed({...form,subject:e.target.value})}/></label><label>Mensagem<textarea rows={14} maxLength={10000} value={form.body_text} onChange={e=>changed({...form,body_text:e.target.value})}/></label>
      {(form.purpose==='outreach'||form.purpose==='followup')&&<label>Endereço postal comercial para a assinatura<input maxLength={1000} value={form.metadata.postal_address} onChange={e=>changed({...form,metadata:{...form.metadata,postal_address:e.target.value}})}/><small>Inclua o mesmo endereço no texto e uma instrução clara de descadastro.</small></label>}
      {form.purpose==='delivery'&&<label className="checkbox"><input type="checkbox" checked={form.metadata.project_completed} onChange={e=>changed({...form,metadata:{...form.metadata,project_completed:e.target.checked}})}/> Confirmei a conclusão do projeto e conferi o acesso informado.</label>}
      {form.purpose==='after_sale'&&<label className="checkbox"><input type="checkbox" checked={form.metadata.delivery_confirmed} onChange={e=>changed({...form,metadata:{...form.metadata,delivery_confirmed:e.target.checked}})}/> A entrega já ocorreu; posso iniciar o acompanhamento.</label>}
      <div className="editor-actions"><button className="primary" disabled={!form.profile_id} onClick={save}>Salvar rascunho</button><button disabled={!current||dirty||!!current.review_errors.length||!['draft','pending_review','approved'].includes(current.status)} onClick={approve}>Aprovar esta versão</button><button disabled={!current||dirty} onClick={cancel}>Cancelar rascunho</button></div>
    </fieldset>
    {current&&!dirty&&<section className="review-checks"><h3>Conferência antes de aprovar</h3>{current.review_errors.length?<ul>{current.review_errors.map(e=><li key={e}>{e}</li>)}</ul>:<p>Campos conferidos pelas regras locais. Revise o conteúdo e os dados antes de aprovar.</p>}<p>O transporte real continua desabilitado. Conexão de leitura não autoriza um remetente a enviar.</p></section>}
    <section className="email-preview"><div className="editor-heading"><h3>Prévia em texto simples</h3><button onClick={()=>setMobile(!mobile)}>{mobile?'Ver em desktop':'Ver em celular'}</button></div><small>{words} palavras · {(form.body_text.match(/https?:\/\//g)||[]).length} links · nenhum anexo</small><div className={mobile?'preview-paper mobile':'preview-paper'}><strong>{form.subject||'Sem assunto'}</strong><pre>{form.body_text||'Sua mensagem aparecerá aqui.'}</pre></div></section>
    <section className="schedule-form"><h3>Agendar simulação</h3><p>Primeiros contatos respeitam 30 minutos de intervalo e até 16 por dia. Use dias úteis, das 9h às 17h no fuso do destinatário.</p><label>Fuso do destinatário<select disabled={busy} value={zone} onChange={e=>setZone(e.target.value)}>{Object.entries(policy?.timezones||{}).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><label>Dia e hora do destinatário<input type="datetime-local" disabled={busy} value={localTime} onChange={e=>setLocalTime(e.target.value)}/></label><button disabled={busy||dirty||current?.status!=='approved'||!localTime} onClick={schedule}>Agendar versão aprovada · simulação</button>{policy?.paused&&<p className="form-hint">A fila está pausada. Você pode agendar e retomar a simulação depois.</p>}</section>
    {current&&current.history.length>0&&<details className="draft-history"><summary>Histórico de versões e decisões</summary><ul>{current.history.map((h,i)=><li key={i}>v{h.version} · {({draft_saved:'Rascunho salvo',content_changed:'Edição exigiu nova aprovação',content_approved:'Texto aprovado',simulation_scheduled:'Simulação agendada',simulation_completed:'Simulação concluída',contact_suppressed:'Contato bloqueado',response_received:'Resposta recebida',preflight_failed:'Conferência final bloqueou o item',cancelled_by_operator:'Cancelado por você'} as Record<string,string>)[h.action]||'Revisão registrada'} · {new Date(h.occurred_at).toLocaleString('pt-BR')}</li>)}</ul></details>}
  </section>;
}
