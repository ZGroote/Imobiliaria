import {collection,doc,getDocs,query,where,orderBy,limit,startAfter,serverTimestamp,writeBatch} from 'firebase/firestore'
import type {Firestore,Timestamp} from 'firebase/firestore'
import type {Leitura} from '../components/construtor-planta/modelo.ts'
import type {EditorState} from '../components/construtor-planta/editorDocument.ts'
import type {Property,Request} from './types.ts'

export interface PropertyReading {
  id:string;propertyId:string;agencyId:string;version:number;createdBy:string;createdByName:string;createdAt:Timestamp
  schemaVersion:Leitura['schemaVersion'];revision:number;contentSha256:string;leitura:Leitura;basedOnVersionId:string|null
  editorState?:EditorState;editorStateSha256?:string
}
export type NovaVersao={saveId:string;propertyId:string;agencyId:string;leituraJson:string;editorStateJson?:string;basedOnVersionId?:string}
export interface RespostaMaquete3D{ok:boolean;html:string;bytes:number;relatorio?:unknown}
export type OpcoesMaquete3D={moveisJson?:string;demo?:boolean;propertyId?:string;agencyId?:string;token?:string}
export async function requisitarMaquete3D(endpoint:string,leituraJson:string,contextoJson?:string,options:OpcoesMaquete3D={}):Promise<RespostaMaquete3D>{
  let target=endpoint
  if(!target){
    const host=typeof window!=='undefined'?window.location.hostname:''
    if(!/^127(?:\.\d{1,3}){3}$/.test(host)&&host!=='localhost'&&host!=='[::1]')
      throw new Error('A prévia 3D precisa do serviço local configurado.')
    target=`http://${host}:5056/gerar-maquete`
  }else{
    target=target.replace(/\/property-readings\/?$/,'/gerar-maquete')
  }
  const {token,...payload}=options
  const r=await fetch(target,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
    body:JSON.stringify({leituraJson,contextoJson,...payload})})
  const body=await r.json()
  if(!r.ok||!body.ok) throw new Error(body.error??'Falha ao gerar maquete 3D.')
  if(typeof body.html!=='string'||!body.html.trim()) throw new Error('O serviço retornou uma prévia vazia.')
  return body
}
export async function salvarVersao(endpoint:string,token:string,input:NovaVersao):Promise<{id:string;version:number;editorStateSha256?:string}>{
  if(!endpoint) throw new Error('Serviço de leituras ainda não configurado.')
  const r=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(input)})
  const body=await r.json()
  if(!r.ok) throw new Error(body.error??'Falha ao salvar versão.')
  return body
}
export async function listarVersoes(db:Firestore,propertyId:string,agencyId:string,beforeVersion?:number):Promise<PropertyReading[]>{
  const result=await getDocs(query(collection(db,'propertyReadings'),where('propertyId','==',propertyId),where('agencyId','==',agencyId),
    orderBy('version','desc'),...(beforeVersion===undefined?[]:[startAfter(beforeVersion)]),limit(50)))
  return result.docs.map(d=>({id:d.id,...d.data()}) as PropertyReading)
}

// M1-E: fixa um snapshot como entrada da produção do pedido. Os números vêm do documento lido do
// Firestore, não de recálculo no navegador; as regras conferem cada um contra propertyReadings.
// Ponteiro + AuditLog no mesmo batch: trocar v2 por v3 deixa o rastro de que já foi v2.
export const ESTADOS_ENTRADA:Request['status'][]=['accepted','production']
export function fixarEntrada(db:Firestore,uid:string,r:Pick<Request,'id'|'agencyId'|'productionInput'>,v:PropertyReading){
  const b=writeBatch(db),log=doc(collection(db,'auditLogs')),antes=r.productionInput
  b.set(log,{agencyId:r.agencyId,userId:uid,entityType:'request',entityId:r.id,action:'production_input:set',visibility:'internal',
    before:{readingId:antes?.readingId??null,readingVersion:antes?.readingVersion??null,contentSha256:antes?.contentSha256??null},
    after:{readingId:v.id,readingVersion:v.version,readingRevision:v.revision,contentSha256:v.contentSha256},
    timestamp:serverTimestamp()})
  b.update(doc(db,'requests',r.id),{productionInput:{readingId:v.id,readingVersion:v.version,readingRevision:v.revision,
    schemaVersion:v.schemaVersion,contentSha256:v.contentSha256,fixedBy:uid,fixedAt:serverTimestamp()},
    lastAuditId:log.id,updatedAt:serverTimestamp()})
  return b.commit()
}
// Por que "Iniciar produção" seria negado, no critério das regras (productionStartOk); undefined = liberado.
// Imóvel com pipelineUnitId ainda é o fluxo legado (plantas_fornecidas/, BuildJob de hoje) até o M2, mas
// também só com o imóvel hoje na agência do pedido (a invariável do AGENCY_MISMATCH do BuildJob).
export function bloqueioDaProducao(r:Pick<Request,'status'|'agencyId'|'propertyId'|'productionInput'>,
  imovel?:Pick<Property,'agencyId'|'pipelineUnitId'>):string|undefined{
  if(r.status!=='accepted') return
  if(!r.propertyId) return 'Vincule um imóvel antes de iniciar a produção.'
  if(!imovel) return 'Conferindo o imóvel…'
  if(imovel.agencyId!==r.agencyId) return 'O imóvel não pertence mais à imobiliária deste pedido.'
  if(!imovel.pipelineUnitId&&!r.productionInput) return 'Fixe a entrada da planta antes de iniciar a produção.'
}
