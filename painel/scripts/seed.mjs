// Zera e popula o EMULADOR (Auth + Firestore) com as agências fictícias e um usuário por papel.
//   node painel/scripts/seed.mjs          (com os emuladores no ar; npm run painel:dev já faz)
// O Admin SDK ignora as regras, então este script só existe para o emulador: sem as variáveis
// *_EMULATOR_HOST ele falaria com o projeto real, e por isso as define e confere o projeto.
import { pathToFileURL } from 'node:url'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { AGENCIAS_DEV, SENHA_DEV, USUARIOS_DEV } from '../src/lib/dev.ts'

const PROJETO = 'demo-painel'
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8180'
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'
process.env.METADATA_SERVER_DETECTION ||= 'none'   // não procurar credencial do Google Cloud
if ((process.env.GCLOUD_PROJECT ?? PROJETO) !== PROJETO) {
  throw new Error(`seed.mjs só roda no projeto ${PROJETO} do emulador, não em ${process.env.GCLOUD_PROJECT}.`)
}

const T = Timestamp.fromDate(new Date('2026-09-20T12:00:00Z'))
const DADOS = {
  'properties/cedros': { agencyId: 'agA', title: 'Monte dos Cedros 37', developmentName: 'Monte dos Cedros',
    pipelineUnitId: 'monte-dos-cedros-37', assignedAgentId: 'corA', status: 'active' },
  'properties/colinas': { agencyId: 'agA', title: 'Colinas 12 (dev)', status: 'active' },
  'properties/imovelB': { agencyId: 'agB', title: 'Imóvel B (dev)', status: 'active' },
  'requests/pedCedros': { agencyId: 'agA', requestedBy: 'corA', propertyId: 'cedros', title: 'Tour do Monte dos Cedros 37',
    status: 'submitted', priority: 'normal' },
  'requests/pedColinas': { agencyId: 'agA', requestedBy: 'gerA', propertyId: 'colinas', title: 'Tour do Colinas 12',
    status: 'production', priority: 'high' },
  'requests/pedB': { agencyId: 'agB', requestedBy: 'gerB', propertyId: 'imovelB', title: 'Tour do imóvel B',
    status: 'accepted', priority: 'normal' },
  // Já aprovado, com o build de exemplo que public/exemplo/estado.json mostra no ar: pronto para publicar no dev.
  'requests/pedAprovado': { agencyId: 'agA', requestedBy: 'gerA', propertyId: 'cedros', title: 'Tour do Cedros (aprovado)',
    status: 'approved', priority: 'normal', approvedBuild: 'a1b2c3d4e5f6', approvedBy: 'gerA', approvedAt: T,
    preview: { build: 'a1b2c3d4e5f6',
      tourUrl: 'http://localhost:3000/exemplo/b/monte-dos-cedros-37/a1b2c3d4e5f6/tour.html',
      maqueteUrl: 'http://localhost:3000/exemplo/b/monte-dos-cedros-37/a1b2c3d4e5f6/maquete.html' } },
}

export async function semear() {
  const fs = process.env.FIRESTORE_EMULATOR_HOST, au = process.env.FIREBASE_AUTH_EMULATOR_HOST
  for (const url of [`http://${fs}/emulator/v1/projects/${PROJETO}/databases/(default)/documents`,
                     `http://${au}/emulator/v1/projects/${PROJETO}/accounts`]) {
    const r = await fetch(url, { method: 'DELETE' })
    if (!r.ok) throw new Error(`não consegui zerar o emulador (${url}): HTTP ${r.status}`)
  }
  const app = getApps()[0] ?? initializeApp({ projectId: PROJETO })
  const auth = getAuth(app), db = getFirestore(app)
  const b = db.batch()
  for (const { id, ...a } of AGENCIAS_DEV) b.set(db.doc(`agencies/${id}`), { ...a, active: true, createdAt: T, updatedAt: T })
  for (const u of USUARIOS_DEV) {
    await auth.createUser({ uid: u.uid, email: u.email, password: SENHA_DEV, emailVerified: true, displayName: u.name })
    const { uid, ...perfil } = u
    b.set(db.doc(`users/${uid}`), { ...perfil, active: true, createdAt: T, updatedAt: T })
  }
  for (const [p, v] of Object.entries(DADOS)) b.set(db.doc(p), { ...v, createdAt: T, updatedAt: T })
  await b.commit()
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await semear()
  console.log(`seed: ${AGENCIAS_DEV.length} agências, ${USUARIOS_DEV.length} usuários (senha ${SENHA_DEV}), `
    + `${Object.keys(DADOS).length} imóveis e pedidos.`)
}
