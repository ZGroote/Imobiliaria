import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, serverTimestamp, writeBatch } from 'firebase/firestore'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'
import { iniciarEstoque, salvarUnidade, salvarPerfil, mostrarEstoque, salvarVagas, salvarComercial } from '../src/lib/estoque.ts'
import { BOOK_SHA, lerVagas, vagasDaUnidade, validarVagas, centavos, posicoes, resolverInformacoes, totais, validarLista, validarInformacoes, vazias, type Estoque, type PerfilVenda, type UnidadeVenda } from '../src/lib/estoque-modelo.ts'

const app = initializeApp({ projectId: 'demo-painel', apiKey: 'demo-key' }, 'estoque-publico-teste'), anonymous = getFirestore(app)
connectFirestoreEmulator(anonymous, '127.0.0.1', 8180)
before(semear)
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

test('administrador prepara 170 posições e duas fichas vazias; público e corretor não escrevem', async () => {
  const admin = await entrar('admin'), cor = await entrar('corA'), other = await entrar('gerB')
  await iniciarEstoque(admin.db, 'cedros', admin.uid, 'LIV TESTE — SEM OFERTA REAL')
  const units = (await getDocs(collection(stockRef(admin.db), 'units'))).docs.map(d => d.data() as UnidadeVenda)
  validarLista(units); assert.equal(totais(units).nao_informada, 170)
  assert.equal((await getDocs(collection(stockRef(admin.db), 'profiles'))).size, 2)
  assert.equal((await settings(admin.db)).bookSHA256, BOOK_SHA)
  assert.equal((await getDoc(stockRef(anonymous))).data()!.publicEnabled, false)
  await assert.rejects(getDocs(collection(stockRef(anonymous), 'units')), /permission/i)
  await assert.rejects(getDoc(doc(anonymous, 'properties', 'cedros')), /permission/i)
  await assert.rejects(iniciarEstoque(admin.db, 'cedros', admin.uid, 'Duplicado'), /já foi/)
  await assert.rejects(iniciarEstoque(cor.db, 'colinas', cor.uid, 'Indevido'), /permission/i)
  await assert.rejects(getDocs(collection(stockRef(other.db), 'units')), /permission/i)
})

test('perfil comum atualiza todas as unidades associadas; exceções e venda continuam individuais', async () => {
  const admin = await entrar('admin'), manager = await entrar('gerA')
  const ref = doc(stockRef(admin.db), 'profiles', 'canto'), profile = (await getDoc(ref)).data() as PerfilVenda
  await salvarPerfil(admin.db, 'cedros', admin.uid, { ...profile, info: { ...vazias(), priceCents: 30000001, bedrooms: 2, bathrooms: 1, description: '<img src=x onerror=alert(1)> descrição pública' } })
  const original = await unit(admin.db)
  await salvarUnidade(admin.db, 'cedros', admin.uid, { ...original, commercialNumber: 'TESTE-802', availability: 'vendida', profileId: 'canto', overrides: { ...vazias(), priceCents: 31000001 } })
  const other = await unit(admin.db, 'p08-f03')
  await salvarUnidade(admin.db, 'cedros', admin.uid, { ...other, availability: 'disponivel', profileId: 'canto' })
  const updated = (await getDoc(ref)).data() as PerfilVenda
  await salvarPerfil(admin.db, 'cedros', admin.uid, { ...updated, info: { ...updated.info, bedrooms: 3 } })
  const current = (await getDoc(ref)).data() as PerfilVenda
  assert.equal(resolverInformacoes(await unit(admin.db), [current]).priceCents, 31000001)
  assert.equal(resolverInformacoes(await unit(admin.db, 'p08-f03'), [current]).priceCents, 30000001)
  assert.equal(resolverInformacoes(await unit(admin.db), [current]).bedrooms, 3)
  assert.equal((await unit(admin.db)).availability, 'vendida'); assert.equal((await unit(admin.db, 'p08-f03')).availability, 'disponivel')
  await mostrarEstoque(admin.db, 'cedros', admin.uid, await settings(admin.db), true)
  assert.equal((await getDocs(collection(stockRef(anonymous), 'units'))).size, 170)
  assert.equal((await unit(anonymous)).availability, 'vendida')
  await assert.rejects(getDocs(collection(stockRef(anonymous), 'history')), /permission/i)
})

