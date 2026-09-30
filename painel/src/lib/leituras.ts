import {collection,getDocs,query,where,orderBy,limit,startAfter} from 'firebase/firestore'
import type {Firestore,Timestamp} from 'firebase/firestore'
import type {Leitura} from '../components/construtor-planta/modelo.ts'

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
