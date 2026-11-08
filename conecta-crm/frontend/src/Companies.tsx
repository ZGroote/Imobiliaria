import {useCallback,useEffect,useState} from 'react';
import {api} from './api';
import {ResearchSources} from './ResearchSources';
import type {ResearchCompany} from './researchTypes';
import {CompanyCommercial} from './CompanyCommercial';
import {CompanyDirectory} from './CompanyDirectory';
import type {Association,OpportunityIntent} from './commercialTypes';

type Company={id:string;name:string;domain:string;website:string;states:string[]};
type Detail=Company&{sources:{id:string;job_id:string;payload:ResearchCompany;reviewed_at:string;review_note:string}[]};

export function Companies({focusId,onQualify,onOpportunity,onThread,onDirtyChange}:{focusId:string|null;onQualify:(id:string)=>void;onOpportunity:(intent:OpportunityIntent)=>void;onThread:(link:Association)=>void;onDirtyChange:(value:boolean)=>void}){
  const [states,setStates]=useState<Record<string,string>>({}),[state,setState]=useState(''),[query,setQuery]=useState('');
  const [items,setItems]=useState<Company[]>([]),[total,setTotal]=useState(0),[offset,setOffset]=useState(0),[selected,setSelected]=useState<Detail|null>(null);
  const [error,setError]=useState(''),[loading,setLoading]=useState(true);
  const [dirty,setDirty]=useState(false),[directoryRevision,setDirectoryRevision]=useState(0);
  const formDirty=useCallback((value:boolean)=>{setDirty(value);onDirtyChange(value);},[onDirtyChange]);
  function canSwitch(){if(dirty){setError('Salve ou descarte a edição do cadastro antes de trocar de empresa.');return false;}return true;}
  useEffect(()=>{api<{states:Record<string,string>}>('/jobs/options').then(r=>setStates(r.states)).catch(e=>setError(e.message));},[]);
  useEffect(()=>{let cancelled=false;setLoading(true);const timer=setTimeout(()=>{api<{items:Company[];total:number}>('/companies?'+new URLSearchParams({state,q:query,offset:String(offset)})).then(r=>{if(!cancelled){setItems(r.items);setTotal(r.total);setError('');}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});},200);return()=>{cancelled=true;clearTimeout(timer);};},[state,query,offset]);
  async function open(id:string){if(!canSwitch())return;setError('');try{setSelected(await api<Detail>('/companies/'+id));}catch(e){setError((e as Error).message);}}
  useEffect(()=>{if(focusId)void open(focusId);},[focusId]);
  return <div className="research-page"><p>Empresas cadastradas após revisão das fontes pelo operador. O cadastro não autoriza contato e não inicia envios.</p><div className="editor-fields"><label>Buscar empresa ou domínio<input type="search" value={query} onChange={e=>{if(!canSwitch())return;setQuery(e.target.value);setOffset(0);setSelected(null);}}/></label><label>Estado de atuação<select value={state} onChange={e=>{if(!canSwitch())return;setState(e.target.value);setOffset(0);setSelected(null);}}><option value="">Todos os estados</option>{Object.entries(states).map(([id,name])=><option key={id} value={id}>{id} · {name}</option>)}</select></label></div>{error&&<p role="alert" className="alert error">{error}</p>}
    <div className="research-layout"><section className="research-card"><h2>{total} empresas</h2>{loading?<p role="status">Carregando…</p>:items.length?items.map(company=><button className="draft-summary" key={company.id} onClick={()=>open(company.id)}><strong>{company.name}</strong><span>{company.domain} · {company.states.join(', ')}</span></button>):<p>Nenhuma empresa cadastrada com estes filtros. Revise candidatos em Tarefas assistidas para começar.</p>}<div className="pagination"><button disabled={loading||!offset} onClick={()=>setOffset(n=>Math.max(0,n-25))}>Anterior</button><span>{total} empresas</span><button disabled={loading||offset+25>=total} onClick={()=>setOffset(n=>n+25)}>Próxima</button></div></section>
    {selected&&<section className="research-card"><h2>{selected.name}</h2><div className="editor-actions"><button disabled={dirty} onClick={()=>onQualify(selected.id)}>Qualificar empresa</button></div><span className="pill">Revisada pelo operador · envio desabilitado</span><CompanyDirectory key={selected.id} company={selected} sources={selected.sources} onDirtyChange={formDirty} onChanged={()=>{setError('');setDirectoryRevision(n=>n+1);}}/><CompanyCommercial key={selected.id+'-'+directoryRevision} company={selected} onOpportunity={onOpportunity} onThread={onThread}/>{selected.sources.map(source=><details key={source.id} open><summary>Pesquisa revisada em {new Date(source.reviewed_at).toLocaleString('pt-BR')}</summary><p className="form-hint">Tarefa {source.job_id}{source.review_note?' · '+source.review_note:''}</p><ResearchSources value={source.payload}/></details>)}</section>}</div>
  </div>;
}
