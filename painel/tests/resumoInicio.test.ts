import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumoInicio, duracaoInicio } from '../src/lib/resumoInicio.ts'
import type { TrackingReport } from '../src/lib/rastreabilidade.ts'

const relatorio = (sessoes: number, ativoMs: number, parcial = false): TrackingReport => ({
  from: '', to: '', propertyId: 'imovel',
  summary: { sessions: sessoes, activeMs: ativoMs, estimatedVisitors: 1, pageViews: 5,
    rootEntries: 1, forwardedEntries: 0, ownReturns: 1, uncertainEntries: 0 },
  byBroker: [], bySource: [], bySection: [], coverage: { consentedOnly: true, truncated: parcial, retentionDays: 30 },
})
test('média ponderada por sessões, retornos e cobertura sem somar visitantes entre imóveis', () => {
  assert.deepEqual(resumoInicio([relatorio(2, 120000), relatorio(1, 90000, true)]), {
    sessoes: 3, visualizacoes: 10, ativoMs: 210000, retornos: 2, mediaMs: 70000, parcial: true,
  })
})
test('sem sessões não produz média inválida; duração cobre segundos, minutos e horas', () => {
  assert.equal(resumoInicio([]).mediaMs, 0)
  assert.equal(duracaoInicio(0), '0 s')
  assert.equal(duracaoInicio(61000), '1 min 1 s')
  assert.equal(duracaoInicio(3660000), '1 h 1 min')
})
