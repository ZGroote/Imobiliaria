import {useEffect,useState} from 'react';
import {api,assetBlob} from './api';
import {BrandMaterials} from './BrandMaterials';

type Asset={id:string;name:string;display_name:string;commercial_stage:string;locale:string;kind:string;preview:boolean};
type Template={profile_id:string;locale:string;subject:string;body:string;website:string;required_fields:string[]};

function BrandAsset({asset}:{asset:Asset}){
  const [image,setImage]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let cancelled=false;let url='';
    if(asset.preview)assetBlob(asset.id).then(blob=>{if(!cancelled){url=URL.createObjectURL(blob);setImage(url);}}).catch(()=>{if(!cancelled)setError('Prévia indisponível.');});
    return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};
  },[asset.id,asset.preview]);
  async function download(){
    setBusy(true);setError('');
    try{const blob=await assetBlob(asset.id);const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=asset.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const stages:Record<string,string>={brand:'Marca e materiais',briefing:'Briefing',delivery:'Entrega',after_sale:'Pós-venda'};
  return <article className="brand-asset">{image?<img src={image} alt={asset.display_name}/>:<div className="asset-placeholder">{asset.preview?'Carregando prévia…':'Documento Word'}</div>}<div><span className="eyebrow">ORIGINAL · {asset.locale} · {stages[asset.commercial_stage]}</span><h3>{asset.display_name}</h3><button disabled={busy} onClick={download}>Baixar original</button>{error&&<p role="alert">{error}</p>}</div></article>;
}

export function BrandLibrary({onDirtyChange}:{onDirtyChange:(dirty:boolean)=>void}){
  const [assets,setAssets]=useState<Asset[]>([]);
  const [templates,setTemplates]=useState<Template[]>([]);
  const [profile,setProfile]=useState('US');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{let cancelled=false;Promise.all([api<Asset[]>('/brand-assets'),api<Template[]>('/email-templates')]).then(([a,t])=>{if(!cancelled){setAssets(a);setTemplates(t);}}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[]);
  const selected=templates.find(t=>t.profile_id===profile);
  return <div className="settings"><h2>Materiais originais da Conecta</h2><p>Identidade visual, contrato, briefing, entrega e pós-venda preservados como enviados. Os materiais por mercado abaixo são derivados e exigem conferência própria.</p>{error&&<p role="alert">{error}</p>}{loading&&<p role="status">Carregando biblioteca…</p>}<div className="brand-assets">{assets.map(a=><BrandAsset key={a.id} asset={a}/>)}</div>
    <BrandMaterials onDirtyChange={onDirtyChange}/><section className="template-preview"><h2>Primeiro contato · modelo leve</h2><p>Texto inicial para revisão. Os campos entre chaves precisam ser preenchidos antes de criar um rascunho. Esta prévia não envia mensagens.</p><label>Mercado do destinatário<select value={profile} onChange={e=>setProfile(e.target.value)}><option value="US">Estados Unidos · EN-US</option><option value="BR">Brasil · PT-BR</option></select></label>{selected&&<><span className="pill">Pendente de revisão · {selected.locale}</span><h3>{selected.subject}</h3><pre>{selected.body}</pre><small>Campos obrigatórios: {selected.required_fields.join(', ')}.</small></>}</section>
  </div>;
}
