import {test, before, after} from 'node:test'
import assert from 'node:assert/strict'
import {adminDb, semear} from '../scripts/seed.mjs'
import {sairDeTodos} from './apoio.ts'
import {solicitarVerificacao} from '../../emails/verificacao.mjs'

before(semear)
after(sairDeTodos)
let numero = 0
function dependencias(extra = {}) {
  const calls = [], uid = `verificacao-${++numero}`
  const deps = {db:adminDb(), auth:{
    getUser:async id => {assert.equal(id,uid);return {email:'minha@painel.test',emailVerified:false}},
    generateEmailVerificationLink:async (email,opts) => {
      assert.equal(email,'minha@painel.test')
      assert.equal(opts.url,'https://painel.conectaimoveis3d.com.br/login')
      return 'https://imobilaria-deccb.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=falso&apiKey=demo'
    },
  }, enviar:async (message,id) => {calls.push({message,id});return {id:'resend-verificacao'}}, ...extra}
  return {uid, deps, calls}
}

test('confirmação usa apenas o e-mail do Auth e envia código pelo domínio próprio', async () => {
  const {uid,deps,calls} = dependencias()
  assert.deepEqual(await solicitarVerificacao(uid,deps),{sent:true})
  assert.deepEqual(calls[0].message.to,['minha@painel.test'])
  const link = new URL(calls[0].message.text.match(/https:\/\/\S+/)[0])
  assert.equal(link.origin,'https://painel.conectaimoveis3d.com.br')
  assert.equal(link.searchParams.get('oobCode'),'falso')
  assert.equal(link.searchParams.get('lang'),'pt-BR')
  assert.match(calls[0].id,/^verificacao\/[a-f0-9]{64}$/)
  const saved = JSON.stringify((await adminDb().doc(`emailVerificationQuota/${uid}`).get()).data())
  assert.doesNotMatch(saved,/oobCode|falso|minha@/)
})

test('requisições concorrentes não mandam duplicatas e a conta tem limite diário', async () => {
  let time = Date.now()
  const {uid,deps,calls} = dependencias({agora:()=>time})
  const results = await Promise.allSettled([solicitarVerificacao(uid,deps),solicitarVerificacao(uid,deps)])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(calls.length,1)
  for(let i=1;i<5;i++){time+=61000;await solicitarVerificacao(uid,deps)}
  time+=61000
  await assert.rejects(solicitarVerificacao(uid,deps),e=>e.codigo==='resource-exhausted')
  assert.equal(calls.length,5)
})

test('sem login, conta desativada ou já confirmada não enviam', async () => {
  const {deps,calls} = dependencias()
  await assert.rejects(solicitarVerificacao(null,deps),e=>e.codigo==='unauthenticated')
  for(const user of [{email:'a@b.test',disabled:true},{email:'a@b.test',emailVerified:true}]) {
    deps.auth.getUser=async()=>user
    await assert.rejects(solicitarVerificacao('valido',deps))
  }
  assert.equal(calls.length,0)
})

test('confirmação respeita a cota compartilhada com convites e recusa link de outro projeto', async () => {
  const quota=adminDb().doc(`emailQuota/${new Date().toISOString().slice(0,10)}`), before=(await quota.get()).data()
  const {uid,deps,calls} = dependencias()
  try {
    await quota.set({count:90})
    await assert.rejects(solicitarVerificacao(uid,deps),e=>e.codigo==='resource-exhausted')
  } finally { await quota.set(before) }
  deps.auth.generateEmailVerificationLink=async()=> 'https://evil.test/__/auth/action?mode=verifyEmail&oobCode=falso'
  await assert.rejects(solicitarVerificacao(uid,deps),/Formato inesperado/)
  assert.equal(calls.length,0)
})
