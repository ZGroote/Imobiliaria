import {useEffect,useState} from 'react';
import {api} from './api';

type Report={account_id:string;from_address:string;domain:string;domain_status:string;spf:string;dkim:string;dmarc_status:string;dmarc_policy:string|null;ready_for_test:boolean;checked_at:string;issues:string[];warnings:string[]};
type Test={id:string;account_id:string;status:string;content_hash:string;created_at:string;provider_id:string|null;provider_event:string|null;received_at:string|null;error_code:string;payload:{from_address:string;reply_to:string;recipient:string;profile_id:string;subject:string;body_text:string}};
const states:Record<string,string>={pending:'Aguardando sua aprovação',sending:'Tentativa em andamento',accepted:'Aceito pelo Resend; confira o recebimento',delivered:'O provedor informou entrega; confira sua caixa',received:'Recebimento confirmado por você',failed:'Teste recusado ou com falha',delivery_unknown:'Resultado incerto; não haverá repetição automática'};
const dnsStates:Record<string,string>={verified:'Confirmado pelo Resend',unverified:'Pendente no Resend',unknown:'Não confirmado',found:'Encontrado',missing:'Não encontrado',invalid:'Inválido'};

export function SenderChecks(){
  const [account,setAccount]=useState('contact');
  const [profile,setProfile]=useState('BR');
  const [recipient,setRecipient]=useState('');
  const [owner,setOwner]=useState(false);
  const [reports,setReports]=useState<Report[]>([]);
  const [tests,setTests]=useState<Test[]>([]);
  const [approved,setApproved]=useState<Record<string,boolean>>({});
  const [receipts,setReceipts]=useState<Record<string,boolean>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  async function refresh(){const [r,t]=await Promise.all([api<{items:Report[]}>('/mail/sender-diagnostics'),api<Test[]>('/mail/sender-tests')]);setReports(r.items);setTests(t);}
  useEffect(()=>{void refresh().catch(e=>setError(e.message));},[]);
  async function action(path:string,body?:unknown){
    setBusy(true);setError('');setNotice('');
    try{await api(path,body);await refresh();setNotice(path.endsWith('/send')?'Tentativa registrada. Confira o resultado abaixo.':path.endsWith('/received')?'Recebimento registrado. A fila de campanhas continua em simulação.':path.endsWith('/check')?'Diagnóstico atualizado.':'Prévia e resultados atualizados.');}
    catch(e){setError((e as Error).message);try{await refresh();}catch{}}
    finally{setBusy(false);}
  }
  const report=reports.find(r=>r.account_id===account);
  return <section className="connection-form sender-checks" aria-labelledby="sender-check-title"><h2 id="sender-check-title">Verificar remetente e testar conexão</h2><p>Confira o domínio e prepare uma mensagem para um endereço seu. Preparar a prévia não envia nada. A fila de prospecção continua em simulação.</p>
    <div className="editor-fields"><label>Remetente para o teste<select disabled={busy} value={account} onChange={e=>setAccount(e.target.value)}><option value="contact">contact@conectaimoveis3d.com</option><option value="team">team@conectaimoveis3d.com</option></select></label><label>Idioma do teste<select disabled={busy} value={profile} onChange={e=>setProfile(e.target.value)}><option value="BR">Português · perfil BR</option><option value="US">Inglês · perfil US</option></select></label></div><button disabled={busy} onClick={()=>action('/mail/sender-diagnostics/check',{account_id:account})}>{busy?'Verificando…':'Verificar domínio do remetente'}</button>
    {report&&<div className="sender-report"><span className="pill">{report.ready_for_test?'Pronto para um teste aprovado':'Diagnóstico com pendências'}</span><p>{report.domain} · consulta em {new Date(report.checked_at).toLocaleString('pt-BR')}</p><dl><dt>SPF</dt><dd>{dnsStates[report.spf]||'Não confirmado'}</dd><dt>DKIM</dt><dd>{dnsStates[report.dkim]||'Não confirmado'}</dd><dt>DMARC</dt><dd>{dnsStates[report.dmarc_status]||'Não confirmado'}{report.dmarc_policy?' · política '+report.dmarc_policy:''}</dd></dl>{report.issues.length>0&&<ul>{report.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>}{report.warnings.map(warning=><p className="form-hint" key={warning}>{warning}</p>)}</div>}
    <div className="prepare-test"><h3>Preparar uma mensagem de teste</h3><label>Seu endereço para receber o teste<input type="email" maxLength={254} disabled={busy} value={recipient} onChange={e=>{setRecipient(e.target.value);setOwner(false);}}/></label><label className="checkbox"><input type="checkbox" disabled={busy} checked={owner} onChange={e=>setOwner(e.target.checked)}/> Este endereço é meu e posso conferir a mensagem recebida.</label><button disabled={busy||!owner||!recipient.trim()} onClick={()=>action('/mail/sender-tests',{account_id:account,profile_id:profile,recipient,owner_confirmed:true})}>Preparar prévia · não envia</button></div>
    {error&&<p className="alert error" role="alert">{error}</p>}{notice&&<p className="alert" role="status">{notice}</p>}
    {tests.filter(test=>test.account_id===account).map(test=><article className="sender-test" key={test.id}><span className="pill">{states[test.status]||'Revisão necessária'}</span><dl><dt>De</dt><dd>{test.payload.from_address}</dd><dt>Responder para</dt><dd>{test.payload.reply_to}</dd><dt>Para</dt><dd>{test.payload.recipient}</dd></dl><h3>{test.payload.subject}</h3><pre>{test.payload.body_text}</pre>
      {test.status==='pending'&&<><label className="checkbox"><input type="checkbox" disabled={busy} checked={!!approved[test.id]} onChange={e=>setApproved({...approved,[test.id]:e.target.checked})}/> Li esta prévia e autorizo o envio desta única mensagem de teste ao endereço mostrado.</label><button className="primary" disabled={busy||!approved[test.id]||!reports.find(r=>r.account_id===test.account_id)?.ready_for_test} onClick={()=>action(`/mail/sender-tests/${test.id}/send`,{confirm:true,content_hash:test.content_hash})}>Enviar este teste real</button>{!report?.ready_for_test&&<p className="form-hint">Verifique o domínio e resolva as pendências antes de enviar.</p>}</>}
      {test.provider_id&&<button disabled={busy} onClick={()=>action(`/mail/sender-tests/${test.id}/refresh`,{})}>Atualizar resultado no Resend</button>}
      {['accepted','delivered','delivery_unknown'].includes(test.status)&&<div className="confirm-receipt"><label className="checkbox"><input type="checkbox" disabled={busy} checked={!!receipts[test.id]} onChange={e=>setReceipts({...receipts,[test.id]:e.target.checked})}/> Conferi minha caixa de e-mail e recebi esta mensagem.</label><button disabled={busy||!receipts[test.id]} onClick={()=>action(`/mail/sender-tests/${test.id}/received`,{confirm:true,content_hash:test.content_hash})}>Confirmar recebimento</button></div>}
      {test.status==='delivery_unknown'&&<p className="form-hint">Confira a caixa de entrada e o spam. Uma nova tentativa não será feita automaticamente.</p>}
      {test.status==='failed'&&<p className="form-hint">O envio não foi confirmado. Confira as permissões e os limites do provedor antes de preparar outro teste.</p>}
    </article>)}
  </section>;
}
