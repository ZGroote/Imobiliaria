import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { semear, adminDb } from '../scripts/seed.mjs'
import { criarBuildJob } from '../../tools/buildjob.mjs'
import { sairDeTodos } from './apoio.ts'
import { Timestamp } from 'firebase-admin/firestore'

before(semear)
after(sairDeTodos)

test('buildjob: LEVE nasce pending com AuditLog e duplicata ativa é bloqueada', async () => {
  const db = adminDb()

  await db.doc('requests/pedCedros').update({ status: 'production' })

  const criado = await criarBuildJob(db, 'pedCedros', 'op')
  assert.equal(criado.productionMode, 'leve')
  assert.equal(criado.status, 'pending')
  assert.equal(criado.requestId, 'pedCedros')
  assert.equal(criado.propertyId, 'cedros')
  assert.equal(criado.pipelineUnitId, 'monte-dos-cedros-37')
  assert.equal(criado.agencyId, 'agA')
  assert.equal(criado.createdBy, 'op')

  const job = (await db.doc(`buildJobs/${criado.id}`).get()).data()
  assert.ok(job)
  assert.equal(job.productionMode, 'leve')
  assert.equal(job.lastAuditId, criado.lastAuditId)

  const log = (await db.doc(`auditLogs/${criado.lastAuditId}`).get()).data()
  assert.ok(log)
  assert.equal(log.entityType, 'buildJob')
  assert.equal(log.entityId, criado.id)
  assert.equal(log.action, 'created')
  assert.equal(log.visibility, 'internal')
  assert.equal(log.userId, 'op')
  assert.equal(log.after.productionMode, 'leve')
  assert.equal(log.after.status, 'pending')

  await assert.rejects(
    criarBuildJob(db, 'pedCedros', 'op'),
    /ACTIVE_BUILDJOB_EXISTS:/,
  )
})

test('buildjob: PREMIUM permanece PREMIUM e não faz downgrade', async () => {
  const db = adminDb()

  await db.doc('properties/colinas').update({ pipelineUnitId: 'monte-das-colinas-39' })

  const criado = await criarBuildJob(db, 'pedColinas', 'admin')
  assert.equal(criado.productionMode, 'premium')
  assert.equal(criado.status, 'pending')
  assert.equal(criado.pipelineUnitId, 'monte-das-colinas-39')

  const job = (await db.doc(`buildJobs/${criado.id}`).get()).data()
  assert.equal(job.productionMode, 'premium')
  assert.equal(job.createdBy, 'admin')
})

test('buildjob: leitura fixada é conferida e preservada no job e AuditLog sem unidade legada', async () => {
  const db=adminDb(),propertyId='novo-pin',requestId='pedNovoPin',readingId='leitura-pin'
  const productionInput={readingId,readingVersion:1,readingRevision:3,schemaVersion:'1.1.0',
    contentSha256:'a'.repeat(64),fixedBy:'op',fixedAt:Timestamp.fromMillis(1000)}
  await db.doc('properties/'+propertyId).set({agencyId:'agA',title:'Novo imóvel'})
  const source=(await db.doc('requests/pedCedros').get()).data()
  await db.doc('requests/'+requestId).set({...source,status:'production',propertyId,productionInput})
  await assert.rejects(criarBuildJob(db,requestId,'op'),/PRODUCTION_INPUT_NOT_FOUND/)
  const reading={propertyId,agencyId:'agA',version:1,revision:3,schemaVersion:'1.1.0',contentSha256:'b'.repeat(64)}
  await db.doc('propertyReadings/'+readingId).set(reading)
  await assert.rejects(criarBuildJob(db,requestId,'op'),/PRODUCTION_INPUT_MISMATCH/)
  await db.doc('propertyReadings/'+readingId).update({contentSha256:productionInput.contentSha256,agencyId:'agB'})
  await assert.rejects(criarBuildJob(db,requestId,'op'),/PRODUCTION_INPUT_MISMATCH/)
  await db.doc('propertyReadings/'+readingId).update({agencyId:'agA'})
  const created=await criarBuildJob(db,requestId,'op')
  assert.equal(created.pipelineUnitId,undefined)
  assert.deepEqual(created.productionInput,productionInput)
  const job=(await db.doc('buildJobs/'+created.id).get()).data()
  const log=(await db.doc('auditLogs/'+created.lastAuditId).get()).data()
  assert.deepEqual(job.productionInput,productionInput)
  assert.deepEqual(log.after.productionInput,productionInput)
  await db.doc('requests/'+requestId).update({'productionInput.contentSha256':'c'.repeat(64)})
  assert.deepEqual((await db.doc('buildJobs/'+created.id).get()).data().productionInput,productionInput)
})
