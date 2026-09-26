import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { usuariosPorNome } from '../src/lib/listas.ts'
import { cancelarConvite, convidar, definirAtivo, mudarPapel } from '../src/lib/usuarios.ts'
import { semear } from '../scripts/seed.mjs'
import { entrar, sairDeTodos } from './apoio.ts'

before(semear)
after(sairDeTodos)

test('convites: só o admin convida; papel de imobiliária exige imobiliária', async () => {
  const admin = await entrar('admin'), op = await entrar('op')
  await convidar(admin.db, 'admin', { email: ' Nova.Corretora@Painel.test ', name: 'Nova', role: 'agent',
    agencyId: 'agA', agencyName: 'Imobiliária Fictícia A (dev)' })
  const c = (await getDoc(doc(admin.db, 'invites/nova.corretora@painel.test'))).data()!
  assert.deepEqual([c.role, c.agencyId, c.createdBy], ['agent', 'agA', 'admin'])

  await convidar(admin.db, 'admin', { email: 'op2@painel.test', name: 'Op 2', role: 'operator', agencyId: 'agA' })
  assert.equal('agencyId' in (await getDoc(doc(admin.db, 'invites/op2@painel.test'))).data()!, false)   // interno: sem agência

  assert.throws(() => convidar(admin.db, 'admin', { email: 'x@painel.test', name: 'X', role: 'agent' }), /imobiliária/)
  assert.throws(() => convidar(admin.db, 'admin', { email: 'sem-arroba', name: 'X', role: 'operator' }), /E-mail/)
  await assert.rejects(convidar(admin.db, 'admin', { email: 'y@painel.test', name: 'Y', role: 'agent', agencyId: 'naoexiste' }),
    /permission/i)
  await assert.rejects(convidar(op.db, 'op', { email: 'z@painel.test', name: 'Z', role: 'operator' }), /permission/i)

  // a lista de usuários pagina por nome (a de convites não precisa: só guarda pendentes)
  const nomes = (await getDocs(query(usuariosPorNome(admin.db), limit(3)))).docs.map((d) => d.data().name as string)
  assert.equal(nomes.length, 3)
  assert.deepEqual(nomes, [...nomes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
  const corA = await entrar('corA')
  await assert.rejects(getDocs(query(usuariosPorNome(corA.db), limit(3))), /permission/i)   // só a equipe lista todos
  await cancelarConvite(admin.db, 'op2@painel.test')
  assert.equal((await getDoc(doc(admin.db, 'invites/op2@painel.test'))).exists(), false)
})

test('usuários: admin muda papel e desativa; desativar vale na hora', async () => {
  const admin = await entrar('admin'), corA = await entrar('corA'), gerA = await entrar('gerA')
  await getDoc(doc(corA.db, 'requests/pedCedros'))                      // antes: lê

  await definirAtivo(admin.db, 'corA', false)
  await assert.rejects(getDoc(doc(corA.db, 'requests/pedCedros')), /permission/i)
  await definirAtivo(admin.db, 'corA', true)

  await mudarPapel(admin.db, 'corA', 'agency_manager', 'agA')
  assert.equal((await getDoc(doc(admin.db, 'users/corA'))).data()!.role, 'agency_manager')
  await mudarPapel(admin.db, 'gerA', 'operator')
  const g = (await getDoc(doc(admin.db, 'users/gerA'))).data()!
  assert.deepEqual([g.role, 'agencyId' in g], ['operator', false])
  assert.throws(() => mudarPapel(admin.db, 'gerA', 'agent'), /imobiliária/)
  await assert.rejects(mudarPapel(gerA.db, 'gerA', 'platform_admin'), /permission/i)   // agora operador: nem assim
})

test('equipe: o gerente lista só a própria imobiliária; o corretor não lista', async () => {
  await semear()
  const gerA = await entrar('gerA'), corA = await entrar('corA')
  const equipe = await getDocs(query(collection(gerA.db, 'users'), where('agencyId', '==', 'agA')))
  assert.deepEqual(equipe.docs.map((d) => d.id).sort(), ['corA', 'gerA'])
  await assert.rejects(getDocs(query(collection(gerA.db, 'users'), where('agencyId', '==', 'agB'))), /permission/i)
  await assert.rejects(getDocs(query(collection(corA.db, 'users'), where('agencyId', '==', 'agA'))), /permission/i)
})
