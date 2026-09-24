// Apoio aos testes do painel: cada usuário entra num app Firebase próprio, contra o emulador,
// pelo mesmo SDK cliente que o painel usa. As regras publicadas (firebase/*.rules) valem aqui.
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  applyActionCode, connectAuthEmulator, createUserWithEmailAndPassword, getAuth, sendEmailVerification,
  signInWithEmailAndPassword, type Auth,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, setLogLevel, type Firestore } from 'firebase/firestore'
import { EMULADOR } from '../src/lib/ambiente.ts'
import { SENHA_DEV, USUARIOS_DEV } from '../src/lib/dev.ts'

const apps: FirebaseApp[] = []
setLogLevel('silent')   // as negações esperadas pelos testes não viram ruído; as asserções pegam o resto

function cliente() {
  const app = initializeApp({ apiKey: 'demo-key', projectId: EMULADOR.projectId }, `teste-${apps.length}`)
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, EMULADOR.auth, { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, EMULADOR.firestore.host, EMULADOR.firestore.port)
  return { auth, db }
}

export async function entrar(uid: (typeof USUARIOS_DEV)[number]['uid']): Promise<{ db: Firestore; uid: string }> {
  const u = USUARIOS_DEV.find((x) => x.uid === uid)!
  const { auth, db } = cliente()
  await signInWithEmailAndPassword(auth, u.email, SENHA_DEV)
  return { db, uid }
}

// Conta nova, com e-mail AINDA NÃO verificado (como o "Primeiro acesso" do login).
export async function novaConta(email: string) {
  const { auth, db } = cliente()
  const { user } = await createUserWithEmailAndPassword(auth, email, SENHA_DEV)
  return { auth, db, uid: user.uid }
}

// Clica no link de verificação: o emulador guarda os links em vez de mandar e-mail.
export async function verificarEmail(auth: Auth) {
  const user = auth.currentUser!
  await sendEmailVerification(user)
  const r = await fetch(`${EMULADOR.auth}/emulator/v1/projects/${EMULADOR.projectId}/oobCodes`)
  const { oobCodes } = await r.json() as { oobCodes: { email: string; requestType: string; oobCode: string }[] }
  const c = oobCodes.findLast((x) => x.email === user.email && x.requestType === 'VERIFY_EMAIL')!
  await applyActionCode(auth, c.oobCode)
  await user.reload()
  await user.getIdToken(true)
}

export async function sairDeTodos() {
  await Promise.all(apps.splice(0).map((a) => deleteApp(a)))
}
