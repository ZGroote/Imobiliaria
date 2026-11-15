import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture} from './test_rastreabilidade_servidor.mjs'
import {createMetrics} from '../rastreabilidade/public/metricas.mjs'
import {selectedUnitKey} from '../rastreabilidade/public/runtime.mjs'
import {resumir} from '../rastreabilidade/relatorios.mjs'
import {validarRelatorioUnidades} from '../painel/src/lib/rastreabilidade.ts'

test('trocar apartamento separa o tempo e não atribui mapa, carregamento ou seleção inválida',()=>{
  const viewer={ready:true,selectedUnitId:'liv-ipanema/pavimento-modelo-03/final-02'}
  assert.equal(selectedUnitKey({__livViewer:viewer},'maquete','ficha'),'p03-f02')
  for(const section of ['mapa','carregando'])assert.equal(selectedUnitKey({__livViewer:viewer},'maquete',section),null)
  assert.equal(selectedUnitKey({__livViewer:viewer},'tour','interior'),null)
  assert.equal(selectedUnitKey({__livViewer:{...viewer,ready:false}},'maquete','maquete'),null)
  assert.equal(selectedUnitKey({__livViewer:{...viewer,selectedUnitId:'../users/admin'}},'maquete','maquete'),null)
  let now=0;const events=[]
  const ledger=createMetrics({now:()=>now,emit:e=>events.push(e),page:'maquete',section:'ficha',unitKey:'p03-f02'})
  ledger.consent(true);now=5000;ledger.context('maquete','ficha','p04-f02')
  now=12000;ledger.context('maquete','mapa');now=15000;ledger.pause()
  assert.deepEqual(events.filter(e=>e.activeMs).map(e=>[e.unitKey??null,e.activeMs]),[['p03-f02',5000],['p04-f02',7000],[null,3000]])
})

test('eventos validados por cadastro isolam unidades, preservam dedupe e contrato antigo',async()=>{
  const {service,db,advance}=fixture()
  db.data.set('salesInventory/p/units/p03-f02',{id:'p03-f02'})
  const {link}=await service.criarLink('brokerA',{propertyId:'p',attemptId:'raiz-unit'})
  const visit=await service.abrirVisita({token:link.id,attemptId:'visita-unit'})
  const session=await service.criarSessao({visitId:visit.visitId,receipt:visit.receipt,visitorKey:'browser-unidades-123456789',page:'maquete'})
  const event={visitId:visit.visitId,receipt:visit.receipt,sessionId:session.sessionId,page:'maquete',section:'ficha',unitKey:'p03-f02',seq:1,type:'view',activeMs:0}
  await service.registrarEvento(event);advance(5000)
  await service.registrarEvento({...event,seq:2,type:'heartbeat',activeMs:5000})
  assert.equal((await service.registrarEvento({...event,seq:2,type:'heartbeat',activeMs:5000})).accepted,false)
  await assert.rejects(service.registrarEvento({...event,seq:2,type:'heartbeat',activeMs:5000,unitKey:'p04-f02'}),{status:409})
  await assert.rejects(service.registrarEvento({...event,seq:3,unitKey:'../../users/admin'}),{status:400})
  await assert.rejects(service.registrarEvento({...event,seq:3,section:'mapa'}),{status:400})
  advance(5000)
  await service.registrarEvento({...event,seq:3,type:'heartbeat',activeMs:5000,unitKey:'p99-f99'})
  advance(1)
  const range={propertyId:'p',from:'2026-10-04T11:00:00.000Z',to:'2026-10-04T13:00:00.000Z'}
  const report=await service.gerarRelatorio('manager',{...range,units:'1'})
  assert.deepEqual(report.byUnit,[{unitKey:'p03-f02',sessions:1,returns:0,activeMs:5000}])
  assert.deepEqual(report.unitCoverage,{sessionsWithUnit:1,unassignedActiveMs:5000})
  assert.equal(report.summary.sessions,1)
  assert.equal('byUnit' in await service.gerarRelatorio('manager',range),false)
  await assert.rejects(service.gerarRelatorio('outsider',{...range,units:'1'}),{status:403})
  await assert.rejects(service.gerarRelatorio('brokerA',{...range,units:'1',brokerUid:'brokerB'}),{status:403})
  assert.deepEqual(validarRelatorioUnidades(report,{propertyId:'p',agencyId:'a'},range),report)
  assert.throws(()=>validarRelatorioUnidades({...report,email:'private@example.test'},{propertyId:'p',agencyId:'a'},range))
  assert.throws(()=>validarRelatorioUnidades({...report,byUnit:[...report.byUnit,...report.byUnit]},{propertyId:'p',agencyId:'a'},range))
})

test('retorno é por navegador e apartamento no período, sem duplicar sessão ou inventar histórico',()=>{
  const from='2026-10-04T10:00:00Z',to='2026-10-04T14:00:00Z'
  const base={propertyId:'p',consentGranted:true,expiresAt:'2026-10-10T00:00:00Z',brokerUid:'a',brokerName:'A',visitorHash:'x',sourceClass:'root',pageViews:1,activeMs:10000}
  const rows=[
    {...base,startedAt:'2026-10-04T13:00:00Z',units:{'p01-f01':{activeMs:4000},'p01-f02':{activeMs:6000}}},
    {...base,startedAt:'2026-10-04T11:00:00Z',units:{'p01-f01':{activeMs:10000}}},
    {...base,startedAt:'2026-10-04T12:00:00Z'},
  ]
  const r=resumir(rows,{propertyId:'p',from,to,now:Date.parse(to),includeUnits:true})
  assert.deepEqual(r.byUnit,[{unitKey:'p01-f01',sessions:2,returns:1,activeMs:14000},{unitKey:'p01-f02',sessions:1,returns:0,activeMs:6000}])
  assert.deepEqual(r.unitCoverage,{sessionsWithUnit:2,unassignedActiveMs:10000})
  assert.equal(r.summary.sessions,3)
})
