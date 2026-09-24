import { getApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { configDoAmbiente, EMULADOR } from './ambiente.ts'

// Cada variável é citada por extenso: o Next só embute process.env.NEXT_PUBLIC_* assim.
const { emulador, options } = configDoAmbiente({
  NEXT_PUBLIC_FIREBASE_EMULATOR: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR,
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
})

export const EM_EMULADOR = emulador
export const app = getApps().length ? getApp() : initializeApp(options)
export const auth = getAuth(app)
export const db = getFirestore(app)

// O recarregamento do dev reavalia o módulo; conectar duas vezes lança erro.
const g = globalThis as { __painelNoEmulador?: boolean }
if (emulador && !g.__painelNoEmulador) {
  g.__painelNoEmulador = true
  connectAuthEmulator(auth, EMULADOR.auth, { disableWarnings: true })
  connectFirestoreEmulator(db, EMULADOR.firestore.host, EMULADOR.firestore.port)
}
