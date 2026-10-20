// BuildJob: o plano do job de prévia de um request já em produção, e o pedido de trabalho que o pede.
// Desde o M2-2, quem cria o job é só o robô (tools/worker.mjs), com a trava na mão: `criar` grava um
// pedido de trabalho (AuditLog worker:previa), e o job nasce na próxima execução do robô, com a
// identidade desse pedido. Escrita via Admin SDK; o painel continua read-only em buildJobs/.
//
// Uso real:
//   node tools/buildjob.mjs criar <requestId> --user <uid> --project imobilaria-deccb
//
// No emulador, FIRESTORE_EMULATOR_HOST pode ser usado normalmente.
import { pathToFileURL } from 'node:url'
import { initializeApp, getApps } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'

const MODOS = new Set(['leve', 'premium'])
const PAPEIS = new Set(['platform_admin', 'operator'])
const ATIVOS = new Set(['pending', 'running'])
const PIN_FIELDS = ['readingId', 'readingVersion', 'readingRevision', 'schemaVersion', 'contentSha256', 'fixedBy', 'fixedAt']
const SNAPSHOT_FIELDS = {readingId:'id',readingVersion:'version',readingRevision:'revision',schemaVersion:'schemaVersion',contentSha256:'contentSha256'}
const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)

function entradaFixada(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== PIN_FIELDS.length || !PIN_FIELDS.every(key => Object.hasOwn(value,key))
    || !id(value.readingId) || !id(value.fixedBy) || !Number.isSafeInteger(value.readingVersion) || value.readingVersion < 1
    || !Number.isSafeInteger(value.readingRevision) || value.readingRevision < 1 || value.readingRevision > 2147483647
    || !['1.0.0','1.1.0'].includes(value.schemaVersion) || typeof value.contentSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(value.contentSha256)
    || !(value.fixedAt instanceof Timestamp)) throw new Error('PRODUCTION_INPUT_INVALID')
  return {...value}
}

export function planejarBuildJob(requestId, request, property, userId, user) {
  if (!requestId || !request) throw new Error('REQUEST_NOT_FOUND')
  if (!user?.active || !PAPEIS.has(user.role)) throw new Error('STAFF_REQUIRED')
  if (request.status !== 'production') throw new Error('REQUEST_NOT_IN_PRODUCTION')
  if (!MODOS.has(request.productionMode)) throw new Error('PRODUCTION_MODE_MISSING')
  if (!request.propertyId) throw new Error('PROPERTY_REQUIRED')
  if (!property) throw new Error('PROPERTY_NOT_FOUND')
  if (property.agencyId !== request.agencyId) throw new Error('AGENCY_MISMATCH')
  const productionInput = request.productionInput === undefined ? undefined : entradaFixada(request.productionInput)
  if (!property.pipelineUnitId && !productionInput) throw new Error('PIPELINE_UNIT_REQUIRED')

  return {
    requestId,
    propertyId: request.propertyId,
    ...(property.pipelineUnitId ? { pipelineUnitId: property.pipelineUnitId } : {}),
    ...(productionInput ? { productionInput } : {}),
    agencyId: request.agencyId,
    productionMode: request.productionMode,
    requestedBy: request.requestedBy,
    createdBy: userId,
    status: 'pending',
  }
}

// O plano do job a partir do banco: pedido, usuário, imóvel e, se houver, a leitura fixada.
export async function planejarDoBanco(db, requestId, userId) {
  const requestRef = db.collection('requests').doc(requestId)
  const userRef = db.collection('users').doc(userId)
  const [requestSnap, userSnap] = await Promise.all([requestRef.get(), userRef.get()])
  if (!requestSnap.exists) throw new Error('REQUEST_NOT_FOUND')
  if (!userSnap.exists) throw new Error('STAFF_REQUIRED')

  const request = requestSnap.data()
  const propertyId = request?.propertyId
  const propertySnap = propertyId
    ? await db.collection('properties').doc(propertyId).get()
    : null

  const plano = planejarBuildJob(
    requestId,
    request,
    propertySnap?.exists ? propertySnap.data() : null,
    userId,
    userSnap.data(),
  )
  if (plano.productionInput) {
    const reading = await db.collection('propertyReadings').doc(plano.productionInput.readingId).get()
    if (!reading.exists) throw new Error('PRODUCTION_INPUT_NOT_FOUND')
    const snapshot = {...reading.data(),id:reading.id}
    if (snapshot.propertyId !== plano.propertyId || snapshot.agencyId !== plano.agencyId
      || Object.entries(SNAPSHOT_FIELDS).some(([pin,field]) => plano.productionInput[pin] !== snapshot[field]))
      throw new Error('PRODUCTION_INPUT_MISMATCH')
  }
  return plano
}

// Pede a prévia ao robô. Confere tudo antes, para quem pede saber na hora o que está errado; o robô
// confere de novo ao criar o job. Um request só tem um job ativo: o robô consome o pedido a mais.
export async function pedirPrevia(db, requestId, userId) {
  const plano = await planejarDoBanco(db, requestId, userId)
  const existentes = await db.collection('buildJobs').where('requestId', '==', requestId).get()
  const ativo = existentes.docs.find((d) => ATIVOS.has(d.data().status))
  if (ativo) throw new Error('ACTIVE_BUILDJOB_EXISTS:' + ativo.id)
  const pedido = db.collection('auditLogs').doc()
  await pedido.set({ agencyId: plano.agencyId, userId, entityType: 'request', entityId: requestId,
    action: 'worker:previa', visibility: 'internal', timestamp: FieldValue.serverTimestamp() })
  return { commandId: pedido.id, ...plano }
}

function args(argv) {
  const [cmd, requestId, ...rest] = argv
  let user = '', project = ''
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--user') user = rest[++i] ?? ''
    else if (rest[i] === '--project') project = rest[++i] ?? ''
    else throw new Error('argumento desconhecido: ' + rest[i])
  }
  if (cmd !== 'criar' || !requestId || !user || !project) {
    throw new Error('uso: node tools/buildjob.mjs criar <requestId> --user <uid> --project <projectId>')
  }
  return { requestId, user, project }
}

async function main(argv = process.argv.slice(2)) {
  const a = args(argv)
  const app = getApps()[0] ?? initializeApp({ projectId: a.project })
  const db = getFirestore(app)
  console.log(JSON.stringify(await pedirPrevia(db, a.requestId, a.user)))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
