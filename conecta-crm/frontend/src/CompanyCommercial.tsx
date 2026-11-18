import {useEffect,useState} from 'react';
import {api} from './api';
import {CommercialHistory} from './CommercialHistory';
import {calendarDate,stageLabels,type Association,type CommercialEvent,type CompanyRef,type OpportunityIntent} from './commercialTypes';

type Context=CompanyRef&{opportunities:{id:string;title:string;stage:string;next_step:string;due_on:string|null}[];links:Association[];history:CommercialEvent[]};
export function CompanyCommercial({company,onOpportunity,onThread}:{company:CompanyRef;onOpportunity:(intent:OpportunityIntent)=>void;onThread:(link:Association)=>void}){
  const [value,setValue]=useState<Context|null>(null),[error,setError]=useState('');
  useEffect(()=>{let cancelled=false;setValue(null);setError('');api<Context>('/companies/'+company.id+'/commercial').then(r=>{if(!cancelled)setValue(r);}).catch(e=>{if(!cancelled)setError(e.message);});return()=>{cancelled=true;};},[company.id]);
  return <section className="company-commercial"><div className="editor-heading"><h3>Relacionamento comercial</h3><button onClick={()=>onOpportunity({company})}>Nova oportunidade para esta empresa</button></div>{error&&<p className="alert error" role="alert">{error}</p>}{!value&&!error?<p role="status">Carregando relacionamento…</p>:value&&<><h4>Oportunidades ({value.opportunities.length})</h4>{value.opportunities.length?value.opportunities.map(item=><button className="opportunity-summary" key={item.id} onClick={()=>onOpportunity({id:item.id})}><strong>{item.title}</strong><span>{stageLabels[item.stage]}</span><small>{item.next_step}{item.due_on?' · '+calendarDate(item.due_on):''}</small></button>):<p>Ainda não há negociação registrada.</p>}<h4>Conversas ({value.links.length})</h4>{value.links.length?value.links.map(item=><button className="linked-conversation" key={item.id} onClick={()=>onThread(item)}>{item.subject}<small>{item.account_id}{item.opportunity_title?' · '+item.opportunity_title:''}</small></button>):<p>Abra uma conversa na caixa de entrada e use o vínculo manual para associá-la à empresa.</p>}<CommercialHistory items={value.history}/></>}</section>;
}
