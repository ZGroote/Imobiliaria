import {useEffect, useState} from 'react';
import {api} from './api';
import {buildingTypes, developmentStages} from './directoryTypes';

type Counts = Record<string, number>;
type Evidence = {
  id: string; name: string; city: string; state: string; building_type: string;
  stage: string; stage_as_of: string | null; source_title: string; source_url: string; observed_at: string;
};
type Portfolio = {total: number; by_state: Counts; by_type: Counts; by_stage: Counts; evidence: Evidence[]};
const stageDate = new Intl.DateTimeFormat('pt-BR', {timeZone: 'UTC'});

function Breakdown({title, counts, labels = {}}: {title: string; counts: Counts; labels?: Record<string, string>}) {
  return <div>
    <h4>{title}</h4>
    <dl className="portfolio-counts">{Object.entries(counts)
      .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
      .map(([key, count]) => <div key={key}><dt>{labels[key] ?? key}</dt><dd>{count}</dd></div>)}</dl>
  </div>;
}

export function CompanyPortfolio({companyId}: {companyId: string}) {
  const [data, setData] = useState<Portfolio | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<Portfolio>('/companies/' + encodeURIComponent(companyId) + '/portfolio').then(value => {
      if (active) setData(value);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [companyId]);
  return <section className="company-portfolio">
    <h3>Panorama do portfólio</h3>
    <p>Resumo dos empreendimentos cadastrados nesta ficha. A contagem não mede o portfólio completo nem a frequência de lançamentos da empresa.</p>
    {error ? <p role="alert" className="alert error">{error}</p> : !data ? <p role="status">Carregando portfólio…</p> :
      !data.total ? <p>Nenhum empreendimento cadastrado. Confira as fontes e salve os empreendimentos em Cadastro e fontes.</p> : <>
        <p><strong>{data.total}</strong> {data.total === 1 ? 'empreendimento cadastrado' : 'empreendimentos cadastrados'}</p>
        <div className="portfolio-breakdowns">
          <Breakdown title="Por estado" counts={data.by_state}/>
          <Breakdown title="Por tipologia" counts={data.by_type} labels={buildingTypes}/>
          <Breakdown title="Por estágio registrado" counts={data.by_stage} labels={developmentStages}/>
        </div>
        <h4>Fontes observadas mais recentemente ({data.evidence.length} de {data.total})</h4>
        <p className="form-hint">A data de consulta da fonte e a data de referência do estágio podem ser diferentes. O estágio atual precisa ser conferido na fonte.</p>
        {data.evidence.map(item => <article className="research-source" key={item.id}>
          <strong>{item.name}</strong>
          <p>{item.city}, {item.state} · {buildingTypes[item.building_type]}</p>
          <p>{developmentStages[item.stage]}{item.stage !== 'unknown' && item.stage_as_of && ' · referência em ' + stageDate.format(new Date(item.stage_as_of))}</p>
          <p className="source-link"><a href={item.source_url} target="_blank" rel="noopener noreferrer">{item.source_title}</a>
            <small>Fonte consultada em {new Date(item.observed_at).toLocaleString('pt-BR')}</small></p>
        </article>)}
      </>}
  </section>;
}
