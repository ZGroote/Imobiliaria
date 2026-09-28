// BuildJob: cria o contrato persistente a partir de um request já em produção.
// Escrita via Admin SDK; o painel continua read-only em buildJobs/.
//
// Uso real:
//   node tools/buildjob.mjs criar <requestId> --user <uid> --project imobilaria-deccb
//
// No emulador, FIRESTORE_EMULATOR_HOST pode ser usado normalmente.
import { pathToFileURL } from 'node:url'
import { initializeApp, getApps } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const MODOS = new Set(['leve', 'premium'])
const PAPEIS = new Set(['platform_admin', 'operator'])
const ATIVOS = new Set(['pending', 'running'])

export function planejarBuildJob(requestId, request, property, userId, user) {
  if (!requestId || !request) throw new Error('REQUEST_NOT_FOUND')
  if (!user?.active || !PAPEIS.has(user.role)) throw new Error('STAFF_REQUIRED')
  if (request.status !== 'production') throw new Error('REQUEST_NOT_IN_PRODUCTION')
  if (!MODOS.has(request.productionMode)) throw new Error('PRODUCTION_MODE_MISSING')
  if (!request.propertyId) throw new Error('PROPERTY_REQUIRED')
  if (!property) throw new Error('PROPERTY_NOT_FOUND')
  if (property.agencyId !== request.agencyId) throw new Error('AGENCY_MISMATCH')
  if (!property.pipelineUnitId) throw new Error('PIPELINE_UNIT_REQUIRED')

  return {
    requestId,
    propertyId: request.propertyId,
    pipelineUnitId: property.pipelineUnitId,
    agencyId: request.agencyId,
    productionMode: request.productionMode,
    requestedBy: request.requestedBy,
    createdBy: userId,
    status: 'pending',
  }
}

export async function criarBuildJob(db, requestId, userId) {
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

  // Um request só pode ter um job ativo. Jobs encerrados continuam no histórico e permitem retry explícito.
  const existentes = await db.collection('buildJobs').where('requestId', '==', requestId).get()
  const ativo = existentes.docs.find((d) => ATIVOS.has(d.data().status))
  if (ativo) throw new Error('ACTIVE_BUILDJOB_EXISTS:' + ativo.id)

  const job = db.collection('buildJobs').doc()
  const log = db.collection('auditLogs').doc()
  const ts = FieldValue.serverTimestamp()
  const b = db.batch()
  b.set(log, {
    agencyId: plano.agencyId,
    userId,
    entityType: 'buildJob',
    entityId: job.id,
    action: 'created',
    visibility: 'internal',
    after: {
      status: plano.status,
      requestId: plano.requestId,
      propertyId: plano.propertyId,
      pipelineUnitId: plano.pipelineUnitId,
      productionMode: plano.productionMode,
    },
    timestamp: ts,
  })
  b.set(job, {
    ...plano,
    lastAuditId: log.id,
    createdAt: ts,
    updatedAt: ts,
  })
  await b.commit()
  return { id: job.id, ...plano, lastAuditId: log.id }
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
  const job = await criarBuildJob(db, a.requestId, a.user)
  console.log(JSON.stringify(job))
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
