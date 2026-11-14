import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {initializeApp,deleteApp} from 'firebase-admin/app'
import {getFirestore} from 'firebase-admin/firestore'
import {criarServicoRastreabilidade} from '../rastreabilidade/modelo.mjs'

const host=process.env.FIRESTORE_EMULATOR_HOST
test('Firestore real: concorrência, queries, reabertura e distintos por imóvel', {skip:!host},async t=>{
  assert.match(host,/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/,'Teste só usa emulador loopback.')
  const projectId=process.env.GCLOUD_PROJECT??'demo-painel'
  assert.match(projectId,/^demo-/,'Nunca semear um projeto de produção.')
  const app=initializeApp({projectId},'tracking-test-'+randomBytes(8).toString('hex')),db=getFirestore(app)
  const suffix=randomBytes(8).toString('hex'),agencyId='tracking-ag-'+suffix,propertyId='tracking-p-'+suffix
  const manager='tracking-manager-'+suffix,brokers=['tracking-a-'+suffix,'tracking-b-'+suffix]
  const refs=[db.doc('agencies/'+agencyId),db.doc('properties/'+propertyId),db.doc('users/'+manager),...brokers.map(id=>db.doc('users/'+id))]
  t.after(async()=>{
    for(const collection of ['trackingAttempts','trackingSessions','trackingVisits','trackingLinks']){
      const rows=(await db.collection(collection).where('propertyId','==',propertyId).get()).docs
      await Promise.all(rows.map(row=>row.ref.delete()))
    }
    await Promise.all(refs.map(ref=>ref.delete()));await db.terminate();await deleteApp(app)
  })
  await Promise.all([
    refs[0].set({active:true}),refs[1].set({agencyId,status:'active',title:'Fixture local',pipelineUnitId:'fixture-local',publishedBuild:'123456abcdef'}),
    refs[2].set({role:'agency_manager',agencyId,active:true,name:'Gerente fixture'}),
    ...brokers.map((id,i)=>db.doc('users/'+id).set({role:'agent',agencyId,active:true,name:'Corretor fixture '+i})),
  ])
  let ms=Date.parse('2026-10-04T12:00:00Z')
  const service=criarServicoRastreabilidade({db,secret:'segredo-sintetico-emulador-1234567890',publicOrigin:'http://localhost:8910',now:()=>ms})
  const request={propertyId,brokerUid:brokers[0],attemptId:'concurrent-'+suffix}
  const roots=await Promise.all(Array.from({length:4},()=>service.criarLink(manager,request)))
  for(const root of roots)assert.deepEqual(root,roots[0])
  const second=(await service.criarLink(manager,{propertyId,brokerUid:brokers[1],attemptId:'second-'+suffix})).link
  const opens=await Promise.all(Array.from({length:4},()=>service.abrirVisita({token:roots[0].link.id,attemptId:'open-'+suffix})))
  for(const open of opens)assert.deepEqual(open,opens[0])
  const other=await service.abrirVisita({token:second.id,attemptId:'other-'+suffix})
  for(const open of [opens[0],other]){
    const {sessionId}=await service.criarSessao({visitId:open.visitId,receipt:open.receipt,visitorKey:'one-browser-local-fixture',page:'tour'})
    const base={visitId:open.visitId,receipt:open.receipt,sessionId,page:'tour',section:'mapa'}
    await service.registrarEvento({...base,seq:1,type:'view',activeMs:0})
    ms+=15000
    await Promise.all(Array.from({length:4},()=>service.registrarEvento({...base,seq:2,type:'heartbeat',activeMs:15000})))
  }
  const report=await service.gerarRelatorio(manager,{propertyId,from:'2026-10-04T00:00:00Z',to:'2026-10-05T00:00:00Z'})
  assert.equal(report.summary.sessions,2);assert.equal(report.summary.estimatedVisitors,1)
  assert.equal(report.summary.activeMs,30000);assert.equal(report.bySection[0].activeMs,30000)
  const unitRef=db.doc(`salesInventory/${propertyId}/units/p03-f02`)
  refs.push(unitRef);await unitRef.set({id:'p03-f02'})
  const visit=opens[0],resumed=await service.criarSessao({visitId:visit.visitId,receipt:visit.receipt,visitorKey:'one-browser-local-fixture',page:'maquete'})
  const event={visitId:visit.visitId,receipt:visit.receipt,sessionId:resumed.sessionId,page:'maquete',section:'ficha',unitKey:'p03-f02'}
  await service.registrarEvento({...event,seq:3,type:'view',activeMs:0});ms+=10000
  await Promise.all(Array.from({length:4},()=>service.registrarEvento({...event,seq:4,type:'heartbeat',activeMs:10000})))
  const units=await service.gerarRelatorio(manager,{propertyId,from:'2026-10-04T00:00:00Z',to:'2026-10-05T00:00:00Z',units:'1'})
  assert.deepEqual(units.byUnit,[{unitKey:'p03-f02',sessions:1,returns:0,activeMs:10000}])
  assert.deepEqual(units.unitCoverage,{sessionsWithUnit:1,unassignedActiveMs:30000})
  assert.equal((await service.listarLinks(manager,{propertyId})).links.length,2)
  assert.equal((await service.listarLinks(brokers[0],{propertyId})).links.length,1)
  const restored=criarServicoRastreabilidade({db,secret:'segredo-sintetico-emulador-1234567890',publicOrigin:'http://localhost:8910',now:()=>ms})
  const reopened=await restored.abrirVisita({token:opens[0].shareToken,receipt:opens[0].receipt,attemptId:'resume-'+suffix})
  assert.equal(reopened.visitId,opens[0].visitId)
  await service.revogarLink(manager,roots[0].link.id)
  await assert.rejects(restored.abrirVisita({token:opens[0].shareToken,attemptId:'revoked-'+suffix}),{code:'LINK_DISABLED',status:410})
})
