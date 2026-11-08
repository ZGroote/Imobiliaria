import {useCallback,useEffect,useState} from 'react';
import {api} from './api';
import {DraftEditor} from './DraftEditor';
import {SimulationQueue} from './SimulationQueue';
import {RecipientAuthorizations} from './RecipientAuthorizations';
import {RealOutbox} from './RealOutbox';
import {statusLabels,type Draft,type DraftSummary,type Policy,type ReplyContext,type Template} from './outboundTypes';

export function Outbox({initialReply,onDirtyChange}:{initialReply:ReplyContext|null;onDirtyChange:(dirty:boolean)=>void}){
  const [tab,setTab]=useState('drafts');
  const [realFocus,setRealFocus]=useState<string|null>(null);
  const [items,setItems]=useState<DraftSummary[]>([]);
  const [total,setTotal]=useState(0);
  const [offset,setOffset]=useState(0);
  const [selected,setSelected]=useState<Draft|null>(null);
  const [reply,setReply]=useState(initialReply);
  const [editorKey,setEditorKey]=useState(0);
  const [dirty,setDirty]=useState(false);
  const [policy,setPolicy]=useState<Policy|null>(null);
  const [templates,setTemplates]=useState<Template[]>([]);
  const [revision,setRevision]=useState(0);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const changeDirty=useCallback((value:boolean)=>{setDirty(value);onDirtyChange(value);},[onDirtyChange]);
  useEffect(()=>{let cancelled=false;setLoading(true);Promise.all([api<{items:DraftSummary[];total:number}>('/outbound/drafts?offset='+offset),api<Policy>('/outbound/policy'),api<Template[]>('/outbound/templates')]).then(([d,p,t])=>{if(!cancelled){setItems(d.items);setTotal(d.total);setPolicy(p);setTemplates(t);}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[offset,revision]);
  function canLeave(){return !dirty||window.confirm('Há alterações não salvas. Descartar essas alterações?');}
  async function open(id:string){
    if(!canLeave())return;setError('');
    try{const value=await api<Draft>('/outbound/drafts/'+id);setSelected(value);setReply(null);changeDirty(false);setEditorKey(n=>n+1);}
    catch(e){setError((e as Error).message);}
  }
  function newDraft(){if(canLeave()){setSelected(null);setReply(null);changeDirty(false);setEditorKey(n=>n+1);}}
  function saved(draft:Draft){setSelected(draft);setRevision(n=>n+1);}
  return <div className="outbox"><div className="outbox-tabs">{[['drafts','Rascunhos'],['queue','Fila de simulação'],['authorizations','Autorizações'],['real','Envios reais']].map(([id,label])=><button key={id} className={tab===id?'chosen':''} onClick={()=>{if(tab!==id&&canLeave()){setTab(id);setRealFocus(null);changeDirty(false);}}}>{label}</button>)}<span className="pill">Envio real exige autorização separada</span></div>{error&&<p className="alert error" role="alert">{error}</p>}
    {tab==='authorizations'?<RecipientAuthorizations onDirtyChange={changeDirty}/>:tab==='real'?<RealOutbox focusId={realFocus} onDirtyChange={changeDirty} onChanged={()=>setRevision(n=>n+1)}/>:tab==='queue'?<SimulationQueue policy={policy} onChange={()=>setRevision(n=>n+1)}/>:<div className="outbox-layout"><aside className="draft-list"><div className="editor-heading"><h2>Seus rascunhos</h2><button onClick={newDraft}>Novo</button></div>{loading?<p role="status">Carregando rascunhos…</p>:items.length?items.map(draft=><button className={selected?.id===draft.id?'draft-summary selected':'draft-summary'} key={draft.id} onClick={()=>void open(draft.id)}><strong>{draft.subject||'Sem assunto'}</strong><span>{draft.recipient||'Destinatário pendente'}</span><small>{statusLabels[draft.status]} · v{draft.version} · {draft.profile_id}</small></button>):<p className="empty">Nenhum rascunho salvo.</p>}<div className="pagination"><button disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-25))}>Anterior</button><span>{total}</span><button disabled={offset+25>=total} onClick={()=>setOffset(n=>n+25)}>Próxima</button></div></aside><div className="outbox-editor-column"><DraftEditor key={editorKey} draft={selected} reply={reply} templates={templates} policy={policy} onSaved={saved} onDirty={changeDirty}/>{selected?.status==='approved'&&<button className="primary" disabled={dirty} onClick={()=>{setRealFocus(selected.id);setTab('real');changeDirty(false);}}>Preparar envio autorizado deste texto</button>}</div></div>}
  </div>;
}
