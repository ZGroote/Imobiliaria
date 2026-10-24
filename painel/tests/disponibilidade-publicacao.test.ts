import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { alterarDisponibilidadePublicacao } from '../src/lib/publicar.ts'
import { estaPublicado } from '../src/lib/listas.ts'
import { criarServicoRastreabilidade } from '../../rastreabilidade/modelo.mjs'
import { adminDb, semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

before(semear)
after(sairDeTodos)

test('publicação: pausa bloqueia raiz e encaminhamento; reativar recupera os mesmos links e build', async () => {
  const adm = adminDb()
  await adm.doc('properties/cedros').update({ publicationReady: true, publishedBuild: 'a1b2c3d4e5f6' })
  const api = criarServicoRastreabilidade({ db: adm, secret: 'segredo-local-publicacao-48h'.repeat(2),
    publicOrigin: 'https://imoveis.example', publications: {} })
  const { link } = await api.criarLink('corA', { propertyId: 'cedros', attemptId: 'publicacao-raiz' })
  const abertura = await api.abrirVisita({ token: link.id, attemptId: 'publicacao-antes' })
  const tokens = [link.id, abertura.shareToken]
  const antes = await Promise.all(tokens.map(t => adm.doc(`trackingLinks/${t}`).get()))
  const admin = await entrar('admin'), op = await entrar('op'), gerA = await entrar('gerA')
  const corA = await entrar('corA'), gerB = await entrar('gerB')
  const ler = async () => (await getDoc(doc(admin.db, 'properties/cedros'))).data()!

  for (const u of [admin, op, corA, gerB]) await assert.rejects(
    alterarDisponibilidadePublicacao(u.db, u.uid, 'cedros', false), /permission/i)
  // Nem o gerente da própria imobiliária altera a disponibilidade sem auditoria atômica.
  await assert.rejects(updateDoc(doc(gerA.db, 'properties/cedros'),
    { status: 'inactive', updatedAt: serverTimestamp() }), /permission/i)
  await alterarDisponibilidadePublicacao(gerA.db, gerA.uid, 'cedros', false)
  assert.equal((await ler()).status, 'inactive')
  assert.equal(estaPublicado(await ler()), false)
  for (const token of tokens) await assert.rejects(api.abrirVisita({ token, attemptId: 'pausado-' + token }),
    (e: { status?: number }) => e.status === 410)
  await alterarDisponibilidadePublicacao(gerA.db, gerA.uid, 'cedros', false) // repetir não gera outro log
  await alterarDisponibilidadePublicacao(gerA.db, gerA.uid, 'cedros', true)
  assert.equal(estaPublicado(await ler()), true)
  for (const token of tokens) {
    const r = await api.abrirVisita({ token, attemptId: 'reativado-' + token })
    assert.equal(r.publishedBuild, abertura.publishedBuild)
    assert.deepEqual(r.destinations, abertura.destinations)
  }
  for (let i = 0; i < tokens.length; i++) {
    const depois = await adm.doc(`trackingLinks/${tokens[i]}`).get()
    assert.deepEqual(depois.data(), antes[i].data())
  }
  const logs = await getDocs(query(collection(admin.db, 'auditLogs'), where('entityId', '==', 'cedros')))
  assert.deepEqual(logs.docs.map(d => d.data().action).sort(), ['publication:pause', 'publication:resume'])
  assert.ok(logs.docs.every(d => d.data().userId === gerA.uid && d.data().agencyId === 'agA'))
  assert.equal((await ler()).publishedBuild, 'a1b2c3d4e5f6')
})

test('publicação: não publica imóvel sem conteúdo preparado; registro avulso não exige fixar build', async () => {
  const gerente = await entrar('gerA')
  await assert.rejects(alterarDisponibilidadePublicacao(gerente.db, gerente.uid, 'colinas', true), /preparad/)
  await adminDb().doc('properties/colinas').update({ publicationReady: false, publishedBuild: 'a1b2c3d4e5f6' })
  await assert.rejects(alterarDisponibilidadePublicacao(gerente.db, gerente.uid, 'colinas', true), /preparad/)
  await adminDb().doc('properties/colinas').update({ publicationReady: true, publishedBuild: null })
  await alterarDisponibilidadePublicacao(gerente.db, gerente.uid, 'colinas', false)
  await alterarDisponibilidadePublicacao(gerente.db, gerente.uid, 'colinas', true)
  const p = (await getDoc(doc(gerente.db, 'properties/colinas'))).data()!
  assert.equal(p.status, 'active')
  assert.equal(p.publishedBuild, null)
  assert.equal(estaPublicado(p), true)
})

test('gerente altera somente a visibilidade, com auditoria da própria agência e do estado real', async () => {
  const gerente = await entrar('gerA')
  const tentar = (extra: Record<string, unknown>, logExtra: Record<string, unknown> = {}) => {
    const b = writeBatch(gerente.db), log = doc(collection(gerente.db, 'auditLogs'))
    b.set(log, { agencyId: 'agA', userId: gerente.uid, entityType: 'property', entityId: 'cedros',
      action: 'publication:pause', visibility: 'agency', before: { status: 'active' },
      after: { status: 'inactive' }, timestamp: serverTimestamp(), ...logExtra })
    b.update(doc(gerente.db, 'properties/cedros'), { status: 'inactive', updatedAt: serverTimestamp(),
      lastAuditId: log.id, ...extra })
    return b.commit()
  }
  for (const extra of [{ title: 'Outro nome' }, { agencyId: 'agB' }, { publicationReady: false },
    { publishedBuild: '000000000000' }, { assignedAgentId: 'gerA' }, { status: 'archived' }]) {
    await assert.rejects(tentar(extra), /permission/i)
  }
  for (const log of [{ entityType: 'request' }, { before: { status: 'inactive' } },
    { after: { status: 'active' } }, { agencyId: 'agB' }]) await assert.rejects(tentar({}, log), /permission/i)
  assert.equal((await getDoc(doc(gerente.db, 'properties/cedros'))).data()!.status, 'active')
})
