// O robô do M2 entra no Firestore como o usuário users/worker, pelo SDK do navegador: as regras
// valem para ele como para um clique (tasks/painel/m2-worker.md §6). Mora no painel porque as
// funções que ele usa (src/lib/robo.ts, status.ts) são do painel e precisam desta mesma cópia do
// SDK. O token vem do Admin SDK (createCustomToken('worker')).
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

// emulador: o EMULADOR de src/lib/ambiente.ts, só nos testes.
export async function entrarComoRobo({ projectId, apiKey, token, emulador }) {
  const app = initializeApp({ projectId, apiKey }, `robo-${Date.now()}-${Math.random()}`)
  const auth = getAuth(app)
  const db = getFirestore(app)
  if (emulador) {
    connectAuthEmulator(auth, emulador.auth, { disableWarnings: true })
    connectFirestoreEmulator(db, emulador.firestore.host, emulador.firestore.port)
  }
  const { user } = await signInWithCustomToken(auth, token)
  if (user.uid !== 'worker') throw new Error('o token não é do users/worker')
  return { app, db }
}
