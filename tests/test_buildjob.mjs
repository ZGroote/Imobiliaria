import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planejarBuildJob } from '../tools/buildjob.mjs'

const REQUEST = {
  agencyId: 'agA',
  requestedBy: 'corA',
  propertyId: 'propA',
  productionMode: 'leve',
  status: 'production',
}
const PROPERTY = {
  agencyId: 'agA',
  pipelineUnitId: 'monte-dos-cedros-37',
}
const USER = { role: 'operator', active: true }

test('buildjob: snapshot mínimo nasce do pedido e do imóvel', () => {
  const j = planejarBuildJob('reqA', REQUEST, PROPERTY, 'op', USER)
  assert.deepEqual(j, {
    requestId: 'reqA',
    propertyId: 'propA',
    pipelineUnitId: 'monte-dos-cedros-37',
    agencyId: 'agA',
    productionMode: 'leve',
    requestedBy: 'corA',
    createdBy: 'op',
    status: 'pending',
  })
})

test('buildjob: PREMIUM é preservado, não convertido silenciosamente', () => {
  const j = planejarBuildJob('reqP', { ...REQUEST, productionMode: 'premium' }, PROPERTY, 'admin',
    { role: 'platform_admin', active: true })
  assert.equal(j.productionMode, 'premium')
})

test('buildjob: somente staff ativo cria', () => {
  assert.throws(() => planejarBuildJob('reqA', REQUEST, PROPERTY, 'gerA',
    { role: 'agency_manager', active: true }), /STAFF_REQUIRED/)
  assert.throws(() => planejarBuildJob('reqA', REQUEST, PROPERTY, 'op',
    { role: 'operator', active: false }), /STAFF_REQUIRED/)
})

test('buildjob: request precisa estar em produção', () => {
  for (const status of ['submitted', 'accepted', 'internal_review', 'approved']) {
    assert.throws(() => planejarBuildJob('reqA', { ...REQUEST, status }, PROPERTY, 'op', USER),
      /REQUEST_NOT_IN_PRODUCTION/)
  }
})

test('buildjob: modo, imóvel e pipelineUnitId são obrigatórios', () => {
  assert.throws(() => planejarBuildJob('reqA', { ...REQUEST, productionMode: undefined }, PROPERTY, 'op', USER),
    /PRODUCTION_MODE_MISSING/)
  assert.throws(() => planejarBuildJob('reqA', { ...REQUEST, propertyId: undefined }, PROPERTY, 'op', USER),
    /PROPERTY_REQUIRED/)
  assert.throws(() => planejarBuildJob('reqA', REQUEST, null, 'op', USER), /PROPERTY_NOT_FOUND/)
  assert.throws(() => planejarBuildJob('reqA', REQUEST, { agencyId: 'agA' }, 'op', USER),
    /PIPELINE_UNIT_REQUIRED/)
})

test('buildjob: imóvel não pode escapar da agência do pedido', () => {
  assert.throws(() => planejarBuildJob('reqA', REQUEST,
    { ...PROPERTY, agencyId: 'agB' }, 'op', USER), /AGENCY_MISMATCH/)
})
