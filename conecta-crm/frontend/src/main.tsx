import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {api, type Account, type Conversation, type Profile, type Thread} from './api';
import './style.css';
import {Connections} from './Connections';
import {InboxSync} from './MailSync';
import {MessageAttachments} from './MessageAttachments';
import {categories,CategoryBadge,ClassificationPanel} from './Classification';
import {Suppressions} from './Suppressions';
import {BrandLibrary} from './BrandLibrary';
import {Outbox} from './Outbox';
import {ResearchJobs} from './ResearchJobs';
import {Companies} from './Companies';
import {Qualifications} from './Qualifications';
import {Opportunities} from './Opportunities';
import {Insights} from './Insights';
import {Projects} from './Projects';
import {ConversationLinks} from './ConversationLinks';
import type {Association,OpportunityIntent} from './commercialTypes';
import type {ReplyContext} from './outboundTypes';

const date = (value:string) => new Date(value).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});

function App() {
  const [page,setPage]=useState('inbox');
  const [replyContext,setReplyContext]=useState<ReplyContext|null>(null);
  const [editorDirty,setEditorDirty]=useState(false);
  const [companyFocus,setCompanyFocus]=useState<string|null>(null);
  const [qualificationFocus,setQualificationFocus]=useState<string|null>(null);
  const [opportunityIntent,setOpportunityIntent]=useState<OpportunityIntent|null>(null);
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [account,setAccount]=useState('contact');
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [folders,setFolders]=useState<{name:string;count:number}[]>([]);
  const [folder,setFolder]=useState('');
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('');
  const [unread,setUnread]=useState(false);
  const [offset,setOffset]=useState(0);
  const [threads,setThreads]=useState<Thread[]>([]);
  const [total,setTotal]=useState(0);
  const [selected,setSelected]=useState('');
  const [conversation,setConversation]=useState<Conversation|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [reading,setReading]=useState(false);
  const [revision,setRevision]=useState(0);
  const refresh=()=>setRevision(n=>n+1);
  const currentAccount=accounts.find(a=>a.id===account);

  useEffect(()=>{Promise.all([api<Account[]>('/mail/accounts'),api<Profile[]>('/brand-profiles')])
    .then(([a,p])=>{setAccounts(a);setProfiles(p);}).catch(e=>setError(e.message));},[revision]);
  useEffect(()=>{
    let cancelled=false; setLoading(true);
    const timeout=setTimeout(()=>{
      const params=new URLSearchParams({account_id:account,folder,q:query,category,unread:String(unread),offset:String(offset)});
      Promise.all([api<{items:Thread[];total:number}>('/mail/threads?'+params),api<{name:string;count:number}[]>('/mail/folders?account_id='+account)])
        .then(([t,f])=>{if(!cancelled){setThreads(t.items);setTotal(t.total);setFolders(f);}})
        .catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    },200);
    return ()=>{cancelled=true;clearTimeout(timeout);};
  },[account,folder,query,category,unread,offset,revision]);
  useEffect(()=>{
    let cancelled=false;setConversation(null);
    if(!selected) {setReading(false);return;}
    setReading(true);
    api<Conversation>('/mail/threads/'+selected).then(c=>{if(!cancelled)setConversation(c);})
      .catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setReading(false);});
    return()=>{cancelled=true;};
  },[selected,revision]);

  async function synchronize() {
    setBusy(true);setError('');setNotice('');
    try {const result=await api<{added:number;mode:string;has_more?:boolean}>('/mail/sync',{account_id:account});setNotice(`${result.added} mensagens ${result.mode==='mock'?'fictícias ':''}adicionadas. ${result.has_more?'Há mais histórico: sincronize novamente para continuar.':'Cache atualizado.'}`);refresh();}
    catch(e){setError((e as Error).message);refresh();}finally{setBusy(false);}
  }
  async function read() {
    try{await api('/mail/threads/'+selected+'/read',{});refresh();setNotice('Conversa marcada como lida no cache local.');}
    catch(e){setError((e as Error).message);}
  }
  async function classifyAccount(){
    setBusy(true);setError('');setNotice('');
    try{const result=await api<{classified:number}>('/classifications/rules/run',{account_id:account});setNotice(`${result.classified} mensagens recebidas analisadas por regras locais. Revise as sugestões.`);refresh();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  function chooseFolder(name:string){if(!mayLeave())return false;setFolder(name);setOffset(0);setSelected('');setError('');return true;}
  function mayLeave(){if(editorDirty&&!window.confirm('Há alterações não salvas. Descartar?'))return false;setEditorDirty(false);return true;}
  function navigate(target:string){if(target===page||!mayLeave())return;setCompanyFocus(null);setQualificationFocus(null);setOpportunityIntent(null);setReplyContext(null);setPage(target);}
  function openCompany(id:string){if(!mayLeave())return;setCompanyFocus(id);setPage('companies');}
  function openQualification(id:string){if(!mayLeave())return;setQualificationFocus(id);setPage('qualification');}
  function openOpportunity(intent:OpportunityIntent){if(!mayLeave())return;setOpportunityIntent(intent);setPage('opportunities');}
  function openThread(link:Association){if(!mayLeave())return;setAccount(link.account_id);setFolder('');setQuery('');setCategory('');setUnread(false);setOffset(0);setSelected(link.thread_id);setPage('inbox');}
  async function reply(){if(!mayLeave())return;try{const context=await api<ReplyContext>('/outbound/reply-context/'+selected);setReplyContext(context);setPage('outbox');}catch(e){setError((e as Error).message);}}

  return <div className="app">
    <aside className="navigation">
      <div className="brand"><strong>CONECTA</strong><span>IMÓVEIS <b>3D</b></span><small>UMA NOVA PERSPECTIVA.</small></div>
      <p className="nav-label">ESPAÇO PESSOAL</p>
      <nav aria-label="Navegação principal">
        <button className={page==='inbox'?'active':''} onClick={()=>navigate('inbox')}>Caixa de entrada</button>
        <button className={page==='outbox'?'active':''} onClick={()=>navigate('outbox')}>Rascunhos e fila</button>
        <button className={page==='jobs'?'active':''} onClick={()=>navigate('jobs')}>Tarefas assistidas</button>
        <button className={page==='companies'?'active':''} onClick={()=>navigate('companies')}>Empresas</button>
        <button className={page==='qualification'?'active':''} onClick={()=>navigate('qualification')}>Qualificação comercial</button>
        <button className={page==='insights'?'active':''} onClick={()=>navigate('insights')}>Indicadores</button>
        <button className={page==='opportunities'?'active':''} onClick={()=>navigate('opportunities')}>Oportunidades</button>
        <button className={page==='projects'?'active':''} onClick={()=>navigate('projects')}>Projetos e entregas</button>
        <button className={page==='settings'?'active':''} onClick={()=>navigate('settings')}>Contas e identidades</button>
        <button className={page==='suppression'?'active':''} onClick={()=>navigate('suppression')}>Bloqueios de contato</button>
        <button className={page==='brand'?'active':''} onClick={()=>navigate('brand')}>Biblioteca da marca</button>
        <button className={page==='roadmap'?'active':''} onClick={()=>navigate('roadmap')}>Plano do projeto</button>
      </nav>
      <div className="nav-footer"><span className="status-dot"/> Aplicação local<small>Campanhas em simulação</small></div>
    </aside>
    <main>
      <header className="topbar"><div><span className="eyebrow">CRM PESSOAL / CONECTA</span><h1>{page==='inbox'?'Caixa de entrada':page==='outbox'?'Rascunhos e fila':page==='jobs'?'Tarefas assistidas':page==='companies'?'Empresas':page==='qualification'?'Qualificação comercial':page==='opportunities'?'Oportunidades':page==='projects'?'Projetos e entregas':page==='insights'?'Indicadores':page==='settings'?'Contas e identidades':page==='suppression'?'Bloqueios de contato':page==='brand'?'Biblioteca da marca':'Plano do projeto'}</h1></div><span className="stage">ETAPA 13 · QUALIFICAÇÃO COMERCIAL</span></header>
      {error&&<div className="alert error" role="alert">{error}</div>}
      {notice&&<div className="alert" role="status">{notice}</div>}
      {page==='inbox'?<>
        <div className="toolbar">
          <label>Conta<select disabled={busy} value={account} onChange={e=>{if(!chooseFolder(''))return;setAccount(e.target.value);setQuery('');setCategory('');setNotice('');}}>{accounts.filter(a=>a.id!=='noreply').map(a=><option key={a.id} value={a.id}>{a.address}{a.id==='demo'?' · demonstração':a.connected?' · leitura conectada':' · conexão pendente'}</option>)}</select></label>
          <label className="search">Buscar no cache<input type="search" placeholder="Remetente, assunto ou conteúdo…" value={query} onChange={e=>{setQuery(e.target.value);setOffset(0);setSelected('');}}/></label>
          <button className="primary" disabled={busy||editorDirty||!currentAccount?.connected} onClick={synchronize}>{busy?'Sincronizando…':account==='demo'?'Sincronizar demonstração':'Sincronizar caixa'}</button>
        </div>
        <div className="triage-toolbar"><label>Classificação<select value={category} onChange={e=>{if(!mayLeave())return;setCategory(e.target.value);setOffset(0);setSelected('');}}><option value="">Todas as categorias</option>{categories.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><button disabled={busy||editorDirty} onClick={classifyAccount}>Classificar caixa por regras</button><small>Novas mensagens são triadas durante a importação.</small></div>
        <div className="mode-banner">{account==='demo'?'Ambiente de demonstração · todas as mensagens são fictícias.':currentAccount?.connected?'Leitura do Resend · consultas em lotes. Nenhuma alteração é feita na caixa remota.':'Conecte esta caixa em Contas e identidades para importar suas conversas.'}</div>
        <InboxSync accountId={account} syncAt={currentAccount?.sync_at??null} dirty={editorDirty} busy={busy} selected={!!selected} onRefresh={refresh}/>
        <section className="mail-layout" aria-label="Correio">
          <aside className="folders"><h2>Pastas</h2><button className={!folder?'chosen':''} onClick={()=>chooseFolder('')}>Todas as conversas</button>{folders.map(f=><button className={folder===f.name?'chosen':''} key={f.name} onClick={()=>chooseFolder(f.name)}>{f.name}<span>{f.count}</span></button>)}<p>O provedor permanece inalterado. A leitura é feita no cache local.</p></aside>
          <section className="thread-list" aria-label="Lista de conversas" aria-busy={loading}>
            <div className="list-heading"><h2>{total} conversas</h2><label className="checkbox"><input type="checkbox" checked={unread} onChange={e=>{setUnread(e.target.checked);setOffset(0);}}/> Não lidas</label></div>
            {loading?<p className="empty" role="status">Carregando conversas…</p>:threads.length?threads.map(t=><button key={t.id} className={'thread '+(selected===t.id?'selected':'')} onClick={()=>{if(t.id!==selected&&mayLeave())setSelected(t.id);}} aria-pressed={selected===t.id}>
              <div className="thread-meta"><strong>{t.sender}</strong><time>{date(t.last_at)}</time></div><div className="subject">{t.unread_count>0&&<span aria-label="Não lida" className="unread-dot"/>}{t.subject}</div><p>{t.snippet}</p><span className="message-count">{t.message_count} mensagens{account==='demo'?' · exemplo fictício':''}</span>
              <CategoryBadge value={t.classification}/>
            </button>):<div className="empty"><h3>{query||category||unread||folder?'Nenhuma conversa encontrada':account==='demo'?'Sua caixa de demonstração está pronta':currentAccount?.connected?'Seu cache está pronto':'Aguardando conexão'}</h3><p>{query||category||unread||folder?'Experimente outros termos ou remova os filtros.':account==='demo'?'Use “Sincronizar demonstração” para carregar 100 mensagens fictícias e testar as conversas.':currentAccount?.connected?'Use “Sincronizar caixa” para buscar as conversas do Resend.':'Abra Contas e identidades para validar a conexão.'}</p></div>}
            <div className="pagination"><button disabled={offset===0||loading} onClick={()=>setOffset(n=>Math.max(0,n-25))}>Anterior</button><span>{total?`${offset+1}–${Math.min(offset+25,total)}`:'0'} de {total}</span><button disabled={offset+25>=total||loading} onClick={()=>setOffset(n=>n+25)}>Próxima</button></div>
          </section>
          <section className="reader" aria-label="Leitura da conversa" aria-busy={reading}>
            {reading?<div className="empty" role="status">Abrindo conversa…</div>:conversation?<><div className="reader-heading"><span className="eyebrow">CONVERSA</span><h2>{conversation.subject}</h2><div className="editor-actions"><button disabled={editorDirty} onClick={read}>Marcar como lida localmente</button><button disabled={editorDirty} onClick={reply}>Preparar resposta</button></div></div><ConversationLinks key={conversation.id+'-commercial'} threadId={conversation.id} onCompany={openCompany} onOpportunity={openOpportunity}/><ClassificationPanel key={conversation.id} value={conversation.classification} threadId={conversation.id} accountId={account} messages={conversation.messages} onDirtyChange={setEditorDirty} onChange={refresh}/>{conversation.messages.map(m=><article id={'message-'+m.id} className="message" key={m.id}><header><strong>{m.sender}</strong><time>{date(m.received_at)}</time><span>Para: {m.recipient}</span></header><div className="body-text">{m.body_text}</div><MessageAttachments message={m} accountId={account}/></article>)}</>:<div className="empty reader-empty"><span className="letter" aria-hidden="true">C</span><h2>Uma conversa por vez.</h2><p>Selecione uma mensagem para ver o histórico completo aqui.</p><small>Texto seguro · imagens externas bloqueadas · anexos recebidos sob demanda</small></div>}
          </section>
        </section>
      </>:page==='outbox'?<Outbox initialReply={replyContext} onDirtyChange={setEditorDirty}/>:page==='jobs'?<ResearchJobs onDirtyChange={setEditorDirty}/>:page==='companies'?<Companies focusId={companyFocus} onQualify={openQualification} onOpportunity={openOpportunity} onThread={openThread} onDirtyChange={setEditorDirty}/>:page==='qualification'?<Qualifications focusId={qualificationFocus} onDirtyChange={setEditorDirty}/>:page==='insights'?<Insights onOpportunity={openOpportunity}/>:page==='projects'?<Projects onOpportunity={openOpportunity}/>:page==='opportunities'?<Opportunities intent={opportunityIntent} onDirtyChange={setEditorDirty} onCompany={openCompany} onThread={openThread}/>:page==='settings'?<Connections accounts={accounts} profiles={profiles} onConnected={refresh}/>:page==='suppression'?<Suppressions/>:page==='brand'?<BrandLibrary/>:<div className="settings"><h2>Desenvolvimento por etapas</h2><ol className="roadmap">{['Caixa local, banco, busca e conversas — disponível','Leitura do Resend — conexão disponível nas configurações','Classificação, bloqueios e biblioteca da marca — disponíveis','Rascunhos, revisão e simulação — disponíveis; teste individual de envio disponível','Tarefas assistidas — prompt, contrato JSON, importação e revisão disponíveis','Empresas — cadastro após conferência humana e vínculo entre estados disponíveis','Oportunidades e vínculos manuais com conversas — disponíveis; sem envio automático','Propostas revisadas, exportação Word e indicadores locais — disponíveis','Produção, briefing, entrega e pós-venda — acompanhamento manual disponível','Revisão humana de mensagens e contagens de respostas confirmadas — disponíveis','Contatos e empreendimentos por empresa — fontes e histórico disponíveis','Sincronização automática — intervalo, pausa e novas tentativas disponíveis enquanto o CRM está aberto','Anexos recebidos — consulta e download sob demanda disponíveis, até 20 MB por arquivo','Análise assistida de trechos — pacotes revisados e importação de sugestões com citações disponíveis','Qualificação comercial — notas manuais com fontes, pesos configuráveis e histórico disponíveis','Pesquisa automática e execução isolada de agentes — pendentes'].map((step,i)=><li key={step}><span>{String(i+1).padStart(2,'0')}</span>{step}</li>)}</ol><p>A fila comercial continua em simulação. O Resend proíbe cold outreach e mensagens não solicitadas. <a href="https://resend.com/legal/acceptable-use" target="_blank" rel="noopener noreferrer">Consultar política do provedor</a>.</p></div>}
    </main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
