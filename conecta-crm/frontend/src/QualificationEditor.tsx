import {useEffect,useState} from 'react';
import {api} from './api';
import {factorHints,factorKeys,statusLabels,when,type Criteria,type FactorKey,type Qualification,type Source} from './qualificationTypes';

function SourceLink({source}:{source:Source}){
  return <span className="qualification-source"><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a><small>{source.name} · {source.kind} · observada em {when(source.observed_at)}</small></span>;
}

export function QualificationEditor({initial,onDirtyChange,onSaved,onReload}:{initial:Qualification;onDirtyChange:(dirty:boolean)=>void;onSaved:(value:Qualification)=>void;onReload:()=>void}){
  const [criteria,setCriteria]=useState<Criteria>(()=>structuredClone(initial.assessment.criteria));
  const [note,setNote]=useState(initial.assessment.note),[confirmed,setConfirmed]=useState(false);
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{onDirtyChange(dirty||busy);},[dirty,busy,onDirtyChange]);
  function change(key:FactorKey,value:Partial<Criteria[FactorKey]>){setCriteria(c=>({...c,[key]:{...c[key],...value}}));setDirty(true);setConfirmed(false);}
  function toggle(key:FactorKey,id:string){const ids=criteria[key].source_ids;change(key,{source_ids:ids.includes(id)?ids.filter(s=>s!==id):[...ids,id]});}
  const pending=factorKeys.filter(key=>criteria[key].points===null).length;
  const known=factorKeys.reduce((sum,key)=>sum+(criteria[key].points??0),0);
  const capacity=factorKeys.reduce((sum,key)=>sum+(criteria[key].points===null?0:initial.policy.weights[key]),0);
  const invalid=factorKeys.some(key=>{const f=criteria[key];return f.points!==null&&(!Number.isInteger(f.points)||f.points<0||f.points>initial.policy.weights[key]||f.reason.trim().length<5||!f.source_ids.length);})||factorKeys.some(key=>criteria[key].source_ids.some(id=>!initial.sources.some(s=>s.id===id)));
  const meaningful=note.trim()||factorKeys.some(key=>{const f=criteria[key];return f.points!==null||f.reason.trim()||f.source_ids.length;});
  async function save(){setBusy(true);setError('');try{const value=await api<Qualification>('/qualifications/companies/'+initial.company.id,{version:initial.assessment.version,policy_version:initial.policy.version,basis_hash:initial.basis_hash,criteria,note,sources_confirmed:confirmed},'PUT');setDirty(false);onDirtyChange(false);onSaved(value);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="research-card qualification-editor" aria-label="Avaliação da empresa">
    <div className="editor-heading"><h2>{initial.company.name}</h2><span className="pill">{statusLabels[initial.status]}</span></div>
    <p className="form-hint">{initial.company.domain} · avaliação v{initial.assessment.version} · modelo atual v{initial.policy.version}</p>
    {initial.status==='needs_review'&&<p className="alert">A base cadastrada ou os pesos mudaram. As notas anteriores foram mantidas para conferência e estão fora da ordenação por pontos. Confira todos os critérios antes de salvar uma nova versão.</p>}
    {!initial.sources.length&&<p className="alert">Cadastre fontes em Contatos e empreendimentos ou aprove uma pesquisa após conferência. Sem fonte, você pode registrar observações, mas não atribuir notas.</p>}
    <p>Notas são decisões manuais do operador. Campo vazio significa desconhecido; zero também precisa de justificativa e fonte. O CRM confere os vínculos cadastrados, sem consultar as páginas.</p>
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <fieldset disabled={busy} className="qualification-form"><legend>Avaliar com o modelo atual</legend>
        {factorKeys.map(key=>{const factor=criteria[key];const missing=factor.source_ids.filter(id=>!initial.sources.some(s=>s.id===id));return <fieldset key={key}><legend>{initial.policy.factors[key]} · até {initial.policy.weights[key]} pontos</legend>
          <p className="form-hint">{factorHints[key]}</p>
          <label>Pontos · {initial.policy.factors[key]}<input type="number" min={0} max={initial.policy.weights[key]} step={1} value={factor.points??''} placeholder="Desconhecido" onChange={e=>change(key,{points:e.target.value===''?null:Number(e.target.value)})}/></label>
          <label>Justificativa · {initial.policy.factors[key]}<textarea rows={3} maxLength={1000} value={factor.reason} onChange={e=>change(key,{reason:e.target.value})}/></label>
          <details><summary>Fontes deste critério ({factor.source_ids.length}/5)</summary><p className="form-hint">Marque até cinco fontes que sustentam esta nota. Abra os links para conferir o conteúdo e a data.</p>
            {initial.sources.map(s=><div className="qualification-evidence" key={s.id}><label className="checkbox"><input type="checkbox" checked={factor.source_ids.includes(s.id)} disabled={!factor.source_ids.includes(s.id)&&factor.source_ids.length>=5} onChange={()=>toggle(key,s.id)}/>{s.name||s.title}</label><SourceLink source={s}/></div>)}
            {missing.map(id=><label className="checkbox" key={id}><input type="checkbox" checked onChange={()=>toggle(key,id)}/>Fonte indisponível: {id}. Desmarque e confira outra fonte.</label>)}
          </details>
        </fieldset>;})}
        <label>Observações da avaliação<textarea rows={3} maxLength={2000} value={note} onChange={e=>{setNote(e.target.value);setDirty(true);setConfirmed(false);}}/></label>
        <p className="qualification-preview" role="status">{invalid?'Prévia pendente: confira as notas, as justificativas e as fontes antes de comparar pontos.':pending?`${known} pontos atribuídos em ${capacity} possíveis nos critérios avaliados. ${pending} critérios desconhecidos; sem total comparável.`:`Prévia manual: ${known}/100 pontos. A versão salva só participa da ordenação se a base e o modelo continuarem vigentes.`}</p>
        {invalid&&<p className="form-hint">Confira os limites das notas, as justificativas (mínimo 5 caracteres) e as fontes de cada nota.</p>}
        <label className="checkbox"><input type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);setDirty(true);}}/>Conferi os dados, as datas e as fontes de todos os critérios preenchidos. Esta avaliação não autoriza contato.</label>
        <div className="editor-actions"><button className="primary" disabled={!confirmed||invalid||!meaningful} type="submit">Salvar avaliação</button><button type="button" onClick={onReload}>Descartar edição e reabrir</button></div>
      </fieldset>
    </form>
    {error&&<p className="alert error" role="alert">{error} Seus campos foram preservados. Use “Descartar edição e reabrir” para carregar a base atual.</p>}
    <details className="qualification-history"><summary>Histórico preservado ({initial.history.length} versões mais recentes)</summary>
      {initial.history.length?initial.history.map(h=><details key={h.version}><summary>Avaliação v{h.version} · {when(h.occurred_at)} · modelo v{h.payload.policy_version}</summary><dl>{factorKeys.map(key=><div key={key}><dt>{initial.policy.factors[key]}</dt><dd>{h.payload.criteria[key].points??'Desconhecido'} / {h.payload.weights[key]} pontos<p>{h.payload.criteria[key].reason||'Sem justificativa registrada.'}</p>{h.payload.criteria[key].source_ids.map(id=>{const source=h.payload.source_snapshot.find(s=>s.id===id);return source?<SourceLink key={id} source={source}/>:<span key={id}>{id}</span>;})}</dd></div>)}</dl><p>{h.payload.note}</p><small>Registro histórico. Os pesos e as fontes acima são os que foram salvos naquela versão.</small></details>):<p>Ainda não há avaliação salva.</p>}
    </details>
  </section>;
}
