import type {ResearchCompany,Source} from './researchTypes';

const kinds:Record<string,string>={developer:'Incorporadora',integrated_developer_builder:'Incorporadora e construtora',general_contractor:'Construtora contratada',broker:'Corretora',unknown:'Não confirmado'};
const stages:Record<string,string>={under_review:'Em análise',approved:'Aprovado',under_construction:'Em construção',completed_active_sales:'Concluído com venda ativa',unknown:'Estágio não confirmado'};
function SourceLink({source}:{source:Source}){return <p className="source-link"><a href={source.source_url} target="_blank" rel="noopener noreferrer">{source.source_title}</a><small>Observado em {new Date(source.observed_at).toLocaleString('pt-BR')} · confiança declarada {Math.round(source.confidence*100)}%</small></p>;}

export function ResearchSources({value}:{value:ResearchCompany}){
  return <div className="research-sources"><p>{kinds[value.company_type]} · porte {value.size_tier==='small_medium'?'pequeno/médio':value.size_tier==='large'?'grande':'não confirmado'} · atuação declarada: {value.states_active.join(', ')}</p><p><a href={value.website} target="_blank" rel="noopener noreferrer">{value.website}</a></p>
    <h4>Evidências para conferência</h4>{value.evidence.map((e,i)=><div className="research-source" key={i}><p>{e.claim}</p>{e.document_date&&<small>Data do documento: {e.document_date}</small>}<SourceLink source={e}/></div>)}
    <h4>Empreendimentos ({value.projects.length})</h4>{value.projects.length?value.projects.map((p,i)=><div className="research-source" key={i}><strong>{p.name}</strong><p>{p.address&&p.address+' · '}{p.city}, {p.state} · {p.building_type}<br/>{stages[p.stage]}{p.stage_as_of?' · referência '+p.stage_as_of:''}</p><SourceLink source={p}/></div>):<p>Nenhum empreendimento confirmado nesta pesquisa.</p>}
    <h4>Contatos publicados ({value.contacts.length})</h4>{value.contacts.length?value.contacts.map((c,i)=><div className="research-source" key={i}><strong>{c.name}</strong><p>{c.role} · {c.email}</p><SourceLink source={c}/></div>):<p>Nenhum contato confirmado. Não criar e-mails por suposição.</p>}
  </div>;
}
