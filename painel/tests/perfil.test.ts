import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { doc, getDoc } from 'firebase/firestore'
import { normalizarWhatsApp, salvarPerfil } from '../src/lib/perfil.ts'
import { semear, adminDb } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'
import { criarServicoRastreabilidade } from '../../rastreabilidade/modelo.mjs'

before(semear)
after(sairDeTodos)

test('perfil: normaliza celular com DDD e número internacional, aceita retirada e recusa conteúdo inválido', () => {
  assert.equal(normalizarWhatsApp('(16) 99999-0000'), '5516999990000')
  assert.equal(normalizarWhatsApp('5516999990000'), '5516999990000')
  assert.equal(normalizarWhatsApp('+55 (16) 99999-0000'), '5516999990000')
  assert.equal(normalizarWhatsApp('+1 (212) 555-1234'), '12125551234')
  assert.equal(normalizarWhatsApp('  '), null)
  for (const value of ['javascript:alert(1)', 'telefone 16999990000', '123', '+0123456789', '+1234567890123456']) {
    assert.throws(() => normalizarWhatsApp(value), /WhatsApp/)
  }
})

test('perfil: salva nome e celular, preserva permissões e não edita outra pessoa', async () => {
  const corretor = await entrar('corA'), gerente = await entrar('gerA')
  await salvarPerfil(corretor.db, corretor.uid, ' Corretora de teste ', '(16) 99999-0000')
  const salvo = (await getDoc(doc(corretor.db, 'users', corretor.uid))).data()!
  assert.equal(salvo.name, 'Corretora de teste')
  assert.equal(salvo.publicContact.whatsapp, '5516999990000')
  assert.deepEqual([salvo.role, salvo.agencyId, salvo.active], ['agent', 'agA', true])
  assert.throws(() => salvarPerfil(corretor.db, corretor.uid, ' ', ''), /nome/)
  await assert.rejects(salvarPerfil(gerente.db, corretor.uid, 'Outro nome', '16999990000'), /permission/i)
  await assert.rejects(salvarPerfil(corretor.db, gerente.uid, 'Outro nome', '16999990000'), /permission/i)
})

test('perfil → link → encaminhamento: cada responsável usa seu contato atual e retirar celular remove WhatsApp', async () => {
  const corretor = await entrar('corA'), gerente = await entrar('gerA')
  await salvarPerfil(gerente.db, gerente.uid, 'Gerente de teste', '+55 11 99999-0000')
  await adminDb().doc('properties/cedros').update({ publishedBuild: 'a1b2c3d4e5f6' })
  const service = criarServicoRastreabilidade({ db: adminDb(), secret: 'segredo-sintetico-perfil-1234567890123456',
    publicOrigin: 'http://127.0.0.1:5058' })
  const root = (await service.criarLink('gerA', { propertyId: 'cedros', brokerUid: 'corA', attemptId: 'perfil-corretor' })).link
  const outro = (await service.criarLink('gerA', { propertyId: 'cedros', attemptId: 'perfil-gerente' })).link
  const abertura = await service.abrirVisita({ token: root.id, attemptId: 'perfil-abertura' })
  assert.equal(abertura.contact.whatsappNumber, '5516999990000')
  assert.equal((await service.abrirVisita({ token: outro.id, attemptId: 'perfil-outro' })).contact.whatsappNumber, '5511999990000')
  await salvarPerfil(corretor.db, corretor.uid, 'Corretora de teste', '+55 16 98888-0000')
  const encaminhado = await service.abrirVisita({ token: abertura.shareToken, attemptId: 'perfil-encaminhado' })
  assert.equal(encaminhado.contact.whatsappNumber, '5516988880000')
  await salvarPerfil(corretor.db, corretor.uid, 'Corretora de teste', '')
  assert.equal((await getDoc(doc(corretor.db, 'users', corretor.uid))).data()!.publicContact, undefined)
  assert.equal((await service.abrirVisita({ token: encaminhado.shareToken, attemptId: 'perfil-sem-numero' })).contact.whatsappNumber, null)
})
