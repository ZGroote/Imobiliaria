import {useState} from 'react';
import {api,attachmentFile,type Message} from './api';

type FileInfo={id:string;name:string;size:number|null;downloadable:boolean};
const sizeLabel=(size:number|null)=>size===null?'tamanho não informado':size<1024?size+' bytes':size<1024*1024?Math.ceil(size/1024)+' KB':(size/(1024*1024)).toLocaleString('pt-BR',{maximumFractionDigits:1})+' MB';

export function MessageAttachments({message,accountId}:{message:Message;accountId:string}){
  const [items,setItems]=useState<FileInfo[]|null>(null),[busy,setBusy]=useState(false),[downloading,setDownloading]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  if(!message.attachments.length)return null;
  const available=accountId!=='demo'&&message.direction==='inbound';
  async function consult(){
    setBusy(true);setError('');setNotice('');
    try{const result=await api<{items:FileInfo[]}>('/mail/messages/'+encodeURIComponent(message.id)+'/attachments?account_id='+encodeURIComponent(accountId));setItems(result.items);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function download(file:FileInfo){
    setBusy(true);setDownloading(file.id);setError('');setNotice('');
    try{
      const result=await attachmentFile(message.id,file.id,accountId);
      const url=URL.createObjectURL(result.blob),anchor=document.createElement('a');
      anchor.href=url;anchor.download=result.name;anchor.click();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      setNotice('Arquivo “'+result.name+'” preparado para baixar no navegador. Ele não foi aberto pelo CRM.');
    }catch(e){setError((e as Error).message);}finally{setBusy(false);setDownloading('');}
  }
  return <section className="message-attachments" aria-label="Anexos desta mensagem"><h3>Anexos</h3>
    {items===null?message.attachments.map((file,i)=><p className="attachment" key={i}>{file.name} · {sizeLabel(file.size)} · não baixado</p>):items.length?items.map(file=><div className="attachment attachment-download" key={file.id}><div><strong>{file.name}</strong><span>{file.downloadable?sizeLabel(file.size):'Excede o limite de 20 MB'}</span></div><button disabled={busy||!file.downloadable} onClick={()=>download(file)}>{downloading===file.id?'Baixando…':'Baixar '+file.name}</button></div>):<p>Nenhum anexo disponível nessa mensagem no provedor.</p>}
    {available?<><p className="form-hint">Até 20 MB por arquivo. A consulta verifica os anexos; os arquivos são baixados somente ao clicar em Baixar.</p><button disabled={busy} onClick={consult}>{busy&&!downloading?'Consultando anexos…':items===null?'Consultar anexos para download':'Consultar anexos novamente'}</button></>:<p className="form-hint">{accountId==='demo'?'Metadados fictícios; não há arquivo para baixar.':'O download nesta etapa está disponível para mensagens recebidas.'}</p>}
    {error&&<p role="alert" className="connection-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </section>;
}
