import {collection,doc,getDocs,query,where,orderBy,limit,startAfter,serverTimestamp,writeBatch} from 'firebase/firestore'
import type {Firestore,Timestamp} from 'firebase/firestore'
import type {Leitura} from '../components/construtor-planta/modelo.ts'
import type {Property,Request} from './types.ts'

export interface PropertyReading {
  id:string;propertyId:string;agencyId:string;version:number;createdBy:string;createdByName:string;createdAt:Timestamp
  schemaVersion:'1.0.0';revision:number;contentSha256:string;leitura:Leitura;basedOnVersionId:string|null
}
export type NovaVersao={saveId:string;propertyId:string;agencyId:string;leituraJson:string;basedOnVersionId?:string}
export async function salvarVersao(endpoint:string,token:string,input:NovaVersao):Promise<{id:string;version:number}>{
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
// Iniciar produção no fluxo novo exige entrada fixada. Imóvel com pipelineUnitId ainda é o fluxo
// legado (plantas_fornecidas/, BuildJob de hoje) até o M2. As regras são a autoridade.
export const exigeEntrada=(r:Pick<Request,'status'|'productionInput'>,imovel?:Pick<Property,'pipelineUnitId'>)=>
  r.status==='accepted'&&!r.productionInput&&!imovel?.pipelineUnitId