test('regras recusam escrita direta, dado privado, identidade trocada, agência errada e histórico falso', async () => {
  const admin = await entrar('admin'), cor = await entrar('corA'), foreign = await entrar('gerB')
  const u = await unit(admin.db)
  await assert.rejects(salvarUnidade(cor.db, 'cedros', cor.uid, { ...u, availability: 'disponivel' }), /permission/i)
  await assert.rejects(salvarUnidade(foreign.db, 'cedros', foreign.uid, u), /permission/i)
  await assert.rejects(salvarUnidade(anonymous, 'cedros', 'admin', u), /permission/i)
  const direct = writeBatch(admin.db); direct.update(doc(stockRef(admin.db), 'units', u.id), { availability: 'disponivel', updatedAt: serverTimestamp() })
  await assert.rejects(direct.commit(), /permission/i)
  for (const bad of [{ buyerEmail: 'privado@test.invalid' }, { floor: 9 }, { availability: 'livre' }, { overrides: { ...vazias(), bedrooms: -1 } }]) {
    const b = writeBatch(admin.db), history = doc(collection(stockRef(admin.db), 'history'))
    const next = { ...u, ...bad, revision: u.revision + 1, updatedAt: serverTimestamp(), lastChangeId: history.id }
    b.set(doc(stockRef(admin.db), 'units', u.id), next)
    b.set(history, { kind: 'units', key: u.id, actor: admin.uid, revision: next.revision, timestamp: serverTimestamp(), snapshot: next })
    await assert.rejects(b.commit(), /permission/i)
  }
  const history = doc(collection(stockRef(admin.db), 'history')), fake = writeBatch(admin.db)
  fake.set(history, { kind: 'units', key: u.id, actor: admin.uid, revision: u.revision, timestamp: serverTimestamp(), snapshot: { ...u, updatedAt: serverTimestamp(), lastChangeId: history.id } })
  await assert.rejects(fake.commit(), /permission/i)
})

test('gerente atualiza preço e venda, mas não altera informações, numeração, publicação ou vagas', async () => {
  const admin = await entrar('admin'), manager = await entrar('gerA'), cor = await entrar('corA'), foreign = await entrar('gerB')
  const u = await unit(admin.db), stock = await settings(admin.db)
  await assert.rejects(iniciarEstoque(manager.db, 'colinas', manager.uid, 'Indevido'), /permission/i)
  const profile = (await getDoc(doc(stockRef(admin.db), 'profiles', 'canto'))).data() as PerfilVenda
  for (const account of [manager, cor, foreign]) {
    await assert.rejects(salvarUnidade(account.db, 'cedros', account.uid, { ...u, commercialNumber: 'PROIBIDO' }), /permission/i)
    await assert.rejects(salvarUnidade(account.db, 'cedros', account.uid, { ...u, profileId: 'meio' }), /permission/i)
    for (const field of ['areaM2','bedrooms','bathrooms','parking','description','conditions'] as const) {
      const value = ['areaM2','bedrooms','bathrooms'].includes(field) ? 9 : 'Indevido'
      await assert.rejects(salvarUnidade(account.db, 'cedros', account.uid, { ...u, overrides: { ...u.overrides, [field]: value } }), /permission/i)
    }
    await assert.rejects(salvarPerfil(account.db, 'cedros', account.uid, { ...profile, info: { ...profile.info, bedrooms: 9 } }), /permission/i)
    await assert.rejects(mostrarEstoque(account.db, 'cedros', account.uid, stock, false), /permission/i)
    await assert.rejects(salvarVagas(account.db, 'cedros', account.uid, 'p03-f01', [40]), /permission/i)
  }
  await salvarComercial(manager.db, 'cedros', manager.uid, u, 12345001, 'vendida')
  const sold = await unit(manager.db)
  assert.equal(sold.overrides.priceCents, 12345001); assert.equal(sold.availability, 'vendida')
  assert.equal(sold.profileId, u.profileId); assert.equal(sold.commercialNumber, u.commercialNumber)
  assert.equal(sold.overrides.bedrooms, u.overrides.bedrooms)
  for (const account of [cor, foreign]) await assert.rejects(salvarComercial(account.db, 'cedros', account.uid, sold, 1, 'disponivel'), /permission/i)
  await salvarComercial(manager.db, 'cedros', manager.uid, sold, null, 'disponivel')
  const current = await unit(manager.db)
  assert.throws(() => salvarComercial(manager.db, 'cedros', manager.uid, current, 1, 'reservada'), /disponível/)
})

