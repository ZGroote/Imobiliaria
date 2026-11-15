// Somente fixtures sintéticas no emulador demo-painel.
import {spawn} from 'node:child_process'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {createWriteStream} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {getAuth} from 'firebase-admin/auth'
import {semear,adminDb,Timestamp} from './seed.mjs'
import {posicoes,vazias,BOOK_SHA} from '../src/lib/estoque-modelo.ts'
import {criarServicoRastreabilidade} from '../../rastreabilidade/modelo.mjs'
import {criarServidorRastreabilidade} from '../../rastreabilidade/servidor.mjs'

if(process.env.GCLOUD_PROJECT!=='demo-painel'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8180'
  ||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('QA exige emuladores locais demo-painel.')
const repo=fileURLToPath(new URL('../../',import.meta.url)),panel=fileURLToPath(new URL('../',import.meta.url))
const out=repo+'relatorios/painel-gestao-2026-11-03/'
await mkdir(out,{recursive:true})
if(process.argv.includes('--tests')) {
  const output=createWriteStream(out+'testes.log')
  const tests=spawn(process.execPath,['--test','--test-concurrency=1','firebase/tests/regras.test.mjs','painel/tests/*.test.*','tests/test_rastreabilidade_*.mjs','tests/test_liv_analytics.mjs'],{cwd:repo,windowsHide:true,stdio:['ignore','pipe','pipe']})
  tests.stdout.pipe(output,{end:false});tests.stderr.pipe(output,{end:false})
  const code=await new Promise((resolve,reject)=>{tests.on('error',reject);tests.on('close',resolve)})
  await new Promise(resolve=>output.end(resolve))
  console.log((await readFile(out+'testes.log','utf8')).split('\n').slice(-35).join('\n'))
  if(code!==0)throw Error('Testes falharam. Consulte '+out+'testes.log')
}
await semear()
const db=adminDb(),stamp=Timestamp.now()
await db.doc('properties/cedros').update({publicationReady:true,publishedBuild:'a1b2c3d4e5f6'})
await db.doc('agencies/agA').update({region:{country:'US',locale:'en',currency:'USD',timeZone:'America/New_York'}})
const stock=db.doc('salesInventory/cedros'),batch=db.batch()
batch.set(stock,{schema:'liv-sales-v1',bookSHA256:BOOK_SHA,model:'liv-ipanema',total:170,title:'Demo inventory',publicEnabled:true,revision:1,updatedAt:stamp,lastChangeId:'qa'.repeat(10)})
for(const u of posicoes()) {
  const number=String(100+u.floor*10+u.final)
  batch.set(stock.collection('units').doc(u.id),{...u,commercialNumber:number,availability:'disponivel',profileId:'canto',overrides:vazias(),revision:1,updatedAt:stamp,lastChangeId:'qa'.repeat(10)})
  batch.set(stock.collection('numbers').doc(number),{unitKey:u.id})
}
for(const id of ['canto','meio'])batch.set(stock.collection('profiles').doc(id),{id,info:{...vazias(),priceCents:12345000,areaM2:85,bedrooms:2},revision:1,updatedAt:stamp,lastChangeId:'qa'.repeat(10)})
await batch.commit()
let clock=Date.now()-120000
const service=criarServicoRastreabilidade({db,secret:'segredo-apenas-local-qa-gestao-1234567890',publicOrigin:'http://127.0.0.1:5058',now:()=>clock})
const {link}=await service.criarLink('gerA',{propertyId:'cedros',brokerUid:'corA',attemptId:'qa-gestao-link'})
const opening=await service.abrirVisita({token:link.id,attemptId:'qa-gestao-visita'})
const {sessionId}=await service.criarSessao({visitId:opening.visitId,receipt:opening.receipt,visitorKey:'qa-visitante-sintetico',page:'maquete'})
await service.registrarEvento({visitId:opening.visitId,receipt:opening.receipt,sessionId,seq:1,type:'view',page:'maquete',section:'maquete',activeMs:0})
clock+=30000
await service.registrarEvento({visitId:opening.visitId,receipt:opening.receipt,sessionId,seq:2,type:'heartbeat',page:'maquete',section:'maquete',activeMs:30000})
clock=Date.now()
const api=criarServidorRastreabilidade({service,auth:getAuth(),publicOrigin:'http://127.0.0.1:5058',panelOrigin:'http://127.0.0.1:3027'})
await new Promise(r=>api.listen(5057,'127.0.0.1',r))
const log=createWriteStream(out+'next.log')
const next=spawn(process.execPath,[panel+'node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3027'],
  {cwd:panel,windowsHide:true,env:{...process.env,NEXT_PUBLIC_FIREBASE_EMULATOR:'1',NEXT_PUBLIC_TRACKING_API_URL:'http://127.0.0.1:5057'},stdio:['ignore','pipe','pipe']})
next.stdout.pipe(log);next.stderr.pipe(log)
try {
  const child=spawn(process.env.PYTHON??'python',[panel+'scripts/qa-gestao.py'],{cwd:repo,windowsHide:true,stdio:'inherit'})
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)})
  if(code!==0)throw Error('QA visual falhou: '+code)
  await writeFile(out+'resultado.json',JSON.stringify({ok:true,fixture:'demo-painel',widths:[320,768,1024,1440]},null,2))
}finally{next.kill();api.close();log.end()}
