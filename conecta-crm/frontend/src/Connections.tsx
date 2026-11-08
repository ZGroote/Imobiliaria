import {useState} from 'react';
import {api, type Account, type Profile} from './api';
import {SenderChecks} from './SenderChecks';
import {AutoSyncSettings} from './MailSync';

type Props = {accounts:Account[];profiles:Profile[];onConnected:()=>void};

export function Connections({accounts,profiles,onConnected}:Props) {
  const [account,setAccount]=useState('contact');
  const [key,setKey]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  async function connect(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    const supplied=key;setKey('');
    try {await api('/mail/accounts/connect',{account_id:account,api_key:supplied});setNotice('Caixa validada. Agora você pode sincronizar pela Caixa de entrada.');onConnected();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function backup() {
    setBusy(true);setError('');setNotice('');
    try{await api('/mail/backup',{});setNotice('Backup criptografado salvo no computador.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="settings"><h2>Caixas da Conecta</h2><p>Conecte primeiro a caixa de atendimento. O CRM apenas consulta as mensagens; ler aqui não marca a conversa como lida no Resend.</p>
    <div className="account-grid">{accounts.filter(a=>a.id!=='demo').map(a=><article key={a.id}><span className="eyebrow">{a.role}</span><h3>{a.address}</h3><p>Resend{a.sync_at?' · Atualizada em '+new Date(a.sync_at).toLocaleString('pt-BR'):''}</p><span className="pill">{a.id==='noreply'?'Somente notificações':a.connected?'Conexão de leitura validada':'Conexão pendente'}</span></article>)}</div>
    <section className="connection-form" aria-labelledby="connection-title"><h2 id="connection-title">Conectar uma caixa</h2><p>Informe a chave de API do Resend com acesso às Inboxes. Ela será enviada apenas ao aplicativo local e ao próprio Resend para validar a conexão, e guardada no Gerenciador de Credenciais do Windows. Não cole a chave no chat.</p><p>A conexão permite leitura. O único envio real disponível é o teste individual aprovado na seção abaixo. A fila de campanhas permanece em simulação.</p>
      <form onSubmit={connect} autoComplete="off"><label>Caixa<select value={account} disabled={busy} onChange={e=>{setAccount(e.target.value);setKey('');}}><option value="contact">contact@conectaimoveis3d.com</option><option value="team">team@conectaimoveis3d.com</option></select></label><label>Chave de API do Resend<input type="password" autoComplete="off" spellCheck={false} required maxLength={220} value={key} disabled={busy} onChange={e=>setKey(e.target.value)}/></label><button className="primary" disabled={busy||!key.trim()}>{busy?'Validando…':'Validar e guardar conexão'}</button></form>
      {error&&<p className="connection-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    </section>
    <AutoSyncSettings accounts={accounts}/>
    <SenderChecks/>
    <section className="connection-form"><h2>Backup local</h2><p>O cache fica na pasta ConectaCRM dos dados locais do Windows, fora do projeto. Os backups são criptografados e só podem ser abertos pelo mesmo usuário Windows. Não compartilhe esta instalação do CRM com outras pessoas.</p><button disabled={busy} onClick={backup}>Criar backup criptografado</button></section>
    <h2>Uma marca, dois mercados</h2><p>O mercado do destinatário define idioma e site. As campanhas continuam em simulação, mesmo após o teste de conexão.</p><div className="account-grid">{profiles.map(p=><article key={p.id}><span className="eyebrow">PERFIL {p.id} · {p.locale}</span><h3>Conecta Imóveis 3D</h3><p>{p.tagline}</p><p>{p.website}</p><span className="pill">Campanhas em simulação</span></article>)}</div>
  </div>;
}
