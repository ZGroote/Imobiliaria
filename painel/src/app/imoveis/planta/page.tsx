'use client'
import {useEffect,useState} from 'react'
import {doc} from 'firebase/firestore'
import {Portao} from '@/components/Portao'
import {ComId,Aviso} from '@/components/ui'
import Capturador from '@/components/construtor-planta/Capturador'
import {carregarSnapshot,carregarEditorState,exportarEditor,type EditorState,type Floor} from '@/components/construtor-planta/editorDocument'
import type {Session} from '@/components/construtor-planta/modelo'
import {db,auth} from '@/lib/firebase'
import {useDoc} from '@/lib/useFirestore'
import {listarVersoes,salvarVersao,requisitarMaquete3D,type PropertyReading} from '@/lib/leituras'
import type {Property} from '@/lib/types'

export default function PlantaDoImovel(){
  return <Portao papeis={['platform_admin','operator','agency_manager','agent']}>
    {perfil=><ComId>{id=><Imovel key={perfil.id+':'+id} id={id}/>}</ComId>}
  </Portao>
}
function Imovel({id}:{id:string}){
  const r=useDoc<Property>('planta:'+id,()=>doc(db,'properties',id))
  if(r.erro) return <Aviso>{r.erro}</Aviso>
  if(r.dado===undefined) return <p>Carregando imóvel…</p>
  if(!r.dado) return <Aviso>Imóvel não encontrado.</Aviso>
  return <Versoes key={id+':'+r.dado.agencyId} property={r.dado}/>
}
function Versoes({property:p}:{property:Property}){
  const [versions,setVersions]=useState<PropertyReading[]>([])
  const [error,setError]=useState('')
  const [loaded,setLoaded]=useState(false)
  const [saving,setSaving]=useState(false)
  const [more,setMore]=useState(false)
  const [listing,setListing]=useState(false)
  const [base,setBase]=useState<string>()
  const [editor,setEditor]=useState<{key:number;session?:Session;editorState?:EditorState}>({key:0})
  // Um retry da mesma ação reutiliza ID; conteúdo novo ganha outra identidade.
  const [attempt,setAttempt]=useState<{json:string;editorStateJson:string;base?:string;id:string}>()
  useEffect(()=>{
    let active=true
    listarVersoes(db,p.id,p.agencyId).then(v=>{if(active){setVersions(v);setMore(v.length===50);setLoaded(true)}},e=>{if(active)setError(e.message)})
    return ()=>{active=false}
  },[p.id,p.agencyId])
  function load(v:PropertyReading){
    try{const restored=carregarSnapshot(v.leitura,v.editorState);setEditor(e=>({key:e.key+1,session:restored.sessions[0],editorState:v.editorState}));setBase(v.id);setAttempt(undefined);setError('')}
    catch(e){setError((e as Error).message)}
  }
  async function older(){
    setListing(true)
    try{const page=await listarVersoes(db,p.id,p.agencyId,versions.at(-1)!.version);setVersions(v=>[...v,...page]);setMore(page.length===50)}
    catch(e){setError((e as Error).message)}finally{setListing(false)}
  }
  async function save(json:string,editorStateJson:string){
    setSaving(true)
    try{
    const user=auth.currentUser;if(!user) throw new Error('Entre novamente para salvar.')
    const current=attempt?.json===json&&attempt.editorStateJson===editorStateJson&&attempt.base===base?attempt:{json,editorStateJson,base,id:crypto.randomUUID()}
    setAttempt(current)
    const saved=await salvarVersao(process.env.NEXT_PUBLIC_READINGS_API_URL??'',await user.getIdToken(),{
      saveId:current.id,propertyId:p.id,agencyId:p.agencyId,leituraJson:json,editorStateJson,...(base?{basedOnVersionId:base}:{})})
    const refreshed=await listarVersoes(db,p.id,p.agencyId)
    const snapshot=refreshed.find(v=>v.id===saved.id)
    if(!snapshot?.editorState) throw new Error('Não foi possível confirmar o projeto completo salvo. Preserve a edição e baixe o projeto antes de sair.')
    const expected=carregarEditorState(JSON.parse(editorStateJson)),observed=carregarSnapshot(snapshot.leitura,snapshot.editorState)
    if(exportarEditor(expected.sessions,expected.activeFloor)!==exportarEditor(observed.sessions,observed.activeFloor))
      throw new Error('O projeto salvo diverge da edição. Preserve a edição e baixe o projeto antes de sair.')
    setVersions(refreshed);setMore(refreshed.length===50);setBase(saved.id);setAttempt(undefined)
    }finally{setSaving(false)}
  }
  async function gerar3D(json:string,moveisJson:string,_floor:Floor){
    const user=auth.currentUser;if(!user) throw new Error('Entre novamente para gerar a prévia.')
    return requisitarMaquete3D(process.env.NEXT_PUBLIC_READINGS_API_URL??'',json,undefined,
      {moveisJson,demo:true,propertyId:p.id,agencyId:p.agencyId,token:await user.getIdToken()})
  }
  return <>
    <section className="mx-auto max-w-6xl space-y-3 p-6">
      <h1 className="text-xl font-semibold">Planta · {p.title}</h1>
      <p className="text-sm">Salvar preserva pavimentos e móveis em um snapshot. A leitura de produção usa o andar ativo. A prévia 3D local é ilustrativa.</p>
      {error&&<Aviso>{error}</Aviso>}
      {!loaded?<p>Carregando versões…</p>:<>
        <h2 className="font-semibold">Versões salvas</h2>
        {!versions.length&&<p>Nenhuma versão salva.</p>}
        <ul className="space-y-2">{versions.map(v=><li key={v.id} className="flex flex-wrap items-center gap-3 rounded border p-3">
          <span>v{v.version} · {v.createdAt.toDate().toLocaleString('pt-BR')} · {v.createdByName}</span>
          <button className="btn" disabled={saving} onClick={()=>load(v)}>Carregar v{v.version}</button>
          {base===v.id&&<span className="text-sm">Base atual</span>}
        </li>)}</ul>
        {more&&<button className="btn" disabled={saving||listing} onClick={older}>Carregar versões anteriores</button>}
        <p className="text-sm">Carregar outra versão substitui a edição ainda não salva.</p>
      </>}
    </section>
    {loaded&&<div inert={listing}><Capturador key={editor.key} initialSession={editor.session} initialEditorState={editor.editorState} onSave={save} onGerar3D={gerar3D}/></div>}
  </>
}
