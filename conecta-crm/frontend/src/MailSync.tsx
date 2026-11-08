import {useEffect, useRef, useState} from 'react';
import {api, type Account} from './api';

type Schedule = {account_id:string;address:string;enabled:boolean;interval_minutes:number;next_run:string|null;last_attempt:string|null;last_success:string|null;last_error:string|null;failures:number;last_added:number;has_more:boolean;version:number;running:boolean;connected:boolean;sync_at:string|null};
type Result = {items:Schedule[]};
const when=(value:string|null)=>value?new Date(value).toLocaleString('pt-BR'):'Ainda não executada';

export function AutoSyncSettings({accounts}:{accounts:Account[]}) {
  const [items,setItems]=useState<Schedule[]>([]);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    let cancelled=false;
    async function load(){try{const result=await api<Result>('/mail/auto-sync');if(!cancelled){setItems(result.items);setError('');}}catch(e){if(!cancelled)setError((e as Error).message);}}
    void load();const timer=setInterval(load,15000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[]);
  return <section className="connection-form auto-sync" aria-labelledby="auto-sync-title"><h2 id="auto-sync-title">Sincronização automática</h2>
    <p>Consulta as caixas conectadas enquanto o CRM estiver aberto neste computador. Ao reiniciar, retoma a rotina salva. A primeira consulta acontece em alguns segundos.</p>
    <p>Histórico maior é importado em lotes, com uma continuação por minuto. Falhas têm novas tentativas espaçadas, até uma hora entre consultas.</p>
    {error&&<p className="connection-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div className="account-grid">{items.map(row=><ScheduleCard key={row.account_id} row={row} connected={!!accounts.find(a=>a.id===row.account_id)?.connected} onSaved={result=>{setItems(result.items);setNotice('Rotina salva. Uma consulta que já começou pode terminar mesmo após a pausa.');}}/>)}</div>
  </section>;
}

function ScheduleCard({row,connected,onSaved}:{row:Schedule;connected:boolean;onSaved:(result:Result)=>void}) {
  const [minutes,setMinutes]=useState(row.interval_minutes);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{setMinutes(row.interval_minutes);},[row.version,row.interval_minutes]);
  async function save(enabled:boolean){
    setBusy(true);setError('');
    try{onSaved(await api<Result>('/mail/auto-sync/'+row.account_id,{enabled,interval_minutes:minutes,version:row.version},'PUT'));}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <article><h3>{row.address}</h3><span className="pill">{row.running?'Consulta em andamento':row.enabled?'Rotina ativa':'Rotina pausada'}</span>
    <dl><div><dt>Última consulta automática concluída</dt><dd>{when(row.last_success)}</dd></div>{row.enabled&&<div><dt>Próxima consulta prevista</dt><dd>{when(row.next_run)}</dd></div>}{row.last_success&&<div><dt>Último lote concluído</dt><dd>{row.last_added} novas mensagens{row.has_more?' · há mais histórico':''}</dd></div>}</dl>
    {row.last_error&&<p className="connection-error" role="status">{row.last_error} {row.enabled?'Nova tentativa: '+when(row.next_run):''}</p>}
    <label>Intervalo de {row.account_id}<select value={minutes} disabled={busy} onChange={e=>setMinutes(Number(e.target.value))}>{[5,10,30,60].map(n=><option key={n} value={n}>{n} minutos</option>)}</select></label>
    <div className="editor-actions"><button className="primary" disabled={busy||!connected} onClick={()=>save(true)}>{busy?'Salvando…':row.enabled?'Salvar intervalo':'Ativar rotina'}</button>{row.enabled&&<button disabled={busy} onClick={()=>save(false)}>Pausar rotina</button>}</div>
    {!connected&&<p>Valide a conexão desta caixa para ativar a rotina.</p>}{error&&<p className="connection-error" role="alert">{error}</p>}
  </article>;
}

export function InboxSync({accountId,syncAt,dirty,busy,selected,onRefresh}:{accountId:string;syncAt:string|null;dirty:boolean;busy:boolean;selected:boolean;onRefresh:()=>void}) {
  const [row,setRow]=useState<Schedule|null>(null);
  const [error,setError]=useState('');
  const current=useRef({syncAt,dirty,busy,selected,onRefresh});
  current.current={syncAt,dirty,busy,selected,onRefresh};
  useEffect(()=>{
    let cancelled=false;setRow(null);setError('');
    if(accountId==='demo')return;
    let pending=false;
    async function load(){
      if(pending)return;pending=true;
      try{
        const result=await api<Result>('/mail/auto-sync');
        if(cancelled)return;
        const next=result.items.find(i=>i.account_id===accountId)??null;setRow(next);setError('');
        const view=current.current;
        if(next?.sync_at&&next.sync_at!==view.syncAt&&!view.dirty&&!view.busy&&!view.selected)view.onRefresh();
      }catch(e){if(!cancelled)setError((e as Error).message);}finally{pending=false;}
    }
    void load();const timer=setInterval(load,15000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[accountId]);
  const updated=!!row?.sync_at&&row.sync_at!==syncAt;
  if(!row&&!error)return null;
  return <div className="sync-banner"><div>{error?<p role="status">Estado da rotina indisponível: {error}</p>:row&&<><strong>{row.running?'Consultando o Resend…':row.enabled?'Sincronização automática ativa':'Sincronização automática pausada'}</strong><p>{row.enabled?'Próxima consulta: '+when(row.next_run):'Ative a rotina em Contas e identidades.'}</p>{row.last_error&&<p role="status" className="connection-error">{row.last_error}</p>}</>}
      {updated&&<p role="status">O cache foi atualizado.{dirty?' Salve ou descarte a edição para atualizar a conversa.':' Atualize a visualização para conferir.'}</p>}</div>
    {updated&&<button disabled={dirty||busy} onClick={onRefresh}>Atualizar visualização</button>}
  </div>;
}
