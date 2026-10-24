import {test, before, after} from 'node:test'
import assert from 'node:assert/strict'
import {adminDb, semear, Timestamp} from '../scripts/seed.mjs'
import {sairDeTodos} from './apoio.ts'
import {processarConvite} from '../../emails/convites.mjs'
import {ErroResend} from '../../emails/resend.mjs'
import {emailDoConvite} from '../src/lib/emailDoConvite.ts'

before(semear)
after(sairDeTodos)
let numero = 0
async function evento(extra = {}) {
  const ref = adminDb().doc(`invites/email${++numero}@painel.test`)
  await ref.set({email:ref.id,name:'Corretora',role:'agent',agencyId:'agA',createdBy:'gerA',createdAt:Timestamp.now(),...extra})
  return {data:{after:await ref.get(),before:{exists:false}}}
}
const disparar = (e,enviar,extra = {}) => processarConvite(e,{db:adminDb(),enviar,...extra})
const quotaHoje = () => adminDb().doc(`emailQuota/${new Date().toISOString().slice(0,10)}`)

test('envio real do handler no Firestore: registra aceitação e não repete evento já enviado', async () => {
  const e=await evento(),chamadas=[]
  const enviar=async (m,id) => {chamadas.push({m,id});return {id:'resend-1'}}
  assert.equal(await disparar(e,enviar),'accepted')
  assert.equal(await disparar(e,enviar),'accepted')
  assert.equal(chamadas.length,1)
  const delivery=(await e.data.after.ref.get()).data().emailDelivery
  assert.equal(delivery.messageId,'resend-1')
  assert.equal(emailDoConvite({emailDelivery:delivery}),'E-mail enviado.')
  assert.equal(await disparar({data:{before:e.data.after,after:await e.data.after.ref.get()}},enviar),'ignorado')
})
test('falha temporária e concorrência reutilizam mensagem, reserva e idempotência', async () => {
  const e=await evento(),chamadas=[]
  const enviar=async (m,id) => {chamadas.push({m,id}); if(chamadas.length === 1) throw new ErroResend(429);return {id:'resend-2'}}
  await assert.rejects(disparar(e,enviar),/temporária/)
  const antes=(await quotaHoje().get()).data().count
  assert.deepEqual(await Promise.all([disparar(e,enviar),disparar(e,enviar)]),['accepted','accepted'])
  assert.deepEqual(chamadas[0],chamadas[1])
  assert.equal(new Set(chamadas.map(c=>c.id)).size,1)
  assert.equal((await quotaHoje().get()).data().count,antes)
})
test('eventos cancelados, substituídos ou apagados não enviam e-mail', async () => {
  const enviar=async () => assert.fail('Não deveria enviar')
  const e=await evento()
  await e.data.after.ref.delete()
  assert.equal(await disparar(e,enviar),'cancelado')
  await e.data.after.ref.set({...e.data.after.data(),createdAt:Timestamp.fromMillis(Date.now()+1000)})
  assert.equal(await disparar(e,enviar),'cancelado')
  assert.equal(await disparar({data:{after:{exists:false}}},enviar),'ignorado')
})
test('o servidor recusa autor sem permissão, agência alheia, nomes inválidos e convites antigos', async () => {
  const enviar=async () => assert.fail('Não deveria enviar')
  for(const extra of [{createdBy:'corA'}, {agencyId:'agB'}, {createdBy:'inexistente'}, {name:'X\r\nY'},
    {createdAt:Timestamp.fromMillis(Date.now()-24*60*60*1000)}]) {
    const e=await evento(extra)
    assert.equal(await disparar(e,enviar),'failed')
    assert.equal((await e.data.after.ref.get()).data().emailDelivery.status,'failed')
  }
})
test('erro permanente fica visível e não gera novas tentativas de envio', async () => {
  const e=await evento();let chamadas=0
  const enviar=async () => {chamadas++;throw new ErroResend(403)}
  assert.equal(await disparar(e,enviar),'failed')
  assert.equal(await disparar(e,enviar),'failed')
  assert.equal(chamadas,1)
  assert.match(emailDoConvite((await e.data.after.ref.get()).data()),/não enviado/)
})
test('reserva diária limita os convites e não autoriza envios extras', async () => {
  const anterior=(await quotaHoje().get()).data()
  try {
    await quotaHoje().set({count:90})
    const e=await evento()
    assert.equal(await disparar(e,async()=>assert.fail('Cota esgotada')),'failed')
    assert.equal((await e.data.after.ref.get()).data().emailDelivery.code,'daily_limit')
  } finally { await quotaHoje().set(anterior) }
})
test('sem resultado do servidor o painel não afirma que enviou', () => {
  assert.match(emailDoConvite({}),/não confirmado/)
  assert.match(emailDoConvite({emailDelivery:{status:'processing'}}),/Enviando/)
})
