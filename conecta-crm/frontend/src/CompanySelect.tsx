import {useEffect,useState} from 'react';
import {api} from './api';
import type {CompanyRef} from './commercialTypes';

export function CompanySelect({value,onChange,disabled=false}:{value:CompanyRef|null;onChange:(company:CompanyRef|null)=>void;disabled?:boolean}){
  const [query,setQuery]=useState(''),[items,setItems]=useState<CompanyRef[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let cancelled=false;setLoading(true);const timer=setTimeout(()=>{api<{items:CompanyRef[]}>('/companies?limit=25&q='+encodeURIComponent(query)).then(r=>{if(!cancelled){setItems(r.items);setError('');}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});},200);return()=>{cancelled=true;clearTimeout(timer);};},[query]);
  const options=value&&!items.some(c=>c.id===value.id)?[value,...items]:items;
  return <div className="company-select"><label>Buscar empresa revisada<input type="search" value={query} disabled={disabled} maxLength={200} onChange={e=>setQuery(e.target.value)}/></label><label>Empresa revisada<select disabled={disabled||loading||!!error} value={value?.id||''} onChange={e=>onChange(options.find(c=>c.id===e.target.value)||null)}><option value="">{loading?'Carregando empresas…':'Selecione uma empresa'}</option>{options.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label>{error&&<p role="alert" className="alert error">{error}</p>}{!loading&&!items.length&&<p className="form-hint">Nenhuma empresa encontrada. Cadastre candidatos após revisar as fontes em Tarefas assistidas.</p>}</div>;
}
