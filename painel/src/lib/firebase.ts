import { getApp, getApps, initializeApp } from 'firebase/app'
import { browserSessionPersistence, connectAuthEmulator, getAuth, initializeAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { configDeProducao, configDoEmulador, EMULADOR } from './ambiente.ts'

// Comparação com o literal, de propósito: o Next embute o valor na build, e na de produção
// (.env.production: NEXT_PUBLIC_FIREBASE_EMULATOR=0) o ramo do emulador some do bundle.
const EM_EMULADOR = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1'

// Cada variável é citada por extenso: o Next só embute process.env.NEXT_PUBLIC_* assim.
const options = EM_EMULADOR ? configDoEmulador() : configDeProducao({
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
})

export const app = getApps().length ? getApp() : initializeApp(options)
export const auth = getAuth(app)
auth.languageCode = 'pt-BR'
export const db = getFirestore(app)
export const storage = getStorage(app, EM_EMULADOR ? 'gs://demo-painel.appspot.com' : undefined)

// O recarregamento do dev reavalia o módulo; conectar duas vezes lança erro.
const g = globalThis as { __painelNoEmulador?: boolean }
if (EM_EMULADOR && !g.__painelNoEmulador) {
  g.__painelNoEmulador = true
  connectAuthEmulator(auth, EMULADOR.auth, { disableWarnings: true })
  connectFirestoreEmulator(db, EMULADOR.firestore.host, EMULADOR.firestore.port)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}

// Sessões auxiliares só desta aba, para alternar as duas contas de teste autenticadas.
export function sessoesDeTeste() {
  const sessao = (nome: string) => {
    const existente = getApps().find(a => a.name === nome)
    const auxiliar = existente ?? initializeApp(app.options, nome)
    const authAux = existente ? getAuth(auxiliar) : initializeAuth(auxiliar, { persistence: browserSessionPersistence })
    const dbAux = getFirestore(auxiliar)
    if (EM_EMULADOR && !existente) {
      connectAuthEmulator(authAux, EMULADOR.auth, { disableWarnings: true })
      connectFirestoreEmulator(dbAux, EMULADOR.firestore.host, EMULADOR.firestore.port)
    }
    return { auth: authAux, db: dbAux }
  }
  return { administrador: sessao('conecta-teste-admin'), gerente: sessao('conecta-teste-gerente') }
}