test('duas edições simultâneas não sobrescrevem a venda silenciosamente', async () => {
  const admin = await entrar('admin'), manager = await entrar('gerA'), u = await unit(admin.db, 'p01-f04')
  const results = await Promise.allSettled([
    salvarUnidade(admin.db, 'cedros', admin.uid, { ...u, availability: 'vendida' }),
    salvarUnidade(admin.db, 'cedros', admin.uid, { ...u, availability: 'reservada' }),
  ])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.match((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.message, /Outra pessoa/)
  assert.equal((await unit(admin.db, u.id)).revision, u.revision + 1)
})

test('revogar consulta pública bloqueia os dados; registros e histórico permanecem', async () => {
  const admin = await entrar('admin')
  await mostrarEstoque(admin.db, 'cedros', admin.uid, await settings(admin.db), false)
  await assert.rejects(getDocs(collection(stockRef(anonymous), 'units')), /permission/i)
  assert.equal((await getDoc(stockRef(anonymous))).data()!.publicEnabled, false)
  assert.equal((await getDocs(collection(stockRef(admin.db), 'units'))).size, 170)
  assert.ok((await getDocs(collection(stockRef(admin.db), 'history'))).size >= 7)
})

test('numeração é exclusiva também em duas edições concorrentes de apartamentos diferentes', async () => {
  const admin = await entrar('admin'), manager = await entrar('gerA'), a = await unit(admin.db, 'p05-f01'), b = await unit(admin.db, 'p05-f02')
  const results = await Promise.allSettled([
    salvarUnidade(admin.db, 'cedros', admin.uid, { ...a, commercialNumber: 'QA-EXCLUSIVO' }),
    salvarUnidade(admin.db, 'cedros', admin.uid, { ...b, commercialNumber: 'QA-EXCLUSIVO' }),
  ])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal((await getDocs(collection(stockRef(admin.db), 'units'))).docs.filter(d => d.data().commercialNumber === 'QA-EXCLUSIVO').length, 1)
  const owner = (await getDoc(doc(stockRef(admin.db), 'numbers', 'QA-EXCLUSIVO'))).data()!.unitKey
  const current = await unit(admin.db, owner)
  await salvarUnidade(admin.db, 'cedros', admin.uid, { ...current, commercialNumber: null })
  assert.equal((await getDoc(doc(stockRef(admin.db), 'numbers', 'QA-EXCLUSIVO'))).exists(), false)
})

test('modelo: vagas de 1 a 175, sem repetir e no máximo quatro por apartamento', () => {
  assert.deepEqual(lerVagas(' 13, 12;12 '), [12, 13]); assert.deepEqual(lerVagas(''), [])
  for (const bad of ['0', '176', '12a', '1,2,3,4,5', '-3']) assert.throws(() => lerVagas(bad))
  assert.deepEqual(vagasDaUnidade({ 87: 'p01-f01', 3: 'p01-f01', 4: 'p02-f01' }, 'p01-f01'), [3, 87])
  assert.throws(() => validarVagas({ spaces: { 176: 'p01-f01' } })); assert.throws(() => validarVagas({ spaces: { 1: 'p17-f01' } }))
  assert.throws(() => validarVagas({ spaces: { 1: 'p01-f01', 2: 'p01-f01', 3: 'p01-f01', 4: 'p01-f01', 5: 'p01-f01' } }))
})

test('vaga pertence a um apartamento só; público lê o mapa e corretor não escreve', async () => {
  const admin = await entrar('admin'), manager = await entrar('gerA'), cor = await entrar('corA')
  const mapa = async (db = admin.db) => (await getDoc(doc(stockRef(db), 'parking', 'mapa'))).data()?.spaces ?? {}
  await salvarVagas(admin.db, 'cedros', admin.uid, 'p02-f01', [12, 13])
  await assert.rejects(salvarVagas(admin.db, 'cedros', admin.uid, 'p02-f02', [13]), /já pertence/)
  await salvarVagas(admin.db, 'cedros', admin.uid, 'p02-f02', [87])
  assert.deepEqual(await mapa(), { 12: 'p02-f01', 13: 'p02-f01', 87: 'p02-f02' })
  await salvarVagas(admin.db, 'cedros', admin.uid, 'p02-f01', [13])
  assert.deepEqual(vagasDaUnidade(await mapa(), 'p02-f01'), [13])
  await assert.rejects(salvarVagas(cor.db, 'cedros', cor.uid, 'p03-f01', [40]), /permission/i)
  await assert.rejects(salvarVagas(admin.db, 'cedros', admin.uid, 'p03-f01', [176]), /1 a 175/)
  // Escrita direta com vaga ou unidade fora do cadastro é recusada pelas regras.
  const atual = (await getDoc(doc(stockRef(admin.db), 'parking', 'mapa'))).data()!
  for (const spaces of [{ ...atual.spaces, 176: 'p02-f01' }, { ...atual.spaces, 50: 'p17-f01' }, { ...atual.spaces, 50: 7 }]) {
    const b = writeBatch(admin.db), history = doc(collection(stockRef(admin.db), 'history'))
    const next = { ...atual, spaces, revision: atual.revision + 1, updatedAt: serverTimestamp(), lastChangeId: history.id }
    b.set(doc(stockRef(admin.db), 'parking', 'mapa'), next)
    b.set(history, { kind: 'parking', key: 'mapa', actor: admin.uid, revision: next.revision, timestamp: serverTimestamp(), snapshot: next })
    await assert.rejects(b.commit(), /permission/i)
  }
  await mostrarEstoque(admin.db, 'cedros', admin.uid, await settings(admin.db), true)
  assert.deepEqual(vagasDaUnidade(await mapa(anonymous), 'p02-f02'), [87])
  await mostrarEstoque(admin.db, 'cedros', admin.uid, await settings(admin.db), false)
  await assert.rejects(mapa(anonymous), /permission/i)
})

test('duas pessoas ligando apartamentos diferentes ao mesmo tempo não perdem nenhuma vaga', async () => {
  const admin = await entrar('admin'), manager = await entrar('gerA')
  await Promise.all([salvarVagas(admin.db, 'cedros', admin.uid, 'p04-f01', [101]), salvarVagas(admin.db, 'cedros', admin.uid, 'p04-f02', [102])])
  const spaces = (await getDoc(doc(stockRef(admin.db), 'parking', 'mapa'))).data()!.spaces
  assert.equal(spaces[101], 'p04-f01'); assert.equal(spaces[102], 'p04-f02')
  const results = await Promise.allSettled([salvarVagas(admin.db, 'cedros', admin.uid, 'p04-f03', [150]), salvarVagas(admin.db, 'cedros', admin.uid, 'p04-f04', [150])])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
})

test('Laranjeiras prepara 312 posições, separa as torres e publica só estoque autorizado', async () => {
  const admin = await entrar('admin'), manager = await entrar('gerA'), foreign = await entrar('gerB')
  const model = 'parque-das-laranjeiras', property = 'colinas'
  await iniciarEstoque(admin.db, property, admin.uid, 'Laranjeiras — teste sem oferta real', model)
  const ref = stockRef(admin.db, property), readUnit = async (id: string) =>
    (await getDoc(doc(ref, 'units', id))).data() as UnidadeVenda
  const units = (await getDocs(collection(ref, 'units'))).docs.map(d => d.data() as UnidadeVenda)
  validarLista(units, model)
  assert.equal(totais(units).nao_informada, 312)
  const first = await readUnit('t01-p12-f08'), second = await readUnit('t02-p12-f08')
  assert.equal(first.technicalId, 'laranjeiras/torre-01/pavimento-12/final-08')
  assert.equal(second.technicalId, 'laranjeiras/torre-02/pavimento-12/final-08')
  const publicUnits = collection(stockRef(anonymous, property), 'units')
  await assert.rejects(getDocs(publicUnits), /permission/i)
  await assert.rejects(salvarComercial(foreign.db, property, foreign.uid, first, 1, 'disponivel'), /permission/i)
  await assert.rejects(salvarUnidade(manager.db, property, manager.uid, { ...first, commercialNumber: 'TESTE' }), /permission/i)
  await salvarComercial(manager.db, property, manager.uid, first, 12345000, 'disponivel')
  assert.equal((await readUnit(second.id)).availability, 'nao_informada')
  await mostrarEstoque(admin.db, property, admin.uid, (await getDoc(ref)).data() as Estoque, true)
  assert.equal((await getDocs(publicUnits)).size, 312)
  const published = (await getDoc(doc(publicUnits, first.id))).data()!
  assert.equal(published.availability, 'disponivel')
  assert.equal(published.overrides.priceCents, 12345000)
})
