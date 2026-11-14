import type { TrackingReport } from './rastreabilidade.ts'

// Navegadores não são somados: o mesmo navegador pode acessar vários empreendimentos.
export function resumoInicio(relatorios: TrackingReport[]) {
  const totais = relatorios.reduce((s, r) => ({
    sessoes: s.sessoes + r.summary.sessions,
    visualizacoes: s.visualizacoes + r.summary.pageViews,
    ativoMs: s.ativoMs + r.summary.activeMs,
    retornos: s.retornos + r.summary.ownReturns,
  }), { sessoes: 0, visualizacoes: 0, ativoMs: 0, retornos: 0 })
  return { ...totais, mediaMs: totais.sessoes ? Math.round(totais.ativoMs / totais.sessoes) : 0,
    parcial: relatorios.some(r => r.coverage.truncated) }
}

export function duracaoInicio(ms: number) {
  const s = Math.floor(ms / 1000)
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min ${s % 60} s`
    : `${Math.floor(s / 3600)} h ${Math.floor(s % 3600 / 60)} min`
}
