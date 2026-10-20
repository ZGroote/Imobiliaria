import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, serverTimestamp, writeBatch } from 'firebase/firestore'
import { adminDb, semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'
import { iniciarEstoque, salvarUnidade, salvarPerfil, mostrarEstoque } from '../src/lib/estoque.ts'
import { BOOK_SHA, centavos, posicoes, resolverInformacoes, totais, validarLista, validarInformacoes, vazias, type Estoque, type PerfilVenda, type UnidadeVenda } from '../src/lib/estoque-modelo.ts'

const app = initializeApp({ projectId: 'demo-painel', apiKey: 'demo-key' }, 'estoque-publico-teste'), anonymous = getFirestore(app)
connectFirestoreEmulator(anonymous, '127.0.0.1', 8180)
// Estoque é módulo de construtora: aqui a conta A (a do Cedros, com gerente e corretor) faz esse papel.
before(async () => { await semear(); await adminDb().doc('agencies/agA').update({ kind: 'construtora' }) })
after(async () => { await sairDeTodos(); await deleteApp(app) })
const stockRef = (db: ReturnType<typeof getFirestore>, id = 'cedros') => doc(db, 'salesInventory', id)
const unit = async (db: ReturnType<typeof getFirestore>, id = 'p08-f02') => ({ ...(await getDoc(doc(stockRef(db), 'units', id))).data(), id }) as UnidadeVenda
const settings = async (db: ReturnType<typeof getFirestore>) => (await getDoc(stockRef(db))).data() as Estoque

test('modelo: centavos exatos, duas plantas e diferenças; status não é herdado', () => {
  assert.equal(centavos('123,01'), 12301); assert.equal(centavos('90071992547409,91'), Number.MAX_SAFE_INTEGER)
  assert.throws(() => centavos('1.234,56')); assert.throws(() => centavos('1,001')); assert.throws(() => centavos('90071992547409,92'))
  assert.throws(() => validarInformacoes({ ...vazias(), bedrooms: -1 }))
  assert.equal(posicoes().length, 170); assert.equal(new Set(posicoes().map(u => u.technicalId)).size, 170)
  const u = { ...posicoes()[0], profileId: 'canto', overrides: { ...vazias(), priceCents: 0 }, availability: 'vendida' } as UnidadeVenda
  const p = { id: 'canto', info: { ...vazias(), priceCents: 35000000, bedrooms: 2 } } as PerfilVenda
  assert.deepEqual(resolverInformacoes(u, [p]), { ...vazias(), priceCents: 0, bedrooms: 2 }); assert.equal(u.availability, 'vendida')
})

test('equipe prepara 170 posições e duas fichas vazias; público e corretor não escrevem', async () => {
  const op = await entrar('op'), cor = await entrar('corA'), other = await entrar('gerB')
  await iniciarEstoque(op.db, 'cedros', op.uid, 'LIV TESTE — SEM OFERTA REAL')
  const units = (await getDocs(collection(stockRef(op.db), 'units'))).docs.map(d => d.data() as UnidadeVenda)
  validarLista(units); assert.equal(totais(units).nao_informada, 170)
  assert.equal((await getDocs(collection(stockRef(op.db), 'profiles'))).size, 2)
  assert.equal((await settings(op.db)).bookSHA256, BOOK_SHA)
  assert.equal((await getDoc(stockRef(anonymous))).data()!.publicEnabled, false)
  await assert.rejects(getDocs(collection(stockRef(anonymous), 'units')), /permission/i)
  await assert.rejects(getDoc(doc(anonymous, 'properties', 'cedros')), /permission/i)
  await assert.rejects(iniciarEstoque(op.db, 'cedros', op.uid, 'Duplicado'), /já foi/)
  await assert.rejects(iniciarEstoque(cor.db, 'colinas', cor.uid, 'Indevido'), /permission/i)
  await assert.rejects(getDocs(collection(stockRef(other.db), 'units')), /permission/i)
})

test('perfil comum atualiza todas as unidades associadas; exceções e venda continuam individuais', async () => {
  const op = await entrar('op'), manager = await entrar('gerA')
  const ref = doc(stockRef(op.db), 'profiles', 'canto'), profile = (await getDoc(ref)).data() as PerfilVenda
  await salvarPerfil(op.db, 'cedros', op.uid, { ...profile, info: { ...vazias(), priceCents: 30000001, bedrooms: 2, bathrooms: 1, description: '<img src=x onerror=alert(1)> descrição pública' } })
  const original = await unit(op.db)
  await salvarUnidade(manager.db, 'cedros', manager.uid, { ...original, commercialNumber: 'TESTE-802', availability: 'vendida', profileId: 'canto', overrides: { ...vazias(), priceCents: 31000001 } })
  const other = await unit(op.db, 'p08-f03')
  await salvarUnidade(op.db, 'cedros', op.uid, { ...other, availability: 'disponivel', profileId: 'canto' })
  const updated = (await getDoc(ref)).data() as PerfilVenda
  await salvarPerfil(op.db, 'cedros', op.uid, { ...updated, info: { ...updated.info, bedrooms: 3 } })
  const current = (await getDoc(ref)).data() as PerfilVenda
  assert.equal(resolverInformacoes(await unit(op.db), [current]).priceCents, 31000001)
  assert.equal(resolverInformacoes(await unit(op.db, 'p08-f03'), [current]).priceCents, 30000001)
  assert.equal(resolverInformacoes(await unit(op.db), [current]).bedrooms, 3)
  assert.equal((await unit(op.db)).availability, 'vendida'); assert.equal((await unit(op.db, 'p08-f03')).availability, 'disponivel')
  await mostrarEstoque(op.db, 'cedros', op.uid, await settings(op.db), true)
  assert.equal((await getDocs(collection(stockRef(anonymous), 'units'))).size, 170)
  assert.equal((await unit(anonymous)).availability, 'vendida')
  await assert.rejects(getDocs(collection(stockRef(anonymous), 'history')), /permission/i)
})

test('regras recusam escrita direta, dado privado, identidade trocada, agência errada e histórico falso', async () => {
  const op = await entrar('op'), cor = await entrar('corA'), foreign = await entrar('gerB')
  const u = await unit(op.db)
  await assert.rejects(salvarUnidade(cor.db, 'cedros', cor.uid, { ...u, availability: 'disponivel' }), /permission/i)
  await assert.rejects(salvarUnidade(foreign.db, 'cedros', foreign.uid, u), /permission/i)
  await assert.rejects(salvarUnidade(anonymous, 'cedros', 'op', u), /permission/i)
  const direct = writeBatch(op.db); direct.update(doc(stockRef(op.db), 'units', u.id), { availability: 'disponivel', updatedAt: serverTimestamp() })
  await assert.rejects(direct.commit(), /permission/i)
  for (const bad of [{ buyerEmail: 'privado@test.invalid' }, { floor: 9 }, { availability: 'livre' }, { overrides: { ...vazias(), bedrooms: -1 } }]) {
    const b = writeBatch(op.db), history = doc(collection(stockRef(op.db), 'history'))
    const next = { ...u, ...bad, revision: u.revision + 1, updatedAt: serverTimestamp(), lastChangeId: history.id }
    b.set(doc(stockRef(op.db), 'units', u.id), next)
    b.set(history, { kind: 'units', key: u.id, actor: op.uid, revision: next.revision, timestamp: serverTimestamp(), snapshot: next })
    await assert.rejects(b.commit(), /permission/i)
  }
  const history = doc(collection(stockRef(op.db), 'history')), fake = writeBatch(op.db)
  fake.set(history, { kind: 'units', key: u.id, actor: op.uid, revision: u.revision, timestamp: serverTimestamp(), snapshot: { ...u, updatedAt: serverTimestamp(), lastChangeId: history.id } })
  await assert.rejects(fake.commit(), /permission/i)
})

test('duas edições simultâneas não sobrescrevem a venda silenciosamente', async () => {
  const op = await entrar('op'), manager = await entrar('gerA'), u = await unit(op.db, 'p01-f04')
  const results = await Promise.allSettled([
    salvarUnidade(op.db, 'cedros', op.uid, { ...u, availability: 'vendida' }),
    salvarUnidade(manager.db, 'cedros', manager.uid, { ...u, availability: 'reservada' }),
  ])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.match((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.message, /Outra pessoa/)
  assert.equal((await unit(op.db, u.id)).revision, u.revision + 1)
})

test('revogar consulta pública bloqueia os dados; registros e histórico permanecem', async () => {
  const op = await entrar('op')
  await mostrarEstoque(op.db, 'cedros', op.uid, await settings(op.db), false)
  await assert.rejects(getDocs(collection(stockRef(anonymous), 'units')), /permission/i)
  assert.equal((await getDoc(stockRef(anonymous))).data()!.publicEnabled, false)
  assert.equal((await getDocs(collection(stockRef(op.db), 'units'))).size, 170)
  assert.ok((await getDocs(collection(stockRef(op.db), 'history'))).size >= 7)
})

test('numeração é exclusiva também em duas edições concorrentes de apartamentos diferentes', async () => {
  const op = await entrar('op'), manager = await entrar('gerA'), a = await unit(op.db, 'p05-f01'), b = await unit(op.db, 'p05-f02')
  const results = await Promise.allSettled([
    salvarUnidade(op.db, 'cedros', op.uid, { ...a, commercialNumber: 'QA-EXCLUSIVO' }),
    salvarUnidade(manager.db, 'cedros', manager.uid, { ...b, commercialNumber: 'QA-EXCLUSIVO' }),
  ])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal((await getDocs(collection(stockRef(op.db), 'units'))).docs.filter(d => d.data().commercialNumber === 'QA-EXCLUSIVO').length, 1)
  const owner = (await getDoc(doc(stockRef(op.db), 'numbers', 'QA-EXCLUSIVO'))).data()!.unitKey
  const current = await unit(op.db, owner)
  await salvarUnidade(op.db, 'cedros', op.uid, { ...current, commercialNumber: null })
  assert.equal((await getDoc(doc(stockRef(op.db), 'numbers', 'QA-EXCLUSIVO'))).exists(), false)
})

test('estoque é só de construtora: conta imobiliária ou sem tipo não escreve, nem pela equipe', async () => {
  const op = await entrar('op'), u = await unit(op.db), conta = adminDb().doc('agencies/agA')
  await conta.update({ kind: 'imobiliaria' })
  await assert.rejects(salvarUnidade(op.db, 'cedros', op.uid, { ...u, availability: 'disponivel' }), /permission/i)
  await assert.rejects(iniciarEstoque(op.db, 'colinas', op.uid, 'Indevido'), /permission/i)
  const { kind: _kind, ...semTipo } = (await conta.get()).data()!
  await conta.set(semTipo)
  await assert.rejects(salvarUnidade(op.db, 'cedros', op.uid, { ...u, availability: 'disponivel' }), /permission/i)
  assert.equal((await unit(op.db)).revision, u.revision, 'a leitura continua; só a escrita trava')
  const gerB = await entrar('gerB')
  await iniciarEstoque(gerB.db, 'imovelB', gerB.uid, 'CONSTRUTORA B — SEM OFERTA REAL')
  assert.equal((await getDocs(collection(stockRef(gerB.db, 'imovelB'), 'units'))).size, 170)
})
