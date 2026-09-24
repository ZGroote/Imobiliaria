// Dois ambientes, escolhidos na build:
// - emulador: projeto demo-painel, que o SDK nunca envia ao Firebase real;
// - produção: a config do app web "painel" (.env.production). Ela é pública por natureza;
//   quem protege o dado são as regras. Segredo administrativo nunca vem para cá.
export type Env = Record<string, string | undefined>

export const EMULADOR = {
  projectId: 'demo-painel',
  auth: 'http://127.0.0.1:9099',
  firestore: { host: '127.0.0.1', port: 8180 },   // firebase.json da raiz, bloco emulators
}

export const configDoEmulador = () =>
  ({ apiKey: 'demo-key', projectId: EMULADOR.projectId, authDomain: `${EMULADOR.projectId}.firebaseapp.com` })

const OBRIGATORIAS = { apiKey: 'API_KEY', authDomain: 'AUTH_DOMAIN', projectId: 'PROJECT_ID', appId: 'APP_ID' }
const OPCIONAIS = { storageBucket: 'STORAGE_BUCKET', messagingSenderId: 'MESSAGING_SENDER_ID' }

export function configDeProducao(env: Env) {
  const ler = (n: string) => env[`NEXT_PUBLIC_FIREBASE_${n}`]
  const falta = Object.values(OBRIGATORIAS).filter((n) => !ler(n)).map((n) => `NEXT_PUBLIC_FIREBASE_${n}`)
  if (falta.length) {
    throw new Error(`Config do Firebase incompleta: falta ${falta.join(', ')}. `
      + 'Em produção, ela vem do app web registrado no projeto.')
  }
  const options: Record<string, string> = {}
  for (const [k, n] of Object.entries({ ...OBRIGATORIAS, ...OPCIONAIS })) if (ler(n)) options[k] = ler(n)!
  return options
}

// Usado pelos testes; o firebase.ts escolhe o ramo com o literal, para a build podar o outro.
export function configDoAmbiente(env: Env) {
  return env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1'
    ? { emulador: true, options: configDoEmulador() as Record<string, string> }
    : { emulador: false, options: configDeProducao(env) }
}
