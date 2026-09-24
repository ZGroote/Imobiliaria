// Apoio aos testes do painel: cada usuário entra num app Firebase próprio, contra o emulador,
// pelo mesmo SDK cliente que o painel usa. As regras publicadas (firebase/*.rules) valem aqui.
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'
import { EMULADOR } from '../src/lib/ambiente.ts'
import { SENHA_DEV, USUARIOS_DEV } from '../src/lib/dev.ts'

const apps: FirebaseApp[] = []

export async function entrar(uid: (typeof USUARIOS_DEV)[number]['uid']): Promise<{ db: Firestore; uid: string }> {
  const u = USUARIOS_DEV.find((x) => x.uid === uid)!
  const app = initializeApp({ apiKey: 'demo-key', projectId: EMULADOR.projectId }, `teste-${uid}-${apps.length}`)
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, EMULADOR.auth, { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, EMULADOR.firestore.host, EMULADOR.firestore.port)
  await signInWithEmailAndPassword(auth, u.email, SENHA_DEV)
  return { db, uid }
}

export async function sairDeTodos() {
  await Promise.all(apps.splice(0).map((a) => deleteApp(a)))
}
