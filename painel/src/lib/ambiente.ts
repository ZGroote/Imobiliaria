// Dois ambientes, escolhidos na build:
// - emulador: projeto demo-painel, que o SDK nunca envia ao Firebase real;
// - produção: a config do app web. Ela é pública; quem protege o dado são as regras.
export type Env = Record<string, string | undefined>

export const EMULADOR = {
  projectId: 'demo-painel',
  auth: 'http://127.0.0.1:9099',
  firestore: { host: '127.0.0.1', port: 8180 },   // firebase.json da raiz, bloco emulators
}

export function configDoAmbiente(env: Env) {
  if (env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1') {
    return {
      emulador: true,
      options: { apiKey: 'demo-key', projectId: EMULADOR.projectId, authDomain: `${EMULADOR.projectId}.firebaseapp.com` },
    }
  }
  const nomes = { apiKey: 'API_KEY', authDomain: 'AUTH_DOMAIN', projectId: 'PROJECT_ID', appId: 'APP_ID' }
  const options = Object.fromEntries(
    Object.entries(nomes).map(([k, n]) => [k, env[`NEXT_PUBLIC_FIREBASE_${n}`]])) as Record<keyof typeof nomes, string>
  const falta = Object.entries(nomes).filter(([k]) => !options[k as keyof typeof nomes])
    .map(([, n]) => `NEXT_PUBLIC_FIREBASE_${n}`)
  if (falta.length) {
    throw new Error(`Config do Firebase incompleta: falta ${falta.join(', ')}. `
      + 'Em produção, ela vem do app web registrado no projeto.')
  }
  return { emulador: false, options }
}
