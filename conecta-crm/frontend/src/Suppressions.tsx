import {useEffect,useState} from 'react';
import {api} from './api';

type Result={total:number;items:{address:string;reason:string;created_at:string}[]};
const reasons:Record<string,string>={unsubscribe:'Pedido de descadastro',not_interested:'Recusa',manual:'Bloqueio manual'};

export function Suppressions(){
  const [offset,setOffset]=useState(0);
  const [result,setResult]=useState<Result>({total:0,items:[]});
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let cancelled=false;setLoading(true);api<Result>('/suppression?offset='+offset).then(r=>{if(!cancelled)setResult(r);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[offset]);
  return <div className="settings"><h2>Contatos que não devem receber novas abordagens</h2><p>Pedidos claros de descadastro e recusa entram nesta lista durante a importação ou classificação. Os bloqueios valem em todas as caixas do CRM.</p>{error&&<p role="alert">{error}</p>}
    {loading?<p role="status">Carregando bloqueios…</p>:result.total?<div className="suppression-table"><table><thead><tr><th>Endereço</th><th>Motivo</th><th>Registrado em</th></tr></thead><tbody>{result.items.map(item=><tr key={item.address}><td>{item.address}</td><td>{reasons[item.reason]||item.reason}</td><td>{new Date(item.created_at).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div>:<p className="empty">Nenhum contato bloqueado.</p>}
    <div className="pagination"><button disabled={loading||!offset} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Anterior</button><span>{result.total} bloqueios</span><button disabled={loading||offset+50>=result.total} onClick={()=>setOffset(n=>n+50)}>Próxima</button></div>
  </div>;
}
