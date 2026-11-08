import {useEffect,useState} from 'react';
import {api} from './api';
import {statusLabels,type Policy} from './outboundTypes';

type QueueItem={id:string;draft_id:string;version:number;status:string;reason:string;scheduled_at:string;recipient_timezone:string;snapshot:{subject:string;body_text:string;recipient:string;account_id:string;profile_id:string}};
const reasons:Record<string,string>={content_changed:'O texto mudou e exige nova aprovação.',contact_suppressed:'O contato foi bloqueado.',response_received:'Chegou uma resposta; revise o seguimento.',preflight_failed:'A conferência final bloqueou o item.',dry_run_only:'Apenas simulado; nenhum envio.',cancelled_by_operator:'Cancelado por você.',awaiting_business_hours:'Aguardando o horário comercial do destinatário.',awaiting_interval:'Aguardando o intervalo entre primeiros contatos.'};

export function SimulationQueue({policy,onChange}:{policy:Policy|null;onChange:()=>void}){
  const [items,setItems]=useState<QueueItem[]>([]);
  const [total,setTotal]=useState(0);
  const [offset,setOffset]=useState(0);
  const [revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{let cancelled=false;setLoading(true);api<{items:QueueItem[];total:number}>('/outbound/queue?offset='+offset).then(r=>{if(!cancelled){setItems(r.items);setTotal(r.total);}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[offset,revision]);
  async function action(path:string,body:unknown){
    setBusy(true);setError('');setNotice('');
    try{const result=await api<{simulated?:number;blocked?:number;deferred?:number}>(path,body);if(result.simulated!==undefined)setNotice(`${result.simulated} itens simulados; ${result.blocked} bloqueados; ${result.deferred} aguardando horário ou intervalo. Nenhum e-mail foi enviado.`);setRevision(n=>n+1);onChange();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="simulation-queue"><h2>Fila de simulação</h2><p>Esta fila testa aprovação, horários e bloqueios. Não existe envio real habilitado. O Resend proíbe prospecção fria e mensagens não solicitadas. <a href="https://resend.com/legal/acceptable-use" target="_blank" rel="noopener noreferrer">Política do provedor</a>.</p><div className="editor-actions"><span className="pill">{policy?.paused?'Simulação pausada':'Simulação liberada'}</span><button disabled={busy||!policy} onClick={()=>action('/outbound/control',{paused:!policy?.paused})}>{policy?.paused?'Retomar simulação':'Pausar simulação'}</button><button disabled={busy||!!policy?.paused} onClick={()=>action('/outbound/simulate',{confirm:true})}>Simular itens vencidos</button></div>
    {error&&<p className="alert error" role="alert">{error}</p>}{notice&&<p className="alert" role="status">{notice}</p>}{loading?<p role="status">Carregando fila…</p>:items.length?items.map(item=><article className="queue-item" key={item.id}><div className="editor-heading"><h3>{item.snapshot.subject}</h3><span className="pill">{statusLabels[item.status]||item.status}</span></div><p>{item.snapshot.recipient} · {item.snapshot.profile_id} · versão {item.version}</p><p>{new Date(item.scheduled_at).toLocaleString('pt-BR',{timeZone:item.recipient_timezone})} · fuso do destinatário ({item.recipient_timezone})</p>{item.reason&&<p>{reasons[item.reason]||'Revisão necessária.'}</p>}<details><summary>Ver texto aprovado desta versão</summary><pre>{item.snapshot.body_text}</pre></details>{item.status==='scheduled'&&<button disabled={busy} onClick={()=>{if(window.confirm('Cancelar este agendamento de simulação?'))void action(`/outbound/drafts/${item.draft_id}/cancel`,{version:item.version,confirm:true});}}>Cancelar agendamento</button>}</article>):<p className="empty">Nenhuma simulação agendada. Salve e aprove um rascunho para começar.</p>}
    <div className="pagination"><button disabled={busy||loading||!offset} onClick={()=>setOffset(n=>Math.max(0,n-25))}>Anterior</button><span>{total} itens no histórico</span><button disabled={busy||loading||offset+25>=total} onClick={()=>setOffset(n=>n+25)}>Próxima</button></div>
  </section>;
}
