import {useCallback,useState} from 'react';
import {api, type Classification,type Message} from './api';
import {ClassificationReview} from './ClassificationReview';
import {ThreadAnalysis} from './ThreadAnalysis';

export const categories = [
  ['pricing_request','Pedido de orçamento'],['demo_request','Pedido de demonstração'],
  ['technical_question','Dúvida técnica'],['positive_interest','Interesse'],['not_interested','Sem interesse'],
  ['unsubscribe','Descadastro'],['automatic_reply','Mensagem automática'],['other','Revisar conversa'],['unclassified','Sem classificação'],
];

export function CategoryBadge({value}:{value:Classification}) {
  return <span className={'category-badge '+(value.blocked.length?'blocked':value.priority.toLowerCase())}>{value.priority} · {value.label}{value.source==='operator'?' · Revisada':''}{value.blocked.length?' · Bloqueado':''}</span>;
}

export function ClassificationPanel({value,threadId,accountId,messages,onDirtyChange,onChange}:{value:Classification;threadId:string;accountId:string;messages:Message[];onDirtyChange:(value:boolean)=>void;onChange:()=>void}) {
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [mode,setMode]=useState('review');
  const [error,setError]=useState('');
  const reviewDirty=useCallback((value:boolean)=>{setDirty(value);onDirtyChange(value);},[onDirtyChange]);
  async function classify() {
    setBusy(true);setError('');
    try{await api('/classifications/rules/run',{account_id:accountId,thread_id:threadId});onChange();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function block() {
    if(!window.confirm('Bloquear o remetente da mensagem recebida mais recente para futuras abordagens comerciais?'))return;
    setBusy(true);setError('');
    try{await api(`/mail/threads/${threadId}/suppress`,{confirm:true});onChange();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="classification-panel" aria-label="Triagem da conversa"><CategoryBadge value={value}/><p>{value.reason||'Classifique esta conversa para identificar o próximo atendimento.'}</p>
    {value.evidence&&<><small>{value.source==='operator'?'Mensagem revisada pelo operador':'Trecho usado pela regra'}</small><blockquote>{value.evidence}</blockquote>{value.message_id&&<a href={'#message-'+value.message_id}>Ver mensagem de origem</a>}</>}
    {value.blocked.length>0&&<p className="block-notice">Bloqueio ativo para {value.blocked.map(b=>b.address).join(', ')}. O bloqueio vale também para outras caixas e futuras campanhas.</p>}
    <div className="classification-actions"><button disabled={busy||dirty} onClick={classify}>{busy?'Processando…':'Classificar conversa'}</button><button disabled={busy||dirty} onClick={block}>Bloquear contato</button></div>
    <small>{value.source==='operator'?'Categoria revista pelo operador.':'Regras locais · revisão humana necessária.'} Esta triagem não envia mensagens.</small>{error&&<p role="alert" className="connection-error">{error}</p>}
    <div className="analysis-tabs" aria-label="Modos de conferência"><button disabled={busy||dirty} aria-pressed={mode==='review'} onClick={()=>setMode('review')}>Revisão humana</button><button disabled={busy||dirty} aria-pressed={mode==='analysis'} onClick={()=>setMode('analysis')}>Análise assistida</button></div>
    {mode==='review'?<ClassificationReview threadId={threadId} messages={messages} preferredMessage={value.message_id} onSaved={onChange} onDirtyChange={reviewDirty}/>:<ThreadAnalysis threadId={threadId} accountId={accountId} messages={messages} onDirtyChange={reviewDirty}/>}
  </section>;
}
