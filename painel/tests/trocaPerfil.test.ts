import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, doc, updateDoc, serverTimestamp, setLogLevel } from 'firebase/firestore'
import { semear, adminDb } from '../scripts/seed.mjs'
import { criarTrocaDeTeste, PAR_EMULADOR } from '../src/lib/trocaPerfil.ts'
import { SENHA_DEV } from '../src/lib/dev.ts'

setLogLevel('silent')
const clientes = ['principal', 'admin', 'gerente'].map(nome => {
  const app = initializeApp({ projectId: 'demo-painel', apiKey: 'demo-key' }, `troca-${nome}`)
  const auth = getAuth(app), db = getFirestore(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8180)
  return { app, auth, db }
})
const [principal, admin, gerente] = clientes
const troca = criarTrocaDeTeste({ principal: principal.auth, administrador: admin.auth, gerente: gerente.auth,
  bancoAdmin: admin.db, bancoGerente: gerente.db, par: PAR_EMULADOR })
before(semear)
after(async () => { await Promise.all(clientes.map(c => deleteApp(c.app))) })

test('troca real preserva permissões, reutiliza sessões e encerra todos os acessos', async () => {
  await signInWithEmailAndPassword(principal.auth, 'admin@painel.test', SENHA_DEV)
  await assert.rejects(troca.paraGerente('senha-incorreta'))
  assert.equal(principal.auth.currentUser?.uid, 'admin')
  await troca.paraGerente(SENHA_DEV)
  assert.equal(principal.auth.currentUser?.uid, 'gerA')
  await assert.rejects(updateDoc(doc(principal.db, 'properties', 'cedros'), { title: 'Alteração proibida', updatedAt: serverTimestamp() }),
    (e: { code: string }) => e.code === 'permission-denied')
  await troca.paraAdmin()
  assert.equal(principal.auth.currentUser?.uid, 'admin')
  await updateDoc(doc(principal.db, 'properties', 'cedros'), { title: 'Monte dos Cedros 37', updatedAt: serverTimestamp() })
  await troca.paraGerente()
  assert.equal(principal.auth.currentUser?.uid, 'gerA')
  await adminDb().doc('users/admin').update({ active: false })
  await assert.rejects(troca.paraAdmin())
  assert.equal(principal.auth.currentUser?.uid, 'gerA')
  await adminDb().doc('users/admin').update({ active: true })
  await troca.encerrar()
  for (const c of clientes) assert.equal(c.auth.currentUser, null)
})

test('gerente sem sessão original não obtém acesso de administrador', async () => {
  await troca.encerrar()
  await signInWithEmailAndPassword(principal.auth, 'gerente.a@painel.test', SENHA_DEV)
  await assert.rejects(troca.paraAdmin(), /Entre primeiro/)
  assert.equal(principal.auth.currentUser?.uid, 'gerA')
  await signOut(principal.auth)
})

test('outras contas não podem usar a troca', async () => {
  await signInWithEmailAndPassword(principal.auth, 'operador@painel.test', SENHA_DEV)
  await assert.rejects(troca.paraGerente(SENHA_DEV), /somente entre/)
  assert.equal(principal.auth.currentUser?.uid, 'op')
  await troca.encerrar()
})
